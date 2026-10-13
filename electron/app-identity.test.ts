import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { APP_ID, PRODUCT_NAME } from "../src/config/product";
import { initializeAppIdentity, profilePaths } from "./app-identity";

describe("fork application identity", () => {
	it("isolates packaged and development profiles from both upstream names", () => {
		const root = path.join("test", "app-data");
		const packaged = profilePaths(root, true);
		const development = profilePaths(root, false);
		expect(packaged.userData).toBe(path.join(root, PRODUCT_NAME));
		expect(development.userData).not.toBe(packaged.userData);
		for (const profile of [packaged, development]) {
			expect(profile.userData).not.toBe(path.join(root, "openscreen"));
			expect(profile.userData).not.toBe(path.join(root, "Openscreen"));
			expect(profile.sessionData).toBe(path.join(profile.userData, "chromium"));
		}
	});

	it("creates paths before registering them and sets the Windows taskbar identity", () => {
		const events: string[] = [];
		const host = {
			isPackaged: true,
			getPath: vi.fn(() => "app-data"),
			setName: vi.fn(),
			setPath: vi.fn((name: string) => events.push(`set:${name}`)),
			setAppUserModelId: vi.fn(),
		};
		initializeAppIdentity(host, () => events.push("mkdir"), "win32");
		expect(events).toEqual(["mkdir", "mkdir", "set:userData", "set:sessionData"]);
		expect(host.setName).toHaveBeenCalledWith(PRODUCT_NAME);
		expect(host.setAppUserModelId).toHaveBeenCalledWith(APP_ID);
	});

	it("does not call Windows-only APIs on Linux or macOS", () => {
		for (const platform of ["linux", "darwin"] as const) {
			const host = {
				isPackaged: false,
				getPath: () => "app-data",
				setName: vi.fn(),
				setPath: vi.fn(),
				setAppUserModelId: vi.fn(),
			};
			initializeAppIdentity(host, vi.fn(), platform);
			expect(host.setAppUserModelId).not.toHaveBeenCalled();
		}
	});
});
