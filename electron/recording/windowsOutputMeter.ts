import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import {
	type WindowsOutputMeterEvent,
	WindowsOutputMeterProtocol,
} from "./windowsOutputMeterProtocol";

type VisibleEvent = Extract<WindowsOutputMeterEvent, { event: "ready" | "level" }>;
export type WindowsOutputMeterEnd =
	| { status: "cancelled" }
	| { status: "stopped"; reason: "stop" | "stdin-eof" | "lease-expired" }
	| { status: "failed"; code: string };
interface Owner {
	isDestroyed(): boolean;
	once(event: "destroyed", listener: () => void): unknown;
	removeListener(event: "destroyed", listener: () => void): unknown;
}
interface Request {
	owner: Owner;
	choice: string | null;
	isCurrent(): boolean;
	onEvent(event: VisibleEvent): void;
}
export interface WindowsOutputMeterLease {
	id: string;
	ready: Promise<Extract<VisibleEvent, { event: "ready" }> | null>;
	done: Promise<WindowsOutputMeterEnd>;
	cancel(): Promise<WindowsOutputMeterEnd>;
}
class MeterFailure extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}

/** Isolated main-process controller; no IPC or recording integration yet.
 * lookup must ONLY resolve the trusted helper path (no owned subprocesses).
 * Every process started here is retained until close, even if kill fails. */
