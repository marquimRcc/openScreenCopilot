import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
	SpeechSidecarHostControllerV0,
	type SpeechSidecarHostScheduleV0,
	SpeechSidecarHostV0Error,
} from "./speechSidecarHostControllerV0";

const fixture = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/speech-sidecar.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { ready: object; completed: object };
const encode = (value: object) => new TextEncoder().encode(`${JSON.stringify(value)}\n`);

function harness() {
	let deadline: (() => void) | undefined;
	const cancel = vi.fn();
	const schedule: SpeechSidecarHostScheduleV0 = (_milliseconds, callback) => {
		deadline = callback;
		return cancel;
	};
	const write = vi.fn<(line: string) => void>();
	const abort = vi.fn();
	const host = new SpeechSidecarHostControllerV0({
		identity: { sessionId: "fixture_session", nonce: "fixture_nonce", helloSeq: "0" },
		handshakeTimeoutMs: 100,
		shutdownTimeoutMs: 200,
		write,
		abort,
		schedule,
	});
	return { host, write, abort, cancel, fireDeadline: () => deadline?.() };
}

describe("speech sidecar host controller v0", () => {
	it("owns exact writes and deadlines through a complete session", () => {
		const { host, write, abort, cancel } = harness();
		host.start();
		expect(host.state).toBe("awaiting-ready");
		expect(write.mock.calls[0][0]).toContain('"type":"hello"');
		host.receive(encode(fixture.ready));
		expect(host.state).toBe("ready");
		host.shutdown("1");
		expect(write.mock.calls[1][0]).toContain('"type":"shutdown"');
		host.receive(encode(fixture.completed));
		expect(host.state).toBe("completed");
		host.finish();
		expect(cancel).toHaveBeenCalledTimes(2);
		expect(abort).not.toHaveBeenCalled();
	});

	it("fails closed when either protocol deadline fires", () => {
		const first = harness();
		first.host.start();
		first.fireDeadline();
		expect(first.host.state).toBe("failed");
		expect(first.host.failure?.code).toBe("timeout");
		expect(first.abort).toHaveBeenCalledOnce();

		const second = harness();
		second.host.start();
		second.host.receive(encode(fixture.ready));
		second.host.shutdown("1");
		second.fireDeadline();
		expect(second.host.state).toBe("failed");
		expect(second.abort).toHaveBeenCalledOnce();
	});

	it("aborts once on write or protocol failure", () => {
		const writeFailure = harness();
		writeFailure.write.mockImplementationOnce(() => {
			throw new Error("closed pipe");
		});
		expect(() => writeFailure.host.start()).toThrow("speech-sidecar-host-v0:write");
		expect(writeFailure.abort).toHaveBeenCalledOnce();

		const protocolFailure = harness();
		protocolFailure.host.start();
		expect(() => protocolFailure.host.receive(encode(fixture.completed))).toThrow();
		expect(protocolFailure.host.state).toBe("failed");
		expect(protocolFailure.abort).toHaveBeenCalledOnce();
	});

	it("rejects invalid timeouts and invalid state transitions", () => {
		const base = {
			identity: { sessionId: "session", nonce: "nonce", helloSeq: "0" },
			handshakeTimeoutMs: 1,
			shutdownTimeoutMs: 1,
			write: () => undefined,
			abort: () => undefined,
		};
		expect(() => new SpeechSidecarHostControllerV0({ ...base, handshakeTimeoutMs: 0 })).toThrow(
			SpeechSidecarHostV0Error,
		);
		const { host } = harness();
		expect(() => host.shutdown("1")).toThrow("speech-sidecar-host-v0:state");
		host.start();
		expect(() => host.start()).toThrow("speech-sidecar-host-v0:state");
	});
});
