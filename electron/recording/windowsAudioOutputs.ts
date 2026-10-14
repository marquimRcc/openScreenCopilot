import { execFile } from "node:child_process";

export interface WindowsAudioOutput {
	id: string;
	name: string;
	isDefault: boolean;
}

function hasControlCharacters(value: string): boolean {
	return Array.from(value).some((character) => character.charCodeAt(0) < 32);
}

// IDs belong to MMDevice, not Chromium. Never translate by friendly name.
export function parseWindowsAudioOutputs(stdout: string): WindowsAudioOutput[] {
	const value: unknown = JSON.parse(stdout);
	if (
		!value ||
		typeof value !== "object" ||
		!("schemaVersion" in value) ||
		value.schemaVersion !== 1 ||
		!("scope" in value) ||
		value.scope !== "render-loopback" ||
		!("devices" in value) ||
		!Array.isArray(value.devices) ||
		value.devices.length > 256
	) {
		throw new Error("Invalid WASAPI output snapshot");
	}
	const ids = new Set<string>();
	let defaults = 0;
	return value.devices.map((entry: unknown) => {
		if (
			!entry ||
			typeof entry !== "object" ||
			!("id" in entry) ||
			typeof entry.id !== "string" ||
			entry.id.length === 0 ||
			entry.id.length > 4096 ||
			entry.id === "default" ||
			hasControlCharacters(entry.id) ||
			!("name" in entry) ||
			typeof entry.name !== "string" ||
			entry.name.trim().length === 0 ||
			entry.name.length > 4096 ||
			hasControlCharacters(entry.name) ||
			!("isDefault" in entry) ||
			typeof entry.isDefault !== "boolean" ||
			ids.has(entry.id)
		) {
			throw new Error("Invalid WASAPI output device");
		}
		ids.add(entry.id);
		if (entry.isDefault && ++defaults > 1) throw new Error("Ambiguous WASAPI default output");
		return { id: entry.id, name: entry.name, isDefault: entry.isDefault };
	});
}

// Main-only adapter. Missing/old helpers and timeouts are errors, never an
// invented default device or silent Chromium fallback. No stream is opened.
export function listWindowsAudioOutputs(helper: string): Promise<WindowsAudioOutput[]> {
	return new Promise((resolve, reject) => {
		execFile(
			helper,
			["--list-audio-outputs"],
			{ timeout: 3000, windowsHide: true, maxBuffer: 1024 * 1024 },
			(error, stdout) => {
				if (error) {
					reject(new Error("WASAPI output enumeration failed"));
					return;
				}
				try {
					resolve(parseWindowsAudioOutputs(stdout));
				} catch (error) {
					reject(error);
				}
			},
		);
	});
}
