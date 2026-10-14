import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { SavedRecordingCopyResult } from "../../src/lib/savedRecording";
import { DerivedRecordingTargets } from "./derivedRecordingTarget";

export interface SavedRecordingCopyOwner {
	isDestroyed(): boolean;
	once(event: "destroyed", listener: () => void): unknown;
	removeListener(event: "destroyed", listener: () => void): unknown;
}
type Owner = SavedRecordingCopyOwner;
interface CopySource {
	key: string;
	path: string;
}
interface CopyDeps {
	current(): CopySource | null;
	isBusy(): boolean;
	isOwnerCurrent(owner: Owner): boolean;
	pick(owner: Owner, name: string, extension: "mp4" | "webm"): Promise<string | null>;
}

/** Copies ORIGINAL bytes only. No recompression, webcam composition or upload. */
export class SavedRecordingCopies {
	private readonly active = new Map<Owner, { abort: AbortController; publishing: boolean }>();
	private readonly targets: DerivedRecordingTargets;
	constructor(private readonly deps: CopyDeps) {
		this.targets = new DerivedRecordingTargets(() => {
			const source = deps.current();
			return source ? { key: source.key, paths: [source.path] } : null;
		}, deps.isBusy);
	}
	isBusy() {
		return this.active.size > 0;
	}
	cancel(owner: Owner): boolean {
		const job = this.active.get(owner);
		if (!job || job.publishing) return false;
		job.abort.abort();
		return true;
	}
	async copy(owner: Owner, expectedPath: string): Promise<SavedRecordingCopyResult> {
		const source = this.deps.current();
		if (
			!source ||
			source.path !== expectedPath ||
			this.deps.isBusy() ||
			this.active.has(owner) ||
			owner.isDestroyed() ||
			!this.deps.isOwnerCurrent(owner)
		)
			return { success: false, error: "Saved recording is unavailable or busy." };
		const extension = path.extname(source.path).slice(1).toLowerCase();
		if (extension !== "mp4" && extension !== "webm")
			return { success: false, error: "Original copy supports MP4 and WebM recordings." };
		const job = { abort: new AbortController(), publishing: false };
		this.active.set(owner, job);
		const onDestroyed = () => job.abort.abort();
		owner.once("destroyed", onDestroyed);
		let lease: Awaited<ReturnType<DerivedRecordingTargets["begin"]>> | undefined;
		const assertCurrent = () => {
			const current = this.deps.current();
			job.abort.signal.throwIfAborted();
			if (
				owner.isDestroyed() ||
				!this.deps.isOwnerCurrent(owner) ||
				this.deps.isBusy() ||
				current?.key !== source.key ||
				current.path !== source.path
			)
				throw new Error("Recording or window changed.");
		};
		try {
			const before = await fs.stat(source.path);
			if (!before.isFile() || before.size <= 0) throw new Error("Original file is unavailable.");
			assertCurrent();
			const base = path.basename(source.path, path.extname(source.path));
			const destination = await this.deps.pick(owner, `${base}-copy.${extension}`, extension);
			assertCurrent();
			if (!destination) return { success: false, canceled: true };
			lease = await this.targets.begin(owner, this.targets.approve(owner, destination, extension));
			assertCurrent();
			const digest = createHash("sha256");
			const hashPass = new Transform({
				transform(chunk: Buffer, _encoding, callback) {
					digest.update(chunk);
					callback(null, chunk);
				},
			});
			await pipeline(
				createReadStream(source.path),
				hashPass,
				createWriteStream(lease.outputPath, { flags: "wx" }),
				{ signal: job.abort.signal },
			);
			const originalHash = digest.digest("hex");
			const savedPath = await lease.publish(async (file) => {
				assertCurrent();
				const copiedHash = createHash("sha256");
				for await (const chunk of createReadStream(file, { signal: job.abort.signal }))
					copiedHash.update(chunk as Buffer);
				const after = await fs.stat(source.path);
				if (
					before.size !== after.size ||
					before.mtimeMs !== after.mtimeMs ||
					before.ino !== after.ino ||
					before.dev !== after.dev ||
					originalHash !== copiedHash.digest("hex")
				)
					throw new Error("Original changed or copied file verification failed.");
				assertCurrent();
				// After this boundary cancellation cannot promise that no file was published.
				job.publishing = true;
			});
			return { success: true, path: savedPath };
		} catch (error) {
			if (job.abort.signal.aborted) return { success: false, canceled: true };
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				errorCode: (error as NodeJS.ErrnoException).code === "EEXIST" ? "exists" : undefined,
			};
		} finally {
			// pipeline has settled: both streams are closed before owned-file cleanup.
			try {
				await lease?.discard();
			} finally {
				owner.removeListener("destroyed", onDestroyed);
				this.active.delete(owner);
			}
		}
	}
}
