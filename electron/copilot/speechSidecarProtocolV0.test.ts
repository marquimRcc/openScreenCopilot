import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	parseSpeechSidecarV0Line,
	SpeechSidecarV0Error,
	SpeechSidecarV0Session,
} from "./speechSidecarProtocolV0";

const fixture = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/speech-sidecar.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { ready: object; completed: object };

describe("speech sidecar protocol v0 parser", () => {
	it("parses and freezes the shared Rust messages", () => {
		for (const message of [fixture.ready, fixture.completed]) {
			const parsed = parseSpeechSidecarV0Line(JSON.stringify(message));
			expect(parsed).toEqual(message);
			expect(Object.isFrozen(parsed)).toBe(true);
		}
	});

	it("rejects malformed, extra, incompatible and unsafe identity fields", () => {
		for (const value of [
			"not-json",
			JSON.stringify({ ...fixture.completed, extra: true }),
			JSON.stringify({ ...fixture.completed, version: 1 }),
			JSON.stringify({ ...fixture.completed, sessionId: "../private" }),
			JSON.stringify({ ...fixture.completed, seq: "00" }),
			JSON.stringify({ ...fixture.completed, seq: "18446744073709551616" }),
		]) {
			expect(() => parseSpeechSidecarV0Line(value)).toThrow(SpeechSidecarV0Error);
		}
	});

	it("does not accept a provider capability this binary cannot supply", () => {
		const ready = structuredClone(fixture.ready) as {
			capabilities: { providerAvailable: boolean };
		};
		ready.capabilities.providerAvailable = true;
		expect(() => parseSpeechSidecarV0Line(JSON.stringify(ready))).toThrow(
			"speech-sidecar-v0:schema",
		);
	});

	it("correlates ready and completed to one ordered host session", () => {
		const ready = parseSpeechSidecarV0Line(JSON.stringify(fixture.ready));
		const completed = parseSpeechSidecarV0Line(JSON.stringify(fixture.completed));
		const session = new SpeechSidecarV0Session("fixture_session", "0");
		session.accept(ready);
		expect(session.state).toBe("ready");
		session.expectShutdown("1");
		session.accept(completed);
		expect(session.state).toBe("completed");
		expect(() => session.accept(completed)).toThrow("speech-sidecar-v0:sequence");
	});

	it("rejects out-of-order, replayed and cross-session replies", () => {
		const completed = parseSpeechSidecarV0Line(JSON.stringify(fixture.completed));
		const session = new SpeechSidecarV0Session("fixture_session", "0");
		expect(() => session.accept(completed)).toThrow("speech-sidecar-v0:sequence");
		const other = parseSpeechSidecarV0Line(
			JSON.stringify({ ...fixture.ready, sessionId: "other_session" }),
		);
		expect(() => session.accept(other)).toThrow("speech-sidecar-v0:identity");
	});
});
