import { useEffect, useRef, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type {
	PostRecordingTranscriptionResult,
	PostRecordingTranscriptionStatus,
} from "../../../electron/recording/postRecordingTranscription";
import styles from "./RecordingResult.module.css";

type ViewState = "idle" | PostRecordingTranscriptionStatus["phase"];

export function PostRecordingTranscription({ recordingPath }: { recordingPath: string }) {
	const launchT = useScopedT("launch");
	const settingsT = useScopedT("settings");
	const editorT = useScopedT("editor");
	const commonT = useScopedT("common");
	const [state, setState] = useState<ViewState>("idle");
	const [progress, setProgress] = useState<PostRecordingTranscriptionStatus | null>(null);
	const [result, setResult] = useState<Extract<
		PostRecordingTranscriptionResult,
		{ success: true }
	> | null>(null);
	const run = useRef(0);
	const running = state === "preparing" || state === "transcribing";

	useEffect(() => {
		const api = window.electronAPI.postRecordingTranscription;
		return api?.onStatus((event) => {
			setProgress(event);
			setState(event.phase);
		});
	}, []);

	useEffect(() => {
		return () => {
			run.current++;
			void window.electronAPI.postRecordingTranscription?.cancel();
		};
	}, []);

	const start = async () => {
		const api = window.electronAPI.postRecordingTranscription;
		if (!api || running) return;
		const generation = ++run.current;
		setResult(null);
		setProgress({ phase: "preparing" });
		setState("preparing");
		const response: PostRecordingTranscriptionResult = await api
			.start(recordingPath)
			.catch(() => ({ success: false, errorCode: "failed" }));
		if (generation !== run.current) return;
		if (response.success) {
			setResult(response);
			setState("completed");
		} else {
			setState(response.cancelled ? "cancelled" : "failed");
		}
	};

	const statusLabel = (() => {
		switch (state) {
			case "preparing":
				return editorT("mediaStage.downloadingModel");
			case "transcribing":
				return editorT("mediaStage.transcribing");
			case "completed":
				return editorT("mediaStage.transcriptReady");
			case "cancelled":
				return launchT("recordingResult.transcriptionCancelled");
			case "failed":
				return editorT("mediaStage.transcriptionFailed");
			default:
				return editorT("mediaStage.noTranscript");
		}
	})();

	const percent =
		progress?.phase === "transcribing" && progress.completedSec !== undefined && progress.totalSec
			? Math.min(100, Math.round((progress.completedSec / progress.totalSec) * 100))
			: null;

	return (
		<section className={styles.transcription} aria-labelledby="post-recording-transcription-title">
			<div className={styles.transcriptionHeading}>
				<div>
					<h2 id="post-recording-transcription-title">{settingsT("transcript.title")}</h2>
					<p>{settingsT("transcript.whisperHint")}</p>
				</div>
				<span data-state={state}>{statusLabel}</span>
			</div>
			{percent !== null && (
				<div className={styles.transcriptionProgress}>
					<progress value={percent} max={100} aria-label={editorT("mediaStage.transcribing")} />
					<small>{percent}%</small>
				</div>
			)}
			{result && (
				<>
					<textarea readOnly value={result.text} aria-label={settingsT("transcript.title")} />
					<div className={styles.transcriptionFiles}>
						<label>
							TXT
							<input readOnly value={result.txtPath} />
						</label>
						<label>
							JSON
							<input readOnly value={result.jsonPath} />
						</label>
					</div>
				</>
			)}
			<div className={styles.transcriptionActions}>
				{running ? (
					<button
						type="button"
						onClick={() => void window.electronAPI.postRecordingTranscription.cancel()}
					>
						{commonT("actions.cancel")}
					</button>
				) : (
					<button type="button" onClick={() => void start()}>
						{state === "idle"
							? settingsT("transcript.transcribeNow")
							: launchT("recordingResult.retry")}
					</button>
				)}
			</div>
		</section>
	);
}
