import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
	class FakeWindow {
		constructor(readonly options: Record<string, unknown>) {}
		webContents = {
			on: vi.fn(),
			send: vi.fn(),
			executeJavaScript: vi.fn().mockResolvedValue(undefined),
		};
		setMenu = vi.fn();
		setBounds = vi.fn();
		setIgnoreMouseEvents = vi.fn();
		setAlwaysOnTop = vi.fn();
		showInactive = vi.fn();
		isDestroyed = () => false;
		destroy = vi.fn();
		setContentProtection = vi.fn();
		setAutoHideMenuBar = vi.fn();
		setVisibleOnAllWorkspaces = vi.fn();
		once = vi.fn();
		on = vi.fn();
		loadURL = vi.fn().mockResolvedValue(undefined);
		loadFile = vi.fn();
	}
	return { FakeWindow };
});

vi.mock("electron", () => ({
	app: { getLocale: () => "en-US" },
	BrowserWindow: electron.FakeWindow,
	ipcMain: { on: vi.fn() },
	screen: {
		getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
		on: vi.fn(),
	},
}));

const REAL_PLATFORM = process.platform;

/** windows.ts reads the platform, the OS version (Electron-only API) and the env at import. */
async function load(platform: NodeJS.Platform, systemVersion: string) {
	Object.defineProperty(process, "platform", { value: platform, configurable: true });
	Object.defineProperty(process, "getSystemVersion", {
		value: () => systemVersion,
		configurable: true,
	});
	vi.resetModules();
	return import("./windows");
}

async function hudProtected(platform: NodeJS.Platform, systemVersion: string) {
	const { createHudOverlayWindow } = await load(platform, systemVersion);
	const win = createHudOverlayWindow() as unknown as InstanceType<typeof electron.FakeWindow>;
	return win.setContentProtection.mock.calls.some(([enable]) => enable === true);
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.stubEnv("OPENSCREEN_DISABLE_CONTENT_PROTECTION", "");
	vi.stubEnv("OPENSCREEN_FORCE_CONTENT_PROTECTION", "");
	warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

afterAll(() => {
	Object.defineProperty(process, "platform", { value: REAL_PLATFORM, configurable: true });
	Reflect.deleteProperty(process, "getSystemVersion");
});

describe("HUD content protection on Windows (#1105)", () => {
	it("always excludes the click-through region border, even with the HUD QA override", async () => {
		vi.stubEnv("OPENSCREEN_DISABLE_CONTENT_PROTECTION", "1");
		const { createRegionIndicatorWindow } = await load("win32", "10.0.26100");
		const bounds = { x: 100, y: 150, width: 640, height: 400 };
		const win = createRegionIndicatorWindow(bounds) as unknown as InstanceType<
			typeof electron.FakeWindow
		>;
		expect(win.setContentProtection).toHaveBeenCalledWith(true);
		expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
		expect(win.options).toMatchObject({
			focusable: false,
			show: false,
			skipTaskbar: true,
			webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true },
		});
		expect(win.setBounds).toHaveBeenCalledWith(bounds);
		expect(win.loadURL).toHaveBeenCalledWith(expect.stringContaining("data:text/html"));
		expect(decodeURIComponent(win.loadURL.mock.calls[0][0])).toContain("PAUSED");
		const loaded = win.webContents.on.mock.calls.find(([name]) => name === "did-finish-load")?.[1];
		loaded();
		(win as unknown as { setPausedVisual(paused: boolean): void }).setPausedVisual(true);
		expect(win.webContents.executeJavaScript.mock.calls).toEqual([
			['document.body.dataset.paused = "false"'],
			['document.body.dataset.paused = "true"'],
		]);
		const ready = win.once.mock.calls.find(([name]) => name === "ready-to-show")?.[1];
		ready();
		expect(win.showInactive).toHaveBeenCalledOnce();
	});
	it.each([
		["10 22H2", "10.0.19045"],
		["11 21H2", "10.0.22000"],
	])("is skipped on Windows %s, where it leaves the HUD unclickable", async (_name, version) => {
		expect(await hudProtected("win32", version)).toBe(false);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("OFF for the HUD window"));
	});

	it.each([
		["11 22H2", "10.0.22621"],
		["11 24H2", "10.0.26100"],
	])("is applied on Windows %s", async (_name, version) => {
		expect(await hudProtected("win32", version)).toBe(true);
	});

	it("is applied on Windows 10 with OPENSCREEN_FORCE_CONTENT_PROTECTION=1", async () => {
		vi.stubEnv("OPENSCREEN_FORCE_CONTENT_PROTECTION", "1");
		expect(await hudProtected("win32", "10.0.19045")).toBe(true);
	});

	it("is still lifted by OPENSCREEN_DISABLE_CONTENT_PROTECTION=1 on Windows 11 22H2", async () => {
		vi.stubEnv("OPENSCREEN_DISABLE_CONTENT_PROTECTION", "1");
		expect(await hudProtected("win32", "10.0.22621")).toBe(false);
	});

	it("still protects the Notes window on Windows 10", async () => {
		const { createNotesWindow } = await load("win32", "10.0.19045");
		const win = createNotesWindow() as unknown as InstanceType<typeof electron.FakeWindow>;
		expect(win.setContentProtection).toHaveBeenCalledWith(true);
	});
});

describe("HUD content protection on macOS", () => {
	it("is applied before macOS 26", async () => {
		expect(await hudProtected("darwin", "15.5.0")).toBe(true);
	});

	it("is skipped on macOS 26", async () => {
		expect(await hudProtected("darwin", "26.5.0")).toBe(false);
	});
});
