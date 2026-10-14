export interface SavedRecordingInfo {
	path: string;
	name: string;
	folder: string;
	sizeBytes: number;
}

export interface SavedRecordingResult {
	success: boolean;
	recording?: SavedRecordingInfo;
	error?: string;
}

/** Called only after the capture has been finalized and its session published. */
export async function showSavedRecording(
	api: Pick<Window["electronAPI"], "switchToEditor" | "showRecordingResult" | "setRecordingState">,
): Promise<void> {
	// Await main's idle state before opening a new window; React's state update
	// alone does not guarantee the tray/recording guard has seen the stop yet.
	await api.setRecordingState?.(false);
	const cli = new URLSearchParams(window.location.search).get("windowType") === "cli-record";
	if (api.showRecordingResult && !cli) {
		const result = await api.showRecordingResult();
		if (!result.success) throw new Error(result.error ?? "Could not open the saved recording.");
		return;
	}
	// Legacy preload/browser/CLI compatibility. Never mask a failed result IPC
	// with a second window transition which might discard the current state.
	await api.switchToEditor();
}

export function recordingSizeLabel(bytes: number, locale?: string): string {
	const mb = bytes >= 1_000_000;
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (mb ? 1_000_000 : 1_000))} ${mb ? "MB" : "KB"}`;
}

export function recordingDurationLabel(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "—";
	const total = Math.floor(seconds);
	const parts = [Math.floor(total / 60) % 60, total % 60].map((value) =>
		String(value).padStart(2, "0"),
	);
	if (total >= 3600) parts.unshift(String(Math.floor(total / 3600)));
	return parts.join(":");
}
