export interface OwnerOnlyWindowsCaptureQuit<P> {
	referencedProcess: P | null;
	ownedProcess: P | null;
	terminate(process: P): Promise<boolean>;
}

/** Terminates only a helper that no logical take can reach, and requires observed exit. */
export async function terminateOwnerOnlyWindowsCaptureForQuit<P>(
	state: OwnerOnlyWindowsCaptureQuit<P>,
): Promise<void> {
	if (!state.ownedProcess) return;
	if (state.referencedProcess) {
		if (state.referencedProcess !== state.ownedProcess) {
			throw new Error("Windows capture process ownership is inconsistent.");
		}
		return;
	}
	if (!(await state.terminate(state.ownedProcess))) {
		throw new Error("Windows capture helper did not exit during app quit.");
	}
}
