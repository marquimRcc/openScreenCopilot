import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SttStatusEvent, SttTranscribeResponse } from "../stt/transcriptionContract";

export type PostRecordingTranscriptionPhase =
	| "preparing"
	| "transcribing"
	| "completed"
	| "cancelled"
	| "failed";

export interface PostRecordingTranscriptionStatus {
	phase: PostRecordingTranscriptionPhase;
	completedSec?: number;
	totalSec?: number;
	backend?: string;
	rtf?: number;
}

export interface PostRecordingTranscriptSegment {
	text: string;
	startSec: number;
	endSec: number;
}

export interface PostRecordingTranscriptDocument {
	schema: "openscreencopilot.post-recording-transcript";
	version: 1;
	language: string;
	backend: string;
	segments: PostRecordingTranscriptSegment[];
}

export type PostRecordingTranscriptionResult =
	| {
			success: true;
			text: string;
			txtPath: string;
			jsonPath: string;
			document: PostRecordingTranscriptDocument;
	  }
	| { success: false; cancelled?: true; errorCode?: "unavailable" | "busy" | "failed" };

export interface PostRecordingTranscriptionOwner {
	isDestroyed(): boolean;
	send(channel: string, payload: PostRecordingTranscriptionStatus): void;
	once(event: "destroyed", listener: () => void): unknown;
	removeListener(event: "destroyed", listener: () => void): unknown;
}

interface Source {
	key: string;
	path: string;
}

interface Engine {
	addStatusSink(sink: (event: SttStatusEvent) => void): () => void;
	transcribe(request: { sourcePath: string; language: string }): Promise<SttTranscribeResponse>;
	cancel(): void;
}

interface Deps {
	current(): Source | null;
	isBusy(): boolean;
	isAllowed(file: string): boolean;
	isOwnerCurrent(owner: PostRecordingTranscriptionOwner): boolean;
	engine(): Engine;
	emit(owner: PostRecordingTranscriptionOwner, event: PostRecordingTranscriptionStatus): void;
}

const MAX_SOURCE_BYTES = 8 * 1024 * 1024 * 1024;

function plainText(result: SttTranscribeResponse): string {
	return result.segments
		.map((segment) => segment.text.trim())
		.filter(Boolean)
		.join("\n")
		.trim();
}

function transcriptTargets(sourcePath: string) {
	const parsed = path.parse(sourcePath);
	const stem = path.join(parsed.dir, `${parsed.name}.transcript`);
	return { txtPath: `${stem}.txt`, jsonPath: `${stem}.json` };
}

