// Isolated incremental reader only. No pipe/IPC/process/authentication/ASR.
// Future host must build expectations from its own session/endpoint snapshot.
import {
	AUDIO_FRAME_HEADER_BYTES,
	AUDIO_FRAME_MAX_PAYLOAD_BYTES,
	AudioFrameV0Error,
	type AudioFrameV0ErrorCode,
	type AudioFrameV0Header,
	parseAudioFrameV0Header,
	validateAudioFrameV0,
} from "./audioFrameV0";

export interface ExpectedAudioStreamV0 {
	readonly nonceHex: string;
	readonly source: "system" | "microphone";
	readonly epoch: string;
	readonly sampleRate: number;
	readonly channels: number;
	readonly firstSequence: string;
	readonly firstSampleStart: string;
	readonly maxPayloadBytes: number;
}
export type AudioDecoderV0ErrorCode =
	| "invalid-expectation"
	| "frame"
	| "binding"
	| "order"
	| "budget"
	| "busy"
	| "truncated"
	| "sequence-exhausted"
	| "allocation"
	| "closed";
export class AudioDecoderV0Error extends Error {
	constructor(
		readonly code: AudioDecoderV0ErrorCode,
		readonly frameCode?: AudioFrameV0ErrorCode,
	) {
		super(`audio-decoder-v0:${code}${frameCode ? `:${frameCode}` : ""}`);
		this.name = "AudioDecoderV0Error";
	}
}
export interface OwnedAudioFrameV0 {
	readonly header: Readonly<AudioFrameV0Header>;
	// Ownership handed to caller, not immutable shared memory or a durable ACK.
	readonly bytes: Uint8Array;
}
const U64_MAX = (1n << 64n) - 1n;
function validU64(value: string): boolean {
	return (
		typeof value === "string" &&
		value.length <= 20 &&
		/^(0|[1-9][0-9]*)$/.test(value) &&
		BigInt(value) <= U64_MAX
	);
}

export class AudioDecoderV0 {
	private readonly expected: Readonly<ExpectedAudioStreamV0>;
	private nextSequence: bigint | undefined;
	private nextSampleStart: bigint;
	private readonly header = new Uint8Array(AUDIO_FRAME_HEADER_BYTES);
	private headerUsed = 0;
	private pending: { bytes: Uint8Array; filled: number } | undefined;
	private ready: OwnedAudioFrameV0 | undefined;
	private closed = false;

	constructor(input: ExpectedAudioStreamV0) {
		// Explicit primitive snapshot, never retain a caller-owned object/getter.
		const snapshot = {
			nonceHex: input.nonceHex,
			source: input.source,
			epoch: input.epoch,
			sampleRate: input.sampleRate,
			channels: input.channels,
			firstSequence: input.firstSequence,
			firstSampleStart: input.firstSampleStart,
			maxPayloadBytes: input.maxPayloadBytes,
		};
		if (
			typeof snapshot.nonceHex !== "string" ||
			!/^[0-9a-f]{32}$/.test(snapshot.nonceHex) ||
			/^0+$/.test(snapshot.nonceHex) ||
			(snapshot.source !== "system" && snapshot.source !== "microphone") ||
			!validU64(snapshot.epoch) ||
			!validU64(snapshot.firstSequence) ||
			!validU64(snapshot.firstSampleStart) ||
			!Number.isInteger(snapshot.sampleRate) ||
			snapshot.sampleRate < 1 ||
			snapshot.sampleRate > 192_000 ||
			!Number.isInteger(snapshot.channels) ||
			snapshot.channels < 1 ||
			snapshot.channels > 32 ||
			!Number.isInteger(snapshot.maxPayloadBytes) ||
			snapshot.maxPayloadBytes < 1 ||
			snapshot.maxPayloadBytes > AUDIO_FRAME_MAX_PAYLOAD_BYTES
		)
			throw new AudioDecoderV0Error("invalid-expectation");
		this.expected = Object.freeze(snapshot);
		this.nextSequence = BigInt(snapshot.firstSequence);
		this.nextSampleStart = BigInt(snapshot.firstSampleStart);
	}
	get isReady(): boolean {
		return this.ready !== undefined;
	}
	get isClosed(): boolean {
		return this.closed;
	}
	// Logical audio buffer ownership only. Excludes allocator/GC/metadata/input
	// chunks and frames already handed out; NOT whole-pipeline/RSS guarantee.
	get ownedBufferBytes(): number {
		return (
			AUDIO_FRAME_HEADER_BYTES +
			(this.pending?.bytes.byteLength ?? 0) +
			(this.ready?.bytes.byteLength ?? 0)
		);
	}
	stop(): void {
		this.closed = true;
		this.pending = undefined;
		this.ready = undefined;
		this.headerUsed = 0;
	}
	private poison(code: AudioDecoderV0ErrorCode, frameCode?: AudioFrameV0ErrorCode): never {
		this.stop();
		throw new AudioDecoderV0Error(code, frameCode);
	}
	private frameError(error: unknown): never {
		if (error instanceof AudioFrameV0Error) this.poison("frame", error.code);
		this.stop();
		throw error;
	}

