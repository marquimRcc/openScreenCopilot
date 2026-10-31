import { useWindowsOutputMeter } from "../../hooks/useWindowsOutputMeter";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import styles from "./WindowsAudioOutputPicker.module.css";

export interface WindowsOutputMeterLabels {
	test: string;
	stop: string;
	starting: string;
	active: string;
	stopping: string;
	stopped: string;
	error: string;
	hint: string;
	level: string;
}
export function WindowsOutputMeterTest({
	enabled,
	choice,
	labels,
}: {
	enabled: boolean;
	choice: string | null;
	labels?: WindowsOutputMeterLabels;
}) {
	const api = window.electronAPI;
	if (
		!labels ||
		!api?.startWindowsOutputMeter ||
		!api.stopWindowsOutputMeter ||
		!api.onWindowsOutputMeter
	)
		return null;
	return <Meter enabled={enabled} choice={choice} labels={labels} />;
}
function Meter({
	enabled,
	choice,
	labels,
}: {
	enabled: boolean;
	choice: string | null;
	labels: WindowsOutputMeterLabels;
}) {
	const meter = useWindowsOutputMeter(enabled, choice);
	const status = meter.status;
	const statusLabel =
		status === "starting"
			? labels.starting
			: status === "active"
				? labels.active
				: status === "stopping"
					? labels.stopping
					: status === "stopped"
						? labels.stopped
						: status === "error" || status === "unavailable"
							? labels.error
							: "";
	return (
		<div className={styles.meterTest}>
			<button
				type="button"
				disabled={!enabled || status === "stopping"}
				onClick={() => void (meter.busy ? meter.stop() : meter.start())}
			>
				{meter.busy ? labels.stop : labels.test}
			</button>
			<div
				role="meter"
				aria-label={labels.level}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(meter.level)}
			>
				<AudioLevelMeter level={meter.level} />
			</div>
			{statusLabel && <span role={status === "error" ? "alert" : "status"}>{statusLabel}</span>}
			<span className={styles.hint}>{labels.hint}</span>
		</div>
	);
}
