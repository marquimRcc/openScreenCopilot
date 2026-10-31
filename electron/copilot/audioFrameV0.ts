// Main-only, isolated draft parser. No runtime imports, pipe, PCM forwarding,
// allocation based on unvalidated metadata, sender authentication or clock map.
export const AUDIO_FRAME_HEADER_BYTES = 80;
export const AUDIO_FRAME_MAX_PAYLOAD_BYTES = 4_194_304;
const U64_MAX = (1n << 64n) - 1n;

export type AudioFrameV0ErrorCode =
	| "length"
	| "schema"
	| "format"
	| "limits"
	| "arithmetic"
	| "payload"
	| "non-finite";
export class AudioFrameV0Error extends Error {
	constructor(readonly code: AudioFrameV0ErrorCode) {
		super(`audio-frame-v0:${code}`);
		this.name = "AudioFrameV0Error";
	}
}
export interface AudioFrameV0Header {
	readonly payloadBytes: number;
	readonly sampleRate: number;
	readonly channels: number;
	readonly source: "system" | "microphone";
	readonly discontinuity: boolean;
	readonly sessionNonceHex: string;
	readonly epoch: string;
	readonly sequence: string;
	readonly sampleStart: string;
	readonly sampleEnd: string;
	readonly frameCount: number;
	readonly captureMonotonicNs: string;
}
function fail(code: AudioFrameV0ErrorCode): never {
	throw new AudioFrameV0Error(code);
}

// Snapshot only fixed scalar metadata. A valid nonce is NOT sender permission.
export function parseAudioFrameV0Header(bytes: Uint8Array): Readonly<AudioFrameV0Header> {
	if (bytes.byteLength !== AUDIO_FRAME_HEADER_BYTES) fail("length");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const u16 = (at: number) => view.getUint16(at, true);
	const u32 = (at: number) => view.getUint32(at, true);
	const u64 = (at: number) => view.getBigUint64(at, true);
	if (
		bytes[0] !== 79 ||
		bytes[1] !== 83 ||
		bytes[2] !== 67 ||
		bytes[3] !== 80 ||
		bytes[4] !== 0 ||
		bytes[5] !== 1 ||
		u16(6) !== AUDIO_FRAME_HEADER_BYTES ||
		u32(68) !== 0 ||
		(u32(20) & ~1) !== 0
	)
		fail("schema");
	if (bytes[18] !== 1 || (bytes[19] !== 1 && bytes[19] !== 2)) fail("format");
	const payloadBytes = u32(8);
	const sampleRate = u32(12);
	const channels = u16(16);
	const frameCount = u32(64);
	if (
		sampleRate < 1 ||
		sampleRate > 192_000 ||
		channels < 1 ||
		channels > 32 ||
		frameCount === 0 ||
		payloadBytes > AUDIO_FRAME_MAX_PAYLOAD_BYTES
	)
		fail("limits");
	// u32*32*4 remains an exact safe JS integer, then is bounded to4MiB.
	const expected = frameCount * channels * 4;
	if (expected > AUDIO_FRAME_MAX_PAYLOAD_BYTES) fail("limits");
	if (payloadBytes !== expected) fail("payload");
	const sampleStart = u64(56);
	const sampleEnd = sampleStart + BigInt(frameCount);
	if (sampleEnd > U64_MAX) fail("arithmetic");
	const nonce = bytes.subarray(24, 40);
	if (nonce.every((v) => v === 0)) fail("schema");
	return Object.freeze({
		payloadBytes,
		sampleRate,
		channels,
		source: bytes[19] === 1 ? "system" : "microphone",
		discontinuity: u32(20) !== 0,
		sessionNonceHex: Array.from(nonce, (value) => value.toString(16).padStart(2, "0")).join(""),
		epoch: u64(40).toString(),
		sequence: u64(48).toString(),
		sampleStart: sampleStart.toString(),
		sampleEnd: sampleEnd.toString(),
		frameCount,
		captureMonotonicNs: u64(72).toString(),
	});
}

// Reparses raw header; accepting/forging a TS metadata object never authorizes
// payload space. A future transport must call header validation BEFORE buffering
// its payload. Shared/mutable PCM memory still needs ownership at that boundary.
export function validateAudioFrameV0(bytes: Uint8Array): Readonly<AudioFrameV0Header> {
	if (bytes.byteLength < AUDIO_FRAME_HEADER_BYTES) fail("length");
	const header = parseAudioFrameV0Header(bytes.subarray(0, AUDIO_FRAME_HEADER_BYTES));
	if (bytes.byteLength - AUDIO_FRAME_HEADER_BYTES !== header.payloadBytes) fail("payload");
	const view = new DataView(
		bytes.buffer,
		bytes.byteOffset + AUDIO_FRAME_HEADER_BYTES,
		header.payloadBytes,
	);
	for (let at = 0; at < header.payloadBytes; at += 4) {
		if (!Number.isFinite(view.getFloat32(at, true))) fail("non-finite");
	}
	return header;
}