	// Consumes only one header/payload piece; caller retains the unconsumed suffix
	// and bounds its input queue. No concatenating an arbitrary incoming chunk.
	feed(input: Uint8Array): number {
		if (this.closed) throw new AudioDecoderV0Error("closed");
		if (this.ready) throw new AudioDecoderV0Error("busy");
		if (input.byteLength === 0) return 0;
		if (this.pending) {
			const count = Math.min(input.byteLength, this.pending.bytes.byteLength - this.pending.filled);
			this.pending.bytes.set(input.subarray(0, count), this.pending.filled);
			this.pending.filled += count;
			if (this.pending.filled === this.pending.bytes.byteLength) {
				const complete = this.pending.bytes;
				let parsed: Readonly<AudioFrameV0Header>;
				try {
					parsed = validateAudioFrameV0(complete);
				} catch (error) {
					this.frameError(error);
				}
				const sequence = BigInt(parsed.sequence);
				this.nextSequence = sequence === U64_MAX ? undefined : sequence + 1n;
				this.nextSampleStart = BigInt(parsed.sampleEnd);
				this.pending = undefined;
				this.ready = { header: parsed, bytes: complete };
			}
			return count;
		}
		if (this.nextSequence === undefined) this.poison("sequence-exhausted");
		const count = Math.min(input.byteLength, AUDIO_FRAME_HEADER_BYTES - this.headerUsed);
		this.header.set(input.subarray(0, count), this.headerUsed);
		this.headerUsed += count;
		if (this.headerUsed !== AUDIO_FRAME_HEADER_BYTES) return count;
		let parsed: Readonly<AudioFrameV0Header>;
		try {
			parsed = parseAudioFrameV0Header(this.header);
		} catch (error) {
			this.frameError(error);
		}
		if (
			parsed.sessionNonceHex !== this.expected.nonceHex ||
			parsed.source !== this.expected.source ||
			parsed.epoch !== this.expected.epoch ||
			parsed.sampleRate !== this.expected.sampleRate ||
			parsed.channels !== this.expected.channels
		)
			this.poison("binding");
		if (
			BigInt(parsed.sequence) !== this.nextSequence ||
			BigInt(parsed.sampleStart) !== this.nextSampleStart
		)
			this.poison("order");
		if (parsed.payloadBytes > this.expected.maxPayloadBytes) this.poison("budget");
		let bytes: Uint8Array;
		try {
			bytes = new Uint8Array(AUDIO_FRAME_HEADER_BYTES + parsed.payloadBytes);
		} catch {
			this.poison("allocation");
		}
		bytes.set(this.header);
		this.pending = { bytes, filled: AUDIO_FRAME_HEADER_BYTES };
		return count;
	}

	take(): OwnedAudioFrameV0 | undefined {
		const frame = this.ready;
		if (frame) {
			this.ready = undefined;
			this.headerUsed = 0;
		}
		return frame;
	}
	// Complete ready frame survives EOF until taken; partial input is terminal.
	// No zero padding or scan for the next magic marker after an error.
	finish(): void {
		if (this.closed) throw new AudioDecoderV0Error("closed");
		if (!this.ready && (this.headerUsed !== 0 || this.pending)) this.poison("truncated");
		this.closed = true;
	}
}
