import { describe, expect, it, vi } from "vitest";
import { type SelectSourceContext, selectSourceWithOwnership } from "./selectSourceOwnership";

type Live = { id: string; name: string; display_id: string };

function createContext() {
	let selected: {
		source: { name: string; id?: string; display_id?: string } | null;
		live: Live | null;
	} = {
		source: null,
		live: null,
	};
	let cache = new Map<string, Live>();
	const ctx: SelectSourceContext<Live> = {
		generation: { value: 0 },
		getSelected: () => selected,
		setSelected: (source, live) => {
			selected = { source, live };
		},
		getCached: (id) => cache.get(id) ?? null,
		replaceCache: (sources) => {
			cache = new Map(sources.map((source) => [source.id, source]));
		},
	};
	return {
		ctx,
		get selected() {
			return selected;
		},
		seedCache(source: Live) {
			cache.set(source.id, source);
		},
	};
}

const sourceA: Live = { id: "screen:a", name: "Display A", display_id: "1" };
const sourceB: Live = { id: "screen:b", name: "Display B", display_id: "2" };

describe("selectSourceWithOwnership", () => {
	it("broadcasts a trusted crop atomically, without an intermediate full-screen source", async () => {
		const harness = createContext();
		harness.seedCache(sourceA);
		const order: string[] = [];
		const broadcast = vi.fn(() => order.push("broadcast"));
		const persist = vi.fn();
		const clearPersisted = vi.fn(() => order.push("clear"));
		const crop = {
			displayId: 1,
			sourceWidthPx: 1920,
			sourceHeightPx: 1080,
			regionPx: { x: 20, y: 40, width: 800, height: 600 },
		};
		const result = await selectSourceWithOwnership(harness.ctx, sourceA, "clear", {
			getSources: async () => [sourceA],
			persist,
			clearPersisted,
			broadcast,
			decorate: (live) => ({ ...live, captureRegion: crop }),
		});
		expect(result?.captureRegion).toEqual(crop);
		expect(clearPersisted).toHaveBeenCalledOnce();
		expect(broadcast).toHaveBeenCalledExactlyOnceWith(result);
		expect(order).toEqual(["clear", "broadcast"]);
		expect(persist).not.toHaveBeenCalled();
	});

	it("fails closed without committing or broadcasting when clearing the durable source fails", async () => {
		const harness = createContext();
		harness.seedCache(sourceA);
		harness.ctx.setSelected(sourceB, sourceB);
		const broadcast = vi.fn();
		const beforeCommit = vi.fn();
		await expect(
			selectSourceWithOwnership(harness.ctx, sourceA, "clear", {
				getSources: async () => [sourceA],
				persist: vi.fn(),
				clearPersisted: () => {
					throw new Error("disk full");
				},
				broadcast,
				beforeCommit,
			}),
		).rejects.toThrow("disk full");
		expect(harness.selected.source).toMatchObject({ id: sourceB.id });
		expect(beforeCommit).not.toHaveBeenCalled();
		expect(broadcast).not.toHaveBeenCalled();
	});

	it("preserves durable state for a temporary selection", async () => {
		const harness = createContext();
		harness.seedCache(sourceA);
		const persist = vi.fn();
		const clearPersisted = vi.fn();
		const result = await selectSourceWithOwnership(harness.ctx, sourceA, "preserve", {
			getSources: async () => [sourceA],
			persist,
			clearPersisted,
			broadcast: vi.fn(),
		});
		expect(result).toMatchObject({ id: sourceA.id });
		expect(persist).not.toHaveBeenCalled();
		expect(clearPersisted).not.toHaveBeenCalled();
	});

	it("persists a normal selection before committing and broadcasting it", async () => {
		const harness = createContext();
		harness.seedCache(sourceA);
		const order: string[] = [];
		await selectSourceWithOwnership(harness.ctx, sourceA, "persist", {
			getSources: async () => [sourceA],
			persist: () => order.push("persist"),
			clearPersisted: vi.fn(),
			beforeCommit: () => order.push("commit"),
			broadcast: () => order.push("broadcast"),
		});
		expect(order).toEqual(["persist", "commit", "broadcast"]);
		expect(harness.selected.source).toMatchObject({ id: sourceA.id });
	});

	it("does not commit or broadcast if trusted region validation fails", async () => {
		const harness = createContext();
		harness.seedCache(sourceA);
		const broadcast = vi.fn();
		await expect(
			selectSourceWithOwnership(harness.ctx, sourceA, "preserve", {
				getSources: async () => [sourceA],
				persist: vi.fn(),
				clearPersisted: vi.fn(),
				broadcast,
				decorate: () => {
					throw new Error("Display changed");
				},
			}),
		).rejects.toThrow("Display changed");
		expect(harness.selected.source).toBeNull();
		expect(broadcast).not.toHaveBeenCalled();
	});
	it("keeps B when a slower A enumeration finishes later", async () => {
		const harness = createContext();
		harness.seedCache(sourceB);
		let resolveA!: (sources: Live[]) => void;
		const persist = vi.fn();
		const broadcast = vi.fn();

		const pendingA = selectSourceWithOwnership(harness.ctx, sourceA, "persist", {
			getSources: () =>
				new Promise<Live[]>((resolve) => {
					resolveA = resolve;
				}),
			persist,
			clearPersisted: vi.fn(),
			broadcast,
		});

		await selectSourceWithOwnership(harness.ctx, sourceB, "persist", {
			getSources: async () => [sourceA, sourceB],
			persist,
			clearPersisted: vi.fn(),
			broadcast,
		});
		expect(harness.selected.source).toMatchObject({ id: "screen:b" });
		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist.mock.calls[0]?.[0]).toMatchObject({ id: "screen:b" });

		resolveA([sourceA, sourceB]);
		await pendingA;

		expect(harness.selected.source).toMatchObject({ id: "screen:b" });
		expect(persist).toHaveBeenCalledTimes(1);
		expect(broadcast).toHaveBeenLastCalledWith(expect.objectContaining({ id: "screen:b" }));
	});
});
