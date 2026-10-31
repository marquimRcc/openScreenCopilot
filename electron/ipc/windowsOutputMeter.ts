import type { BrowserWindow, IpcMain, WebContents, WebFrameMain } from "electron";
import type {
	WindowsOutputMeterMessage,
	WindowsOutputMeterStartResult,
	WindowsOutputMeterStopResult,
} from "../../src/lib/windowsOutputMeter";
import type { WindowsOutputMeter, WindowsOutputMeterLease } from "../recording/windowsOutputMeter";
import { isWindowsAudioOutputFrameOwner, isWindowsAudioOutputOwner } from "./windowsAudioOutputs";

/** The renderer requests intent only. Choice, helper, callbacks and lifecycle stay main-owned. */
export function registerWindowsOutputMeterHandlers(context: {
	ipc: Pick<IpcMain, "handle">;
	window(): BrowserWindow | null;
	isSupported(): boolean;
	canPreview(): boolean;
	prefs(): { systemAudioEnabled: boolean; windowsSystemAudioDeviceId?: string | null };
	meter: Pick<WindowsOutputMeter, "start" | "isBusy">;
}) {
	let active: {
		sender: WebContents;
		frame: WebFrameMain | null;
		lease: WindowsOutputMeterLease | null;
	} | null = null;
	context.ipc.handle(
		"start-windows-output-meter",
		(event, ...args: unknown[]): WindowsOutputMeterStartResult => {
			const sender = event.sender;
			const frame = event.senderFrame;
			const owner = () => isWindowsAudioOutputFrameOwner(context.window(), sender, frame);
			if (!owner()) return { success: false, errorCode: "invalid-owner" };
			if (args.length) return { success: false, errorCode: "invalid-request" };
			if (!context.isSupported()) return { success: false, errorCode: "unsupported-platform" };
			if (active || context.meter.isBusy() || !context.canPreview())
				return { success: false, errorCode: "busy" };
			const prefs = context.prefs();
			if (!prefs.systemAudioEnabled) return { success: false, errorCode: "disabled" };
			const choice = prefs.windowsSystemAudioDeviceId ?? null;
			let navigated = false;
			const job = { sender, frame, lease: null as WindowsOutputMeterLease | null };
			active = job;
			const current = () => {
				const now = context.prefs();
				return (
					active === job &&
					!navigated &&
					owner() &&
					context.canPreview() &&
					now.systemAudioEnabled &&
					(now.windowsSystemAudioDeviceId ?? null) === choice
				);
			};
			const navigation = (details: { isMainFrame: boolean }) => {
				if (details.isMainFrame) {
					navigated = true;
					void job.lease?.cancel();
				}
			};
			const send = (message: WindowsOutputMeterMessage) => {
				if (!navigated && owner()) event.sender.send("windows-output-meter-event", message);
			};
			const cleanup = () => {
				event.sender.removeListener("did-start-navigation", navigation);
				if (active === job) active = null;
			};
			try {
				event.sender.on("did-start-navigation", navigation);
				// Do not forward renderer objects: this literal is an immutable-choice snapshot.
				const lease = context.meter.start({
					owner: event.sender,
					choice,
					isCurrent: current,
					onEvent: (value) => {
						if (current() && job.lease) send({ ...value, meterId: job.lease.id });
					},
				});
				job.lease = lease;
				void lease.done.then((result) => {
					try {
						send({ meterId: lease.id, event: "ended", result });
					} catch {
						/* Closed renderer; controller already drained. */
					} finally {
						cleanup();
					}
				});
				if (!current()) {
					void lease.cancel();
					return { success: false, errorCode: "invalid-owner" };
				}
				send({ event: "starting", meterId: lease.id });
				return { success: true, meterId: lease.id };
			} catch {
				if (job.lease)
					void job.lease.cancel(); // Admission retained until close.
				else cleanup();
				return { success: false, errorCode: "start-failed" };
			}
		},
	);
	context.ipc.handle(
		"stop-windows-output-meter",
		async (event, meterId: unknown, ...extra: unknown[]): Promise<WindowsOutputMeterStopResult> => {
			if (!isWindowsAudioOutputOwner(context.window(), event))
				return { success: false, errorCode: "invalid-owner" };
			if (extra.length || typeof meterId !== "string" || meterId.length > 64)
				return { success: false, errorCode: "invalid-request" };
			const lease = active?.lease;
			if (
				!lease ||
				active?.sender !== event.sender ||
				active.frame !== event.senderFrame ||
				lease.id !== meterId
			)
				return { success: false, errorCode: "not-current" };
			const result = await lease.cancel();
			return { success: true, result };
		},
	);
}
