import type { Rectangle } from "electron";
import type { TrustedWindowsRegion } from "./windowsRegionPicker";

/** Inverse monitor-local mapping of the actual inward/even crop, not the drag. */
export function regionIndicatorBounds(selection: TrustedWindowsRegion): Rectangle {
	const { boundsDip, region } = selection;
	const crop = region.regionPx;
	const sx = boundsDip.width / region.sourceWidthPx;
	const sy = boundsDip.height / region.sourceHeightPx;
	const left = Math.round(boundsDip.x + crop.x * sx);
	const top = Math.round(boundsDip.y + crop.y * sy);
	return {
		x: left,
		y: top,
		width: Math.max(1, Math.round(boundsDip.x + (crop.x + crop.width) * sx) - left),
		height: Math.max(1, Math.round(boundsDip.y + (crop.y + crop.height) * sy) - top),
	};
}

/** Resolve the protected border for a native Windows take, failing closed for windows. */
export function windowsCaptureIndicatorBounds(
	sourceType: "display" | "window",
	displayBounds: Rectangle,
	selection: TrustedWindowsRegion | null,
	hasCrop: boolean,
): Rectangle | null {
	if (sourceType !== "display") return null;
	if (hasCrop) return selection ? regionIndicatorBounds(selection) : null;
	return displayBounds;
}

interface IndicatorWindow {
	isDestroyed(): boolean;
	destroy(): void;
	setOpacity?(opacity: number): void;
}

/** One indicator per helper; stop/exit of an older helper cannot close a newer one. */
export class WindowsRegionIndicator {
	private current: { owner: object; window: IndicatorWindow } | null = null;
	constructor(private readonly create: (bounds: Rectangle) => IndicatorWindow) {}

	show(owner: object, selection: TrustedWindowsRegion) {
		this.showBounds(owner, regionIndicatorBounds(selection));
	}

	/** Show the protected border around an already trusted DIP rectangle. */
	showBounds(owner: object, bounds: Rectangle) {
		this.clear();
		this.current = { owner, window: this.create(bounds) };
	}

	setPaused(owner: object, paused: boolean) {
		if (!this.current || this.current.owner !== owner || this.current.window.isDestroyed()) return;
		this.current.window.setOpacity?.(paused ? 0.45 : 1);
	}

	clear(owner?: object) {
		if (!this.current || (owner && this.current.owner !== owner)) return;
		const { window } = this.current;
		this.current = null;
		if (!window.isDestroyed()) window.destroy();
	}
}
