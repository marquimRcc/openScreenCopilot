import { EventEmitter } from "node:events";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	launchSpeechSidecarV0,
	SpeechSidecarLaunchV0Error,
	type SpeechSidecarSpawnV0,
} from "./speechSidecarLauncherV0";
import type {
	SpeechSidecarProcessV0,
	SpeechSidecarReadableV0,
} from "./speechSidecarProcessBindingV0";

class FakeProcess extends EventEmitter implements SpeechSidecarProcessV0 {
	readonly pid = 51;
	readonly stdout = new EventEmitter() as EventEmitter & SpeechSidecarReadableV0;
	readonly stdin = { write: vi.fn((_line: string) => true) };
	readonly kill = vi.fn((_signal?: NodeJS.Signals) => true);
}

const base = {
	identity: { sessionId: "session", nonce: "nonce", helloSeq: "0" },
	handshakeTimeoutMs: 100,
	shutdownTimeoutMs: 100,
	processSupervisor: { termTimeoutMs: 100, killTimeoutMs: 100 },
} as const;

describe("speech sidecar launcher v0", () => {
	it("canonicalizes and launches one exact executable without a shell", () => {
		const proc = new FakeProcess();
		const spawn = vi.fn<SpeechSidecarSpawnV0>(() => proc);
		const canonical = path.resolve("private", "speech-sidecar.exe");
		const binding = launchSpeechSidecarV0({
			...base,
			authorizedExecutablePath: path.resolve("staged", "speech-sidecar.exe"),
			canonicalize: () => canonical,
			spawn,
		});
		expect(spawn).toHaveBeenCalledWith(canonical, [], {
			shell: false,
			windowsHide: true,
			stdio: ["pipe", "pipe", "ignore"],
		});
		expect(proc.stdin.write.mock.calls[0][0]).toContain('"type":"hello"');
		expect(binding.state).toBe("awaiting-ready");
	});

	it("rejects relative, missing and invalid identity before spawn", () => {
		const spawn = vi.fn<SpeechSidecarSpawnV0>(() => new FakeProcess());
		expect(() =>
			launchSpeechSidecarV0({
				...base,
				authorizedExecutablePath: "speech-sidecar.exe",
				spawn,
			}),
		).toThrow(SpeechSidecarLaunchV0Error);
		expect(() =>
			launchSpeechSidecarV0({
				...base,
				authorizedExecutablePath: path.resolve("missing.exe"),
				canonicalize: () => {
					throw new Error("missing");
				},
				spawn,
			}),
		).toThrow("speech-sidecar-launch-v0:path");
		expect(() =>
			launchSpeechSidecarV0({
				...base,
				identity: { ...base.identity, nonce: "../unsafe" },
				authorizedExecutablePath: path.resolve("sidecar.exe"),
				canonicalize: (value) => value,
				spawn,
			}),
		).toThrow("speech-sidecar-v0:identity");
		expect(spawn).not.toHaveBeenCalled();
	});

	it("reports spawn failure without returning partial ownership", () => {
		expect(() =>
			launchSpeechSidecarV0({
				...base,
				authorizedExecutablePath: path.resolve("sidecar.exe"),
				canonicalize: (value) => value,
				spawn: () => {
					throw new Error("denied");
				},
			}),
		).toThrow("speech-sidecar-launch-v0:spawn");
	});
});
