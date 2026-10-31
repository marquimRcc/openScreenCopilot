import { describe, expect, it } from "vitest";
import {
	MS_STORE_PRODUCT_ID,
	offersStarPrompt,
	STAR_PROMPT_AT_EXPORT,
	type StarPromptState,
	storeReviewUrl,
} from "./star-prompt";

const state = (patch: Partial<StarPromptState> = {}): StarPromptState => ({
	successfulExports: STAR_PROMPT_AT_EXPORT,
	dismissed: false,
	recording: false,
	headless: false,
	...patch,
});

describe("star prompt policy", () => {
	it("offers on the first successful export and on no other", () => {
		expect(offersStarPrompt(state({ successfulExports: 0 }))).toBe(false);
		expect(offersStarPrompt(state({ successfulExports: 1 }))).toBe(true);
		expect(offersStarPrompt(state({ successfulExports: 2 }))).toBe(false);
		expect(offersStarPrompt(state({ successfulExports: 50 }))).toBe(false);
	});

	it("never asks again once the user has answered, either way", () => {
		expect(offersStarPrompt(state({ dismissed: true }))).toBe(false);
	});

	it("stays out of the way during a recording", () => {
		expect(offersStarPrompt(state({ recording: true }))).toBe(false);
	});

	it("never fires on a CLI or headless export", () => {
		expect(offersStarPrompt(state({ headless: true }))).toBe(false);
	});

	it("keeps every veto independent of the export count", () => {
		// A veto that only held at the offer count would let the prompt through the moment the
		// count moved past it, which is exactly when a regression would go unnoticed.
		for (const count of [0, 1, 2]) {
			expect(offersStarPrompt(state({ successfulExports: count, dismissed: true }))).toBe(false);
			expect(offersStarPrompt(state({ successfulExports: count, recording: true }))).toBe(false);
			expect(offersStarPrompt(state({ successfulExports: count, headless: true }))).toBe(false);
		}
	});

	it("never opens the upstream Store listing for this fork", () => {
		expect(MS_STORE_PRODUCT_ID).toBe("");
		expect(storeReviewUrl).toThrow("This fork has no Microsoft Store listing.");
	});
});
