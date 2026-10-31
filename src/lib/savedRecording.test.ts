// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordingDurationLabel, recordingSizeLabel, showSavedRecording } from "./savedRecording";

afterEach(() => window.history.replaceState(null, "", "/"));
describe("saved recording handoff", () => {
	it("awaits idle state before showing the simple result", async () => {
		const order: string[] = [];
		await showSavedRecording({
			setRecordingState: vi.fn(async () => {
				order.push("idle");
			}),
			showRecordingResult: vi.fn(async () => {
				order.push("result");
				return { success: true };
			}),
			switchToEditor: vi.fn(),
		});
		expect(order).toEqual(["idle", "result"]);
	});
	it("does not fall back to closing windows on a failed result handoff", async () => {
		const editor = vi.fn();
		await expect(
			showSavedRecording({
				setRecordingState: vi.fn(),
				showRecordingResult: vi.fn().mockResolvedValue({ success: false, error: "File missing" }),
				switchToEditor: editor,
			}),
		).rejects.toThrow("File missing");
		expect(editor).not.toHaveBeenCalled();
	});
	it("preserves legacy preload and CLI editor contract", async () => {
		const editor = vi.fn();
		await showSavedRecording({ setRecordingState: vi.fn(), switchToEditor: editor });
		expect(editor).toHaveBeenCalledOnce();
		window.history.replaceState(null, "", "/?windowType=cli-record");
		const result = vi.fn();
		await showSavedRecording({
			setRecordingState: vi.fn(),
			showRecordingResult: result,
			switchToEditor: editor,
		});
		expect(editor).toHaveBeenCalledTimes(2);
		expect(result).not.toHaveBeenCalled();
	});
	it("formats duration without pretending unknown metadata is zero", () => {
		expect(recordingDurationLabel(65.9)).toBe("01:05");
		expect(recordingDurationLabel(3661)).toBe("1:01:01");
		expect(recordingDurationLabel(Infinity)).toBe("—");
		expect(recordingDurationLabel(Number.NaN)).toBe("—");
	});
	it("uses decimal file-size units", () => {
		expect(recordingSizeLabel(1500000, "en")).toBe("1.5 MB");
		expect(recordingSizeLabel(1500, "en")).toBe("1.5 KB");
	});
});
