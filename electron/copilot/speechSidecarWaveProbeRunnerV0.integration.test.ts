import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupWav, writeSamplesAsWav } from "../stt/wav";
import { runSpeechSidecarWaveProbeV0 } from "./speechSidecarWaveProbeRunnerV0";

const executable = process.env.OPENSCREEN_SPEECH_SIDECAR_V0;

async function writePcm16Wave(sampleRate: number, sampleCount: number): Promise<string> {
	const dataBytes = sampleCount * 2;
	const wave = Buffer.alloc(44 + dataBytes);
	wave.write("RIFF", 0);
	wave.writeUInt32LE(36 + dataBytes, 4);
	wave.write("WAVEfmt ", 8);
	wave.writeUInt32LE(16, 16);
	wave.writeUInt16LE(1, 20);
	wave.writeUInt16LE(1, 22);
	wave.writeUInt32LE(sampleRate, 24);
	wave.writeUInt32LE(sampleRate * 2, 28);
	wave.writeUInt16LE(2, 32);
	wave.writeUInt16LE(16, 34);
	wave.write("data", 36);
	wave.writeUInt32LE(dataBytes, 40);
	const directory = await mkdtemp(path.join(tmpdir(), "openscreen-probe-integration-"));
	const filename = path.join(directory, "audio.wav");
	await writeFile(filename, wave);
	return filename;
}

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

	it("crosses the real 48 kHz resampling boundary", async () => {
		const wave = await writePcm16Wave(48_000, 4_800);
		try {
			const result = await runSpeechSidecarWaveProbeV0({
				authorizedExecutablePath: executable!,
				authorizedWavePath: wave,
			});
			expect(result.sourceRate).toBe(48_000);
			expect(result.sampleRate).toBe(16_000);
			expect(result.samples).toBe("1600");
			expect(Number(result.availabilityDelayFrames)).toBeGreaterThan(0);
		} finally {
			await cleanupWav(wave);
		}
	});
});
