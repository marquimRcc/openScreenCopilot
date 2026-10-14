import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SavedRecordingGifs } from "./savedRecordingGif";

class Owner extends EventEmitter {
	id = 10;
	closed = false;
	isDestroyed() {
		return this.closed;
	}
	close() {
		this.closed = true;
		this.emit("destroyed");
	}
}
let dir: string, original: string, destination: string, owner: Owner;
let current: { key: string; path: string } | null, busy: boolean, gifs: SavedRecordingGifs;
let deps: ConstructorParameters<typeof SavedRecordingGifs>[0];
const request = { mode: "original", startSec: 1, endSec: 3, fps: 15, maxHeight: 480, loop: true };
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "openscreen-gif-controller-"));
	original = path.join(dir, "gravação original.mp4");
	destination = path.join(dir, "derivado separado.gif");
	await fs.writeFile(original, "SYNTHETIC original bytes, not real video");
	owner = new Owner();
	current = { key: "synthetic-session", path: original };
	busy = false;
	deps = {
		current: () => current,
		isBusy: () => busy,
		isOwnerCurrent: (candidate) => candidate === owner,
		probe: vi.fn(async () => ({ width: 960, height: 600, durationSec: 5 })),
		pick: vi.fn(async () => destination),
		start: vi.fn((_prepared, staged, progress) => ({
			// Controller fixtures are NOT real GIFs; codec/decode is tested separately.
			result: fs.writeFile(staged, "SYNTHETIC derived bytes").then(() => {
				progress(30);
				return { frames: 30 };
			}),
			cancel: vi.fn(() => true),
		})),
		validate: vi.fn(async () => undefined),
		progress: vi.fn(),
	};
	gifs = new SavedRecordingGifs(deps);
});
afterEach(async () => {
	owner.close();
	if (
		path.dirname(dir) !== (await fs.realpath(os.tmpdir())) ||
		!path.basename(dir).startsWith("openscreen-gif-controller-")
	)
		throw new Error("Unexpected fixture path");
	await fs.rm(dir, { recursive: true, force: true });
});
describe("saved-original GIF controller with synthetic writer/validator", () => {
	it("does not detach the writer when the progress transport fails", async () => {
		deps.progress = vi.fn(() => {
			throw new Error("UI closed during send");
		});
		expect((await gifs.export(owner, original, request)).success).toBe(true);
		expect(gifs.isBusy()).toBe(false);
	});
	it.each(["probe", "picker"])("cancels pending %s without starting a writer", async (phase) => {
		const entered = deferred<void>(),
			release = deferred<void>();
		if (phase === "probe")
			deps.probe = vi.fn(async () => {
				entered.resolve();
				await release.promise;
				return { width: 960, height: 600, durationSec: 5 };
			});
		else
			deps.pick = vi.fn(async () => {
				entered.resolve();
				await release.promise;
				return destination;
			});
		const pending = gifs.export(owner, original, request);
		await entered.promise;
		expect(gifs.cancel(owner)).toBe(true);
		release.resolve();
		expect(await pending).toEqual({ success: false, canceled: true });
		expect(deps.start).not.toHaveBeenCalled();
		expect(await fs.readdir(dir)).toEqual([path.basename(original)]);
	});
	it("snapshots source identity even if its provider mutates the same object", async () => {
		deps.pick = vi.fn(async () => {
			if (current) current.key = "mutated-in-place";
			return destination;
		});
		expect((await gifs.export(owner, original, request)).success).toBe(false);
		expect(deps.start).not.toHaveBeenCalled();
	});
	it("still waits for a writer when native cancellation throws", async () => {
		const writing = deferred<unknown>(),
			entered = deferred<void>();
		deps.start = vi.fn(() => {
			entered.resolve();
			return {
				result: writing.promise,
				cancel: () => {
					throw new Error("cancel unavailable");
				},
			};
		});
		const pending = gifs.export(owner, original, request);
		await entered.promise;
		owner.close();
		expect(gifs.isBusy()).toBe(true);
		writing.resolve({ frames: 30 });
		expect(await pending).toEqual({ success: false, canceled: true });
		expect(await fs.readdir(dir)).toEqual([path.basename(original)]);
	});
	it("publishes a separate file only after validation, preserving source and session", async () => {
		const originalBytes = await fs.readFile(original),
			session = current;
		expect(await gifs.export(owner, original, request)).toEqual({
			success: true,
			path: destination,
			sizeBytes: 23,
		});
		expect(await fs.readFile(original)).toEqual(originalBytes);
		expect(current).toBe(session);
		expect(deps.validate).toHaveBeenCalledOnce();
		expect(deps.progress).toHaveBeenCalledWith(owner, 30, 30, expect.any(String));
		expect(gifs.isBusy()).toBe(false);
		expect(owner.listenerCount("destroyed")).toBe(0);
		expect((await fs.readdir(dir)).sort()).toEqual(
			[path.basename(destination), path.basename(original)].sort(),
		);
	});
	it("rejects foreign owner, stale source, busy state and duplicates before another dialog", async () => {
		expect((await gifs.export(new Owner(), original, request)).success).toBe(false);
		expect((await gifs.export(owner, destination, request)).success).toBe(false);
		busy = true;
		expect((await gifs.export(owner, original, request)).success).toBe(false);
		busy = false;
		const picker = deferred<string | null>();
		const entered = deferred<void>();
		deps.pick = vi.fn(() => {
			entered.resolve();
			return picker.promise;
		});
		const first = gifs.export(owner, original, request);
		await entered.promise;
		expect((await gifs.export(owner, original, request)).success).toBe(false);
		picker.resolve(null);
		expect(await first).toEqual({ success: false, canceled: true });
		expect(deps.pick).toHaveBeenCalledOnce();
	});
	it.each([
		"session",
		"busy",
		"role",
		"source",
	])("revalidates %s after the native dialog", async (change) => {
		deps.pick = vi.fn(async () => {
			if (change === "session") current = { key: "replacement", path: original };
			if (change === "busy") busy = true;
			if (change === "role") deps.isOwnerCurrent = () => false;
			if (change === "source") await fs.writeFile(original, "externally replaced original");
			return destination;
		});
		expect((await gifs.export(owner, original, request)).success).toBe(false);
		await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
	});
	it("refuses an existing destination and never starts the compositor", async () => {
		await fs.writeFile(destination, "keep me");
		expect(await gifs.export(owner, original, request)).toMatchObject({
			success: false,
			errorCode: "exists",
		});
		expect(await fs.readFile(destination, "utf8")).toBe("keep me");
		expect(deps.start).not.toHaveBeenCalled();
	});
	it("refuses malformed/path-bearing options before picking a destination", async () => {
		expect((await gifs.export(owner, original, { ...request, outPath: original })).success).toBe(
			false,
		);
		expect(deps.pick).not.toHaveBeenCalled();
	});
	it.each([
		"validation",
		"unavailable",
		"init",
	])("never publishes after %s failure", async (kind) => {
		if (kind === "validation")
			deps.validate = vi.fn(async () => {
				throw new Error("bad decode");
			});
		if (kind === "unavailable")
			deps.start = vi.fn(() => ({ result: Promise.resolve(null), cancel: () => false }));
		if (kind === "init")
			deps.start = vi.fn(() => {
				throw new Error("missing cancel support");
			});
		expect((await gifs.export(owner, original, request)).success).toBe(false);
		expect(await fs.readdir(dir)).toEqual([path.basename(original)]);
		expect(gifs.isBusy()).toBe(false);
	});
	it.each(["cancel", "close"])("awaits the native writer after %s before cleanup", async (how) => {
		const writing = deferred<void>(),
			entered = deferred<void>();
		let stagedPath = "";
		const cancel = vi.fn(() => true);
		deps.start = vi.fn((_prepared, staged) => {
			stagedPath = staged;
			entered.resolve();
			return { result: writing.promise.then(() => fs.writeFile(staged, "writer closed")), cancel };
		});
		const result = gifs.export(owner, original, request);
		await entered.promise;
		expect(gifs.cancel(new Owner())).toBe(false);
		if (how === "cancel") expect(gifs.cancel(owner)).toBe(true);
		else owner.close();
		expect(cancel).toHaveBeenCalled();
		expect(gifs.isBusy()).toBe(true);
		await expect(fs.stat(path.dirname(stagedPath))).resolves.toBeDefined();
		writing.resolve();
		expect(await result).toEqual({ success: false, canceled: true });
		expect(await fs.readdir(dir)).toEqual([path.basename(original)]);
		expect(gifs.cancel(owner)).toBe(false);
	});
	it("cancels native initialization even before the export handle is registered", async () => {
		const cancel = vi.fn(() => true);
		deps.start = vi.fn(() => {
			gifs.cancel(owner);
			return { result: Promise.resolve({ frames: 0 }), cancel };
		});
		expect(await gifs.export(owner, original, request)).toEqual({ success: false, canceled: true });
		expect(cancel).toHaveBeenCalledOnce();
		expect(await fs.readdir(dir)).toEqual([path.basename(original)]);
	});
	it("aborts validation without publishing and waits for validator settlement", async () => {
		const entered = deferred<void>(),
			validating = deferred<void>();
		deps.validate = vi.fn(async () => {
			entered.resolve();
			await validating.promise;
		});
		const pending = gifs.export(owner, original, request);
		await entered.promise;
		expect(gifs.cancel(owner)).toBe(true);
		expect(gifs.isBusy()).toBe(true);
		validating.resolve();
		expect(await pending).toEqual({ success: false, canceled: true });
		expect(await fs.readdir(dir)).toEqual([path.basename(original)]);
	});
});
