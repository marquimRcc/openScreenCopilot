// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostRecordingTranscriptionStatus } from "../../../electron/recording/postRecordingTranscription";
import { PostRecordingTranscription } from "./PostRecordingTranscription";

vi.mock("@/contexts/I18nContext", () => ({ useScopedT: () => (key: string) => key }));

let status: ((event: PostRecordingTranscriptionStatus) => void) | undefined;
beforeEach(() => {
	status = undefined;
	window.electronAPI = {
		...window.electronAPI,
		postRecordingTranscription: {
			start: vi.fn(),
			cancel: vi.fn().mockResolvedValue({ accepted: true }),
			onStatus: vi.fn((callback) => {
				status = callback;
				return vi.fn();
			}),
		},
	} as typeof window.electronAPI;
});
afterEach(cleanup);

describe("PostRecordingTranscription", () => {
	it("shows preparing, bounded progress and completed transcript paths", async () => {
		let finish!: (
			value: Awaited<ReturnType<typeof window.electronAPI.postRecordingTranscription.start>>,
		) => void;
		vi.mocked(window.electronAPI.postRecordingTranscription.start).mockImplementation(
			() => new Promise((resolve) => (finish = resolve)),
		);
		render(<PostRecordingTranscription recordingPath="C:\\recordings\\take.mp4" />);
		fireEvent.click(screen.getByRole("button", { name: "transcript.transcribeNow" }));
		expect(await screen.findByText("mediaStage.downloadingModel")).toBeInTheDocument();
		status?.({ phase: "transcribing", completedSec: 30, totalSec: 120 });
		expect(await screen.findByText("25%")).toBeInTheDocument();
		finish({
			success: true,
			text: "Olá mundo",
			txtPath: "C:\\recordings\\take.transcript.txt",
			jsonPath: "C:\\recordings\\take.transcript.json",
			document: {
				schema: "openscreencopilot.post-recording-transcript",
				version: 1,
				language: "pt",
				backend: "whispercpp-cpu",
				segments: [],
			},
		});
		expect(await screen.findByDisplayValue("Olá mundo")).toBeInTheDocument();
		expect(screen.getByDisplayValue("C:\\recordings\\take.transcript.txt")).toBeInTheDocument();
		expect(screen.getByText("mediaStage.transcriptReady")).toBeInTheDocument();
	});

	it("cancels independently and offers retry after cancellation", async () => {
		let finish!: (value: { success: false; cancelled: true }) => void;
		vi.mocked(window.electronAPI.postRecordingTranscription.start).mockImplementation(
			() => new Promise((resolve) => (finish = resolve)),
		);
		render(<PostRecordingTranscription recordingPath="C:\\recordings\\take.mp4" />);
		fireEvent.click(screen.getByRole("button", { name: "transcript.transcribeNow" }));
		fireEvent.click(await screen.findByRole("button", { name: "actions.cancel" }));
		expect(window.electronAPI.postRecordingTranscription.cancel).toHaveBeenCalledOnce();
		finish({ success: false, cancelled: true });
		expect(await screen.findByText("recordingResult.transcriptionCancelled")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "recordingResult.retry" })).toBeEnabled();
	});

	it("shows failure without exposing the engine error", async () => {
		vi.mocked(window.electronAPI.postRecordingTranscription.start).mockResolvedValue({
			success: false,
			errorCode: "failed",
		});
		render(<PostRecordingTranscription recordingPath="C:\\private\\take.mp4" />);
		fireEvent.click(screen.getByRole("button", { name: "transcript.transcribeNow" }));
		await waitFor(() =>
			expect(screen.getByText("mediaStage.transcriptionFailed")).toBeInTheDocument(),
		);
		expect(screen.queryByText(/private/)).toBeNull();
	});
});
