import path from "node:path";
import {
	resolveSpeechSidecarExecutableV0,
	type SpeechSidecarExecutableV0Options,
} from "./speechSidecarExecutableV0";
import { createSpeechSidecarIdentityV0 } from "./speechSidecarIdentityV0";
import {
	launchSpeechSidecarV0,
	type SpeechSidecarLauncherV0Options,
} from "./speechSidecarLauncherV0";
import {
	type SpeechSidecarProcessBindingV0,
	type SpeechSidecarProcessV0,
} from "./speechSidecarProcessBindingV0";

export interface SpeechSidecarServiceV0Options
	extends Omit<SpeechSidecarExecutableV0Options, "canonicalize">,
		Omit<SpeechSidecarLauncherV0Options, "authorizedExecutablePath" | "canonicalize" | "identity"> {
	readonly canonicalize: (candidate: string) => string;
	readonly identity?: SpeechSidecarLauncherV0Options["identity"];
}

/** Creates the dormant handshake service only when its exact staged resource exists. */
export function createSpeechSidecarServiceV0(
	options: SpeechSidecarServiceV0Options,
): SpeechSidecarProcessBindingV0<SpeechSidecarProcessV0> | null {
	const executable = resolveSpeechSidecarExecutableV0(options);
	if (executable === null) return null;
	return launchSpeechSidecarV0({
		...options,
		identity: options.identity ?? createSpeechSidecarIdentityV0(),
		authorizedExecutablePath: executable,
		canonicalize: (candidate) => {
			const recanonical = options.canonicalize(candidate);
			if (path.dirname(recanonical) !== path.dirname(executable))
				throw new Error("resource-escape");
			return recanonical;
		},
	});
}
