const MAX_EVENT_LINE_CHARS = 64 * 1024;

/** Bounded NDJSON framing for trusted event objects mixed into helper stdout. */
export function createNativeHelperEventLineParser(
	parse: (line: string) => Record<string, unknown> | null,
	onEvent: (event: Record<string, unknown>) => void,
) {
	let pending = "";
	let discardingOversizedLine = false;

	return (text: string) => {
		pending += text;
		const lines = pending.split(/\r?\n/);
		pending = lines.pop() ?? "";
		for (const line of lines) {
			if (discardingOversizedLine) {
				discardingOversizedLine = false;
				continue;
			}
			if (line.length > MAX_EVENT_LINE_CHARS) continue;
			const event = parse(line.trim());
			if (event) onEvent(event);
		}
		if (pending.length > MAX_EVENT_LINE_CHARS) {
			pending = "";
			discardingOversizedLine = true;
		}
	};
}
