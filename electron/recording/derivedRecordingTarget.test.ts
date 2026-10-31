import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DerivedRecordingTargets } from "./derivedRecordingTarget";

class Owner extends EventEmitter {
	closed = false;
	isDestroyed() {
		return this.closed;
	}
	close() {
		this.closed = true;
		this.emit("destroyed");
	}
}
let directory: string;
let original: string;
let current: { key: string; paths: string[] } | null;
let busy: boolean;
let owner: Owner;
let targets: DerivedRecordingTargets;
const validate = vi.fn(async () => undefined);
const digest = async (file: string) =>
	createHash("sha256")
		.update(await fs.readFile(file))
		.digest("hex");

beforeEach(async () => {
	directory = await fs.mkdtemp(
		path.join(await fs.realpath(os.tmpdir()), "openscreen-derived-test-"),
	);
	original = path.join(directory, "gravação original.mp4");
	await fs.writeFile(original, "synthetic original — not private media");
	current = { key: "take-1", paths: [original] };
	busy = false;
	owner = new Owner();
	targets = new DerivedRecordingTargets(
		() => current,
		() => busy,
	);
	validate.mockClear();
});
afterEach(async () => {
	owner.close();
	// Test-only mkdtemp fixture; validate the absolute prefix before recursive cleanup.
	const resolved = path.resolve(directory);
	if (
		path.dirname(resolved) !== (await fs.realpath(os.tmpdir())) ||
		!path.basename(resolved).startsWith("openscreen-derived-test-")
	)
		throw new Error("Unexpected test directory.");
	await fs.rm(resolved, { recursive: true, force: true });
});

