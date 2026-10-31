import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	encodeSpeechSidecarV0Hello,
	encodeSpeechSidecarV0Shutdown,
	nextSpeechSidecarV0Sequence,
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
	it("increments canonical sequences without crossing u64", () => {
		expect(nextSpeechSidecarV0Sequence("0")).toBe("1");
		expect(nextSpeechSidecarV0Sequence("18446744073709551614")).toBe("18446744073709551615");
		expect(() => nextSpeechSidecarV0Sequence("18446744073709551615")).toThrow(
			"speech-sidecar-v0:sequence",
		);
	});

	it("encodes the exact bounded host hello and shutdown wire messages", () => {
		expect(
			encodeSpeechSidecarV0Hello({
				sessionId: "fixture_session",
				nonce: "fixture_nonce",
				seq: "0",
			}),
		).toBe(
			'{"type":"hello","version":0,"sessionId":"fixture_session","nonce":"fixture_nonce","seq":"0"}\n',
		);
		expect(
			encodeSpeechSidecarV0Shutdown({
				sessionId: "fixture_session",
				nonce: "fixture_nonce",
				seq: "18446744073709551615",
			}),
		).toContain('"type":"shutdown"');
	});

	it("rejects unsafe host identity and sequence before serialization", () => {
		for (const value of [
			{ sessionId: "../private", nonce: "nonce", seq: "0" },
			{ sessionId: "session", nonce: "", seq: "0" },
			{ sessionId: "session", nonce: "nonce", seq: "00" },
			{ sessionId: "session", nonce: "nonce", seq: "18446744073709551616" },
		]) {
			expect(() => encodeSpeechSidecarV0Hello(value)).toThrow(SpeechSidecarV0Error);
		}
	});

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
