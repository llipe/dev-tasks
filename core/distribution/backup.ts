/**
 * Timestamped backup directory creation under .dev-tasks/backup/<ts>/.
 * Used by `dev-tasks update --force` to preserve conflicting files before overwrite.
 */

import { mkdir, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  error?: string;
}

/**
 * Create a timestamped backup directory under .dev-tasks/backup/.
 * Uses a filesystem-safe ISO timestamp (colons replaced with dashes).
 * Returns the absolute path to the created backup directory.
 */
export async function createBackupDir(repoRoot: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const backupDir = join(repoRoot, ".dev-tasks", "backup", timestamp);
  await mkdir(backupDir, { recursive: true });
  return backupDir;
}

/**
 * Copy a single file into the backup directory, preserving relative path structure.
 *
 * @param backupDir - The backup directory root (from createBackupDir)
 * @param sourceFile - Absolute path to the file to back up
 * @param relativePath - Relative path to preserve inside the backup dir
 */
export async function backupFile(
  backupDir: string,
  sourceFile: string,
  relativePath: string,
): Promise<BackupResult> {
  const destPath = join(backupDir, relativePath);
  try {
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(sourceFile, destPath);
    return { success: true, backupPath: destPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
