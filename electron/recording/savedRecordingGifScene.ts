import path from "node:path";
import { createEmptyDocument } from "../../src/lib/ai-edition/schema";
import { patchEditorSettings } from "../../src/lib/ai-edition/store/editorSettings";
import {
	planSavedRecordingGif,
	type SavedGifSourceMetadata,
} from "../../src/lib/savedRecordingGif";
import { buildSceneDescription } from "../../src/native/sceneDescription";

/** Main-only preparation from the approved original. No IPC, path approval,
 * encoder, disk write or mutation of a real editor document. */
export function buildSavedOriginalGifScene(
	source: SavedGifSourceMetadata & { path: string },
	request: unknown,
) {
	if (!source.path || !path.isAbsolute(source.path) || source.path.includes("\0")) {
		throw new Error("Approved original path is unavailable.");
	}
	const plan = planSavedRecordingGif(request, source);
	const doc = createEmptyDocument({
		projectId: "saved-original-gif",
		title: "Original excerpt",
		createdAt: "1970-01-01T00:00:00.000Z",
	});
	doc.assets = [
		{
			id: "original",
			label: "Original",
			kind: "video",
			originalPath: source.path,
			durationSec: source.durationSec,
			video: { width: source.width, height: source.height, fps: 0, codec: "unknown" },
			cameraTrack: null,
		},
	];
	doc.project.primaryAssetId = "original";
	doc.timeline.clips = [
		{
			id: "excerpt",
			assetId: "original",
			sourceStartSec: plan.startSec,
			sourceEndSec: plan.endSec,
			timelineStartSec: 0,
			timelineEndSec: plan.durationSec,
			wordRefs: [],
			origin: "system",
			reason: "",
		},
	];
	const neutral = patchEditorSettings(doc, {
		wallpaper: "#000000",
		wallpaperMotion: "none",
		frame: "none",
		aspectRatio: "auto",
		formatFollowCursor: false,
		padding: 0,
		borderRadius: 0,
		shadowIntensity: 0,
		backgroundBlur: 0,
		motionBlurAmount: 0,
		depthOfField: false,
		webcamLayoutPreset: "no-webcam",
		webcamBackgroundMode: "none",
		autoFocusAll: false,
		cursor: { show: false, clickSound: false, clickImpact: false, motionBlur: 0 },
	});
	const scene = buildSceneDescription(neutral);
	// This mode is the ORIGINAL frame, not a padded editor composition. Integer
	// resizing can alter the aspect by <2px; use the whole destination, never crop.
	const fullFrame = { x: 0, y: 0, width: 1, height: 1 };
	scene.layout.screenRect = fullFrame;
	for (const layout of scene.layout.layoutByClip ?? []) {
		if (layout) layout.screenRect = fullFrame;
	}
	scene.output = { width: plan.width, height: plan.height, fps: plan.fps };
	// GIF has no audio. These are source clips for this job, not recording facts.
	const clips = scene.clips.map((clip) => ({ ...clip, hasAudio: false }));
	scene.clips = clips;
	return {
		plan,
		clips,
		scene,
		params: { width: plan.width, height: plan.height, fps: plan.fps, loopCount: plan.loopCount },
	};
}
