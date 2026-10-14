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
		const broadcast = vi.fn();
		const persist = vi.fn();
		const crop = {
			displayId: 1,
			sourceWidthPx: 1920,
			sourceHeightPx: 1080,
			regionPx: { x: 20, y: 40, width: 800, height: 600 },
		};
		const result = await selectSourceWithOwnership(
			harness.ctx,
			sourceA,
			{ persist: false },
			{
				getSources: async () => [sourceA],
				persist,
				broadcast,
				shouldPersist: (options) => options?.persist !== false,
				decorate: (live) => ({ ...live, captureRegion: crop }),
			},
		);
		expect(result?.captureRegion).toEqual(crop);
		expect(broadcast).toHaveBeenCalledExactlyOnceWith(result);
		expect(persist).not.toHaveBeenCalled();
	});

	it("does not commit or broadcast if trusted region validation fails", async () => {
		const harness = createContext();
		harness.seedCache(sourceA);
		const broadcast = vi.fn();
		await expect(
			selectSourceWithOwnership(harness.ctx, sourceA, undefined, {
				getSources: async () => [sourceA],
				persist: vi.fn(),
				broadcast,
				shouldPersist: () => false,
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

		const pendingA = selectSourceWithOwnership(
			harness.ctx,
			sourceA,
			{ persist: true },
			{
				getSources: () =>
					new Promise<Live[]>((resolve) => {
						resolveA = resolve;
					}),
				persist,
				broadcast,
				shouldPersist: () => true,
			},
		);

		await selectSourceWithOwnership(
			harness.ctx,
			sourceB,
			{ persist: true },
			{
				getSources: async () => [sourceA, sourceB],
				persist,
				broadcast,
				shouldPersist: () => true,
			},
		);
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
