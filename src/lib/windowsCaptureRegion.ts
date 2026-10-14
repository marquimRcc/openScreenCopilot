/** DIPs are desktop coordinates; helper
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

export interface RegionSelectionInfo {
	boundsDip: CaptureRectangle;
	widthPx: number;
	heightPx: number;
}

/** Local viewport DIPs. Drag in any direction; never cross monitor edges. */
export function rectangleFromDrag(
	start: { x: number; y: number },
	end: { x: number; y: number },
	viewport: { width: number; height: number },
): CaptureRectangle {
	const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));
	const x1 = clamp(start.x, viewport.width);
	const y1 = clamp(start.y, viewport.height);
	const x2 = clamp(end.x, viewport.width);
	const y2 = clamp(end.y, viewport.height);
	return {
		x: Math.min(x1, x2),
		y: Math.min(y1, y2),
		width: Math.abs(x2 - x1),
		height: Math.abs(y2 - y1),
	};
}

function finiteRectangle(rect: CaptureRectangle): boolean {
	return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
}

/** Round inward, never include unselected pixels, and align H.264 dimensions
 * inward to even values. The main process must supply the display snapshot.
 * Returns null for cancellation, tiny selections, or a cross-monitor region.
 */
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
