import { execFile } from "node:child_process";
import type { BrowserWindow, Display, Rectangle, WebContents } from "electron";
import { ipcMain, screen } from "electron";
import {
	type CaptureRectangle,
	resolveWindowsCaptureRegion,
	type WindowsCaptureRegion,
} from "../../src/lib/windowsCaptureRegion";
import { toHelperRect } from "../native-bridge/helperCoordinates";
import { createRegionSelectionWindow } from "../windows";

export interface TrustedWindowsRegion {
	sourceId: string;
	region: WindowsCaptureRegion;
	boundsDip: Rectangle;
	boundsPx: Rectangle;
}

// Old helpers ignore unknown JSON fields. Probe before offering a region: silently
// recording the full monitor is never an acceptable compatibility fallback.
export function supportsWindowsRegion(helper: string): Promise<boolean> {
	return new Promise((resolve) => {
		execFile(
			helper,
			["--capabilities"],
			{ timeout: 3000, windowsHide: true, maxBuffer: 4096 },
			(error, stdout) => {
				try {
					resolve(!error && JSON.parse(stdout).captureRegion === true);
				} catch {
					resolve(false);
				}
			},
		);
	});
}

function sameRect(a: Rectangle, b: Rectangle): boolean {
	return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function isWindowsRegionCurrent(selection: TrustedWindowsRegion): boolean {
	const display = screen.getAllDisplays().find((item) => item.id === selection.region.displayId);
	return (
		!!display &&
		sameRect(display.bounds, selection.boundsDip) &&
		sameRect(toHelperRect(display.bounds), selection.boundsPx)
	);
}

export class WindowsRegionPicker {
	private window: BrowserWindow | null = null;
	private complete: ((region: TrustedWindowsRegion | null) => void) | null = null;
	private snapshot: TrustedWindowsRegion | null = null;
	private owner: BrowserWindow | null = null;

	constructor() {
		ipcMain.handle("region-selection-info", (event) => {
			this.assertSender(event.sender);
			return this.snapshot
				? {
						boundsDip: this.snapshot.boundsDip,
						widthPx: this.snapshot.boundsPx.width,
						heightPx: this.snapshot.boundsPx.height,
					}
				: null;
		});
		ipcMain.handle("region-selection-finish", (event, local: CaptureRectangle | null) => {
			this.assertSender(event.sender);
			if (local === null) {
				this.finish(null);
				return;
			}
			const snapshot = this.snapshot;
			if (!snapshot || !isWindowsRegionCurrent(snapshot)) {
				this.finish(null);
				throw new Error("Display changed. Select the area again.");
			}
			const region = resolveWindowsCaptureRegion(
				{
					id: snapshot.region.displayId,
					boundsDip: snapshot.boundsDip,
					widthPx: snapshot.boundsPx.width,
					heightPx: snapshot.boundsPx.height,
				},
				local && {
					x: local.x + snapshot.boundsDip.x,
					y: local.y + snapshot.boundsDip.y,
					width: local.width,
					height: local.height,
				},
			);
			if (!region) throw new Error("Invalid capture rectangle.");
			this.finish({ ...snapshot, region });
		});
	}

	private assertSender(sender: WebContents) {
		if (!this.window || this.window.isDestroyed() || sender !== this.window.webContents) {
			throw new Error("Region selection is not active for this window.");
		}
	}

	pick(
		sourceId: string,
		display: Display,
		owner: BrowserWindow,
	): Promise<TrustedWindowsRegion | null> {
		if (this.window) throw new Error("Region selection is already active.");
		const boundsPx = toHelperRect(display.bounds);
		this.snapshot = {
			sourceId,
			boundsDip: { ...display.bounds },
			boundsPx,
			region: {
				displayId: display.id,
				sourceWidthPx: boundsPx.width,
				sourceHeightPx: boundsPx.height,
				regionPx: { x: 0, y: 0, width: 0, height: 0 },
			},
		};
		return new Promise((resolve) => {
			this.complete = resolve;
			this.owner = owner;
			this.window = createRegionSelectionWindow(display.bounds);
			this.window.once("closed", () => this.finish(null));
			owner.once("closed", this.ownerClosed);
			this.window.webContents.once("render-process-gone", () => this.finish(null));
			owner.hide();
			this.window.once("ready-to-show", () => {
				this.window?.show();
				this.window?.focus();
			});
		});
	}

	private finish(result: TrustedWindowsRegion | null) {
		const win = this.window;
		const complete = this.complete;
		this.window = null;
		this.complete = null;
		this.snapshot = null;
		if (win && !win.isDestroyed()) win.destroy();
		if (this.owner && !this.owner.isDestroyed()) {
			this.owner.removeListener("closed", this.ownerClosed);
			this.owner.show();
		}
		this.owner = null;
		complete?.(result);
	}

	private ownerClosed = () => this.finish(null);
}
