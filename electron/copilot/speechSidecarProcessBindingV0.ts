import {
	type ProcessExitReceipt,
	type WorkerProcessLike,
	WorkerProcessSupervisor,
	type WorkerProcessSupervisorOptions,
} from "../stt/workerProcessSupervisor";
import {
	SpeechSidecarHostControllerV0,
	type SpeechSidecarHostControllerV0Options,
	type SpeechSidecarHostV0State,
} from "./speechSidecarHostControllerV0";
import type { SpeechSidecarStreamV0Identity } from "./speechSidecarStreamSessionV0";

export interface SpeechSidecarReadableV0 {
	on(event: "data", listener: (chunk: Uint8Array) => void): this;
	once(event: "end", listener: () => void): this;
	once(event: "error", listener: (error: Error) => void): this;
	removeListener(event: "data", listener: (chunk: Uint8Array) => void): this;
	removeListener(event: "end", listener: () => void): this;
	removeListener(event: "error", listener: (error: Error) => void): this;
}

export interface SpeechSidecarWritableV0 {
	write(line: string): boolean;
}

export interface SpeechSidecarProcessV0 extends WorkerProcessLike {
	readonly stdin: SpeechSidecarWritableV0;
	readonly stdout: SpeechSidecarReadableV0;
	readonly stderr?: SpeechSidecarReadableV0;
}

export interface SpeechSidecarProcessBindingV0Options {
	readonly identity: SpeechSidecarStreamV0Identity;
	readonly handshakeTimeoutMs: number;
	readonly shutdownTimeoutMs: number;
	readonly processSupervisor: WorkerProcessSupervisorOptions;
	readonly hostSchedule?: SpeechSidecarHostControllerV0Options["schedule"];
}

export class SpeechSidecarProcessBindingV0<P extends SpeechSidecarProcessV0> {
	readonly #proc: P;
	readonly #supervisor: WorkerProcessSupervisor<P>;
	readonly #host: SpeechSidecarHostControllerV0;
	#failure: Error | undefined;
	#detached = false;
	readonly #diagnosticBytes = new Uint8Array(4_096);
	#diagnosticLength = 0;

	constructor(proc: P, options: SpeechSidecarProcessBindingV0Options) {
		this.#proc = proc;
		this.#supervisor = new WorkerProcessSupervisor<P>(options.processSupervisor);
		this.#supervisor.attach(proc);
		this.#host = new SpeechSidecarHostControllerV0({
			identity: options.identity,
			handshakeTimeoutMs: options.handshakeTimeoutMs,
			shutdownTimeoutMs: options.shutdownTimeoutMs,
			write: (line) => {
				proc.stdin.write(line);
			},
			abort: (error) => {
				this.#failure ??= error;
				void this.#supervisor.stop().catch((stopError: Error) => {
					this.#failure ??= stopError;
				});
			},
			schedule: options.hostSchedule,
		});
		proc.stdout.on("data", this.#onData);
		proc.stdout.once("end", this.#onEnd);
		proc.stdout.once("error", this.#onError);
		proc.stderr?.on("data", this.#onDiagnostic);
		proc.stderr?.once("error", this.#onDiagnosticError);
		proc.stderr?.once("end", this.#onDiagnosticEnd);
		proc.once("exit", this.#onExit);
	}

	get state(): SpeechSidecarHostV0State {
		return this.#host.state;
	}

	get failure(): Error | undefined {
		return this.#failure;
	}

	get exitReceipt(): ProcessExitReceipt | null {
		return this.#supervisor.lastReceipt;
	}

	get diagnostic(): string {
		return new TextDecoder()
			.decode(this.#diagnosticBytes.subarray(0, this.#diagnosticLength))
			.trimEnd();
	}

	start(): void {
		this.#host.start();
	}

	shutdown(seq?: string): void {
		this.#host.shutdown(seq);
	}

	stop(): Promise<ProcessExitReceipt> {
		this.#host.stop();
		return this.#supervisor.stop();
	}

	readonly #onData = (chunk: Uint8Array): void => {
		try {
			this.#host.receive(chunk);
		} catch (error) {
			this.#failure ??= error instanceof Error ? error : new Error("sidecar stdout failed");
		}
	};

	readonly #onEnd = (): void => {
		try {
			this.#host.finish();
		} catch (error) {
			this.#failure ??= error instanceof Error ? error : new Error("sidecar stdout ended");
		}
	};

	readonly #onError = (error: Error): void => {
		this.#failure ??= error;
		this.#host.stop();
	};

	readonly #onDiagnostic = (chunk: Uint8Array): void => {
		const remaining = this.#diagnosticBytes.byteLength - this.#diagnosticLength;
		const count = Math.min(remaining, chunk.byteLength);
		if (count === 0) return;
		this.#diagnosticBytes.set(chunk.subarray(0, count), this.#diagnosticLength);
		this.#diagnosticLength += count;
	};

	readonly #onDiagnosticError = (): void => undefined;
	readonly #onDiagnosticEnd = (): void => undefined;

	readonly #onExit = (): void => {
		if (this.#host.state !== "completed" && this.#host.state !== "failed") {
			this.#failure ??= new Error("speech-sidecar-process-v0:unexpected-exit");
			this.#host.stop();
		}
		this.#detach();
	};

	#detach(): void {
		if (this.#detached) return;
		this.#detached = true;
		this.#proc.stdout.removeListener("data", this.#onData);
		this.#proc.stdout.removeListener("end", this.#onEnd);
		this.#proc.stdout.removeListener("error", this.#onError);
		this.#proc.stderr?.removeListener("data", this.#onDiagnostic);
		this.#proc.stderr?.removeListener("error", this.#onDiagnosticError);
		this.#proc.stderr?.removeListener("end", this.#onDiagnosticEnd);
		this.#proc.removeListener?.("exit", this.#onExit);
	}
}
