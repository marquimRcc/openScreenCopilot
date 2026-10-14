import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	listWindowsAudioOutputs,
	parseWindowsAudioOutputs,
	resolveWindowsAudioOutputForRecording,
} from "./windowsAudioOutputs";

const mocks = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: mocks.exec }));
const device = { id: "{0.0.0.00000000}.{native-id}", name: "Fone “Áudio” \\ USB", isDefault: true };
const snapshot = (devices: unknown = [device]) =>
	JSON.stringify({ schemaVersion: 1, scope: "render-loopback", devices });

describe("native Windows audio output snapshot", () => {
	beforeEach(() => vi.resetAllMocks());
	it("preserves native IDs and Unicode names, without name matching", () => {
		expect(parseWindowsAudioOutputs(snapshot())).toEqual([device]);
		expect(
			parseWindowsAudioOutputs(
				snapshot([
					{ ...device, isDefault: false },
					{ ...device, id: "other" },
				]),
			),
		).toHaveLength(2);
	});
	it("allows a genuinely empty list or no default, without inventing one", () => {
		expect(parseWindowsAudioOutputs(snapshot([]))).toEqual([]);
		expect(parseWindowsAudioOutputs(snapshot([{ ...device, isDefault: false }]))[0].isDefault).toBe(
			false,
		);
	});
	it.each([
		"",
		"garbage",
		"null",
		"{}",
		'{"schemaVersion":2,"scope":"render-loopback","devices":[]}',
		'{"schemaVersion":1,"scope":"capture","devices":[]}',
		snapshot(null),
		snapshot(Array(257).fill(device)),
		snapshot([device, device]),
		snapshot([device, { ...device, id: "second" }]),
		...[
			{ id: "" },
			{ id: "default" },
			{ id: "bad\0id" },
			{ name: " " },
			{ name: "bad\nname" },
			{ isDefault: 1 },
			{ id: "x".repeat(4097) },
		].map((change) => snapshot([{ ...device, ...change }])),
	])("rejects invalid/incompatible or ambiguous snapshots: %s", (input) => {
		expect(() => parseWindowsAudioOutputs(input)).toThrow();
	});
	it("runs only the fixed enumeration command with bounded time and output", async () => {
		mocks.exec.mockImplementation((_helper, _args, _opts, callback) => callback(null, snapshot()));
		await expect(listWindowsAudioOutputs("trusted helper.exe")).resolves.toEqual([device]);
		expect(mocks.exec).toHaveBeenCalledWith(
			"trusted helper.exe",
			["--list-audio-outputs"],
			{ timeout: 3000, windowsHide: true, maxBuffer: 1024 * 1024 },
			expect.any(Function),
		);
	});
	it("rejects failed/old helpers instead of returning a default output", async () => {
		mocks.exec.mockImplementation((_helper, _args, _opts, callback) =>
			callback(new Error("timeout"), snapshot()),
		);
		await expect(listWindowsAudioOutputs("trusted.exe")).rejects.toThrow("enumeration failed");
		mocks.exec.mockImplementation((_helper, _args, _opts, callback) => callback(null, "invalid"));
		await expect(listWindowsAudioOutputs("trusted.exe")).rejects.toThrow();
	});
});

describe("main-owned explicit output preflight", () => {
	beforeEach(() => vi.resetAllMocks());
	it("keeps legacy default compatible without probing old helpers", async () => {
		await expect(
			resolveWindowsAudioOutputForRecording("helper.exe", null),
		).resolves.toBeUndefined();
		expect(mocks.exec).not.toHaveBeenCalled();
	});
	it.each([
		"",
		" ",
		"default",
		"bad\0id",
		"x".repeat(4097),
	])("rejects invalid saved selection %s before running helper", async (choice) => {
		await expect(resolveWindowsAudioOutputForRecording("helper.exe", choice)).rejects.toThrow(
			"invalid",
		);
		expect(mocks.exec).not.toHaveBeenCalled();
	});
	it.each([
		"{}",
		"bad",
		'{"schemaVersion":2,"audioOutputSelection":true}',
		'{"schemaVersion":1,"audioOutputSelection":false}',
	])("refuses incompatible helper capability %s without enumerating", async (answer) => {
		mocks.exec.mockImplementation((_helper, _args, _opts, callback) => callback(null, answer));
		await expect(resolveWindowsAudioOutputForRecording("helper.exe", device.id)).rejects.toThrow(
			"No fallback",
		);
		expect(mocks.exec).toHaveBeenCalledTimes(1);
	});
	it("reenumerates and resolves only the exact native ID, not friendly name/default", async () => {
		mocks.exec.mockImplementation((_helper, args, _opts, callback) =>
			callback(
				null,
				args[0] === "--capabilities"
					? '{"schemaVersion":1,"audioOutputSelection":true}'
					: snapshot(),
			),
		);
		await expect(resolveWindowsAudioOutputForRecording("helper.exe", device.id)).resolves.toBe(
			device.id,
		);
		await expect(resolveWindowsAudioOutputForRecording("helper.exe", device.name)).rejects.toThrow(
			"unavailable",
		);
		await expect(
			resolveWindowsAudioOutputForRecording("helper.exe", "disconnected"),
		).rejects.toThrow("unavailable");
	});
	it("does not accept a capability on timeout or fall back after failed enumeration", async () => {
		mocks.exec.mockImplementation((_helper, _args, _opts, callback) =>
			callback(new Error("timeout"), '{"schemaVersion":1,"audioOutputSelection":true}'),
		);
		await expect(resolveWindowsAudioOutputForRecording("helper.exe", device.id)).rejects.toThrow(
			"No fallback",
		);
		mocks.exec.mockImplementation((_helper, args, _opts, callback) =>
			args[0] === "--capabilities"
				? callback(null, '{"schemaVersion":1,"audioOutputSelection":true}')
				: callback(new Error("timeout"), snapshot()),
		);
		await expect(resolveWindowsAudioOutputForRecording("helper.exe", device.id)).rejects.toThrow(
			"enumeration failed",
		);
	});
});
