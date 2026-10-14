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

interface IndicatorWindow {
	isDestroyed(): boolean;
	destroy(): void;
}

/** One indicator per helper; stop/exit of an older helper cannot close a newer one. */
export class WindowsRegionIndicator {
	private current: { owner: object; window: IndicatorWindow } | null = null;
	constructor(private readonly create: (bounds: Rectangle) => IndicatorWindow) {}

	show(owner: object, selection: TrustedWindowsRegion) {
		this.clear();
		this.current = { owner, window: this.create(regionIndicatorBounds(selection)) };
	}

	clear(owner?: object) {
		if (!this.current || (owner && this.current.owner !== owner)) return;
		const { window } = this.current;
		this.current = null;
		if (!window.isDestroyed()) window.destroy();
	}
}
