/**
 * Install-if-absent delivery — shared by `install` and `update`.
 *
 * Files registered in `INSTALL_IF_ABSENT_FILES` (currently only
 * `.claude/settings.json`) are written to the target repo only when the
 * target path does not already exist. Once present — whether written by a
 * prior run of this logic or pre-existing for any other reason — the file is
 * never touched again by either command. This is deliberately stronger than
 * the manifest-tracked reconcile used for standard managed files: a
 * consumer's `permissions.allow` entries and any local hooks must survive
 * both `install` and `update` unconditionally.
 *
 * These files are intentionally NOT recorded in `.dev-tasks/manifest.json`:
 * their source/target relative paths differ (`templates/claude/settings.json`
 * -> `.claude/settings.json`), which the manifest-driven reconcile loop in
 * `update.ts` assumes are identical, and — more importantly — tracking them
 * would eventually subject them to the standard overwrite/conflict
 * reconciliation, which is exactly what this category exists to avoid.
 *
 * See docs/adr/ADR-006-claude-settings-ownership.md.
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  INSTALL_IF_ABSENT_FILES,
  ROOT_PROFILE_TAG,
  type AgnosticTag,
  type Platform,
} from "./profiles.js";

/** A single install-if-absent delivery outcome, for caller reporting. */
export interface InstallIfAbsentResult {
  /** Relative path in the consumer repo (target). */
  path: string;
  /** Relative path inside the package (source) — for caller-side hashing. */
  source: string;
  /** Platform this file belongs to, or `ROOT_PROFILE_TAG` when it belongs to none. */
  profile: Platform | AgnosticTag;
  /** Whether the file was written by this call (false if already present). */
  delivered: boolean;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deliver every install-if-absent file whose platform is in `platforms`,
 * plus every platform-agnostic entry. Writes the target only when it does
 * not already exist; a template missing from the package source (e.g. an
 * older bundle) is skipped silently.
 *
 * An agnostic entry is delivered exactly once per call regardless of how
 * many platforms the profile resolved to — the loop runs once per entry,
 * not once per platform, so "once per run" falls out of the structure
 * rather than needing a seen-set to enforce it.
 */
export async function deliverInstallIfAbsentFiles(
  sourceDir: string,
  targetDir: string,
  platforms: readonly Platform[],
): Promise<InstallIfAbsentResult[]> {
  const platformSet = new Set(platforms);
  const results: InstallIfAbsentResult[] = [];

  for (const file of INSTALL_IF_ABSENT_FILES) {
    if (file.platform !== ROOT_PROFILE_TAG && !platformSet.has(file.platform)) continue;

    const targetPath = join(targetDir, file.target);
    if (await fileExists(targetPath)) {
      results.push({
        path: file.target,
        source: file.source,
        profile: file.platform,
        delivered: false,
      });
      continue;
    }

    const sourcePath = join(sourceDir, file.source);
    let content: string;
    try {
      content = await readFile(sourcePath, "utf-8");
    } catch {
      // Package ships no template for this file — nothing to deliver.
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf-8");
    results.push({
      path: file.target,
      source: file.source,
      profile: file.platform,
      delivered: true,
    });
  }

  return results;
}
