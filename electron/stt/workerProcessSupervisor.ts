// Isolated deterministic worker process supervisor.
// Manages process ownership, monotonic generation identity, reentrancy-safe stop,
// and observed exit receipts. No live PCM, provider engine, network, or IPC.

export type WorkerSupervisorErrorCode =
	| "already-attached"
	| "uncertain-exit"
	| "no-process"
	| "unknown-timed-out"
	| "invalid-process";

export class WorkerSupervisorError extends Error {
	constructor(
		readonly code: WorkerSupervisorErrorCode,
		message: string,
		readonly generation?: number,
	) {
		super(`worker-supervisor:${code} - ${message}`);
		this.name = "WorkerSupervisorError";
	}
}

export interface ProcessExitReceipt {
	readonly generation: number;
	readonly pid: number;
	readonly exitCode: number | null;
	readonly signal: NodeJS.Signals | null;
	readonly forced: boolean;
}

export interface WorkerProcessLike {
	readonly pid: number;
	kill(signal?: NodeJS.Signals): boolean;
	once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
	removeListener?(
		event: "exit",
		listener: (code: number | null, signal: NodeJS.Signals | null) => void,
	): this;
}

export type ScheduleTimerFn = (ms: number, onTimeout: () => void) => () => void;

export interface WorkerProcessSupervisorOptions {
	readonly termTimeoutMs: number;
	readonly killTimeoutMs: number;
	readonly scheduleTimer?: ScheduleTimerFn;
}

export type SupervisorState = "idle" | "attached" | "stopping" | "uncertain" | "exited";

const defaultScheduleTimer: ScheduleTimerFn = (ms, onTimeout) => {
	const handle = setTimeout(onTimeout, ms);
	return () => clearTimeout(handle);
};

export class WorkerProcessSupervisor<P extends WorkerProcessLike = WorkerProcessLike> {
	private readonly termTimeoutMs: number;
	private readonly killTimeoutMs: number;
	private readonly scheduleTimer: ScheduleTimerFn;

	private _state: SupervisorState = "idle";
	private _generation = 0;
	private _currentProc: P | null = null;
	private _lastReceipt: ProcessExitReceipt | null = null;

	private _stopPromise: Promise<ProcessExitReceipt> | null = null;
	private _stopResolver: ((receipt: ProcessExitReceipt) => void) | null = null;
	private _stopRejecter: ((error: Error) => void) | null = null;

	private _cancelTimer: (() => void) | null = null;
	private _cleanupListener: (() => void) | null = null;
	private _killSent = false;

	constructor(options: WorkerProcessSupervisorOptions) {
		if (!Number.isFinite(options.termTimeoutMs) || options.termTimeoutMs <= 0) {
			throw new WorkerSupervisorError("invalid-process", "termTimeoutMs must be a positive number");
		}
		if (!Number.isFinite(options.killTimeoutMs) || options.killTimeoutMs <= 0) {
			throw new WorkerSupervisorError("invalid-process", "killTimeoutMs must be a positive number");
		}
		this.termTimeoutMs = options.termTimeoutMs;
		this.killTimeoutMs = options.killTimeoutMs;
		this.scheduleTimer = options.scheduleTimer ?? defaultScheduleTimer;
	}

	get state(): SupervisorState {
		return this._state;
	}

	get generation(): number {
		return this._generation;
	}

	get pid(): number | null {
		return this._currentProc?.pid ?? null;
	}

	get lastReceipt(): ProcessExitReceipt | null {
		return this._lastReceipt;
	}

	attach(proc: P): number {
		if (this._state === "attached" || this._state === "stopping") {
			throw new WorkerSupervisorError("already-attached", "process active", this._generation);
		}
		if (this._state === "uncertain") {
			throw new WorkerSupervisorError("uncertain-exit", "exit not observed", this._generation);
		}
		if (
			!proc ||
			typeof proc.pid !== "number" ||
			!Number.isFinite(proc.pid) ||
			!Number.isInteger(proc.pid) ||
			proc.pid <= 0 ||
			typeof proc.kill !== "function" ||
			typeof proc.once !== "function"
		) {
			throw new WorkerSupervisorError("invalid-process", "invalid WorkerProcessLike or pid <= 0");
		}

		this._generation += 1;
		const gen = this._generation;
		this._currentProc = proc;
		this._state = "attached";
		this._killSent = false;
		this._lastReceipt = null;
		this._stopPromise = null;
		this._stopResolver = null;
		this._stopRejecter = null;

		const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
			this.handleExit(gen, proc, code, signal);
		};
		proc.once("exit", onExit);
		this._cleanupListener = () => {
			proc.removeListener?.("exit", onExit);
		};

		return gen;
	}

	stop(): Promise<ProcessExitReceipt> {
		if (this._state === "idle") {
			return Promise.reject(new WorkerSupervisorError("no-process", "not attached"));
		}
		if (this._state === "exited") {
			return this._lastReceipt
				? Promise.resolve(this._lastReceipt)
				: Promise.reject(new WorkerSupervisorError("no-process", "exited without receipt"));
		}
		if (this._state === "stopping") {
			return this._stopPromise!;
		}
		if (this._state === "uncertain") {
			return Promise.reject(
				new WorkerSupervisorError("uncertain-exit", "exit timed out", this._generation),
			);
		}

		this._state = "stopping";
		this._killSent = false;
		const proc = this._currentProc!;
		const gen = this._generation;

		this._stopPromise = new Promise<ProcessExitReceipt>((resolve, reject) => {
			this._stopResolver = resolve;
			this._stopRejecter = reject;
		});

		try {
			proc.kill("SIGTERM");
		} catch {
			// kill returning false or throwing is not proof of exit
		}

		this._cancelTimer = this.scheduleTimer(this.termTimeoutMs, () => {
			if (this._state !== "stopping" || this._generation !== gen) return;
			this._killSent = true;
			try {
				proc.kill("SIGKILL");
			} catch {
				// kill returning false or throwing is not proof of exit
			}

			this._cancelTimer = this.scheduleTimer(this.killTimeoutMs, () => {
				this._cancelTimer = null; // Normalize: timer callback fired
				if (this._state !== "stopping" || this._generation !== gen) return;

				this._state = "uncertain";
				const rejecter = this._stopRejecter;
				this._stopResolver = null;
				this._stopRejecter = null;
				if (rejecter) {
					rejecter(
						new WorkerSupervisorError(
							"unknown-timed-out",
							`process failed to exit within deadlines (TERM ${this.termTimeoutMs}ms + KILL ${this.killTimeoutMs}ms)`,
							gen,
						),
					);
				}
			});
		});

		return this._stopPromise;
	}

	private handleExit(
		gen: number,
		proc: P,
		code: number | null,
		signal: NodeJS.Signals | null,
	): void {
		if (gen !== this._generation) return;

		if (this._cancelTimer) {
			this._cancelTimer();
			this._cancelTimer = null;
		}
		if (this._cleanupListener) {
			this._cleanupListener();
			this._cleanupListener = null;
		}

		const receipt: ProcessExitReceipt = {
			generation: gen,
			pid: proc.pid,
			exitCode: code,
			signal,
			forced: this._killSent,
		};
		this._lastReceipt = receipt;
		this._currentProc = null;
		this._state = "exited";

		const resolver = this._stopResolver;
		this._stopResolver = null;
		this._stopRejecter = null;
		if (resolver) resolver(receipt);
	}
}
