export interface WindowsCaptureBusyState {
	processReferenced: boolean;
	processOwned: boolean;
}

/** A helper remains busy until its exact close, even after logical take state is reset. */
export function isWindowsCaptureBusy(state: WindowsCaptureBusyState): boolean {
	return state.processReferenced || state.processOwned;
}
