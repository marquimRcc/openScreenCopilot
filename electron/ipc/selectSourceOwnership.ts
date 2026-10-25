export type SelectedSourceSnapshot = {
	name: string;
	id?: string;
	display_id?: string;
	captureRegion?: import("../../src/lib/windowsCaptureRegion").WindowsCaptureRegion;
};

export type SelectedSourcePersistence = "persist" | "preserve" | "clear";

export type SelectSourceContext<TLive extends { id: string; name: string; display_id: string }> = {
	generation: { value: number };
	getSelected: () => { source: SelectedSourceSnapshot | null; live: TLive | null };
	setSelected: (source: SelectedSourceSnapshot | null, live: TLive | null) => void;
	getCached: (id: string) => TLive | null;
	replaceCache: (sources: TLive[]) => void;
};

export type SelectSourceDeps<TLive extends { id: string; name: string; display_id: string }> = {
	getSources: () => Promise<TLive[]>;
	persist: (source: SelectedSourceSnapshot) => void;
	clearPersisted: () => void;
	broadcast: (source: SelectedSourceSnapshot | null) => void;
	/** Main-owned metadata, applied only after live source ownership is verified. */
	decorate?: (source: SelectedSourceSnapshot) => SelectedSourceSnapshot;
	/** Main-owned state committed only after the durable policy succeeds. */
	beforeCommit?: (source: SelectedSourceSnapshot) => void;
};

export function bumpSelectSourceGeneration(generation: { value: number }): number {
	generation.value += 1;
	return generation.value;
}

export async function selectSourceWithOwnership<
	TLive extends { id: string; name: string; display_id: string },
>(
	ctx: SelectSourceContext<TLive>,
	source: { id?: string; name: string; display_id?: string },
	persistence: SelectedSourcePersistence,
	deps: SelectSourceDeps<TLive>,
): Promise<SelectedSourceSnapshot | null> {
	const generation = bumpSelectSourceGeneration(ctx.generation);
	let live: TLive | null = typeof source.id === "string" ? ctx.getCached(source.id) : null;

	if (!live && typeof source.id === "string") {
		try {
			const sources = await deps.getSources();
			if (generation !== ctx.generation.value) {
				return ctx.getSelected().source;
			}
			ctx.replaceCache(sources);
			live = ctx.getCached(source.id);
		} catch {
			if (generation !== ctx.generation.value) {
				return ctx.getSelected().source;
			}
			live = null;
		}
	}

	if (generation !== ctx.generation.value) {
		return ctx.getSelected().source;
	}

	if (!live) {
		ctx.setSelected(null, null);
		deps.broadcast(null);
		return null;
	}

	const base: SelectedSourceSnapshot = {
		id: live.id,
		name: live.name,
		display_id: live.display_id,
	};
	const next = deps.decorate ? deps.decorate(base) : base;
	if (persistence === "clear") {
		// A region cannot be restored safely after restart. Clearing an older
		// full-display descriptor is therefore part of the commit, not best effort.
		// If the durable write fails, leave the previous live selection untouched.
		deps.clearPersisted();
	} else if (persistence === "persist") {
		try {
			deps.persist(next);
		} catch (error) {
			console.warn("Failed to persist the selected recording source:", error);
		}
	}
	deps.beforeCommit?.(next);
	ctx.setSelected(next, live);
	deps.broadcast(next);
	return next;
}
