/** Main-only scalar protocol. This is endpoint activity, NOT proof of captured PCM. */
export type WindowsOutputMeterEvent =
	| { event: "ready"; id: string; hardwareMeter: boolean }
	| { event: "level"; sequence: number; peakPermille: number }
	| { event: "stopped"; reason: "stop" | "stdin-eof" | "lease-expired" }
	| {
			event: "error";
			code:
				| "invalid-control-pipe"
				| "output-unavailable"
				| "meter-unavailable"
				| "control-failed"
				| "invalid-command";
	  };

const invalid = () => new Error("Invalid Windows output meter protocol");
function fields(value: Record<string, unknown>, keys: string[]): boolean {
	return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

/** One instance per helper lease; transport must ALSO bound unterminated chunks. */
export class WindowsOutputMeterProtocol {
	private ready = false;
	private terminal = false;
	private next = 0;
	private bytes = 0;
	constructor(private readonly expectedId: string | null) {}
	read(line: string): WindowsOutputMeterEvent {
		const bytes = Buffer.byteLength(line, "utf8");
		this.bytes += bytes;
		if (this.terminal || bytes > 20 * 1024 || this.bytes > 128 * 1024) throw invalid();
		const data: unknown = JSON.parse(line);
		if (!data || typeof data !== "object" || Array.isArray(data)) throw invalid();
		const value = data as Record<string, unknown>;
		if (value.schemaVersion !== 1) throw invalid();
		if (value.event === "ready") {
			if (
				this.ready ||
				!fields(value, ["schemaVersion", "event", "scope", "position", "id", "hardwareMeter"]) ||
				value.scope !== "render-peak" ||
				value.position !== "before-endpoint-volume" ||
				typeof value.id !== "string" ||
				!value.id.trim() ||
				value.id === "default" ||
				value.id.length > 4096 ||
				Array.from(value.id).some(
					(char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
				) ||
				typeof value.hardwareMeter !== "boolean" ||
				(this.expectedId !== null && value.id !== this.expectedId)
			)
				throw invalid();
			this.ready = true;
			return { event: "ready", id: value.id, hardwareMeter: value.hardwareMeter };
		}
		if (value.event === "level") {
			if (
				!this.ready ||
				!fields(value, ["schemaVersion", "event", "sequence", "peakPermille"]) ||
				value.sequence !== this.next ||
				this.next >= 300 ||
				typeof value.peakPermille !== "number" ||
				!Number.isInteger(value.peakPermille) ||
				value.peakPermille < 0 ||
				value.peakPermille > 1000
			)
				throw invalid();
			return { event: "level", sequence: this.next++, peakPermille: value.peakPermille };
		}
		if (
			value.event === "stopped" &&
			this.ready &&
			fields(value, ["schemaVersion", "event", "reason"]) &&
			(value.reason === "stop" || value.reason === "stdin-eof" || value.reason === "lease-expired")
		) {
			this.terminal = true;
			return { event: "stopped", reason: value.reason };
		}
		if (
			value.event === "error" &&
			fields(value, ["schemaVersion", "event", "code"]) &&
			(value.code === "invalid-control-pipe" ||
				value.code === "output-unavailable" ||
				value.code === "meter-unavailable" ||
				value.code === "control-failed" ||
				value.code === "invalid-command")
		) {
			this.terminal = true;
			return { event: "error", code: value.code };
		}
		throw invalid();
	}
}
