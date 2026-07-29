/**
 * Update command logic — reconcile each installed skill file against the package.
 * Uses the generic reconcile engine from core/reconcile.ts.
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { hashFile } from "./hash.js";
import { readManifest, writeManifest, type Manifest } from "./manifest.js";
import { reconcile, type ReconcileAction } from "../reconcile.js";
import { createBackupDir, backupFile } from "./backup.js";

export interface UpdateFileResult {
  path: string;
  action: ReconcileAction;
  localHash: string | null;
  originHash: string;
  packageHash: string;
}

export interface UpdateResult {
  conflicts: UpdateFileResult[];
  updated: UpdateFileResult[];
  installed: UpdateFileResult[];
  skipped: UpdateFileResult[];
  backupDir: string | null;
}

export interface UpdateOptions {
  /** Path to the target repo root (where .dev-tasks/ lives) */
  targetDir: string;
  /** Path to the package source directory (contains skills/) */
  sourceDir: string;
  /** Whether to force-overwrite conflicting files (backs them up first) */
  force: boolean;
  /** Current package version */
  version: string;
}

/**
 * Check if a file exists.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run the update reconciliation for all skills in the manifest.
 *
 * For each skill file:
 * 1. Compute localHash from the installed file (null if missing)
 * 2. Read originHash from the manifest
 * 3. Compute packageHash from the package source
 * 4. Call reconcile() to determine the action
 * 5. Execute the action (install/overwrite/skip or report conflict)
 */
export async function runUpdate(options: UpdateOptions): Promise<UpdateResult> {
  const { targetDir, sourceDir, force, version } = options;
  const manifest = await readManifest(targetDir);

  if (!manifest) {
    return {
      conflicts: [],
      updated: [],
      installed: [],
      skipped: [],
      backupDir: null,
    };
  }

  const skillsTargetDir = join(targetDir, ".dev-tasks", "skills");
  const skillsSourceDir = join(sourceDir, "skills");

  const conflicts: UpdateFileResult[] = [];
  const updated: UpdateFileResult[] = [];
  const installed: UpdateFileResult[] = [];
  const skipped: UpdateFileResult[] = [];
  let backupDir: string | null = null;

  // Process each skill entry from the manifest
  for (const entry of manifest.skills) {
    const localPath = join(skillsTargetDir, entry.path);
    const packagePath = join(skillsSourceDir, entry.path);

    // Compute local hash (null if file doesn't exist)
    let localHash: string | null = null;
    if (await fileExists(localPath)) {
      localHash = await hashFile(localPath);
    }

    // Compute package hash — if the package file doesn't exist, skip this entry
    let packageHash: string;
    try {
      packageHash = await hashFile(packagePath);
    } catch {
      // Package file doesn't exist (skill removed from package?) — skip
      skipped.push({
        path: entry.path,
        action: "skip",
        localHash,
        originHash: entry.origin_sha256,
        packageHash: entry.origin_sha256,
      });
      continue;
    }

    const action = reconcile(localHash, entry.origin_sha256, packageHash);
    const fileResult: UpdateFileResult = {
      path: entry.path,
      action,
      localHash,
      originHash: entry.origin_sha256,
      packageHash,
    };

    switch (action) {
      case "install": {
        // File doesn't exist locally — copy from package
        const destPath = join(skillsTargetDir, entry.path);
        await mkdir(dirname(destPath), { recursive: true });
        const content = await readFile(packagePath, "utf-8");
        await writeFile(destPath, content, "utf-8");
        installed.push(fileResult);
        break;
      }

      case "overwrite": {
        // User hasn't edited — safe to overwrite
        const destPath = join(skillsTargetDir, entry.path);
        const content = await readFile(packagePath, "utf-8");
        await writeFile(destPath, content, "utf-8");
        updated.push(fileResult);
        break;
      }

      case "skip": {
        skipped.push(fileResult);
        break;
      }

      case "conflict": {
        if (force) {
          // Back up the conflicting file, then overwrite
          if (!backupDir) {
            backupDir = await createBackupDir(targetDir);
          }
          await backupFile(backupDir, localPath, entry.path);
          const destPath = join(skillsTargetDir, entry.path);
          const content = await readFile(packagePath, "utf-8");
          await writeFile(destPath, content, "utf-8");
          updated.push({ ...fileResult, action: "overwrite" });
        } else {
          conflicts.push(fileResult);
        }
        break;
      }
    }
  }

  // Update manifest with new hashes for installed/updated files
  if (installed.length > 0 || updated.length > 0) {
    const updatedManifest: Manifest = {
      ...manifest,
      version,
      installed_at: new Date().toISOString(),
      skills: manifest.skills.map((entry) => {
        const installedResult = [...installed, ...updated].find((r) => r.path === entry.path);
        if (installedResult) {
          return {
            ...entry,
            sha256: installedResult.packageHash,
            origin_sha256: installedResult.packageHash,
          };
        }
        return entry;
      }),
    };
    await writeManifest(targetDir, updatedManifest);
  }

  return { conflicts, updated, installed, skipped, backupDir };
}
