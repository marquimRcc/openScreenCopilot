export interface CloseObservedProcess {
	once(event: "close", listener: () => void): unknown;
	removeListener?(event: "close", listener: () => void): unknown;
	off?(event: "close", listener: () => void): unknown;
}

/**
 * Keeps exclusive ownership of a Windows capture helper until Node observes
 * its exact `close` event. Logical reset, failed termination, or a stale event
 * from an older generation cannot authorize another helper.
 */
export class WindowsCaptureProcessOwnership<P extends CloseObservedProcess> {
	private generation = 0;
	private current: { generation: number; process: P } | null = null;

	hasOwner(): boolean {
		return this.current !== null;
	}

	owns(process: P): boolean {
		return this.current?.process === process;
	}

	attach(process: P): number {
		if (this.current) {
			throw new Error("A Windows capture helper is still owned until close is observed.");
		}
		if (!process || typeof process.once !== "function") {
			throw new TypeError("Windows capture helper must support a close listener.");
		}

		this.generation += 1;
		const generation = this.generation;
		this.current = { generation, process };
		const onClose = () => {
			if (this.current?.generation === generation && this.current.process === process) {
				this.current = null;
			}
		};

		try {
			process.once("close", onClose);
		} catch (error) {
			if (this.current?.generation === generation && this.current.process === process) {
				this.current = null;
			}
			try {
				if (typeof process.off === "function") process.off("close", onClose);
				else process.removeListener?.("close", onClose);
			} catch {
				// The original listener-registration failure is the actionable error.
			}
			throw error;
		}

		return generation;
	}
}
