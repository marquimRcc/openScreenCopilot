import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), "..");

export function speechSidecarLayout({ root, platform, arch }) {
	if (!new Set(["win32", "darwin", "linux"]).has(platform))
		throw new Error(`Unsupported speech sidecar platform: ${platform}`);
	if (!new Set(["x64", "arm64"]).has(arch))
		throw new Error(`Unsupported speech sidecar architecture: ${arch}`);
	const filename = `openscreen-speech-sidecar${platform === "win32" ? ".exe" : ""}`;
	const targetDir = path.join(root, ".cache", "speech-sidecar-target");
	return {
		manifest: path.join(root, "crates", "speech-sidecar", "Cargo.toml"),
		targetDir,
		built: path.join(targetDir, "release", filename),
		staged: path.join(root, "electron", "native", "bin", `${platform}-${arch}`, filename),
	};
}

export function buildSpeechSidecar({
	root = ROOT,
	platform = process.platform,
	arch = process.arch,
	run = execFileSync,
} = {}) {
	const layout = speechSidecarLayout({ root, platform, arch });
	run(
		"cargo",
		[
			"build",
			"--release",
			"--offline",
			"--locked",
			"--manifest-path",
			layout.manifest,
			"--target-dir",
			layout.targetDir,
		],
		{ cwd: root, stdio: "inherit" },
	);
	if (!fs.existsSync(layout.built)) throw new Error(`Cargo output missing: ${layout.built}`);
	fs.mkdirSync(path.dirname(layout.staged), { recursive: true });
	fs.copyFileSync(layout.built, layout.staged);
	console.log(`Staged speech sidecar: ${layout.staged}`);
	return layout.staged;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) buildSpeechSidecar();
