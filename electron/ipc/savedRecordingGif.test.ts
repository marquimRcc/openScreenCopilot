import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositorViewService } from "../native-bridge/services/compositorViewService";
import { isRecordingResultOwner, registerSavedRecordingGifHandlers } from "./savedRecordingGif";

const mocks = vi.hoisted(() => ({ probe: vi.fn(), resolve: vi.fn(), validate: vi.fn() }));
vi.mock("../mcp/hidden-video", () => ({ openVideoInHiddenWindow: mocks.probe }));
vi.mock("../media/audioPeaks", () => ({ resolveFfmpeg: mocks.resolve }));
vi.mock("../recording/validateSavedGif", () => ({ validateSavedGif: mocks.validate }));
class Owner extends EventEmitter {
	readonly mainFrame = {};
	id = 8;
	closed = false;
	url = "file:///app/index.html?windowType=recording-result";
	isDestroyed() {
		return this.closed;
	}
	getURL() {
		return this.url;
	}
	send = vi.fn();
	close() {
		this.closed = true;
		this.emit("destroyed");
	}
}
let dir: string, original: string, destination: string, owner: Owner;
let window: BrowserWindow | null, source: { key: string; path: string } | null, busy: boolean;
let handlers: Map<string, Parameters<IpcMain["handle"]>[1]>;
let gifs: ReturnType<typeof registerSavedRecordingGifHandlers>;
let pick: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
let close: ReturnType<typeof vi.fn>,
	start: ReturnType<typeof vi.fn<CompositorViewService["startGifExport"]>>;
