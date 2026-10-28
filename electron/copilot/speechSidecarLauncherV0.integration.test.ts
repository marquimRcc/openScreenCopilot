import { describe, expect, it } from "vitest";
import { launchSpeechSidecarV0 } from "./speechSidecarLauncherV0";

const executable = process.env.OPENSCREEN_SPEECH_SIDECAR_V0;

async function waitUntil(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("timed out waiting for speech sidecar state");
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

describe.runIf(executable)("speech sidecar launcher v0 process integration", () => {
	it("completes the real TypeScript-to-Rust handshake and observes exit", async () => {
		const binding = launchSpeechSidecarV0({
			authorizedExecutablePath: executable!,
			identity: { sessionId: "integration_session", nonce: "integration_nonce", helloSeq: "0" },
			handshakeTimeoutMs: 2_000,
			shutdownTimeoutMs: 2_000,
			processSupervisor: { termTimeoutMs: 1_000, killTimeoutMs: 1_000 },
		});
		await waitUntil(() => binding.state === "ready" || binding.state === "failed");
		expect(binding.failure).toBeUndefined();
		expect(binding.state).toBe("ready");
		binding.shutdown("1");
		await waitUntil(() => binding.exitReceipt !== null || binding.failure !== undefined);
		expect(binding.failure).toBeUndefined();
		expect(binding.state).toBe("completed");
		expect(binding.exitReceipt).toMatchObject({ exitCode: 0, forced: false });
	});
});
