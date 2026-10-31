import { realpathSync } from "node:fs";
import path from "node:path";
import {
	resolveSpeechSidecarExecutableV0,
	type SpeechSidecarExecutableV0Options,
} from "./speechSidecarExecutableV0";
import {
	runSpeechSidecarWaveProbeV0,
	type SpeechSidecarWaveProbeExecV0,
} from "./speechSidecarWaveProbeRunnerV0";
import type { SpeechSidecarWaveProbeV0 } from "./speechSidecarWaveProbeV0";

export type SpeechSidecarWaveProbeRunV0 = (options: {
	readonly authorizedExecutablePath: string;
	readonly authorizedWavePath: string;
}) => Promise<SpeechSidecarWaveProbeV0>;

export interface SpeechSidecarWaveProbeServiceV0Options {
	readonly executable: SpeechSidecarExecutableV0Options;
	readonly authorizedWavePath: string;
	readonly run?: SpeechSidecarWaveProbeRunV0;
	readonly exec?: SpeechSidecarWaveProbeExecV0;
}

/** Resolves only the staged resource slot before running the explicit diagnostic probe. */
export async function probeSpeechSidecarWaveResourceV0(
	options: SpeechSidecarWaveProbeServiceV0Options,
): Promise<SpeechSidecarWaveProbeV0 | null> {
	const executable = resolveSpeechSidecarExecutableV0(options.executable);
	if (executable === null) return null;
	const paths = {
		authorizedExecutablePath: executable,
		authorizedWavePath: options.authorizedWavePath,
	};
	if (options.run) return options.run(paths);
	return runSpeechSidecarWaveProbeV0({
		...paths,
		...(options.exec ? { exec: options.exec } : {}),
		canonicalize: (candidate) => {
			if (candidate !== executable) return realpathSync(candidate);
			const recanonical = options.executable.canonicalize(candidate);
			if (path.dirname(recanonical) !== path.dirname(executable))
				throw new Error("resource-escape");
			return recanonical;
		},
	});
}
