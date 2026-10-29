import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	runSpeechSidecarWaveProbeV0,
	type SpeechSidecarWaveProbeExecV0,
	SpeechSidecarWaveProbeRunnerV0Error,
} from "./speechSidecarWaveProbeRunnerV0";

const executable = path.resolve("private", "openscreen-speech-sidecar.exe");
const wave = path.resolve("private", "sample.wav");
const output = JSON.stringify({
	version: 0,
	kind: "wave.normalized",
	sourceRate: 48_000,
	sampleRate: 16_000,
	samples: "32000",
	availabilityDelayFrames: "42",
});

describe("speech sidecar wave probe runner v0", () => {
	it("runs one canonical path pair without shell and parses bounded output", async () => {
		const exec = vi.fn<SpeechSidecarWaveProbeExecV0>(async () => `${output}\n`);
		const result = await runSpeechSidecarWaveProbeV0({
			authorizedExecutablePath: executable,
			authorizedWavePath: wave,
			canonicalize: (candidate) => candidate,
			exec,
		});
		expect(result.samples).toBe("32000");
		expect(exec).toHaveBeenCalledWith(executable, ["--probe-wave", wave], {
			timeout: 5_000,
			maxBuffer: 4_096,
			windowsHide: true,
			shell: false,
		});
	});

	it("rejects unauthorized paths before process creation", async () => {
		const exec = vi.fn<SpeechSidecarWaveProbeExecV0>();
		await expect(
			runSpeechSidecarWaveProbeV0({
				authorizedExecutablePath: "sidecar.exe",
				authorizedWavePath: wave,
				exec,
			}),
		).rejects.toBeInstanceOf(SpeechSidecarWaveProbeRunnerV0Error);
		expect(exec).not.toHaveBeenCalled();
	});

	it("maps process and multi-line output failures to stable codes", async () => {
		const base = {
			authorizedExecutablePath: executable,
			authorizedWavePath: wave,
			canonicalize: (candidate: string) => candidate,
		};
		await expect(
			runSpeechSidecarWaveProbeV0({ ...base, exec: async () => Promise.reject(new Error("fail")) }),
		).rejects.toThrow("speech-sidecar-wave-probe-runner-v0:process");
		await expect(
			runSpeechSidecarWaveProbeV0({ ...base, exec: async () => `${output}\n${output}\n` }),
		).rejects.toThrow("speech-sidecar-wave-probe-runner-v0:output");
	});
});
