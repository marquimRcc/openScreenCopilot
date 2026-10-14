/** Endpoint activity before output volume, not proof of recorded audio. No PCM. */
export type WindowsOutputMeterEnd =
	| { status: "cancelled" }
	| { status: "stopped"; reason: "stop" | "stdin-eof" | "lease-expired" }
	| { status: "failed"; code: string };
export type WindowsOutputMeterMessage = { meterId: string } & (
	| { event: "starting" }
	| { event: "ready"; id: string; hardwareMeter: boolean }
	| { event: "level"; sequence: number; peakPermille: number }
	| { event: "ended"; result: WindowsOutputMeterEnd }
);
export type WindowsOutputMeterStartResult =
	| { success: true; meterId: string }
	| {
			success: false;
			errorCode:
				| "invalid-owner"
				| "invalid-request"
				| "unsupported-platform"
				| "busy"
				| "disabled"
				| "start-failed";
	  };
export type WindowsOutputMeterStopResult =
	| { success: true; result: WindowsOutputMeterEnd }
	| { success: false; errorCode: "invalid-owner" | "invalid-request" | "not-current" };
