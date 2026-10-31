import { describe, expect, it } from "vitest";
import { BoundedRetainedText } from "./boundedRetainedText";

describe("BoundedRetainedText", () => {
	it("retains no more than the inclusive ceiling across many chunks", () => {
		const output = new BoundedRetainedText(128);

		for (let index = 0; index < 10_000; index += 1) {
			output.append(`${index}: helper output\n`);
			expect(output.value().length).toBeLessThanOrEqual(128);
		}
	});

	it("does not retain a giant chunk in full", () => {
		const output = new BoundedRetainedText(96);
		output.append("x".repeat(1_000_000));

		expect(output.value()).toHaveLength(96);
		expect(output.value()).toContain("helper output truncated");
	});

	it("keeps a fixed prefix, the marker, and the latest suffix after truncation", () => {
		const output = new BoundedRetainedText(192);
		output.append('{"event":"encoder-selection","encoder":"hardware"}\nRecording started\n');
		output.append("middle".repeat(100));
		output.append("[stop-timing] step=finalize elapsed_ms=8\n");

		const retained = output.value();
		expect(retained).toHaveLength(192);
		expect(retained).toContain('"event":"encoder-selection"');
		expect(retained).toContain("Recording started");
		expect(retained).toContain("helper output truncated");
		expect(retained).toContain("[stop-timing] step=finalize elapsed_ms=8");
	});

	it("keeps stable prefix and value reads after truncation", () => {
		const output = new BoundedRetainedText(80);
		output.append("prefix:" + "a".repeat(100));
		const first = output.value();

		expect(output.value()).toBe(first);
		output.append("");
		expect(output.value()).toBe(first);
		output.append("new tail");
		expect(output.value()).toMatch(/^prefix:/);
		expect(output.value()).toMatch(/new tail$/);
	});

	it("counts JavaScript UTF-16 code units rather than Unicode code points", () => {
		const output = new BoundedRetainedText(48);
		output.append("🙂".repeat(30));

		expect("🙂").toHaveLength(2);
		expect(output.value()).toHaveLength(48);
	});

	it("can be reset for a new helper", () => {
		const output = new BoundedRetainedText(64);
		output.append("old".repeat(100));
		output.reset();
		output.append("Recording started\n");

		expect(output.value()).toBe("Recording started\n");
	});
});