async function replaceAtomically(
	replacements: readonly { target: string; contents: string }[],
): Promise<void> {
	const token = randomUUID();
	const entries = replacements.map(({ target, contents }) => ({
		target,
		contents,
		temporary: `${target}.${token}.tmp`,
		backup: `${target}.${token}.bak`,
		backedUp: false,
		published: false,
	}));
	try {
		for (const entry of entries) {
			await fs.writeFile(entry.temporary, entry.contents, { encoding: "utf8", flag: "wx" });
		}
		for (const entry of entries) {
			try {
				await fs.rename(entry.target, entry.backup);
				entry.backedUp = true;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
		}
		for (const entry of entries) {
			await fs.rename(entry.temporary, entry.target);
			entry.published = true;
		}
		await Promise.all(
			entries
				.filter((entry) => entry.backedUp)
				.map((entry) => fs.rm(entry.backup, { force: true }).catch(() => undefined)),
		);
	} catch (error) {
		let rollbackError: unknown;
		for (const entry of [...entries].reverse()) {
			if (entry.published) {
				await fs.rm(entry.target, { force: true }).catch((failure) => {
					rollbackError ??= failure;
				});
			}
		}
		for (const entry of entries) {
			if (entry.backedUp) {
				await fs.rename(entry.backup, entry.target).catch((failure) => {
					rollbackError ??= failure;
				});
			}
		}
		if (rollbackError) {
			throw Object.assign(new Error("Transcript publication rollback failed."), {
				cause: error,
				rollbackError,
			});
		}
		throw error;
	} finally {
		await Promise.all(
			entries.map((entry) => fs.rm(entry.temporary, { force: true }).catch(() => undefined)),
		);
	}
}

export class PostRecordingTranscriptions {
	private active: {
		owner: PostRecordingTranscriptionOwner;
		abort: AbortController;
		publishing: boolean;
		engine: Engine;
		done: Promise<void>;
		finish(): void;
	} | null = null;
	private pauses = 0;

	constructor(private readonly deps: Deps) {}

	isBusy(): boolean {
		return this.active !== null;
	}

	/** Freeze admission synchronously and wait for inference/publication cleanup before quit. */
	pauseAndDrain() {
		this.pauses++;
		const job = this.active;
		if (job) this.cancel(job.owner);
		let resumed = false;
		return {
			settled: job?.done ?? Promise.resolve(),
			resume: () => {
				if (resumed) return;
				resumed = true;
				this.pauses--;
			},
		};
	}

	cancel(owner: PostRecordingTranscriptionOwner): boolean {
		if (!this.active || this.active.owner !== owner || this.active.publishing) return false;
		this.active.abort.abort();
		try {
			this.active.engine.cancel();
		} catch {
			/* Keep abort set and let the owned run settle even if engine cancellation throws. */
		}
		return true;
	}

	async start(
		owner: PostRecordingTranscriptionOwner,
		expectedPath: string,
	): Promise<PostRecordingTranscriptionResult> {
		const source = this.deps.current();
		if (
			this.pauses > 0 ||
			this.active ||
			this.deps.isBusy() ||
			!source ||
			source.path !== expectedPath ||
			!this.deps.isAllowed(source.path) ||
			owner.isDestroyed() ||
			!this.deps.isOwnerCurrent(owner)
		) {
			return { success: false, errorCode: this.active ? "busy" : "unavailable" };
		}

		const engine = this.deps.engine();
		const abort = new AbortController();
		let finish!: () => void;
		const done = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const job = { owner, abort, publishing: false, engine, done, finish };
		this.active = job;
		const onDestroyed = () => this.cancel(owner);
		let ownerListenerAttached = false;
		const emit = (event: PostRecordingTranscriptionStatus) => {
			if (!owner.isDestroyed() && this.deps.isOwnerCurrent(owner)) this.deps.emit(owner, event);
		};
		let detach: () => void = () => undefined;

		const assertCurrent = () => {
			abort.signal.throwIfAborted();
			const current = this.deps.current();
			if (
				owner.isDestroyed() ||
				!this.deps.isOwnerCurrent(owner) ||
				current?.key !== source.key ||
				current.path !== source.path
			) {
				throw new DOMException("Aborted", "AbortError");
			}
		};

		try {
			owner.once("destroyed", onDestroyed);
			ownerListenerAttached = true;
			detach = engine.addStatusSink((status) => {
				emit(
					status.phase === "model"
						? { phase: "preparing" }
						: {
								phase: "transcribing",
								completedSec: status.completedSec,
								totalSec: status.totalSec,
								backend: status.backend,
								rtf: status.rtf,
							},
				);
			});
			emit({ phase: "preparing" });
			const before = await fs.stat(source.path);
			if (!before.isFile() || before.size <= 0 || before.size > MAX_SOURCE_BYTES) {
				return { success: false, errorCode: "unavailable" };
			}
			assertCurrent();
			const response = await engine.transcribe({ sourcePath: source.path, language: "pt" });
			assertCurrent();
			const after = await fs.stat(source.path);
			if (
				before.size !== after.size ||
				before.mtimeMs !== after.mtimeMs ||
				before.ino !== after.ino ||
				before.dev !== after.dev
			) {
				throw new Error("Recording changed during transcription.");
			}
			const document: PostRecordingTranscriptDocument = {
				schema: "openscreencopilot.post-recording-transcript",
				version: 1,
				language: response.detectedLanguage || "pt",
				backend: response.backend,
				segments: response.segments.map(({ text, startSec, endSec }) => ({
					text,
					startSec,
					endSec,
				})),
			};
			const text = plainText(response);
			const { txtPath, jsonPath } = transcriptTargets(source.path);
			assertCurrent();
			if (this.active === job) this.active.publishing = true;
			await replaceAtomically([
				{ target: jsonPath, contents: `${JSON.stringify(document, null, 2)}\n` },
				{ target: txtPath, contents: text ? `${text}\n` : "" },
			]);
			emit({ phase: "completed" });
			return { success: true, text, txtPath, jsonPath, document };
		} catch (error) {
			if (abort.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
				emit({ phase: "cancelled" });
				return { success: false, cancelled: true };
			}
			emit({ phase: "failed" });
			return { success: false, errorCode: "failed" };
		} finally {
			try {
				detach();
			} catch {
				/* Cleanup must not leave quit drainage waiting forever. */
			}
			if (ownerListenerAttached) {
				try {
					owner.removeListener("destroyed", onDestroyed);
				} catch {
					/* The owner may already be gone; the job is still settled below. */
				}
			}
			if (this.active === job) this.active = null;
			job.finish();
		}
	}
}
