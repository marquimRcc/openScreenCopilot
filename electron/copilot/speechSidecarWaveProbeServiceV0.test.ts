import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	probeSpeechSidecarWaveResourceV0,
	type SpeechSidecarWaveProbeRunV0,
} from "./speechSidecarWaveProbeServiceV0";

const appPath = path.resolve("app");
const resourcesPath = path.resolve("resources");
const wave = path.resolve("private", "sample.wav");
const executable = path.join(
	appPath,
	"electron",
	"native",
	"bin",
	"win32-x64",
	"openscreen-speech-sidecar.exe",
);

function options(exists: boolean) {
	return {
		executable: {
			isPackaged: false,
			resourcesPath,
			appPath,
			platform: "win32" as const,
			arch: "x64" as const,
			exists: () => exists,
			canonicalize: (candidate: string) => candidate,
		},
		authorizedWavePath: wave,
	};
}

describe("speech sidecar WAV probe service v0", () => {
	it("does not create a process when the staged resource is unavailable", async () => {
		const run = vi.fn<SpeechSidecarWaveProbeRunV0>();
		await expect(probeSpeechSidecarWaveResourceV0({ ...options(false), run })).resolves.toBeNull();
		expect(run).not.toHaveBeenCalled();
	});

	it("passes the resolved resource and caller-authorized WAV to the bounded runner", async () => {
		const result = {
			version: 0 as const,
			kind: "wave.normalized" as const,
			sourceRate: 16_000 as const,
			sampleRate: 16_000 as const,
			samples: "1600",
			availabilityDelayFrames: "0",
		};
		const run = vi.fn<SpeechSidecarWaveProbeRunV0>(async () => result);
		await expect(probeSpeechSidecarWaveResourceV0({ ...options(true), run })).resolves.toBe(result);
		expect(run).toHaveBeenCalledWith({
			authorizedExecutablePath: executable,
			authorizedWavePath: wave,
		});
	});
});
