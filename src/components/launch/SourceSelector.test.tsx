// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceSelector } from "./SourceSelector";

vi.mock("@/contexts/I18nContext", () => ({
	useScopedT: (namespace: string) => {
		if (namespace === "common") {
			return (key: string) => {
				if (key === "actions.cancel") return "Cancel";
				if (key === "actions.share") return "Share";
				if (key === "actions.reload") return "Reload";
				return key;
			};
		}

		return (key: string, vars?: Record<string, string>) => {
			if (key === "sourceSelector.loading") return "Loading sources...";
			if (key === "sourceSelector.emptyTitle") return "No screens or windows found";
			if (key === "sourceSelector.emptyDescription") {
				return "If you just granted screen recording permission, reload this picker. On macOS you may need to reopen OpenScreen.";
			}
			if (key === "sourceSelector.loadFailedDescription") {
				return "OpenScreen could not load capture sources. Reload this picker and try again.";
			}
			if (key === "sourceSelector.screens") return `Screens (${vars?.count ?? "0"})`;
			if (key === "sourceSelector.windows") return `Windows (${vars?.count ?? "0"})`;
			return key;
		};
	},
}));

describe("SourceSelector", () => {
	beforeEach(() => {
		window.electronAPI = {
			...window.electronAPI,
			getSources: vi.fn().mockResolvedValue([]),
			selectSource: vi.fn(),
			getPlatform: vi.fn(() => "win32"),
			isNativeWindowsCaptureAvailable: vi
				.fn()
				.mockResolvedValue({ success: true, available: true, supportsRegion: true }),
			selectSourceRegion: vi.fn().mockResolvedValue({ selected: false }),
		} as typeof window.electronAPI;
	});

	it("shows a retry state when no capture sources are available", async () => {
		render(<SourceSelector />);

		await screen.findByText("No screens or windows found");
		expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
	});
	it("canceling a region never selects the full-screen source", async () => {
		vi.mocked(window.electronAPI.getSources).mockResolvedValue([
			{ id: "screen:1:0", name: "Display 1", display_id: "1", thumbnail: null, appIcon: null },
		]);
		render(<SourceSelector />);
		const regionTab = await screen.findByRole("tab", { name: "regionSelection.tab" });
		fireEvent.mouseDown(regionTab, { button: 0, ctrlKey: false });
		fireEvent.click(await screen.findByRole("button", { name: /Display 1/ }));
		fireEvent.click(screen.getByRole("button", { name: "regionSelection.draw" }));
		await waitFor(() =>
			expect(window.electronAPI.selectSourceRegion).toHaveBeenCalledExactlyOnceWith("screen:1:0"),
		);
		expect(window.electronAPI.selectSource).not.toHaveBeenCalled();
	});

	it("does not offer a region when the helper cannot prove crop support", async () => {
		vi.mocked(window.electronAPI.getSources).mockResolvedValue([
			{ id: "screen:1:0", name: "Display 1", display_id: "1", thumbnail: null, appIcon: null },
		]);
		vi.mocked(window.electronAPI.isNativeWindowsCaptureAvailable).mockResolvedValue({
			success: true,
			available: true,
		});
		render(<SourceSelector />);
		await screen.findByText("Display 1");
		expect(screen.queryByRole("tab", { name: "regionSelection.tab" })).toBeNull();
	});

	it("reloads capture sources from the empty state", async () => {
		const getSources = vi
			.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					id: "screen:1:0",
					name: "Display 1",
					thumbnail: "data:image/png;base64,abc",
					display_id: "1",
					appIcon: null,
				},
			]);
		window.electronAPI = {
			...window.electronAPI,
			getSources,
			selectSource: vi.fn(),
		} as typeof window.electronAPI;

		render(<SourceSelector />);

		await screen.findByText("No screens or windows found");
		fireEvent.click(screen.getByRole("button", { name: "Reload" }));

		await waitFor(() => {
			expect(screen.getByText("Display 1")).toBeInTheDocument();
		});
		expect(getSources).toHaveBeenCalledTimes(2);
	});
});
