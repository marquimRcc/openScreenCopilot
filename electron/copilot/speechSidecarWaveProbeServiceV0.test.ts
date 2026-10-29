import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const probeResult = {
	version: 0 as const,
	kind: "wave.normalized" as const,
	sourceRate: 16_000 as const,
	sampleRate: 16_000 as const,
	samples: "1600",
	availabilityDelayFrames: "0",
	activityGate: "energy-rms-diagnostic-v0" as const,
	activityFrameSamples: 160 as const,
	activityFrames: "10",
	activityStarts: "0",
	activityStops: "0",
	activityTailSamples: 0,
	activityAtEnd: false,
};

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

	it("does not run when the staged resource canonicalizes outside its slot", async () => {
		const run = vi.fn<SpeechSidecarWaveProbeRunV0>();
		const escaped = path.resolve("private", "escaped.exe");
		const unsafe = options(true);
		unsafe.executable.canonicalize = (candidate: string) =>
			candidate.endsWith("openscreen-speech-sidecar.exe") ? escaped : candidate;
		await expect(probeSpeechSidecarWaveResourceV0({ ...unsafe, run })).resolves.toBeNull();
		expect(run).not.toHaveBeenCalled();
	});

	it("revalidates executable containment immediately before the real runner", async () => {
		const exec = vi.fn();
		let executableChecks = 0;
		const changed = options(true);
		changed.executable.canonicalize = (candidate: string) => {
			if (!candidate.endsWith("openscreen-speech-sidecar.exe")) return candidate;
			executableChecks += 1;
			return executableChecks === 1 ? candidate : path.resolve("private", "escaped.exe");
		};
		await expect(probeSpeechSidecarWaveResourceV0({ ...changed, exec })).rejects.toThrow(
			"speech-sidecar-wave-probe-runner-v0:path",
		);
		expect(exec).not.toHaveBeenCalled();
	});

	it("passes the resolved resource and caller-authorized WAV to the bounded runner", async () => {
		const run = vi.fn<SpeechSidecarWaveProbeRunV0>(async () => probeResult);
		await expect(probeSpeechSidecarWaveResourceV0({ ...options(true), run })).resolves.toBe(
			probeResult,
		);
		expect(run).toHaveBeenCalledWith({
			authorizedExecutablePath: executable,
			authorizedWavePath: wave,
		});
	});

	it("runs the bounded parser path after successful resource revalidation", async () => {
		const directory = mkdtempSync(path.join(tmpdir(), "openscreen-probe-service-"));
		const authorizedWavePath = path.join(directory, "audio.wav");
		writeFileSync(authorizedWavePath, "fixture");
		const exec = vi.fn(async () => `${JSON.stringify(probeResult)}\n`);
		try {
			await expect(
				probeSpeechSidecarWaveResourceV0({
					...options(true),
					authorizedWavePath,
					exec,
				}),
			).resolves.toEqual(probeResult);
			expect(exec).toHaveBeenCalledWith(executable, ["--probe-wave", authorizedWavePath], {
				timeout: 5_000,
				maxBuffer: 4_096,
				windowsHide: true,
				shell: false,
			});
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
