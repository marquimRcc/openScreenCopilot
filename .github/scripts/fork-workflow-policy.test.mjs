import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const directory = path.join(root, ".github/workflows");
const allowed = new Set(["ci.yml", "nix-check.yml"]);
const upstream = "github.repository == 'getopenscreen/openscreen'";

describe("fork workflow isolation", () => {
	for (const file of readdirSync(directory).filter((name) => name.endsWith(".yml"))) {
		if (allowed.has(file)) continue;
		it(`keeps every job in ${file} upstream-only until audited`, () => {
			const text = readFileSync(path.join(directory, file), "utf8").replace(/\r\n/g, "\n");
			const jobs = text.slice(text.indexOf("\njobs:\n") + 7);
			const headers = [...jobs.matchAll(/^ {2}[\w-]+:\s*$/gm)];
			expect(headers.length).toBeGreaterThan(0);
			for (let index = 0; index < headers.length; index++) {
				const block = jobs.slice(headers[index].index, headers[index + 1]?.index);
				const condition = block.match(/^ {4}if:[^\n]*(?:\n {6}[^\n]*)*/m)?.[0];
				expect(condition, `${file}: ${headers[index][0].trim()}`).toContain(upstream);
			}
		});
	}
});
