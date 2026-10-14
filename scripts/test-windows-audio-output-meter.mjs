// Read-only endpoint peak API: no PCM capture, keepalive, audio playback or OS settings changes.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
	console.log("Windows only — skipping output meter checks.");
	process.exit(0);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helper =
	process.env.OPENSCREEN_WGC_CAPTURE_EXE ??
	path.join(root, "electron/native/bin", `win32-${process.arch}`, "wgc-capture.exe");
const options = { encoding: "utf8", windowsHide: true, timeout: 3000, maxBuffer: 1024 * 1024 };
const run = (...args) => JSON.parse(execFileSync(helper, args, options));
assert.equal(run("--capabilities").audioOutputMeter, true);
const outputs = run("--list-audio-outputs").devices;
assert.ok(outputs.length > 0, "No active output to test");
async function measure(id, mode, expectedId, terminalCode) {
	return new Promise((resolve, reject) => {
		const child = spawn(helper, ["--meter-audio-output", id], {
			windowsHide: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		const events = [];
		let buffer = "";
		let failure;
		let readyAt = 0;
		let stopAt = 0;
		const deadline = setTimeout(
			() => {
				failure = new Error("Meter timeout");
				child.kill();
			},
			mode === "expire" ? 33000 : 4000,
		);
		child.stdin.on("error", () => {
			// Early helper rejection may close stdin; stdout and close validate its result.
		});
		child.on("error", (error) => {
			failure = error;
		});
		child.stdout.on("data", (chunk) => {
			buffer += chunk.toString("utf8");
			try {
				assert.ok(buffer.length < 65536);
				while (buffer.includes("\n")) {
					const newline = buffer.indexOf("\n");
					const value = JSON.parse(buffer.slice(0, newline));
					buffer = buffer.slice(newline + 1);
					events.push(value);
					assert.equal(value.schemaVersion, 1);
					assert.ok(events.length <= 302);
					if (value.event === "ready") {
						readyAt = Date.now();
						assert.equal(value.id, expectedId);
						assert.equal(value.scope, "render-peak");
						assert.equal(value.position, "before-endpoint-volume");
						assert.equal(typeof value.hardwareMeter, "boolean");
						if (mode !== "expire")
							setTimeout(() => {
								stopAt = Date.now();
								if (mode === "eof") child.stdin.end();
								else child.stdin.write(mode === "invalid" ? "unexpected\n" : "stop\n");
							}, 250);
					}
					if (value.event === "level") {
						assert.ok(readyAt);
						assert.equal(value.sequence, events.filter((x) => x.event === "level").length - 1);
						assert.ok(
							Number.isInteger(value.peakPermille) &&
								value.peakPermille >= 0 &&
								value.peakPermille <= 1000,
						);
						assert.deepEqual(Object.keys(value).sort(), [
							"event",
							"peakPermille",
							"schemaVersion",
							"sequence",
						]);
					}
				}
			} catch (error) {
				failure = error;
				child.kill();
			}
		});
		child.on("close", (code, signal) => {
			clearTimeout(deadline);
			try {
				if (failure) throw failure;
				assert.equal(signal, null);
				assert.equal(buffer.trim(), "");
				const terminal = events.at(-1);
				if (terminalCode) {
					assert.equal(code, 1);
					assert.equal(terminal.event, "error");
					assert.equal(terminal.code, terminalCode);
				} else {
					assert.equal(code, 0);
					assert.equal(terminal.event, "stopped");
					assert.equal(
						terminal.reason,
						mode === "eof" ? "stdin-eof" : mode === "expire" ? "lease-expired" : "stop",
					);
				}
				if (stopAt)
					assert.ok(Date.now() - stopAt < 2000, "Stop must close before capture can start");
				resolve({
					mode,
					samples: events.filter((x) => x.event === "level").length,
					stopMs: stopAt ? Date.now() - stopAt : null,
				});
			} catch (error) {
				reject(error);
			}
		});
	});
}
const results = [];
for (const output of outputs) results.push(await measure(output.id, "stop", output.id));
const defaultOutput = outputs.find((x) => x.isDefault);
if (defaultOutput) results.push(await measure("", "eof", defaultOutput.id));
results.push(await measure(outputs[0].id, "invalid", outputs[0].id, "invalid-command"));
results.push(await measure("missing-meter-device", "stop", undefined, "output-unavailable"));
results.push(await measure(outputs[0].id, "expire", outputs[0].id));
const noPipe = spawnSync(helper, ["--meter-audio-output", outputs[0].id], {
	...options,
	stdio: ["ignore", "pipe", "pipe"],
});
assert.equal(noPipe.status, 1);
assert.equal(JSON.parse(noPipe.stdout).code, "invalid-control-pipe");
console.log("PASS endpoint meter; no streams/PCM/playback", JSON.stringify(results));
