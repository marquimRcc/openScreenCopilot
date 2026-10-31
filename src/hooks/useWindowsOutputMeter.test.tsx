// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	WindowsOutputMeterMessage,
	WindowsOutputMeterStartResult,
	WindowsOutputMeterStopResult,
} from "../lib/windowsOutputMeter";
import { useWindowsOutputMeter } from "./useWindowsOutputMeter";

let start: ReturnType<typeof vi.fn<() => Promise<WindowsOutputMeterStartResult>>>;
let stop: ReturnType<typeof vi.fn<(id: string) => Promise<WindowsOutputMeterStopResult>>>;
let listener: (message: WindowsOutputMeterMessage) => void;
let off: ReturnType<typeof vi.fn>;
const ready = (id = "one"): WindowsOutputMeterMessage => ({
	event: "ready",
	meterId: id,
	id: "native-output",
	hardwareMeter: true,
});
const level = (peakPermille: number, id = "one"): WindowsOutputMeterMessage => ({
	event: "level",
	meterId: id,
	sequence: 4,
	peakPermille,
});
const ended = (id = "one"): WindowsOutputMeterMessage => ({
	event: "ended",
	meterId: id,
	result: { status: "stopped", reason: "lease-expired" },
});
beforeEach(() => {
	start = vi.fn(async () => ({ success: true, meterId: "one" }));
	stop = vi.fn(async () => ({ success: true, result: { status: "cancelled" } }));
	off = vi.fn();
	window.electronAPI = {
		startWindowsOutputMeter: start,
		stopWindowsOutputMeter: stop,
		onWindowsOutputMeter: (fn: typeof listener) => {
			listener = fn;
			return off;
		},
	} as unknown as Window["electronAPI"];
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
const mount = (enabled = true) =>
	renderHook(({ enabled, choice }) => useWindowsOutputMeter(enabled, choice), {
		initialProps: { enabled, choice: null as string | null },
	});
describe("explicit output activity test lifecycle", () => {
	it("never auto-starts or polls, including StrictMode", () => {
		renderHook(() => useWindowsOutputMeter(true, null), { wrapper: StrictMode });
		expect(start).not.toHaveBeenCalled();
		expect(stop).not.toHaveBeenCalled();
	});
	it("requires ready before showing activity, converts scalar permille to percent", async () => {
		const { result } = mount();
		await act(async () => {
			await result.current.start();
		});
		expect(start).toHaveBeenCalledWith();
		expect(result.current.status).toBe("starting");
		act(() => listener(level(900)));
		expect(result.current.level).toBe(0);
		act(() => {
			listener(ready());
			listener(level(456));
		});
		expect(result.current).toMatchObject({ status: "active", level: 45.6, busy: true });
	});
	it("ignores foreign IDs and invalid levels", async () => {
		const { result } = mount();
		await act(async () => {
			await result.current.start();
		});
		act(() => {
			listener(ready());
			listener(level(300));
			listener(level(999, "foreign"));
			listener(ended("foreign"));
			listener(level(1001));
			listener(level(-2));
			listener(level(NaN));
		});
		expect(result.current).toMatchObject({ status: "active", level: 30, busy: true });
	});
	it("buffers ready and latest level while ACK is delayed, no unbounded level queue", async () => {
		let resolve!: (value: WindowsOutputMeterStartResult) => void;
		start.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			}),
		);
		const { result } = mount();
		let pending!: Promise<void>;
		act(() => {
			pending = result.current.start();
			listener(ready());
			for (let index = 0; index < 300; index++) listener(level(index));
		});
		await act(async () => {
			resolve({ success: true, meterId: "one" });
			await pending;
		});
		expect(result.current).toMatchObject({ status: "active", level: 29.9 });
	});
	it("terminal before ACK ends without claiming an active meter", async () => {
		let resolve!: (value: WindowsOutputMeterStartResult) => void;
		start.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			}),
		);
		const { result } = mount();
		let pending!: Promise<void>;
		act(() => {
			pending = result.current.start();
			listener(ready());
			listener(ended());
		});
		await act(async () => {
			resolve({ success: true, meterId: "one" });
			await pending;
		});
		expect(result.current).toMatchObject({ status: "stopped", level: 0, busy: false });
	});
	it("blocks duplicate start until terminal and never auto-restarts after lease", async () => {
		const { result } = mount();
		await act(async () => {
			await result.current.start();
			await result.current.start();
			listener(ready());
			listener(ended());
		});
		expect(start).toHaveBeenCalledTimes(1);
		expect(result.current.busy).toBe(false);
	});
	it("stop waits main result and ignores late levels", async () => {
		let finish!: (value: WindowsOutputMeterStopResult) => void;
		stop.mockReturnValue(
			new Promise((done) => {
				finish = done;
			}),
		);
		const { result } = mount();
		await act(async () => {
			await result.current.start();
			listener(ready());
		});
		let pending!: Promise<void>;
		act(() => {
			pending = result.current.stop();
			listener(level(700));
		});
		expect(result.current).toMatchObject({ status: "stopping", level: 0, busy: true });
		await act(async () => {
			finish({ success: true, result: { status: "cancelled" } });
			await pending;
		});
		expect(result.current).toMatchObject({ status: "stopped", busy: false });
	});
	it("stop during pending ACK cancels eventual UUID", async () => {
		let resolve!: (value: WindowsOutputMeterStartResult) => void;
		start.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			}),
		);
		const { result } = mount();
		let pending!: Promise<void>;
		act(() => {
			pending = result.current.start();
		});
		await act(async () => {
			await result.current.stop();
			resolve({ success: true, meterId: "one" });
			await pending;
		});
		expect(stop).toHaveBeenCalledWith("one");
		expect(result.current.busy).toBe(false);
	});
	it("unmount cancels a late ACK and never updates a dead hook", async () => {
		let resolve!: (value: WindowsOutputMeterStartResult) => void;
		start.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			}),
		);
		const view = mount();
		let pending!: Promise<void>;
		act(() => {
			pending = view.result.current.start();
		});
		view.unmount();
		await act(async () => {
			resolve({ success: true, meterId: "late" });
			await pending;
		});
		expect(stop).toHaveBeenCalledWith("late");
		expect(off).toHaveBeenCalled();
	});
	it.each([
		"disable",
		"choice",
		"unmount",
	])("%s cancels existing test and ignores old events", async (action) => {
		const view = mount();
		await act(async () => {
			await view.result.current.start();
			listener(ready());
		});
		const old = listener;
		if (action === "unmount") view.unmount();
		else
			view.rerender({
				enabled: action !== "disable",
				choice: action === "choice" ? "another" : null,
			});
		expect(stop).toHaveBeenCalledWith("one");
		act(() => old(level(1000)));
		if (action !== "unmount") expect(view.result.current.level).toBe(0);
	});
	it("does not run on absent bridge or disabled controls", async () => {
		const disabled = mount(false);
		await act(async () => {
			await disabled.result.current.start();
		});
		expect(start).not.toHaveBeenCalled();
		disabled.unmount();
		window.electronAPI.startWindowsOutputMeter = undefined;
		const absent = mount();
		expect(absent.result.current.status).toBe("unavailable");
	});
	it.each([
		"reject",
		"denied",
	])("start %s is honest and can be retried explicitly", async (mode) => {
		if (mode === "reject") start.mockRejectedValueOnce(new Error("private error"));
		else start.mockResolvedValueOnce({ success: false, errorCode: "busy" });
		const { result } = mount();
		await act(async () => {
			await result.current.start();
		});
		expect(result.current).toMatchObject({ status: "error", busy: false });
		await act(async () => {
			await result.current.start();
		});
		expect(start).toHaveBeenCalledTimes(2);
	});
	it("stop rejection retains busy ownership until terminal, allows retry stop", async () => {
		stop.mockRejectedValueOnce(new Error("IPC transport"));
		const { result } = mount();
		await act(async () => {
			await result.current.start();
			listener(ready());
			await result.current.stop();
		});
		expect(result.current).toMatchObject({ status: "error", busy: true });
		await act(async () => {
			await result.current.stop();
		});
		expect(result.current.busy).toBe(false);
	});
	it("main failure ends as error, not zero-level success", async () => {
		const { result } = mount();
		await act(async () => {
			await result.current.start();
			listener({
				event: "ended",
				meterId: "one",
				result: { status: "failed", code: "unsupported-helper" },
			});
		});
		expect(result.current).toMatchObject({ status: "error", level: 0, busy: false });
	});
});