export class WindowsOutputMeter {
	private pauses = 0;
	private job: WindowsOutputMeterLease | null = null;
	constructor(
		private readonly lookup: () => Promise<string | null>,
		private readonly launch = (helper: string, args: string[]): ChildProcessWithoutNullStreams =>
			spawn(helper, args, {
				windowsHide: true,
				stdio: ["pipe", "pipe", "pipe"],
			}),
	) {}
	isBusy() {
		return this.job !== null;
	}
	start(request: Request): WindowsOutputMeterLease {
		if (this.job || this.pauses) throw new MeterFailure("busy");
		if (request.owner.isDestroyed() || !request.isCurrent())
			throw new MeterFailure("invalid-owner");
		if (
			request.choice !== null &&
			(!request.choice.trim() ||
				request.choice === "default" ||
				request.choice.length > 4096 ||
				Array.from(request.choice).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
		)
			throw new MeterFailure("invalid-output");
		const abort = new AbortController();
		let resolveReady!: (value: Extract<VisibleEvent, { event: "ready" }> | null) => void;
		let resolveDone!: (value: WindowsOutputMeterEnd) => void;
		const ready = new Promise<Extract<VisibleEvent, { event: "ready" }> | null>((resolve) => {
			resolveReady = resolve;
		});
		const done = new Promise<WindowsOutputMeterEnd>((resolve) => {
			resolveDone = resolve;
		});
		const lease: WindowsOutputMeterLease = {
			id: randomUUID(),
			ready,
			done,
			cancel: () => {
				abort.abort();
				return done;
			},
		};
		this.job = lease; // Reserve synchronously before lookup and destroyed-listener attachment.
		const destroyed = () => abort.abort();
		void (async () => {
			let outcome: WindowsOutputMeterEnd;
			try {
				request.owner.once("destroyed", destroyed);
				const check = () => {
					if (request.owner.isDestroyed() || !request.isCurrent()) abort.abort();
					if (abort.signal.aborted) throw new MeterFailure("cancelled");
				};
				check();
				const helper = await this.lookupPath(abort.signal);
				check();
				if (!helper) throw new MeterFailure("missing-helper");
				await this.process(helper, "capability", request, abort.signal, resolveReady);
				check();
				outcome = await this.process(helper, "meter", request, abort.signal, resolveReady);
			} catch (error) {
				outcome = abort.signal.aborted
					? { status: "cancelled" }
					: {
							status: "failed",
							code: error instanceof MeterFailure ? error.code : "meter-failed",
						};
			} finally {
				resolveReady(null);
				try {
					request.owner.removeListener("destroyed", destroyed);
				} catch {
					/* Owner already gone. */
				}
				if (this.job === lease) this.job = null;
			}
			resolveDone(outcome);
		})();
		return lease;
	}
	pauseAndDrain(): { settled: Promise<void>; resume(): void } {
		this.pauses++;
		let released = false;
		return {
			settled: this.job ? this.job.cancel().then(() => undefined) : Promise.resolve(),
			resume: () => {
				if (!released) {
					released = true;
					this.pauses--;
				}
			},
		};
	}
	private lookupPath(signal: AbortSignal): Promise<string | null> {
		return new Promise((resolve, reject) => {
			const cancel = () => {
				cleanup();
				reject(new MeterFailure("cancelled"));
			};
			const timer = setTimeout(() => {
				cleanup();
				reject(new MeterFailure("startup-timeout"));
			}, 3000);
			const cleanup = () => {
				clearTimeout(timer);
				signal.removeEventListener("abort", cancel);
			};
			signal.addEventListener("abort", cancel, { once: true });
			if (signal.aborted) {
				cancel();
				return;
			}
			Promise.resolve()
				.then(this.lookup)
				.then(
					(value) => {
						cleanup();
						resolve(value);
					},
					(error) => {
						cleanup();
						reject(error);
					},
				);
		});
	}
	private process(
		helper: string,
		mode: "capability" | "meter",
		request: Request,
		signal: AbortSignal,
		resolveReady: (value: Extract<VisibleEvent, { event: "ready" }>) => void,
	): Promise<WindowsOutputMeterEnd> {
		return new Promise((resolve, reject) => {
			const proc = this.launch(
				helper,
				mode === "capability" ? ["--capabilities"] : ["--meter-audio-output", request.choice ?? ""],
			);
			const parser = new WindowsOutputMeterProtocol(request.choice);
			const decoder = new TextDecoder("utf-8", { fatal: true });
			let pending = "",
				total = 0,
				stderr = 0;
			let failure: string | null = null;
			let terminal: Extract<WindowsOutputMeterEvent, { event: "stopped" | "error" }> | null = null;
			let latest: Extract<VisibleEvent, { event: "level" }> | null = null;
			let flush: ReturnType<typeof setTimeout> | undefined;
			let grace: ReturnType<typeof setTimeout> | undefined;
			let closed = false;
			const kill = () => {
				if (!closed) {
					try {
						proc.kill();
					} catch {
						/* Keep waiting for close. */
					}
				}
			};
			const fail = (code: string) => {
				if (failure) return;
				failure = code;
				kill();
			};
			const deliver = (event: VisibleEvent) => {
				if (signal.aborted || closed || failure) return;
				try {
					if (request.owner.isDestroyed() || !request.isCurrent()) {
						fail("invalid-owner");
						return;
					}
					request.onEvent(event);
				} catch {
					fail("delivery-failed");
				}
			};
			const startup = setTimeout(() => fail("startup-timeout"), 3000);
			const lifetime = setTimeout(() => fail("lease-timeout"), mode === "meter" ? 32000 : 3000);
			const cancel = () => {
				if (closed) return;
				if (mode === "capability") {
					kill();
					return;
				}
				try {
					proc.stdin.write("stop\n", (error) => {
						if (error) kill();
					});
				} catch {
					kill();
				}
				grace ??= setTimeout(kill, 750);
			};
			proc.stdin.on("error", () => {
				if (signal.aborted) kill();
				else fail("control-failed");
			});
			proc.on("error", () => fail("process-failed"));
			proc.stderr.on("data", (chunk: Buffer) => {
				stderr += chunk.length;
				if (stderr > 4096) fail("output-limit");
			});
			proc.stdout.on("data", (chunk: Buffer) => {
				if (closed || failure) return;
				try {
					total += chunk.length;
					if (total > (mode === "meter" ? 128 * 1024 : 4096))
						throw new MeterFailure("output-limit");
					pending += decoder.decode(chunk, { stream: true });
					if (mode === "capability") return;
					while (pending.includes("\n")) {
						const index = pending.indexOf("\n");
						const event = parser.read(pending.slice(0, index));
						pending = pending.slice(index + 1);
						if (event.event === "ready") {
							clearTimeout(startup);
							deliver(event);
							if (!failure && !signal.aborted) resolveReady(event);
						} else if (event.event === "level") {
							latest = event;
							flush ??= setTimeout(() => {
								flush = undefined;
								if (latest) deliver(latest);
								latest = null;
							}, 100);
						} else {
							terminal = event;
							clearTimeout(flush);
							latest = null;
							if (event.event === "error") fail(event.code);
						}
					}
					if (Buffer.byteLength(pending, "utf8") > 20 * 1024)
						throw new MeterFailure("output-limit");
				} catch (error) {
					fail(error instanceof MeterFailure ? error.code : "invalid-protocol");
				}
			});
			proc.once("close", (code, exitSignal) => {
				closed = true;
				clearTimeout(startup);
				clearTimeout(lifetime);
				clearTimeout(grace);
				clearTimeout(flush);
				signal.removeEventListener("abort", cancel);
				try {
					pending += decoder.decode();
					if (signal.aborted) {
						resolve({ status: "cancelled" });
						return;
					}
					if (failure) throw new MeterFailure(failure);
					if (mode === "capability") {
						const data: unknown = JSON.parse(pending);
						if (
							code !== 0 ||
							exitSignal ||
							!data ||
							typeof data !== "object" ||
							!("schemaVersion" in data) ||
							data.schemaVersion !== 1 ||
							!("audioOutputMeter" in data) ||
							data.audioOutputMeter !== true
						)
							throw new MeterFailure("unsupported-helper");
						resolve({ status: "stopped", reason: "stop" });
						return;
					}
					if (pending.trim()) throw new MeterFailure("invalid-protocol");
					if (terminal?.event === "error") throw new MeterFailure(terminal.code);
					if (code !== 0 || exitSignal || !terminal) throw new MeterFailure("unexpected-exit");
					resolve({ status: "stopped", reason: terminal.reason });
				} catch (error) {
					reject(error instanceof MeterFailure ? error : new MeterFailure("invalid-protocol"));
				}
			});
			signal.addEventListener("abort", cancel, { once: true });
			try {
				if (signal.aborted) cancel();
				else if (request.owner.isDestroyed() || !request.isCurrent()) fail("invalid-owner");
			} catch {
				fail("invalid-owner");
			}
		});
	}
}
