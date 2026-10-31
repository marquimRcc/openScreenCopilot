import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WindowsMeterCaptureGuard } from "./windowsMeterCaptureGuard";

class Owner extends EventEmitter {
	dead = false;
	isDestroyed() {
		return this.dead;
	}
	destroy() {
		this.dead = true;
		this.emit("destroyed");
	}
}
let resolve: () => void, settled: Promise<void>, resume: ReturnType<typeof vi.fn<() => void>>;
let pause: ReturnType<typeof vi.fn<() => { settled: Promise<void>; resume(): void }>>;
let guard: WindowsMeterCaptureGuard;
beforeEach(() => {
	settled = new Promise((done) => {
		resolve = done;
	});
	resume = vi.fn();
	pause = vi.fn(() => ({ settled, resume }));
	guard = new WindowsMeterCaptureGuard({ pauseAndDrain: pause });
});
describe("Windows capture excludes meter until owned lifetime ends", () => {
	it("freezes admission synchronously and waits for meter close before native use", async () => {
		const capture = guard.beginNative();
		let ready = false;
		void capture.settled.then(() => {
			ready = true;
		});
		expect(guard.canPreview()).toBe(false);
		expect(() => guard.beginNative()).toThrow();
		await Promise.resolve();
		expect(ready).toBe(false);
		resolve();
		await capture.settled;
		expect(capture.isCurrent()).toBe(true);
		capture.finishPreparation();
		expect(guard.canPreview()).toBe(true);
		expect(resume).toHaveBeenCalledTimes(1);
	});
	it("retains native ownership through exit and early preparation cleanup, until close", async () => {
		const capture = guard.beginNative();
		resolve();
		await capture.settled;
		const proc = new EventEmitter();
		capture.bind(proc);
		capture.finishPreparation();
		proc.emit("exit");
		expect(guard.canPreview()).toBe(false);
		expect(resume).not.toHaveBeenCalled();
		proc.emit("close");
		expect(guard.canPreview()).toBe(true);
		expect(resume).toHaveBeenCalledTimes(1);
	});
	it("rejects double bind or a preparation invalidated by quit", async () => {
		const capture = guard.beginNative();
		const quit = guard.pauseForQuit();
		resolve();
		await quit.settled;
		quit.resume();
		expect(capture.isCurrent()).toBe(false);
		expect(() => capture.bind(new EventEmitter())).toThrow();
		capture.finishPreparation();
		const fresh = guard.beginNative();
		await fresh.settled;
		fresh.bind(new EventEmitter());
		expect(() => fresh.bind(new EventEmitter())).toThrow();
	});
	it("browser grant waits for drain and rechecks current owner", async () => {
		const owner = new Owner();
		let current = true;
		const pending = guard.beginBrowser(owner, () => current);
		expect(guard.canPreview()).toBe(false);
		current = false;
		resolve();
		await expect(pending).rejects.toThrow();
		expect(guard.canPreview()).toBe(true);
		expect(owner.listenerCount("destroyed")).toBe(0);
	});
	it("does not let a foreign false recording state release a browser capture", async () => {
		const owner = new Owner(),
			foreign = new Owner();
		const pending = guard.beginBrowser(owner, () => true);
		resolve();
		const lease = await pending;
		guard.endBrowser(foreign);
		expect(guard.canPreview()).toBe(false);
		expect(lease.isCurrent()).toBe(true);
		guard.endBrowser(owner);
		expect(guard.canPreview()).toBe(true);
		lease.release();
		expect(resume).toHaveBeenCalledTimes(1);
	});
	it("captures lose permission after owner closes or quit starts, including after await", async () => {
		const owner = new Owner();
		const pending = guard.beginBrowser(owner, () => true);
		resolve();
		const lease = await pending;
		const quit = guard.pauseForQuit();
		await quit.settled;
		quit.resume();
		expect(lease.isCurrent()).toBe(false);
		owner.destroy();
		expect(guard.canPreview()).toBe(true);
		expect(owner.listenerCount("destroyed")).toBe(0);
	});
	it("handles owner destroyed during listener registration without orphaning pause", async () => {
		const owner = new Owner();
		vi.spyOn(owner, "once").mockImplementation((_event, callback) => {
			owner.destroy();
			callback();
			return owner;
		});
		const pending = guard.beginBrowser(owner, () => true);
		resolve();
		await expect(pending).rejects.toThrow();
		expect(guard.canPreview()).toBe(true);
		expect(resume).toHaveBeenCalledTimes(1);
	});
	it("veto resumes admission but never revives pre-quit preparations", async () => {
		const owner = new Owner();
		const old = guard.beginBrowser(owner, () => true);
		const quit = guard.pauseForQuit();
		resolve();
		await quit.settled;
		quit.resume();
		quit.resume();
		await expect(old).rejects.toThrow();
		expect(guard.canPreview()).toBe(true);
		const next = await guard.beginBrowser(owner, () => true);
		expect(next.isCurrent()).toBe(true);
		next.release();
	});
	it("balances nested shutdown freezes", async () => {
		const one = guard.pauseForQuit(),
			two = guard.pauseForQuit();
		resolve();
		await Promise.all([one.settled, two.settled]);
		one.resume();
		one.resume();
		expect(guard.canPreview()).toBe(false);
		two.resume();
		expect(guard.canPreview()).toBe(true);
	});
	it("reserves before invoking potentially reentrant drain", () => {
		pause.mockImplementation(() => {
			expect(guard.canPreview()).toBe(false);
			expect(() => guard.beginNative()).toThrow();
			return { settled, resume };
		});
		const capture = guard.beginNative();
		capture.finishPreparation();
		expect(guard.canPreview()).toBe(true);
	});
});
