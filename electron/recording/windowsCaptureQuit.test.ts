import { describe, expect, it, vi } from "vitest";
import { terminateOrphanedWindowsCaptureForQuit } from "./windowsCaptureQuit";

describe("orphaned Windows capture quit cleanup", () => {
	it("does nothing without a referenced or owned helper", async () => {
		const terminate = vi.fn(async () => true);
		await terminateOrphanedWindowsCaptureForQuit({
			referencedProcess: null,
			ownedProcess: null,
			terminate,
		});
		expect(terminate).not.toHaveBeenCalled();
	});

	it("leaves an actively referenced owned helper to the normal close flow", async () => {
		const process = {};
		const terminate = vi.fn(async () => true);
		await terminateOrphanedWindowsCaptureForQuit({
			referencedProcess: process,
			ownedProcess: process,
			terminate,
		});
		expect(terminate).not.toHaveBeenCalled();
	});

	it("awaits termination of an owner-only helper", async () => {
		const process = {};
		const terminate = vi.fn(async () => true);
		await terminateOrphanedWindowsCaptureForQuit({
			referencedProcess: null,
			ownedProcess: process,
			terminate,
		});
		expect(terminate).toHaveBeenCalledOnce();
		expect(terminate).toHaveBeenCalledWith(process);
	});

	it("awaits termination of a reference-only helper after ownership attach failed", async () => {
		const process = {};
		const terminate = vi.fn(async () => true);
		await terminateOrphanedWindowsCaptureForQuit({
			referencedProcess: process,
			ownedProcess: null,
			terminate,
		});
		expect(terminate).toHaveBeenCalledOnce();
		expect(terminate).toHaveBeenCalledWith(process);
	});

	it("fails closed when owner-only termination is not confirmed", async () => {
		await expect(
			terminateOrphanedWindowsCaptureForQuit({
				referencedProcess: null,
				ownedProcess: {},
				terminate: async () => false,
			}),
		).rejects.toThrow(/did not exit/);
	});

	it("fails closed when reference-only termination is not confirmed", async () => {
		await expect(
			terminateOrphanedWindowsCaptureForQuit({
				referencedProcess: {},
				ownedProcess: null,
				terminate: async () => false,
			}),
		).rejects.toThrow(/did not exit/);
	});

	it("propagates owner-only termination errors", async () => {
		await expect(
			terminateOrphanedWindowsCaptureForQuit({
				referencedProcess: null,
				ownedProcess: {},
				terminate: async () => {
					throw new Error("termination failed");
				},
			}),
		).rejects.toThrow("termination failed");
	});

	it("propagates reference-only termination errors", async () => {
		await expect(
			terminateOrphanedWindowsCaptureForQuit({
				referencedProcess: {},
				ownedProcess: null,
				terminate: async () => {
					throw new Error("reference termination failed");
				},
			}),
		).rejects.toThrow("reference termination failed");
	});

	it("fails closed instead of terminating an inconsistent owner", async () => {
		const terminate = vi.fn(async () => true);
		await expect(
			terminateOrphanedWindowsCaptureForQuit({
				referencedProcess: {},
				ownedProcess: {},
				terminate,
			}),
		).rejects.toThrow(/inconsistent/);
		expect(terminate).not.toHaveBeenCalled();
	});
});
