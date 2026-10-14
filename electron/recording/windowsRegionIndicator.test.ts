import { describe, expect, it, vi } from "vitest";
import { regionIndicatorBounds, WindowsRegionIndicator } from "./windowsRegionIndicator";

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
	it("does not destroy an already closed window", () => {
		const window = { isDestroyed: () => true, destroy: vi.fn() };
		const indicator = new WindowsRegionIndicator(() => window);
		indicator.show({}, selection);
		indicator.clear();
		expect(window.destroy).not.toHaveBeenCalled();
	});
});
