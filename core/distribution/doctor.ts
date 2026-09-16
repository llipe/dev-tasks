/**
 * Doctor checks — validate environment prerequisites.
 * Checks: Node >= 24, git >= 2.37, cache dir writable, version skew.
 */

import { mkdir, writeFile, rm, readdir, readFile } from "node:fs/promises";
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

const MIN_NODE_MAJOR = 24;
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
 * Check Node.js version >= 24.
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
 * Check that every `.claude/hooks/*.sh` script is wired into a `PreToolUse`
 * entry in `.claude/settings.json`.
 *
 * `.claude/settings.json` is delivered with install-if-absent semantics
 * (docs/adr/ADR-006-claude-settings-ownership.md): it is never force-synced
 * to match newly shipped hook scripts, so a repo can legitimately end up with
 * hook scripts on disk that nothing wires. This check surfaces that drift by
 * name instead of leaving the hooks silently inert.
 */
export async function checkClaudeHooksWiring(repoRoot: string): Promise<DoctorCheck> {
  const hooksDir = join(repoRoot, ".claude", "hooks");
  let scripts: string[] = [];
  try {
    const entries = await readdir(hooksDir, { withFileTypes: true });
    scripts = entries
      .filter((e) => e.isFile() && e.name.endsWith(".sh"))
      .map((e) => e.name)
      .sort();
  } catch {
    scripts = [];
  }

  if (scripts.length === 0) {
    return {
      name: "claude-hooks-wiring",
      pass: true,
      message: "No .claude/hooks/*.sh scripts found; nothing to wire.",
    };
  }

  const settingsPath = join(repoRoot, ".claude", "settings.json");
  let settingsRaw: string;
  try {
    settingsRaw = await readFile(settingsPath, "utf-8");
  } catch {
    return {
      name: "claude-hooks-wiring",
      pass: false,
      message: `.claude/settings.json is missing; unwired hook script(s): ${scripts.join(", ")}`,
    };
  }

  let wiredCommands: string;
  try {
    const parsed = JSON.parse(settingsRaw) as {
      hooks?: { PreToolUse?: Array<{ hooks?: Array<{ command?: string }> }> };
    };
    const preToolUse = parsed.hooks?.PreToolUse ?? [];
    wiredCommands = preToolUse
      .flatMap((entry) => entry.hooks ?? [])
      .map((h) => h.command ?? "")
      .join("\n");
  } catch {
    return {
      name: "claude-hooks-wiring",
      pass: false,
      message: `.claude/settings.json is not valid JSON; cannot verify hook wiring for: ${scripts.join(", ")}`,
    };
  }

  const unwired = scripts.filter((script) => !wiredCommands.includes(script));

  if (unwired.length > 0) {
    return {
      name: "claude-hooks-wiring",
      pass: false,
      message: `Unwired hook script(s) in .claude/hooks not referenced by any PreToolUse entry in .claude/settings.json: ${unwired.join(", ")}`,
    };
  }

  return {
    name: "claude-hooks-wiring",
    pass: true,
    message: `All .claude/hooks/*.sh scripts (${scripts.join(", ")}) are wired in .claude/settings.json PreToolUse`,
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
    await checkClaudeHooksWiring(repoRoot),
  ];

  return checks;
}
