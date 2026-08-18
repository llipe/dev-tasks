/**
 * Install managed files from the package source into the target repo.
 * Copies platform-specific agent toolkit files, computes hashes, and writes the manifest.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { hashContent } from "./hash.js";
import { readManifest, writeManifest, type Manifest, type ManagedFileEntry } from "./manifest.js";
import {
  resolveProfile,
  PROFILE_PATHS,
  ROOT_FILES,
  ROOT_PROFILE_TAG,
  type Profile,
  type Platform,
  type ManagedPath,
} from "./profiles.js";

export interface InstallOptions {
  /** Path to the package source directory (contains .github/, .claude/, .kiro/) */
  sourceDir: string;
  /** Path to the target repo root */
  targetDir: string;
  /** Current package version being installed */
  version: string;
  /** Version to pin (defaults to version if not provided) */
  pin: string;
  /** Profile to install (default: 'all' = copilot + claude + kiro) */
  profile?: Profile;
}

export interface InstallResult {
  installed: ManagedFileEntry[];
  manifestPath: string;
  platforms: Platform[];
}

/**
 * Recursively collect all files under a directory.
 * Returns paths relative to the given baseDir.
 */
async function collectFiles(dir: string, baseDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, baseDir)));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

/**
 * Collect files from a single managed path entry.
 * If recursive=false, only collects files directly in the directory (one level).
 * If recursive=true, collects all files in subdirectories.
 */
async function collectManagedPathFiles(
  sourceDir: string,
  managedPath: ManagedPath,
): Promise<string[]> {
  const fullSourceDir = join(sourceDir, managedPath.source);

  if (managedPath.recursive) {
    return collectFiles(fullSourceDir, fullSourceDir);
  }

  // Non-recursive: only files directly in the directory
  let entries;
  try {
    entries = await readdir(fullSourceDir, { withFileTypes: true });
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files;
}

/**
 * Install managed files from the package into the target repository.
 * Copies files to their native platform paths (.github/, .claude/, .kiro/),
 * computes sha256 per file, and writes the manifest.
 */
export async function installFiles(options: InstallOptions): Promise<InstallResult> {
  const { sourceDir, targetDir, version, pin, profile = "all" } = options;
  const platforms = resolveProfile(profile);
  const managedFiles: ManagedFileEntry[] = [];

  for (const platform of platforms) {
    const paths = PROFILE_PATHS[platform];

    for (const managedPath of paths) {
      const relFiles = await collectManagedPathFiles(sourceDir, managedPath);

      for (const relFile of relFiles) {
        const sourcePath = join(sourceDir, managedPath.source, relFile);
        const targetPath = join(targetDir, managedPath.target, relFile);

        // Read source content
        const content = await readFile(sourcePath, "utf-8");
        const hash = hashContent(content);

        // Write to target
        const destDir = join(targetPath, "..");
        await mkdir(destDir, { recursive: true });
        await writeFile(targetPath, content, "utf-8");

        // Full relative path in consumer repo
        const fullRelPath = join(managedPath.target, relFile);

        managedFiles.push({
          path: fullRelPath,
          profile: platform,
          sha256: hash,
          origin_sha256: hash,
        });
      }
    }
  }

  // Root files belong to no platform: install once per run, not once per platform.
  for (const relFile of ROOT_FILES) {
    const sourcePath = join(sourceDir, relFile);
    let content: string;
    try {
      content = await readFile(sourcePath, "utf-8");
    } catch {
      // A bundle that ships no root file is valid; skip silently.
      continue;
    }
    const hash = hashContent(content);
    const targetPath = join(targetDir, relFile);
    await mkdir(join(targetPath, ".."), { recursive: true });
    await writeFile(targetPath, content, "utf-8");
    managedFiles.push({
      path: relFile,
      profile: ROOT_PROFILE_TAG,
      sha256: hash,
      origin_sha256: hash,
    });
  }

  const manifest: Manifest = {
    version,
    pinned: pin,
    installed_at: new Date().toISOString(),
    files: managedFiles,
    extraction: {},
  };

  // Merge with existing manifest: preserve files from profiles not being installed
  const existing = await readManifest(targetDir);
  if (existing) {
    // Include the root tag so root entries are replaced, not duplicated.
    const installedProfileSet = new Set<string>([...platforms, ROOT_PROFILE_TAG]);
    const preservedFiles = existing.files.filter((f) => !installedProfileSet.has(f.profile));
    manifest.files = [...preservedFiles, ...managedFiles];
    manifest.extraction = existing.extraction;
  }

  await writeManifest(targetDir, manifest);

  return {
    installed: managedFiles,
    manifestPath: join(targetDir, ".dev-tasks", "manifest.json"),
    platforms,
  };
}

/**
 * @deprecated Use installFiles() instead. Kept for backward compatibility during migration.
 */
export async function installSkills(options: InstallOptions): Promise<{
  installed: ManagedFileEntry[];
  manifestPath: string;
}> {
  const result = await installFiles(options);
  return { installed: result.installed, manifestPath: result.manifestPath };
}
