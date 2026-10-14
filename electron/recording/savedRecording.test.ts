import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createSavedRecordingActions } from "./savedRecording";

function setup() {
	const file = path.resolve("recordings", "gravação 1.mp4");
	const deps = {
		getCurrentPath: vi.fn((): string | null => file),
		isAllowed: vi.fn(() => true),
		isRecording: vi.fn(() => false),
		isEditorDirty: vi.fn(() => false),
		stat: vi.fn(async () => ({ size: 12345, isFile: (): boolean => true })),
		reveal: vi.fn(),
		openResult: vi.fn(),
		prepareCapture: vi.fn(),
	};
	return { file, deps, actions: createSavedRecordingActions(deps) };
}
describe("saved recording actions", () => {
	it("shows the actual existing approved file and location", async () => {
		const { actions, deps, file } = setup();
		expect(await actions.showResult()).toEqual({
			success: true,
			recording: {
				path: file,
				name: "gravação 1.mp4",
				folder: path.dirname(file),
				sizeBytes: 12345,
			},
		});
		expect(deps.openResult).toHaveBeenCalledOnce();
	});
	it.each([
		"missing",
		"unapproved",
		"empty",
		"directory",
	])("does not claim success for %s output", async (kind) => {
		const { actions, deps } = setup();
		if (kind === "missing") deps.stat.mockRejectedValue(new Error("ENOENT"));
		if (kind === "unapproved") deps.isAllowed.mockReturnValue(false);
		if (kind === "empty") deps.stat.mockResolvedValue({ size: 0, isFile: () => true });
		if (kind === "directory") deps.stat.mockResolvedValue({ size: 10, isFile: () => false });
		expect((await actions.showResult()).success).toBe(false);
		expect(deps.openResult).not.toHaveBeenCalled();
	});
	it("reveals exactly the current saved file and rejects stale paths", async () => {
		const { actions, deps, file } = setup();
		expect((await actions.reveal(file)).success).toBe(true);
		expect(deps.reveal).toHaveBeenCalledExactlyOnceWith(file);
		expect((await actions.reveal(file + ".other")).success).toBe(false);
		expect(deps.reveal).toHaveBeenCalledOnce();
	});
	it("reports shell failure without changing the original path", async () => {
		const { actions, deps, file } = setup();
		deps.reveal.mockImplementation(() => {
			throw new Error("Shell failure");
		});
		expect((await actions.reveal(file)).success).toBe(false);
		expect(deps.getCurrentPath()).toBe(file);
	});
	it.each(["recording", "dirty"])("does not close the current window while %s", async (kind) => {
		const { actions, deps } = setup();
		if (kind === "recording") deps.isRecording.mockReturnValue(true);
		else deps.isEditorDirty.mockReturnValue(true);
		expect((await actions.showResult()).success).toBe(false);
		expect(actions.prepare().success).toBe(false);
		expect(deps.openResult).not.toHaveBeenCalled();
		expect(deps.prepareCapture).not.toHaveBeenCalled();
	});
	it("rejects a recording replaced during validation", async () => {
		const { actions, deps } = setup();
		deps.stat.mockImplementation(async () => {
			deps.getCurrentPath.mockReturnValue(path.resolve("new.mp4"));
			return { size: 100, isFile: () => true };
		});
		expect((await actions.showResult()).success).toBe(false);
		expect(deps.openResult).not.toHaveBeenCalled();
	});
	it("new capture only prepares the HUD and preserves the previous media", () => {
		const { actions, deps, file } = setup();
		expect(actions.prepare()).toEqual({ success: true });
		expect(deps.prepareCapture).toHaveBeenCalledOnce();
		expect(deps.getCurrentPath()).toBe(file);
	});
});
