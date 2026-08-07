/**
 * Update command logic — reconcile all managed files against the package.
 * Uses the generic reconcile engine from core/reconcile.ts.
 * Works across all platform profiles (copilot, claude, kiro).
 *
 * When a pin is set and differs from the local package version, fetches the
 * pinned version from npm and reconciles against that instead.
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { hashFile } from "./hash.js";
import { readManifest, writeManifest, type Manifest } from "./manifest.js";
import { readPin } from "./pin.js";
import { reconcile, type ReconcileAction } from "../reconcile.js";
import { createBackupDir, backupFile } from "./backup.js";
import { fetchPackageVersion } from "./fetch-package.js";

export interface UpdateFileResult {
  path: string;
  profile: string;
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
  /** The version that files were reconciled against */
  resolvedVersion: string;
  /** Whether a remote fetch was performed (pin differs from local) */
  fetched: boolean;
}

export interface UpdateOptions {
  /** Path to the target repo root (where .dev-tasks/ lives) */
  targetDir: string;
  /** Path to the package source directory (contains .github/, .claude/, .kiro/) */
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
 * Run the update reconciliation for all managed files in the manifest.
 *
 * If a pin is set (via .dev-tasks/version) and differs from the local package
 * version, fetches the pinned version from npm and reconciles against it.
 *
 * For each managed file:
 * 1. Compute localHash from the installed file (null if missing)
 * 2. Read originHash from the manifest
 * 3. Compute packageHash from the package source (local or fetched)
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
      resolvedVersion: version,
      fetched: false,
    };
  }

  // Determine the effective source: use pinned version if it differs from local
  const pinnedVersion = await readPin(targetDir);
  let effectiveSourceDir = sourceDir;
  let effectiveVersion = version;
  let fetched = false;
  let cleanup: (() => Promise<void>) | null = null;

  if (pinnedVersion && pinnedVersion !== version) {
    const fetchResult = await fetchPackageVersion(pinnedVersion);
    effectiveSourceDir = fetchResult.packageDir;
    effectiveVersion = pinnedVersion;
    fetched = true;
    cleanup = fetchResult.cleanup;
  }

  try {
    const result = await runReconciliation({
      targetDir,
      sourceDir: effectiveSourceDir,
      force,
      version: effectiveVersion,
      manifest,
    });
    return { ...result, resolvedVersion: effectiveVersion, fetched };
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}

interface ReconcileInput {
  targetDir: string;
  sourceDir: string;
  force: boolean;
  version: string;
  manifest: Manifest;
}

/**
 * Core reconciliation logic — extracted to allow cleanup of temp dirs in the caller.
 */
async function runReconciliation(input: ReconcileInput): Promise<Omit<UpdateResult, "resolvedVersion" | "fetched">> {
  const { targetDir, sourceDir, force, version, manifest } = input;

  const conflicts: UpdateFileResult[] = [];
  const updated: UpdateFileResult[] = [];
  const installed: UpdateFileResult[] = [];
  const skipped: UpdateFileResult[] = [];
  let backupDir: string | null = null;

  // Process each managed file entry from the manifest
  for (const entry of manifest.files) {
    // Files are stored at their native platform path in the consumer repo
    const localPath = join(targetDir, entry.path);
    // Source is the same relative path inside the package
    const packagePath = join(sourceDir, entry.path);

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
      // Package file doesn't exist (file removed from package?) — skip
      skipped.push({
        path: entry.path,
        profile: entry.profile,
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
      profile: entry.profile,
      action,
      localHash,
      originHash: entry.origin_sha256,
      packageHash,
    };

    switch (action) {
      case "install": {
        // File doesn't exist locally — copy from package
        await mkdir(dirname(localPath), { recursive: true });
        const content = await readFile(packagePath, "utf-8");
        await writeFile(localPath, content, "utf-8");
        installed.push(fileResult);
        break;
      }

      case "overwrite": {
        // User hasn't edited — safe to overwrite
        const content = await readFile(packagePath, "utf-8");
        await writeFile(localPath, content, "utf-8");
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
          const content = await readFile(packagePath, "utf-8");
          await writeFile(localPath, content, "utf-8");
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
      files: manifest.files.map((entry) => {
        const result = [...installed, ...updated].find((r) => r.path === entry.path);
        if (result) {
          return {
            ...entry,
            sha256: result.packageHash,
            origin_sha256: result.packageHash,
          };
        }
        return entry;
      }),
    };
    await writeManifest(targetDir, updatedManifest);
  }

  return { conflicts, updated, installed, skipped, backupDir };
}
