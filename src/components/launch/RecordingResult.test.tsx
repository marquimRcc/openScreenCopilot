// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordingResult } from "./RecordingResult";

vi.mock("@/contexts/I18nContext", () => {
	const translate = (key: string) => key;
	return { useScopedT: () => translate };
});
const recording = {
	path: "C:\\Vídeos\\gravação 1.mp4",
	name: "gravação 1.mp4",
	folder: "C:\\Vídeos",
	sizeBytes: 1500000,
};
beforeEach(() => {
	window.electronAPI = {
		...window.electronAPI,
		getSavedRecordingInfo: vi.fn().mockResolvedValue({ success: true, recording }),
		revealSavedRecording: vi.fn().mockResolvedValue({ success: true }),
		prepareNewCapture: vi.fn().mockResolvedValue({ success: true }),
		switchToEditor: vi.fn().mockResolvedValue(undefined),
		startNewRecording: vi.fn(),
	} as typeof window.electronAPI;
});
afterEach(cleanup);
describe("RecordingResult", () => {
	it("shows the saved original and location without opening the editor", async () => {
		render(<RecordingResult />);
		expect(await screen.findByText("recordingResult.saved")).toBeInTheDocument();
		expect(screen.getByDisplayValue(recording.path)).toHaveAttribute("readonly");
		expect(screen.getByText(recording.name)).toBeInTheDocument();
		expect(screen.getByLabelText("recordingResult.preview")).toHaveAttribute("controls");
		expect(screen.getByLabelText("recordingResult.preview")).not.toHaveAttribute("autoplay");
		expect(window.electronAPI.switchToEditor).not.toHaveBeenCalled();
	});
	it("reveals the exact original file after revalidating it", async () => {
		render(<RecordingResult />);
		fireEvent.click(await screen.findByRole("button", { name: "recordingResult.openFolder" }));
		await waitFor(() =>
			expect(window.electronAPI.revealSavedRecording).toHaveBeenCalledExactlyOnceWith(
				recording.path,
			),
		);
	});
	it("new capture only goes to preparation, never auto-records", async () => {
		render(<RecordingResult />);
		await screen.findByText(recording.name);
		fireEvent.click(screen.getByRole("button", { name: "recordingResult.newCapture" }));
		await waitFor(() => expect(window.electronAPI.prepareNewCapture).toHaveBeenCalledOnce());
		expect(window.electronAPI.startNewRecording).not.toHaveBeenCalled();
	});
	it("opens the editor only when explicitly requested", async () => {
		render(<RecordingResult />);
		fireEvent.click(await screen.findByRole("button", { name: "recordingResult.edit" }));
		await waitFor(() => expect(window.electronAPI.switchToEditor).toHaveBeenCalledOnce());
	});
	it("does not claim saved success when the output has gone missing", async () => {
		vi.mocked(window.electronAPI.getSavedRecordingInfo!).mockResolvedValue({ success: false });
		render(<RecordingResult />);
		expect(await screen.findByRole("alert")).toHaveTextContent("recordingResult.unavailable");
		expect(screen.queryByText("recordingResult.saved")).toBeNull();
		expect(screen.queryByRole("button", { name: "recordingResult.openFolder" })).toBeNull();
		expect(screen.getByRole("button", { name: "recordingResult.newCapture" })).toBeEnabled();
	});
	it("keeps the saved path visible after a shell error", async () => {
		vi.mocked(window.electronAPI.revealSavedRecording!).mockResolvedValue({ success: false });
		render(<RecordingResult />);
		fireEvent.click(await screen.findByRole("button", { name: "recordingResult.openFolder" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("recordingResult.actionFailed");
		expect(screen.getByDisplayValue(recording.path)).toBeInTheDocument();
	});
	it("rejects stale result actions instead of opening a different take", async () => {
		vi.mocked(window.electronAPI.getSavedRecordingInfo!)
			.mockResolvedValueOnce({ success: true, recording })
			.mockResolvedValue({ success: true, recording: { ...recording, path: "C:\\new.mp4" } });
		render(<RecordingResult />);
		fireEvent.click(await screen.findByRole("button", { name: "recordingResult.edit" }));
		await screen.findByRole("alert");
		expect(window.electronAPI.switchToEditor).not.toHaveBeenCalled();
	});
});
