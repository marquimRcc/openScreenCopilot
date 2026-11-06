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

	it("pauses admission, cancels and drains the active run, then allows retry on resume", async () => {
		const f = await fixture();
		f.engine.transcribe.mockImplementation(
			() =>
				new Promise((_resolve, reject) => {
					f.engine.cancel.mockImplementation(() => {
						const error = new Error("cancelled for quit");
						error.name = "AbortError";
						reject(error);
					});
				}),
		);
		const pending = f.service.start(f.owner, f.sourcePath);
		await vi.waitFor(() => expect(f.engine.transcribe).toHaveBeenCalledOnce());

		const pause = f.service.pauseAndDrain();
		expect(await pending).toEqual({ success: false, cancelled: true });
		await expect(pause.settled).resolves.toBeUndefined();
		expect(await f.service.start(f.owner, f.sourcePath)).toEqual({
			success: false,
			errorCode: "unavailable",
		});

		pause.resume();
		f.engine.transcribe.mockResolvedValue(f.response);
		await expect(f.service.start(f.owner, f.sourcePath)).resolves.toMatchObject({ success: true });
	});

	it("waits for an in-flight publication when quit drainage can no longer cancel", async () => {
		const f = await fixture();
		const jsonPath = path.join(f.root, "take.transcript.json");
		const realRename = fs.rename.bind(fs);
		let enteredPublish!: () => void;
		const publishing = new Promise<void>((resolve) => {
			enteredPublish = resolve;
		});
		let releasePublish!: () => void;
		const release = new Promise<void>((resolve) => {
			releasePublish = resolve;
		});
		const rename = vi.spyOn(fs, "rename").mockImplementation(async (source, target) => {
			if (String(source).endsWith(".tmp") && String(target) === jsonPath) {
				enteredPublish();
				await release;
			}
			return realRename(source, target);
		});

		try {
			const pending = f.service.start(f.owner, f.sourcePath);
			await publishing;
			const pause = f.service.pauseAndDrain();
			let drained = false;
			void pause.settled.then(() => {
				drained = true;
			});
			await Promise.resolve();
			expect(drained).toBe(false);
			expect(f.engine.cancel).not.toHaveBeenCalled();

			releasePublish();
			await expect(pending).resolves.toMatchObject({ success: true });
			await expect(pause.settled).resolves.toBeUndefined();
			expect(drained).toBe(true);
			pause.resume();
		} finally {
			releasePublish?.();
			rename.mockRestore();
		}
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

	it("rolls back both existing derivatives when the second publication fails", async () => {
		const f = await fixture();
		const txtPath = path.join(f.root, "take.transcript.txt");
		const jsonPath = path.join(f.root, "take.transcript.json");
		await fs.writeFile(txtPath, "previous text\n");
		await fs.writeFile(jsonPath, '{"previous":true}\n');
		const realRename = fs.rename.bind(fs);
		const rename = vi.spyOn(fs, "rename").mockImplementation(async (source, target) => {
			if (String(source).endsWith(".tmp") && String(target) === txtPath) {
				throw Object.assign(new Error("injected second publish failure"), { code: "EACCES" });
			}
			return realRename(source, target);
		});

		try {
			expect(await f.service.start(f.owner, f.sourcePath)).toEqual({
				success: false,
				errorCode: "failed",
			});
		} finally {
			rename.mockRestore();
		}

		expect(await fs.readFile(txtPath, "utf8")).toBe("previous text\n");
		expect(await fs.readFile(jsonPath, "utf8")).toBe('{"previous":true}\n');
		expect((await fs.readdir(f.root)).filter((name) => /\.(tmp|bak)$/.test(name))).toEqual([]);
	});

	it("removes a newly published sibling when the second publication fails", async () => {
		const f = await fixture();
		const txtPath = path.join(f.root, "take.transcript.txt");
		const jsonPath = path.join(f.root, "take.transcript.json");
		const realRename = fs.rename.bind(fs);
		const rename = vi.spyOn(fs, "rename").mockImplementation(async (source, target) => {
			if (String(source).endsWith(".tmp") && String(target) === txtPath) {
				throw Object.assign(new Error("injected second publish failure"), { code: "EACCES" });
			}
			return realRename(source, target);
		});

		try {
			expect(await f.service.start(f.owner, f.sourcePath)).toEqual({
				success: false,
				errorCode: "failed",
			});
		} finally {
			rename.mockRestore();
		}

		await expect(fs.stat(txtPath)).rejects.toMatchObject({ code: "ENOENT" });
		await expect(fs.stat(jsonPath)).rejects.toMatchObject({ code: "ENOENT" });
		expect((await fs.readdir(f.root)).filter((name) => /\.(tmp|bak)$/.test(name))).toEqual([]);
	});

	it("removes the first staged file when staging the second derivative fails", async () => {
		const f = await fixture();
		const realWriteFile = fs.writeFile.bind(fs);
		const writeFile = vi.spyOn(fs, "writeFile").mockImplementation(async (file, data, options) => {
			if (String(file).includes(".transcript.txt.") && String(file).endsWith(".tmp")) {
				throw Object.assign(new Error("injected second staging failure"), { code: "ENOSPC" });
			}
			return realWriteFile(file, data, options);
		});

		try {
			expect(await f.service.start(f.owner, f.sourcePath)).toEqual({
				success: false,
				errorCode: "failed",
			});
		} finally {
			writeFile.mockRestore();
		}

		expect((await fs.readdir(f.root)).filter((name) => /\.(tmp|bak)$/.test(name))).toEqual([]);
	});
});
