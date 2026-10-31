import { describe, expect, it } from "vitest";
import { createSpeechSidecarIdentityV0 } from "./speechSidecarIdentityV0";

describe("speech sidecar identity v0", () => {
	it("derives separate bounded protocol identities from 192-bit values", () => {
		let call = 0;
		const identity = createSpeechSidecarIdentityV0((size) => {
			expect(size).toBe(24);
			return new Uint8Array(size).fill(++call);
		});
		expect(identity.sessionId).toMatch(/^s_[0-9a-f]{48}$/);
		expect(identity.nonce).toMatch(/^n_[0-9a-f]{48}$/);
		expect(identity.sessionId).not.toBe(identity.nonce);
		expect(identity.helloSeq).toBe("0");
		expect(Object.isFrozen(identity)).toBe(true);
	});

	it("fails closed when an injected random source violates its contract", () => {
		expect(() => createSpeechSidecarIdentityV0(() => new Uint8Array(23))).toThrow(
			"speech-sidecar-identity-v0:random-length",
		);
	});
});
