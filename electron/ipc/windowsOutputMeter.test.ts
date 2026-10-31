import { EventEmitter } from "node:events";
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	WindowsOutputMeter,
	WindowsOutputMeterEnd,
	WindowsOutputMeterLease,
} from "../recording/windowsOutputMeter";
import { registerWindowsOutputMeterHandlers } from "./windowsOutputMeter";

class Owner extends EventEmitter {
	mainFrame = {};
	dead = false;
	url = "file:///app/index.html?windowType=hud-overlay";
	send = vi.fn<(channel: string, message: unknown) => void>();
	isDestroyed() {
		return this.dead;
	}
	getURL() {
		return this.url;
	}
}
type Request = Parameters<WindowsOutputMeter["start"]>[0];
type Handler = Parameters<IpcMain["handle"]>[1];
let owner: Owner, window: BrowserWindow | null;
let supported: boolean, allowed: boolean, busy: boolean;
let prefs: { systemAudioEnabled: boolean; windowsSystemAudioDeviceId: string | null };
let handlers: Map<string, Handler>;
let request: Request, finish: (end: WindowsOutputMeterEnd) => void;
let start: ReturnType<typeof vi.fn<(req: Request) => WindowsOutputMeterLease>>;
let cancel: ReturnType<typeof vi.fn<() => Promise<WindowsOutputMeterEnd>>>;
const id = "5f6ce990-1290-4de1-8e3c-b57a970e5e69";
const event = () =>
	({ sender: owner, senderFrame: owner.mainFrame }) as unknown as IpcMainInvokeEvent;
const invoke = (channel: "start" | "stop", ...args: unknown[]) =>
	handlers.get(`${channel}-windows-output-meter`)!(event(), ...args);
