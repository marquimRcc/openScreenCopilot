import { EventEmitter } from "node:events";
import type { BrowserWindow, Display } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	handlers: new Map<string, (...args: unknown[]) => unknown>(),
	createWindow: vi.fn(),
	displays: vi.fn(),
	physical: vi.fn(),
	exec: vi.fn(),
}));
vi.mock("electron", () => ({
	ipcMain: {
		handle: (name: string, handler: (...args: unknown[]) => unknown) =>
			mocks.handlers.set(name, handler),
	},
	screen: { getAllDisplays: mocks.displays, dipToScreenRect: mocks.physical },
}));
vi.mock("node:child_process", () => ({ execFile: mocks.exec }));
vi.mock("../windows", () => ({ createRegionSelectionWindow: mocks.createWindow }));

import {
	isWindowsRegionCurrent,
	supportsWindowsRegion,
	WindowsRegionPicker,
} from "./windowsRegionPicker";

function fakeWindow() {
	const win = Object.assign(new EventEmitter(), {
		webContents: new EventEmitter(),
		isDestroyed: () => false,
		show: vi.fn(),
		hide: vi.fn(),
		focus: vi.fn(),
		destroy: vi.fn(),
	});
	return win;
}

describe("WindowsRegionPicker ownership and geometry", () => {
	const originalPlatform = process.platform;
	beforeEach(() => {
		Object.defineProperty(process, "platform", { value: "win32", configurable: true });
		mocks.handlers.clear();
		vi.clearAllMocks();
		mocks.displays.mockReturnValue([
			{ id: 7, bounds: { x: -1536, y: 0, width: 1536, height: 864 } },
		]);
		mocks.physical.mockReturnValue({ x: -1920, y: 0, width: 1920, height: 1080 });
	});
	afterEach(() =>
		Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true }),
	);

	function setup() {
		const overlay = fakeWindow();
		const owner = fakeWindow();
		mocks.createWindow.mockReturnValue(overlay);
		const picker = new WindowsRegionPicker();
		const pending = picker.pick(
			"screen:7:0",
			mocks.displays()[0] as Display,
			owner as unknown as BrowserWindow,
		);
		return {
			pending,
			owner,
			overlay,
			finish: (rectangle: unknown, sender: unknown = overlay.webContents) =>
				mocks.handlers.get("region-selection-finish")!({ sender }, rectangle),
		};
	}
	it("only the current overlay can confirm, and main derives physical pixels", async () => {
		const test = setup();
		expect(() => test.finish({ x: 100, y: 100, width: 320, height: 240 }, {})).toThrow(
			"not active",
		);
		test.finish({ x: 100, y: 100, width: 320, height: 240 });
		const result = await test.pending;
		expect(result?.region.regionPx).toEqual({ x: 125, y: 125, width: 400, height: 300 });
		expect(result && isWindowsRegionCurrent(result)).toBe(true);
		expect(test.overlay.destroy).toHaveBeenCalledOnce();
		expect(test.owner.show).toHaveBeenCalledOnce();
	});
	it("cancel returns null and restores the picker", async () => {
		const test = setup();
		test.finish(null);
		expect(await test.pending).toBeNull();
		expect(test.owner.show).toHaveBeenCalledOnce();
	});
	it("rejects a cross-monitor rectangle without committing or closing", () => {
		const test = setup();
		expect(() => test.finish({ x: 1500, y: 10, width: 100, height: 100 })).toThrow("Invalid");
		expect(test.overlay.destroy).not.toHaveBeenCalled();
		test.finish(null);
	});
	it("display changes cancel rather than shifting or expanding capture", async () => {
		const test = setup();
		mocks.displays.mockReturnValue([]);
		expect(() => test.finish({ x: 100, y: 100, width: 320, height: 240 })).toThrow(
			"Display changed",
		);
		expect(await test.pending).toBeNull();
	});
	it("closing the source picker cancels the overlay", async () => {
		const test = setup();
		test.owner.emit("closed");
		expect(await test.pending).toBeNull();
		expect(test.overlay.destroy).toHaveBeenCalledOnce();
	});
	it.each([
		[null, '{"captureRegion":true}', true],
		[null, "{}", false],
		[null, "old helper", false],
		[new Error("timeout"), "", false],
	])("probes capabilities and refuses old, malformed, or failed helpers", async (error, stdout, expected) => {
		mocks.exec.mockImplementation((_path, _args, _options, callback) => callback(error, stdout));
		expect(await supportsWindowsRegion("helper.exe")).toBe(expected);
	});
});
