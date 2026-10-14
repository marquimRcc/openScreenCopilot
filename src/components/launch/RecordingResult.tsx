import { useCallback, useEffect, useRef, useState } from "react";
import { toFileUrl } from "@/components/video-editor/projectPersistence";
import { useScopedT } from "@/contexts/I18nContext";
import {
	recordingDurationLabel,
	recordingSizeLabel,
	type SavedRecordingInfo,
} from "@/lib/savedRecording";
import styles from "./RecordingResult.module.css";

export function RecordingResult() {
	const t = useScopedT("launch");
	const [info, setInfo] = useState<SavedRecordingInfo | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [previewFailed, setPreviewFailed] = useState(false);
	const [duration, setDuration] = useState(Number.NaN);
	const [busy, setBusy] = useState(false);
	const loadGeneration = useRef(0);
	const actionInFlight = useRef(false);

	const load = useCallback(async () => {
		const generation = ++loadGeneration.current;
		setLoading(true);
		setError(null);
		setInfo(null);
		setDuration(Number.NaN);
		setPreviewFailed(false);
		try {
			const result = await window.electronAPI.getSavedRecordingInfo?.();
			if (generation !== loadGeneration.current) return;
			if (!result?.success || !result.recording) throw new Error("Saved recording unavailable");
			setInfo(result.recording);
		} catch {
			if (generation === loadGeneration.current) setError(t("recordingResult.unavailable"));
		} finally {
			if (generation === loadGeneration.current) setLoading(false);
		}
	}, [t]);
	useEffect(() => {
		void load();
		return () => {
			loadGeneration.current++;
		};
	}, [load]);

	const action = async (kind: "folder" | "new" | "edit") => {
		if (actionInFlight.current) return;
		actionInFlight.current = true;
		setBusy(true);
		setError(null);
		try {
			if (kind === "new") {
				const result = await window.electronAPI.prepareNewCapture?.();
				if (!result?.success) throw new Error("Capture preparation failed");
			} else if (info) {
				// Revalidate before using a cached result; never reveal/edit a newer
				// session if another action changed main's current recording.
				const current = await window.electronAPI.getSavedRecordingInfo?.();
				if (!current?.success || current.recording?.path !== info.path)
					throw new Error("Recording changed");
				if (kind === "folder") {
					const result = await window.electronAPI.revealSavedRecording?.(info.path);
					if (!result?.success) throw new Error("Reveal failed");
				} else {
					await window.electronAPI.switchToEditor();
				}
			}
		} catch {
			setError(t("recordingResult.actionFailed"));
		} finally {
			actionInFlight.current = false;
			setBusy(false);
		}
	};

	return (
		<div className={styles.root}>
			<header className={styles.titlebar}>openScreenCopilot</header>
			<main className={styles.content}>
				<h1>{info ? t("recordingResult.saved") : t("recordingResult.title")}</h1>
				{loading && <p role="status">{t("recordingResult.loading")}</p>}
				{error && (
					<p role="alert" className={styles.error}>
						{error}
					</p>
				)}
				{info && (
					<>
						<div className={styles.preview}>
							<video
								src={toFileUrl(info.path)}
								controls
								preload="metadata"
								aria-label={t("recordingResult.preview")}
								onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
								onError={() => setPreviewFailed(true)}
							>
								<track kind="captions" />
							</video>
						</div>
						{previewFailed && <p role="status">{t("recordingResult.previewFailed")}</p>}
						<p className={styles.previewNote}>{t("recordingResult.originalPreview")}</p>
						<div className={styles.details}>
							<strong>{info.name}</strong>
							<span>
								{recordingDurationLabel(duration)} · {recordingSizeLabel(info.sizeBytes)}
							</span>
							<label>
								{t("recordingResult.location")}
								<input readOnly value={info.path} aria-label={t("recordingResult.location")} />
							</label>
						</div>
					</>
				)}
				<div className={styles.actions}>
					{info && (
						<button type="button" onClick={() => void action("folder")} disabled={busy}>
							{t("recordingResult.openFolder")}
						</button>
					)}
					<button
						type="button"
						className={styles.primary}
						onClick={() => void action("new")}
						disabled={busy || loading}
					>
						{t("recordingResult.newCapture")}
					</button>
					{info && (
						<button type="button" onClick={() => void action("edit")} disabled={busy}>
							{t("recordingResult.edit")}
						</button>
					)}
					{!info && !loading && (
						<button type="button" onClick={() => void load()} disabled={busy}>
							{t("recordingResult.retry")}
						</button>
					)}
				</div>
			</main>
		</div>
	);
}
