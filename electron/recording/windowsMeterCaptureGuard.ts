interface Pause {
	settled: Promise<void>;
	resume(): void;
}
interface Meter {
	pauseAndDrain(): Pause;
}
interface BrowserOwner {
	isDestroyed(): boolean;
	once(event: "destroyed", listener: () => void): unknown;
	removeListener(event: "destroyed", listener: () => void): unknown;
}
interface CaptureProcess {
	once(event: "close", listener: () => void): unknown;
}

/** Main-owned capture admission, shared by native and Chromium paths.
 * A capture process is bound immediately after spawn, never after exit. */
export class WindowsMeterCaptureGuard {
	private shutdowns = 0;
	private epoch = 0;
	private captures = new Set<() => void>();
	private browser: { owner: BrowserOwner; release(): void } | null = null;
	constructor(private readonly meter: Meter) {}
	isBusy() {
		return this.captures.size > 0;
	}
	canPreview() {
		return !this.shutdowns && !this.isBusy();
	}
	beginNative() {
		const scope = this.reserve();
		let bound = false;
		return {
			settled: scope.settled,
			isCurrent: scope.isCurrent,
			bind: (process: CaptureProcess) => {
				if (bound || !scope.isCurrent()) throw new Error("Invalid Windows capture lease");
				bound = true;
				process.once("close", scope.release);
			},
			finishPreparation: () => {
				if (!bound) scope.release();
			},
		};
	}
	async beginBrowser(
		owner: BrowserOwner,
		isCurrent: () => boolean,
	): Promise<{ release(): void; isCurrent(): boolean }> {
		if (owner.isDestroyed() || !isCurrent()) throw new Error("Invalid Windows capture owner");
		const scope = this.reserve();
		const destroyed = () => release();
		const release = () => {
			try {
				owner.removeListener("destroyed", destroyed);
			} catch {
				/* Already closed. */
			}
			scope.release();
			if (this.browser?.release === release) this.browser = null;
		};
		this.browser = { owner, release };
		try {
			owner.once("destroyed", destroyed);
			await scope.settled;
			if (!scope.isCurrent() || owner.isDestroyed() || !isCurrent())
				throw new Error("Windows capture preparation cancelled");
			return { release, isCurrent: () => scope.isCurrent() && !owner.isDestroyed() && isCurrent() };
		} catch (error) {
			release();
			throw error;
		}
	}
	endBrowser(owner: BrowserOwner) {
		if (this.browser?.owner === owner) this.browser.release();
	}
	pauseForQuit(): Pause {
		this.shutdowns++;
		this.epoch++; // Preparations admitted before quit never revive after a veto.
		const pause = this.meter.pauseAndDrain();
		let released = false;
		return {
			settled: pause.settled,
			resume: () => {
				if (!released) {
					released = true;
					pause.resume();
					this.shutdowns--;
				}
			},
		};
	}
	private reserve() {
		if (!this.canPreview()) throw new Error("Windows capture is active or shutting down");
		const epoch = this.epoch;
		let pause: Pause;
		let released = false;
		const release = () => {
			if (!released) {
				released = true;
				pause.resume();
				this.captures.delete(release);
			}
		};
		this.captures.add(release);
		try {
			pause = this.meter.pauseAndDrain();
		} catch (error) {
			this.captures.delete(release);
			throw error;
		}
		return {
			settled: pause.settled,
			release,
			isCurrent: () => !released && !this.shutdowns && this.epoch === epoch,
		};
	}
}
