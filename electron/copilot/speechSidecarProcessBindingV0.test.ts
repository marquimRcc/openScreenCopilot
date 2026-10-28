import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
	SpeechSidecarProcessV0,
	SpeechSidecarReadableV0,
} from "./speechSidecarProcessBindingV0";
import { SpeechSidecarProcessBindingV0 } from "./speechSidecarProcessBindingV0";

const fixture = JSON.parse(
	readFileSync(
		new URL("../../contracts/copilot/speech-sidecar.v0.fixture.json", import.meta.url),
		"utf8",
	),
) as { ready: object; completed: object };
const encode = (value: object) => new TextEncoder().encode(`${JSON.stringify(value)}\n`);

class FakeProcess extends EventEmitter implements SpeechSidecarProcessV0 {
	readonly pid = 42;
	readonly stdout = new EventEmitter() as EventEmitter & SpeechSidecarReadableV0;
	readonly stdin = { write: vi.fn((_line: string) => true) };
	readonly kill = vi.fn((_signal?: NodeJS.Signals) => true);
}

function binding(proc = new FakeProcess()) {
	const instance = new SpeechSidecarProcessBindingV0(proc, {
		identity: { sessionId: "fixture_session", nonce: "fixture_nonce", helloSeq: "0" },
		handshakeTimeoutMs: 100,
		shutdownTimeoutMs: 100,
		processSupervisor: { termTimeoutMs: 100, killTimeoutMs: 100 },
	});
	return { proc, binding: instance };
}

describe("speech sidecar process binding v0", () => {
	it("binds a complete protocol session to one observed process exit", () => {
		const { proc, binding: host } = binding();
		host.start();
		expect(proc.stdin.write).toHaveBeenCalledOnce();
		proc.stdout.emit("data", encode(fixture.ready));
		expect(host.state).toBe("ready");
		host.shutdown("1");
		proc.stdout.emit("data", encode(fixture.completed));
		proc.stdout.emit("end");
		proc.emit("exit", 0, null);
		expect(host.state).toBe("completed");
		expect(host.exitReceipt).toMatchObject({ pid: 42, exitCode: 0, forced: false });
		expect(host.failure).toBeUndefined();
	});

	it("terminates the owned process on malformed protocol", () => {
		const { proc, binding: host } = binding();
		host.start();
		proc.stdout.emit("data", new TextEncoder().encode("not-json\n"));
		expect(host.state).toBe("failed");
		expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
		expect(host.failure).toBeDefined();
	});

	it("fails closed when stdout or the process ends prematurely", () => {
		const first = binding();
		first.binding.start();
		first.proc.stdout.emit("end");
		expect(first.binding.state).toBe("failed");
		expect(first.proc.kill).toHaveBeenCalledWith("SIGTERM");

		const second = binding();
		second.binding.start();
		second.proc.emit("exit", 7, null);
		expect(second.binding.state).toBe("failed");
		expect(second.binding.failure?.message).toContain("unexpected-exit");
	});
});
