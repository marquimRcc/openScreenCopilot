import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	AUDIO_FRAME_HEADER_BYTES,
	AUDIO_FRAME_MAX_PAYLOAD_BYTES,
	AudioFrameV0Error,
	type AudioFrameV0ErrorCode,
	type AudioFrameV0Header,
	parseAudioFrameV0Header,
	validateAudioFrameV0,
} from "./audioFrameV0";

interface Case {
	name: string;
	headerHex: string;
	payloadHex?: string;
	headerError?: AudioFrameV0ErrorCode;
	frameError?: AudioFrameV0ErrorCode;
	expected?: AudioFrameV0Header;
}
const fixture = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/audio-frame.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { cases: Case[] };
const hex = (text: string) => Uint8Array.from(Buffer.from(text, "hex"));
function code(run: () => unknown): AudioFrameV0ErrorCode | undefined {
	try {
		run();
	} catch (error) {
		if (error instanceof AudioFrameV0Error) return error.code;
		throw error;
	}
	return undefined;
}
function complete(header: Uint8Array, payload: Uint8Array): Uint8Array {
	const result = new Uint8Array(header.length + payload.length);
	result.set(header);
	result.set(payload, header.length);
	return result;
}

describe("audio frame draft v0 (isolated)", () => {
	for (const entry of fixture.cases) {
		it(`shares Rust fixture: ${entry.name}`, () => {
			const header = hex(entry.headerHex);
			if (entry.headerError) {
				expect(code(() => parseAudioFrameV0Header(header))).toBe(entry.headerError);
				return;
			}
			expect(parseAudioFrameV0Header(header)).toEqual(entry.expected);
			const bytes = complete(header, hex(entry.payloadHex ?? ""));
			if (entry.frameError) expect(code(() => validateAudioFrameV0(bytes))).toBe(entry.frameError);
			else expect(validateAudioFrameV0(bytes)).toEqual(entry.expected);
		});
	}
	it("rejects every incomplete length and oversized header", () => {
		for (let length = 0; length < AUDIO_FRAME_HEADER_BYTES; length++)
			expect(code(() => parseAudioFrameV0Header(new Uint8Array(length)))).toBe("length");
		expect(code(() => parseAudioFrameV0Header(new Uint8Array(81)))).toBe("length");
	});
	it("honors byteOffset and snapshots metadata without retaining the nonce view", () => {
		const padded = new Uint8Array(100);
		padded.set(hex(fixture.cases[0].headerHex), 9);
		const view = padded.subarray(9, 89);
		const parsed = parseAudioFrameV0Header(view);
		expect(parsed).toEqual(fixture.cases[0].expected);
		expect(Object.isFrozen(parsed)).toBe(true);
		view.fill(0, 24, 40);
		expect(parsed.sessionNonceHex).toBe("0102030405060708090a0b0c0d0e0f10");
		expect(code(() => parseAudioFrameV0Header(view))).toBe("schema");
	});
	it("admits exact scalar cap but requires actual payload and rejects cap+one", () => {
		const header = hex(fixture.cases[0].headerHex);
		const view = new DataView(header.buffer);
		view.setUint32(8, AUDIO_FRAME_MAX_PAYLOAD_BYTES, true);
		view.setUint16(16, 1, true);
		view.setUint32(64, AUDIO_FRAME_MAX_PAYLOAD_BYTES / 4, true);
		expect(parseAudioFrameV0Header(header).payloadBytes).toBe(AUDIO_FRAME_MAX_PAYLOAD_BYTES);
		expect(code(() => validateAudioFrameV0(header))).toBe("payload");
		expect(
			validateAudioFrameV0(complete(header, new Uint8Array(AUDIO_FRAME_MAX_PAYLOAD_BYTES)))
				.frameCount,
		).toBe(AUDIO_FRAME_MAX_PAYLOAD_BYTES / 4);
		view.setUint32(64, AUDIO_FRAME_MAX_PAYLOAD_BYTES / 4 + 1, true);
		expect(code(() => parseAudioFrameV0Header(header))).toBe("limits");
	});
	it("accepts finite amplitudes outside unit range without clipping", () => {
		const bytes = complete(hex(fixture.cases[0].headerHex), new Uint8Array(16));
		const view = new DataView(bytes.buffer);
		view.setUint32(80, 0x7f7fffff, true);
		view.setUint32(84, 0xff7fffff, true);
		expect(validateAudioFrameV0(bytes)).toEqual(fixture.cases[0].expected);
	});
});
