import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { APP_ID, PRODUCT_NAME } from "../src/config/product";
import {
	APP_DATA_OVERRIDE_ENV,
	type IdentityHost,
	initializeAppIdentity,
	profilePaths,
	validateAppDataOverride,
} from "./app-identity";

describe("fork application identity", () => {
	it("isolates packaged and development profiles from both upstream names", () => {
		const root = path.join("test", "app-data");
		const packaged = profilePaths(root, true);
		const development = profilePaths(root, false);
		expect(packaged.userData).toBe(path.join(root, PRODUCT_NAME));
		expect(development.userData).not.toBe(packaged.userData);
		for (const profile of [packaged, development]) {
			expect(profile.userData).not.toBe(path.join(root, "openscreen"));
			expect(profile.userData).not.toBe(path.join(root, "Openscreen"));
			expect(profile.sessionData).toBe(path.join(profile.userData, "chromium"));
		}
	});

	it("creates paths before registering them and sets the Windows taskbar identity", () => {
		const events: string[] = [];
		const host: IdentityHost = {
			isPackaged: true,
			getPath: vi.fn(() => "app-data"),
			setName: vi.fn(),
			setPath: vi.fn((name: string) => events.push(`set:${name}`)),
			setAppUserModelId: vi.fn(),
		};
		initializeAppIdentity(host, () => events.push("mkdir"), "win32");
		expect(events).toEqual(["mkdir", "mkdir", "set:userData", "set:sessionData"]);
		expect(host.setName).toHaveBeenCalledWith(PRODUCT_NAME);
		expect(host.setAppUserModelId).toHaveBeenCalledWith(APP_ID);
	});

	it("does not call Windows-only APIs on Linux or macOS", () => {
		for (const platform of ["linux", "darwin"] as const) {
			const host: IdentityHost = {
				isPackaged: false,
				getPath: () => "app-data",
				setName: vi.fn(),
				setPath: vi.fn(),
				setAppUserModelId: vi.fn(),
			};
			initializeAppIdentity(host, vi.fn(), platform);
			expect(host.setAppUserModelId).not.toHaveBeenCalled();
		}
	});

	describe("validateAppDataOverride", () => {
		it("defines canonical environment variable name", () => {
			expect(APP_DATA_OVERRIDE_ENV).toBe("OPENSCREEN_APP_DATA_DIR");
		});

		it("accepts valid fully qualified Windows absolute paths", () => {
			expect(validateAppDataOverride("C:\\custom\\appdata", "win32")).toBe("C:\\custom\\appdata");
			expect(validateAppDataOverride("C:/custom/appdata", "win32")).toBe("C:\\custom\\appdata");
			expect(validateAppDataOverride("d:\\my-profile", "win32")).toBe("d:\\my-profile");
			expect(validateAppDataOverride("\\\\server\\share\\profile", "win32")).toBe(
				"\\\\server\\share\\profile",
			);
			expect(validateAppDataOverride("//server/share/profile", "win32")).toBe(
				"\\\\server\\share\\profile",
			);
		});

		it("rejects invalid, relative, or drive-dependent Windows paths", () => {
			// Drive-relative without slash
			expect(() => validateAppDataOverride("C:foo", "win32")).toThrow(
				/must be a fully qualified absolute path on Windows/,
			);
			// Drive-relative root (single backslash or forward slash)
			expect(() => validateAppDataOverride("\\foo\\bar", "win32")).toThrow(
				/must be a fully qualified absolute path on Windows/,
			);
			expect(() => validateAppDataOverride("/foo/bar", "win32")).toThrow(
				/must be a fully qualified absolute path on Windows/,
			);
			// Relative paths
			expect(() => validateAppDataOverride("foo\\bar", "win32")).toThrow(
				/must be a fully qualified absolute path on Windows/,
			);
			expect(() => validateAppDataOverride(".\\foo", "win32")).toThrow(
				/must be a fully qualified absolute path on Windows/,
			);
			expect(() => validateAppDataOverride("..\\foo", "win32")).toThrow(
				/must be a fully qualified absolute path on Windows/,
			);
		});

		it("accepts valid POSIX absolute paths and rejects relative ones", () => {
			expect(validateAppDataOverride("/var/tmp/appdata", "linux")).toBe("/var/tmp/appdata");
			expect(validateAppDataOverride("/tmp/../var/appdata", "linux")).toBe("/var/appdata");
			expect(() => validateAppDataOverride("var/tmp/appdata", "linux")).toThrow(
				/must be an absolute path/,
			);
			expect(() => validateAppDataOverride("./var/tmp", "linux")).toThrow(
				/must be an absolute path/,
			);
			expect(() => validateAppDataOverride("C:\\foo", "linux")).toThrow(/must be an absolute path/);
		});

		it("rejects empty or whitespace-only paths on all platforms", () => {
			for (const platform of ["win32", "linux", "darwin"] as const) {
				expect(() => validateAppDataOverride("", platform)).toThrow(
					/cannot be empty or whitespace/,
				);
				expect(() => validateAppDataOverride("   ", platform)).toThrow(
					/cannot be empty or whitespace/,
				);
				expect(() => validateAppDataOverride("\t\r\n", platform)).toThrow(
					/cannot be empty or whitespace/,
				);
			}
		});
	});

	describe("OPENSCREEN_APP_DATA_DIR override in initializeAppIdentity", () => {
		it("preserves default behavior without mutating appData when override is absent", () => {
			for (const override of [undefined, null]) {
				const events: string[] = [];
				const host: IdentityHost = {
					isPackaged: true,
					getPath: vi.fn(() => "default-app-data"),
					setName: vi.fn(),
					setPath: vi.fn((name: string) => events.push(`set:${name}`)),
					setAppUserModelId: vi.fn(),
				};
				const paths = initializeAppIdentity(host, () => events.push("mkdir"), "win32", override);
				expect(events).toEqual(["mkdir", "mkdir", "set:userData", "set:sessionData"]);
				expect(host.setPath).not.toHaveBeenCalledWith("appData", expect.anything());
				expect(paths.userData).toBe(path.join("default-app-data", PRODUCT_NAME));
			}
		});

		it("applies valid override: creates root, sets appData, and derives userData/sessionData", () => {
			let currentAppData = "os-default-appdata";
			const events: string[] = [];
			const host: IdentityHost = {
				isPackaged: true,
				getPath: vi.fn(() => currentAppData),
				setName: vi.fn(),
				setPath: vi.fn((name: string, value: string) => {
					events.push(`set:${name}:${value}`);
					if (name === "appData") currentAppData = value;
				}),
				setAppUserModelId: vi.fn(),
			};
			const dirsCreated: string[] = [];
			const ensureDirectory = (dir: string) => {
				dirsCreated.push(dir);
				events.push(`mkdir:${dir}`);
			};

			const overridePath =
				process.platform === "win32"
					? "C:\\isolated-profile\\test-run"
					: "/tmp/isolated-profile/test-run";
			const expectedUserData = path.join(overridePath, PRODUCT_NAME);
			const expectedSessionData = path.join(expectedUserData, "chromium");

			const paths = initializeAppIdentity(host, ensureDirectory, process.platform, overridePath);

			// Order must be: mkdir root -> set appData -> mkdir userData -> mkdir sessionData -> set userData -> set sessionData
			expect(dirsCreated).toEqual([overridePath, expectedUserData, expectedSessionData]);
			expect(events).toEqual([
				`mkdir:${overridePath}`,
				`set:appData:${overridePath}`,
				`mkdir:${expectedUserData}`,
				`mkdir:${expectedSessionData}`,
				`set:userData:${expectedUserData}`,
				`set:sessionData:${expectedSessionData}`,
			]);
			expect(paths.userData).toBe(expectedUserData);
			expect(paths.sessionData).toBe(expectedSessionData);
		});

		it("applies valid override on dev mode: derives dev profile correctly", () => {
			let currentAppData = "default-appdata";
			const host: IdentityHost = {
				isPackaged: false,
				getPath: vi.fn(() => currentAppData),
				setName: vi.fn(),
				setPath: vi.fn((name: string, value: string) => {
					if (name === "appData") currentAppData = value;
				}),
				setAppUserModelId: vi.fn(),
			};
			const dirsCreated: string[] = [];
			const root =
				process.platform === "win32" ? "C:\\isolated-profile\\dev" : "/tmp/isolated-profile/dev";
			const paths = initializeAppIdentity(host, (d) => dirsCreated.push(d), process.platform, root);

			const expectedUserData = path.join(root, `${PRODUCT_NAME}-dev`);
			const expectedSessionData = path.join(expectedUserData, "chromium");
			expect(dirsCreated).toEqual([root, expectedUserData, expectedSessionData]);
			expect(paths.userData).toBe(expectedUserData);
			expect(paths.sessionData).toBe(expectedSessionData);
		});

		it("rejects invalid override without mutating host or creating directories", () => {
			const host: IdentityHost = {
				isPackaged: true,
				getPath: vi.fn(() => "default-app-data"),
				setName: vi.fn(),
				setPath: vi.fn(),
				setAppUserModelId: vi.fn(),
			};
			const ensureDirectory = vi.fn();

			// Test Windows invalid paths specifically with "win32" platform
			expect(() =>
				initializeAppIdentity(host, ensureDirectory, "win32", "relative\\path"),
			).toThrow();
			expect(() => initializeAppIdentity(host, ensureDirectory, "win32", "C:foo")).toThrow();
			expect(() => initializeAppIdentity(host, ensureDirectory, "win32", "/foo")).toThrow();
			expect(() => initializeAppIdentity(host, ensureDirectory, "win32", "\\foo")).toThrow();
			expect(() => initializeAppIdentity(host, ensureDirectory, "win32", "   ")).toThrow();

			// Test POSIX invalid paths specifically with "linux" platform
			expect(() =>
				initializeAppIdentity(host, ensureDirectory, "linux", "relative/path"),
			).toThrow();
			expect(() => initializeAppIdentity(host, ensureDirectory, "linux", "./tmp")).toThrow();
			expect(() => initializeAppIdentity(host, ensureDirectory, "linux", "")).toThrow();

			expect(ensureDirectory).not.toHaveBeenCalled();
			expect(host.getPath).not.toHaveBeenCalled();
			expect(host.setPath).not.toHaveBeenCalled();
			expect(host.setName).not.toHaveBeenCalled();
		});

		it("fails explicitly without fallback or setters when host.setPath('appData') throws", () => {
			const defaultAppData = "os-default-appdata";
			const host: IdentityHost = {
				isPackaged: true,
				getPath: vi.fn(() => defaultAppData),
				setName: vi.fn(),
				setPath: vi.fn((name: string) => {
					if (name === "appData") {
						throw new Error("Failed to set appData path");
					}
				}),
				setAppUserModelId: vi.fn(),
			};
			const validRoot =
				process.platform === "win32" ? "C:\\isolated-profile" : "/tmp/isolated-profile";
			const ensureDirectory = vi.fn();

			expect(() =>
				initializeAppIdentity(host, ensureDirectory, process.platform, validRoot),
			).toThrow("Failed to set appData path");

			expect(ensureDirectory).toHaveBeenCalledWith(validRoot);
			// Must not call getPath as fallback
			expect(host.getPath).not.toHaveBeenCalled();
			// Must not call userData or sessionData setters
			expect(host.setPath).not.toHaveBeenCalledWith("userData", expect.anything());
			expect(host.setPath).not.toHaveBeenCalledWith("sessionData", expect.anything());
			expect(host.setName).not.toHaveBeenCalled();
		});

		it("fails explicitly without fallback when root mkdir throws", () => {
			const host: IdentityHost = {
				isPackaged: true,
				getPath: vi.fn(() => "default-app-data"),
				setName: vi.fn(),
				setPath: vi.fn(),
				setAppUserModelId: vi.fn(),
			};
			const validRoot = process.platform === "win32" ? "C:\\forbidden" : "/forbidden";
			const ioError = new Error(`EACCES: permission denied, mkdir '${validRoot}'`);
			const ensureDirectory = vi.fn((dir: string) => {
				if (dir === validRoot) throw ioError;
			});

			expect(() =>
				initializeAppIdentity(host, ensureDirectory, process.platform, validRoot),
			).toThrow(ioError);

			// Must not fall back: host getPath/setPath must not be called
			expect(host.getPath).not.toHaveBeenCalled();
			expect(host.setPath).not.toHaveBeenCalled();
			expect(host.setName).not.toHaveBeenCalled();
		});
	});
});
