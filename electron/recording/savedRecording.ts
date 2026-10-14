import path from "node:path";
import type { SavedRecordingResult } from "../../src/lib/savedRecording";

interface SavedRecordingDeps {
	getCurrentPath(): string | null;
	isAllowed(file: string): boolean;
	isRecording(): boolean;
	isEditorDirty(): boolean;
	stat(file: string): Promise<{ size: number; isFile(): boolean }>;
	reveal(file: string): void;
	openResult(): void;
	prepareCapture(): void;
}

export function createSavedRecordingActions(deps: SavedRecordingDeps) {
	const fail = (message: string): SavedRecordingResult => ({ success: false, error: message });
	const busy = () => deps.isRecording() || deps.isEditorDirty();
	async function getInfo(expectedPath?: string): Promise<SavedRecordingResult> {
		const file = deps.getCurrentPath();
		if (!file || !deps.isAllowed(file) || (expectedPath !== undefined && expectedPath !== file)) {
			return fail("Saved recording is no longer available.");
		}
		try {
			const stats = await deps.stat(file);
			if (!stats.isFile() || stats.size <= 0 || deps.getCurrentPath() !== file) {
				return fail("Saved recording is no longer available.");
			}
			return {
				success: true,
				recording: {
					path: file,
					name: path.basename(file),
					folder: path.dirname(file),
					sizeBytes: stats.size,
				},
			};
		} catch {
			return fail("Saved recording could not be found.");
		}
	}
	return {
		getInfo,
		async showResult(): Promise<SavedRecordingResult> {
			if (busy()) return fail("Recording is active or the editor has unsaved changes.");
			const info = await getInfo();
			if (!info.success || busy()) return info.success ? fail("Application state changed.") : info;
			deps.openResult();
			return info;
		},
		async reveal(expectedPath: string): Promise<SavedRecordingResult> {
			const info = await getInfo(expectedPath);
			if (!info.success || !info.recording) return info;
			try {
				deps.reveal(info.recording.path);
				return { success: true };
			} catch {
				return fail("Could not reveal the saved recording.");
			}
		},
		prepare(): SavedRecordingResult {
			if (busy()) return fail("Recording is active or the editor has unsaved changes.");
			deps.prepareCapture();
			return { success: true };
		},
	};
}
