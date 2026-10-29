import {
	resolveSpeechSidecarExecutableV0,
	type SpeechSidecarExecutableV0Options,
} from "./speechSidecarExecutableV0";
import { runSpeechSidecarWaveProbeV0 } from "./speechSidecarWaveProbeRunnerV0";
import type { SpeechSidecarWaveProbeV0 } from "./speechSidecarWaveProbeV0";

export type SpeechSidecarWaveProbeRunV0 = (options: {
	readonly authorizedExecutablePath: string;
	readonly authorizedWavePath: string;
}) => Promise<SpeechSidecarWaveProbeV0>;

export interface SpeechSidecarWaveProbeServiceV0Options {
	readonly executable: SpeechSidecarExecutableV0Options;
	readonly authorizedWavePath: string;
	readonly run?: SpeechSidecarWaveProbeRunV0;
}

/** Resolves only the staged resource slot before running the explicit diagnostic probe. */
export async function probeSpeechSidecarWaveResourceV0(
	options: SpeechSidecarWaveProbeServiceV0Options,
): Promise<SpeechSidecarWaveProbeV0 | null> {
	const executable = resolveSpeechSidecarExecutableV0(options.executable);
	if (executable === null) return null;
	return (options.run ?? runSpeechSidecarWaveProbeV0)({
		authorizedExecutablePath: executable,
		authorizedWavePath: options.authorizedWavePath,
	});
}
