import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8").replace(
	/\r\n/g,
	"\n",
);
const start = workflow.indexOf("\n  speech-core:\n");
const next = start < 0 ? -1 : workflow.slice(start + 1).search(/\n {2}[\w-]+:\s*\n/);
const job = start < 0 ? "" : workflow.slice(start, next < 0 ? undefined : start + 1 + next);
const manifest = "--manifest-path crates/speech-core/Cargo.toml";

describe("isolated speech-core CI", () => {
	it("has an explicit independent validation job without distribution permissions", () => {
		expect(job).toContain("name: Rust speech-core (isolated)");
		expect(job).toContain("contents: read");
		expect(job).toContain("timeout-minutes: 15");
		expect(job).toContain("CARGO_TARGET_DIR: ${{ github.workspace }}/.ci/speech-core-target");
		expect(job).not.toMatch(
			/secrets\.|publish|upload-artifact|workflow_dispatch|fetch-ffmpeg|fetch-onnx|vendor\//,
		);
	});
	it("pins the locally validated toolchain and fetches the exact separate lock", () => {
		expect(job).toContain('RUSTUP_TOOLCHAIN: "1.98.1"');
		expect(job).toContain(
			"rustup toolchain install 1.98.1 --profile minimal --component rustfmt --component clippy",
		);
		expect(job).toContain(`cargo fetch --locked ${manifest}`);
	});
	it("runs debug, release, clippy and fmt against that manifest, never the compositor", () => {
		for (const command of [
			`cargo test --offline --locked ${manifest}`,
			`cargo test --release --offline --locked ${manifest}`,
			`cargo clippy --offline --locked ${manifest} --all-targets -- -D warnings`,
			`cargo fmt ${manifest} -- --check`,
		])
			expect(job).toContain(command);
		expect(job).not.toContain("crates/compositor");
		expect(job).not.toContain("continue-on-error");
	});
});
