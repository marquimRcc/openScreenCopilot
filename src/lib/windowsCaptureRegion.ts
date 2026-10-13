/** Contract for the upcoming overlay. DIPs are desktop coordinates; helper
 * pixels are relative to a single monitor, not a scaled desktop origin. */
export interface CaptureRectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface WindowsCaptureRegion {
	displayId: number;
	/** Snapshot: a display-mode change invalidates the selection. */
	sourceWidthPx: number;
	sourceHeightPx: number;
	regionPx: CaptureRectangle;
}

function finiteRectangle(rect: CaptureRectangle): boolean {
	return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
}

/** Round inward, never include unselected pixels, and align H.264 dimensions
 * inward to even values. The main process must supply the display snapshot.
 * Returns null for cancellation, tiny selections, or a cross-monitor region.
 * This contract is not yet connected to the HUD or its cursor sidecar. */
export function resolveWindowsCaptureRegion(
	display: {
		id: number;
		boundsDip: CaptureRectangle;
		widthPx: number;
		heightPx: number;
	},
	selectionDip: CaptureRectangle | null,
): WindowsCaptureRegion | null {
	const { boundsDip, widthPx, heightPx } = display;
	if (
		!selectionDip ||
		!Number.isSafeInteger(display.id) ||
		!finiteRectangle(boundsDip) ||
		!finiteRectangle(selectionDip) ||
		boundsDip.width <= 0 ||
		boundsDip.height <= 0 ||
		!Number.isSafeInteger(widthPx) ||
		!Number.isSafeInteger(heightPx) ||
		widthPx < 2 ||
		heightPx < 2 ||
		widthPx > 2_147_483_647 ||
		heightPx > 2_147_483_647 ||
		selectionDip.width <= 0 ||
		selectionDip.height <= 0
	) {
		return null;
	}
	const localX = selectionDip.x - boundsDip.x;
	const localY = selectionDip.y - boundsDip.y;
	const rightDip = localX + selectionDip.width;
	const bottomDip = localY + selectionDip.height;
	if (localX < 0 || localY < 0 || rightDip > boundsDip.width || bottomDip > boundsDip.height) {
		return null;
	}
	// Scale each monitor locally. Multiplying a negative/global DIP origin by
	// scaleFactor is wrong in a mixed-DPI desktop. Independent axes also handle
	// the small rounding difference between Electron DIPs and physical modes.
	const scaleX = widthPx / boundsDip.width;
	const scaleY = heightPx / boundsDip.height;
	const x = Math.ceil(localX * scaleX);
	const y = Math.ceil(localY * scaleY);
	const right = Math.floor(rightDip * scaleX);
	const bottom = Math.floor(bottomDip * scaleY);
	const width = Math.floor((right - x) / 2) * 2;
	const height = Math.floor((bottom - y) / 2) * 2;
	if (width < 2 || height < 2) return null;
	return {
		displayId: display.id,
		sourceWidthPx: widthPx,
		sourceHeightPx: heightPx,
		regionPx: { x, y, width, height },
	};
}
