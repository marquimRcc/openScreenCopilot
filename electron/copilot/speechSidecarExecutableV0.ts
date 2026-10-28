import path from "node:path";

export type SpeechSidecarExecutablePlatformV0 = "win32" | "darwin" | "linux";
export type SpeechSidecarExecutableArchV0 = "x64" | "arm64";

export interface SpeechSidecarExecutableV0Options {
	readonly isPackaged: boolean;
	readonly resourcesPath: string;
	readonly appPath: string;
	readonly platform: SpeechSidecarExecutablePlatformV0;
	readonly arch: SpeechSidecarExecutableArchV0;
	readonly exists: (candidate: string) => boolean;
	readonly canonicalize: (candidate: string) => string;
}

/** Resolves only the per-platform resource slot shipped by electron-builder. */
export function resolveSpeechSidecarExecutableV0(
	options: SpeechSidecarExecutableV0Options,
): string | null {
	const tag = `${options.platform}-${options.arch}`;
	const filename = `openscreen-speech-sidecar${options.platform === "win32" ? ".exe" : ""}`;
	const root = options.isPackaged ? options.resourcesPath : options.appPath;
	const candidate = path.join(root, "electron", "native", "bin", tag, filename);
	if (!path.isAbsolute(candidate) || !options.exists(candidate)) return null;
	let canonical: string;
	try {
		canonical = options.canonicalize(candidate);
	} catch {
		return null;
	}
	return path.isAbsolute(canonical) ? canonical : null;
}
