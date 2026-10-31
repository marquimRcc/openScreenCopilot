import type { Display, Rectangle } from "electron";
import type { TrustedWindowsRegion } from "./windowsRegionPicker";

export type CaptureDisplay = Pick<Display, "id" | "bounds">;

export interface WindowsCapturePreSpawnSnapshot {
	initialSourceGeneration: number;
	initialSelectedSource: { id?: string; display_id?: string } | null;
	initialTrustedRegion: TrustedWindowsRegion | null;
}

export interface WindowsCaptureConfigSnapshot {
	sourceType: string;
	sourceId: string;
	effectiveDisplayId: number | null;
	displayX: number;
	displayY: number;
	displayW: number;
	displayH: number;
	hasCaptureRegion: boolean;
	regionX?: number;
	regionY?: number;
	regionWidth?: number;
	regionHeight?: number;
}

export interface WindowsCapturePreSpawnContext {
	currentSourceGeneration: number;
	currentSelectedSource: { id?: string; display_id?: string } | null;
	currentTrustedRegion: TrustedWindowsRegion | null;
	displays: CaptureDisplay[];
	toHelperBounds: (bounds: Rectangle) => Rectangle;
	isRegionCurrent: (region: TrustedWindowsRegion) => boolean;
}

/**
 * Revalidates that the display, region, and source selection have not changed
 * between initial validation and the actual spawn call.
 * Must be executed synchronously immediately before spawn (no awaits in between).
 */
export function assertWindowsCapturePreSpawnValid(
	snapshot: WindowsCapturePreSpawnSnapshot,
	config: WindowsCaptureConfigSnapshot,
	ctx: WindowsCapturePreSpawnContext,
): void {
	// If a user selection occurred during preparation, the generation counter changed.
	if (ctx.currentSourceGeneration !== snapshot.initialSourceGeneration) {
		throw new Error("Selected source changed during preparation. Try again.");
	}

	// If a source was originally selected in the UI, verify it has not changed identity.
	// We check id and display_id rather than object reference equality, because source
	// re-enumeration creates an equivalent object without changing user selection.
	if (snapshot.initialSelectedSource !== null) {
		if (
			!ctx.currentSelectedSource ||
			ctx.currentSelectedSource.id !== snapshot.initialSelectedSource.id ||
			(ctx.currentSelectedSource.display_id ?? "") !==
				(snapshot.initialSelectedSource.display_id ?? "")
		) {
			throw new Error("Selected source changed during preparation. Try again.");
		}
	}

	// For display capture, revalidate that the target display still exists and that its physical
	// geometry (including position and DPI/resolution) has not drifted from config bounds.
	if (config.sourceType === "display") {
		const targetDisplay =
			config.effectiveDisplayId != null
				? ctx.displays.find((d) => d.id === config.effectiveDisplayId)
				: ctx.displays.find((d) => {
						const bounds = ctx.toHelperBounds(d.bounds);
						return (
							bounds.x === config.displayX &&
							bounds.y === config.displayY &&
							bounds.width === config.displayW &&
							bounds.height === config.displayH
						);
					});

		if (!targetDisplay) {
			throw new Error("Target display is no longer available. Try again.");
		}
		const currentHelperBounds = ctx.toHelperBounds(targetDisplay.bounds);
		if (
			currentHelperBounds.x !== config.displayX ||
			currentHelperBounds.y !== config.displayY ||
			currentHelperBounds.width !== config.displayW ||
			currentHelperBounds.height !== config.displayH
		) {
			throw new Error("Display geometry or DPI changed during preparation. Try again.");
		}
	}

	if (config.hasCaptureRegion) {
		const region = ctx.currentTrustedRegion;
		const crop = region?.region.regionPx;
		const isRegionValid =
			region &&
			region === snapshot.initialTrustedRegion &&
			ctx.isRegionCurrent(region) &&
			region.sourceId === config.sourceId &&
			crop &&
			crop.x === config.regionX &&
			crop.y === config.regionY &&
			crop.width === config.regionWidth &&
			crop.height === config.regionHeight;

		if (!isRegionValid) {
			throw new Error(
				"Capture region is no longer valid. Select the area again; full-screen fallback is disabled.",
			);
		}
	} else if (ctx.currentTrustedRegion !== snapshot.initialTrustedRegion) {
		throw new Error("Selected source changed during preparation. Try again.");
	}
}
