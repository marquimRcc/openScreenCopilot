import { useCallback, useEffect, useRef, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import {
	type CaptureRectangle,
	type RegionSelectionInfo,
	rectangleFromDrag,
	resolveWindowsCaptureRegion,
} from "@/lib/windowsCaptureRegion";
import styles from "./RegionSelector.module.css";

export function RegionSelector() {
	const t = useScopedT("launch");
	const tc = useScopedT("common");
	const [info, setInfo] = useState<RegionSelectionInfo | null>(null);
	const [rectangle, setRectangle] = useState<CaptureRectangle | null>(null);
	const [dragging, setDragging] = useState(false);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
	const finishing = useRef(false);
	const crop =
		info && rectangle
			? resolveWindowsCaptureRegion(
					{
						id: 0,
						boundsDip: { ...info.boundsDip, x: 0, y: 0 },
						widthPx: info.widthPx,
						heightPx: info.heightPx,
					},
					rectangle,
				)?.regionPx
			: null;

	useEffect(() => {
		let active = true;
		window.electronAPI
			.getRegionSelectionInfo?.()
			.then((value) => {
				if (active) {
					setInfo(value);
					setFailed(!value);
				}
			})
			.catch(() => {
				if (active) setFailed(true);
			});
		return () => {
			active = false;
		};
	}, []);

	const finish = useCallback(
		async (cancel: boolean) => {
			if (finishing.current || (!cancel && (!crop || dragging))) return;
			finishing.current = true;
			setBusy(true);
			try {
				if (!window.electronAPI.finishRegionSelection) throw new Error("Region bridge unavailable");
				await window.electronAPI.finishRegionSelection(cancel ? null : rectangle);
			} catch {
				setFailed(true);
				finishing.current = false;
				setBusy(false);
			}
		},
		[crop, dragging, rectangle],
	);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				void finish(true);
			}
			if (event.key === "Enter" && event.target === document.body) {
				event.preventDefault();
				void finish(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [finish]);

	return (
		<div className={styles.root}>
			<div
				className={styles.surface}
				data-testid="region-drag-surface"
				onPointerDown={(event) => {
					if (!info || busy || event.button !== 0) return;
					start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
					event.currentTarget.setPointerCapture(event.pointerId);
					setRectangle(null);
					setDragging(true);
					setFailed(false);
				}}
				onPointerMove={(event) => {
					if (!start.current || !info || start.current.pointerId !== event.pointerId) return;
					setRectangle(
						rectangleFromDrag(
							start.current,
							{ x: event.clientX, y: event.clientY },
							info.boundsDip,
						),
					);
				}}
				onPointerUp={(event) => {
					if (!start.current || !info || start.current.pointerId !== event.pointerId) return;
					setRectangle(
						rectangleFromDrag(
							start.current,
							{ x: event.clientX, y: event.clientY },
							info.boundsDip,
						),
					);
					start.current = null;
					setDragging(false);
					event.currentTarget.releasePointerCapture(event.pointerId);
				}}
				onPointerCancel={() => {
					start.current = null;
					setDragging(false);
					setRectangle(null);
				}}
			>
				{rectangle && (
					<div
						className={styles.selection}
						data-testid="region-rectangle"
						style={{
							left: rectangle.x,
							top: rectangle.y,
							width: rectangle.width,
							height: rectangle.height,
						}}
					/>
				)}
			</div>
			<div className={styles.toolbar}>
				<div>
					<p>{t("regionSelection.hint")}</p>
					<small>
						{crop ? `${crop.width} × ${crop.height} px · ` : ""}
						{t("regionSelection.keys")}
					</small>
					{failed && <p role="alert">{t("regionSelection.error")}</p>}
				</div>
				<button type="button" onClick={() => void finish(true)} disabled={busy}>
					{tc("actions.cancel")}
				</button>
				<button
					type="button"
					className={styles.confirm}
					onClick={() => void finish(false)}
					disabled={!crop || dragging || busy}
				>
					{t("regionSelection.confirm")}
				</button>
			</div>
		</div>
	);
}
