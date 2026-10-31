import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getPlatform } from "@/utils/platformUtils";
import type { WindowsAudioOutput } from "../../../electron/recording/windowsAudioOutputs";
import styles from "./WindowsAudioOutputPicker.module.css";
import { type WindowsOutputMeterLabels, WindowsOutputMeterTest } from "./WindowsOutputMeterTest";

export interface WindowsAudioOutputLabels {
	device: string;
	default: string;
	unavailable: string;
	refresh: string;
	loading: string;
	loadFailed: string;
	saveFailed: string;
	scope: string;
	meter?: WindowsOutputMeterLabels;
}

/** Device settings only: enumeration never opens an audio stream or enables audio. */
export function WindowsAudioOutputPicker({
	locked = false,
	labels,
}: {
	locked?: boolean;
	labels?: WindowsAudioOutputLabels;
}) {
	if (!labels || getPlatform() !== "win32" || !window.electronAPI?.listWindowsAudioOutputs)
		return null;
	return <OutputPicker locked={locked} labels={labels} />;
}

function OutputPicker({ locked, labels }: { locked: boolean; labels: WindowsAudioOutputLabels }) {
	const id = useId();
	const [devices, setDevices] = useState<WindowsAudioOutput[]>([]);
	const [choice, setChoice] = useState<string | null>(null);
	const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
	const [ready, setReady] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const [saveError, setSaveError] = useState(false);
	const alive = useRef(false);
	const request = useRef(0);
	const revision = useRef(0);
	const writePending = useRef(false);
	const load = useCallback(async () => {
		const token = ++request.current;
		const priorRevision = revision.current;
		setLoading(true);
		setLoadError(false);
		setSaveError(false);
		try {
			const api = window.electronAPI;
			if (!api.listWindowsAudioOutputs) throw new Error("Unavailable bridge");
			const [outputs, prefs] = await Promise.allSettled([
				api.listWindowsAudioOutputs(),
				api.getRecordingPrefs(),
			]);
			if (!alive.current || token !== request.current) return;
			if (prefs.status === "fulfilled" && prefs.value) {
				if (revision.current === priorRevision) {
					setChoice(prefs.value.windowsSystemAudioDeviceId ?? null);
					setSystemAudioEnabled(prefs.value.systemAudioEnabled);
				}
				setReady(true);
			}
			if (
				outputs.status !== "fulfilled" ||
				!outputs.value.success ||
				prefs.status !== "fulfilled" ||
				!prefs.value
			)
				throw new Error("Unavailable output list");
			setDevices(outputs.value.devices);
		} catch {
			if (alive.current && token === request.current) {
				setLoadError(true);
				setDevices([]);
			}
		} finally {
			if (alive.current && token === request.current) setLoading(false);
		}
	}, []);
	useEffect(() => {
		alive.current = true;
		const unsubscribe = window.electronAPI.onRecordingPrefsChanged?.((prefs) => {
			revision.current++;
			setChoice(prefs.windowsSystemAudioDeviceId ?? null);
			setSystemAudioEnabled(prefs.systemAudioEnabled);
			setReady(true);
		});
		void load();
		return () => {
			alive.current = false;
			request.current++;
			unsubscribe?.();
		};
	}, [load]);
	async function select(next: string | null) {
		if (locked || loading || writePending.current || !ready) return;
		if (next !== null && !devices.some((device) => device.id === next)) return;
		writePending.current = true;
		setSaving(true);
		setSaveError(false);
		const priorRevision = revision.current;
		try {
			const prefs = await window.electronAPI.setRecordingPrefs({
				windowsSystemAudioDeviceId: next,
			});
			if (alive.current && revision.current === priorRevision) {
				revision.current++;
				setChoice(prefs.windowsSystemAudioDeviceId ?? null);
				setSystemAudioEnabled(prefs.systemAudioEnabled);
			}
		} catch {
			if (alive.current) setSaveError(true);
		} finally {
			writePending.current = false;
			if (alive.current) setSaving(false);
		}
	}
	const missing = choice !== null && !devices.some((device) => device.id === choice);
	const defaultName = devices.find((device) => device.isDefault)?.name;
	return (
		<div className={styles.picker} data-hud-interactive="true">
			<label htmlFor={id}>{labels.device}</label>
			<div className={styles.controls}>
				<select
					id={id}
					value={choice ?? ""}
					disabled={locked || loading || saving || !ready}
					aria-describedby={`${id}-hint`}
					onChange={(event) => void select(event.target.value || null)}
				>
					<option value="">
						{labels.default}
						{defaultName ? ` — ${defaultName}` : ""}
					</option>
					{missing && (
						<option value={choice ?? ""} disabled>
							{labels.unavailable}
						</option>
					)}
					{devices.map((device) => (
						<option key={device.id} value={device.id}>
							{device.name}
						</option>
					))}
				</select>
				<button type="button" disabled={locked || loading || saving} onClick={() => void load()}>
					{labels.refresh}
				</button>
			</div>
			{loading && <span role="status">{labels.loading}</span>}
			{(loadError || saveError) && (
				<span role="alert">{saveError ? labels.saveFailed : labels.loadFailed}</span>
			)}
			{!loading && !loadError && !saveError && (missing || devices.length === 0) && (
				<span role="alert">{labels.unavailable}</span>
			)}
			<span id={`${id}-hint`} className={styles.hint}>
				{labels.scope}
			</span>
			<WindowsOutputMeterTest
				enabled={
					ready && systemAudioEnabled && !locked && !loading && !saving && !missing && !loadError
				}
				choice={choice}
				labels={labels.meter}
			/>
		</div>
	);
}
