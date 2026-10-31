// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type RecordingGifLabels, RecordingGifOptions } from "./RecordingGifOptions";

const labels: RecordingGifLabels = {
	title: "GIF excerpt",
	start: "Start (seconds)",
	end: "End (seconds)",
	options: "More options",
	resolution: "Size",
	small: "Small",
	medium: "Medium",
	fps: "Frames per second",
	loop: "Repeat",
	notice: "Original only, without audio or editable layers. GIF can be larger than MP4.",
	output: "Output",
	invalid: "Choose a valid excerpt",
	review: "Review size",
	reviewFailed: "Review failed",
	cancel: "Cancel",
};
const source = { width: 1920, height: 1080, durationSec: 80 };
afterEach(cleanup);
function setup(metadata = source) {
	const onReview = vi.fn(async () => undefined),
		onCancel = vi.fn();
	const view = render(
		<RecordingGifOptions
			source={metadata}
			labels={labels}
			onReview={onReview}
			onCancel={onCancel}
			locale="en"
		/>,
	);
	return { ...view, onReview, onCancel };
}
describe("isolated original GIF options", () => {
	it("defaults to a short original excerpt, exposes no file size guess and does not auto-run", () => {
		const { onReview } = setup();
		expect(screen.getByLabelText(labels.end)).toHaveValue(10);
		expect(screen.getByText(labels.notice)).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("852 × 480 · 10 s");
		expect(screen.queryByText(/MB|KB/)).toBeNull();
		expect(onReview).not.toHaveBeenCalled();
	});
	it("sends exactly the six allowed options, not a plan, path, scene or export call", async () => {
		const { onReview } = setup();
		fireEvent.change(screen.getByLabelText(labels.start), { target: { value: "1.25" } });
		fireEvent.change(screen.getByLabelText(labels.end), { target: { value: "3.5" } });
		fireEvent.click(screen.getByRole("button", { name: labels.review }));
		await waitFor(() => expect(onReview).toHaveBeenCalledOnce());
		expect(onReview).toHaveBeenCalledWith({
			mode: "original",
			startSec: 1.25,
			endSec: 3.5,
			fps: 15,
			maxHeight: 480,
			loop: true,
		});
	});
	it.each(["", "0", "-1", "61", "81"])("blocks invalid end %s", (value) => {
		const { onReview } = setup();
		fireEvent.change(screen.getByLabelText(labels.end), { target: { value } });
		expect(screen.getByRole("button", { name: labels.review })).toBeDisabled();
		expect(screen.getByRole("alert")).toHaveTextContent(labels.invalid);
		expect(onReview).not.toHaveBeenCalled();
	});
	it("limits defaults to the actual short duration and never upscales", () => {
		setup({ width: 320, height: 200, durationSec: 2.5 });
		expect(screen.getByLabelText(labels.end)).toHaveValue(2.5);
		expect(screen.getByRole("status")).toHaveTextContent("320 × 200 · 2.5 s");
	});
	it("uses the current metadata after source replacement instead of retaining a valid stale plan", () => {
		const { rerender, onReview, onCancel } = setup();
		rerender(
			<RecordingGifOptions
				source={{ ...source, durationSec: 2 }}
				labels={labels}
				onReview={onReview}
				onCancel={onCancel}
			/>,
		);
		expect(screen.getByRole("button", { name: labels.review })).toBeDisabled();
	});
	it("locks edits and duplicate submission while review is pending, but permits cancellation", async () => {
		let finish!: () => void;
		const onReview = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						finish = resolve;
					}),
			),
			onCancel = vi.fn();
		const { container } = render(
			<RecordingGifOptions
				source={source}
				labels={labels}
				onReview={onReview}
				onCancel={onCancel}
			/>,
		);
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		fireEvent.submit(form);
		fireEvent.submit(form);
		expect(onReview).toHaveBeenCalledOnce();
		expect(screen.getByLabelText(labels.start)).toBeDisabled();
		fireEvent.click(screen.getByRole("button", { name: labels.cancel }));
		expect(onCancel).toHaveBeenCalledOnce();
		finish();
		await waitFor(() => expect(screen.getByLabelText(labels.start)).toBeEnabled());
	});
	it("reports review failure without claiming a GIF was saved", async () => {
		const onReview = vi.fn(async () => {
			throw new Error("probe failed");
		});
		render(
			<RecordingGifOptions
				source={source}
				labels={labels}
				onReview={onReview}
				onCancel={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: labels.review }));
		expect(await screen.findByRole("alert")).toHaveTextContent(labels.reviewFailed);
		expect(screen.getByRole("button", { name: labels.review })).toBeEnabled();
	});
	it("uses explicit advanced choices while keeping editable layers and paths out of the request", async () => {
		const { onReview } = setup();
		fireEvent.change(screen.getByLabelText(labels.resolution), { target: { value: "720" } });
		fireEvent.change(screen.getByLabelText(labels.fps), { target: { value: "25" } });
		fireEvent.click(screen.getByLabelText(labels.loop));
		fireEvent.click(screen.getByRole("button", { name: labels.review }));
		await waitFor(() =>
			expect(onReview).toHaveBeenCalledWith({
				mode: "original",
				startSec: 0,
				endSec: 10,
				fps: 25,
				maxHeight: 720,
				loop: false,
			}),
		);
	});
	it("blocks unavailable metadata instead of guessing dimensions or duration", () => {
		setup({ width: 0, height: 1080, durationSec: Number.NaN });
		expect(screen.getByRole("button", { name: labels.review })).toBeDisabled();
		expect(screen.queryByRole("status")).toBeNull();
	});
	it("honors parent-owned busy state even for a direct submit event", () => {
		const onReview = vi.fn(),
			onCancel = vi.fn();
		const { container } = render(
			<RecordingGifOptions
				source={source}
				labels={labels}
				onReview={onReview}
				onCancel={onCancel}
				busy
			/>,
		);
		const form = container.querySelector("form");
		if (!form) throw new Error("Missing form");
		fireEvent.submit(form);
		expect(onReview).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: labels.cancel }));
		expect(onCancel).toHaveBeenCalledOnce();
	});
});
