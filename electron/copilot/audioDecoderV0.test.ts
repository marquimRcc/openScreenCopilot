import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AudioDecoderV0, AudioDecoderV0Error, type ExpectedAudioStreamV0 } from "./audioDecoderV0";
import { AUDIO_FRAME_MAX_PAYLOAD_BYTES, parseAudioFrameV0Header } from "./audioFrameV0";

const json = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/audio-frame.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { cases: { headerHex: string; payloadHex?: string }[] };
const frame = Uint8Array.from(
	Buffer.from(json.cases[0].headerHex + json.cases[0].payloadHex, "hex"),
);
function expected(bytes = frame): ExpectedAudioStreamV0 {
	const h = parseAudioFrameV0Header(bytes.subarray(0, 80));
	return {
		nonceHex: h.sessionNonceHex,
		source: h.source,
		epoch: h.epoch,
		sampleRate: h.sampleRate,
		channels: h.channels,
		firstSequence: h.sequence,
		firstSampleStart: h.sampleStart,
		maxPayloadBytes: AUDIO_FRAME_MAX_PAYLOAD_BYTES,
	};
}
function feedAll(decoder: AudioDecoderV0, bytes: Uint8Array): void {
	for (let at = 0; at < bytes.length; ) {
		const used = decoder.feed(bytes.subarray(at));
		expect(used).toBeGreaterThan(0);
		at += used;
	}
}
function errorCode(run: () => unknown): string | undefined {
	try {
		run();
	} catch (error) {
		if (error instanceof AudioDecoderV0Error)
			return `${error.code}${error.frameCode ? `:${error.frameCode}` : ""}`;
		throw error;
	}
	return undefined;
}

