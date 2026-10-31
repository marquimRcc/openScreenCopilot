export interface WindowsRegionSelectionState {
	appRecording: boolean;
	processReferenced: boolean;
	processOwned: boolean;
}

/** Region selection is safe only when no current or not-yet-closed helper can own capture. */
export function canSelectWindowsRegion(state: WindowsRegionSelectionState): boolean {
	return !state.appRecording && !state.processReferenced && !state.processOwned;
}
