export interface OrphanedWindowsCaptureQuit<P> {
	referencedProcess: P | null;
	ownedProcess: P | null;
	terminate(process: P): Promise<boolean>;
}

/** Terminates a helper that no complete logical take can reach, and requires observed exit. */
export async function terminateOrphanedWindowsCaptureForQuit<P>(
	state: OrphanedWindowsCaptureQuit<P>,
): Promise<void> {
	if (state.referencedProcess && state.ownedProcess) {
		if (state.referencedProcess !== state.ownedProcess)
			throw new Error("Windows capture process ownership is inconsistent.");
		// A referenced and owned helper belongs to an active take. Its window-close flow owns stop.
		return;
	}
	const orphan = state.referencedProcess ?? state.ownedProcess;
	if (!orphan) return;
	if (!(await state.terminate(orphan))) {
		throw new Error("Windows capture helper did not exit during app quit.");
	}
}
