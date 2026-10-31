import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_EDITOR_SETTINGS } from "../../src/lib/ai-edition/store/editorSettings";
import { buildSavedOriginalGifScene } from "./savedRecordingGifScene";

const source = {
	path: path.resolve("gravação sintética.mp4"),
	width: 960,
	height: 600,
	durationSec: 5,
};
const options = {
	mode: "original",
	startSec: 1.25,
	endSec: 3.25,
	fps: 15,
	maxHeight: 480,
	loop: true,
};

describe("main-owned original excerpt scene preparation", () => {
	it("uses one trimmed source clip, with no separate camera or audio", () => {
		const result = buildSavedOriginalGifScene(source, options);
		expect(result.clips).toEqual([
			{
				screenPath: source.path,
				webcamPath: "",
				webcamOffsetSec: 0,
				sourceStartSec: 1.25,
				sourceEndSec: 3.25,
				hasAudio: false,
			},
		]);
		expect(result.scene.clips).toEqual(result.clips);
		expect(result.params).toEqual({ width: 768, height: 480, fps: 15, loopCount: 0 });
	});
	it("uses the shared serializer with neutral original-only layout and effects", () => {
		const before = JSON.stringify(DEFAULT_EDITOR_SETTINGS);
		const { scene } = buildSavedOriginalGifScene(source, options);
		expect(scene.layout.preset).toBe("no-webcam");
		expect(scene.layout.screenRect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
		expect(scene.layout.webcamRect).toBeNull();
		expect(scene.layout.screenCover).toBe(false);
		expect(scene.effects).toMatchObject({
			padding: 0,
			shadow: 0,
			blur: 0,
			motionBlur: 0,
			roundnessFrac: 0,
			depthOfField: false,
		});
		expect(scene.effects.frame).toBeUndefined();
		expect(scene.cursor.show).toBe(false);
		expect(scene).not.toHaveProperty("clickSound");
		expect(scene).not.toHaveProperty("webcamEffect");
		expect([
			scene.zoomRegions,
			scene.annotations,
			scene.cameraFullscreenRegions,
			scene.speedRegions,
			scene.audioTracks,
		]).toEqual([[], [], [], [], []]);
		expect(scene.cropByClip).toEqual([null]);
		expect(JSON.stringify(DEFAULT_EDITOR_SETTINGS)).toBe(before);
	});
	it.each([
		[1920, 1080, 852, 480],
		[1080, 1920, 270, 480],
		[1365, 769, 852, 480],
	])("fits %ix%i to native even dimensions %ix%i without cropping", (width, height, outWidth, outHeight) => {
		const { scene, params } = buildSavedOriginalGifScene({ ...source, width, height }, options);
		expect(scene.output).toEqual({ width: outWidth, height: outHeight, fps: 15 });
		expect(params.width).toBe(outWidth);
		expect(params.height).toBe(outHeight);
		expect(scene.layout.layoutByClip?.[0]?.screenRect).toEqual(scene.layout.screenRect);
		expect(scene.cropByClip).toEqual([null]);
	});
	it("revalidates options instead of accepting scene/path overrides", () => {
		expect(() => buildSavedOriginalGifScene(source, { ...options, sceneJson: "{}" })).toThrow(
			"options",
		);
		expect(() => buildSavedOriginalGifScene(source, { ...options, outPath: source.path })).toThrow(
			"options",
		);
		expect(() => buildSavedOriginalGifScene(source, { ...options, endSec: 6 })).toThrow("excerpt");
	});
	it.each([
		"",
		"relative.mp4",
		"https://example.invalid/private.mp4",
		`${source.path}\0`,
	])("rejects an invalid approved path %j", (file) => {
		expect(() => buildSavedOriginalGifScene({ ...source, path: file }, options)).toThrow("path");
	});
});
