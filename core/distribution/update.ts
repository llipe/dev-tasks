/**
 * Update command logic — reconcile all managed files against the package.
 * Uses the generic reconcile engine from core/reconcile.ts.
 * Works across all platform profiles (copilot, claude, kiro).
 *
 * When a pin is set and differs from the local package version, fetches the
 * pinned version from npm and reconciles against that instead.
 *
 * Additionally discovers new files added to the package that are not yet
 * tracked in the consumer's manifest, and installs them.
 */

import { readFile, readdir, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { hashFile, hashContent } from "./hash.js";
import { readManifest, writeManifest, type Manifest, type ManagedFileEntry } from "./manifest.js";
import { readPin } from "./pin.js";
import { reconcile, type ReconcileAction } from "../reconcile.js";
import { createBackupDir, backupFile } from "./backup.js";
import { fetchPackageVersion } from "./fetch-package.js";
import {
  PROFILE_PATHS,
  ROOT_FILES,
  ROOT_PROFILE_TAG,
  type Platform,
  type ManagedPath,
} from "./profiles.js";
import { runMigration } from "./migrate.js";

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
  /** Whether an auto-migration was performed (manifest was missing but managed files existed) */
  autoMigrated: boolean;
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
  let manifest = await readManifest(targetDir);
  let autoMigrated = false;

  if (!manifest) {
    // Attempt auto-migration: detect managed files without a manifest and
    // create one so the update can proceed with discovery of new/changed files.
    const migration = await runMigration(targetDir);
    if (migration.manifestWritten) {
      manifest = await readManifest(targetDir);
      autoMigrated = true;
    }
  }

  if (!manifest) {
    return {
      conflicts: [],
      updated: [],
      installed: [],
      skipped: [],
      backupDir: null,
      resolvedVersion: version,
      fetched: false,
      autoMigrated: false,
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
    return { ...result, resolvedVersion: effectiveVersion, fetched, autoMigrated };
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
async function runReconciliation(
  input: ReconcileInput,
): Promise<Omit<UpdateResult, "resolvedVersion" | "fetched" | "autoMigrated">> {
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

  // Discover new files in the package that are not yet tracked in the manifest.
  // This handles the case where a newer package version adds new agent/skill files.
  const trackedPaths = new Set(manifest.files.map((f) => f.path));
  const profilesInManifest = new Set(manifest.files.map((f) => f.profile));

  // Determine which platforms to scan based on what's already installed
  const platformsToScan: Platform[] = [];
  if (profilesInManifest.has("copilot")) platformsToScan.push("copilot");
  if (profilesInManifest.has("claude")) platformsToScan.push("claude");
  if (profilesInManifest.has("kiro")) platformsToScan.push("kiro");

  // Scan each platform's managed paths for untracked files
  for (const platform of platformsToScan) {
    const paths = PROFILE_PATHS[platform];
    for (const managedPath of paths) {
      const newFiles = await discoverNewFiles(sourceDir, managedPath, trackedPaths);
      for (const relFile of newFiles) {
        const fullRelPath = join(managedPath.target, relFile);
        const sourcePath = join(sourceDir, managedPath.source, relFile);
        const localPath = join(targetDir, fullRelPath);

        const content = await readFile(sourcePath, "utf-8");
        const packageHash = hashContent(content);

        await mkdir(dirname(localPath), { recursive: true });
        await writeFile(localPath, content, "utf-8");

        const fileResult: UpdateFileResult = {
          path: fullRelPath,
          profile: platform,
          action: "install",
          localHash: null,
          originHash: packageHash,
          packageHash,
        };
        installed.push(fileResult);
      }
    }
  }

  // Scan root files if the manifest has any platform entries (root files are profile-agnostic)
  if (profilesInManifest.size > 0) {
    for (const rootFile of ROOT_FILES) {
      if (trackedPaths.has(rootFile)) continue;
      const sourcePath = join(sourceDir, rootFile);
      if (!(await fileExists(sourcePath))) continue;

      const content = await readFile(sourcePath, "utf-8");
      const packageHash = hashContent(content);
      const localPath = join(targetDir, rootFile);

      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, content, "utf-8");

      const fileResult: UpdateFileResult = {
        path: rootFile,
        profile: ROOT_PROFILE_TAG,
        action: "install",
        localHash: null,
        originHash: packageHash,
        packageHash,
      };
      installed.push(fileResult);
    }
  }

  // Update manifest with new hashes for installed/updated files, and add newly discovered files
  if (installed.length > 0 || updated.length > 0) {
    // Build the new entries for discovered files (those not in the original manifest)
    const newEntries: ManagedFileEntry[] = installed
      .filter((r) => !trackedPaths.has(r.path))
      .map((r) => ({
        path: r.path,
        profile: r.profile,
        sha256: r.packageHash,
        origin_sha256: r.packageHash,
      }));

    const updatedManifest: Manifest = {
      ...manifest,
      version,
      installed_at: new Date().toISOString(),
      files: [
        ...manifest.files.map((entry) => {
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
        ...newEntries,
      ],
    };
    await writeManifest(targetDir, updatedManifest);
  }

  return { conflicts, updated, installed, skipped, backupDir };
}

/**
 * Recursively collect all files under a directory, returning paths relative to baseDir.
 */
async function collectFilesRecursive(dir: string, baseDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesRecursive(fullPath, baseDir)));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

/**
 * Discover files in a managed path that are not yet tracked in the manifest.
 * Returns relative paths within the managed path's source directory.
 */
async function discoverNewFiles(
  sourceDir: string,
  managedPath: ManagedPath,
  trackedPaths: Set<string>,
): Promise<string[]> {
  const fullSourceDir = join(sourceDir, managedPath.source);
  let relFiles: string[];

  if (managedPath.recursive) {
    relFiles = await collectFilesRecursive(fullSourceDir, fullSourceDir);
  } else {
    let entries;
    try {
      entries = await readdir(fullSourceDir, { withFileTypes: true });
    } catch {
      return [];
    }
    relFiles = entries.filter((e) => e.isFile()).map((e) => e.name);
  }

  // Filter to files not already tracked
  return relFiles.filter((relFile) => {
    const fullRelPath = join(managedPath.target, relFile);
    return !trackedPaths.has(fullRelPath);
  });
}
