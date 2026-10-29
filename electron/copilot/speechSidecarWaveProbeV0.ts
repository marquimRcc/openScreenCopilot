const MAX_PROBE_LINE_BYTES = 4_096;
const MAX_SAMPLES = 1_048_576;

export interface SpeechSidecarWaveProbeV0 {
	readonly version: 0;
	readonly kind: "wave.normalized";
	readonly sourceRate: 16_000 | 44_100 | 48_000;
	readonly sampleRate: 16_000;
	readonly samples: string;
	readonly availabilityDelayFrames: string;
	readonly activityGate: "energy-rms-diagnostic-v0";
	readonly activityFrameSamples: 160;
	readonly activityFrames: string;
	readonly activityStarts: string;
	readonly activityStops: string;
	readonly activityTailSamples: number;
	readonly activityAtEnd: boolean;
}

export class SpeechSidecarWaveProbeV0Error extends Error {
	constructor(readonly code: "length" | "json" | "schema" | "range") {
		super(`speech-sidecar-wave-probe-v0:${code}`);
		this.name = "SpeechSidecarWaveProbeV0Error";
	}
}

function boundedCount(value: unknown): string {
	if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))
		throw new SpeechSidecarWaveProbeV0Error("range");
	if (BigInt(value) > BigInt(MAX_SAMPLES)) throw new SpeechSidecarWaveProbeV0Error("range");
	return value;
}

export function parseSpeechSidecarWaveProbeV0(line: string): SpeechSidecarWaveProbeV0 {
	if (Buffer.byteLength(line, "utf8") > MAX_PROBE_LINE_BYTES)
		throw new SpeechSidecarWaveProbeV0Error("length");
	let value: unknown;
	try {
		value = JSON.parse(line);
	} catch {
		throw new SpeechSidecarWaveProbeV0Error("json");
	}
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new SpeechSidecarWaveProbeV0Error("schema");
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort();
	const expected = [
		"activityAtEnd",
		"activityFrameSamples",
		"activityFrames",
		"activityGate",
		"activityStarts",
		"activityStops",
		"activityTailSamples",
		"availabilityDelayFrames",
		"kind",
		"sampleRate",
		"samples",
		"sourceRate",
		"version",
	];
	if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]))
		throw new SpeechSidecarWaveProbeV0Error("schema");
	if (
		record.version !== 0 ||
		record.kind !== "wave.normalized" ||
		record.sampleRate !== 16_000 ||
		record.activityGate !== "energy-rms-diagnostic-v0" ||
		record.activityFrameSamples !== 160 ||
		typeof record.activityAtEnd !== "boolean" ||
		!Number.isInteger(record.activityTailSamples) ||
		(record.activityTailSamples as number) < 0 ||
		(record.activityTailSamples as number) >= 160 ||
		!new Set([16_000, 44_100, 48_000]).has(record.sourceRate as number)
	)
		throw new SpeechSidecarWaveProbeV0Error("schema");
	const samples = boundedCount(record.samples);
	const activityFrames = boundedCount(record.activityFrames);
	const activityStarts = boundedCount(record.activityStarts);
	const activityStops = boundedCount(record.activityStops);
	const starts = BigInt(activityStarts);
	const stops = BigInt(activityStops);
	if (
		BigInt(activityFrames) * 160n + BigInt(record.activityTailSamples as number) !==
			BigInt(samples) ||
		starts > BigInt(activityFrames) ||
		stops > starts ||
		(record.activityAtEnd ? starts !== stops + 1n : starts !== stops)
	)
		throw new SpeechSidecarWaveProbeV0Error("range");
	return Object.freeze({
		version: 0,
		kind: "wave.normalized",
		sourceRate: record.sourceRate as 16_000 | 44_100 | 48_000,
		sampleRate: 16_000,
		samples,
		availabilityDelayFrames: boundedCount(record.availabilityDelayFrames),
		activityGate: "energy-rms-diagnostic-v0",
		activityFrameSamples: 160,
		activityFrames,
		activityStarts,
		activityStops,
		activityTailSamples: record.activityTailSamples as number,
		activityAtEnd: record.activityAtEnd,
	});
}
