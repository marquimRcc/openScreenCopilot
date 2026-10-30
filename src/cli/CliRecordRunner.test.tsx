// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CliRecordRunner } from "./CliRecordRunner";

const recorder = vi.hoisted(() => ({
	recording: false,
	saving: false,
	startRecordingImmediately: vi.fn(async () => undefined),
	toggleRecording: vi.fn(),
	togglePaused: vi.fn(),
	paused: false,
	setMicrophoneEnabled: vi.fn(),
	setMicrophoneDeviceId: vi.fn(),
	setMicrophoneDeviceName: vi.fn(),
	setSystemAudioEnabled: vi.fn(),
	setCursorCaptureMode: vi.fn(),
	setWebcamEnabled: vi.fn(async () => false),
	setWebcamDeviceId: vi.fn(),
	setWebcamDeviceName: vi.fn(),
	recordingPrefsLoaded: true,
	microphoneEnabled: false,
	webcamEnabled: false,
	systemAudioEnabled: false,
	cursorCaptureMode: "editable-overlay" as const,
}));

vi.mock("@/hooks/useScreenRecorder", () => ({
	useScreenRecorder: () => recorder,
}));

const screenSource = {
	id: "screen:gone",
	name: "Display 1",
	display_id: "1",
	thumbnail: null,
	appIcon: null,
} satisfies ProcessedDesktopSource;

const request = {
	kind: "record" as const,
	displayIndex: 0,
	windowTitle: null,
	mic: false,
	micDevice: null,
	systemAudio: false,
	camera: false,
	cameraDevice: null as string | null,
	cursorMode: "editable-overlay" as const,
	durationMs: null,
	projectOut: null,
};

