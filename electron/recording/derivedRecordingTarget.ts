import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type Format = "gif" | "mp4";
interface Owner {
	isDestroyed(): boolean;
	once(event: "destroyed", listener: () => void): unknown;
	removeListener(event: "destroyed", listener: () => void): unknown;
}
interface Source {
	/** Main-owned identity, changed whenever the current recording changes. */
	key: string;
	paths: readonly string[];
}
interface Grant {
	token: string;
	destination: string;
	format: Format;
	source: Source;
	revoke: () => void;
}

function portableOutput(destination: string, format: Format) {
	const name = path.basename(destination);
	if (
		!path.isAbsolute(destination) ||
		!["gif", "mp4"].includes(format) ||
		path.extname(name).toLowerCase() !== `.${format}` ||
		/[<>:"|?*]/.test(name) ||
		Array.from(name).some((character) => character.charCodeAt(0) < 32) ||
		/[. ]$/.test(name) ||
		/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
	)
		throw new Error("Invalid derived recording destination.");
}

async function requireAbsent(file: string) {
	try {
		await fs.lstat(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
	throw new Error("Destination already exists. Choose a new filename.");
}

/** Main-only capability store. Never expose approve() or a caller-supplied path
 * over IPC: destination must be the native dialog's result for this same owner.
 * Not yet wired to the simple-result UI or the legacy export bridge. */
export class DerivedRecordingTargets {
	private readonly grants = new WeakMap<Owner, Grant>();
	private readonly active = new WeakSet<Owner>();
	constructor(
		private readonly currentSource: () => Source | null,
		private readonly isBusy: () => boolean,
	) {}

	approve(owner: Owner, destination: string, format: Format): string {
		const source = this.currentSource();
		if (
			owner.isDestroyed() ||
			this.active.has(owner) ||
			this.isBusy() ||
			!source?.key ||
			!source.paths.length
		)
			throw new Error("Saved recording is unavailable or busy.");
		portableOutput(destination, format);
		const previous = this.grants.get(owner);
		if (previous) owner.removeListener("destroyed", previous.revoke);
		const token = randomUUID();
		const revoke = () => this.grants.delete(owner);
		this.grants.set(owner, {
			token,
			destination,
			format,
			source: { key: source.key, paths: [...source.paths] },
			revoke,
		});
		owner.once("destroyed", revoke);
		return token;
	}

	async begin(owner: Owner, token: string) {
		const grant = this.grants.get(owner);
		if (!grant || grant.token !== token)
			throw new Error("Unknown derived recording authorization.");
		if (this.active.has(owner)) throw new Error("A derived recording job is already running.");
		this.active.add(owner);
		this.grants.delete(owner); // One use, including failure; retry needs a new dialog.
		owner.removeListener("destroyed", grant.revoke);
		let invalidated = false;
		const invalidate = () => {
			invalidated = true;
		};
		owner.once("destroyed", invalidate);
		const assertCurrent = () => {
			const current = this.currentSource();
			if (
				invalidated ||
				owner.isDestroyed() ||
				this.isBusy() ||
				current?.key !== grant.source.key ||
				current.paths.length !== grant.source.paths.length ||
				current.paths.some((file, index) => file !== grant.source.paths[index])
			)
				throw new Error("Recording or window changed. Select the destination again.");
		};
		let directory: string | undefined;
		let outputPath: string | undefined;
		let finished = false;
		const cleanup = async () => {
			this.active.delete(owner);
			owner.removeListener("destroyed", invalidate);
			// Exact app-created paths only. No recursive deletion and NEVER the destination.
			if (outputPath)
				await fs.unlink(outputPath).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
			if (directory) await fs.rmdir(directory);
		};
		try {
			assertCurrent();
			const parent = await fs.realpath(path.dirname(grant.destination));
			const destination = path.join(parent, path.basename(grant.destination));
			// Refuse every existing file, including source aliases/hardlinks/symlinks.
			await requireAbsent(destination);
			for (const source of grant.source.paths) {
				const stats = await fs.stat(source);
				if (!stats.isFile() || stats.size <= 0) throw new Error("Source recording is unavailable.");
			}
			assertCurrent();
			directory = await fs.mkdtemp(path.join(parent, ".openscreencopilot-derived-"));
			outputPath = path.join(directory, `output.${grant.format}`);
			assertCurrent();
			const stagedPath = outputPath;
			return {
				/** Main gives this private path to the compositor, never to the renderer. */
				outputPath: stagedPath,
				/** Call only after writer completion, including cancellation completion. */
				discard: async () => {
					if (finished) return;
					finished = true;
					await cleanup();
				},
				publish: async (validate: (file: string, format: Format) => Promise<void>) => {
					if (finished) throw new Error("Derived recording job is already finished.");
					finished = true;
					try {
						assertCurrent();
						await validate(stagedPath, grant.format);
						const stats = await fs.lstat(stagedPath);
						if (!stats.isFile() || stats.size <= 0 || stats.nlink !== 1)
							throw new Error("Derived recording is not a new validated file.");
						assertCurrent();
						// Same-filesystem hardlink publishes atomically with no replacement.
						// EEXIST (including a racing creator) preserves the existing destination.
						// The owned staged file is cleaned in finally. Unsupported
						// filesystems fail explicitly; never fall back to overwriting rename.
						await fs.link(stagedPath, destination);
						return destination;
					} finally {
						await cleanup();
					}
				},
			};
		} catch (error) {
			await cleanup();
			throw error;
		}
	}
}
