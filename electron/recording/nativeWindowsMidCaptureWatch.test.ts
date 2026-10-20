import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
	createNativeWindowsMidCaptureWatch,
	createNativeWindowsTakeSession,
	executeTakeStop,
	isTakeOwnerValid,
	queryTakeStatus,
	type WebContentsLike,
	type WebFrameMainLike,
} from "./nativeWindowsMidCaptureWatch";

interface FakeChildProcess extends EventEmitter {
	pid: number;
	exitCode: number | null;
	signalCode: NodeJS.Signals | null;
	stdout: EventEmitter;
	stderr: EventEmitter;
	stdin: EventEmitter;
}

function createFakeChildProcess(pid = 1234): FakeChildProcess {
	const proc = new EventEmitter() as FakeChildProcess;
	proc.pid = pid;
	proc.exitCode = null;
	proc.signalCode = null;
	proc.stdout = new EventEmitter();
	proc.stderr = new EventEmitter();
	proc.stdin = new EventEmitter();
	return proc;
}

function asChildProcess(proc: FakeChildProcess): ChildProcessWithoutNullStreams {
	return proc as unknown as ChildProcessWithoutNullStreams;
}

function createFakeFrame(params: {
	routingId: number;
	url?: string;
	isDestroyed?: boolean;
}): WebFrameMainLike {
	return {
		routingId: params.routingId,
		url: params.url ?? "http://localhost:5173/index.html?windowType=hud-overlay",
		isDestroyed: () => params.isDestroyed ?? false,
		send: vi.fn(),
	};
}

function createFakeWebContents(params: {
	id: number;
	url?: string;
	isDestroyed?: boolean;
	mainFrame?: WebFrameMainLike;
}): WebContentsLike {
	const frame = params.mainFrame ?? createFakeFrame({ routingId: 1, url: params.url });
	return {
		id: params.id,
		isDestroyed: () => params.isDestroyed ?? false,
		mainFrame: frame,
	};
}

