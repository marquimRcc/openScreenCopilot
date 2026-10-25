import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
	type ScheduleTimerFn,
	type WorkerProcessLike,
	WorkerProcessSupervisor,
	WorkerSupervisorError,
} from "./workerProcessSupervisor";

class FakeProcess extends EventEmitter implements WorkerProcessLike {
	readonly killCalls: Array<NodeJS.Signals | undefined> = [];
	killReturnValue = true;
	killThrowError: Error | null = null;

	constructor(readonly pid: number) {
		super();
	}

	kill(signal?: NodeJS.Signals): boolean {
		this.killCalls.push(signal);
		if (this.killThrowError) {
			throw this.killThrowError;
		}
		return this.killReturnValue;
	}

	simulateExit(code: number | null = 0, signal: NodeJS.Signals | null = null): void {
		this.emit("exit", code, signal);
	}
}

interface MockTimer {
	readonly ms: number;
	readonly fire: () => void;
	cancelled: boolean;
	fired: boolean;
}

function createMockScheduler() {
	const timers: MockTimer[] = [];
	const scheduleTimer: ScheduleTimerFn = (ms, onTimeout) => {
		const timer: MockTimer = {
			ms,
			fire: () => {
				if (!timer.cancelled && !timer.fired) {
					timer.fired = true;
					onTimeout();
				}
			},
			cancelled: false,
			fired: false,
		};
		timers.push(timer);
		return () => {
			timer.cancelled = true;
		};
	};

	return {
		timers,
		scheduleTimer,
		get activeTimers() {
			return timers.filter((t) => !t.cancelled && !t.fired);
		},
	};
}

