import path from "node:path";
import { APP_ID, PRODUCT_NAME } from "../src/config/product";

export interface IdentityHost {
	isPackaged: boolean;
	getPath(name: "appData"): string;
	setName(name: string): void;
	setPath(name: "appData" | "userData" | "sessionData", value: string): void;
	setAppUserModelId(id: string): void;
}

export const APP_DATA_OVERRIDE_ENV = "OPENSCREEN_APP_DATA_DIR";

export function validateAppDataOverride(
	rawPath: string,
	platform: NodeJS.Platform = process.platform,
): string {
	const trimmed = rawPath.trim();
	if (!trimmed) {
		throw new Error(`${APP_DATA_OVERRIDE_ENV} cannot be empty or whitespace`);
	}
	if (platform === "win32") {
		const isDriveAbsolute = /^[a-zA-Z]:[/\\]/.test(trimmed);
		const isUncAbsolute = /^([/\\]{2})[^/\\]+[/\\]+[^/\\]+/.test(trimmed);
		if (!isDriveAbsolute && !isUncAbsolute) {
			throw new Error(
				`${APP_DATA_OVERRIDE_ENV} must be a fully qualified absolute path on Windows: "${rawPath}"`,
			);
		}
		return path.win32.normalize(trimmed);
	}
	if (!path.posix.isAbsolute(trimmed)) {
		throw new Error(`${APP_DATA_OVERRIDE_ENV} must be an absolute path: "${rawPath}"`);
	}
	return path.posix.normalize(trimmed);
}

export function profilePaths(appData: string, packaged: boolean) {
	const userData = path.join(appData, packaged ? PRODUCT_NAME : `${PRODUCT_NAME}-dev`);
	return { userData, sessionData: path.join(userData, "chromium") };
}

/** Run before modules that compute paths and before the single-instance lock. */
export function initializeAppIdentity(
	host: IdentityHost,
	ensureDirectory: (directory: string) => void,
	platform: NodeJS.Platform,
	appDataOverride?: string | null,
) {
	if (appDataOverride !== undefined && appDataOverride !== null) {
		const validatedRoot = validateAppDataOverride(appDataOverride, platform);
		ensureDirectory(validatedRoot);
		host.setPath("appData", validatedRoot);
	}
	const paths = profilePaths(host.getPath("appData"), host.isPackaged);
	ensureDirectory(paths.userData);
	ensureDirectory(paths.sessionData);
	host.setName(PRODUCT_NAME);
	host.setPath("userData", paths.userData);
	host.setPath("sessionData", paths.sessionData);
	if (platform === "win32") host.setAppUserModelId(APP_ID);
	return paths;
}