describe("nativeWindowsMidCaptureWatch unit & edge case tests", () => {
	it("case 1: before-start exit does not trigger onTakeEnded", () => {
		const proc = createFakeChildProcess();
		const onTakeEnded = vi.fn();
		const take = createNativeWindowsTakeSession({
			recordingId: 101,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded,
		});

		proc.once("close", (code, signal) => watcher.onHelperClose(code, signal));

		// Helper closes BEFORE recording-started
		proc.emit("close", 1, null);

		expect(take.closed).toBe(true);
		expect(take.closeInfo?.code).toBe(1);
		expect(onTakeEnded).not.toHaveBeenCalled();
	});

	it("case 2: mid-capture close triggers onTakeEnded exactly once", () => {
		const proc = createFakeChildProcess();
		const onTakeEnded = vi.fn();
		const take = createNativeWindowsTakeSession({
			recordingId: 102,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded,
		});

		proc.once("close", (code, signal) => watcher.onHelperClose(code, signal));

		watcher.onRecordingStarted();
		proc.emit("close", 0, null);

		expect(take.closed).toBe(true);
		expect(onTakeEnded).toHaveBeenCalledTimes(1);
		expect(onTakeEnded).toHaveBeenCalledWith({
			recordingId: 102,
			code: 0,
			signal: null,
			reason: "helper-closed",
		});
	});

	it("case 3: start + close in the same round/tick triggers onTakeEnded", () => {
		const proc = createFakeChildProcess();
		const onTakeEnded = vi.fn();
		const take = createNativeWindowsTakeSession({
			recordingId: 103,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded,
		});

		proc.once("close", (code, signal) => watcher.onHelperClose(code, signal));

		// Close arrives in same turn/tick before onRecordingStarted is invoked
		proc.emit("close", 0, null);
		expect(onTakeEnded).not.toHaveBeenCalled();

		// Start confirmation settles in same tick
		watcher.onRecordingStarted();
		expect(onTakeEnded).toHaveBeenCalledTimes(1);
		expect(onTakeEnded).toHaveBeenCalledWith({
			recordingId: 103,
			code: 0,
			signal: null,
			reason: "helper-closed",
		});
	});

	it("case 4: close before renderer handle registration is queryable via queryTakeStatus", () => {
		const proc = createFakeChildProcess();
		const onTakeEnded = vi.fn();
		const frame = createFakeFrame({ routingId: 1 });
		const webContents = createFakeWebContents({ id: 42, mainFrame: frame });

		const take = createNativeWindowsTakeSession({
			recordingId: 104,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
			ownerDocumentUrl: frame.url,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded,
		});

		proc.once("close", (code, signal) => watcher.onHelperClose(code, signal));

		watcher.onRecordingStarted();
		proc.emit("close", 0, null);

		const status = queryTakeStatus(take, { webContents, frame }, 104);
		expect(status.active).toBe(true);
		expect(status.closed).toBe(true);
		expect(status.code).toBe(0);
	});

	it("case 5: stale take / generation mismatch is ignored", () => {
		const procOld = createFakeChildProcess(1001);
		const onTakeEndedOld = vi.fn();
		let currentTakeId = 200;

		const takeOld = createNativeWindowsTakeSession({
			recordingId: 100,
			generation: 1,
			proc: asChildProcess(procOld),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcherOld = createNativeWindowsMidCaptureWatch(takeOld, {
			isCurrentTake: () => currentTakeId === 100,
			onTakeEnded: onTakeEndedOld,
		});

		procOld.once("close", (code, signal) => watcherOld.onHelperClose(code, signal));

		watcherOld.onRecordingStarted();
		currentTakeId = 200;

		procOld.emit("close", 0, null);
		expect(onTakeEndedOld).not.toHaveBeenCalled();
	});

	it("case 6: simultaneous manual stop and helper close (first-wins stop promise)", async () => {
		const proc = createFakeChildProcess();
		const onTakeEnded = vi.fn();
		const take = createNativeWindowsTakeSession({
			recordingId: 106,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded,
		});

		proc.once("close", (code, signal) => watcher.onHelperClose(code, signal));
		watcher.onRecordingStarted();

		let resolveStop: (val: { success: boolean; path: string }) => void;
		const stopTask = new Promise<{ success: boolean; path: string }>((resolve) => {
			resolveStop = resolve;
		});
		const firstStop = executeTakeStop(take, 106, () => stopTask);
		expect(firstStop.accepted).toBe(true);
		expect(take.stopState).toBe("stopping");

		proc.emit("close", 0, null);
		expect(onTakeEnded).not.toHaveBeenCalled();

		const secondStop = executeTakeStop(take, 106, () =>
			Promise.resolve({ success: false, path: "" }),
		);
		expect(secondStop.accepted).toBe(true);
		if (firstStop.accepted && secondStop.accepted) {
			expect(secondStop.promise).toBe(firstStop.promise);
		}

		resolveStop!({ success: true, path: "rec.mp4" });
		if (!firstStop.accepted) throw new Error("firstStop was not accepted");
		const result = await firstStop.promise;
		expect(result).toEqual({ success: true, path: "rec.mp4" });
		expect(take.stopState).toBe("stopped");
	});

	it("case 7: discard during active take initiates stop and ignores subsequent close", async () => {
		const proc = createFakeChildProcess();
		const onTakeEnded = vi.fn();
		const take = createNativeWindowsTakeSession({
			recordingId: 107,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded,
		});

		proc.once("close", (code, signal) => watcher.onHelperClose(code, signal));
		watcher.onRecordingStarted();

		const discardStop = executeTakeStop(take, 107, async () => ({
			success: true,
			discarded: true,
		}));
		expect(discardStop.accepted).toBe(true);
		if (!discardStop.accepted) throw new Error("discardStop was not accepted");
		await discardStop.promise;
		expect(take.stopState).toBe("stopped");

		proc.emit("close", 0, null);
		expect(onTakeEnded).not.toHaveBeenCalled();
	});

	it("case 8: duplicate close events fire at most once", () => {
		const proc = createFakeChildProcess();
		const onTakeEnded = vi.fn();
		const take = createNativeWindowsTakeSession({
			recordingId: 108,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded,
		});

		watcher.onRecordingStarted();
		watcher.onHelperClose(0, null);
		watcher.onHelperClose(0, null);

		expect(onTakeEnded).toHaveBeenCalledTimes(1);
	});

	it("case 9: stale stop IPC request is rejected before any side effects", async () => {
		const proc = createFakeChildProcess();
		const take = createNativeWindowsTakeSession({
			recordingId: 109,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		let sideEffectRun = false;
		const sideEffectFn = vi.fn(async () => {
			sideEffectRun = true;
			return { success: true };
		});
		const stopResult = executeTakeStop(take, 999, sideEffectFn); // 999 !== 109

		expect(stopResult.accepted).toBe(false);
		if (!stopResult.accepted) {
			expect(stopResult.error).toContain("Stale recording stop request");
		}
		expect(sideEffectFn).not.toHaveBeenCalled();
		expect(sideEffectRun).toBe(false);
		expect(take.stopState).toBe("idle");
	});

	it("case 10: owner and frame validation strictly enforces fail-closed checks", () => {
		const proc = createFakeChildProcess();
		const validFrame = createFakeFrame({ routingId: 1, url: "http://localhost:5173/hud" });
		const validWebContents = createFakeWebContents({
			id: 42,
			url: "http://localhost:5173/hud",
			mainFrame: validFrame,
		});

		const take = createNativeWindowsTakeSession({
			recordingId: 110,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
			ownerDocumentUrl: "http://localhost:5173/hud",
		});

		// 1. Valid owner and main frame succeeds
		expect(isTakeOwnerValid(take, { webContents: validWebContents, frame: validFrame })).toBe(true);
		expect(
			queryTakeStatus(take, { webContents: validWebContents, frame: validFrame }, 110).unauthorized,
		).toBeUndefined();

		// 2. Subframe rejection: frame !== webContents.mainFrame
		const subFrame = createFakeFrame({ routingId: 1, url: "http://localhost:5173/hud" });
		expect(isTakeOwnerValid(take, { webContents: validWebContents, frame: subFrame })).toBe(false);

		// 3. Destroyed webContents / frame rejection
		const destroyedWebContents = createFakeWebContents({
			id: 42,
			isDestroyed: true,
			mainFrame: validFrame,
		});
		expect(isTakeOwnerValid(take, { webContents: destroyedWebContents, frame: validFrame })).toBe(
			false,
		);

		const destroyedFrame = createFakeFrame({ routingId: 1, isDestroyed: true });
		expect(isTakeOwnerValid(take, { webContents: validWebContents, frame: destroyedFrame })).toBe(
			false,
		);

		// 4. Navigated frame rejection: URL changed
		const navigatedFrame = createFakeFrame({
			routingId: 1,
			url: "http://localhost:5173/other-page",
		});
		const navigatedWebContents = createFakeWebContents({
			id: 42,
			url: "http://localhost:5173/other-page",
			mainFrame: navigatedFrame,
		});
		expect(
			isTakeOwnerValid(take, { webContents: navigatedWebContents, frame: navigatedFrame }),
		).toBe(false);

		// 5. Mismatched IDs rejection
		const wrongWebContents = createFakeWebContents({ id: 99, mainFrame: validFrame });
		expect(isTakeOwnerValid(take, { webContents: wrongWebContents, frame: validFrame })).toBe(
			false,
		);

		const wrongFrame = createFakeFrame({ routingId: 2 });
		const wrongFrameWebContents = createFakeWebContents({ id: 42, mainFrame: wrongFrame });
		expect(isTakeOwnerValid(take, { webContents: wrongFrameWebContents, frame: wrongFrame })).toBe(
			false,
		);

		// 6. Fail-closed when caller.frame is null or undefined
		expect(isTakeOwnerValid(take, { webContents: validWebContents, frame: null })).toBe(false);
		expect(isTakeOwnerValid(take, { webContents: validWebContents, frame: undefined })).toBe(false);

		// 7. Fail-closed when mainFrame is absent/null on webContents
		const noMainFrameWebContents = {
			id: 42,
			isDestroyed: () => false,
			mainFrame: null,
		};
		expect(isTakeOwnerValid(take, { webContents: noMainFrameWebContents, frame: validFrame })).toBe(
			false,
		);

		// 8. Fail-closed when isDestroyed method is absent or not a function
		const brokenFrame = {
			routingId: 1,
			url: "http://localhost:5173/hud",
			isDestroyed: undefined as unknown as () => boolean,
			send: vi.fn(),
		};
		expect(isTakeOwnerValid(take, { webContents: validWebContents, frame: brokenFrame })).toBe(
			false,
		);

		// 9. Fail-closed when URL is empty on frame or take
		const emptyUrlFrame = createFakeFrame({ routingId: 1, url: "" });
		const emptyUrlWebContents = createFakeWebContents({ id: 42, mainFrame: emptyUrlFrame });
		expect(isTakeOwnerValid(take, { webContents: emptyUrlWebContents, frame: emptyUrlFrame })).toBe(
			false,
		);

		const emptyTakeUrl = createNativeWindowsTakeSession({
			recordingId: 110,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
			ownerDocumentUrl: "",
		});
		expect(
			isTakeOwnerValid(emptyTakeUrl, { webContents: validWebContents, frame: validFrame }),
		).toBe(false);

		// 10. Fail-closed when a getter throws (e.g. disposed frame / URL property access error)
		const throwingFrame: WebFrameMainLike = {
			routingId: 1,
			get url(): string {
				throw new Error("Frame detached during access");
			},
			isDestroyed: () => false,
			send: vi.fn(),
		};
		const throwingWebContents = createFakeWebContents({
			id: 42,
			mainFrame: throwingFrame,
		});
		expect(isTakeOwnerValid(take, { webContents: throwingWebContents, frame: throwingFrame })).toBe(
			false,
		);

		// 11. Fail-closed when take has null owner IDs
		const invalidTake = createNativeWindowsTakeSession({
			recordingId: 110,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: null,
			ownerFrameRoutingId: null,
		});
		expect(
			isTakeOwnerValid(invalidTake, { webContents: validWebContents, frame: validFrame }),
		).toBe(false);
		expect(
			queryTakeStatus(invalidTake, { webContents: validWebContents, frame: validFrame }, 110)
				.unauthorized,
		).toBe(true);
	});

	it("case 11: late stdout data chunks drain before close handling", () => {
		const proc = createFakeChildProcess();
		const chunks: string[] = [];
		const onTakeEnded = vi.fn();

		const take = createNativeWindowsTakeSession({
			recordingId: 111,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		const watcher = createNativeWindowsMidCaptureWatch(take, {
			isCurrentTake: () => true,
			onTakeEnded: (payload) => {
				onTakeEnded({ payload, capturedChunks: [...chunks] });
			},
		});

		proc.stdout.on("data", (chunk: Buffer) => {
			chunks.push(chunk.toString());
		});
		proc.once("close", (code, signal) => {
			watcher.onHelperClose(code, signal);
		});

		watcher.onRecordingStarted();

		// Emit stdout data right before close
		proc.stdout.emit("data", Buffer.from("final telemetry data"));
		proc.emit("close", 0, null);

		expect(chunks).toEqual(["final telemetry data"]);
		expect(onTakeEnded).toHaveBeenCalledWith({
			payload: {
				recordingId: 111,
				code: 0,
				signal: null,
				reason: "helper-closed",
			},
			capturedChunks: ["final telemetry data"],
		});
	});

	it("case 12: executeTakeStop handles synchronous re-entrance before first await: invokes callback once and returns same promise", async () => {
		const proc = createFakeChildProcess();
		const take = createNativeWindowsTakeSession({
			recordingId: 112,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		let callbackInvocations = 0;
		let reentrantResult: ReturnType<typeof executeTakeStop> | undefined;

		const performStop = async () => {
			callbackInvocations += 1;
			// Re-enter executeTakeStop synchronously BEFORE first await
			reentrantResult = executeTakeStop(take, 112, async () => {
				callbackInvocations += 1;
				return { success: false, reentrant: true };
			});
			return { success: true, initial: true };
		};

		const firstStop = executeTakeStop(take, 112, performStop);
		expect(firstStop.accepted).toBe(true);
		if (!firstStop.accepted) throw new Error("firstStop not accepted");

		const result = await firstStop.promise;
		expect(result).toEqual({ success: true, initial: true });

		expect(callbackInvocations).toBe(1);
		expect(reentrantResult).toBeDefined();
		expect(reentrantResult?.accepted).toBe(true);
		if (reentrantResult?.accepted) {
			expect(reentrantResult.promise).toBe(firstStop.promise);
		}
		expect(take.stopState).toBe("stopped");
	});

	it("case 13: queryTakeStatus rejects malformed, non-integer, or missing expectedRecordingId with invalidId", () => {
		const proc = createFakeChildProcess();
		const frame = createFakeFrame({ routingId: 1 });
		const webContents = createFakeWebContents({ id: 42, mainFrame: frame });

		const take = createNativeWindowsTakeSession({
			recordingId: 113,
			generation: 1,
			proc: asChildProcess(proc),
			ownerWebContentsId: 42,
			ownerFrameRoutingId: 1,
		});

		expect(queryTakeStatus(take, { webContents, frame }, 0 as unknown as number).invalidId).toBe(
			true,
		);
		expect(queryTakeStatus(take, { webContents, frame }, -5 as unknown as number).invalidId).toBe(
			true,
		);
		expect(queryTakeStatus(take, { webContents, frame }, 1.5 as unknown as number).invalidId).toBe(
			true,
		);
		expect(
			queryTakeStatus(take, { webContents, frame }, "113" as unknown as number).invalidId,
		).toBe(true);
		expect(queryTakeStatus(take, { webContents, frame }, null as unknown as number).invalidId).toBe(
			true,
		);
		expect(
			queryTakeStatus(take, { webContents, frame }, undefined as unknown as number).invalidId,
		).toBe(true);
	});
});
