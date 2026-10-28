import { EventEmitter } from "node:events";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SpeechSidecarSpawnV0 } from "./speechSidecarLauncherV0";
import type {
	SpeechSidecarProcessV0,
	SpeechSidecarReadableV0,
} from "./speechSidecarProcessBindingV0";
import { createSpeechSidecarServiceV0 } from "./speechSidecarServiceV0";

class FakeProcess extends EventEmitter implements SpeechSidecarProcessV0 {
	readonly pid = 63;
	readonly stdout = new EventEmitter() as EventEmitter & SpeechSidecarReadableV0;
	readonly stderr = new EventEmitter() as EventEmitter & SpeechSidecarReadableV0;
	readonly stdin = { write: vi.fn((_line: string) => true) };
	readonly kill = vi.fn((_signal?: NodeJS.Signals) => true);
}

const root = path.resolve("private", "app");
const base = {
	isPackaged: true,
	resourcesPath: root,
	appPath: path.resolve("unused"),
	platform: "win32" as const,
	arch: "x64" as const,
	identity: { sessionId: "session", nonce: "nonce", helloSeq: "0" },
	handshakeTimeoutMs: 100,
	shutdownTimeoutMs: 100,
	processSupervisor: { termTimeoutMs: 100, killTimeoutMs: 100 },
};

describe("speech sidecar service v0", () => {
	it("returns unavailable without spawning when the staged resource is absent", () => {
		const spawn = vi.fn<SpeechSidecarSpawnV0>(() => new FakeProcess());
		expect(
			createSpeechSidecarServiceV0({
				...base,
				exists: () => false,
				canonicalize: (candidate) => candidate,
				spawn,
			}),
		).toBeNull();
		expect(spawn).not.toHaveBeenCalled();
	});

	it("launches only the canonical resource selected by the resolver", () => {
		const proc = new FakeProcess();
		const spawn = vi.fn<SpeechSidecarSpawnV0>(() => proc);
		const canonical = path.join(
			root,
			"electron",
			"native",
			"bin",
			"win32-x64",
			"openscreen-speech-sidecar.exe",
		);
		const service = createSpeechSidecarServiceV0({
			...base,
			exists: () => true,
			canonicalize: () => canonical,
			spawn,
		});
		expect(service?.state).toBe("awaiting-ready");
		expect(spawn.mock.calls[0][0]).toBe(canonical);
		expect(proc.stdin.write).toHaveBeenCalledOnce();
	});

	it("generates a strong bounded identity when the caller omits one", () => {
		const proc = new FakeProcess();
		createSpeechSidecarServiceV0({
			...base,
			identity: undefined,
			exists: () => true,
			canonicalize: (candidate) => candidate,
			spawn: () => proc,
		});
		const hello = JSON.parse(proc.stdin.write.mock.calls[0][0]);
		expect(hello.sessionId).toMatch(/^s_[0-9a-f]{48}$/);
		expect(hello.nonce).toMatch(/^n_[0-9a-f]{48}$/);
	});
});
