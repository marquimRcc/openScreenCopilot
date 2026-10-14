import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
	SavedGifPlan,
	SavedGifResult,
	SavedGifSourceMetadata,
} from "../../src/lib/savedRecordingGif";
import { type ExportJob, ExportJobs, type ExportOwner } from "../ipc/exportJobs";
import { DerivedRecordingTargets } from "./derivedRecordingTarget";
import { buildSavedOriginalGifScene } from "./savedRecordingGifScene";

type Prepared = ReturnType<typeof buildSavedOriginalGifScene>;
interface Source {
	key: string;
	path: string;
}
interface Deps {
	current(): Source | null;
	isBusy(): boolean;
	isOwnerCurrent(owner: ExportOwner): boolean;
	probe(file: string, signal: AbortSignal): Promise<SavedGifSourceMetadata>;
	pick(owner: ExportOwner, suggestedName: string): Promise<string | null>;
	start(
		prepared: Prepared,
		stagedPath: string,
		progress: (frames: number) => void,
	): ExportJob<unknown>;
	/** MUST perform codec/header/full decode validation in main, not trust stats. */
	validate(file: string, plan: SavedGifPlan, signal: AbortSignal): Promise<void>;
	progress(owner: ExportOwner, frames: number, totalFrames: number, jobId: string): void;
}
const digest = async (file: string, signal: AbortSignal) => {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(file, { signal })) hash.update(chunk as Buffer);
	return hash.digest("hex");
};

/** Main-only orchestration. No renderer paths/scenes or native controls escape.
 * Runtime dependencies and mutual admission guards are supplied by the main process. */
