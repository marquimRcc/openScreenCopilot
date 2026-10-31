import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planSavedRecordingGif } from "../../src/lib/savedRecordingGif";
import { validateSavedGif } from "./validateSavedGif";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
class Decoder extends EventEmitter {
	stdout = new PassThrough();
	stderr = new PassThrough();
	kill = vi.fn(() => true);
}
const plan = planSavedRecordingGif(
	{ mode: "original", startSec: 0, endSec: 2, fps: 15, maxHeight: 480, loop: true },
	{ width: 960, height: 600, durationSec: 5 },
);
let dir: string, file: string, child: Decoder, abort: AbortController;
let started: Promise<void>, notify: () => void;
beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "openscreen-gif-decode-test-"));
	file = path.join(dir, "synthetic header.gif");
	const header = Buffer.alloc(13);
	header.write("GIF89a");
	header.writeUInt16LE(plan.width, 6);
	header.writeUInt16LE(plan.height, 8);
	// NOT a real GIF. Decoder protocol tests use a fake child; native QA uses real files.
	await fs.writeFile(file, header);
	child = new Decoder();
	abort = new AbortController();
	started = new Promise<void>((done) => {
		notify = done;
	});
	mocks.spawn.mockReset();
	mocks.spawn.mockImplementation(() => {
		notify();
		return child;
	});
});
afterEach(async () => {
	vi.useRealTimers();
	if (
		path.dirname(dir) !== (await fs.realpath(os.tmpdir())) ||
		!path.basename(dir).startsWith("openscreen-gif-decode-test-")
	)
		throw new Error("Unexpected fixture path");
	await fs.rm(dir, { recursive: true, force: true });
});
describe("main GIF header and full-decode validation protocol", () => {
	it("uses decode-only fixed arguments, ignores looping and verifies final frames/time", async () => {
		const result = validateSavedGif(file, plan, "main-resolved-ffmpeg", abort.signal);
		await started;
		child.stdout.write("frame=3\nout_time_us=200000\nprogress=continue\nfra");
		child.stdout.write("me=30\nout_time_us=2000000\nprogress=end\n");
		child.emit("close", 0);
		await expect(result).resolves.toBeUndefined();
		expect(mocks.spawn).toHaveBeenCalledWith(
			"main-resolved-ffmpeg",
			expect.arrayContaining(["-ignore_loop", "1", "-fps_mode", "passthrough", "null", file]),
			expect.objectContaining({ windowsHide: true, signal: abort.signal }),
		);
		expect(child.kill).not.toHaveBeenCalled();
	});
	it.each([
		"not-gif",
		"wrong-size",
		"truncated",
	])("rejects %s header before launching decoder", async (kind) => {
		if (kind === "truncated") await fs.writeFile(file, "GIF89a");
		else {
			const header = await fs.readFile(file);
			if (kind === "not-gif") header.write("notgif");
			else header.writeUInt16LE(42, 6);
			await fs.writeFile(file, header);
		}
		await expect(validateSavedGif(file, plan, "ffmpeg", abort.signal)).rejects.toThrow("header");
		expect(mocks.spawn).not.toHaveBeenCalled();
	});
	it.each([
		"frame=29\nout_time_us=2000000\nprogress=end\n",
		"frame=30\nout_time_us=1000000\nprogress=end\n",
		"frame=30\nout_time_us=NaN\nprogress=end\n",
		"frame=30\nout_time_us=2000000\nprogress=continue\n",
	])("rejects incomplete/mismatched decoder output %j", async (progress) => {
		const result = validateSavedGif(file, plan, "ffmpeg", abort.signal);
		await started;
		child.stdout.write(progress);
		child.emit("close", 0);
		await expect(result).rejects.toThrow("frame count or duration");
	});
	it.each(["stderr", "exit", "error"])("waits for close on decoder %s failure", async (kind) => {
		const result = validateSavedGif(file, plan, "ffmpeg", abort.signal);
		await started;
		if (kind === "stderr") child.stderr.write("decode error");
		if (kind === "error") child.emit("error", new Error("spawn failure"));
		child.emit("close", kind === "exit" ? 1 : 0);
		await expect(result).rejects.toThrow(/decode|spawn/);
	});
	it("does not settle an abort before decoder close", async () => {
		let settled = false;
		const result = validateSavedGif(file, plan, "ffmpeg", abort.signal).finally(() => {
			settled = true;
		});
		await started;
		abort.abort();
		child.emit("error", new Error("aborted"));
		await Promise.resolve();
		expect(settled).toBe(false);
		child.emit("close", null);
		await expect(result).rejects.toMatchObject({ name: "AbortError" });
	});
	it("bounds validation time but still waits for decoder close before cleanup", async () => {
		vi.useFakeTimers();
		let settled = false;
		const result = validateSavedGif(file, plan, "ffmpeg", abort.signal, 10).finally(() => {
			settled = true;
		});
		await started;
		vi.advanceTimersByTime(10);
		expect(child.kill).toHaveBeenCalledOnce();
		expect(settled).toBe(false);
		child.emit("close", null);
		await expect(result).rejects.toThrow("timed out");
	});
	it("rejects pre-aborted signals without opening a decoder", async () => {
		abort.abort();
		await expect(validateSavedGif(file, plan, "ffmpeg", abort.signal)).rejects.toMatchObject({
			name: "AbortError",
		});
		expect(mocks.spawn).not.toHaveBeenCalled();
	});
	it("bounds decoder output without accepting a false success", async () => {
		const result = validateSavedGif(file, plan, "ffmpeg", abort.signal);
		await started;
		child.stdout.write("x".repeat(40000));
		expect(child.kill).toHaveBeenCalledOnce();
		child.emit("close", 0);
		await expect(result).rejects.toThrow("exceeded");
	});
});