describe("WorkerProcessSupervisor", () => {
	it("rejects invalid options in constructor", () => {
		expect(() => new WorkerProcessSupervisor({ termTimeoutMs: 0, killTimeoutMs: 1000 })).toThrow(
			WorkerSupervisorError,
		);
		expect(() => new WorkerProcessSupervisor({ termTimeoutMs: 1000, killTimeoutMs: -1 })).toThrow(
			WorkerSupervisorError,
		);
	});

	it("rejects invalid or non-positive integer pids and invalid process shapes on attach", () => {
		const supervisor = new WorkerProcessSupervisor({ termTimeoutMs: 1000, killTimeoutMs: 1000 });
		const noop = () => undefined;

		// Null/undefined/empty
		expect(() => supervisor.attach(null as unknown as WorkerProcessLike)).toThrow(
			"invalid-process",
		);
		expect(() => supervisor.attach({} as unknown as WorkerProcessLike)).toThrow("invalid-process");

		// Missing or invalid pid
		expect(() =>
			supervisor.attach({
				kill: () => true,
				once: noop,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");

		expect(() =>
			supervisor.attach({
				pid: 0,
				kill: () => true,
				once: noop,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");

		expect(() =>
			supervisor.attach({
				pid: -1,
				kill: () => true,
				once: noop,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");

		expect(() =>
			supervisor.attach({
				pid: 12.34,
				kill: () => true,
				once: noop,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");

		expect(() =>
			supervisor.attach({
				pid: Number.NaN,
				kill: () => true,
				once: noop,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");

		expect(() =>
			supervisor.attach({
				pid: Number.POSITIVE_INFINITY,
				kill: () => true,
				once: noop,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");

		// Missing kill or once
		expect(() =>
			supervisor.attach({
				pid: 123,
				once: noop,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");

		expect(() =>
			supervisor.attach({
				pid: 123,
				kill: () => true,
			} as unknown as WorkerProcessLike),
		).toThrow("invalid-process");
	});

	it("observes spontaneous process exit without prior stop() call and manages listener counts", () => {
		const proc = new FakeProcess(101);
		const supervisor = new WorkerProcessSupervisor({ termTimeoutMs: 1000, killTimeoutMs: 2000 });

		expect(supervisor.state).toBe("idle");
		expect(supervisor.lastReceipt).toBeNull();

		const gen = supervisor.attach(proc);
		expect(gen).toBe(1);
		expect(supervisor.state).toBe("attached");
		expect(supervisor.pid).toBe(101);
		expect(supervisor.lastReceipt).toBeNull();
		expect(proc.listenerCount("exit")).toBe(1);

		// Spontaneous crash/exit
		proc.simulateExit(1, null);

		expect(supervisor.state).toBe("exited");
		expect(proc.listenerCount("exit")).toBe(0);
		expect(supervisor.lastReceipt).toEqual({
			generation: 1,
			pid: 101,
			exitCode: 1,
			signal: null,
			forced: false,
		});

		// Calling stop() after spontaneous exit resolves with the recorded receipt
		return supervisor.stop().then((receipt) => {
			expect(receipt).toEqual(supervisor.lastReceipt);
		});
	});

	it("observes graceful SIGTERM exit and cleans up timers and listeners", async () => {
		const scheduler = createMockScheduler();
		const proc = new FakeProcess(202);
		const supervisor = new WorkerProcessSupervisor({
			termTimeoutMs: 3000,
			killTimeoutMs: 2000,
			scheduleTimer: scheduler.scheduleTimer,
		});

		supervisor.attach(proc);
		expect(proc.listenerCount("exit")).toBe(1);
		expect(supervisor.lastReceipt).toBeNull();

		const stopPromise = supervisor.stop();

		expect(proc.killCalls).toEqual(["SIGTERM"]);
		expect(scheduler.activeTimers.length).toBe(1);
		expect(scheduler.activeTimers[0].ms).toBe(3000);
		expect(supervisor.state).toBe("stopping");
		expect(supervisor.lastReceipt).toBeNull();

		// Process exits before timeout
		proc.simulateExit(0, "SIGTERM");

		const receipt = await stopPromise;
		expect(receipt).toEqual({
			generation: 1,
			pid: 202,
			exitCode: 0,
			signal: "SIGTERM",
			forced: false,
		});

		expect(supervisor.state).toBe("exited");
		// Timer and listener must be cleaned up
		expect(scheduler.activeTimers.length).toBe(0);
		expect(proc.listenerCount("exit")).toBe(0);
		expect(supervisor.lastReceipt).toEqual(receipt);
	});

	it("escalates to SIGKILL when SIGTERM deadline expires and cleans up on exit", async () => {
		const scheduler = createMockScheduler();
		const proc = new FakeProcess(303);
		const supervisor = new WorkerProcessSupervisor({
			termTimeoutMs: 3000,
			killTimeoutMs: 2000,
			scheduleTimer: scheduler.scheduleTimer,
		});

		supervisor.attach(proc);
		expect(proc.listenerCount("exit")).toBe(1);
		const stopPromise = supervisor.stop();

		expect(proc.killCalls).toEqual(["SIGTERM"]);
		expect(scheduler.activeTimers.length).toBe(1);

		// Fire SIGTERM timeout
		scheduler.activeTimers[0].fire();

		// SIGKILL must be sent, and a new timer scheduled
		expect(proc.killCalls).toEqual(["SIGTERM", "SIGKILL"]);
		expect(scheduler.activeTimers.length).toBe(1);
		expect(scheduler.activeTimers[0].ms).toBe(2000);
		expect(supervisor.state).toBe("stopping");
		expect(supervisor.lastReceipt).toBeNull();

		// Process exits following SIGKILL
		proc.simulateExit(null, "SIGKILL");

		const receipt = await stopPromise;
		expect(receipt).toEqual({
			generation: 1,
			pid: 303,
			exitCode: null,
			signal: "SIGKILL",
			forced: true,
		});

		expect(supervisor.state).toBe("exited");
		expect(scheduler.activeTimers.length).toBe(0);
		expect(proc.listenerCount("exit")).toBe(0);
		expect(supervisor.lastReceipt).toEqual(receipt);
	});

	it("cleans up timer and preserves listener in uncertain state, then cleans listener on late exit", async () => {
		const scheduler = createMockScheduler();
		const proc = new FakeProcess(404);
		const supervisor = new WorkerProcessSupervisor({
			termTimeoutMs: 1000,
			killTimeoutMs: 1500,
			scheduleTimer: scheduler.scheduleTimer,
		});

		supervisor.attach(proc);
		expect(proc.listenerCount("exit")).toBe(1);
		const stopPromise = supervisor.stop();

		// Fire TERM deadline
		scheduler.activeTimers[0].fire();
		expect(proc.killCalls).toEqual(["SIGTERM", "SIGKILL"]);

		// Fire KILL deadline without exit
		scheduler.activeTimers[0].fire();

		// stop() must reject with unknown-timed-out
		await expect(stopPromise).rejects.toThrow("unknown-timed-out");

		// State is uncertain: timer finished/normalized to null, no active timers, but listener remains
		expect(supervisor.state).toBe("uncertain");
		expect(scheduler.activeTimers.length).toBe(0);
		expect(proc.listenerCount("exit")).toBe(1);
		expect(supervisor.pid).toBe(404);
		expect(supervisor.lastReceipt).toBeNull();

		// Subsequent attach of replacement process MUST fail while state is uncertain
		const proc2 = new FakeProcess(505);
		expect(() => supervisor.attach(proc2)).toThrow("uncertain-exit");

		// When process emits exit late: recovers to exited, cleans listener
		proc.simulateExit(137, "SIGKILL");
		expect(supervisor.state).toBe("exited");
		expect(proc.listenerCount("exit")).toBe(0);
		expect(scheduler.activeTimers.length).toBe(0);
		expect(supervisor.lastReceipt).toEqual({
			generation: 1,
			pid: 404,
			exitCode: 137,
			signal: "SIGKILL",
			forced: true,
		});

		// Attaching new generation clears lastReceipt immediately
		const gen2 = supervisor.attach(proc2);
		expect(gen2).toBe(2);
		expect(supervisor.state).toBe("attached");
		expect(supervisor.lastReceipt).toBeNull();
		expect(supervisor.pid).toBe(505);
		expect(proc.listenerCount("exit")).toBe(0);
		expect(proc2.listenerCount("exit")).toBe(1);
	});

	it("coalesces concurrent stop calls into the same promise without duplicating signals", async () => {
		const proc = new FakeProcess(606);
		const supervisor = new WorkerProcessSupervisor({ termTimeoutMs: 5000, killTimeoutMs: 2000 });

		supervisor.attach(proc);

		const p1 = supervisor.stop();
		const p2 = supervisor.stop();
		const p3 = supervisor.stop();

		expect(p1).toBe(p2);
		expect(p2).toBe(p3);

		// Exactly one SIGTERM was sent
		expect(proc.killCalls).toEqual(["SIGTERM"]);

		proc.simulateExit(0, null);

		const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
		expect(r1).toEqual(r2);
		expect(r2).toEqual(r3);
		expect(r1.pid).toBe(606);
		expect(r1.generation).toBe(1);
	});

	it("isolates generations against stale captured listeners from older generations", () => {
		let capturedListener: ((code: number | null, signal: NodeJS.Signals | null) => void) | null =
			null;
		const proc1 = new FakeProcess(701);
		const origOnce = proc1.once.bind(proc1);
		proc1.once = (
			event: "exit",
			listener: (code: number | null, signal: NodeJS.Signals | null) => void,
		) => {
			capturedListener = listener;
			return origOnce(event, listener);
		};

		const supervisor = new WorkerProcessSupervisor({ termTimeoutMs: 1000, killTimeoutMs: 1000 });

		// Attach gen1
		const gen1 = supervisor.attach(proc1);
		expect(gen1).toBe(1);
		expect(proc1.listenerCount("exit")).toBe(1);
		expect(capturedListener).not.toBeNull();

		// Proc1 exits spontaneously
		proc1.simulateExit(0, null);
		expect(supervisor.state).toBe("exited");
		expect(proc1.listenerCount("exit")).toBe(0);

		// Attach gen2
		const proc2 = new FakeProcess(702);
		const gen2 = supervisor.attach(proc2);
		expect(gen2).toBe(2);
		expect(supervisor.state).toBe("attached");
		expect(supervisor.pid).toBe(702);
		expect(supervisor.lastReceipt).toBeNull();
		expect(proc1.listenerCount("exit")).toBe(0);
		expect(proc2.listenerCount("exit")).toBe(1);

		// Stale captured callback from gen1 is triggered out-of-band
		capturedListener!(1, "SIGKILL");

		// Must NOT mutate or clear gen2
		expect(supervisor.state).toBe("attached");
		expect(supervisor.generation).toBe(2);
		expect(supervisor.pid).toBe(702);
		expect(supervisor.lastReceipt).toBeNull();
		expect(proc2.listenerCount("exit")).toBe(1);
	});

	it("handles kill returning false or throwing without claiming exit", async () => {
		const proc = new FakeProcess(808);
		proc.killReturnValue = false; // kill delivery refused/failed

		const supervisor = new WorkerProcessSupervisor({ termTimeoutMs: 5000, killTimeoutMs: 2000 });
		supervisor.attach(proc);

		const stopPromise = supervisor.stop();
		expect(proc.killCalls).toEqual(["SIGTERM"]);

		// kill returning false does NOT mean exited!
		expect(supervisor.state).toBe("stopping");

		// Only when exit actually fires does it complete
		proc.simulateExit(0, null);
		const receipt = await stopPromise;
		expect(receipt.exitCode).toBe(0);
		expect(supervisor.state).toBe("exited");
	});

	it("handles kill throwing an error without crashing and continues waiting for exit", async () => {
		const proc = new FakeProcess(909);
		proc.killThrowError = new Error("EPERM: operation not permitted");

		const supervisor = new WorkerProcessSupervisor({ termTimeoutMs: 5000, killTimeoutMs: 2000 });
		supervisor.attach(proc);

		const stopPromise = supervisor.stop();
		expect(proc.killCalls).toEqual(["SIGTERM"]);

		// Did not crash or claim exit
		expect(supervisor.state).toBe("stopping");

		proc.simulateExit(1, null);
		const receipt = await stopPromise;
		expect(receipt.exitCode).toBe(1);
		expect(supervisor.state).toBe("exited");
	});

	it("refuses attach when process is already active or supervisor is uncertain", () => {
		const supervisor = new WorkerProcessSupervisor({ termTimeoutMs: 1000, killTimeoutMs: 1000 });
		const proc1 = new FakeProcess(111);
		supervisor.attach(proc1);

		// Already attached
		const proc2 = new FakeProcess(222);
		expect(() => supervisor.attach(proc2)).toThrow("already-attached");
	});
});
