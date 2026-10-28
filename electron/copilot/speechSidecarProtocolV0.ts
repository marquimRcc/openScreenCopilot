// Main-only parser for the draft sidecar's stdout. No spawn, pipe, PCM or trust
// is granted by successful parsing; process ownership belongs to a future host.
export const SPEECH_SIDECAR_V0_MAX_LINE_BYTES = 1_048_576;
const U64_MAX = (1n << 64n) - 1n;
const ID = /^[A-Za-z0-9_-]{1,128}$/;

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
