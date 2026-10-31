// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/I18nContext", () => ({
	useScopedT: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
	toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { toast } from "sonner";
import { useScreenRecorder } from "./useScreenRecorder";

type ElectronAPI = Window["electronAPI"];

interface CaptureEndedPayload {
	recordingId: number;
	code?: number | null;
	signal?: string | null;
	reason?: string;
}

const SOURCE = { id: "screen:0:0", name: "Screen 1", display_id: "1", thumbnail: "" };

let api: Record<string, ReturnType<typeof vi.fn>>;
let captureEndedListener: ((payload: CaptureEndedPayload) => void) | null = null;

function stubElectronAPI(overrides: Record<string, unknown> = {}) {
	captureEndedListener = null;
	api = {
		getRecordingPrefs: vi.fn(async () => null),
		getPlatform: vi.fn(() => "win32"),
		getSelectedSource: vi.fn(async () => SOURCE),
		isNativeWindowsCaptureAvailable: vi.fn(async () => ({ success: true, available: true })),
		startNativeWindowsRecording: vi.fn(async () => ({ success: true, recordingId: 77 })),
		stopNativeWindowsRecording: vi.fn(async () => ({ success: true })),
		queryNativeWindowsCaptureStatus: vi.fn(async () => ({ active: true, closed: false })),
		onNativeWindowsCaptureEnded: vi.fn((listener: (payload: CaptureEndedPayload) => void) => {
			captureEndedListener = listener;
			return () => {
				captureEndedListener = null;
			};
		}),
		showCountdownOverlay: vi.fn(async () => true),
		setCountdownOverlayValue: vi.fn(async () => true),
		hideCountdownOverlay: vi.fn(async () => true),
		setCurrentRecordingSession: vi.fn(async () => undefined),
		setCurrentVideoPath: vi.fn(async () => undefined),
		switchToEditor: vi.fn(async () => undefined),
	};
	window.electronAPI = { ...api, ...overrides } as unknown as ElectronAPI;
}

type RecorderView = { result: { current: ReturnType<typeof useScreenRecorder> } };

async function settle(ms = 0) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

async function startNativeRecording(view: RecorderView) {
	await act(async () => {
		view.result.current.toggleRecording();
	});
	await settle(3_500);
	expect(view.result.current.recording).toBe(true);
}

