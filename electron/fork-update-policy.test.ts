import { describe, expect, it, vi } from "vitest";
import { SELF_UPDATE_ENABLED } from "../src/config/product";
import { checkForSelfUpdate, downloadSelfUpdate, installSelfUpdate } from "./auto-updater";
import { offersUpdateCheck } from "./install-channel";

vi.mock("electron", () => ({ app: { isPackaged: true } }));
vi.mock("electron-updater", () => {
	throw new Error("The fork must not even import the updater while updates are disabled.");
});

describe("experimental fork update policy", () => {
	it("hides update controls on every install channel", () => {
		expect(SELF_UPDATE_ENABLED).toBe(false);
		for (const channel of ["dev", "unknown", "nsis", "dmg", "appimage", "store"] as const) {
			expect(offersUpdateCheck(channel, { recording: false })).toBe(false);
		}
	});
	it("refuses checks, downloads and installation before importing any updater", async () => {
		await expect(checkForSelfUpdate("nsis")).resolves.toEqual({ kind: "unsupported" });
		await expect(downloadSelfUpdate()).resolves.toEqual({ kind: "unsupported" });
		await expect(installSelfUpdate()).rejects.toThrow("Automatic updates are disabled");
	});
});
