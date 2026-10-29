import { describe, expect, it } from "vitest";
import { cleanupWav, writeSamplesAsWav } from "../stt/wav";
import { runSpeechSidecarWaveProbeV0 } from "./speechSidecarWaveProbeRunnerV0";

const executable = process.env.OPENSCREEN_SPEECH_SIDECAR_V0;

describe.runIf(executable)("speech sidecar WAV probe v0 process integration", () => {
	it("normalizes a host-authorized WAV through the real Rust process", async () => {
		const samples = new Float32Array(1_600);
		for (let index = 0; index < samples.length; index++) {
			samples[index] = Math.sin((2 * Math.PI * 440 * index) / 16_000) * 0.25;
		}
		const wave = await writeSamplesAsWav(samples);
		try {
			const result = await runSpeechSidecarWaveProbeV0({
				authorizedExecutablePath: executable!,
				authorizedWavePath: wave,
			});
			expect(result).toEqual({
				version: 0,
				kind: "wave.normalized",
				sourceRate: 16_000,
				sampleRate: 16_000,
				samples: "1600",
				availabilityDelayFrames: "0",
			});
		} finally {
			await cleanupWav(wave);
		}
	});
});
