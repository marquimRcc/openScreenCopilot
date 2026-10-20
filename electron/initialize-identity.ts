// MUST be the first import in main.ts: IPC/model stores compute paths at import time.
import { mkdirSync } from "node:fs";
import { app } from "electron";
import { APP_DATA_OVERRIDE_ENV, initializeAppIdentity } from "./app-identity";

initializeAppIdentity(
	app,
	(directory) => mkdirSync(directory, { recursive: true }),
	process.platform,
	process.env[APP_DATA_OVERRIDE_ENV],
);
