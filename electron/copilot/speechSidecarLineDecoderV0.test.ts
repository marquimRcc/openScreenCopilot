import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SpeechSidecarLineDecoderV0, SpeechSidecarLineError } from "./speechSidecarLineDecoderV0";

const fixture = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/speech-sidecar.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { ready: object; completed: object };
const encode = (text: string) => new TextEncoder().encode(text);

describe("speech sidecar line decoder v0", () => {
	it("preserves the shared UTF-8 line across every byte split", () => {
		const expected = JSON.stringify(fixture.ready);
		const wire = encode(`${expected}\n`);
		for (let split = 0; split <= wire.length; split++) {
			const decoder = new SpeechSidecarLineDecoderV0(wire.length);
			expect(decoder.feed(wire.subarray(0, split))).toBe(split);
			if (split < wire.length) expect(decoder.feed(wire.subarray(split))).toBe(wire.length - split);
			expect(decoder.take()).toBe(expected);
			decoder.finish();
			expect(decoder.counts).toEqual({ receivedBytes: BigInt(wire.length), messages: 1n });
		}
	});

	it("consumes only one coalesced message until take releases backpressure", () => {
		const first = JSON.stringify(fixture.ready);
		const second = JSON.stringify(fixture.completed);
		const wire = encode(`${first}\r\n${second}\n`);
		const decoder = new SpeechSidecarLineDecoderV0(wire.length);
		const used = decoder.feed(wire);
		expect(used).toBe(encode(`${first}\r\n`).length);
		expect(() => decoder.feed(wire.subarray(used))).toThrow("speech-sidecar-line-v0:busy");
		expect(decoder.take()).toBe(first);
		expect(decoder.feed(wire.subarray(used))).toBe(wire.length - used);
		expect(decoder.take()).toBe(second);
	});

	it("fails closed on capacity, invalid UTF-8, empty and truncated lines", () => {
		const cases: Array<[Uint8Array, string]> = [
			[encode("abc"), "capacity"],
			[new Uint8Array([0xff, 10]), "utf8"],
			[encode("\r\n"), "empty"],
		];
		for (const [wire, code] of cases) {
			const decoder = new SpeechSidecarLineDecoderV0(2);
			expect(() => decoder.feed(wire)).toThrow(`speech-sidecar-line-v0:${code}`);
			expect(decoder.closed).toBe(true);
			expect(() => decoder.feed(new Uint8Array())).toThrow(SpeechSidecarLineError);
		}
		const truncated = new SpeechSidecarLineDecoderV0(4);
		truncated.feed(encode("a"));
		expect(() => truncated.finish()).toThrow("speech-sidecar-line-v0:truncated");
	});

	it("validates limits and wipes ownership on stop/take", () => {
		for (const limit of [0, -1, 1.5, Number.MAX_SAFE_INTEGER])
			expect(() => new SpeechSidecarLineDecoderV0(limit)).toThrow(
				"speech-sidecar-line-v0:invalid-limit",
			);
		const decoder = new SpeechSidecarLineDecoderV0(4);
		decoder.feed(encode("x\n"));
		expect(decoder.take()).toBe("x");
		decoder.stop();
		expect(decoder.closed).toBe(true);
	});

	it("preserves a completed message across clean EOF", () => {
		const decoder = new SpeechSidecarLineDecoderV0(4);
		decoder.feed(encode("x\n"));
		decoder.finish();
		expect(decoder.closed).toBe(true);
		expect(decoder.take()).toBe("x");
	});
});
