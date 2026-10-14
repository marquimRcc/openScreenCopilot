// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegionSelector } from "./RegionSelector";

vi.mock("@/contexts/I18nContext", () => ({ useScopedT: () => (key: string) => key }));

describe("RegionSelector", () => {
	beforeEach(() => {
		vi.stubGlobal("PointerEvent", MouseEvent);
		HTMLElement.prototype.setPointerCapture = vi.fn();
		HTMLElement.prototype.releasePointerCapture = vi.fn();
		window.electronAPI = {
			...window.electronAPI,
			getRegionSelectionInfo: vi.fn().mockResolvedValue({
				boundsDip: { x: -1536, y: 0, width: 1536, height: 864 },
				widthPx: 1920,
				heightPx: 1080,
			}),
			finishRegionSelection: vi.fn().mockResolvedValue(undefined),
		};
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	async function draw() {
		render(<RegionSelector />);
		await act(async () => {
			/* Flush the asynchronous display snapshot. */
		});
		const surface = screen.getByTestId("region-drag-surface");
		fireEvent.pointerDown(surface, { button: 0, clientX: 420, clientY: 340 });
		fireEvent.pointerMove(surface, { clientX: 100, clientY: 100 });
		fireEvent.pointerUp(surface, { clientX: 100, clientY: 100 });
	}

	it("requires a drag and confirms exactly the local rectangle, not a screen source", async () => {
		await draw();
		expect(screen.getByText(/400 × 300 px/)).toBeInTheDocument();
		expect(window.electronAPI.finishRegionSelection).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "regionSelection.confirm" }));
		expect(window.electronAPI.finishRegionSelection).toHaveBeenCalledExactlyOnceWith({
			x: 100,
			y: 100,
			width: 320,
			height: 240,
		});
	});

	it("Escape cancels even after drawing; never confirms the current crop", async () => {
		await draw();
		fireEvent.keyDown(window, { key: "Escape" });
		expect(window.electronAPI.finishRegionSelection).toHaveBeenCalledExactlyOnceWith(null);
	});

	it("does not allow confirmation with no rectangle", async () => {
		render(<RegionSelector />);
		await act(async () => {
			/* Flush the asynchronous display snapshot. */
		});
		expect(screen.getByRole("button", { name: "regionSelection.confirm" })).toBeDisabled();
		fireEvent.keyDown(document.body, { key: "Enter" });
		expect(window.electronAPI.finishRegionSelection).not.toHaveBeenCalled();
	});

	it("pointer cancellation discards the unfinished area", async () => {
		await draw();
		fireEvent.pointerCancel(screen.getByTestId("region-drag-surface"));
		expect(screen.getByRole("button", { name: "regionSelection.confirm" })).toBeDisabled();
		expect(screen.queryByTestId("region-rectangle")).toBeNull();
	});

	it("shows a recoverable error without a second or full-screen request", async () => {
		await draw();
		vi.mocked(window.electronAPI.finishRegionSelection!).mockRejectedValueOnce(
			new Error("Invalid area"),
		);
		fireEvent.click(screen.getByRole("button", { name: "regionSelection.confirm" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("regionSelection.error");
		expect(window.electronAPI.finishRegionSelection).toHaveBeenCalledTimes(1);
	});
});
