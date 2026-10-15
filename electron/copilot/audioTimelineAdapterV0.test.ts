import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AudioFrameV0Error } from "./audioFrameV0";
import { AudioTimelineAdapterV0Error, adaptAudioTimelineOriginV0 } from "./audioTimelineAdapterV0";
import { mapDraftSourceRange } from "./sourceTimeline";

const fixture = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/audio-frame.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { cases: { headerHex: string }[] };
const header = () => Uint8Array.from(Buffer.from(fixture.cases[0].headerHex, "hex"));

describe("isolated descriptor/timeline compatibility v0", () => {
	it("keeps counters above2^53 exact and maps only with caller-supplied origin", () => {
		const origin = adaptAudioTimelineOriginV0(header());
		expect(origin).toEqual({
			sessionNonceHex: "0102030405060708090a0b0c0d0e0f10",
			source: "system",
			sampleRate: 48000,
			range: { epoch: 7, start: "9007199254740993", end: "9007199254740995" },
		});
		expect(
			mapDraftSourceRange(
				[
					{
						...origin.range,
						rate: origin.sampleRate,
						mediaStartNs: "0",
					},
				],
				origin.range,
			),
		).toEqual({ startNs: "0", endNs: "41666" });
		// captureMonotonicNs=u64MAX in the fixture is deliberately not used as PTS.
	});
	it("admits safe epoch boundaries and refuses unsafe epochs before Number conversion", () => {
		for (const epoch of [0n, BigInt(Number.MAX_SAFE_INTEGER)]) {
			const bytes = header();
			new DataView(bytes.buffer).setBigUint64(40, epoch, true);
			expect(adaptAudioTimelineOriginV0(bytes).range.epoch).toBe(Number(epoch));
		}
		for (const epoch of [BigInt(Number.MAX_SAFE_INTEGER) + 1n, (1n << 64n) - 1n]) {
			const bytes = header();
			new DataView(bytes.buffer).setBigUint64(40, epoch, true);
			expect(() => adaptAudioTimelineOriginV0(bytes)).toThrow(AudioTimelineAdapterV0Error);
		}
	});
	it("snapshots byteOffset views and freezes nested metadata without retaining raw bytes", () => {
		const padded = new Uint8Array(100);
		padded.set(header(), 9);
		const origin = adaptAudioTimelineOriginV0(padded.subarray(9, 89));
		padded.fill(0);
		expect(origin.range.start).toBe("9007199254740993");
		expect(origin.sessionNonceHex).toBe("0102030405060708090a0b0c0d0e0f10");
		expect(Object.isFrozen(origin)).toBe(true);
		expect(Object.isFrozen(origin.range)).toBe(true);
	});
	it("reparses fixed raw header and preserves parser errors instead of coercing metadata", () => {
		for (const bytes of [new Uint8Array(79), new Uint8Array(80), new Uint8Array(81)]) {
			expect(() => adaptAudioTimelineOriginV0(bytes)).toThrow(AudioFrameV0Error);
		}
		const invalid = header();
		new DataView(invalid.buffer).setUint32(12, 0, true);
		expect(() => adaptAudioTimelineOriginV0(invalid)).toThrow(AudioFrameV0Error);
	});
	it("preserves mic/rate/discontinuity range without pretending to reset a clock map", () => {
		const bytes = header();
		const view = new DataView(bytes.buffer);
		bytes[19] = 2;
		view.setUint32(12, 44100, true);
		view.setUint32(20, 1, true);
		const origin = adaptAudioTimelineOriginV0(bytes);
		expect(origin.source).toBe("microphone");
		expect(origin.sampleRate).toBe(44100);
		expect(() => mapDraftSourceRange([], origin.range)).toThrow("no-single-span");
	});
});
