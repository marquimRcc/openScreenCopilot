/** Draft v0 arithmetic only. Not imported by capture, IPC, or the ASR runtime.
 * Caller scopes spans to ONE session/source; this grants no file/audio permission.
 */
export interface DraftSourceSpan {
	epoch: number;
	rate: number;
	start: string;
	end: string;
	mediaStartNs: string;
}

export interface DraftSourceRange {
	epoch: number;
	start: string;
	end: string;
}

const U64_MAX = (1n << 64n) - 1n;
const NS_PER_SECOND = 1_000_000_000n;

function u64(value: string): bigint {
	if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value)) {
		throw new Error("invalid-u64");
	}
	const parsed = BigInt(value);
	if (parsed > U64_MAX) throw new Error("invalid-u64");
	return parsed;
}

function epoch(value: number): void {
	if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid-epoch");
}

/** Half-open sample range, wholly contained by exactly one span. No pause subtraction. */
export function mapDraftSourceRange(
	spans: readonly DraftSourceSpan[],
	range: DraftSourceRange,
): { startNs: string; endNs: string } {
	epoch(range.epoch);
	const start = u64(range.start);
	const end = u64(range.end);
	if (end <= start) throw new Error("invalid-range");
	let result: { startNs: string; endNs: string } | undefined;
	let intersections = 0;
	for (const span of spans) {
		epoch(span.epoch);
		if (!Number.isSafeInteger(span.rate) || span.rate < 1 || span.rate > 192000) {
			throw new Error("invalid-rate");
		}
		const spanStart = u64(span.start);
		const spanEnd = u64(span.end);
		const mediaStart = u64(span.mediaStartNs);
		if (spanEnd <= spanStart) throw new Error("invalid-span");
		const map = (sample: bigint) =>
			mediaStart + ((sample - spanStart) * NS_PER_SECOND) / BigInt(span.rate);
		if (map(spanEnd) > U64_MAX) throw new Error("media-overflow");
		if (span.epoch !== range.epoch || start >= spanEnd || end <= spanStart) continue;
		intersections += 1;
		if (start < spanStart || end > spanEnd) continue;
		if (result) throw new Error("ambiguous-span");
		result = { startNs: map(start).toString(), endNs: map(end).toString() };
	}
	if (!result) throw new Error("no-single-span");
	if (intersections !== 1) throw new Error("ambiguous-span");
	return result;
}
