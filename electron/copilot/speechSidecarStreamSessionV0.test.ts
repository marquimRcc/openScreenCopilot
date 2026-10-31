import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SpeechSidecarV0Message } from "./speechSidecarProtocolV0";
import {
	SpeechSidecarStreamSessionV0,
	SpeechSidecarStreamV0Error,
} from "./speechSidecarStreamSessionV0";

const fixture = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/speech-sidecar.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { ready: object; completed: object };
const encode = (text: string) => new TextEncoder().encode(text);
const identity = {
	sessionId: "fixture_session",
	nonce: "fixture_nonce",
	helloSeq: "0",
} as const;

describe("speech sidecar stream session v0", () => {
	const ignoreMessage = (_message: SpeechSidecarV0Message) => undefined;

	it("drives an exact hello/ready/shutdown/completed session across byte splits", () => {
		const ready = encode(`${JSON.stringify(fixture.ready)}\n`);
		for (let split = 0; split <= ready.length; split++) {
			const messages: SpeechSidecarV0Message[] = [];
			const session = new SpeechSidecarStreamSessionV0(identity);
			expect(session.hello()).toContain('"type":"hello"');
			session.receive(ready.subarray(0, split), (message) => messages.push(message));
			session.receive(ready.subarray(split), (message) => messages.push(message));
			expect(session.state).toBe("ready");
			expect(session.shutdown("1")).toContain('"type":"shutdown"');
			session.receive(encode(`${JSON.stringify(fixture.completed)}\n`), (message) =>
				messages.push(message),
			);
			session.finish();
			expect(session.state).toBe("ended");
			expect(messages).toEqual([fixture.ready, fixture.completed]);
		}
	});

	it("handles coalesced lines without retaining a message queue", () => {
		const session = new SpeechSidecarStreamSessionV0(identity);
		session.hello();
		const seen: string[] = [];
		const ready = `${JSON.stringify(fixture.ready)}\n`;
		expect(session.receive(encode(ready), (message) => seen.push(message.type))).toBe(
			encode(ready).length,
		);
		session.shutdown("1");
		const completed = `${JSON.stringify(fixture.completed)}\n`;
		session.receive(encode(completed), (message) => seen.push(message.type));
		expect(seen).toEqual(["ready", "completed"]);
	});

	it("fails closed on invalid ordering and premature EOF", () => {
		const beforeHello = new SpeechSidecarStreamSessionV0(identity);
		expect(() => beforeHello.receive(new Uint8Array(), ignoreMessage)).toThrow(
			SpeechSidecarStreamV0Error,
		);

		const premature = new SpeechSidecarStreamSessionV0(identity);
		premature.hello();
		expect(() => premature.finish()).toThrow("speech-sidecar-stream-v0:unexpected-eof");

		const outOfOrder = new SpeechSidecarStreamSessionV0(identity);
		outOfOrder.hello();
		expect(() =>
			outOfOrder.receive(encode(`${JSON.stringify(fixture.completed)}\n`), ignoreMessage),
		).toThrow("speech-sidecar-v0:sequence");
		expect(outOfOrder.state).toBe("ended");
	});

	it("validates all outbound identity before returning hello", () => {
		expect(
			() =>
				new SpeechSidecarStreamSessionV0({
					...identity,
					nonce: "../unsafe",
				}),
		).toThrow("speech-sidecar-v0:identity");
	});
});
