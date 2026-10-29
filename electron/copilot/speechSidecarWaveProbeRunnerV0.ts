import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import {
	parseSpeechSidecarWaveProbeV0,
	type SpeechSidecarWaveProbeV0,
} from "./speechSidecarWaveProbeV0";

export interface SpeechSidecarWaveProbeExecV0Options {
	readonly timeout: number;
	readonly maxBuffer: number;
	readonly windowsHide: boolean;
	readonly shell: false;
}

export type SpeechSidecarWaveProbeExecV0 = (
	executable: string,
	args: readonly string[],
	options: SpeechSidecarWaveProbeExecV0Options,
) => Promise<string>;

export interface SpeechSidecarWaveProbeRunnerV0Options {
	readonly authorizedExecutablePath: string;
	readonly authorizedWavePath: string;
	readonly canonicalize?: (candidate: string) => string;
	readonly exec?: SpeechSidecarWaveProbeExecV0;
}

export class SpeechSidecarWaveProbeRunnerV0Error extends Error {
	constructor(readonly code: "path" | "process" | "output") {
		super(`speech-sidecar-wave-probe-runner-v0:${code}`);
		this.name = "SpeechSidecarWaveProbeRunnerV0Error";
	}
}

const defaultExec: SpeechSidecarWaveProbeExecV0 = (executable, args, options) =>
	new Promise((resolve, reject) => {
		execFile(executable, args, { ...options, encoding: "utf8" }, (error, stdout) => {
			if (error) reject(error);
			else resolve(stdout);
		});
	});

export async function runSpeechSidecarWaveProbeV0(
	options: SpeechSidecarWaveProbeRunnerV0Options,
): Promise<SpeechSidecarWaveProbeV0> {
	if (
		!path.isAbsolute(options.authorizedExecutablePath) ||
		!path.isAbsolute(options.authorizedWavePath)
	)
		throw new SpeechSidecarWaveProbeRunnerV0Error("path");
	const canonicalize = options.canonicalize ?? realpathSync;
	let executable: string;
	let wave: string;
	try {
		executable = canonicalize(options.authorizedExecutablePath);
		wave = canonicalize(options.authorizedWavePath);
	} catch {
		throw new SpeechSidecarWaveProbeRunnerV0Error("path");
	}
	if (!path.isAbsolute(executable) || !path.isAbsolute(wave))
		throw new SpeechSidecarWaveProbeRunnerV0Error("path");
	let stdout: string;
	try {
		stdout = await (options.exec ?? defaultExec)(executable, ["--probe-wave", wave], {
			timeout: 5_000,
			maxBuffer: 4_096,
			windowsHide: true,
			shell: false,
		});
	} catch {
		throw new SpeechSidecarWaveProbeRunnerV0Error("process");
	}
	const line = stdout.endsWith("\n") ? stdout.slice(0, -1).replace(/\r$/, "") : stdout;
	if (line.includes("\n") || line.includes("\r"))
		throw new SpeechSidecarWaveProbeRunnerV0Error("output");
	try {
		return parseSpeechSidecarWaveProbeV0(line);
	} catch {
		throw new SpeechSidecarWaveProbeRunnerV0Error("output");
	}
}
