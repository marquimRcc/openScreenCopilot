import { describe, expect, it } from "vitest";
import { isWindowsCaptureBusy } from "./windowsCaptureBusy";

describe("Windows capture busy state", () => {
	it("is idle only without a process reference or retained ownership", () => {
		expect(isWindowsCaptureBusy({ processReferenced: false, processOwned: false })).toBe(false);
	});

	it("is busy while the helper is referenced", () => {
		expect(isWindowsCaptureBusy({ processReferenced: true, processOwned: false })).toBe(true);
	});

	it("is busy while an unclosed helper remains owned after logical reset", () => {
		expect(isWindowsCaptureBusy({ processReferenced: false, processOwned: true })).toBe(true);
	});
});
