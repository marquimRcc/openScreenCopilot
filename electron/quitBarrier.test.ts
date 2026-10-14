import { describe, expect, it, vi } from "vitest";
import { createQuitBarrier } from "./quitBarrier";

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
