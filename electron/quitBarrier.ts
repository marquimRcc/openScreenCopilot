interface Drain {
	settled: Promise<void>;
	resume(): void;
}
interface Dependencies {
	pauseDerivatives(): Drain;
	shutdown(): Promise<void>;
	quit(): void;
	onError(error: unknown): void;
}

/** Electron before-quit is synchronous. Re-enter exactly once after owned work settles.
 * Resume immediately before re-entry: if a window vetoes close (unsaved edits), the
 * surviving app is usable and the NEXT quit drains any newly admitted work again. */
export function createQuitBarrier(deps: Dependencies) {
	let pending = false;
	let passNext = false;
	return (event: { preventDefault(): void }) => {
		if (passNext) {
			passNext = false;
			return;
		}
		event.preventDefault();
		if (pending) return;
		pending = true;
		let drain: Drain;
		try {
			drain = deps.pauseDerivatives();
		} catch (error) {
			pending = false;
			deps.onError(error);
			return;
		}
		void (async () => {
			try {
				await drain.settled;
				await deps.shutdown();
				drain.resume();
				pending = false;
				passNext = true;
				deps.quit();
			} catch (error) {
				passNext = false;
				pending = false;
				drain.resume();
				deps.onError(error);
			}
		})();
	};
}
