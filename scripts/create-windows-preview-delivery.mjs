import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
const releaseDir = path.join(root, "release", version);

const artifactSpecs = [
	["installer", `openScreenCopilot.Setup.${version}-x64.exe`],
	["installer-blockmap", `openScreenCopilot.Setup.${version}-x64.exe.blockmap`],
	["update-metadata-disabled", "latest.yml"],
	["unpacked-executable", path.join("win-unpacked", "openScreenCopilot.exe")],
	["application-archive", path.join("win-unpacked", "resources", "app.asar")],
	[
		"native-capture-helper",
		path.join(
			"win-unpacked",
			"resources",
			"electron",
			"native",
			"bin",
			"win32-x64",
			"wgc-capture.exe",
		),
	],
];

async function sha256(file) {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(file)) hash.update(chunk);
	return hash.digest("hex").toUpperCase();
}

const artifacts = [];
for (const [role, relativePath] of artifactSpecs) {
	const absolutePath = path.join(releaseDir, relativePath);
	const stat = await fs.stat(absolutePath);
	if (!stat.isFile() || stat.size === 0)
		throw new Error(`Delivery artifact is empty: ${absolutePath}`);
	artifacts.push({
		role,
		path: relativePath.replaceAll(path.sep, "/"),
		sizeBytes: stat.size,
		sha256: await sha256(absolutePath),
	});
}

const manifestPath = path.join(releaseDir, "DELIVERY-MANIFEST.json");
let previousManifest = null;
try {
	previousManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
} catch (error) {
	if (error?.code !== "ENOENT") throw error;
}
const artifactsUnchanged =
	previousManifest?.schemaVersion === 1 &&
	JSON.stringify(previousManifest.artifacts) === JSON.stringify(artifacts);
const source = artifactsUnchanged
	? previousManifest.source
	: {
			commit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: root,
				encoding: "utf8",
			}).trim(),
			branch: execFileSync("git", ["branch", "--show-current"], {
				cwd: root,
				encoding: "utf8",
			}).trim(),
		};

const manifest = {
	schemaVersion: 1,
	product: "openScreenCopilot",
	version,
	channel: "windows-preview",
	platform: "win32",
	arch: "x64",
	source,
	distribution: {
		codeSigned: false,
		autoUpdateEnabled: false,
		published: false,
	},
	artifacts,
};

const sumsPath = path.join(releaseDir, "SHA256SUMS.txt");
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await fs.writeFile(
	sumsPath,
	`${artifacts.map((artifact) => `${artifact.sha256} *${artifact.path}`).join("\n")}\n`,
	"utf8",
);

console.log(
	JSON.stringify(
		{
			manifestPath,
			sumsPath,
			installer: artifacts[0],
			source: manifest.source,
		},
		null,
		2,
	),
);