beforeEach(() => {
	vi.useFakeTimers();
	stubElectronAPI();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("useScreenRecorder windowsMidCapture integration", () => {
	it("registers onNativeWindowsCaptureEnded listener before start", async () => {
		renderHook(() => useScreenRecorder());
		await settle();
		expect(api.onNativeWindowsCaptureEnded).toHaveBeenCalledTimes(1);
		expect(captureEndedListener).toBeTypeOf("function");
	});

	it("finalizes and passes expectedRecordingId when helper exits mid-flight", async () => {
		const view = renderHook(() => useScreenRecorder());
		await startNativeRecording(view);

		expect(captureEndedListener).not.toBeNull();
		await act(async () => {
			captureEndedListener!({ recordingId: 77, code: 0, signal: null, reason: "helper-closed" });
		});
		await settle();

		expect(api.stopNativeWindowsRecording).toHaveBeenCalledWith(false, 77);
		expect(view.result.current.recording).toBe(false);
	});

	it("concurrent callback and query closed invokes stopNativeWindowsRecording exactly once", async () => {
		api.queryNativeWindowsCaptureStatus.mockResolvedValueOnce({
			active: true,
			closed: true,
			code: 0,
			signal: null,
			reason: "helper-closed",
		});

		const view = renderHook(() => useScreenRecorder());
		await act(async () => {
			view.result.current.toggleRecording();
		});

		// Trigger event concurrently in the same countdown/start window
		await act(async () => {
			captureEndedListener!({ recordingId: 77, code: 0, signal: null, reason: "helper-closed" });
		});
		await settle(3_500);

		// Stop must be invoked exactly 1 time despite concurrent notifications
		expect(api.stopNativeWindowsRecording).toHaveBeenCalledTimes(1);
		expect(api.stopNativeWindowsRecording).toHaveBeenCalledWith(false, 77);
		expect(view.result.current.recording).toBe(false);
	});

	it("event arriving during start before handle registration does not throw and query finalizes afterwards", async () => {
		let resolveStart!: (val: { success: boolean; recordingId: number }) => void;
		api.startNativeWindowsRecording.mockImplementationOnce(
			() =>
				new Promise((res) => {
					resolveStart = res;
				}),
		);

		api.queryNativeWindowsCaptureStatus.mockResolvedValueOnce({
			active: true,
			closed: true,
			code: 0,
			signal: null,
			reason: "helper-closed",
		});

		const view = renderHook(() => useScreenRecorder());
		await act(async () => {
			view.result.current.toggleRecording();
		});
		await settle(3_100);

		// Helper closes while start is still in flight before handle is registered
		await act(async () => {
			captureEndedListener!({ recordingId: 77, code: 0, signal: null, reason: "helper-closed" });
		});
		expect(api.stopNativeWindowsRecording).not.toHaveBeenCalled();

		// Now start resolves
		await act(async () => {
			resolveStart({ success: true, recordingId: 77 });
		});
		await settle(500);

		// Query immediately finalizes upon handle registration
		expect(api.queryNativeWindowsCaptureStatus).toHaveBeenCalledWith(77);
		expect(api.stopNativeWindowsRecording).toHaveBeenCalledWith(false, 77);
		expect(view.result.current.recording).toBe(false);
	});

	it("stale query resolving after new take started does not stop the new take", async () => {
		let resolveQuery77!: (val: { active: boolean; closed: boolean }) => void;
		api.queryNativeWindowsCaptureStatus.mockImplementationOnce(
			() =>
				new Promise((res) => {
					resolveQuery77 = res;
				}),
		);

		const view = renderHook(() => useScreenRecorder());
		await startNativeRecording(view);

		// User stops take 77 cleanly
		await act(async () => {
			view.result.current.toggleRecording();
		});
		await settle();
		expect(api.stopNativeWindowsRecording).toHaveBeenCalledWith(false, 77);

		// User starts new take 88
		api.startNativeWindowsRecording.mockResolvedValueOnce({ success: true, recordingId: 88 });
		api.queryNativeWindowsCaptureStatus.mockResolvedValueOnce({ active: true, closed: false });
		await startNativeRecording(view);
		expect(view.result.current.recording).toBe(true);

		// Old delayed query for take 77 finally resolves reporting closed
		await act(async () => {
			resolveQuery77({ active: true, closed: true });
		});
		await settle();

		// Take 88 must NOT be stopped
		expect(api.stopNativeWindowsRecording).not.toHaveBeenCalledWith(false, 88);
		expect(view.result.current.recording).toBe(true);
	});

	it("unmount while query is pending cleanly discards without secondary stop", async () => {
		let resolveQuery!: (val: { active: boolean; closed: boolean }) => void;
		api.queryNativeWindowsCaptureStatus.mockImplementationOnce(
			() =>
				new Promise((res) => {
					resolveQuery = res;
				}),
		);

		const view = renderHook(() => useScreenRecorder());
		await startNativeRecording(view);

		// Unmount while query is still pending
		view.unmount();
		expect(api.stopNativeWindowsRecording).toHaveBeenCalledWith(true, 77);

		// Pending query resolves afterwards
		await act(async () => {
			resolveQuery({ active: true, closed: true });
		});
		await settle();

		// No extra normal stop called
		expect(api.stopNativeWindowsRecording).toHaveBeenCalledTimes(1);
	});

	it("stop error does NOT call editor switch or session store and shows error toast without success", async () => {
		api.stopNativeWindowsRecording.mockResolvedValueOnce({
			success: false,
			reason: "exit-before-stop",
			error: "Native Windows capture failed.",
		});

		const view = renderHook(() => useScreenRecorder());
		await startNativeRecording(view);

		await act(async () => {
			captureEndedListener!({ recordingId: 77, code: 1, signal: null, reason: "helper-closed" });
		});
		await settle();

		expect(toast.error).toHaveBeenCalledWith("Native Windows capture failed.");
		expect(toast.success).not.toHaveBeenCalled();
		expect(api.setCurrentRecordingSession).not.toHaveBeenCalled();
		expect(api.setCurrentVideoPath).not.toHaveBeenCalled();
		expect(api.switchToEditor).not.toHaveBeenCalled();
		expect(view.result.current.recording).toBe(false);
	});

	it("cleans up onNativeWindowsCaptureEnded listener on unmount", () => {
		const view = renderHook(() => useScreenRecorder());
		expect(captureEndedListener).not.toBeNull();

		view.unmount();
		expect(captureEndedListener).toBeNull();
	});
});
