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

async function replaceAtomically(target: string, contents: string): Promise<void> {
	const token = randomUUID();
	const temporary = `${target}.${token}.tmp`;
	const backup = `${target}.${token}.bak`;
	let backedUp = false;
	await fs.writeFile(temporary, contents, { encoding: "utf8", flag: "wx" });
	try {
		try {
			await fs.rename(target, backup);
			backedUp = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		try {
			await fs.rename(temporary, target);
		} catch (error) {
			if (backedUp) await fs.rename(backup, target).catch(() => undefined);
			throw error;
		}
		if (backedUp) await fs.rm(backup, { force: true });
	} finally {
		await fs.rm(temporary, { force: true }).catch(() => undefined);
	}
}

export class PostRecordingTranscriptions {
	private active: {
		owner: PostRecordingTranscriptionOwner;
		abort: AbortController;
		publishing: boolean;
	} | null = null;

	constructor(private readonly deps: Deps) {}

	isBusy(): boolean {
		return this.active !== null;
	}

	cancel(owner: PostRecordingTranscriptionOwner): boolean {
		if (!this.active || this.active.owner !== owner || this.active.publishing) return false;
		this.active.abort.abort();
		this.deps.engine().cancel();
		return true;
	}

	async start(
		owner: PostRecordingTranscriptionOwner,
		expectedPath: string,
	): Promise<PostRecordingTranscriptionResult> {
		const source = this.deps.current();
		if (
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

		const abort = new AbortController();
		this.active = { owner, abort, publishing: false };
		const onDestroyed = () => this.cancel(owner);
		owner.once("destroyed", onDestroyed);
		const engine = this.deps.engine();
		const emit = (event: PostRecordingTranscriptionStatus) => {
			if (!owner.isDestroyed() && this.deps.isOwnerCurrent(owner)) this.deps.emit(owner, event);
		};
		const detach = engine.addStatusSink((status) => {
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
			if (this.active?.owner === owner) this.active.publishing = true;
			await replaceAtomically(jsonPath, `${JSON.stringify(document, null, 2)}\n`);
			await replaceAtomically(txtPath, text ? `${text}\n` : "");
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
			detach();
			owner.removeListener("destroyed", onDestroyed);
			if (this.active?.owner === owner) this.active = null;
		}
	}
}
