import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveSpeechSidecarExecutableV0 } from "./speechSidecarExecutableV0";

const root = path.resolve("private", "app");

describe("speech sidecar executable v0", () => {
	it("resolves the exact packaged Windows resource slot", () => {
		const exists = vi.fn(() => true);
		const canonicalize = vi.fn((candidate: string) => candidate);
		const resolved = resolveSpeechSidecarExecutableV0({
			isPackaged: true,
			resourcesPath: root,
			appPath: path.resolve("unused"),
			platform: "win32",
			arch: "x64",
			exists,
			canonicalize,
		});
		expect(resolved).toBe(
			path.join(root, "electron", "native", "bin", "win32-x64", "openscreen-speech-sidecar.exe"),
		);
		expect(exists).toHaveBeenCalledWith(resolved);
	});

	it("resolves host-tagged development slots without PATH lookup", () => {
		for (const [platform, arch, filename] of [
			["darwin", "arm64", "openscreen-speech-sidecar"],
			["linux", "x64", "openscreen-speech-sidecar"],
		] as const) {
			expect(
				resolveSpeechSidecarExecutableV0({
					isPackaged: false,
					resourcesPath: path.resolve("unused"),
					appPath: root,
					platform,
					arch,
					exists: () => true,
					canonicalize: (candidate) => candidate,
				}),
			).toBe(path.join(root, "electron", "native", "bin", `${platform}-${arch}`, filename));
		}
	});

	it("returns unavailable for missing or non-canonical resources", () => {
		const base = {
			isPackaged: false,
			resourcesPath: root,
			appPath: root,
			platform: "win32" as const,
			arch: "x64" as const,
		};
		expect(
			resolveSpeechSidecarExecutableV0({
				...base,
				exists: () => false,
				canonicalize: (candidate) => candidate,
			}),
		).toBeNull();
		expect(
			resolveSpeechSidecarExecutableV0({
				...base,
				exists: () => true,
				canonicalize: () => "relative.exe",
			}),
		).toBeNull();
	});
});
