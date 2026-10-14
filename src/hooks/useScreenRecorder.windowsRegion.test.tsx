// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/I18nContext", () => ({ useScopedT: () => (key: string) => key }));
vi.mock("sonner", () => ({
	toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { useScreenRecorder } from "./useScreenRecorder";

describe("Windows region capture never falls back to the full monitor", () => {
	let nativeStart: ReturnType<typeof vi.fn>;
	let browserStart: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		vi.useFakeTimers();
		nativeStart = vi.fn().mockResolvedValue({ success: true, recordingId: 7 });
		browserStart = vi.fn();
		window.electronAPI = {
			getPlatform: () => "win32",
			getRecordingPrefs: vi.fn().mockResolvedValue({
				micEnabled: false,
				camEnabled: false,
				systemAudioEnabled: false,
				cursorCaptureMode: "system",
			}),
			getSelectedSource: vi.fn().mockResolvedValue({
				id: "screen:7:0",
				name: "Region",
				display_id: "7",
				captureRegion: {
					displayId: 7,
					sourceWidthPx: 1920,
					sourceHeightPx: 1080,
					regionPx: { x: 100, y: 100, width: 800, height: 600 },
				},
			}),
			isNativeWindowsCaptureAvailable: vi
				.fn()
				.mockResolvedValue({ success: true, available: true, supportsRegion: true }),
			startNativeWindowsRecording: nativeStart,
			showCountdownOverlay: vi.fn(),
			setCountdownOverlayValue: vi.fn(),
			hideCountdownOverlay: vi.fn(),
			setRecordingState: vi.fn(),
		} as unknown as Window["electronAPI"];
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: {
				getDisplayMedia: browserStart,
				getUserMedia: browserStart,
				enumerateDevices: vi.fn().mockResolvedValue([]),
			},
		});
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	async function record() {
		const view = renderHook(() => useScreenRecorder());
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		await act(async () => {
			view.result.current.toggleRecording();
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3500);
		});
		return view;
	}
	it("passes only a region marker to native main, not renderer-owned coordinates", async () => {
		const view = await record();
		expect(nativeStart).toHaveBeenCalledWith(
			expect.objectContaining({
				source: expect.objectContaining({ captureRegion: true, sourceId: "screen:7:0" }),
			}),
		);
		expect(view.result.current.recording).toBe(true);
		expect(browserStart).not.toHaveBeenCalled();
	});
	it.each([
		"missing-helper",
		"unsupported-os",
	])("refuses browser fallback when native is %s", async (reason) => {
		vi.mocked(window.electronAPI.isNativeWindowsCaptureAvailable).mockResolvedValue({
			success: true,
			available: false,
			reason,
		});
		const view = await record();
		expect(nativeStart).not.toHaveBeenCalled();
		expect(browserStart).not.toHaveBeenCalled();
		expect(view.result.current.recording).toBe(false);
	});
	it("refuses an old helper which cannot prove crop capability", async () => {
		vi.mocked(window.electronAPI.isNativeWindowsCaptureAvailable).mockResolvedValue({
			success: true,
			available: true,
		});
		await record();
		expect(nativeStart).not.toHaveBeenCalled();
		expect(browserStart).not.toHaveBeenCalled();
	});
});
