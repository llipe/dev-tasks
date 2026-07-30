/**
 * Legacy migration shim — detects installs driven by the old dev-tasks.sh
 * script and generates a manifest marking all files as `modified: unknown`.
 *
 * When origin_sha256 is set to the "unknown" sentinel, the reconciliation
 * engine (core/reconcile.ts) will always produce a "conflict" action because
 * localHash !== originHash. This forces users to explicitly review and accept
 * updates on their first `dev-tasks update` after migration.
 */

import { existsSync, statSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { hashContent } from "./hash.js";
import { writeManifest, readManifest, type Manifest, type ManagedFileEntry } from "./manifest.js";

/**
 * Sentinel value for origin_sha256 indicating the original hash is unknown.
 * This value can never be a valid SHA-256 hash (which would be 64 hex chars),
 * so it guarantees a conflict on the first reconciliation pass.
 */
export const UNKNOWN_ORIGIN = "unknown";

/**
 * Known locations where the legacy dev-tasks.sh installed skill files.
 */
const LEGACY_MANAGED_DIRS = [
  ".github/agents",
  ".github/skills",
  ".github/instructions",
  ".github/instructions/domain",
  ".github/prompts",
  ".claude/agents",
  ".claude/skills",
  ".claude/commands",
  ".claude/hooks",
  ".kiro/agents",
  ".kiro/skills",
  ".kiro/steering",
  ".kiro/hooks",
];

export interface LegacyDetectionResult {
  isLegacy: boolean;
  reason: string;
  indicators: string[];
}

export interface MigrationResult {
  success: boolean;
  manifestWritten: boolean;
  reason: string;
  filesDiscovered: number;
}

/**
 * Detect whether the given repo root has a legacy install
 * driven by the old dev-tasks.sh script.
 *
 * Legacy indicators:
 * - Has `.dev-tasks-version` file (old version marker)
 * - Has `.dev-tasks/` directory but NO `manifest.json` inside it
 */
export function detectLegacyInstall(repoRoot: string): LegacyDetectionResult {
  const indicators: string[] = [];

  // Check for existing new-format manifest — if present, already migrated
  const manifestPath = join(repoRoot, ".dev-tasks", "manifest.json");
  if (existsSync(manifestPath)) {
    return { isLegacy: false, reason: "manifest.json already exists", indicators: [] };
  }

  // Check for .dev-tasks-version (legacy version marker)
  const versionFilePath = join(repoRoot, ".dev-tasks-version");
  if (existsSync(versionFilePath)) {
    indicators.push(".dev-tasks-version file exists");
  }

  // Check for .dev-tasks/ directory without manifest.json
  const devTasksDir = join(repoRoot, ".dev-tasks");
  if (existsSync(devTasksDir)) {
    try {
      const stat = statSync(devTasksDir);
      if (stat.isDirectory()) {
        indicators.push(".dev-tasks/ exists with no manifest.json");
      }
    } catch {
      // Ignore stat errors
    }
  }

  if (indicators.length > 0) {
    return {
      isLegacy: true,
      reason: indicators.join("; "),
      indicators,
    };
  }

  return { isLegacy: false, reason: "no legacy indicators found", indicators: [] };
}

/**
 * Recursively collect all files under a directory.
 * Returns paths relative to the repo root.
 */
async function collectFilesInDir(dir: string, baseDir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectFilesInDir(fullPath, baseDir)));
      } else {
        files.push(relative(baseDir, fullPath));
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable — skip
  }
  return files;
}

/**
 * Discover all legacy-managed files in the repo by scanning known locations.
 */
async function discoverLegacyFiles(repoRoot: string): Promise<string[]> {
  const allFiles: string[] = [];

  for (const dir of LEGACY_MANAGED_DIRS) {
    const fullDir = join(repoRoot, dir);
    const files = await collectFilesInDir(fullDir, repoRoot);
    allFiles.push(...files);
  }

  return allFiles;
}

/**
 * Generate a migration manifest from legacy state.
 * Computes hashes of all specified files and marks them with origin_sha256 = UNKNOWN_ORIGIN.
 *
 * @param repoRoot - The repo root directory
 * @param filePaths - Relative file paths to include in the manifest
 */
export async function generateMigrationManifest(
  repoRoot: string,
  filePaths: string[],
): Promise<Manifest> {
  const files: ManagedFileEntry[] = [];

  for (const relPath of filePaths) {
    const fullPath = join(repoRoot, relPath);
    try {
      const content = await readFile(fullPath, "utf-8");
      const sha256 = hashContent(content);

      // Infer profile from path prefix
      let profile = "legacy";
      if (relPath.startsWith(".github/")) profile = "copilot";
      else if (relPath.startsWith(".claude/")) profile = "claude";
      else if (relPath.startsWith(".kiro/")) profile = "kiro";

      files.push({
        path: relPath,
        profile,
        sha256,
        origin_sha256: UNKNOWN_ORIGIN,
      });
    } catch {
      // File unreadable — skip
    }
  }

  return {
    version: "migrated",
    pinned: "latest",
    installed_at: new Date().toISOString(),
    files,
    extraction: {},
  };
}

/**
 * Run the full migration process:
 * 1. Detect legacy install
 * 2. Discover legacy files
 * 3. Generate manifest with UNKNOWN_ORIGIN (files stay at native paths)
 * 4. Write manifest
 *
 * Files remain at their platform-native paths (.github/, .claude/, .kiro/).
 * The manifest marks them with origin_sha256 = UNKNOWN_ORIGIN so the
 * reconciliation engine reports conflicts on the first update.
 */
export async function runMigration(repoRoot: string): Promise<MigrationResult> {
  // Check if already migrated
  const existing = await readManifest(repoRoot);
  if (existing) {
    return {
      success: true,
      manifestWritten: false,
      reason: "not a legacy install — manifest already exists",
      filesDiscovered: 0,
    };
  }

  // Detect legacy
  const detection = detectLegacyInstall(repoRoot);
  if (!detection.isLegacy) {
    return {
      success: true,
      manifestWritten: false,
      reason: "not a legacy install — no legacy indicators found",
      filesDiscovered: 0,
    };
  }

  // Discover all files in known legacy locations
  const files = await discoverLegacyFiles(repoRoot);

  // Generate manifest — files stay at native paths, no copying needed
  const manifest = await generateMigrationManifest(repoRoot, files);

  // Write manifest
  await writeManifest(repoRoot, manifest);

  return {
    success: true,
    manifestWritten: true,
    reason: `migrated ${files.length} file(s) from legacy install`,
    filesDiscovered: files.length,
  };
}
