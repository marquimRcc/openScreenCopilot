import { describe, expect, it } from "vitest";
import { rectangleFromDrag, resolveWindowsCaptureRegion } from "./windowsCaptureRegion";

const display = {
	id: 7,
	boundsDip: { x: -1536, y: -100, width: 1536, height: 864 },
	widthPx: 1920,
	heightPx: 1080,
};

describe("Windows monitor region contract", () => {
	it.each([
		[
			{ x: 10, y: 20 },
			{ x: 110, y: 100 },
			{ x: 10, y: 20, width: 100, height: 80 },
		],
		[
			{ x: 110, y: 100 },
			{ x: 10, y: 20 },
			{ x: 10, y: 20, width: 100, height: 80 },
		],
		[
			{ x: 10, y: 100 },
			{ x: 110, y: 20 },
			{ x: 10, y: 20, width: 100, height: 80 },
		],
		[
			{ x: 110, y: 20 },
			{ x: 10, y: 100 },
			{ x: 10, y: 20, width: 100, height: 80 },
		],
		[
			{ x: -1, y: -2 },
			{ x: 3000, y: 2000 },
			{ x: 0, y: 0, width: 1920, height: 1080 },
		],
	])("normalizes local drag coordinates without crossing the monitor", (start, end, expected) => {
		expect(rectangleFromDrag(start, end, { width: 1920, height: 1080 })).toEqual(expected);
	});
	it("uses a monitor-local origin with 125% DPI and negative desktop coordinates", () => {
		expect(
			resolveWindowsCaptureRegion(display, { x: -1436, y: 0, width: 320, height: 240 }),
		).toEqual({
			displayId: 7,
			sourceWidthPx: 1920,
			sourceHeightPx: 1080,
			regionPx: { x: 125, y: 125, width: 400, height: 300 },
		});
	});
	it("supports 150% DPI without scaling the desktop origin", () => {
		const scaled = { ...display, widthPx: 2304, heightPx: 1296 };
		expect(
			resolveWindowsCaptureRegion(scaled, { x: -1436, y: 0, width: 320, height: 240 })?.regionPx,
		).toEqual({ x: 150, y: 150, width: 480, height: 360 });
	});
	it("rounds fractional edges inward and makes only dimensions even", () => {
		expect(
			resolveWindowsCaptureRegion(display, { x: -1535.7, y: -99.7, width: 10, height: 10 })
				?.regionPx,
		).toEqual({ x: 1, y: 1, width: 10, height: 10 });
	});
	it("can select the complete monitor", () => {
		expect(resolveWindowsCaptureRegion(display, display.boundsDip)?.regionPx).toEqual({
			x: 0,
			y: 0,
			width: 1920,
			height: 1080,
		});
	});
	it("does not fall back to full-screen when cancelled", () => {
		expect(resolveWindowsCaptureRegion(display, null)).toBeNull();
	});
	it.each([
		{ x: -1537, y: 0, width: 10, height: 10 },
		{ x: -10, y: 0, width: 20, height: 10 },
		{ x: -100, y: 760, width: 10, height: 10 },
		{ x: -100, y: 0, width: 0, height: 10 },
		{ x: -100, y: 0, width: -10, height: 10 },
		{ x: -100, y: 0, width: 0.1, height: 10 },
		{ x: Number.NaN, y: 0, width: 10, height: 10 },
		{ x: -100, y: 0, width: Number.POSITIVE_INFINITY, height: 10 },
	])("rejects invalid or cross-monitor selection %o", (selection) => {
		expect(resolveWindowsCaptureRegion(display, selection)).toBeNull();
	});
	it.each([
		{ ...display, widthPx: 0 },
		{ ...display, widthPx: 2_147_483_648 },
		{ ...display, heightPx: 1080.5 },
		{ ...display, id: Number.NaN },
		{ ...display, boundsDip: { ...display.boundsDip, width: 0 } },
	])("rejects an invalid display snapshot %o", (snapshot) => {
		expect(resolveWindowsCaptureRegion(snapshot, display.boundsDip)).toBeNull();
	});
});
