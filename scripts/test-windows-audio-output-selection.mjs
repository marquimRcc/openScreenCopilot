// Read-only MMDevice resolver checks: no audio stream, desktop capture or settings mutation.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
	console.log("Windows only — skipping output selection checks.");
	process.exit(0);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helper =
	process.env.OPENSCREEN_WGC_CAPTURE_EXE ??
	path.join(root, "electron/native/bin", `win32-${process.arch}`, "wgc-capture.exe");
const options = { encoding: "utf8", windowsHide: true, timeout: 3000, maxBuffer: 1024 * 1024 };
const run = (...args) => JSON.parse(execFileSync(helper, args, options));
assert.equal(run("--capabilities").audioOutputSelection, true);
const snapshot = run("--list-audio-outputs");
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.scope, "render-loopback");
assert.ok(Array.isArray(snapshot.devices));
for (const device of snapshot.devices) {
	const selected = run("--check-audio-output", device.id);
	assert.equal(selected.schemaVersion, 1);
	assert.equal(selected.id, device.id);
	assert.equal(selected.name, device.name);
}
const defaultDevice = snapshot.devices.find((device) => device.isDefault);
if (defaultDevice) {
	assert.equal(run("--check-audio-output", "default").id, defaultDevice.id);
	assert.equal(run("--check-audio-output", "").id, defaultDevice.id);
}
for (const id of [`missing-${randomUUID()}`, ...snapshot.devices.map((device) => device.name)]) {
	const result = spawnSync(helper, ["--check-audio-output", id], options);
	assert.equal(result.status, 1);
	assert.equal(result.stdout, "");
	assert.match(result.stderr, /no fallback/);
}
// Invalid explicit config fails before display lookup, capture or file creation.
for (const systemAudioDeviceId of [null, "", 42, false]) {
	const result = spawnSync(
		helper,
		[JSON.stringify({ outputPath: "unused-output.mp4", systemAudioDeviceId })],
		options,
	);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Failed to parse config/);
}
console.log(
	`PASS native output resolver: ${snapshot.devices.length} explicit outputs; default=${Boolean(defaultDevice)}; missing/name/invalid config refused, no streams opened`,
);
