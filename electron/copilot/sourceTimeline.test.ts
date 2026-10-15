import { describe, expect, it } from "vitest";
import fixture from "../../contracts/copilot/source-timeline.v0.fixture.json";
import { type DraftSourceSpan, mapDraftSourceRange } from "./sourceTimeline";

const span: DraftSourceSpan = {
	epoch: 0,
	rate: 48000,
	start: "0",
	end: "48000",
	mediaStartNs: "0",
};
const range = { epoch: 0, start: "0", end: "1" };

describe("draft source timeline arithmetic (not capture/ASR integration)", () => {
	it.each(fixture.cases)("shared fixture: $name", (test) => {
		const run = () => mapDraftSourceRange(fixture.spans, test);
		if (test.expectedError) expect(run).toThrow(test.expectedError);
		else expect(run()).toEqual({ startNs: test.expectedNs?.[0], endNs: test.expectedNs?.[1] });
	});
	it.each([
		"-1",
		"+1",
		"01",
		"1.0",
		"1e3",
		" 1",
		"1\n",
		"",
		"18446744073709551616",
		"9".repeat(1000),
	])("rejects noncanonical/out-of-u64 sample %j", (value) =>
		expect(() => mapDraftSourceRange([span], { ...range, end: value })).toThrow("invalid-u64"));
	it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects epoch %s", (value) => {
		expect(() => mapDraftSourceRange([span], { ...range, epoch: value })).toThrow("invalid-epoch");
	});
	it.each([NaN, Infinity, 0, -1, 0.5, 192001])("rejects rate %s", (rate) => {
		expect(() => mapDraftSourceRange([{ ...span, rate }], range)).toThrow("invalid-rate");
	});
	it("rejects empty/reversed ranges and spans", () => {
		for (const end of ["0", "1"]) {
			expect(() => mapDraftSourceRange([span], { ...range, start: "1", end })).toThrow(
				"invalid-range",
			);
			expect(() => mapDraftSourceRange([{ ...span, start: "1", end }], range)).toThrow(
				"invalid-span",
			);
		}
	});
	it("rejects ambiguous matches rather than choosing the first", () => {
		expect(() => mapDraftSourceRange([span, { ...span }], range)).toThrow("ambiguous-span");
	});
	it("rejects a partially overlapping second span in the queried interval", () => {
		expect(() =>
			mapDraftSourceRange([span, { ...span, start: "5" }], { ...range, end: "10" }),
		).toThrow("ambiguous-span");
	});
	it("rejects overflow even when the queried prefix would fit", () => {
		expect(() =>
			mapDraftSourceRange([{ ...span, mediaStartNs: "18446744073709551615" }], range),
		).toThrow("media-overflow");
	});
	it("does not accumulate rounding by chunk and leaves input untouched", () => {
		const spans = Object.freeze([Object.freeze({ ...span, rate: 44100, end: "44100" })]);
		let duration = 0n;
		for (let i = 0; i < 44100; i += 147) {
			const mapped = mapDraftSourceRange(spans, {
				epoch: 0,
				start: String(i),
				end: String(i + 147),
			});
			duration += BigInt(mapped.endNs) - BigInt(mapped.startNs);
		}
		expect(duration).toBe(1_000_000_000n);
		expect(spans[0].mediaStartNs).toBe("0");
	});
	it("keeps epochs independent and rejects missing spans", () => {
		expect(
			mapDraftSourceRange([span, { ...span, epoch: 1, mediaStartNs: "9000000000" }], range).startNs,
		).toBe("0");
		expect(() => mapDraftSourceRange([], range)).toThrow("no-single-span");
	});
});
