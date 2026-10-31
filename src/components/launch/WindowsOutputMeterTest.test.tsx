// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WindowsOutputMeterMessage } from "../../lib/windowsOutputMeter";
import { type WindowsOutputMeterLabels, WindowsOutputMeterTest } from "./WindowsOutputMeterTest";

const labels: WindowsOutputMeterLabels = {
	test: "Test output",
	stop: "Stop test",
	starting: "Starting",
	active: "Output activity, not recording",
	stopping: "Stopping",
	stopped: "Ended",
	error: "Unavailable",
	hint: "Peak before volume, not proof of recording",
	level: "Output activity",
};
let start: ReturnType<typeof vi.fn<NonNullable<Window["electronAPI"]["startWindowsOutputMeter"]>>>;
let stop: ReturnType<typeof vi.fn<NonNullable<Window["electronAPI"]["stopWindowsOutputMeter"]>>>;
let push: (message: WindowsOutputMeterMessage) => void;
beforeEach(() => {
	start = vi.fn(async () => ({ success: true, meterId: "one" }));
	stop = vi.fn(async () => ({ success: true, result: { status: "cancelled" } }));
	window.electronAPI = {
		startWindowsOutputMeter: start,
		stopWindowsOutputMeter: stop,
		onWindowsOutputMeter: (fn: typeof push) => {
			push = fn;
			return () => undefined;
		},
	} as unknown as Window["electronAPI"];
});
afterEach(() => cleanup());
describe("short explicit output activity UI", () => {
	it("is opt-in and labels scope honestly", () => {
		render(<WindowsOutputMeterTest enabled choice={null} labels={labels} />);
		expect(start).not.toHaveBeenCalled();
		expect(screen.getByText(labels.hint)).toBeTruthy();
		expect(screen.getByRole("meter", { name: labels.level }).getAttribute("aria-valuenow")).toBe(
			"0",
		);
	});
	it("shows starting/active/level/stopped only from main lifecycle", async () => {
		render(<WindowsOutputMeterTest enabled choice={null} labels={labels} />);
		fireEvent.click(screen.getByRole("button", { name: labels.test }));
		await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("status").textContent).toBe(labels.starting);
		await act(async () => {
			push({ event: "ready", meterId: "one", id: "native", hardwareMeter: true });
			push({ event: "level", meterId: "one", sequence: 0, peakPermille: 750 });
		});
		expect(screen.getByRole("status").textContent).toBe(labels.active);
		expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("75");
		fireEvent.click(screen.getByRole("button", { name: labels.stop }));
		await waitFor(() => expect(screen.getByRole("status").textContent).toBe(labels.stopped));
		expect(stop).toHaveBeenCalledWith("one");
	});
	it("disables when system audio off or capture locked", () => {
		render(<WindowsOutputMeterTest enabled={false} choice={null} labels={labels} />);
		expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(screen.getByRole("button"));
		expect(start).not.toHaveBeenCalled();
	});
	it("missing APIs or optional labels do not offer unsupported test", () => {
		const missing = render(<WindowsOutputMeterTest enabled choice={null} />);
		expect(missing.container.childElementCount).toBe(0);
		missing.unmount();
		window.electronAPI.stopWindowsOutputMeter = undefined;
		const old = render(<WindowsOutputMeterTest enabled choice={null} labels={labels} />);
		expect(old.container.childElementCount).toBe(0);
	});
	it("failure is an alert, never success inferred from a zero meter", async () => {
		start.mockResolvedValue({ success: false, errorCode: "busy" });
		render(<WindowsOutputMeterTest enabled choice={null} labels={labels} />);
		fireEvent.click(screen.getByRole("button"));
		await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(labels.error));
		expect(screen.getByRole("button").textContent).toBe(labels.test);
	});
	it("locking active preview cancels UUID without restarting", async () => {
		const view = render(<WindowsOutputMeterTest enabled choice={null} labels={labels} />);
		fireEvent.click(screen.getByRole("button"));
		await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
		view.rerender(<WindowsOutputMeterTest enabled={false} choice={null} labels={labels} />);
		await waitFor(() => expect(stop).toHaveBeenCalledWith("one"));
		expect(start).toHaveBeenCalledTimes(1);
	});
});
