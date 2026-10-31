import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SttStatusEvent, SttTranscribeResponse } from "../stt/transcriptionContract";
import {
	type PostRecordingTranscriptionOwner,
	PostRecordingTranscriptions,
} from "./postRecordingTranscription";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function fixture() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "openscreen-post-stt-"));
	roots.push(root);
	const sourcePath = path.join(root, "take.mp4");
	await fs.writeFile(sourcePath, "video stays intact");
	const listeners = new Set<(event: SttStatusEvent) => void>();
	const response: SttTranscribeResponse = {
		segments: [
			{ text: " Olá mundo. ", startSec: 0.2, endSec: 1.4 },
			{ text: "Tudo bem?", startSec: 1.5, endSec: 2.4 },
		],
		wordSegments: [],
		detectedLanguage: "pt",
		backend: "whispercpp-cpu",
	};
	const engine = {
		addStatusSink: vi.fn((listener: (event: SttStatusEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}),
		transcribe: vi.fn(async () => response),
		cancel: vi.fn(),
	};
	const destroyed = new Set<() => void>();
	const owner: PostRecordingTranscriptionOwner = {
		isDestroyed: () => false,
		send: vi.fn(),
		once: (_event, listener) => destroyed.add(listener),
		removeListener: (_event, listener) => destroyed.delete(listener),
	};
	const source = { key: `1:${sourcePath}`, path: sourcePath };
	const deps = {
		current: vi.fn(() => source as { key: string; path: string } | null),
		isBusy: vi.fn(() => false),
		isAllowed: vi.fn(() => true),
		isOwnerCurrent: vi.fn(() => true),
		engine: vi.fn(() => engine),
		emit: vi.fn(),
	};
	return {
		root,
		sourcePath,
		response,
		engine,
		owner,
		deps,
		listeners,
		service: new PostRecordingTranscriptions(deps),
	};
}

describe("PostRecordingTranscriptions", () => {
	it("transcribes only the current authorized recording and atomically saves versioned TXT/JSON", async () => {
		const f = await fixture();
		const before = await fs.readFile(f.sourcePath, "utf8");
		const result = await f.service.start(f.owner, f.sourcePath);

		expect(result).toMatchObject({
			success: true,
			text: "Olá mundo.\nTudo bem?",
			txtPath: path.join(f.root, "take.transcript.txt"),
			jsonPath: path.join(f.root, "take.transcript.json"),
		});
		expect(f.engine.transcribe).toHaveBeenCalledWith({ sourcePath: f.sourcePath, language: "pt" });
		expect(await fs.readFile(f.sourcePath, "utf8")).toBe(before);
		expect(await fs.readFile(path.join(f.root, "take.transcript.txt"), "utf8")).toBe(
			"Olá mundo.\nTudo bem?\n",
		);
		const saved = JSON.parse(await fs.readFile(path.join(f.root, "take.transcript.json"), "utf8"));
		expect(saved).toEqual({
			schema: "openscreencopilot.post-recording-transcript",
			version: 1,
			language: "pt",
			backend: "whispercpp-cpu",
			segments: f.response.segments,
		});
		expect(f.deps.emit).toHaveBeenLastCalledWith(f.owner, { phase: "completed" });
	});

	it("refuses stale renderer paths before invoking the engine", async () => {
		const f = await fixture();
		const result = await f.service.start(f.owner, path.join(f.root, "other.mp4"));
		expect(result).toEqual({ success: false, errorCode: "unavailable" });
		expect(f.engine.transcribe).not.toHaveBeenCalled();
	});

	it("cancels the admitted engine run and never changes the video", async () => {
		const f = await fixture();
		f.engine.transcribe.mockImplementation(
			() =>
				new Promise((_resolve, reject) => {
					f.engine.cancel.mockImplementation(() => {
						const error = new Error("cancelled");
						error.name = "AbortError";
						reject(error);
					});
				}),
		);
		const pending = f.service.start(f.owner, f.sourcePath);
		await vi.waitFor(() => expect(f.engine.transcribe).toHaveBeenCalledOnce());
		expect(f.service.cancel(f.owner)).toBe(true);
		expect(await pending).toEqual({ success: false, cancelled: true });
		expect(await fs.readFile(f.sourcePath, "utf8")).toBe("video stays intact");
		expect(f.deps.emit).toHaveBeenLastCalledWith(f.owner, { phase: "cancelled" });
	});

	it("reports a sanitized failure without publishing transcript files", async () => {
		const f = await fixture();
		f.engine.transcribe.mockRejectedValue(new Error(`private path ${f.sourcePath}`));
		expect(await f.service.start(f.owner, f.sourcePath)).toEqual({
			success: false,
			errorCode: "failed",
		});
		expect(f.deps.emit).toHaveBeenLastCalledWith(f.owner, { phase: "failed" });
		await expect(fs.stat(path.join(f.root, "take.transcript.txt"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