describe("main-owned derived recording destinations (real filesystem)", () => {
	it("publishes a new file with exclusive atomic link and leaves the original hash unchanged", async () => {
		const before = await digest(original);
		const destination = path.join(directory, "vídeo separado.gif");
		const token = targets.approve(owner, destination, "gif");
		expect(token).not.toContain(directory);
		const lease = await targets.begin(owner, token);
		await fs.writeFile(lease.outputPath, "synthetic GIF derivative");
		expect(await lease.publish(validate)).toBe(destination);
		expect(validate).toHaveBeenCalledWith(lease.outputPath, "gif");
		expect(await fs.readFile(destination, "utf8")).toBe("synthetic GIF derivative");
		expect(await digest(original)).toBe(before);
		await expect(fs.stat(lease.outputPath)).rejects.toMatchObject({ code: "ENOENT" });
		expect(owner.listenerCount("destroyed")).toBe(0);
	});
	it("binds one-use tokens to the exact owner and invalidates older grants", async () => {
		const first = targets.approve(owner, path.join(directory, "first.gif"), "gif");
		const second = targets.approve(owner, path.join(directory, "second.gif"), "gif");
		await expect(targets.begin(owner, first)).rejects.toThrow("Unknown");
		await expect(targets.begin(new Owner(), second)).rejects.toThrow("Unknown");
		const lease = await targets.begin(owner, second);
		await expect(targets.begin(owner, second)).rejects.toThrow("Unknown");
		await lease.discard();
		await lease.discard();
	});
	it("refuses existing originals, hardlink aliases and unrelated files without changing them", async () => {
		const alias = path.join(directory, "alias.mp4");
		const unrelated = path.join(directory, "unrelated.mp4");
		await fs.link(original, alias);
		await fs.writeFile(unrelated, "keep me");
		const before = await digest(original);
		for (const destination of [original, alias, unrelated]) {
			const token = targets.approve(owner, destination, "mp4");
			await expect(targets.begin(owner, token)).rejects.toThrow("already exists");
		}
		expect(await digest(original)).toBe(before);
		expect(await digest(alias)).toBe(before);
		expect(await fs.readFile(unrelated, "utf8")).toBe("keep me");
	});
	it("never replaces a destination created between approval and publication", async () => {
		const destination = path.join(directory, "race.gif");
		const lease = await targets.begin(owner, targets.approve(owner, destination, "gif"));
		await fs.writeFile(lease.outputPath, "derivative");
		await fs.writeFile(destination, "another process owns this");
		await expect(lease.publish(validate)).rejects.toMatchObject({ code: "EEXIST" });
		expect(await fs.readFile(destination, "utf8")).toBe("another process owns this");
		await expect(fs.stat(lease.outputPath)).rejects.toMatchObject({ code: "ENOENT" });
	});
	it("rejects stale recording identity or source paths and cleans its private directory", async () => {
		const token = targets.approve(owner, path.join(directory, "stale.gif"), "gif");
		current = { key: "take-2", paths: [original] };
		await expect(targets.begin(owner, token)).rejects.toThrow("changed");
		current = { key: "take-1", paths: [original] };
		const lease = await targets.begin(
			owner,
			targets.approve(owner, path.join(directory, "paths.gif"), "gif"),
		);
		await fs.writeFile(lease.outputPath, "output");
		current.paths = [path.join(directory, "other.mp4")];
		await expect(lease.publish(validate)).rejects.toThrow("changed");
		expect((await fs.readdir(directory)).filter((name) => name.startsWith(".openscreen"))).toEqual(
			[],
		);
	});
	it("invalidates on owner close without deleting a file while the writer is still running", async () => {
		const destination = path.join(directory, "closed.gif");
		const lease = await targets.begin(owner, targets.approve(owner, destination, "gif"));
		await fs.writeFile(lease.outputPath, "writer still owns this");
		owner.close();
		expect(await fs.readFile(lease.outputPath, "utf8")).toContain("writer still");
		await expect(lease.publish(validate)).rejects.toThrow("changed");
		await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
	});
	it("refuses an active window's second job and rechecks after asynchronous validation", async () => {
		const destination = path.join(directory, "busy.gif");
		const lease = await targets.begin(owner, targets.approve(owner, destination, "gif"));
		expect(() => targets.approve(owner, destination, "gif")).toThrow("busy");
		await fs.writeFile(lease.outputPath, "output");
		await expect(
			lease.publish(async () => {
				busy = true;
			}),
		).rejects.toThrow("changed");
		await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
	});
	it("cleans failed validation and prevents publishing twice", async () => {
		const destination = path.join(directory, "bad.gif");
		const lease = await targets.begin(owner, targets.approve(owner, destination, "gif"));
		await fs.writeFile(lease.outputPath, "not decodable");
		await expect(
			lease.publish(async () => {
				throw new Error("decode failed");
			}),
		).rejects.toThrow("decode failed");
		await expect(lease.publish(validate)).rejects.toThrow("already finished");
		await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
	});
	it("refuses empty staged files and staged hardlinks to source media", async () => {
		for (const hardlink of [false, true]) {
			const destination = path.join(directory, `invalid-${hardlink}.gif`);
			const lease = await targets.begin(owner, targets.approve(owner, destination, "gif"));
			if (hardlink) await fs.link(original, lease.outputPath);
			else await fs.writeFile(lease.outputPath, "");
			await expect(lease.publish(validate)).rejects.toThrow("not a new validated file");
			await expect(fs.stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
		}
		expect(await fs.readFile(original, "utf8")).toContain("synthetic original");
	});
	it("rejects wrong extension, relative paths, ADS and portable reserved names", () => {
		for (const name of ["wrong.mp4", "CON.gif", "video.mp4:stream.gif", "invalid?.gif"])
			expect(() => targets.approve(owner, path.join(directory, name), "gif")).toThrow("Invalid");
		expect(() => targets.approve(owner, "relative.gif", "gif")).toThrow("Invalid");
		owner.close();
		expect(() => targets.approve(owner, path.join(directory, "closed.gif"), "gif")).toThrow(
			"unavailable",
		);
	});
});
