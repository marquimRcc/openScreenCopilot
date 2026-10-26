import { describe, expect, it, vi } from "vitest";
import { terminateOwnerOnlyWindowsCaptureForQuit } from "./windowsCaptureQuit";

describe("owner-only Windows capture quit cleanup", () => {
	it("does nothing without an owned helper", async () => {
		const terminate = vi.fn(async () => true);
		await terminateOwnerOnlyWindowsCaptureForQuit({
			referencedProcess: null,
			ownedProcess: null,
			terminate,
		});
		expect(terminate).not.toHaveBeenCalled();
	});

	it("leaves an actively referenced owned helper to the normal close flow", async () => {
		const process = {};
		const terminate = vi.fn(async () => true);
		await terminateOwnerOnlyWindowsCaptureForQuit({
			referencedProcess: process,
			ownedProcess: process,
			terminate,
		});
		expect(terminate).not.toHaveBeenCalled();
	});

	it("awaits termination of an owner-only helper", async () => {
		const process = {};
		const terminate = vi.fn(async () => true);
		await terminateOwnerOnlyWindowsCaptureForQuit({
			referencedProcess: null,
			ownedProcess: process,
			terminate,
		});
		expect(terminate).toHaveBeenCalledOnce();
		expect(terminate).toHaveBeenCalledWith(process);
	});

	it("fails closed when owner-only termination is not confirmed", async () => {
		await expect(
			terminateOwnerOnlyWindowsCaptureForQuit({
				referencedProcess: null,
				ownedProcess: {},
				terminate: async () => false,
			}),
		).rejects.toThrow(/did not exit/);
	});

	it("propagates owner-only termination errors", async () => {
		await expect(
			terminateOwnerOnlyWindowsCaptureForQuit({
				referencedProcess: null,
				ownedProcess: {},
				terminate: async () => {
					throw new Error("termination failed");
				},
			}),
		).rejects.toThrow("termination failed");
	});

	it("fails closed instead of terminating an inconsistent owner", async () => {
		const terminate = vi.fn(async () => true);
		await expect(
			terminateOwnerOnlyWindowsCaptureForQuit({
				referencedProcess: {},
				ownedProcess: {},
				terminate,
			}),
		).rejects.toThrow(/inconsistent/);
		expect(terminate).not.toHaveBeenCalled();
	});
});
