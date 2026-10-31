import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSpeechSidecar, speechSidecarLayout } from "./build-speech-sidecar.mjs";

const roots = [];
afterEach(() => {
	for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("build speech sidecar", () => {
	it("maps supported hosts to the exact packaged resource slot", () => {
		const root = path.resolve("repo");
		expect(speechSidecarLayout({ root, platform: "win32", arch: "x64" }).staged).toBe(
			path.join(root, "electron", "native", "bin", "win32-x64", "openscreen-speech-sidecar.exe"),
		);
		expect(speechSidecarLayout({ root, platform: "linux", arch: "arm64" }).staged).toBe(
			path.join(root, "electron", "native", "bin", "linux-arm64", "openscreen-speech-sidecar"),
		);
		expect(() => speechSidecarLayout({ root, platform: "aix", arch: "x64" })).toThrow();
	});

	it("uses locked offline release build and copies only its executable", () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "speech-sidecar-build-"));
		roots.push(root);
		const layout = speechSidecarLayout({ root, platform: "win32", arch: "x64" });
		const run = vi.fn((_command, args) => {
			expect(args).toContain("--offline");
			expect(args).toContain("--locked");
			expect(args).toContain("--release");
			fs.mkdirSync(path.dirname(layout.built), { recursive: true });
			fs.writeFileSync(layout.built, "binary");
		});
		expect(buildSpeechSidecar({ root, platform: "win32", arch: "x64", run })).toBe(layout.staged);
		expect(fs.readFileSync(layout.staged, "utf8")).toBe("binary");
		expect(run).toHaveBeenCalledOnce();
	});
});
