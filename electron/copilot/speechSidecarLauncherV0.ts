import {
	type ChildProcessWithoutNullStreams,
	spawn as nodeSpawn,
	type SpawnOptions,
} from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
	SpeechSidecarProcessBindingV0,
	type SpeechSidecarProcessBindingV0Options,
	type SpeechSidecarProcessV0,
} from "./speechSidecarProcessBindingV0";
import { encodeSpeechSidecarV0Hello } from "./speechSidecarProtocolV0";

export class SpeechSidecarLaunchV0Error extends Error {
	constructor(readonly code: "path" | "spawn") {
		super(`speech-sidecar-launch-v0:${code}`);
		this.name = "SpeechSidecarLaunchV0Error";
	}
}

export type SpeechSidecarSpawnV0 = (
	executablePath: string,
	args: readonly string[],
	options: SpawnOptions,
) => SpeechSidecarProcessV0;

export interface SpeechSidecarLauncherV0Options extends SpeechSidecarProcessBindingV0Options {
	/** Path selected by trusted main-process packaging/configuration code. */
	readonly authorizedExecutablePath: string;
	readonly canonicalize?: (path: string) => string;
	readonly spawn?: SpeechSidecarSpawnV0;
}

const defaultSpawn: SpeechSidecarSpawnV0 = (executablePath, args, options) =>
	nodeSpawn(executablePath, args, options) as unknown as ChildProcessWithoutNullStreams &
		SpeechSidecarProcessV0;

/**
 * Launches the dormant v0 handshake only. No PCM, model, provider or renderer IPC.
 * Authorization of the canonical path remains the caller's responsibility.
 */
export function launchSpeechSidecarV0(
	options: SpeechSidecarLauncherV0Options,
): SpeechSidecarProcessBindingV0<SpeechSidecarProcessV0> {
	// Complete protocol validation before process creation.
	encodeSpeechSidecarV0Hello({
		sessionId: options.identity.sessionId,
		nonce: options.identity.nonce,
		seq: options.identity.helloSeq,
	});
	if (!isAbsolute(options.authorizedExecutablePath)) throw new SpeechSidecarLaunchV0Error("path");
	let executablePath: string;
	try {
		executablePath = (options.canonicalize ?? realpathSync)(options.authorizedExecutablePath);
	} catch {
		throw new SpeechSidecarLaunchV0Error("path");
	}
	if (!isAbsolute(executablePath)) throw new SpeechSidecarLaunchV0Error("path");

	let proc: SpeechSidecarProcessV0;
	try {
		proc = (options.spawn ?? defaultSpawn)(executablePath, [], {
			shell: false,
			windowsHide: true,
			stdio: ["pipe", "pipe", "ignore"],
		});
	} catch {
		throw new SpeechSidecarLaunchV0Error("spawn");
	}

	try {
		const binding = new SpeechSidecarProcessBindingV0(proc, options);
		binding.start();
		return binding;
	} catch (error) {
		try {
			proc.kill("SIGTERM");
		} catch {
			// A failed kill is not proof of exit; the caller receives the setup failure.
		}
		throw error;
	}
}
