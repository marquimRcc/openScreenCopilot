import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { WindowsCaptureProcessOwnership } from "./windowsCaptureProcessOwnership";

class FakeProcess extends EventEmitter {
	close() {
		this.emit("close");
	}
}

describe("WindowsCaptureProcessOwnership", () => {
	it("retains exclusive ownership until the exact close event is observed", () => {
		const ownership = new WindowsCaptureProcessOwnership<FakeProcess>();
		const first = new FakeProcess();
		const second = new FakeProcess();

		expect(ownership.attach(first)).toBe(1);
		expect(ownership.hasOwner()).toBe(true);
		expect(ownership.owns(first)).toBe(true);
		expect(() => ownership.attach(second)).toThrow(/still owned/);

		first.close();
		expect(ownership.hasOwner()).toBe(false);
		expect(ownership.attach(second)).toBe(2);
		expect(ownership.owns(second)).toBe(true);
	});

	it("does not release ownership for kill intent or unrelated events", () => {
		const ownership = new WindowsCaptureProcessOwnership<FakeProcess>();
		const process = new FakeProcess();
		ownership.attach(process);

		process.emit("exit");
		process.emit("disconnect");
		expect(ownership.hasOwner()).toBe(true);

		process.close();
		expect(ownership.hasOwner()).toBe(false);
	});

	it("ignores a stale close after a newer generation is attached", () => {
		const ownership = new WindowsCaptureProcessOwnership<ReplayableCloseProcess>();
		const first = new ReplayableCloseProcess();
		const second = new ReplayableCloseProcess();
		ownership.attach(first);
		first.fireClose();
		ownership.attach(second);

		first.replayClose();
		expect(ownership.owns(second)).toBe(true);
		second.fireClose();
		expect(ownership.hasOwner()).toBe(false);
	});

	it("handles a synchronous close during listener registration", () => {
		const ownership = new WindowsCaptureProcessOwnership<CloseOnSubscribe>();
		const process = new CloseOnSubscribe();

		expect(ownership.attach(process)).toBe(1);
		expect(ownership.hasOwner()).toBe(false);
		expect(ownership.owns(process)).toBe(false);
	});

	it("rolls back ownership when listener registration throws", () => {
		const ownership = new WindowsCaptureProcessOwnership<ThrowingProcess>();
		const broken = new ThrowingProcess();
		expect(() => ownership.attach(broken)).toThrow("listener failed");
		expect(ownership.hasOwner()).toBe(false);

		const next = new ThrowingProcess(false);
		expect(ownership.attach(next)).toBe(2);
		expect(ownership.owns(next)).toBe(true);
	});
});

class CloseOnSubscribe extends EventEmitter {
	override once(event: string | symbol, listener: (...args: unknown[]) => void): this {
		super.once(event, listener);
		if (event === "close") this.emit("close");
		return this;
	}
}

class ReplayableCloseProcess extends EventEmitter {
	private closeListener: (() => void) | null = null;

	override once(event: string | symbol, listener: (...args: unknown[]) => void): this {
		if (event === "close") this.closeListener = listener;
		return super.once(event, listener);
	}

	fireClose() {
		this.emit("close");
	}

	replayClose() {
		this.closeListener?.();
	}
}

class ThrowingProcess extends EventEmitter {
	constructor(private readonly shouldThrow = true) {
		super();
	}

	override once(event: string | symbol, listener: (...args: unknown[]) => void): this {
		if (this.shouldThrow && event === "close") throw new Error("listener failed");
		return super.once(event, listener);
	}
}
