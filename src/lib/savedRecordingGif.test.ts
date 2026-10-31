import { describe, expect, it } from "vitest";
import { clipOutputFrameCount } from "./exporter/outputFrameCount";
import {
	planSavedRecordingGif,
	SAVED_GIF_LIMITS,
	type SavedGifRequest,
	type SavedGifSourceMetadata,
} from "./savedRecordingGif";

const source: SavedGifSourceMetadata = { durationSec: 1800, width: 1920, height: 1080 };
const request: SavedGifRequest = {
	mode: "original",
	startSec: 3.25,
	endSec: 8.25,
	fps: 15,
	maxHeight: 720,
	loop: true,
};

describe("saved original GIF preflight (no encoder or destination authorization)", () => {
	it("preserves the requested excerpt, original mode and shared frame arithmetic", () => {
		const plan = planSavedRecordingGif(request, source);
		expect(plan).toMatchObject({
			...request,
			width: 1280,
			height: 720,
			durationSec: 5,
			totalFrames: 75,
			pixelFrames: 1280 * 720 * 75,
			loopCount: 0,
		});
		expect(request.startSec).toBe(3.25);
		expect(source.width).toBe(1920);
	});
	it.each([15, 20, 25, 30] as const)("reuses the existing %i FPS choice", (fps) => {
		const plan = planSavedRecordingGif({ ...request, fps, loop: false }, source);
		expect(plan.totalFrames).toBe(5 * fps);
		expect(plan.loopCount).toBe(1);
	});
	it.each([
		[3840, 2160, 1280, 720],
		[1080, 1920, 404, 720],
		[5120, 1080, 1280, 270],
		[640, 360, 640, 360],
		[3, 3, 2, 2],
	])("fits %ix%i without upscaling (%ix%i)", (width, height, outWidth, outHeight) => {
		const plan = planSavedRecordingGif(request, { ...source, width, height });
		expect([plan.width, plan.height]).toEqual([outWidth, outHeight]);
	});
	it("supports the existing small preset and integer-pixel aspect rounding", () => {
		const plan = planSavedRecordingGif({ ...request, maxHeight: 480 }, source);
		expect([plan.width, plan.height]).toEqual([852, 480]);
		expect(Math.abs(plan.width / plan.height - source.width / source.height)).toBeLessThan(
			2 / plan.height,
		);
	});
	it.each([
		null,
		[],
		"gif",
		7,
		{},
		{ ...request, outPath: "original.mp4" },
		{ ...request, screenPath: "private.mp4" },
		{ ...request, sceneJson: "{}" },
		{ ...request, mode: "composition" },
		{ ...request, fps: "15" },
		{ ...request, fps: 60 },
		{ ...request, maxHeight: 1080 },
		{ ...request, loop: 1 },
		{ ...request, startSec: NaN },
		{ ...request, endSec: Infinity },
	])("rejects malformed/unbounded or path-bearing request %j", (input) => {
		expect(() => planSavedRecordingGif(input, source)).toThrow("Invalid GIF options");
	});
	it.each([
		{ durationSec: NaN },
		{ durationSec: 0 },
		{ durationSec: Infinity },
		{ width: 0 },
		{ width: 1 },
		{ width: -1 },
		{ height: 2.5 },
		{ height: Infinity },
		{ width: Number.MAX_SAFE_INTEGER + 1 },
	])("rejects missing/invalid trusted probe metadata %j", (patch) => {
		expect(() => planSavedRecordingGif(request, { ...source, ...patch })).toThrow("metadata");
	});
	it("never lets native even-pixel snapping upscale a narrow frame", () => {
		expect(() => planSavedRecordingGif(request, { ...source, width: 2, height: 32768 })).toThrow(
			"too narrow",
		);
	});
	it.each([
		{ startSec: -1 },
		{ startSec: 9, endSec: 8 },
		{ startSec: 8.25 },
		{ endSec: 1801 },
		{ startSec: 0, endSec: 60.01 },
	])("rejects out-of-source or overlong excerpts %j", (patch) => {
		expect(() => planSavedRecordingGif({ ...request, ...patch }, source)).toThrow("excerpt");
	});
	it("allows an excerpt ending exactly at the probed end", () => {
		expect(
			planSavedRecordingGif({ ...request, startSec: 1795, endSec: 1800 }, source).durationSec,
		).toBe(5);
	});
	it("bounds work independently of duration and never advertises encoded bytes", () => {
		const options = { ...request, startSec: 0, endSec: 60, fps: 30 };
		expect(() => planSavedRecordingGif(options, source)).toThrow("workload");
		const plan = planSavedRecordingGif({ ...options, maxHeight: 480 }, source);
		expect(plan.pixelFrames).toBeLessThanOrEqual(SAVED_GIF_LIMITS.maxPixelFrames);
		expect(plan).not.toHaveProperty("estimatedBytes");
		expect(plan).not.toHaveProperty("outPath");
	});
	it("uses native epsilon for a fractional excerpt and refuses zero output frames", () => {
		const options = { ...request, startSec: 12.1, endSec: 12.1671 };
		expect(planSavedRecordingGif(options, source).totalFrames).toBe(
			clipOutputFrameCount(
				{ sourceStartSec: options.startSec, sourceEndSec: options.endSec },
				[],
				15,
			),
		);
		expect(() =>
			planSavedRecordingGif({ ...request, startSec: 0, endSec: 0.0005 }, source),
		).toThrow("empty");
	});
});
