import { describe, expect, it, vi } from "vitest";
import {
	regionIndicatorBounds,
	WindowsRegionIndicator,
	windowsCaptureIndicatorBounds,
} from "./windowsRegionIndicator";

const selection = {
	sourceId: "screen:1:0",
	boundsDip: { x: -1280, y: 0, width: 1280, height: 800 },
	boundsPx: { x: -1920, y: 0, width: 1920, height: 1200 },
	region: {
		displayId: 1,
		sourceWidthPx: 1920,
		sourceHeightPx: 1200,
		regionPx: { x: 150, y: 225, width: 960, height: 600 },
	},
};

describe("Windows region indicator", () => {
	it("selects the effective region, full display, or no static border by source", () => {
		const displayBounds = { x: -1280, y: 0, width: 1280, height: 800 };
		expect(windowsCaptureIndicatorBounds("display", displayBounds, selection, true)).toEqual({
			x: -1180,
			y: 150,
			width: 640,
			height: 400,
		});
		expect(windowsCaptureIndicatorBounds("display", displayBounds, null, false)).toBe(
			displayBounds,
		);
		expect(windowsCaptureIndicatorBounds("display", displayBounds, null, true)).toBeNull();
		expect(windowsCaptureIndicatorBounds("window", displayBounds, selection, false)).toBeNull();
	});
	it("maps actual physical crop locally on a negative-origin 150% display", () => {
		expect(regionIndicatorBounds(selection)).toEqual({
			x: -1180,
			y: 150,
			width: 640,
			height: 400,
		});
	});
	it("rounds both edges instead of scaling desktop origin or inventing crop size", () => {
		expect(
			regionIndicatorBounds({
				...selection,
				region: {
					...selection.region,
					regionPx: { x: 152, y: 227, width: 958, height: 598 },
				},
			}),
		).toEqual({ x: -1179, y: 151, width: 639, height: 399 });
	});
	it("replaces windows and ignores exit/stop from an older helper", () => {
		const windows = [0, 1].map(() => ({ isDestroyed: () => false, destroy: vi.fn() }));
		const create = vi.fn().mockReturnValueOnce(windows[0]).mockReturnValueOnce(windows[1]);
		const indicator = new WindowsRegionIndicator(create);
		const first = {},
			second = {};
		indicator.show(first, selection);
		indicator.show(second, selection);
		expect(windows[0].destroy).toHaveBeenCalledOnce();
		indicator.clear(first);
		expect(windows[1].destroy).not.toHaveBeenCalled();
		indicator.clear(second);
		indicator.clear(second);
		expect(windows[1].destroy).toHaveBeenCalledOnce();
	});
	it("can outline a trusted full-display DIP rectangle without crop conversion", () => {
		const window = { isDestroyed: () => false, destroy: vi.fn() };
		const create = vi.fn(() => window);
		const indicator = new WindowsRegionIndicator(create);
		const bounds = { x: -1280, y: 0, width: 1280, height: 800 };

		indicator.showBounds({}, bounds);

		expect(create).toHaveBeenCalledWith(bounds);
	});
	it("dims only the current owner's border while paused and restores it on resume", () => {
		const window = { isDestroyed: () => false, destroy: vi.fn(), setOpacity: vi.fn() };
		const indicator = new WindowsRegionIndicator(() => window);
		const owner = {};
		indicator.show(owner, selection);

		indicator.setPaused({}, true);
		indicator.setPaused(owner, true);
		indicator.setPaused(owner, false);

		expect(window.setOpacity.mock.calls).toEqual([[0.45], [1]]);
	});
	it("does not destroy an already closed window", () => {
		const window = { isDestroyed: () => true, destroy: vi.fn() };
		const indicator = new WindowsRegionIndicator(() => window);
		indicator.show({}, selection);
		indicator.clear();
		expect(window.destroy).not.toHaveBeenCalled();
	});
});
