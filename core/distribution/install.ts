/**
 * Install skills from the package source into the target repo.
 * Copies skill files, computes hashes, and writes the manifest.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { hashContent } from "./hash.js";
import { writeManifest, type Manifest, type SkillEntry } from "./manifest.js";

export interface InstallOptions {
  /** Path to the package source directory (contains skills/) */
  sourceDir: string;
  /** Path to the target repo root */
  targetDir: string;
  /** Current package version being installed */
  version: string;
  /** Version to pin (defaults to version if not provided) */
  pin: string;
}

export interface InstallResult {
  installed: SkillEntry[];
  manifestPath: string;
}

/**
 * Recursively collect all files under a directory.
 * Returns paths relative to the given baseDir.
 */
async function collectFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
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
 * Install skills from the package into the target repository.
 * Copies each skill file, computes sha256 and origin_sha256, writes manifest.
 */
export async function installSkills(options: InstallOptions): Promise<InstallResult> {
  const { sourceDir, targetDir, version, pin } = options;
  const skillsSourceDir = join(sourceDir, "skills");
  const skillsTargetDir = join(targetDir, ".dev-tasks", "skills");

  // Collect all files from skills source
  let relFiles: string[] = [];
  try {
    relFiles = await collectFiles(skillsSourceDir, skillsSourceDir);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      relFiles = [];
    } else {
      throw err;
    }
  }

  const skills: SkillEntry[] = [];

  for (const relPath of relFiles) {
    const sourcePath = join(skillsSourceDir, relPath);
    const destPath = join(skillsTargetDir, relPath);

    // Read source content
    const content = await readFile(sourcePath, "utf-8");
    const hash = hashContent(content);

    // Write to target
    const destDir = join(destPath, "..");
    await mkdir(destDir, { recursive: true });
    await writeFile(destPath, content, "utf-8");

    // Derive skill name from first path segment
    const skillName = relPath.split("/")[0];

    skills.push({
      name: skillName,
      path: relPath,
      sha256: hash,
      origin_sha256: hash,
    });
  }

  const manifest: Manifest = {
    version,
    pinned: pin,
    installed_at: new Date().toISOString(),
    skills,
    extraction: {},
  };

  await writeManifest(targetDir, manifest);

  return {
    installed: skills,
    manifestPath: join(targetDir, ".dev-tasks", "manifest.json"),
  };
}
