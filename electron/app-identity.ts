import path from "node:path";
import { APP_ID, PRODUCT_NAME } from "../src/config/product";

export interface IdentityHost {
	isPackaged: boolean;
	getPath(name: "appData"): string;
	setName(name: string): void;
	setPath(name: "userData" | "sessionData", value: string): void;
	setAppUserModelId(id: string): void;
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
) {
	const paths = profilePaths(host.getPath("appData"), host.isPackaged);
	ensureDirectory(paths.userData);
	ensureDirectory(paths.sessionData);
	host.setName(PRODUCT_NAME);
	host.setPath("userData", paths.userData);
	host.setPath("sessionData", paths.sessionData);
	if (platform === "win32") host.setAppUserModelId(APP_ID);
	return paths;
}
