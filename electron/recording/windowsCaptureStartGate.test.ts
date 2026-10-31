import { describe, expect, it } from "vitest";
import { WindowsCaptureStartGate } from "./windowsCaptureStartGate";

describe("Windows capture startup reservation", () => {
	it("blocks another startup until preparation and cleanup release ownership", async () => {
		const gate = new WindowsCaptureStartGate();
		const release = gate.tryAcquire();
		expect(release).not.toBeNull();
		await Promise.resolve();
		expect(gate.isBusy()).toBe(true);
		expect(gate.tryAcquire()).toBeNull();
		release?.();
		expect(gate.isBusy()).toBe(false);
		expect(gate.tryAcquire()).not.toBeNull();
	});
	it("an old release cannot clear a newer startup", () => {
		const gate = new WindowsCaptureStartGate();
		const first = gate.tryAcquire();
		first?.();
		const second = gate.tryAcquire();
		first?.();
		expect(gate.tryAcquire()).toBeNull();
		second?.();
		expect(gate.tryAcquire()).not.toBeNull();
	});
});
