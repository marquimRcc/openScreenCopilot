import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWindowsAudioOutputHandlers } from "./windowsAudioOutputs";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../recording/windowsAudioOutputs", () => ({ listWindowsAudioOutputs: mocks.list }));
const devices = [{ id: "native-output", name: "Saída sintética", isDefault: true }];
let handler: Parameters<IpcMain["handle"]>[1];
let closed: boolean, url: string, window: BrowserWindow | null, supported: boolean;
let helper: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
const frame = {};
const owner = { mainFrame: frame, isDestroyed: () => closed, getURL: () => url };
const event = () => ({ sender: owner, senderFrame: frame }) as unknown as IpcMainInvokeEvent;
beforeEach(() => {
	closed = false;
	url = "file:///app/index.html?windowType=hud-overlay";
	supported = true;
	window = { isDestroyed: () => false, webContents: owner } as unknown as BrowserWindow;
	helper = vi.fn(async () => "main-owned-helper.exe");
	mocks.list.mockReset().mockResolvedValue(devices);
	registerWindowsAudioOutputHandlers({
		ipc: {
			handle: (_name, listener) => {
				handler = listener;
			},
		},
		window: () => window,
		isSupported: () => supported,
		helper,
	});
});
afterEach(() => vi.unstubAllEnvs());

describe("owner-scoped WASAPI enumeration IPC", () => {
	it.each([
		"hud-overlay",
		"editor",
	])("allows the current local %s main frame, without renderer arguments", async (role) => {
		url = `file:///app/index.html?windowType=${role}`;
		expect(await handler(event(), "untrusted.exe", ["arbitrary"])).toEqual({
			success: true,
			devices,
		});
		expect(helper).toHaveBeenCalledWith();
		expect(mocks.list).toHaveBeenCalledWith("main-owned-helper.exe");
	});
	it.each([
		"",
		"https://foreign.test/?windowType=editor",
		"file:///app/index.html?windowType=recording-result",
		"file:///app/index.html?windowType=source-selector",
		"file:///app/index.html",
	])("rejects invalid URL/role %s before helper lookup", async (value) => {
		url = value;
		expect(await handler(event())).toMatchObject({ success: false, errorCode: "invalid-owner" });
		expect(helper).not.toHaveBeenCalled();
	});
	it("accepts only the configured development origin", async () => {
		vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
		url = "http://localhost:5173/?windowType=editor";
		expect(await handler(event())).toEqual({ success: true, devices });
		url = "http://localhost:5174/?windowType=editor";
		expect(await handler(event())).toMatchObject({ errorCode: "invalid-owner" });
	});
	it("rejects closed/replaced windows, foreign owners and subframes", async () => {
		const original = window;
		window = null;
		expect(await handler(event())).toMatchObject({ errorCode: "invalid-owner" });
		window = original;
		closed = true;
		expect(await handler(event())).toMatchObject({ errorCode: "invalid-owner" });
		closed = false;
		expect(await handler({ ...event(), senderFrame: {} } as IpcMainInvokeEvent)).toMatchObject({
			errorCode: "invalid-owner",
		});
		expect(await handler({ ...event(), senderFrame: null } as IpcMainInvokeEvent)).toMatchObject({
			errorCode: "invalid-owner",
		});
		expect(
			await handler({ ...event(), sender: { ...owner } } as unknown as IpcMainInvokeEvent),
		).toMatchObject({ errorCode: "invalid-owner" });
		expect(helper).not.toHaveBeenCalled();
	});
	it("does not spawn on unsupported platforms or missing helper", async () => {
		supported = false;
		expect(await handler(event())).toMatchObject({ errorCode: "unsupported-platform" });
		expect(helper).not.toHaveBeenCalled();
		supported = true;
		helper.mockResolvedValue(null);
		expect(await handler(event())).toMatchObject({ errorCode: "missing-helper" });
		expect(mocks.list).not.toHaveBeenCalled();
	});
	it("limits concurrency, rechecks ownership and releases admission after failure", async () => {
		let release!: (value: typeof devices) => void;
		mocks.list.mockReturnValueOnce(
			new Promise((resolve) => {
				release = resolve;
			}),
		);
		const first = handler(event());
		await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
		expect(await handler(event())).toMatchObject({ errorCode: "busy" });
		closed = true;
		release(devices);
		expect(await first).toMatchObject({ errorCode: "invalid-owner" });
		closed = false;
		mocks.list.mockRejectedValueOnce(new Error("PRIVATE device diagnostic"));
		expect(await handler(event())).toEqual({
			success: false,
			devices: [],
			errorCode: "enumeration-failed",
		});
		expect(await handler(event())).toEqual({ success: true, devices });
	});
	it("rechecks ownership after resolving helper, before enumeration", async () => {
		helper.mockImplementation(async () => {
			window = null;
			return "helper.exe";
		});
		expect(await handler(event())).toMatchObject({ errorCode: "invalid-owner" });
		expect(mocks.list).not.toHaveBeenCalled();
	});
});
