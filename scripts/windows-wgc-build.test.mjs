import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./build-windows-wgc-helper.mjs", import.meta.url), "utf8");

describe("localized Windows native build", () => {
	it("sets UTF-8 before CMake detects MSVC's include prefix", () => {
		expect(source).toContain('"chcp 65001 >nul"');
		expect(source.indexOf('"chcp 65001 >nul"')).toBeLessThan(
			source.indexOf('`call "${vcvarsAll}"'),
		);
	});
	it("invalidates an old build tree whose include dependencies were misdecoded", () => {
		expect(source).toContain('".toolchain-encoding"');
		expect(source).toContain('const TOOLCHAIN_ENCODING = "utf8-v1"');
		expect(source).toContain("previousEncoding !== TOOLCHAIN_ENCODING");
		expect(source).toContain("fs.writeFileSync(ENCODING_STAMP, TOOLCHAIN_ENCODING)");
	});
});
