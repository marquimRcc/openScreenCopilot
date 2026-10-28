import type { SpeechSidecarV0Message } from "./speechSidecarProtocolV0";
import { nextSpeechSidecarV0Sequence } from "./speechSidecarProtocolV0";
import {
	SpeechSidecarStreamSessionV0,
	type SpeechSidecarStreamV0Identity,
} from "./speechSidecarStreamSessionV0";

export type SpeechSidecarHostV0State =
	| "created"
	| "awaiting-ready"
	| "ready"
	| "awaiting-completed"
	| "completed"
	| "failed";

export class SpeechSidecarHostV0Error extends Error {
	constructor(readonly code: "invalid-timeout" | "state" | "timeout" | "write") {
		super(`speech-sidecar-host-v0:${code}`);
		this.name = "SpeechSidecarHostV0Error";
	}
}

export type SpeechSidecarHostScheduleV0 = (
	milliseconds: number,
	callback: () => void,
) => () => void;

export interface SpeechSidecarHostControllerV0Options {
	readonly identity: SpeechSidecarStreamV0Identity;
	readonly handshakeTimeoutMs: number;
	readonly shutdownTimeoutMs: number;
	readonly write: (line: string) => void;
	readonly abort: (error: SpeechSidecarHostV0Error) => void;
	readonly schedule?: SpeechSidecarHostScheduleV0;
}

const defaultSchedule: SpeechSidecarHostScheduleV0 = (milliseconds, callback) => {
	const timer = setTimeout(callback, milliseconds);
	return () => clearTimeout(timer);
};

/** Protocol deadlines and outbound ownership for a future supervised child process. */
export class SpeechSidecarHostControllerV0 {
	readonly #stream: SpeechSidecarStreamSessionV0;
	readonly #handshakeTimeoutMs: number;
	readonly #shutdownTimeoutMs: number;
	readonly #write: (line: string) => void;
	readonly #abort: (error: SpeechSidecarHostV0Error) => void;
	readonly #schedule: SpeechSidecarHostScheduleV0;
	readonly #defaultShutdownSeq: string;
	#state: SpeechSidecarHostV0State = "created";
	#failure: SpeechSidecarHostV0Error | undefined;
	#cancelDeadline: (() => void) | undefined;

	constructor(options: SpeechSidecarHostControllerV0Options) {
		if (!Number.isSafeInteger(options.handshakeTimeoutMs) || options.handshakeTimeoutMs < 1)
			throw new SpeechSidecarHostV0Error("invalid-timeout");
		if (!Number.isSafeInteger(options.shutdownTimeoutMs) || options.shutdownTimeoutMs < 1)
			throw new SpeechSidecarHostV0Error("invalid-timeout");
		this.#stream = new SpeechSidecarStreamSessionV0(options.identity);
		this.#handshakeTimeoutMs = options.handshakeTimeoutMs;
		this.#shutdownTimeoutMs = options.shutdownTimeoutMs;
		this.#write = options.write;
		this.#abort = options.abort;
		this.#schedule = options.schedule ?? defaultSchedule;
		this.#defaultShutdownSeq = nextSpeechSidecarV0Sequence(options.identity.helloSeq);
	}

	get state(): SpeechSidecarHostV0State {
		return this.#state;
	}

	get failure(): SpeechSidecarHostV0Error | undefined {
		return this.#failure;
	}

	start(): void {
		if (this.#state !== "created") throw new SpeechSidecarHostV0Error("state");
		this.#state = "awaiting-ready";
		this.#armDeadline(this.#handshakeTimeoutMs);
		this.#writeOrFail(this.#stream.hello());
	}

	shutdown(seq = this.#defaultShutdownSeq): void {
		if (this.#state !== "ready") throw new SpeechSidecarHostV0Error("state");
		this.#state = "awaiting-completed";
		this.#armDeadline(this.#shutdownTimeoutMs);
		this.#writeOrFail(this.#stream.shutdown(seq));
	}

	receive(input: Uint8Array): number {
		if (this.#state === "created" || this.#state === "completed" || this.#state === "failed")
			throw new SpeechSidecarHostV0Error("state");
		try {
			return this.#stream.receive(input, (message) => this.#accept(message));
		} catch (error) {
			this.#fail(new SpeechSidecarHostV0Error("state"));
			throw error;
		}
	}

	finish(): void {
		if (this.#state !== "completed") {
			this.#fail(new SpeechSidecarHostV0Error("state"));
			throw new SpeechSidecarHostV0Error("state");
		}
		this.#stream.finish();
	}

	stop(): void {
		if (this.#state === "failed") return;
		this.#fail(new SpeechSidecarHostV0Error("state"));
	}

	#accept(message: SpeechSidecarV0Message): void {
		if (message.type === "ready" && this.#state === "awaiting-ready") {
			this.#cancelDeadline?.();
			this.#cancelDeadline = undefined;
			this.#state = "ready";
			return;
		}
		if (message.type === "completed" && this.#state === "awaiting-completed") {
			this.#cancelDeadline?.();
			this.#cancelDeadline = undefined;
			this.#state = "completed";
			return;
		}
		this.#fail(new SpeechSidecarHostV0Error("state"));
		throw new SpeechSidecarHostV0Error("state");
	}

	#armDeadline(milliseconds: number): void {
		this.#cancelDeadline?.();
		this.#cancelDeadline = this.#schedule(milliseconds, () => {
			if (this.#state !== "awaiting-ready" && this.#state !== "awaiting-completed") return;
			this.#fail(new SpeechSidecarHostV0Error("timeout"));
		});
	}

	#writeOrFail(line: string): void {
		try {
			this.#write(line);
		} catch {
			this.#fail(new SpeechSidecarHostV0Error("write"));
			throw new SpeechSidecarHostV0Error("write");
		}
	}

	#fail(error: SpeechSidecarHostV0Error): void {
		if (this.#state === "failed") return;
		this.#cancelDeadline?.();
		this.#cancelDeadline = undefined;
		this.#stream.stop();
		this.#state = "failed";
		this.#failure = error;
		this.#abort(error);
	}
}
