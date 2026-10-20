import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type NativeWindowsTakeStopState = "idle" | "stopping" | "stopped";

export interface NativeWindowsTakeCloseInfo {
	code: number | null;
	signal: NodeJS.Signals | null;
	reason: "helper-closed" | "stream-error";
}

export interface NativeWindowsTakeEndedPayload {
	recordingId: number;
	code: number | null;
	signal: NodeJS.Signals | null;
	reason: string;
}

export interface WebFrameMainLike {
	routingId: number;
	url: string;
	isDestroyed(): boolean;
	send(channel: string, ...args: unknown[]): void;
}

export interface WebContentsLike {
	id: number;
	isDestroyed(): boolean;
	mainFrame: WebFrameMainLike | null | undefined;
}

export interface NativeWindowsCallerIdentity {
	webContents: WebContentsLike | null | undefined;
	frame: WebFrameMainLike | null | undefined;
}

export interface NativeWindowsTakeSession {
	readonly recordingId: number;
	readonly generation: number;
	readonly proc: ChildProcessWithoutNullStreams;
	readonly ownerWebContentsId: number | null;
	readonly ownerFrameRoutingId: number | null;
	readonly ownerDocumentUrl: string | null;
	recordingStarted: boolean;
	closed: boolean;
	closeInfo: NativeWindowsTakeCloseInfo | null;
	stopState: NativeWindowsTakeStopState;
	stopPromise: Promise<unknown> | null;
	triggered: boolean;
}

export interface NativeWindowsMidCaptureWatchOptions {
	isCurrentTake: () => boolean;
	onTakeEnded: (payload: NativeWindowsTakeEndedPayload) => void;
}

/**
 * Creates a take session descriptor that tracks process lifecycle,
 * owner identification, and stop concurrency.
 */
export function createNativeWindowsTakeSession(params: {
	recordingId: number;
	generation: number;
	proc: ChildProcessWithoutNullStreams;
	ownerWebContentsId: number | null;
	ownerFrameRoutingId: number | null;
	ownerDocumentUrl?: string | null;
}): NativeWindowsTakeSession {
	return {
		recordingId: params.recordingId,
		generation: params.generation,
		proc: params.proc,
		ownerWebContentsId: params.ownerWebContentsId,
		ownerFrameRoutingId: params.ownerFrameRoutingId,
		ownerDocumentUrl: params.ownerDocumentUrl ?? null,
		recordingStarted: false,
		closed: false,
		closeInfo: null,
		stopState: "idle",
		stopPromise: null,
		triggered: false,
	};
}

/**
 * Validates that an incoming IPC caller represents the genuine document/frame
 * that started the capture session.
 * Rejects:
 * - Null or destroyed WebContents/Frame.
 * - ID mismatches.
 * - Subframes (frame !== webContents.mainFrame).
 * - Navigated frames (URL changed from ownerDocumentUrl).
 */
