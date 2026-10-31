import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_ID, PRODUCT_NAME, REPOSITORY_URL } from "../src/config/product";
import { objectBody, stripJson5Comments } from "./macos-floor.mjs";

const config = stripJson5Comments(
	readFileSync(new URL("../electron-builder.json5", import.meta.url), "utf8"),
);
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const declaredString = (source, key) => source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`))?.[1];

describe("fork distribution safety", () => {
	it("keeps runtime and packaged identities in agreement", () => {
		expect(declaredString(config, "productName")).toBe(PRODUCT_NAME);
		expect(declaredString(config, "appId")).toBe(APP_ID);
		expect(manifest.homepage).toBe(REPOSITORY_URL);
		expect(manifest.repository.url).toBe(`git+${REPOSITORY_URL}.git`);
		expect(manifest.version).toBe("0.1.0-alpha.1");
	});
	it("does not generate update feeds or invoke the AppImage discovery hooks", () => {
		expect(config).toMatch(/"publish"\s*:\s*\[\s*\]/);
		expect(config).not.toMatch(/"artifactBuildCompleted"\s*:/);
		expect(config).not.toMatch(/"afterAllArtifactBuild"\s*:/);
	});
	it("disarms Store packaging and never reuses the upstream publisher", () => {
		expect(manifest.scripts["build:win:store"]).toBe("node scripts/fork-store-disabled.mjs");
		const appx = objectBody(config, "appx");
		expect(declaredString(appx, "identityName")).toBe("marquimRcc.openScreenCopilot.Development");
		expect(declaredString(appx, "publisher")).toBe("CN=openScreenCopilot-Local-Development");
	});
	it("initializes the profile before importing any module that may cache paths", () => {
		const main = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
		expect(main.trimStart().startsWith('import "./initialize-identity";')).toBe(true);
	});
	it("keeps the draft speech sidecar out of every installer", () => {
		for (const excluded of [
			"!win32-*/openscreen-speech-sidecar.exe",
			"!darwin-*/openscreen-speech-sidecar",
			"!linux-*/openscreen-speech-sidecar",
		]) {
			expect(config).toContain(`"${excluded}"`);
		}
	});
});