export class SavedRecordingGifs {
	private readonly jobs = new ExportJobs();
	private readonly active = new Map<
		ExportOwner,
		{ id: string; abort: AbortController; publishing: boolean; done: Promise<void>; finish(): void }
	>();
	private pauses = 0;
	private readonly targets: DerivedRecordingTargets;
	constructor(private readonly deps: Deps) {
		this.targets = new DerivedRecordingTargets(() => {
			const source = deps.current();
			return source ? { key: source.key, paths: [source.path] } : null;
		}, deps.isBusy);
	}
	isBusy() {
		return this.active.size > 0;
	}
	/** Never detach a native writer/decoder during quit; release admission if quit is canceled. */
	pauseAndDrain() {
		this.pauses++;
		const jobs = [...this.active.entries()];
		for (const [owner] of jobs) this.cancel(owner);
		let resumed = false;
		return {
			settled: Promise.all(jobs.map(([, job]) => job.done)).then(() => undefined),
			resume: () => {
				if (resumed) return;
				resumed = true;
				this.pauses--;
			},
		};
	}
	cancel(owner: ExportOwner): boolean {
		const job = this.active.get(owner);
		if (!job || job.publishing) return false;
		job.abort.abort();
		try {
			this.jobs.cancel(owner, job.id);
		} catch {
			/* Keep abort set and wait for writer settlement even if native cancel throws. */
		}
		return true;
	}
	async export(
		owner: ExportOwner,
		expectedPath: string,
		request: unknown,
	): Promise<SavedGifResult> {
		const live = this.deps.current();
		const source = live ? { key: live.key, path: live.path } : null;
		if (
			this.pauses > 0 ||
			!source ||
			source.path !== expectedPath ||
			this.isBusy() ||
			this.deps.isBusy() ||
			owner.isDestroyed() ||
			!this.deps.isOwnerCurrent(owner)
		) {
			return { success: false, error: "Saved recording is unavailable or busy." };
		}
		if (![".mp4", ".webm"].includes(path.extname(source.path).toLowerCase())) {
			return { success: false, error: "Original GIF supports MP4 and WebM recordings." };
		}
		let finish!: () => void;
		const done = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const job = { id: randomUUID(), abort: new AbortController(), publishing: false, done, finish };
		this.active.set(owner, job);
		const onDestroyed = () => {
			this.cancel(owner);
		};
		owner.once("destroyed", onDestroyed);
		let lease: Awaited<ReturnType<DerivedRecordingTargets["begin"]>> | undefined;
		const assertCurrent = () => {
			job.abort.signal.throwIfAborted();
			const current = this.deps.current();
			if (
				owner.isDestroyed() ||
				!this.deps.isOwnerCurrent(owner) ||
				this.deps.isBusy() ||
				current?.key !== source.key ||
				current.path !== source.path
			) {
				throw new Error("Recording or window changed.");
			}
		};
		try {
			assertCurrent();
			const before = await fs.stat(source.path);
			if (!before.isFile() || before.size <= 0) throw new Error("Original is unavailable.");
			const originalHash = await digest(source.path, job.abort.signal);
			assertCurrent();
			const metadata = await this.deps.probe(source.path, job.abort.signal);
			assertCurrent();
			const prepared = buildSavedOriginalGifScene({ ...metadata, path: source.path }, request);
			const destination = await this.deps.pick(
				owner,
				`${path.basename(source.path, path.extname(source.path))}-excerpt.gif`,
			);
			assertCurrent();
			if (!destination) return { success: false, canceled: true };
			const ready = await fs.stat(source.path);
			if (
				before.size !== ready.size ||
				before.mtimeMs !== ready.mtimeMs ||
				before.ino !== ready.ino ||
				before.dev !== ready.dev
			) {
				throw new Error("Original changed before GIF export.");
			}
			assertCurrent();
			lease = await this.targets.begin(owner, this.targets.approve(owner, destination, "gif"));
			assertCurrent();
			const stagedPath = lease.outputPath;
			const stats = await this.jobs.run(
				owner,
				job.id,
				(progress) => {
					progress(0);
					const native = this.deps.start(prepared, stagedPath, progress);
					const safe = {
						result: native.result,
						cancel: () => {
							try {
								return native.cancel();
							} catch {
								return false;
							} // Still await result before owned-file cleanup.
						},
					};
					// Cancel may have arrived synchronously during native initialization,
					// before ExportJobs has registered its cancel handle.
					if (job.abort.signal.aborted) safe.cancel();
					return safe;
				},
				(frames) => {
					try {
						if (
							!job.abort.signal.aborted &&
							!owner.isDestroyed() &&
							this.deps.isOwnerCurrent(owner) &&
							this.deps.current()?.key === source.key &&
							this.deps.current()?.path === source.path &&
							Number.isFinite(frames) &&
							frames >= 0
						) {
							this.deps.progress(
								owner,
								Math.min(Math.floor(frames), prepared.plan.totalFrames),
								prepared.plan.totalFrames,
								job.id,
							);
						}
					} catch {
						/* A closed UI/progress transport must not detach the writer. */
					}
				},
			);
			assertCurrent();
			if (!stats) throw new Error("Native GIF compositor is unavailable.");
			let sizeBytes = 0;
			const savedPath = await lease.publish(async (file) => {
				assertCurrent();
				await this.deps.validate(file, prepared.plan, job.abort.signal);
				const after = await fs.stat(source.path);
				if (
					before.size !== after.size ||
					before.mtimeMs !== after.mtimeMs ||
					before.ino !== after.ino ||
					before.dev !== after.dev ||
					(await digest(source.path, job.abort.signal)) !== originalHash
				) {
					throw new Error("Original changed during GIF export.");
				}
				sizeBytes = (await fs.stat(file)).size;
				assertCurrent();
				job.publishing = true;
			});
			return { success: true, path: savedPath, sizeBytes };
		} catch (error) {
			if (job.abort.signal.aborted) return { success: false, canceled: true };
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				errorCode:
					error && typeof error === "object" && "code" in error && error.code === "EEXIST"
						? "exists"
						: undefined,
			};
		} finally {
			// Native promise and decoder have settled before any owned-file cleanup.
			try {
				await lease?.discard();
			} finally {
				owner.removeListener("destroyed", onDestroyed);
				this.active.delete(owner);
				job.finish();
			}
		}
	}
}
