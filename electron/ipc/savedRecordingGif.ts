import type { BrowserWindow, IpcMain } from "electron";
import type { SavedGifProgress } from "../../src/lib/savedRecordingGif";
import { openVideoInHiddenWindow } from "../mcp/hidden-video";
import { resolveFfmpeg } from "../media/audioPeaks";
import type { CompositorViewService } from "../native-bridge/services/compositorViewService";
import { SavedRecordingGifs } from "../recording/savedRecordingGif";
import { validateSavedGif } from "../recording/validateSavedGif";
import type { ExportOwner } from "./exportJobs";

export function isRecordingResultOwner(
	window: BrowserWindow | null,
	owner: Pick<ExportOwner, "isDestroyed">,
): boolean {
	if (!window || window.isDestroyed() || owner.isDestroyed() || window.webContents !== owner)
		return false;
	try {
		const url = new URL(window.webContents.getURL());
		const dev = process.env.VITE_DEV_SERVER_URL;
		const localRenderer = url.protocol === "file:" || (dev && url.origin === new URL(dev).origin);
		return Boolean(localRenderer && url.searchParams.get("windowType") === "recording-result");
	} catch {
		return false;
	}
}

/** Registers only owner-scoped GIF commands, never generic file/scene permissions. */
export function registerSavedRecordingGifHandlers(context: {
	ipc: Pick<IpcMain, "handle">;
	window(): BrowserWindow | null;
	current(): { key: string; path: string } | null;
	isBusy(): boolean;
	compositor: Pick<CompositorViewService, "startGifExport">;
	pick(owner: ExportOwner, suggestedName: string): Promise<string | null>;
}) {
	const gifs = new SavedRecordingGifs({
		current: context.current,
		isBusy: context.isBusy,
		isOwnerCurrent: (owner) => isRecordingResultOwner(context.window(), owner),
		probe: async (file, signal) => {
			if (!resolveFfmpeg()) throw new Error("GIF validation decoder is unavailable.");
			const video = await openVideoInHiddenWindow(file);
			try {
				signal.throwIfAborted();
				return { durationSec: video.durationSec, width: video.width, height: video.height };
			} finally {
				video.close();
			}
		},
		pick: async (owner, name) => {
			if (!isRecordingResultOwner(context.window(), owner))
				throw new Error("Recording result window changed.");
			return context.pick(owner, name);
		},
		start: (prepared, output, progress) =>
			context.compositor.startGifExport(
				prepared.clips,
				output,
				JSON.stringify(prepared.scene),
				prepared.params,
				progress,
			),
		validate: async (file, plan, signal) => {
			const ffmpeg = resolveFfmpeg();
			if (!ffmpeg) throw new Error("GIF validation decoder is unavailable.");
			await validateSavedGif(file, plan, ffmpeg, signal);
		},
		progress: (owner, frames, totalFrames, jobId) => {
			const window = context.window();
			if (!isRecordingResultOwner(window, owner)) return;
			const progress: SavedGifProgress = { jobId, frames, totalFrames };
			window?.webContents.send("saved-recording-gif-progress", progress);
		},
	});
	context.ipc.handle(
		"export-saved-recording-gif",
		(event, expectedPath: string, request: unknown) => {
			if (event.senderFrame !== event.sender.mainFrame)
				return { success: false, error: "GIF requests require the main result frame." };
			return gifs.export(event.sender, expectedPath, request);
		},
	);
	context.ipc.handle("cancel-saved-recording-gif", (event) => ({
		accepted: event.senderFrame === event.sender.mainFrame && gifs.cancel(event.sender),
	}));
	return gifs;
}
