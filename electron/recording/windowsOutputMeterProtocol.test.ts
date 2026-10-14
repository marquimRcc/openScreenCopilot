import { describe, expect, it } from "vitest";
import { WindowsOutputMeterProtocol } from "./windowsOutputMeterProtocol";

const ready = {
	schemaVersion: 1,
	event: "ready",
	scope: "render-peak",
	position: "before-endpoint-volume",
	id: "native-id",
	hardwareMeter: false,
};
const level = (sequence = 0, peakPermille = 500) => ({
	schemaVersion: 1,
	event: "level",
	sequence,
	peakPermille,
});
const line = JSON.stringify;
describe("bounded output meter scalar protocol", () => {
	it("checks exact native output and returns only scalar normalized data", () => {
		const parser = new WindowsOutputMeterProtocol("native-id");
		expect(parser.read(line(ready))).toEqual({
			event: "ready",
			id: "native-id",
			hardwareMeter: false,
		});
		expect(parser.read(line(level()))).toEqual({ event: "level", sequence: 0, peakPermille: 500 });
	});
	it("accepts the resolved default once, never an endpoint switch", () => {
		const parser = new WindowsOutputMeterProtocol(null);
		parser.read(line(ready));
		expect(() => parser.read(line({ ...ready, id: "other" }))).toThrow();
		expect(() => new WindowsOutputMeterProtocol("other").read(line(ready))).toThrow();
	});
	it.each([
		"stop",
		"stdin-eof",
		"lease-expired",
	])("requires readiness and terminates on %s", (reason) => {
		const parser = new WindowsOutputMeterProtocol(null);
		const stop = line({ schemaVersion: 1, event: "stopped", reason });
		expect(() => parser.read(stop)).toThrow();
		parser.read(line(ready));
		expect(parser.read(stop)).toEqual({ event: "stopped", reason });
		expect(() => parser.read(line(level()))).toThrow();
	});
	it("allows typed startup failure, not a fake zero or success", () => {
		const parser = new WindowsOutputMeterProtocol(null);
		expect(
			parser.read(line({ schemaVersion: 1, event: "error", code: "output-unavailable" })),
		).toEqual({ event: "error", code: "output-unavailable" });
		expect(() => parser.read(line(ready))).toThrow();
	});
	it("rejects pre-ready, skipped and repeated sequences", () => {
		const parser = new WindowsOutputMeterProtocol(null);
		expect(() => parser.read(line(level()))).toThrow();
		parser.read(line(ready));
		expect(() => parser.read(line(level(1)))).toThrow();
		parser.read(line(level()));
		expect(() => parser.read(line(level()))).toThrow();
	});
	it.each([
		-1,
		1001,
		0.5,
		null,
		"0",
	])("rejects non-integer/out-of-range peak %s", (peakPermille) => {
		const parser = new WindowsOutputMeterProtocol(null);
		parser.read(line(ready));
		expect(() => parser.read(line({ ...level(), peakPermille }))).toThrow();
	});
	it("rejects PCM/additional fields and unrelated protocol", () => {
		for (const value of [
			{ ...ready, pcm: [] },
			{ ...ready, scope: "render-loopback" },
			{ ...ready, position: "after-volume" },
			{ ...ready, id: "default" },
			{ ...ready, id: "bad\n" },
			{ ...ready, schemaVersion: 2 },
			[],
			null,
		]) {
			expect(() => new WindowsOutputMeterProtocol(null).read(line(value))).toThrow();
		}
		const parser = new WindowsOutputMeterProtocol(null);
		parser.read(line(ready));
		expect(() => parser.read(line({ ...level(), pcm: [1, 2] }))).toThrow();
	});
	it("bounds each line and all output even for a malicious helper", () => {
		const parser = new WindowsOutputMeterProtocol(null);
		expect(() => parser.read(" ".repeat(20 * 1024 + 1))).toThrow();
		const total = new WindowsOutputMeterProtocol(null);
		total.read(line(ready));
		for (let i = 0; i < 6; i++) total.read(" ".repeat(19 * 1024) + line(level(i)));
		expect(() => total.read(" ".repeat(19 * 1024) + line(level(6)))).toThrow();
	});
	it("caps a lease at 300 level samples", () => {
		const parser = new WindowsOutputMeterProtocol(null);
		parser.read(line(ready));
		for (let i = 0; i < 300; i++) parser.read(line(level(i)));
		expect(() => parser.read(line(level(300)))).toThrow();
	});
});
