import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import type { SavedGifPlan } from "../../src/lib/savedRecordingGif";

/** Main-only decoder validation, not an encoder. ffmpeg must be resolved by main
 * from the existing packaged shared binary; neither executable nor file path is
 * accepted as renderer authorization. The native writer must have settled first. */
export async function validateSavedGif(
	file: string,
	plan: SavedGifPlan,
	ffmpeg: string,
	signal: AbortSignal,
	timeoutMs = 60_000,
): Promise<void> {
	signal.throwIfAborted();
	const handle = await fs.open(file, "r");
	try {
		const header = Buffer.alloc(13);
		const { bytesRead } = await handle.read(header, 0, 13, 0);
		if (
			bytesRead !== 13 ||
			!["GIF87a", "GIF89a"].includes(header.toString("ascii", 0, 6)) ||
			header.readUInt16LE(6) !== plan.width ||
			header.readUInt16LE(8) !== plan.height
		)
			throw new Error("Generated GIF header or dimensions are invalid.");
	} finally {
		await handle.close();
	}
	signal.throwIfAborted();
	await new Promise<void>((resolve, reject) => {
		const child = spawn(
			ffmpeg,
			[
				"-v",
				"error",
				"-xerror",
				"-ignore_loop",
				"1",
				"-f",
				"gif",
				"-i",
				file,
				"-map",
				"0:v:0",
				"-an",
				"-fps_mode",
				"passthrough",
				"-progress",
				"pipe:1",
				"-nostats",
				"-f",
				"null",
				"-",
			],
			{ windowsHide: true, signal, stdio: ["ignore", "pipe", "pipe"] },
		);
		let error: Error | undefined;
		let stderr = "",
			partial = "",
			frames = -1,
			durationUs = -1,
			ended = false;
		const timer = setTimeout(() => {
			error = new Error("Generated GIF validation timed out.");
			child.kill();
		}, timeoutMs);
		child.on("error", (cause) => {
			error = cause;
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr = (stderr + chunk.toString()).slice(-8192);
		});
		child.stdout.on("data", (chunk: Buffer) => {
			partial += chunk.toString();
			if (partial.length > 32768) {
				error = new Error("Generated GIF validator output exceeded its limit.");
				child.kill();
				return;
			}
			const lines = partial.split(/\r?\n/);
			partial = lines.pop() ?? "";
			for (const line of lines) {
				const [key, value] = line.split("=", 2);
				if (key === "frame") frames = Number(value);
				if (key === "out_time_us") durationUs = Number(value);
				if (key === "progress") ended = value === "end";
			}
		});
		// Wait for close even after abort/error: no decoder handle may outlive
		// the caller's subsequent owned-staging cleanup on Windows.
		child.once("close", (code) => {
			clearTimeout(timer);
			if (signal.aborted) {
				reject(signal.reason);
				return;
			}
			if (error || code !== 0 || stderr.trim()) {
				reject(error ?? new Error(`Generated GIF decode failed: ${stderr || code}`));
				return;
			}
			if (
				!ended ||
				frames !== plan.totalFrames ||
				!Number.isFinite(durationUs) ||
				Math.abs(durationUs / 1_000_000 - plan.totalFrames / plan.fps) > 0.03
			) {
				reject(new Error("Generated GIF frame count or duration is invalid."));
				return;
			}
			resolve();
		});
	});
}
