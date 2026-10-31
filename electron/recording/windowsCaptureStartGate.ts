/** One Windows startup owns shared process/cursor state until success or cleanup. */
export class WindowsCaptureStartGate {
	private busy = false;
	isBusy(): boolean {
		return this.busy;
	}
	tryAcquire(): (() => void) | null {
		if (this.busy) return null;
		this.busy = true;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.busy = false;
		};
	}
}