export function isTakeOwnerValid(
	take: NativeWindowsTakeSession | null,
	caller: NativeWindowsCallerIdentity,
): boolean {
	if (!take) return false;

	// Fail-closed if take lacks valid non-null owner IDs or empty document URL
	if (
		typeof take.ownerWebContentsId !== "number" ||
		!Number.isFinite(take.ownerWebContentsId) ||
		typeof take.ownerFrameRoutingId !== "number" ||
		!Number.isFinite(take.ownerFrameRoutingId) ||
		typeof take.ownerDocumentUrl !== "string" ||
		take.ownerDocumentUrl.length === 0
	) {
		return false;
	}

	const webContents = caller.webContents;
	const frame = caller.frame;

	if (!webContents || !frame) {
		return false;
	}

	try {
		if (typeof webContents.isDestroyed !== "function" || webContents.isDestroyed()) {
			return false;
		}

		if (webContents.id !== take.ownerWebContentsId) {
			return false;
		}

		if (typeof frame.isDestroyed !== "function" || frame.isDestroyed()) {
			return false;
		}

		if (frame.routingId !== take.ownerFrameRoutingId) {
			return false;
		}

		// Require caller.frame strictly === webContents.mainFrame and mainFrame non-null
		if (!webContents.mainFrame || frame !== webContents.mainFrame) {
			return false;
		}

		// Require non-empty frame.url strictly === take.ownerDocumentUrl
		const currentUrl = frame.url;
		if (
			typeof currentUrl !== "string" ||
			currentUrl.length === 0 ||
			currentUrl !== take.ownerDocumentUrl
		) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

/**
 * Creates a watcher for a Windows capture take. Monitors helper stream closure
 * and notifies the owner if the helper exits mid-take without the user stopping it.
 */
export function createNativeWindowsMidCaptureWatch(
	take: NativeWindowsTakeSession,
	options: NativeWindowsMidCaptureWatchOptions,
) {
	let detached = false;

	/**
	 * Called once `waitForNativeWindowsCaptureStart` confirms "Recording started".
	 * If the helper already closed in the same turn/tick before this was registered,
	 * trigger the ended notification immediately.
	 */
	const onRecordingStarted = () => {
		if (detached) return;
		take.recordingStarted = true;
		if (take.closed && take.stopState === "idle" && !take.triggered && options.isCurrentTake()) {
			take.triggered = true;
			options.onTakeEnded({
				recordingId: take.recordingId,
				code: take.closeInfo?.code ?? null,
				signal: take.closeInfo?.signal ?? null,
				reason: take.closeInfo?.reason ?? "helper-closed",
			});
		}
	};

	/**
	 * Called strictly when the helper's `close` event fires (after stdout/stderr drain).
	 * Retains the closed state in `take`. If recording has already started and stop
	 * is not in flight, notifies the owner via `onTakeEnded`.
	 */
	const onHelperClose = (code: number | null, signal: NodeJS.Signals | null) => {
		if (detached) return;
		take.closed = true;
		take.closeInfo = { code, signal, reason: "helper-closed" };

		if (
			take.recordingStarted &&
			take.stopState === "idle" &&
			!take.triggered &&
			options.isCurrentTake()
		) {
			take.triggered = true;
			options.onTakeEnded({
				recordingId: take.recordingId,
				code,
				signal,
				reason: "helper-closed",
			});
		}
	};

	const detach = () => {
		detached = true;
	};

	return {
		onRecordingStarted,
		onHelperClose,
		detach,
	};
}

/**
 * Coordinates stop execution for a take using a synchronous first-wins policy.
 * - Rejects stale requests if `expectedRecordingId` is provided and does not match.
 * - If a stop is already in flight for this take, reuses the in-flight promise.
 * - Registers the stop promise synchronously before calling `performStop()`, so that
 *   synchronous re-entrance before the first await reuses the in-flight promise and
 *   invokes the underlying stop callback only once.
 */
export function executeTakeStop<T>(
	take: NativeWindowsTakeSession,
	expectedRecordingId: number | undefined,
	performStop: () => Promise<T>,
): { accepted: true; promise: Promise<T> } | { accepted: false; error: string } {
	if (expectedRecordingId !== undefined && expectedRecordingId !== take.recordingId) {
		return { accepted: false, error: "Stale recording stop request." };
	}

	if (take.stopState !== "idle" && take.stopPromise) {
		return { accepted: true, promise: take.stopPromise as Promise<T> };
	}

	take.stopState = "stopping";
	const promise = Promise.resolve()
		.then(() => performStop())
		.finally(() => {
			take.stopState = "stopped";
		});

	take.stopPromise = promise;
	return { accepted: true, promise };
}

/**
 * Handles the query/ack from the renderer after recording start confirmation.
 * Enforces fail-closed identity verification:
 * - `expectedRecordingId` is mandatory and must be a positive safe integer.
 * - Both `take.ownerWebContentsId` and `take.ownerFrameRoutingId` must be valid, non-null IDs.
 * - Caller must represent the valid unnavigated main frame of the owner WebContents.
 * - If any check fails, returns `unauthorized: true` or `invalidId: true`.
 */
export function queryTakeStatus(
	take: NativeWindowsTakeSession | null,
	caller: NativeWindowsCallerIdentity,
	expectedRecordingId: number,
): {
	active: boolean;
	closed: boolean;
	code?: number | null;
	signal?: NodeJS.Signals | null;
	reason?: string | null;
	stopState?: NativeWindowsTakeStopState;
	stale?: boolean;
	unauthorized?: boolean;
	invalidId?: boolean;
} {
	if (
		typeof expectedRecordingId !== "number" ||
		!Number.isSafeInteger(expectedRecordingId) ||
		expectedRecordingId <= 0
	) {
		return { active: false, closed: false, invalidId: true };
	}

	if (!take) {
		return { active: false, closed: false };
	}

	if (expectedRecordingId !== take.recordingId) {
		return { active: false, closed: false, stale: true };
	}

	if (!isTakeOwnerValid(take, caller)) {
		return { active: false, closed: false, unauthorized: true };
	}

	return {
		active: take.stopState !== "stopped",
		closed: take.closed,
		code: take.closeInfo?.code ?? null,
		signal: take.closeInfo?.signal ?? null,
		reason: take.closeInfo?.reason ?? null,
		stopState: take.stopState,
	};
}
