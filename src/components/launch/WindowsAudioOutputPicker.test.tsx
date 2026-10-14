// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type WindowsAudioOutputLabels,
	WindowsAudioOutputPicker,
} from "./WindowsAudioOutputPicker";

type Prefs = Awaited<ReturnType<Window["electronAPI"]["getRecordingPrefs"]>>;
const prefs = (id: string | null = null): Prefs => ({
	micEnabled: false,
	micDeviceId: null,
	micDeviceName: null,
	camEnabled: false,
	camDeviceId: null,
	camDeviceName: null,
	camQuality: "2160p",
	systemAudioEnabled: false,
	windowsSystemAudioDeviceId: id,
	cursorCaptureMode: "system",
	hideDesktopIcons: false,
	autoZoomEnabled: true,
});
const labels: WindowsAudioOutputLabels = {
	device: "Output",
	default: "Windows default",
	unavailable: "Unavailable output",
	refresh: "Refresh",
	loading: "Loading outputs",
	loadFailed: "Load failed",
	saveFailed: "Save failed",
	scope: "All sound from this output, not one app",
};
const devices = [
	{ id: "speakers", name: "Speakers", isDefault: true },
	{ id: "headset", name: "Fone USB", isDefault: false },
];
let list: ReturnType<typeof vi.fn<NonNullable<Window["electronAPI"]["listWindowsAudioOutputs"]>>>;
let get: ReturnType<typeof vi.fn>,
	set: ReturnType<typeof vi.fn>,
	unsubscribe: ReturnType<typeof vi.fn>;
