/**
 * Doctor checks — validate environment prerequisites.
 * Checks: Node >= 20, git >= 2.37, cache dir writable, version skew.
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { readManifest } from "./manifest.js";
import { readPin } from "./pin.js";

export interface DoctorCheck {
  name: string;
  pass: boolean;
  message: string;
}

export interface DoctorOptions {
  repoRoot: string;
  cacheDir?: string;
}

const MIN_NODE_MAJOR = 20;
const MIN_GIT_MAJOR = 2;
const MIN_GIT_MINOR = 37;

/**
 * Parse a semver-like version string into major.minor.patch.
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Check Node.js version >= 20.
 */
export function checkNodeVersion(versionStr?: string): DoctorCheck {
  const version = versionStr ?? process.version;
  const parsed = parseSemver(version);

  if (!parsed || parsed.major < MIN_NODE_MAJOR) {
    return {
      name: "node-version",
      pass: false,
      message: `Node.js >= ${MIN_NODE_MAJOR} required. Found: ${version}`,
    };
  }

  return {
    name: "node-version",
    pass: true,
    message: `Node.js ${version} (>= ${MIN_NODE_MAJOR} required)`,
  };
}

/**
 * Check git version >= 2.37.
 */
export function checkGitVersion(versionStr?: string): DoctorCheck {
  let version: string;
  if (versionStr) {
    version = versionStr;
  } else {
    try {
      version = execSync("git --version", { encoding: "utf-8" }).trim();
    } catch {
      return {
        name: "git-version",
        pass: false,
        message: "git is not installed or not accessible",
      };
    }
  }

  const parsed = parseSemver(version);
  if (
    !parsed ||
    parsed.major < MIN_GIT_MAJOR ||
    (parsed.major === MIN_GIT_MAJOR && parsed.minor < MIN_GIT_MINOR)
  ) {
    return {
      name: "git-version",
      pass: false,
      message: `git >= ${MIN_GIT_MAJOR}.${MIN_GIT_MINOR} required. Found: ${version}`,
    };
  }

  return {
    name: "git-version",
    pass: true,
    message: `${version} (>= ${MIN_GIT_MAJOR}.${MIN_GIT_MINOR} required)`,
  };
}

/**
 * Check that the cache directory exists and is writable.
 * Creates the directory if it does not exist.
 */
export async function checkCacheDir(cacheDir?: string): Promise<DoctorCheck> {
  const dir = cacheDir ?? getDefaultCacheDir();

  try {
    await mkdir(dir, { recursive: true });
    // Write a probe file to test writability
    const probe = join(dir, ".dev-tasks-probe");
    await writeFile(probe, "probe", "utf-8");
    await rm(probe);
    return {
      name: "cache-dir",
      pass: true,
      message: `Cache directory writable: ${dir}`,
    };
  } catch {
    return {
      name: "cache-dir",
      pass: false,
      message: `Cache directory not writable: ${dir}`,
    };
  }
}

/**
 * Check for version skew: installed version vs. pinned version.
 */
export function checkVersionSkew(installed: string | null, pinned: string | null): DoctorCheck {
  if (pinned === null || installed === null) {
    return {
      name: "version-skew",
      pass: true,
      message: pinned === null ? "No version pin set" : "Not installed yet",
    };
  }

  if (installed === pinned) {
    return {
      name: "version-skew",
      pass: true,
      message: `Installed ${installed} matches pin ${pinned}`,
    };
  }

  return {
    name: "version-skew",
    pass: false,
    message: `Version skew: installed ${installed} != pinned ${pinned}`,
  };
}

/**
 * Get the default cache directory.
 * Uses $XDG_CACHE_HOME/dev-tasks or ~/.cache/dev-tasks.
 */
function getDefaultCacheDir(): string {
  const xdg = process.env["XDG_CACHE_HOME"];
  if (xdg) return join(xdg, "dev-tasks");
  const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "/tmp";
  return join(home, ".cache", "dev-tasks");
}

/**
 * Run all doctor checks.
 */
export async function runDoctor(options: DoctorOptions): Promise<DoctorCheck[]> {
  const { repoRoot, cacheDir } = options;

  const manifest = await readManifest(repoRoot);
  const pinned = await readPin(repoRoot);
  const installed = manifest?.version ?? null;

  const checks: DoctorCheck[] = [
    checkNodeVersion(),
    checkGitVersion(),
    await checkCacheDir(cacheDir),
    checkVersionSkew(installed, pinned),
  ];

  return checks;
}
