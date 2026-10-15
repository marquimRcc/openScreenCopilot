// Isolated compatibility adapter, NOT runtime routing, authentication or a clock.
// Takes fixed raw header bytes; never accepts an asserted renderer metadata object.
import { parseAudioFrameV0Header } from "./audioFrameV0";
import type { DraftSourceRange } from "./sourceTimeline";

export class AudioTimelineAdapterV0Error extends Error {
	readonly code = "epoch-not-representable";
	constructor() {
		super("audio-timeline-v0:epoch-not-representable");
		this.name = "AudioTimelineAdapterV0Error";
	}
}

export interface DraftAudioTimelineOriginV0 {
	readonly sessionNonceHex: string;
	readonly source: "system" | "microphone";
	readonly sampleRate: number;
	readonly range: Readonly<DraftSourceRange>;
}

/** Caller still verifies session/source/rate against its own map registry.
 * This parses header only, not PCM/sequence/replay or ownership. No PTS is made
 * from captureMonotonicNs. Normalized16k indices must not enter this adapter as
 * though they were source48k counters. Large epochs fail rather than rounding.
 */
export function adaptAudioTimelineOriginV0(
	bytes: Uint8Array,
): Readonly<DraftAudioTimelineOriginV0> {
	const header = parseAudioFrameV0Header(bytes);
	const epoch = BigInt(header.epoch);
	if (epoch > BigInt(Number.MAX_SAFE_INTEGER)) throw new AudioTimelineAdapterV0Error();
	return Object.freeze({
		sessionNonceHex: header.sessionNonceHex,
		source: header.source,
		sampleRate: header.sampleRate,
		range: Object.freeze({
			epoch: Number(epoch),
			start: header.sampleStart,
			end: header.sampleEnd,
		}),
	});
}
