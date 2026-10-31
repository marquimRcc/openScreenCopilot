import { SPEECH_SIDECAR_V0_MAX_LINE_BYTES } from "./speechSidecarProtocolV0";

export type SpeechSidecarLineErrorCode =
	| "invalid-limit"
	| "capacity"
	| "utf8"
	| "empty"
	| "truncated"
	| "busy"
	| "closed";

export class SpeechSidecarLineError extends Error {
	constructor(readonly code: SpeechSidecarLineErrorCode) {
		super(`speech-sidecar-line-v0:${code}`);
		this.name = "SpeechSidecarLineError";
	}
}

/**
 * One-message-backpressure LF/CRLF decoder for a future child stdout stream.
 * It allocates one fixed, caller-bounded byte buffer and never queues messages.
 */
export class SpeechSidecarLineDecoderV0 {
	readonly limit: number;
	readonly #storage: Uint8Array;
	#length = 0;
	#ready: string | undefined;
	#closed = false;
	#receivedBytes = 0n;
	#messages = 0n;

	constructor(limit = SPEECH_SIDECAR_V0_MAX_LINE_BYTES) {
		if (!Number.isSafeInteger(limit) || limit < 1 || limit > SPEECH_SIDECAR_V0_MAX_LINE_BYTES)
			throw new SpeechSidecarLineError("invalid-limit");
		this.limit = limit;
		this.#storage = new Uint8Array(limit);
	}

	get ready(): boolean {
		return this.#ready !== undefined;
	}

	get closed(): boolean {
		return this.#closed;
	}

	get counts(): Readonly<{ receivedBytes: bigint; messages: bigint }> {
		return Object.freeze({ receivedBytes: this.#receivedBytes, messages: this.#messages });
	}

	feed(input: Uint8Array): number {
		if (this.#closed) throw new SpeechSidecarLineError("closed");
		if (this.#ready !== undefined) throw new SpeechSidecarLineError("busy");
		if (input.byteLength === 0) return 0;
		const remaining = this.limit - this.#length;
		const scanLength = Math.min(input.byteLength, remaining + 1);
		const scan = input.subarray(0, scanLength);
		const newline = scan.indexOf(10);
		const count = newline >= 0 ? newline : scanLength;
		if (count > remaining) return this.#fail("capacity");
		this.#storage.set(scan.subarray(0, count), this.#length);
		this.#length += count;
		const consumed = count + Number(newline >= 0);
		this.#receivedBytes += BigInt(consumed);
		if (newline < 0) return consumed;

		let payloadLength = this.#length;
		if (payloadLength > 0 && this.#storage[payloadLength - 1] === 13) payloadLength--;
		if (payloadLength === 0) return this.#fail("empty");
		try {
			this.#ready = new TextDecoder("utf-8", { fatal: true }).decode(
				this.#storage.subarray(0, payloadLength),
			);
		} catch {
			return this.#fail("utf8");
		}
		this.#messages++;
		return consumed;
	}

	take(): string | undefined {
		const line = this.#ready;
		if (line === undefined) return undefined;
		this.#storage.fill(0, 0, this.#length);
		this.#length = 0;
		this.#ready = undefined;
		return line;
	}

	finish(): void {
		if (this.#closed) throw new SpeechSidecarLineError("closed");
		if (this.#ready === undefined && this.#length !== 0) this.#fail("truncated");
		this.#closed = true;
	}

	stop(): void {
		this.#storage.fill(0, 0, this.#length);
		this.#length = 0;
		this.#ready = undefined;
		this.#closed = true;
	}

	#fail(code: SpeechSidecarLineErrorCode): never {
		this.stop();
		throw new SpeechSidecarLineError(code);
	}
}
