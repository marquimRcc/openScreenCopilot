import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PostRecordingTranscriptionOwner } from "./postRecordingTranscription";
import { PostRecordingTranscriptions } from "./postRecordingTranscription";

const wavPath = process.env.OPENSCREEN_POST_RECORDING_STT_WAV;
const modelsBaseDir = process.env.OPENSCREEN_POST_RECORDING_STT_MODELS;
const helperPath = process.env.OPENSCREEN_WHISPER_SERVER_EXE;
const ffmpegPath = process.env.OPENSCREEN_FFMPEG_PATH;
const longWavPath = process.env.OPENSCREEN_POST_RECORDING_STT_LONG_WAV;
const enabled = Boolean(wavPath && modelsBaseDir && helperPath && ffmpegPath);

describe.skipIf(!enabled)("post-recording transcription real provider", () => {
	let manager: import("../stt").SttManager | null = null;
	const outputs: string[] = [];
	const sourcePath = path.resolve(wavPath ?? ".");

	beforeAll(async () => {
		const { SttManager } = await import("../stt");
		manager = new SttManager();
		await manager.init({ modelsBaseDir: path.resolve(modelsBaseDir as string) });
	});

	afterAll(async () => {
		await manager?.shutdown();
		await Promise.all(outputs.map((file) => fs.rm(file, { force: true })));
	});

	it("runs the authorized file through the real local helper and publishes TXT/JSON", async () => {
		const owner: PostRecordingTranscriptionOwner = {
			isDestroyed: () => false,
			send: vi.fn(),
			once: vi.fn(),
			removeListener: vi.fn(),
		};
		const source = { key: `fixture:${sourcePath}`, path: sourcePath };
		const statuses: string[] = [];
		const service = new PostRecordingTranscriptions({
			current: () => source,
			isBusy: () => false,
			isAllowed: (file) => file === sourcePath,
			isOwnerCurrent: () => true,
			engine: () => manager as import("../stt").SttManager,
			emit: (_owner, event) => statuses.push(event.phase),
		});

		const result = await service.start(owner, sourcePath);
		expect(result.success).toBe(true);
		if (!result.success) return;
		outputs.push(result.txtPath, result.jsonPath);
		expect(result.document.version).toBe(1);
		expect(result.document.language).toBe("pt");
		expect(result.text).toContain("transcrição local");
		expect(await fs.readFile(result.txtPath, "utf8")).toContain("português brasileiro");
		expect(JSON.parse(await fs.readFile(result.jsonPath, "utf8"))).toMatchObject({
			schema: "openscreencopilot.post-recording-transcript",
			version: 1,
			language: "pt",
		});
		expect(statuses).toContain("transcribing");
		expect(statuses.at(-1)).toBe("completed");
	}, 120_000);

	it("cancels after real extraction without replacing the completed derivatives", async () => {
		const txtPath = outputs.find((file) => file.endsWith(".txt")) as string;
		const jsonPath = outputs.find((file) => file.endsWith(".json")) as string;
		const before = await Promise.all([fs.readFile(txtPath), fs.readFile(jsonPath)]);
		const owner: PostRecordingTranscriptionOwner = {
			isDestroyed: () => false,
			send: vi.fn(),
			once: vi.fn(),
			removeListener: vi.fn(),
		};
		const source = { key: `fixture:${sourcePath}`, path: sourcePath };
		let service!: PostRecordingTranscriptions;
		service = new PostRecordingTranscriptions({
			current: () => source,
			isBusy: () => false,
			isAllowed: (file) => file === sourcePath,
			isOwnerCurrent: () => true,
			engine: () => manager as import("../stt").SttManager,
			emit: (_owner, event) => {
				if (event.phase === "transcribing" && event.completedSec === 0) service.cancel(owner);
			},
		});

		expect(await service.start(owner, sourcePath)).toEqual({ success: false, cancelled: true });
		expect(await fs.readFile(txtPath)).toEqual(before[0]);
		expect(await fs.readFile(jsonPath)).toEqual(before[1]);
	}, 120_000);

	it.skipIf(!longWavPath)(
		"cancels a real Whisper request after inference has started",
		async () => {
			const longSourcePath = path.resolve(longWavPath as string);
			const owner: PostRecordingTranscriptionOwner = {
				isDestroyed: () => false,
				send: vi.fn(),
				once: vi.fn(),
				removeListener: vi.fn(),
			};
			const source = { key: `fixture:${longSourcePath}`, path: longSourcePath };
			let service!: PostRecordingTranscriptions;
			let cancelScheduled = false;
			let cancelAccepted = false;
			let cancelTimer: ReturnType<typeof setTimeout> | null = null;
			service = new PostRecordingTranscriptions({
				current: () => source,
				isBusy: () => false,
				isAllowed: (file) => file === longSourcePath,
				isOwnerCurrent: () => true,
				engine: () => manager as import("../stt").SttManager,
				emit: (_owner, event) => {
					if (event.phase !== "transcribing" || event.completedSec !== 0 || cancelScheduled) {
						return;
					}
					cancelScheduled = true;
					// completedSec=0 is emitted after real extraction and immediately before the
					// first helper request. Waiting here makes Cancel land while Whisper owns the
					// bounded chunk, rather than in the already-covered pre-inference window.
					cancelTimer = setTimeout(() => {
						cancelAccepted = service.cancel(owner);
					}, 2_000);
				},
			});

			try {
				expect(await service.start(owner, longSourcePath)).toEqual({
					success: false,
					cancelled: true,
				});
				expect(cancelScheduled).toBe(true);
				expect(cancelAccepted).toBe(true);
			} finally {
				if (cancelTimer) clearTimeout(cancelTimer);
			}
		},
		120_000,
	);
});