const options = { mode: "original", startSec: 1, endSec: 3, fps: 15, maxHeight: 480, loop: true };
const invoke = (name: string, sender: Owner = owner, ...args: unknown[]) =>
	handlers.get(name)?.(
		{ sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent,
		...args,
	);
beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "openscreen-gif-ipc-"));
	original = path.join(dir, "synthetic.mp4");
	destination = path.join(dir, "output.gif");
	await fs.writeFile(original, "SYNTHETIC original, not a codec fixture");
	owner = new Owner();
	source = { key: "session", path: original };
	busy = false;
	window = { isDestroyed: () => false, webContents: owner } as unknown as BrowserWindow;
	handlers = new Map();
	close = vi.fn();
	mocks.probe.mockReset().mockResolvedValue({ durationSec: 5, width: 960, height: 600, close });
	mocks.resolve.mockReset().mockReturnValue("main-resolved-shared-ffmpeg");
	mocks.validate.mockReset().mockResolvedValue(undefined);
	pick = vi.fn(async () => destination);
	start = vi.fn<CompositorViewService["startGifExport"]>(
		(_clips, staged, _scene, _params, progress) => {
			if (!staged) throw new Error("Missing private staged path");
			return {
				result: fs.writeFile(staged, "SYNTHETIC derived, not real GIF").then(() => {
					progress?.(30);
					return { frames: 30, wallS: 0.1, fps: 300, videoDurationS: 2, fileBytes: 30 };
				}),
				cancel: () => true,
			};
		},
	);
	const ipc = {
		handle: vi.fn<IpcMain["handle"]>((name, handler) => {
			handlers.set(name, handler);
		}),
	};
	gifs = registerSavedRecordingGifHandlers({
		ipc,
		window: () => window,
		current: () => source,
		isBusy: () => busy,
		compositor: { startGifExport: start },
		pick,
	});
});
afterEach(async () => {
	vi.unstubAllEnvs();
	owner.close();
	if (
		path.dirname(dir) !== (await fs.realpath(os.tmpdir())) ||
		!path.basename(dir).startsWith("openscreen-gif-ipc-")
	)
		throw new Error("Unexpected fixture directory");
	await fs.rm(dir, { recursive: true, force: true });
});
describe("GIF IPC wiring (synthetic writer/decoder, real controller)", () => {
	it("rejects subframe export/cancel even in the current WebContents", async () => {
		const event = { sender: owner, senderFrame: {} } as unknown as IpcMainInvokeEvent;
		expect(
			await handlers.get("export-saved-recording-gif")?.(event, original, options),
		).toMatchObject({ success: false });
		expect(await handlers.get("cancel-saved-recording-gif")?.(event)).toEqual({ accepted: false });
		expect(pick).not.toHaveBeenCalled();
	});
	it("allows only the configured dev origin, not an unrelated site", () => {
		vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
		owner.url = "http://localhost:5173/?windowType=recording-result";
		expect(isRecordingResultOwner(window, owner)).toBe(true);
		owner.url = "http://localhost:9999/?windowType=recording-result";
		expect(isRecordingResultOwner(window, owner)).toBe(false);
	});
	it("binds source/destination to main and only sends job-tagged progress to its owner", async () => {
		expect(await invoke("export-saved-recording-gif", owner, original, options)).toMatchObject({
			success: true,
			path: destination,
		});
		expect(close).toHaveBeenCalledOnce();
		expect(mocks.validate).toHaveBeenCalledWith(
			expect.stringContaining(".openscreencopilot-derived-"),
			expect.objectContaining({ totalFrames: 30 }),
			"main-resolved-shared-ffmpeg",
			expect.any(AbortSignal),
		);
		expect(start.mock.calls[0][1]).not.toBe(destination);
		expect(start.mock.calls[0][0][0].screenPath).toBe(original);
		expect(owner.send).toHaveBeenCalledWith(
			"saved-recording-gif-progress",
			expect.objectContaining({ jobId: expect.any(String), frames: 0, totalFrames: 30 }),
		);
		expect(owner.send).toHaveBeenCalledWith(
			"saved-recording-gif-progress",
			expect.objectContaining({ frames: 30, totalFrames: 30 }),
		);
	});
	it.each([
		"foreign",
		"editor",
		"empty-url",
		"remote-url",
		"missing",
		"destroyed",
		"unapproved",
		"busy",
	])("refuses %s before probe/dialog", async (kind) => {
		let sender = owner;
		if (kind === "foreign") sender = new Owner();
		if (kind === "editor") owner.url = "file:///app?windowType=editor";
		if (kind === "empty-url") owner.url = "";
		if (kind === "remote-url") {
			vi.stubEnv("VITE_DEV_SERVER_URL", undefined);
			owner.url = "https://example.invalid/?windowType=recording-result";
		}
		if (kind === "missing") window = null;
		if (kind === "destroyed") owner.close();
		if (kind === "unapproved") source = null;
		if (kind === "busy") busy = true;
		expect(await invoke("export-saved-recording-gif", sender, original, options)).toMatchObject({
			success: false,
		});
		expect(mocks.probe).not.toHaveBeenCalled();
		expect(pick).not.toHaveBeenCalled();
	});
	it("never accepts renderer destination/scene fields", async () => {
		expect(
			await invoke("export-saved-recording-gif", owner, original, {
				...options,
				outPath: original,
				sceneJson: "{}",
			}),
		).toMatchObject({ success: false });
		expect(pick).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledOnce();
	});
	it("closes probe on owner cancellation and never opens the dialog", async () => {
		mocks.probe.mockImplementation(async () => {
			owner.close();
			return { durationSec: 5, width: 960, height: 600, close };
		});
		expect(await invoke("export-saved-recording-gif", owner, original, options)).toMatchObject({
			success: false,
			canceled: true,
		});
		expect(close).toHaveBeenCalledOnce();
		expect(pick).not.toHaveBeenCalled();
	});
	it("fails explicitly if the packaged decoder is unavailable", async () => {
		mocks.resolve.mockReturnValue(null);
		expect(await invoke("export-saved-recording-gif", owner, original, options)).toMatchObject({
			success: false,
			error: expect.stringContaining("decoder"),
		});
		await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
		expect(gifs.isBusy()).toBe(false);
	});
	it("does not expose cancellation to a foreign owner", async () => {
		expect(await invoke("cancel-saved-recording-gif", new Owner())).toEqual({ accepted: false });
		expect(isRecordingResultOwner(window, owner)).toBe(true);
	});
});
