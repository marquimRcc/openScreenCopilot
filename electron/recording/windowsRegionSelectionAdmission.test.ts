import { describe, expect, it } from "vitest";
import { canSelectWindowsRegion } from "./windowsRegionSelectionAdmission";

describe("Windows region selection admission", () => {
	it("allows selection only while capture is fully idle", () => {
		expect(
			canSelectWindowsRegion({
				appRecording: false,
				processReferenced: false,
				processOwned: false,
			}),
		).toBe(true);
	});

	it.each([
		["an app recording", { appRecording: true, processReferenced: false, processOwned: false }],
		["a referenced helper", { appRecording: false, processReferenced: true, processOwned: false }],
		[
			"an unclosed owned helper",
			{ appRecording: false, processReferenced: false, processOwned: true },
		],
	] as const)("blocks selection for %s", (_label, state) => {
		expect(canSelectWindowsRegion(state)).toBe(false);
	});
});
