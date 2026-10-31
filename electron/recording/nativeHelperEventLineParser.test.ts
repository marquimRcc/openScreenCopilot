import { describe, expect, it, vi } from "vitest";
import { createNativeHelperEventLineParser } from "./nativeHelperEventLineParser";

const parse = (line: string) => {
	try {
		const value: unknown = JSON.parse(line);
		return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
	} catch {
		return null;
	}
};

describe("native helper event line parser", () => {
	it("reassembles split events and parses complete events in order", () => {
		const onEvent = vi.fn();
		const push = createNativeHelperEventLineParser(parse, onEvent);

		push('{"event":"one"');
		push('}\r\nnoise\n{"event":"two"}\n');

		expect(onEvent.mock.calls.map(([event]) => event.event)).toEqual(["one", "two"]);
	});

	it("drops an oversized unterminated line through its newline and then recovers", () => {
		const onEvent = vi.fn();
		const push = createNativeHelperEventLineParser(parse, onEvent);

		push("x".repeat(64 * 1024 + 1));
		push('tail\n{"event":"recovered"}\n');

		expect(onEvent).toHaveBeenCalledOnce();
		expect(onEvent).toHaveBeenCalledWith({ event: "recovered" });
	});

	it("drops an oversized complete line without hiding the next event", () => {
		const onEvent = vi.fn();
		const push = createNativeHelperEventLineParser(parse, onEvent);

		push(`${"x".repeat(64 * 1024 + 1)}\n{"event":"next"}\n`);

		expect(onEvent).toHaveBeenCalledWith({ event: "next" });
	});
});