describe("CliRecordRunner", () => {
	beforeEach(() => {
		recorder.recording = false;
		recorder.saving = false;
		recorder.paused = false;
		recorder.startRecordingImmediately.mockClear();
		recorder.toggleRecording.mockClear();
		recorder.togglePaused.mockClear();
		window.electronAPI = {
			getPlatform: vi.fn(() => "win32"),
			isNativeLinuxCaptureAvailable: vi.fn(async () => ({ success: true, available: false })),
			cliGetRequest: vi.fn(async () => request),
			cliLog: vi.fn(),
			cliDone: vi.fn(async () => undefined),
			onCliStopRecording: vi.fn(() => () => undefined),
			onCliSetRecordingPaused: vi.fn(() => () => undefined),
			getCurrentRecordingSession: vi.fn(async () => ({ success: false, session: null })),
			getSources: vi.fn(async () => [screenSource]),
			selectSource: vi.fn(async () => screenSource),
		} as unknown as typeof window.electronAPI;
	});

	it("turns the camera on when asked, and fails when it cannot", async () => {
		vi.mocked(window.electronAPI.cliGetRequest).mockResolvedValueOnce({ ...request, camera: true });
		recorder.setWebcamEnabled.mockClear();
		render(<CliRecordRunner />);
		await waitFor(() =>
			expect(window.electronAPI.cliDone).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: expect.stringContaining("camera could not be turned on"),
				}),
			),
		);
		expect(recorder.setWebcamEnabled).toHaveBeenCalledWith(true);
		expect(recorder.startRecordingImmediately).not.toHaveBeenCalled();
	});

	it("leaves the camera off unless asked", async () => {
		recorder.setWebcamEnabled.mockClear();
		render(<CliRecordRunner />);
		await waitFor(() => expect(recorder.startRecordingImmediately).toHaveBeenCalledTimes(1));
		expect(recorder.setWebcamEnabled).toHaveBeenCalledWith(false);
	});

	it("fails immediately when selectSource returns null", async () => {
		vi.mocked(window.electronAPI.selectSource).mockResolvedValueOnce(null);
		render(<CliRecordRunner />);
		await waitFor(() => expect(window.electronAPI.cliDone).toHaveBeenCalled());
		expect(window.electronAPI.cliDone).toHaveBeenCalledWith(
			expect.objectContaining({
				success: false,
				error: expect.stringContaining("openscreen sources"),
			}),
		);
		expect(recorder.startRecordingImmediately).not.toHaveBeenCalled();
		expect(recorder.toggleRecording).not.toHaveBeenCalled();
	});

	it("starts recording when the selected source is still available", async () => {
		render(<CliRecordRunner />);
		await waitFor(() => expect(recorder.startRecordingImmediately).toHaveBeenCalledTimes(1));
		expect(window.electronAPI.cliDone).not.toHaveBeenCalled();
	});

	it("applies idempotent pause and resume commands to an active CLI recording", async () => {
		const view = render(<CliRecordRunner />);
		await waitFor(() => expect(recorder.startRecordingImmediately).toHaveBeenCalledTimes(1));
		recorder.recording = true;
		view.rerender(<CliRecordRunner />);

		const onCommand = vi.mocked(window.electronAPI.onCliSetRecordingPaused).mock.calls[0]?.[0];
		expect(onCommand).toBeTypeOf("function");
		act(() => onCommand?.(true));
		expect(recorder.togglePaused).toHaveBeenCalledOnce();

		act(() => onCommand?.(true));
		expect(recorder.togglePaused).toHaveBeenCalledOnce();

		act(() => onCommand?.(false));
		expect(recorder.togglePaused).toHaveBeenCalledOnce();
		recorder.paused = true;
		view.rerender(<CliRecordRunner />);
		expect(recorder.togglePaused).toHaveBeenCalledTimes(2);
		act(() => onCommand?.(false));
		expect(recorder.togglePaused).toHaveBeenCalledTimes(2);
	});

	it("remembers a pause command received while capture is still starting", async () => {
		const view = render(<CliRecordRunner />);
		await waitFor(() => expect(recorder.startRecordingImmediately).toHaveBeenCalledTimes(1));
		const onCommand = vi.mocked(window.electronAPI.onCliSetRecordingPaused).mock.calls[0]?.[0];
		act(() => onCommand?.(true));
		expect(recorder.togglePaused).not.toHaveBeenCalled();

		recorder.recording = true;
		view.rerender(<CliRecordRunner />);
		expect(recorder.togglePaused).toHaveBeenCalledOnce();
	});

	it("cancels a startup pause when resume arrives before capture is active", async () => {
		const view = render(<CliRecordRunner />);
		await waitFor(() => expect(recorder.startRecordingImmediately).toHaveBeenCalledTimes(1));
		const onCommand = vi.mocked(window.electronAPI.onCliSetRecordingPaused).mock.calls[0]?.[0];
		act(() => {
			onCommand?.(true);
			onCommand?.(false);
		});

		recorder.recording = true;
		view.rerender(<CliRecordRunner />);
		expect(recorder.togglePaused).not.toHaveBeenCalled();
	});

	it("reports the recorder's startup error instead of replacing it with a timeout", async () => {
		recorder.startRecordingImmediately.mockRejectedValueOnce(
			new Error("Native Windows capture failed: helper refused the source"),
		);
		render(<CliRecordRunner />);
		await waitFor(() =>
			expect(window.electronAPI.cliDone).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: expect.stringContaining("helper refused the source"),
				}),
			),
		);
	});

	it("keeps source selection for Linux without the native helper", async () => {
		vi.mocked(window.electronAPI.getPlatform).mockReturnValue("linux");
		render(<CliRecordRunner />);
		await waitFor(() => expect(recorder.startRecordingImmediately).toHaveBeenCalledTimes(1));
		expect(window.electronAPI.getSources).toHaveBeenCalledTimes(1);
		expect(window.electronAPI.selectSource).toHaveBeenCalledWith(screenSource, { persist: false });
	});

	it("reports missing sources in the browser fallback", async () => {
		vi.mocked(window.electronAPI.getPlatform).mockReturnValue("linux");
		vi.mocked(window.electronAPI.getSources).mockResolvedValueOnce([]);
		render(<CliRecordRunner />);
		await waitFor(() =>
			expect(window.electronAPI.cliDone).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: expect.stringContaining("Display index 0 not found"),
				}),
			),
		);
		expect(recorder.startRecordingImmediately).not.toHaveBeenCalled();
	});

	it("lets the native Linux portal choose the source without Chromium enumeration", async () => {
		vi.mocked(window.electronAPI.getPlatform).mockReturnValue("linux");
		vi.mocked(window.electronAPI.isNativeLinuxCaptureAvailable).mockResolvedValue({
			success: true,
			available: true,
		});
		vi.mocked(window.electronAPI.getSources).mockResolvedValueOnce([]);
		render(<CliRecordRunner />);
		await waitFor(() => expect(recorder.startRecordingImmediately).toHaveBeenCalledTimes(1));
		expect(window.electronAPI.getSources).not.toHaveBeenCalled();
		expect(window.electronAPI.selectSource).not.toHaveBeenCalled();
		expect(window.electronAPI.cliDone).not.toHaveBeenCalled();
		expect(window.electronAPI.cliLog).toHaveBeenCalledWith(
			"info",
			expect.stringContaining("--window do not apply"),
		);
	});
});
