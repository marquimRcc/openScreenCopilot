import { useCallback, useEffect, useRef, useState } from "react";
import type { WindowsOutputMeterMessage } from "../lib/windowsOutputMeter";

export type WindowsOutputMeterStatus =
	| "idle"
	| "starting"
	| "active"
	| "stopping"
	| "stopped"
	| "error"
	| "unavailable";
interface State {
	status: WindowsOutputMeterStatus;
	level: number;
}

/** Explicit short test, no stream, auto-start, polling or auto-renewal. Main owns drain. */
export function useWindowsOutputMeter(enabled: boolean, choice: string | null) {
	const [state, setState] = useState<State>({ status: "idle", level: 0 });
	const [busy, setBusy] = useState(false);
	const actions = useRef<{ start(): Promise<void>; stop(): Promise<void> } | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: A changed main preference invalidates the old preview even while idle.
	useEffect(() => {
		const api = window.electronAPI;
		const start = api?.startWindowsOutputMeter;
		const stop = api?.stopWindowsOutputMeter;
		const subscribe = api?.onWindowsOutputMeter;
		setState({
			status: enabled && (!start || !stop || !subscribe) ? "unavailable" : "idle",
			level: 0,
		});
		setBusy(false);
		if (!enabled || !start || !stop || !subscribe) return;
		let alive = true;
		let pending = false;
		let id: string | null = null;
		let stopping = false;
		let generation = 0;
		let buffered: WindowsOutputMeterMessage[] = [];
		const apply = (message: WindowsOutputMeterMessage) => {
			if (!alive || !id || message.meterId !== id) return;
			if (message.event === "ended") {
				id = null;
				setBusy(false);
				setState({ status: message.result.status === "failed" ? "error" : "stopped", level: 0 });
			} else if (message.event === "ready") {
				setState({ status: stopping ? "stopping" : "active", level: 0 });
			} else if (
				message.event === "level" &&
				!stopping &&
				Number.isInteger(message.peakPermille) &&
				message.peakPermille >= 0 &&
				message.peakPermille <= 1000
			) {
				setState((previous) =>
					previous.status === "active"
						? { ...previous, level: message.peakPermille / 10 }
						: previous,
				);
			}
		};
		const unsubscribe = subscribe((message) => {
			if (!alive || message.event === "starting") return;
			if (pending && !id) {
				// Preserve ready/terminal while coalescing levels even if ACK is delayed.
				if (message.event === "level")
					buffered = buffered.filter(
						(old) => old.event !== "level" || old.meterId !== message.meterId,
					);
				buffered.push(message);
				if (buffered.length > 8) buffered.shift();
			} else apply(message);
		});
		const cancelCurrent = async () => {
			stopping = true;
			setState({ status: "stopping", level: 0 });
			const token = id;
			if (!token) return; // Pending start will cancel its eventual main UUID.
			try {
				const result = await stop(token);
				if (!alive || id !== token) return;
				if (result.success) apply({ event: "ended", meterId: token, result: result.result });
				else {
					id = null;
					setBusy(false);
					setState({ status: "error", level: 0 });
				}
			} catch {
				if (alive && id === token) setState({ status: "error", level: 0 });
			}
		};
		actions.current = {
			start: async () => {
				if (!alive || pending || id) return;
				pending = true;
				setBusy(true);
				stopping = false;
				buffered = [];
				const run = ++generation;
				setState({ status: "starting", level: 0 });
				try {
					const result = await start();
					if (!alive || run !== generation) {
						if (result.success) void stop(result.meterId).catch(() => undefined);
						return;
					}
					pending = false;
					if (!result.success) {
						buffered = [];
						setBusy(false);
						setState({ status: "error", level: 0 });
						return;
					}
					id = result.meterId;
					buffered.forEach(apply);
					buffered = [];
					if (stopping && id) await cancelCurrent();
				} catch {
					if (alive && run === generation) {
						pending = false;
						buffered = [];
						setBusy(false);
						setState({ status: "error", level: 0 });
					}
				}
			},
			stop: async () => {
				if (pending || id) await cancelCurrent();
			},
		};
		return () => {
			alive = false;
			generation++;
			actions.current = null;
			unsubscribe();
			if (id) void stop(id).catch(() => undefined);
		};
	}, [enabled, choice]);
	return {
		...state,
		busy,
		start: useCallback(() => actions.current?.start() ?? Promise.resolve(), []),
		stop: useCallback(() => actions.current?.stop() ?? Promise.resolve(), []),
	};
}
