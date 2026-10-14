import { useId, useRef, useState } from "react";
import {
	planSavedRecordingGif,
	type SavedGifRequest,
	type SavedGifSourceMetadata,
} from "@/lib/savedRecordingGif";
import styles from "./RecordingGifOptions.module.css";

export interface RecordingGifLabels {
	title: string;
	start: string;
	end: string;
	options: string;
	resolution: string;
	small: string;
	medium: string;
	fps: string;
	loop: string;
	notice: string;
	output: string;
	invalid: string;
	review: string;
	reviewFailed: string;
	cancel: string;
}

/** Isolated options view, NOT mounted by RecordingResult yet.
 * Parent supplies localized labels and a future size-review operation, not an
 * export permission. UI metadata is advisory; main must re-probe the original. */
export function RecordingGifOptions({
	source,
	labels,
	onReview,
	onCancel,
	busy = false,
	locale,
}: {
	source: SavedGifSourceMetadata;
	labels: RecordingGifLabels;
	onReview(request: SavedGifRequest): void | Promise<void>;
	onCancel(): void;
	busy?: boolean;
	locale?: string;
}) {
	const id = useId();
	const maxDuration =
		Number.isFinite(source.durationSec) && source.durationSec > 0 ? source.durationSec : undefined;
	const [start, setStart] = useState("0");
	const [end, setEnd] = useState(String(Math.min(10, maxDuration ?? 0)));
	const [fps, setFps] = useState("15");
	const [height, setHeight] = useState("480");
	const [loop, setLoop] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [failed, setFailed] = useState(false);
	const inFlight = useRef(false);
	const request: SavedGifRequest = {
		mode: "original",
		startSec: start.trim() ? Number(start) : Number.NaN,
		endSec: end.trim() ? Number(end) : Number.NaN,
		fps: Number(fps) as SavedGifRequest["fps"],
		maxHeight: Number(height) as SavedGifRequest["maxHeight"],
		loop,
	};
	let plan: ReturnType<typeof planSavedRecordingGif> | null = null;
	try {
		plan = planSavedRecordingGif(request, source);
	} catch {
		/* Invalid fields never reach review. */
	}
	const pending = busy || submitting;
	return (
		<section className={styles.root} aria-labelledby={`${id}-title`}>
			<h2 id={`${id}-title`}>{labels.title}</h2>
			<p>{labels.notice}</p>
			<form
				onSubmit={async (event) => {
					event.preventDefault();
					if (!plan || busy || inFlight.current) return;
					inFlight.current = true;
					setSubmitting(true);
					setFailed(false);
					try {
						await onReview(request);
					} catch {
						setFailed(true);
					} finally {
						inFlight.current = false;
						setSubmitting(false);
					}
				}}
			>
				<fieldset disabled={pending}>
					<div className={styles.range}>
						<label htmlFor={`${id}-start`}>
							{labels.start}
							<input
								id={`${id}-start`}
								type="number"
								min="0"
								step="any"
								max={maxDuration}
								value={start}
								onChange={(event) => {
									setStart(event.target.value);
									setFailed(false);
								}}
							/>
						</label>
						<label htmlFor={`${id}-end`}>
							{labels.end}
							<input
								id={`${id}-end`}
								type="number"
								min="0"
								step="any"
								max={maxDuration}
								value={end}
								onChange={(event) => {
									setEnd(event.target.value);
									setFailed(false);
								}}
							/>
						</label>
					</div>
					<details>
						<summary>{labels.options}</summary>
						<div className={styles.range}>
							<label htmlFor={`${id}-height`}>
								{labels.resolution}
								<select
									id={`${id}-height`}
									value={height}
									onChange={(event) => {
										setHeight(event.target.value);
										setFailed(false);
									}}
								>
									<option value="480">{labels.small}</option>
									<option value="720">{labels.medium}</option>
								</select>
							</label>
							<label htmlFor={`${id}-fps`}>
								{labels.fps}
								<select
									id={`${id}-fps`}
									value={fps}
									onChange={(event) => {
										setFps(event.target.value);
										setFailed(false);
									}}
								>
									{[15, 20, 25, 30].map((value) => (
										<option key={value} value={value}>
											{value}
										</option>
									))}
								</select>
							</label>
						</div>
						<label className={styles.loop}>
							<input
								type="checkbox"
								checked={loop}
								onChange={(event) => {
									setLoop(event.target.checked);
									setFailed(false);
								}}
							/>
							{labels.loop}
						</label>
					</details>
					{plan ? (
						<output className={styles.output}>
							{labels.output}: {plan.width} × {plan.height} ·{" "}
							{new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(plan.durationSec)}{" "}
							s
						</output>
					) : (
						<p role="alert">{labels.invalid}</p>
					)}
					<button type="submit" disabled={!plan || pending}>
						{labels.review}
					</button>
				</fieldset>
				{failed && <p role="alert">{labels.reviewFailed}</p>}
				<button type="button" onClick={onCancel}>
					{labels.cancel}
				</button>
			</form>
		</section>
	);
}