beforeEach(() => {
	owner = new Owner();
	window = { isDestroyed: () => false, webContents: owner } as unknown as BrowserWindow;
	supported = allowed = true;
	busy = false;
	prefs = { systemAudioEnabled: true, windowsSystemAudioDeviceId: "main-output" };
	handlers = new Map();
	const done = new Promise<WindowsOutputMeterEnd>((resolve) => {
		finish = resolve;
	});
	cancel = vi.fn(() => done);
	start = vi.fn((req) => {
		request = req;
		return { id, ready: Promise.resolve(null), done, cancel };
	});
	registerWindowsOutputMeterHandlers({
		ipc: {
			handle: (name, handler) => {
				handlers.set(name, handler);
			},
		},
		window: () => window,
		isSupported: () => supported,
		canPreview: () => allowed,
		prefs: () => prefs,
		meter: { start, isBusy: () => busy },
	});
});
afterEach(() => vi.unstubAllEnvs());
describe("main-owned Windows output meter IPC", () => {
	it.each([
		"hud-overlay",
		"editor",
	])("starts intent-only in current local %s with main choice", (role) => {
		owner.url = `file:///app/index.html?windowType=${role}`;
		expect(invoke("start")).toEqual({ success: true, meterId: id });
		expect(request.choice).toBe("main-output");
		expect(request.owner).toBe(owner);
		expect(request.isCurrent()).toBe(true);
		expect(owner.send).toHaveBeenCalledWith("windows-output-meter-event", {
			event: "starting",
			meterId: id,
		});
	});
	it("default is a null snapshot, not a renderer ID or helper path", () => {
		prefs.windowsSystemAudioDeviceId = null;
		expect(invoke("start", { id: "foreign", helper: "evil.exe" })).toMatchObject({
			errorCode: "invalid-request",
		});
		expect(start).not.toHaveBeenCalled();
		expect(invoke("start")).toMatchObject({ success: true });
		expect(request.choice).toBeNull();
	});
	it.each([
		"https://foreign.test/?windowType=editor",
		"file:///app?windowType=recording-result",
		"file:///app?windowType=source-selector",
		"file:///app",
	])("rejects foreign URL or role %s before start", (url) => {
		owner.url = url;
		expect(invoke("start")).toMatchObject({ errorCode: "invalid-owner" });
		expect(start).not.toHaveBeenCalled();
	});
	it("rejects foreign window/frame and closed or absent owner", () => {
		const handler = handlers.get("start-windows-output-meter")!;
		expect(handler({ ...event(), senderFrame: {} } as IpcMainInvokeEvent)).toMatchObject({
			errorCode: "invalid-owner",
		});
		expect(
			handler({ ...event(), sender: new Owner() } as unknown as IpcMainInvokeEvent),
		).toMatchObject({ errorCode: "invalid-owner" });
		owner.dead = true;
		expect(invoke("start")).toMatchObject({ errorCode: "invalid-owner" });
		window = null;
		expect(invoke("start")).toMatchObject({ errorCode: "invalid-owner" });
		expect(start).not.toHaveBeenCalled();
	});
	it("accepts only configured dev origin", () => {
		vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
		owner.url = "http://localhost:5174/?windowType=editor";
		expect(invoke("start")).toMatchObject({ errorCode: "invalid-owner" });
		owner.url = "http://localhost:5173/?windowType=editor";
		expect(invoke("start")).toMatchObject({ success: true });
	});
	it("rejects unsupported, disabled, capture/quit busy and active controller", () => {
		supported = false;
		expect(invoke("start")).toMatchObject({ errorCode: "unsupported-platform" });
		supported = true;
		prefs.systemAudioEnabled = false;
		expect(invoke("start")).toMatchObject({ errorCode: "disabled" });
		prefs.systemAudioEnabled = true;
		allowed = false;
		expect(invoke("start")).toMatchObject({ errorCode: "busy" });
		allowed = true;
		busy = true;
		expect(invoke("start")).toMatchObject({ errorCode: "busy" });
		expect(start).not.toHaveBeenCalled();
	});
	it("rechecks main preference, capture state, frame, role and window", () => {
		invoke("start");
		prefs.windowsSystemAudioDeviceId = "changed";
		expect(request.isCurrent()).toBe(false);
		prefs.windowsSystemAudioDeviceId = "main-output";
		prefs.systemAudioEnabled = false;
		expect(request.isCurrent()).toBe(false);
		prefs.systemAudioEnabled = true;
		allowed = false;
		expect(request.isCurrent()).toBe(false);
		allowed = true;
		owner.url = "file:///app?windowType=recording-result";
		expect(request.isCurrent()).toBe(false);
		owner.url = "file:///app?windowType=editor";
		window = null;
		expect(request.isCurrent()).toBe(false);
	});
	it("sends scalar events with main UUID, terminal only after controller close", async () => {
		invoke("start");
		request.onEvent({ event: "ready", id: "main-output", hardwareMeter: true });
		request.onEvent({ event: "level", sequence: 4, peakPermille: 450 });
		expect(owner.send).toHaveBeenLastCalledWith("windows-output-meter-event", {
			event: "level",
			sequence: 4,
			peakPermille: 450,
			meterId: id,
		});
		let stopped = false;
		const stop = Promise.resolve(invoke("stop", id)).then((result) => {
			stopped = true;
			return result;
		});
		await Promise.resolve();
		expect(stopped).toBe(false);
		expect(invoke("start")).toMatchObject({ errorCode: "busy" });
		finish({ status: "cancelled" });
		expect(await stop).toEqual({ success: true, result: { status: "cancelled" } });
		expect(owner.send).toHaveBeenLastCalledWith("windows-output-meter-event", {
			event: "ended",
			meterId: id,
			result: { status: "cancelled" },
		});
		expect(owner.listenerCount("did-start-navigation")).toBe(0);
	});
	it("stop requires matching token and owner; no foreign cancellation", async () => {
		invoke("start");
		expect(await invoke("stop", "wrong")).toMatchObject({ errorCode: "not-current" });
		expect(await invoke("stop", { meterId: id })).toMatchObject({ errorCode: "invalid-request" });
		expect(await invoke("stop", id, "extra")).toMatchObject({ errorCode: "invalid-request" });
		const foreign = new Owner();
		expect(
			await handlers.get("stop-windows-output-meter")!(
				{ sender: foreign, senderFrame: foreign.mainFrame } as unknown as IpcMainInvokeEvent,
				id,
			),
		).toMatchObject({ errorCode: "invalid-owner" });
		expect(cancel).not.toHaveBeenCalled();
	});
	it("navigation invalidates even same-URL reload and cancels pending startup", async () => {
		invoke("start");
		owner.emit("did-start-navigation", { isMainFrame: false });
		expect(cancel).not.toHaveBeenCalled();
		owner.emit("did-start-navigation", { isMainFrame: true });
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(request.isCurrent()).toBe(false);
		owner.send.mockClear();
		request.onEvent({ event: "level", sequence: 0, peakPermille: 100 });
		finish({ status: "cancelled" });
		await Promise.resolve();
		expect(owner.send).not.toHaveBeenCalled();
		expect(owner.listenerCount("did-start-navigation")).toBe(0);
	});
	it("closed owner receives no late events", async () => {
		invoke("start");
		owner.dead = true;
		owner.send.mockClear();
		request.onEvent({ event: "ready", id: "main-output", hardwareMeter: false });
		finish({ status: "cancelled" });
		await Promise.resolve();
		expect(owner.send).not.toHaveBeenCalled();
	});
	it("startup throw returns fixed error and releases registry, no diagnostics", () => {
		start.mockImplementationOnce(() => {
			throw new Error("PRIVATE helper path");
		});
		expect(invoke("start")).toEqual({ success: false, errorCode: "start-failed" });
		expect(owner.listenerCount("did-start-navigation")).toBe(0);
		expect(invoke("start")).toMatchObject({ success: true });
	});
	it("send failure cancels but keeps ownership until drain", async () => {
		owner.send.mockImplementationOnce(() => {
			throw new Error("delivery failed");
		});
		expect(invoke("start")).toMatchObject({ errorCode: "start-failed" });
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(invoke("start")).toMatchObject({ errorCode: "busy" });
		finish({ status: "cancelled" });
		await Promise.resolve();
		expect(owner.listenerCount("did-start-navigation")).toBe(0);
	});
});
