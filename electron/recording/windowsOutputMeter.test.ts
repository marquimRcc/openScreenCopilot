import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindowsOutputMeter } from "./windowsOutputMeter";

class Owner extends EventEmitter {
	dead = false;
	isDestroyed() {
		return this.dead;
	}
	destroy() {
		this.dead = true;
		this.emit("destroyed");
	}
}
class Process extends EventEmitter {
	stdout = new PassThrough();
	stderr = new PassThrough();
	stdin = new PassThrough();
	kill = vi.fn(() => true);
	close(code = 0, signal: string | null = null) {
		this.emit("close", code, signal);
	}
}
const ready = (id = "native") => ({
	schemaVersion: 1,
	event: "ready",
	scope: "render-peak",
	position: "before-endpoint-volume",
	id,
	hardwareMeter: false,
});
const line = (value: unknown) => `${JSON.stringify(value)}\n`;
let owner: Owner, current: boolean, processes: Process[], controller: WindowsOutputMeter;
let lookup: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
let launch: ReturnType<
	typeof vi.fn<(helper: string, args: string[]) => ChildProcessWithoutNullStreams>
>;
let onEvent: ReturnType<typeof vi.fn<Parameters<WindowsOutputMeter["start"]>[0]["onEvent"]>>;
const request = () => ({ owner, choice: "native", isCurrent: () => current, onEvent });
const tick = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => {
	vi.useFakeTimers();
	owner = new Owner();
	current = true;
	processes = [];
	onEvent = vi.fn();
	lookup = vi.fn(async () => "trusted-helper.exe");
	launch = vi.fn(() => {
		const proc = new Process();
		processes.push(proc);
		return proc as unknown as ChildProcessWithoutNullStreams;
	});
	controller = new WindowsOutputMeter(lookup, launch);
});
afterEach(async () => {
	const drain = controller.pauseAndDrain();
	for (const proc of processes) proc.close(1);
	await drain.settled;
	drain.resume();
	vi.useRealTimers();
});
async function meter(id = "native") {
	const lease = controller.start({ ...request(), choice: id });
	await tick();
	processes[0].stdout.write(line({ schemaVersion: 1, audioOutputMeter: true }));
	processes[0].close();
	await tick();
	const proc = processes[1];
	proc.stdout.write(line(ready(id)));
	await tick();
	return { lease, proc };
}
describe("main-owned isolated Windows meter lifecycle", () => {
	it("checks capability before fixed native arguments, never renderer command text", async () => {
		const { lease, proc } = await meter();
		expect(launch.mock.calls).toEqual([
			["trusted-helper.exe", ["--capabilities"]],
			["trusted-helper.exe", ["--meter-audio-output", "native"]],
		]);
		expect(await lease.ready).toMatchObject({ event: "ready", id: "native" });
		proc.stdout.write(line({ schemaVersion: 1, event: "stopped", reason: "lease-expired" }));
		expect(controller.isBusy()).toBe(true);
		proc.close();
		expect(await lease.done).toEqual({ status: "stopped", reason: "lease-expired" });
		expect(controller.isBusy()).toBe(false);
	});
	it("reserves lookup and cancels it without late spawn", async () => {
		let release!: (value: string) => void;
		lookup.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			}),
		);
		const lease = controller.start(request());
		await tick();
		expect(controller.isBusy()).toBe(true);
		expect(() => controller.start(request())).toThrow("busy");
		await lease.cancel();
		release("late.exe");
		await tick();
		expect(launch).not.toHaveBeenCalled();
		expect(await lease.ready).toBeNull();
	});
	it("drains a killed capability only after close, not error/exit", async () => {
		const lease = controller.start(request());
		await tick();
		const cap = processes[0];
		const drain = controller.pauseAndDrain();
		expect(cap.kill).toHaveBeenCalled();
		cap.emit("error", new Error("private"));
		cap.emit("exit", 1, null);
		await tick();
		expect(controller.isBusy()).toBe(true);
		expect(() => controller.start(request())).toThrow("busy");
		cap.close(1);
		await drain.settled;
		expect(await lease.done).toEqual({ status: "cancelled" });
		drain.resume();
		drain.resume();
		expect(controller.isBusy()).toBe(false);
	});
	it.each([null, "native"])("rejects old helpers even for default %s", async (choice) => {
		const lease = controller.start({ ...request(), choice });
		await tick();
		processes[0].stdout.write(line({ schemaVersion: 1, audioOutputMeter: false }));
		processes[0].close();
		expect(await lease.done).toEqual({ status: "failed", code: "unsupported-helper" });
		expect(processes).toHaveLength(1);
	});
	it("stops, escalates once and keeps ownership even if kill throws", async () => {
		const { lease, proc } = await meter();
		proc.kill.mockImplementation(() => {
			throw new Error("cannot kill");
		});
		let done = false;
		void lease.cancel().then(() => {
			done = true;
		});
		await vi.advanceTimersByTimeAsync(750);
		expect(proc.stdin.read().toString()).toBe("stop\n");
		expect(proc.kill).toHaveBeenCalledTimes(1);
		expect(done).toBe(false);
		expect(controller.isBusy()).toBe(true);
		proc.close(1);
		expect(await lease.done).toEqual({ status: "cancelled" });
	});
	it("handles destroyed owner on registration and never starts lookup", async () => {
		vi.spyOn(owner, "once").mockImplementation((_name, listener) => {
			owner.destroy();
			listener();
			return owner;
		});
		const lease = controller.start(request());
		expect(await lease.done).toEqual({ status: "cancelled" });
		expect(lookup).not.toHaveBeenCalled();
		expect(owner.listenerCount("destroyed")).toBe(0);
	});
	it("rechecks current owner after capability and does not spawn meter", async () => {
		const lease = controller.start(request());
		await tick();
		current = false;
		processes[0].stdout.write(line({ schemaVersion: 1, audioOutputMeter: true }));
		processes[0].close();
		expect(await lease.done).toEqual({ status: "cancelled" });
		expect(processes).toHaveLength(1);
	});
	it("supports split UTF8 and coalesces a burst into one scalar UI event", async () => {
		const lease = controller.start({ ...request(), choice: "fóne" });
		await tick();
		processes[0].stdout.write(line({ schemaVersion: 1, audioOutputMeter: true }));
		processes[0].close();
		await tick();
		const proc = processes[1],
			bytes = Buffer.from(line(ready("fóne"))),
			split = bytes.indexOf(0xc3) + 1;
		proc.stdout.write(bytes.subarray(0, split));
		proc.stdout.write(bytes.subarray(split));
		for (let sequence = 0; sequence < 100; sequence++)
			proc.stdout.write(
				line({ schemaVersion: 1, event: "level", sequence, peakPermille: sequence }),
			);
		await vi.advanceTimersByTimeAsync(100);
		expect(onEvent).toHaveBeenCalledTimes(2);
		expect(onEvent).toHaveBeenLastCalledWith({ event: "level", sequence: 99, peakPermille: 99 });
		void lease.cancel();
		proc.close(1);
		await lease.done;
	});
	it.each([
		"oversized",
		"utf8",
		"pcm",
		"id",
	])("kills invalid %s but waits for close", async (kind) => {
		const { lease, proc } = await meter();
		if (kind === "oversized") proc.stdout.write(Buffer.alloc(21000, 32));
		if (kind === "utf8") proc.stdout.write(Buffer.from([0xff]));
		if (kind === "pcm")
			proc.stdout.write(
				line({ schemaVersion: 1, event: "level", sequence: 0, peakPermille: 10, pcm: [1] }),
			);
		if (kind === "id") proc.stdout.write(line(ready("other")));
		expect(proc.kill).toHaveBeenCalled();
		expect(controller.isBusy()).toBe(true);
		proc.close(1);
		expect((await lease.done).status).toBe("failed");
	});
	it("cancels queued UI delivery on owner destruction", async () => {
		const { lease, proc } = await meter();
		proc.stdout.write(line({ schemaVersion: 1, event: "level", sequence: 0, peakPermille: 40 }));
		owner.destroy();
		await vi.advanceTimersByTimeAsync(100);
		expect(onEvent).toHaveBeenCalledTimes(1);
		proc.close();
		await lease.done;
	});
	it("waits for close on readiness and total lease watchdogs", async () => {
		const first = controller.start(request());
		await tick();
		await vi.advanceTimersByTimeAsync(3000);
		expect(processes[0].kill).toHaveBeenCalled();
		expect(controller.isBusy()).toBe(true);
		processes[0].close(1);
		expect(await first.done).toEqual({ status: "failed", code: "startup-timeout" });
		processes = [];
		const { lease, proc } = await meter();
		await vi.advanceTimersByTimeAsync(32000);
		expect(proc.kill).toHaveBeenCalled();
		expect(controller.isBusy()).toBe(true);
		proc.close(1);
		expect(await lease.done).toEqual({ status: "failed", code: "lease-timeout" });
	});
	it("balances overlapping pauses without admitting a job early", async () => {
		const one = controller.pauseAndDrain(),
			two = controller.pauseAndDrain();
		await Promise.all([one.settled, two.settled]);
		one.resume();
		one.resume();
		expect(() => controller.start(request())).toThrow("busy");
		two.resume();
		const lease = controller.start(request());
		await lease.cancel();
	});
	it("rejects stale owner during delivery", async () => {
		const { lease, proc } = await meter();
		current = false;
		proc.stdout.write(line({ schemaVersion: 1, event: "level", sequence: 0, peakPermille: 20 }));
		await vi.advanceTimersByTimeAsync(100);
		expect(proc.kill).toHaveBeenCalled();
		proc.close(1);
		expect(await lease.done).toEqual({ status: "failed", code: "invalid-owner" });
	});
	it("contains delivery callback failure until the helper closes", async () => {
		const { lease, proc } = await meter();
		onEvent.mockImplementation(() => {
			throw new Error("private diagnostic");
		});
		proc.stdout.write(line({ schemaVersion: 1, event: "level", sequence: 0, peakPermille: 25 }));
		await vi.advanceTimersByTimeAsync(100);
		expect(proc.kill).toHaveBeenCalled();
		expect(controller.isBusy()).toBe(true);
		proc.close(1);
		expect(await lease.done).toEqual({ status: "failed", code: "delivery-failed" });
	});
	it("does not let an old cancellation affect a later lease", async () => {
		const first = await meter();
		void first.lease.cancel();
		first.proc.close();
		await first.lease.done;
		processes = [];
		const second = await meter();
		await first.lease.cancel();
		expect(second.proc.kill).not.toHaveBeenCalled();
		void second.lease.cancel();
		second.proc.close();
		await second.lease.done;
	});
	it("bounds a stalled path lookup and rejects missing helper without spawn", async () => {
		lookup.mockReturnValue(
			new Promise(() => {
				/* Deliberately stalled lookup owns no process. */
			}),
		);
		const stalled = controller.start(request());
		await vi.advanceTimersByTimeAsync(3000);
		expect(await stalled.done).toEqual({ status: "failed", code: "startup-timeout" });
		expect(launch).not.toHaveBeenCalled();
		lookup.mockResolvedValue(null);
		const missing = controller.start(request());
		expect(await missing.done).toEqual({ status: "failed", code: "missing-helper" });
	});
});
