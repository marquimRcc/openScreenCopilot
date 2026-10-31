import { randomBytes } from "node:crypto";
import type { SpeechSidecarStreamV0Identity } from "./speechSidecarStreamSessionV0";

export type SpeechSidecarRandomV0 = (size: number) => Uint8Array;

export function createSpeechSidecarIdentityV0(
	random: SpeechSidecarRandomV0 = randomBytes,
): SpeechSidecarStreamV0Identity {
	const session = random(24);
	const nonce = random(24);
	if (session.byteLength !== 24 || nonce.byteLength !== 24)
		throw new Error("speech-sidecar-identity-v0:random-length");
	return Object.freeze({
		sessionId: `s_${Buffer.from(session).toString("hex")}`,
		nonce: `n_${Buffer.from(nonce).toString("hex")}`,
		helloSeq: "0",
	});
}