describe("audio decoder v0, isolated incremental reader", () => {
	it("admits the exact payload cap and releases only its own buffer on handoff", () => {
		const header = frame.subarray(0, 80).slice();
		const view = new DataView(header.buffer);
		view.setUint32(8, AUDIO_FRAME_MAX_PAYLOAD_BYTES, true);
		view.setUint32(64, AUDIO_FRAME_MAX_PAYLOAD_BYTES / 8, true);
		const decoder = new AudioDecoderV0(expected(header));
		expect(decoder.feed(header)).toBe(80);
		expect(decoder.ownedBufferBytes).toBe(AUDIO_FRAME_MAX_PAYLOAD_BYTES + 160);
		expect(decoder.feed(new Uint8Array(AUDIO_FRAME_MAX_PAYLOAD_BYTES))).toBe(
			AUDIO_FRAME_MAX_PAYLOAD_BYTES,
		);
		const owned = decoder.take();
		expect(owned?.bytes.length).toBe(AUDIO_FRAME_MAX_PAYLOAD_BYTES + 80);
		expect(decoder.ownedBufferBytes).toBe(80);
		decoder.finish();
	});
	it("consumes coalesced frames one at a time without internal queue", () => {
		const next = frame.slice();
		const h = parseAudioFrameV0Header(frame.subarray(0, 80));
		const view = new DataView(next.buffer);
		view.setBigUint64(48, BigInt(h.sequence) + 1n, true);
		view.setBigUint64(56, BigInt(h.sampleEnd), true);
		const joined = new Uint8Array(frame.length + next.length);
		joined.set(frame);
		joined.set(next, frame.length);
		const decoder = new AudioDecoderV0(expected());
		let at = 0;
		let count = 0;
		while (at < joined.length) {
			const used = decoder.feed(joined.subarray(at));
			expect(used).toBeGreaterThan(0);
			at += used;
			expect(decoder.ownedBufferBytes).toBeLessThanOrEqual(176);
			const ready = decoder.take();
			if (ready) {
				expect(ready.bytes).toEqual(count === 0 ? frame : next);
				count++;
			}
		}
		expect(count).toBe(2);
		decoder.finish();
	});
	it("preserves frame for every packet size and bounds owned buffers", () => {
		for (let size = 1; size <= frame.length + 1; size++) {
			const decoder = new AudioDecoderV0(expected());
			for (let at = 0; at < frame.length; at += size) {
				feedAll(decoder, frame.subarray(at, at + size));
				expect(decoder.ownedBufferBytes).toBeLessThanOrEqual(176);
			}
			expect(decoder.isReady).toBe(true);
			decoder.finish();
			expect(decoder.take()?.bytes).toEqual(frame);
			expect(decoder.ownedBufferBytes).toBe(80);
			expect(decoder.isClosed).toBe(true);
		}
	});
	it("detects every partial EOF and seals the stream without padding", () => {
		for (let end = 0; end < frame.length; end++) {
			const decoder = new AudioDecoderV0(expected());
			feedAll(decoder, frame.subarray(0, end));
			expect(errorCode(() => decoder.finish())).toBe(end === 0 ? undefined : "truncated");
			expect(errorCode(() => decoder.feed(frame))).toBe("closed");
			expect(decoder.take()).toBeUndefined();
			expect(decoder.ownedBufferBytes).toBe(80);
		}
	});
	it("rejects binding, order, cap and malformed header before payload allocation", () => {
		const variants: [Partial<ExpectedAudioStreamV0>, string][] = [
			[{ nonceHex: "1102030405060708090a0b0c0d0e0f10" }, "binding"],
			[{ source: "microphone" }, "binding"],
			[{ epoch: "8" }, "binding"],
			[{ sampleRate: 44100 }, "binding"],
			[{ channels: 1 }, "binding"],
			[{ firstSequence: "9007199254740994" }, "order"],
			[{ firstSampleStart: "9007199254740994" }, "order"],
			[{ maxPayloadBytes: 4 }, "budget"],
		];
		for (const [patch, code] of variants) {
			const decoder = new AudioDecoderV0({ ...expected(), ...patch });
			expect(errorCode(() => decoder.feed(frame))).toBe(code);
			expect(decoder.ownedBufferBytes).toBe(80);
			expect(decoder.isClosed).toBe(true);
		}
		const decoder = new AudioDecoderV0(expected());
		const huge = frame.slice();
		new DataView(huge.buffer).setUint32(8, 0xffffffff, true);
		expect(errorCode(() => decoder.feed(huge))).toBe("frame:limits");
		expect(decoder.ownedBufferBytes).toBe(80);
	});
	it("snapshot expectations and copied input cannot be changed by previous owners", () => {
		const original = { ...expected() };
		const decoder = new AudioDecoderV0(original);
		original.epoch = "99";
		const input = frame.slice();
		feedAll(decoder, input);
		input.fill(0);
		expect(decoder.take()?.bytes).toEqual(frame);
	});
	it("blocks admission until handoff and requires exact next sequence/start", () => {
		const decoder = new AudioDecoderV0(expected());
		feedAll(decoder, frame);
		expect(errorCode(() => decoder.feed(frame))).toBe("busy");
		expect(decoder.take()).toBeDefined();
		const next = frame.slice();
		const h = parseAudioFrameV0Header(next.subarray(0, 80));
		const view = new DataView(next.buffer);
		view.setBigUint64(48, BigInt(h.sequence) + 1n, true);
		view.setBigUint64(56, BigInt(h.sampleEnd), true);
		feedAll(decoder, next);
		expect(decoder.take()?.bytes).toEqual(next);
		expect(errorCode(() => decoder.feed(frame))).toBe("order");
		expect(decoder.isClosed).toBe(true);
	});
	it("poisons bad scalars and stop never retracts handed ownership", () => {
		const bad = frame.slice();
		new DataView(bad.buffer).setFloat32(80, Number.NaN, true);
		const decoder = new AudioDecoderV0(expected());
		expect(errorCode(() => feedAll(decoder, bad))).toBe("frame:non-finite");
		expect(errorCode(() => decoder.feed(frame))).toBe("closed");
		for (const at of [1, 80, 85, 96]) {
			const stopped = new AudioDecoderV0(expected());
			feedAll(stopped, frame.subarray(0, at));
			stopped.stop();
			stopped.stop();
			expect(stopped.take()).toBeUndefined();
			expect(stopped.ownedBufferBytes).toBe(80);
		}
		const handed = new AudioDecoderV0(expected());
		feedAll(handed, frame);
		const owned = handed.take();
		handed.stop();
		expect(owned?.bytes).toEqual(frame);
	});
	it("does not wrap sequence and rejects invalid expectations", () => {
		const last = frame.slice();
		new DataView(last.buffer).setBigUint64(48, (1n << 64n) - 1n, true);
		const decoder = new AudioDecoderV0(expected(last));
		feedAll(decoder, last);
		decoder.take();
		expect(errorCode(() => decoder.feed(last))).toBe("sequence-exhausted");
		for (const patch of [
			{ epoch: "01" },
			{ epoch: "18446744073709551616" },
			{ firstSequence: "-1" },
			{ firstSampleStart: "1.0" },
			{ nonceHex: "0".repeat(32) },
			{ sampleRate: 0 },
			{ channels: 33 },
			{ maxPayloadBytes: 0 },
			{ maxPayloadBytes: AUDIO_FRAME_MAX_PAYLOAD_BYTES + 1 },
		])
			expect(errorCode(() => new AudioDecoderV0({ ...expected(), ...patch }))).toBe(
				"invalid-expectation",
			);
	});
	it("allocation failure is terminal and sanitized without forcing OOM", () => {
		const decoder = new AudioDecoderV0(expected());
		const Original = Uint8Array;
		try {
			vi.stubGlobal(
				"Uint8Array",
				class extends Original {
					constructor() {
						super(0);
						throw new RangeError("synthetic allocation refusal");
					}
				},
			);
			expect(errorCode(() => decoder.feed(frame))).toBe("allocation");
			expect(decoder.isClosed).toBe(true);
			expect(decoder.ownedBufferBytes).toBe(80);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
