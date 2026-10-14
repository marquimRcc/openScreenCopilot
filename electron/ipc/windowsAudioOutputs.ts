import type {
	BrowserWindow,
	IpcMain,
	IpcMainInvokeEvent,
	WebContents,
	WebFrameMain,
} from "electron";
import { listWindowsAudioOutputs, type WindowsAudioOutput } from "../recording/windowsAudioOutputs";

export type WindowsAudioOutputsResult =
	| { success: true; devices: WindowsAudioOutput[] }
	| {
			success: false;
			devices: [];
			errorCode:
				| "invalid-owner"
				| "unsupported-platform"
				| "busy"
				| "missing-helper"
				| "enumeration-failed";
	  };

export function isWindowsAudioOutputOwner(
	window: BrowserWindow | null,
	event: IpcMainInvokeEvent,
): boolean {
	return isWindowsAudioOutputFrameOwner(window, event.sender, event.senderFrame);
}

export function isWindowsAudioOutputFrameOwner(
	window: BrowserWindow | null,
	sender: WebContents,
	frame: WebFrameMain | null,
): boolean {
	if (
		!window ||
		window.isDestroyed() ||
		sender.isDestroyed() ||
		window.webContents !== sender ||
		!frame ||
		frame !== sender.mainFrame
	)
		return false;
	try {
		const url = new URL(sender.getURL());
		const dev = process.env.VITE_DEV_SERVER_URL;
		const local = url.protocol === "file:" || (dev && url.origin === new URL(dev).origin);
		const role = url.searchParams.get("windowType");
		return Boolean(local && (role === "hud-overlay" || role === "editor"));
	} catch {
		return false;
	}
}

export function registerWindowsAudioOutputHandlers(context: {
	ipc: Pick<IpcMain, "handle">;
	window(): BrowserWindow | null;
	isSupported(): boolean;
	helper(): Promise<string | null>;
}) {
	let pending = false;
	const isOwner = (event: IpcMainInvokeEvent) => isWindowsAudioOutputOwner(context.window(), event);
	context.ipc.handle(
		"list-windows-audio-outputs",
		async (event): Promise<WindowsAudioOutputsResult> => {
			const failure = (
				errorCode: Extract<WindowsAudioOutputsResult, { success: false }>["errorCode"],
			): WindowsAudioOutputsResult => ({ success: false, devices: [], errorCode });
			if (!isOwner(event)) return failure("invalid-owner");
			if (!context.isSupported()) return failure("unsupported-platform");
			if (pending) return failure("busy");
			pending = true;
			try {
				const helper = await context.helper();
				if (!isOwner(event)) return failure("invalid-owner");
				if (!helper) return failure("missing-helper");
				const devices = await listWindowsAudioOutputs(helper);
				if (!isOwner(event)) return failure("invalid-owner");
				return { success: true, devices };
			} catch {
				return failure("enumeration-failed");
			} finally {
				pending = false;
			}
		},
	);
}
