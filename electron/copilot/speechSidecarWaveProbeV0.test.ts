import { describe, expect, it } from "vitest";
import {
	parseSpeechSidecarWaveProbeV0,
	SpeechSidecarWaveProbeV0Error,
} from "./speechSidecarWaveProbeV0";

const valid = {
	version: 0,
	kind: "wave.normalized",
	sourceRate: 48_000,
	sampleRate: 16_000,
	samples: "32000",
	availabilityDelayFrames: "42",
};

describe("speech sidecar wave probe v0", () => {
	it("parses and freezes bounded normalization metadata", () => {
		const result = parseSpeechSidecarWaveProbeV0(JSON.stringify(valid));
		expect(result).toEqual(valid);
		expect(Object.isFrozen(result)).toBe(true);
	});

	it("rejects malformed, extra and incompatible metadata", () => {
		for (const line of [
			"not-json",
			JSON.stringify({ ...valid, extra: true }),
			JSON.stringify({ ...valid, version: 1 }),
			JSON.stringify({ ...valid, sampleRate: 44_100 }),
			JSON.stringify({ ...valid, sourceRate: 8_000 }),
		]) {
			expect(() => parseSpeechSidecarWaveProbeV0(line)).toThrow(SpeechSidecarWaveProbeV0Error);
		}
	});

	it("rejects noncanonical and over-budget counters", () => {
		for (const samples of ["", "01", "-1", "1048577", 1]) {
			expect(() => parseSpeechSidecarWaveProbeV0(JSON.stringify({ ...valid, samples }))).toThrow(
				"speech-sidecar-wave-probe-v0:range",
			);
		}
	});
});
