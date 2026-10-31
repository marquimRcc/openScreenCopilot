import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SavedRecordingCopies } from "./savedRecordingCopy";

class Owner extends EventEmitter {
	closed = false;
	isDestroyed() {
		return this.closed;
	}
	close() {
		this.closed = true;
		this.emit("destroyed");
	}
}
let directory: string, original: string, destination: string;
let current: { key: string; path: string } | null;
let owner: Owner, copies: SavedRecordingCopies;
let busy: boolean;
let pick: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
const hash = async (file: string) =>
	createHash("sha256")
		.update(await fs.readFile(file))
		.digest("hex");
beforeEach(async () => {
	directory = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "openscreen-copy-test-"));
	original = path.join(directory, "gravação original.mp4");
	destination = path.join(directory, "cópia escolhida.mp4");
	await fs.writeFile(original, Buffer.from([0, 1, 2, 3, 4, 255, 234, 19]));
	current = { key: "recording-1", path: original };
	owner = new Owner();
	busy = false;
	pick = vi.fn(async () => destination);
	copies = new SavedRecordingCopies({
		current: () => current,
		isBusy: () => busy,
		isOwnerCurrent: (candidate) => candidate === owner,
		pick,
	});
});
afterEach(async () => {
	owner.close();
	if (
		path.dirname(directory) !== (await fs.realpath(os.tmpdir())) ||
		!path.basename(directory).startsWith("openscreen-copy-test-")
	)
		throw new Error("Unexpected test fixture directory.");
	await fs.rm(directory, { recursive: true, force: true });
});
describe("saved-original copy", () => {
	it("waits for copy staging cleanup even when publication is already noncancelable", async () => {
		let entered!: () => void, release!: () => void;
		const cleaning = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const rmdir = fs.rmdir.bind(fs);
		const spy = vi.spyOn(fs, "rmdir").mockImplementation(async (folder) => {
			entered();
			await held;
			await rmdir(folder);
		});
		try {
			const pending = copies.copy(owner, original);
			await cleaning;
			expect(copies.cancel(owner)).toBe(false);
			const drain = copies.pauseAndDrain();
			let settled = false;
			void drain.settled.then(() => {
				settled = true;
			});
			await Promise.resolve();
			expect(settled).toBe(false);
			release();
			expect((await pending).success).toBe(true);
			await drain.settled;
			expect((await fs.readdir(directory)).sort()).toEqual(
				[path.basename(original), path.basename(destination)].sort(),
			);
			drain.resume();
		} finally {
			release();
			spy.mockRestore();
		}
	});
	it("freezes admission and waits for the pending picker; balanced resume permits work after quit veto", async () => {
		let entered!: () => void, release!: (value: string | null) => void;
		const opening = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const picking = new Promise<string | null>((resolve) => {
			release = resolve;
		});
		pick.mockImplementation(() => {
			entered();
			return picking;
		});
		const pending = copies.copy(owner, original);
		await opening;
		const first = copies.pauseAndDrain(),
			second = copies.pauseAndDrain();
		let settled = false;
		void first.settled.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		release(destination);
		expect(await pending).toEqual({ success: false, canceled: true });
		await Promise.all([first.settled, second.settled]);
		expect(await fs.readdir(directory)).toEqual([path.basename(original)]);
		first.resume();
		first.resume();
		expect((await copies.copy(owner, original)).success).toBe(false);
		second.resume();
		pick.mockResolvedValue(destination);
		expect((await copies.copy(owner, original)).success).toBe(true);
	});
	it.each([
		"mp4",
		"webm",
	])("copies %s bytes exactly without changing the original or session", async (extension) => {
		if (extension === "webm") {
			const previous = original;
			original = path.join(directory, "original.webm");
			await fs.rename(previous, original);
			destination = path.join(directory, "copy.webm");
			current = { key: "webm-1", path: original };
		}
		const before = await hash(original),
			source = current;
		expect(await copies.copy(owner, original)).toEqual({ success: true, path: destination });
		expect(await hash(destination)).toBe(before);
		expect(await hash(original)).toBe(before);
		expect(current).toBe(source);
		expect(copies.isBusy()).toBe(false);
		expect(owner.listenerCount("destroyed")).toBe(0);
		expect((await fs.readdir(directory)).filter((name) => name.startsWith(".openscreen"))).toEqual(
			[],
		);
	});
	it("does not allocate files when the native picker is canceled", async () => {
		pick.mockResolvedValue(null);
		expect(await copies.copy(owner, original)).toEqual({ success: false, canceled: true });
		expect(await fs.readdir(directory)).toEqual([path.basename(original)]);
	});
	it("refuses a different owner, stale expected path or active recording before opening a dialog", async () => {
		expect((await copies.copy(new Owner(), original)).success).toBe(false);
		expect((await copies.copy(owner, destination)).success).toBe(false);
		busy = true;
		expect((await copies.copy(owner, original)).success).toBe(false);
		expect(pick).not.toHaveBeenCalled();
	});
	it("refuses source/session replacement while the dialog is open", async () => {
		pick.mockImplementation(async () => {
			current = { key: "replacement", path: original };
			return destination;
		});
		expect((await copies.copy(owner, original)).success).toBe(false);
		await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
	});
	it("rejects original byte changes made during the dialog and removes only its staging file", async () => {
		pick.mockImplementation(async () => {
			await fs.writeFile(original, "external replacement");
			return destination;
		});
		expect((await copies.copy(owner, original)).success).toBe(false);
		expect(await fs.readFile(original, "utf8")).toBe("external replacement");
		expect(await fs.readdir(directory)).toEqual([path.basename(original)]);
	});
	it("preserves an existing destination and reports a useful collision code", async () => {
		await fs.writeFile(destination, "existing file");
		expect(await copies.copy(owner, original)).toMatchObject({
			success: false,
			errorCode: "exists",
		});
		expect(await fs.readFile(destination, "utf8")).toBe("existing file");
	});
	it("cancels for the right owner, rejects duplicate jobs and awaits the pending picker", async () => {
		let finish!: (file: string) => void;
		pick.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const task = copies.copy(owner, original);
		await vi.waitFor(() => expect(pick).toHaveBeenCalledOnce());
		expect(copies.isBusy()).toBe(true);
		expect(copies.cancel(new Owner())).toBe(false);
		expect((await copies.copy(owner, original)).success).toBe(false);
		expect(copies.cancel(owner)).toBe(true);
		finish(destination);
		expect(await task).toEqual({ success: false, canceled: true });
		expect(copies.isBusy()).toBe(false);
		expect(copies.cancel(owner)).toBe(false);
		await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
	});
	it("cancels when the owning window closes during destination selection", async () => {
		pick.mockImplementation(async () => {
			owner.close();
			return destination;
		});
		expect(await copies.copy(owner, original)).toEqual({ success: false, canceled: true });
		expect(copies.isBusy()).toBe(false);
		expect(owner.listenerCount("destroyed")).toBe(0);
	});
});
