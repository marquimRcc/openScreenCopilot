// Main-only parser for the draft sidecar's stdout. No spawn, pipe, PCM or trust
// is granted by successful parsing; process ownership belongs to a future host.
export const SPEECH_SIDECAR_V0_MAX_LINE_BYTES = 1_048_576;
const U64_MAX = (1n << 64n) - 1n;
const ID = /^[A-Za-z0-9_-]{1,128}$/;

export interface SpeechSidecarV0HostIdentity {
	readonly sessionId: string;
	readonly nonce: string;
	readonly seq: string;
}

export type SpeechSidecarV0Message =
	| Readonly<{
			type: "ready";
			version: 0;
			sessionId: string;
			seq: string;
			capabilities: Readonly<{
				audioDescriptorVersion: 0;
				maxControlLineBytes: number;
				providerAvailable: false;
			}>;
	  }>
	| Readonly<{
			type: "completed";
			version: 0;
			sessionId: string;
			seq: string;
	  }>;

export class SpeechSidecarV0Error extends Error {
	constructor(readonly code: "length" | "json" | "schema" | "identity" | "sequence") {
		super(`speech-sidecar-v0:${code}`);
		this.name = "SpeechSidecarV0Error";
	}
}

function fail(code: SpeechSidecarV0Error["code"]): never {
	throw new SpeechSidecarV0Error(code);
}
function record(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) fail("schema");
	return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]): void {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
		fail("schema");
}
function sequence(value: unknown): string {
	if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) fail("sequence");
	if (BigInt(value) > U64_MAX) fail("sequence");
	return value;
}

function hostIdentity(value: SpeechSidecarV0HostIdentity): SpeechSidecarV0HostIdentity {
	if (!ID.test(value.sessionId) || !ID.test(value.nonce)) fail("identity");
	return { sessionId: value.sessionId, nonce: value.nonce, seq: sequence(value.seq) };
}

function encodeHostMessage(type: "hello" | "shutdown", value: SpeechSidecarV0HostIdentity): string {
	const identity = hostIdentity(value);
	return `${JSON.stringify({ type, version: 0, ...identity })}\n`;
}

export function encodeSpeechSidecarV0Hello(value: SpeechSidecarV0HostIdentity): string {
	return encodeHostMessage("hello", value);
}

export function encodeSpeechSidecarV0Shutdown(value: SpeechSidecarV0HostIdentity): string {
	return encodeHostMessage("shutdown", value);
}

export function parseSpeechSidecarV0Line(line: string): SpeechSidecarV0Message {
	if (Buffer.byteLength(line, "utf8") > SPEECH_SIDECAR_V0_MAX_LINE_BYTES) fail("length");
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		fail("json");
	}
	const message = record(parsed);
	if (message.version !== 0) fail("schema");
	if (typeof message.sessionId !== "string" || !ID.test(message.sessionId)) fail("identity");
	const seq = sequence(message.seq);
	if (message.type === "completed") {
		exact(message, ["type", "version", "sessionId", "seq"]);
		return Object.freeze({ type: "completed", version: 0, sessionId: message.sessionId, seq });
	}
	if (message.type !== "ready") fail("schema");
	exact(message, ["type", "version", "sessionId", "seq", "capabilities"]);
	const capabilities = record(message.capabilities);
	exact(capabilities, ["audioDescriptorVersion", "maxControlLineBytes", "providerAvailable"]);
	if (
		capabilities.audioDescriptorVersion !== 0 ||
		capabilities.maxControlLineBytes !== SPEECH_SIDECAR_V0_MAX_LINE_BYTES ||
		capabilities.providerAvailable !== false
	)
		fail("schema");
	return Object.freeze({
		type: "ready",
		version: 0,
		sessionId: message.sessionId,
		seq,
		capabilities: Object.freeze({
			audioDescriptorVersion: 0,
			maxControlLineBytes: SPEECH_SIDECAR_V0_MAX_LINE_BYTES,
			providerAvailable: false,
		}),
	});
}

export class SpeechSidecarV0Session {
	readonly sessionId: string;
	readonly helloSeq: string;
	#state: "awaiting-ready" | "ready" | "awaiting-completed" | "completed" = "awaiting-ready";
	#shutdownSeq: string | undefined;

	constructor(sessionId: string, helloSeq: string) {
		if (!ID.test(sessionId)) fail("identity");
		this.sessionId = sessionId;
		this.helloSeq = sequence(helloSeq);
	}

	get state(): "awaiting-ready" | "ready" | "awaiting-completed" | "completed" {
		return this.#state;
	}

	accept(message: SpeechSidecarV0Message): void {
		if (
			this.#state === "awaiting-ready" &&
			message.type === "ready" &&
			message.sessionId === this.sessionId &&
			message.seq === this.helloSeq
		) {
			this.#state = "ready";
			return;
		}
		if (
			this.#state === "awaiting-completed" &&
			message.type === "completed" &&
			message.sessionId === this.sessionId &&
			message.seq === this.#shutdownSeq
		) {
			this.#state = "completed";
			return;
		}
		fail(message.sessionId === this.sessionId ? "sequence" : "identity");
	}

	expectShutdown(seq: string): void {
		const parsed = sequence(seq);
		if (this.#state !== "ready" || BigInt(parsed) <= BigInt(this.helloSeq)) fail("sequence");
		this.#shutdownSeq = parsed;
		this.#state = "awaiting-completed";
	}
}
