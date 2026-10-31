import { clipOutputFrameCount } from "./exporter/outputFrameCount";
import { GIF_SIZE_PRESETS, type GifFrameRate, isValidGifFrameRate } from "./exporter/types";

/** Limits for the SIMPLE original-only action, not restrictions on the editor. */
export const SAVED_GIF_LIMITS = Object.freeze({
	maxDurationSec: 60,
	maxEdge: 1280,
	maxPixelFrames: 1_000_000_000,
});

export interface SavedGifRequest {
	mode: "original";
	startSec: number;
	endSec: number;
	fps: GifFrameRate;
	maxHeight: 480 | 720;
	loop: boolean;
}

export interface SavedGifResult {
	success: boolean;
	canceled?: boolean;
	path?: string;
	sizeBytes?: number;
	error?: string;
	errorCode?: "exists";
}
export interface SavedGifProgress {
	jobId: string;
	frames: number;
	totalFrames: number;
}

export interface SavedGifSourceMetadata {
	/** Must be probed from the main-approved original, never supplied over IPC. */
	durationSec: number;
	width: number;
	height: number;
}

export interface SavedGifPlan extends SavedGifRequest {
	width: number;
	height: number;
	durationSec: number;
	totalFrames: number;
	loopCount: 0 | 1;
	/** Work estimate only: NOT encoded GIF bytes or simultaneously allocated memory. */
	pixelFrames: number;
}

const REQUEST_KEYS = new Set(["mode", "startSec", "endSec", "fps", "maxHeight", "loop"]);

/** Pure preflight shared by future UI and main. It grants no file permission,
 * constructs no scene, and starts no encoder. Main must re-probe/revalidate at
 * execution time and use its own source, owner and derived destination. */
export function planSavedRecordingGif(
	input: unknown,
	source: SavedGifSourceMetadata,
): SavedGifPlan {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("Invalid GIF options.");
	}
	const options = input as Record<string, unknown>;
	if (
		Object.keys(options).length !== REQUEST_KEYS.size ||
		Object.keys(options).some((key) => !REQUEST_KEYS.has(key)) ||
		options.mode !== "original" ||
		typeof options.startSec !== "number" ||
		typeof options.endSec !== "number" ||
		!Number.isFinite(options.startSec) ||
		!Number.isFinite(options.endSec) ||
		typeof options.fps !== "number" ||
		!isValidGifFrameRate(options.fps) ||
		(options.maxHeight !== GIF_SIZE_PRESETS.small.maxHeight &&
			options.maxHeight !== GIF_SIZE_PRESETS.medium.maxHeight) ||
		typeof options.loop !== "boolean"
	) {
		throw new Error("Invalid GIF options.");
	}
	if (
		!Number.isFinite(source.durationSec) ||
		source.durationSec <= 0 ||
		!Number.isSafeInteger(source.width) ||
		!Number.isSafeInteger(source.height) ||
		source.width < 2 ||
		source.height < 2
	) {
		throw new Error("Original video metadata is unavailable.");
	}
	const durationSec = options.endSec - options.startSec;
	if (
		options.startSec < 0 ||
		durationSec <= 0 ||
		options.endSec > source.durationSec ||
		durationSec > SAVED_GIF_LIMITS.maxDurationSec
	) {
		throw new Error("Select a GIF excerpt inside the original, at most 60 seconds long.");
	}
	// The EXISTING addon snaps both axes down to even pixels for GIF too
	// (resolve_output_size). Match that here instead of showing a different size.
	const maxHeight = options.maxHeight as SavedGifRequest["maxHeight"];
	const scale = Math.min(
		1,
		maxHeight / source.height,
		SAVED_GIF_LIMITS.maxEdge / Math.max(source.width, source.height),
	);
	const width = Math.floor((source.width * scale) / 2) * 2;
	const height = Math.floor((source.height * scale) / 2) * 2;
	if (width < 2 || height < 2) {
		throw new Error("Original video aspect ratio is too narrow for the native GIF size.");
	}
	// Use the compositor's shared frame-grid arithmetic, including its epsilon.
	const totalFrames = clipOutputFrameCount(
		{ sourceStartSec: options.startSec, sourceEndSec: options.endSec },
		[],
		options.fps,
	);
	const pixelFrames = width * height * totalFrames;
	if (totalFrames < 1 || pixelFrames > SAVED_GIF_LIMITS.maxPixelFrames) {
		throw new Error("GIF workload is too large or empty. Reduce the excerpt, size or FPS.");
	}
	return {
		mode: "original",
		startSec: options.startSec,
		endSec: options.endSec,
		fps: options.fps,
		maxHeight,
		loop: options.loop,
		width,
		height,
		durationSec,
		totalFrames,
		loopCount: options.loop ? 0 : 1,
		pixelFrames,
	};
}
