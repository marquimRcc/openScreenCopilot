import { describe, expect, it, vi } from "vitest";
import { createAppQuitLifecycle, createQuitBarrier } from "./quitBarrier";

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
const tick = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("coordinated before-quit", () => {
	it("waits for derivatives then STT/persistence; repeated quit does not bypass either", async () => {
		const drain = deferred(),
			shutdown = deferred();
		const resume = vi.fn(),
			preventDefault = vi.fn(),
			quit = vi.fn();
		const deps = {
			pauseDerivatives: vi.fn(() => ({ settled: drain.promise, resume })),
			shutdown: vi.fn(() => shutdown.promise),
			quit,
			onError: vi.fn(),
		};
		const handle = createQuitBarrier(deps);
		quit.mockImplementation(() => handle({ preventDefault }));
		handle({ preventDefault });
		handle({ preventDefault });
		expect(deps.pauseDerivatives).toHaveBeenCalledOnce();
		expect(deps.shutdown).not.toHaveBeenCalled();
		drain.resolve();
		await tick();
		expect(deps.shutdown).toHaveBeenCalledOnce();
		expect(quit).not.toHaveBeenCalled();
		expect(resume).not.toHaveBeenCalled();
		shutdown.resolve();
		await tick();
		expect(resume).toHaveBeenCalledOnce();
		expect(quit).toHaveBeenCalledOnce();
		expect(preventDefault).toHaveBeenCalledTimes(2);
	});
	it("drains again after a window vetoes the re-entered quit, without leaving admission frozen", async () => {
		const resume = vi.fn(),
			pause = vi.fn(() => ({ settled: Promise.resolve(), resume }));
		const event = { preventDefault: vi.fn() };
		const quit = vi.fn();
		const handle = createQuitBarrier({
			pauseDerivatives: pause,
			shutdown: async () => undefined,
			quit,
			onError: vi.fn(),
		});
		quit.mockImplementation(() => handle(event)); // before-quit passes, then a window vetoes close.
		handle(event);
		await tick();
		expect(resume).toHaveBeenCalledOnce();
		handle(event);
		await tick();
		expect(pause).toHaveBeenCalledTimes(2);
		expect(resume).toHaveBeenCalledTimes(2);
		expect(quit).toHaveBeenCalledTimes(2);
	});
	it("does not force quit on shutdown failure and releases admission for a retry", async () => {
		const resume = vi.fn(),
			quit = vi.fn(),
			onError = vi.fn();
		const shutdown = vi
			.fn()
			.mockRejectedValueOnce(new Error("flush failed"))
			.mockResolvedValue(undefined);
		const handle = createQuitBarrier({
			pauseDerivatives: () => ({ settled: Promise.resolve(), resume }),
			shutdown,
			quit,
			onError,
		});
		handle({ preventDefault: vi.fn() });
		await tick();
		expect(quit).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledOnce();
		expect(resume).toHaveBeenCalledOnce();
		handle({ preventDefault: vi.fn() });
		await tick();
		expect(quit).toHaveBeenCalledOnce();
	});
});

describe("app quit phases", () => {
	it("keeps STT alive on window veto and waits for terminal shutdown only after close is accepted", async () => {
		const veto = deferred(),
			stopping = deferred(),
			stopped = deferred(),
			complete = deferred();
		const event = () => ({
			defaultPrevented: false,
			preventDefault() {
				this.defaultPrevented = true;
			},
		});
		let vetoWindow = true;
		let lifecycle!: ReturnType<typeof createAppQuitLifecycle>;
		const quit = () => {
			const before = event();
			lifecycle.beforeQuit(before);
			if (before.defaultPrevented) return;
			if (vetoWindow) {
				veto.resolve();
				return;
			}
			const will = event();
			lifecycle.willQuit(will);
			if (!will.defaultPrevented) complete.resolve();
		};
		const shutdownStt = vi.fn(async () => {
			stopping.resolve();
			await stopped.promise;
		});
		const resume = vi.fn(),
			flush = vi.fn(async () => undefined),
			onError = vi.fn();
		lifecycle = createAppQuitLifecycle({
			pauseDerivatives: () => ({ settled: Promise.resolve(), resume }),
			flush,
			shutdownStt,
			quit,
			onError,
		});
		quit();
		await veto.promise;
		expect(shutdownStt).not.toHaveBeenCalled();
		expect(resume).toHaveBeenCalledOnce();
		vetoWindow = false;
		quit();
		await stopping.promise;
		let exited = false;
		void complete.promise.then(() => {
			exited = true;
		});
		quit();
		await tick();
		expect(exited).toBe(false);
		expect(shutdownStt).toHaveBeenCalledOnce();
		stopped.resolve();
		await complete.promise;
		expect(onError).not.toHaveBeenCalled();
		expect(flush.mock.calls.length).toBeGreaterThanOrEqual(4);
	});
	it("does not stop STT when preparation fails before any window close", async () => {
		const failed = deferred(),
			shutdownStt = vi.fn(async () => undefined),
			quit = vi.fn(),
			resume = vi.fn();
		const lifecycle = createAppQuitLifecycle({
			pauseDerivatives: () => ({ settled: Promise.resolve(), resume }),
			flush: async () => {
				throw new Error("flush failed");
			},
			shutdownStt,
			quit,
			onError: () => failed.resolve(),
		});
		lifecycle.beforeQuit({ preventDefault: vi.fn() });
		await failed.promise;
		expect(quit).not.toHaveBeenCalled();
		expect(shutdownStt).not.toHaveBeenCalled();
		expect(resume).toHaveBeenCalledOnce();
	});
});
