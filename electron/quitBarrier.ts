interface Drain {
	settled: Promise<void>;
	resume(): void;
}
interface Dependencies {
	pauseDerivatives(): Drain;
	shutdown(): Promise<void>;
	quit(): void;
	onError(error: unknown): void;
	scheduleReentry?(continueQuit: () => void): void;
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
				const reenter = () => {
					try {
						drain.resume();
						pending = false;
						passNext = true;
						deps.quit();
					} catch (error) {
						passNext = false;
						pending = false;
						deps.onError(error);
					}
				};
				if (deps.scheduleReentry) deps.scheduleReentry(reenter);
				else reenter();
			} catch (error) {
				passNext = false;
				pending = false;
				drain.resume();
				deps.onError(error);
			}
		})();
	};
}

/** Split reversible preparation from terminal shutdown. Electron does not emit
 * will-quit when an editor vetoes window close, so STT remains usable on cancel. */
export function createAppQuitLifecycle(deps: {
	pauseDerivatives(): Drain;
	flush(): Promise<void>;
	shutdownStt(): Promise<void>;
	quit(): void;
	onError(error: unknown): void;
}) {
	return {
		beforeQuit: createQuitBarrier({
			pauseDerivatives: deps.pauseDerivatives,
			shutdown: deps.flush,
			quit: deps.quit,
			onError: deps.onError,
			// Let Electron unwind the prevented event even when every awaited task
			// completes in microtasks. Keep admission frozen until this callback.
			scheduleReentry: (reenter) => setImmediate(reenter),
		}),
		willQuit: createQuitBarrier({
			pauseDerivatives: deps.pauseDerivatives,
			shutdown: async () => {
				await deps.shutdownStt();
				// Include writes made while the editor was confirming/saving close.
				await deps.flush();
			},
			quit: deps.quit,
			onError: deps.onError,
			scheduleReentry: (reenter) => setImmediate(reenter),
		}),
	};
}