let push: (value: Prefs) => void;
let platform: NodeJS.Platform;
const field = () => screen.getByLabelText(labels.device) as HTMLSelectElement;
beforeEach(() => {
	platform = "win32";
	list = vi.fn().mockResolvedValue({ success: true, devices });
	get = vi.fn().mockResolvedValue(prefs());
	set = vi.fn(async (patch) => ({ ...prefs(), ...patch }));
	unsubscribe = vi.fn();
	window.electronAPI = {
		getPlatform: () => platform,
		listWindowsAudioOutputs: list,
		getRecordingPrefs: get,
		setRecordingPrefs: set,
		onRecordingPrefsChanged: (listener: (value: Prefs) => void) => {
			push = listener;
			return unsubscribe;
		},
	} as unknown as Window["electronAPI"];
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("Windows output device settings", () => {
	it("enables explicit system test only from current prefs and cancels on output change", async () => {
		const start = vi
			.fn<NonNullable<Window["electronAPI"]["startWindowsOutputMeter"]>>()
			.mockResolvedValue({ success: true, meterId: "one" });
		const stop = vi
			.fn<NonNullable<Window["electronAPI"]["stopWindowsOutputMeter"]>>()
			.mockResolvedValue({ success: true, result: { status: "cancelled" } });
		window.electronAPI.startWindowsOutputMeter = start;
		window.electronAPI.stopWindowsOutputMeter = stop;
		window.electronAPI.onWindowsOutputMeter = () => () => undefined;
		const withMeter = {
			...labels,
			meter: {
				test: "Test output",
				stop: "Stop test",
				starting: "Starting",
				active: "Activity",
				stopping: "Stopping",
				stopped: "Ended",
				error: "Test unavailable",
				hint: "Not proof of recorded audio",
				level: "Output level",
			},
		};
		render(<WindowsAudioOutputPicker labels={withMeter} />);
		await waitFor(() => expect(field().disabled).toBe(false));
		expect(
			(screen.getByRole("button", { name: "Test output" }) as HTMLButtonElement).disabled,
		).toBe(true);
		await act(async () => push({ ...prefs(), systemAudioEnabled: true }));
		fireEvent.click(screen.getByRole("button", { name: "Test output" }));
		await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
		await act(async () => push({ ...prefs("headset"), systemAudioEnabled: true }));
		await waitFor(() => expect(stop).toHaveBeenCalledWith("one"));
		expect(field().value).toBe("headset");
	});
	it("lists native outputs without changing audio/mic preferences or selecting automatically", async () => {
		render(<WindowsAudioOutputPicker labels={labels} />);
		await waitFor(() => expect(field().disabled).toBe(false));
		expect(field().value).toBe("");
		expect(screen.getByText("Windows default — Speakers")).toBeTruthy();
		expect(screen.getByText(labels.scope)).toBeTruthy();
		expect(set).not.toHaveBeenCalled();
	});
	it("writes only a native ID, and resets to default only on explicit choice", async () => {
		render(<WindowsAudioOutputPicker labels={labels} />);
		await waitFor(() => expect(field().disabled).toBe(false));
		fireEvent.change(field(), { target: { value: "headset" } });
		await waitFor(() => expect(field().value).toBe("headset"));
		expect(set).toHaveBeenLastCalledWith({ windowsSystemAudioDeviceId: "headset" });
		fireEvent.change(field(), { target: { value: "" } });
		await waitFor(() => expect(set).toHaveBeenLastCalledWith({ windowsSystemAudioDeviceId: null }));
	});
	it("preserves a disconnected saved output and refreshes without defaulting", async () => {
		get.mockResolvedValue(prefs("removed"));
		render(<WindowsAudioOutputPicker labels={labels} />);
		await waitFor(() => expect(field().value).toBe("removed"));
		expect(screen.getByRole("alert").textContent).toBe(labels.unavailable);
		expect(set).not.toHaveBeenCalled();
		list.mockResolvedValue({
			success: true,
			devices: [...devices, { id: "removed", name: "Reconnected", isDefault: false }],
		});
		fireEvent.click(screen.getByRole("button", { name: labels.refresh }));
		await waitFor(() => expect(screen.getByText("Reconnected")).toBeTruthy());
		expect(field().value).toBe("removed");
		expect(set).not.toHaveBeenCalled();
	});
	it("lets the user explicitly return to default even if an old helper cannot list outputs", async () => {
		get.mockResolvedValue(prefs("removed"));
		list.mockResolvedValue({ success: false, devices: [], errorCode: "enumeration-failed" });
		render(<WindowsAudioOutputPicker labels={labels} />);
		await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(labels.loadFailed));
		expect(field().value).toBe("removed");
		expect(set).not.toHaveBeenCalled();
		fireEvent.change(field(), { target: { value: "" } });
		await waitFor(() => expect(set).toHaveBeenCalledWith({ windowsSystemAudioDeviceId: null }));
		expect(screen.getByRole("alert").textContent).toBe(labels.loadFailed);
	});
	it("does not claim a failed write changed the saved output", async () => {
		set.mockRejectedValue(new Error("disk error"));
		render(<WindowsAudioOutputPicker labels={labels} />);
		await waitFor(() => expect(field().disabled).toBe(false));
		fireEvent.change(field(), { target: { value: "headset" } });
		await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(labels.saveFailed));
		expect(field().value).toBe("");
	});
	it("locks duplicate writes and ignores an old acknowledgement after a newer broadcast", async () => {
		let release!: (value: Prefs) => void;
		set.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			}),
		);
		render(<WindowsAudioOutputPicker labels={labels} />);
		await waitFor(() => expect(field().disabled).toBe(false));
		fireEvent.change(field(), { target: { value: "headset" } });
		fireEvent.change(field(), { target: { value: "speakers" } });
		expect(set).toHaveBeenCalledTimes(1);
		expect(field().disabled).toBe(true);
		await act(async () => {
			push(prefs("speakers"));
			release(prefs("headset"));
		});
		expect(field().value).toBe("speakers");
	});
	it("ignores an old initial read after a pushed preference snapshot", async () => {
		let release!: (value: Prefs) => void;
		get.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			}),
		);
		render(<WindowsAudioOutputPicker labels={labels} />);
		await act(async () => {
			push(prefs("headset"));
			release(prefs());
		});
		await waitFor(() => expect(field().disabled).toBe(false));
		expect(field().value).toBe("headset");
	});
	it("locks changing and refreshing during capture/preparation", async () => {
		render(<WindowsAudioOutputPicker labels={labels} locked />);
		await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
		expect(field().disabled).toBe(true);
		expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(field(), { target: { value: "headset" } });
		expect(set).not.toHaveBeenCalled();
	});
	it.each(["linux", "darwin"] as const)("does not offer Windows endpoint IDs on %s", (value) => {
		platform = value;
		const view = render(<WindowsAudioOutputPicker labels={labels} />);
		expect(view.container.childElementCount).toBe(0);
		expect(list).not.toHaveBeenCalled();
		expect(get).not.toHaveBeenCalled();
	});
	it("does not offer an unsupported bridge and removes its preference listener on unmount", async () => {
		window.electronAPI.listWindowsAudioOutputs = undefined;
		const empty = render(<WindowsAudioOutputPicker labels={labels} />);
		expect(empty.container.childElementCount).toBe(0);
		empty.unmount();
		window.electronAPI.listWindowsAudioOutputs = list;
		const view = render(<WindowsAudioOutputPicker labels={labels} />);
		await waitFor(() => expect(field().disabled).toBe(false));
		view.unmount();
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});
});
