import { SpeechSidecarLineDecoderV0 } from "./speechSidecarLineDecoderV0";
import {
	encodeSpeechSidecarV0Hello,
	encodeSpeechSidecarV0Shutdown,
	parseSpeechSidecarV0Line,
	type SpeechSidecarV0Message,
	SpeechSidecarV0Session,
} from "./speechSidecarProtocolV0";

export class SpeechSidecarStreamV0Error extends Error {
	constructor(readonly code: "state" | "unexpected-eof") {
		super(`speech-sidecar-stream-v0:${code}`);
		this.name = "SpeechSidecarStreamV0Error";
	}
}

export interface SpeechSidecarStreamV0Identity {
	readonly sessionId: string;
	readonly nonce: string;
	readonly helloSeq: string;
}

/**
 * Bounded protocol driver for an already-owned byte stream.
 * It neither spawns nor terminates a process and never queues decoded messages.
 */
export class SpeechSidecarStreamSessionV0 {
	readonly #identity: SpeechSidecarStreamV0Identity;
	readonly #protocol: SpeechSidecarV0Session;
	readonly #decoder = new SpeechSidecarLineDecoderV0();
	#helloSent = false;
	#ended = false;

	constructor(identity: SpeechSidecarStreamV0Identity) {
		this.#identity = Object.freeze({ ...identity });
		this.#protocol = new SpeechSidecarV0Session(identity.sessionId, identity.helloSeq);
		// Validate the nonce and the complete outbound identity before any stream is touched.
		encodeSpeechSidecarV0Hello({
			sessionId: identity.sessionId,
			nonce: identity.nonce,
			seq: identity.helloSeq,
		});
	}

	get state(): "created" | SpeechSidecarV0Session["state"] | "ended" {
		if (this.#ended) return "ended";
		return this.#helloSent ? this.#protocol.state : "created";
	}

	hello(): string {
		if (this.#helloSent || this.#ended) throw new SpeechSidecarStreamV0Error("state");
		this.#helloSent = true;
		return encodeSpeechSidecarV0Hello({
			sessionId: this.#identity.sessionId,
			nonce: this.#identity.nonce,
			seq: this.#identity.helloSeq,
		});
	}

	shutdown(seq: string): string {
		if (!this.#helloSent || this.#ended) throw new SpeechSidecarStreamV0Error("state");
		this.#protocol.expectShutdown(seq);
		return encodeSpeechSidecarV0Shutdown({
			sessionId: this.#identity.sessionId,
			nonce: this.#identity.nonce,
			seq,
		});
	}

	receive(input: Uint8Array, onMessage: (message: SpeechSidecarV0Message) => void): number {
		if (!this.#helloSent || this.#ended) throw new SpeechSidecarStreamV0Error("state");
		try {
			let consumed = 0;
			while (consumed < input.byteLength) {
				const count = this.#decoder.feed(input.subarray(consumed));
				consumed += count;
				const line = this.#decoder.take();
				if (line === undefined) break;
				const message = parseSpeechSidecarV0Line(line);
				this.#protocol.accept(message);
				onMessage(message);
			}
			return consumed;
		} catch (error) {
			this.stop();
			throw error;
		}
	}

	finish(): void {
		if (!this.#helloSent || this.#ended) throw new SpeechSidecarStreamV0Error("state");
		try {
			this.#decoder.finish();
		} catch (error) {
			this.#ended = true;
			throw error;
		}
		if (this.#protocol.state !== "completed") {
			this.#decoder.stop();
			throw new SpeechSidecarStreamV0Error("unexpected-eof");
		}
		this.#ended = true;
	}

	stop(): void {
		this.#decoder.stop();
		this.#ended = true;
	}
}
