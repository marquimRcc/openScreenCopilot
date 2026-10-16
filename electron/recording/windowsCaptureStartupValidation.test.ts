import type { Rectangle } from "electron";
import { describe, expect, it, vi } from "vitest";
import { WindowsCaptureStartGate } from "./windowsCaptureStartGate";
import {
	assertWindowsCapturePreSpawnValid,
	type CaptureDisplay,
	type WindowsCaptureConfigSnapshot,
	type WindowsCapturePreSpawnContext,
	type WindowsCapturePreSpawnSnapshot,
} from "./windowsCaptureStartupValidation";
import type { TrustedWindowsRegion } from "./windowsRegionPicker";

function createDisplayFixture(id: number, bounds: Rectangle): CaptureDisplay {
	return { id, bounds };
}

function createTrustedRegionFixture(
	sourceId: string,
	displayId: number,
	regionPx: Rectangle,
	boundsDip: Rectangle,
	boundsPx: Rectangle,
): TrustedWindowsRegion {
	return {
		sourceId,
		region: {
			displayId,
			sourceWidthPx: boundsPx.width,
			sourceHeightPx: boundsPx.height,
			regionPx,
		},
		boundsDip,
		boundsPx,
	};
}

describe("Windows capture pre-spawn startup validation", () => {
	it("passes on stable path when source, region, and display geometry are unchanged", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const helperBounds1: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
		const regionPx1: Rectangle = { x: 100, y: 100, width: 800, height: 600 };
		const trustedRegion1 = createTrustedRegionFixture(
			"screen:1:0",
			1,
			regionPx1,
			display1.bounds,
			helperBounds1,
		);

		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: trustedRegion1,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: true,
			regionX: 100,
			regionY: 100,
			regionWidth: 800,
			regionHeight: 600,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: trustedRegion1,
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).not.toThrow();
	});

	it("passes when selectedSource is recreated with equivalent properties (re-enumeration)", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const helperBounds1: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
		const regionPx1: Rectangle = { x: 100, y: 100, width: 800, height: 600 };
		const trustedRegion1 = createTrustedRegionFixture(
			"screen:1:0",
			1,
			regionPx1,
			display1.bounds,
			helperBounds1,
		);

		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: trustedRegion1,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: true,
			regionX: 100,
			regionY: 100,
			regionWidth: 800,
			regionHeight: 600,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			// Fresh object instance with identical id and display_id
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: trustedRegion1,
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).not.toThrow();
	});

	it("passes on CLI/direct call with displayId 0 and no selectedSource using bounds resolution", () => {
		const display1 = createDisplayFixture(7, { x: 1920, y: 0, width: 1920, height: 1080 });
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 1,
			initialSelectedSource: null,
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:7:0",
			effectiveDisplayId: null, // displayId was 0/omitted
			displayX: 1920,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 1,
			currentSelectedSource: null,
			currentTrustedRegion: null,
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).not.toThrow();
	});

	it("passes on window capture without region", () => {
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 3,
			initialSelectedSource: { id: "window:456:0" },
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "window",
			sourceId: "window:456:0",
			effectiveDisplayId: null,
			displayX: 0,
			displayY: 0,
			displayW: 0,
			displayH: 0,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 3,
			currentSelectedSource: { id: "window:456:0" },
			currentTrustedRegion: null,
			displays: [],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).not.toThrow();
	});

	it("fails closed when user switches source during preparation (generation bump)", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 6, // Generation changed
			currentSelectedSource: { id: "screen:2:0", display_id: "2" },
			currentTrustedRegion: null,
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Selected source changed during preparation. Try again.",
		);
	});

	it("fails closed when user switches source during preparation (source identity change)", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "window:999:0", display_id: "" }, // Switched to window
			currentTrustedRegion: null,
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Selected source changed during preparation. Try again.",
		);
	});

	it("fails closed when rectangle is re-selected on the same monitor during awaits", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const helperBounds1: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
		const region1 = createTrustedRegionFixture(
			"screen:1:0",
			1,
			{ x: 100, y: 100, width: 800, height: 600 },
			display1.bounds,
			helperBounds1,
		);
		const region2 = createTrustedRegionFixture(
			"screen:1:0",
			1,
			{ x: 200, y: 200, width: 640, height: 480 },
			display1.bounds,
			helperBounds1,
		);

		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: region1,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: true,
			regionX: 100,
			regionY: 100,
			regionWidth: 800,
			regionHeight: 600,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: region2, // Replaced with new rectangle
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Capture region is no longer valid. Select the area again; full-screen fallback is disabled.",
		);
	});

	it("fails closed when target display is disconnected/removed before spawn", () => {
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: null,
			displays: [], // Display disconnected
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Target display is no longer available. Try again.",
		);
	});

	it("fails closed when display position changes even if dimensions match (multi-monitor shift)", () => {
		const movedDisplay = createDisplayFixture(1, { x: -1920, y: 0, width: 1920, height: 1080 });
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0, // Config recorded origin 0, 0
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: null,
			displays: [movedDisplay],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Display geometry or DPI changed during preparation. Try again.",
		);
	});

	it("fails closed when DPI/physical scaling changes before spawn", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: null,
			displays: [display1],
			// DPI scaling changed to 150%: returns physical 2880x1620
			toHelperBounds: () => ({ x: 0, y: 0, width: 2880, height: 1620 }),
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Display geometry or DPI changed during preparation. Try again.",
		);
	});

	it("fails closed when region is no longer current according to isRegionCurrent", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const helperBounds1: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
		const region1 = createTrustedRegionFixture(
			"screen:1:0",
			1,
			{ x: 100, y: 100, width: 800, height: 600 },
			display1.bounds,
			helperBounds1,
		);

		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: region1,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: true,
			regionX: 100,
			regionY: 100,
			regionWidth: 800,
			regionHeight: 600,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: region1,
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => false,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Capture region is no longer valid. Select the area again; full-screen fallback is disabled.",
		);
	});

	it("fails closed when a region is selected during full-screen preparation", () => {
		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const helperBounds1: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
		const region1 = createTrustedRegionFixture(
			"screen:1:0",
			1,
			{ x: 100, y: 100, width: 800, height: 600 },
			display1.bounds,
			helperBounds1,
		);

		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 5,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: null, // Started as full screen
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 5,
			currentSelectedSource: { id: "screen:1:0", display_id: "1" },
			currentTrustedRegion: region1, // Region added while preparing full screen
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		expect(() => assertWindowsCapturePreSpawnValid(snapshot, config, ctx)).toThrow(
			"Selected source changed during preparation. Try again.",
		);
	});

	// Limit notice: this unit test verifies the fail-closed abort contract and resource release
	// within a controlled harness. Full end-to-end IPC handler cleanup and native process lifecycle
	// require physical execution and are covered separately.
	it("unit harness: verifies fail-closed abort prevents spawn and triggers cleanup (does not test full IPC handler integration)", async () => {
		const startGate = new WindowsCaptureStartGate();
		const releaseStart = startGate.tryAcquire();
		expect(releaseStart).not.toBeNull();
		expect(startGate.isBusy()).toBe(true);

		const spawnStub = vi.fn();
		let cleanedUp = false;

		const display1 = createDisplayFixture(1, { x: 0, y: 0, width: 1920, height: 1080 });
		const snapshot: WindowsCapturePreSpawnSnapshot = {
			initialSourceGeneration: 10,
			initialSelectedSource: { id: "screen:1:0", display_id: "1" },
			initialTrustedRegion: null,
		};
		const config: WindowsCaptureConfigSnapshot = {
			sourceType: "display",
			sourceId: "screen:1:0",
			effectiveDisplayId: 1,
			displayX: 0,
			displayY: 0,
			displayW: 1920,
			displayH: 1080,
			hasCaptureRegion: false,
		};
		const ctx: WindowsCapturePreSpawnContext = {
			currentSourceGeneration: 11, // Concurrent selection bump
			currentSelectedSource: { id: "screen:2:0", display_id: "2" },
			currentTrustedRegion: null,
			displays: [display1],
			toHelperBounds: (bounds) => bounds,
			isRegionCurrent: () => true,
		};

		async function simulatedStartupWindows() {
			try {
				// Async preparation awaits...
				await Promise.resolve();

				// Immediate synchronous pre-spawn revalidation:
				assertWindowsCapturePreSpawnValid(snapshot, config, ctx);

				// Spawn process:
				spawnStub();
			} catch (error) {
				cleanedUp = true;
				throw error;
			} finally {
				releaseStart?.();
			}
		}

		await expect(simulatedStartupWindows()).rejects.toThrow(
			"Selected source changed during preparation. Try again.",
		);
		expect(spawnStub).not.toHaveBeenCalled();
		expect(cleanedUp).toBe(true);
		expect(startGate.isBusy()).toBe(false);
		expect(startGate.tryAcquire()).not.toBeNull();
	});
});
