/**
 * Pin management — read/write .dev-tasks/version file.
 * The pin file controls which package version subsequent runs use.
 */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const PIN_DIR = ".dev-tasks";
const PIN_FILE = "version";

function pinPath(repoRoot: string): string {
  return join(repoRoot, PIN_DIR, PIN_FILE);
}

/**
 * Write the pinned version to .dev-tasks/version.
 * Creates .dev-tasks directory if needed.
 */
export async function writePin(repoRoot: string, version: string): Promise<void> {
  const dir = join(repoRoot, PIN_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(pinPath(repoRoot), version + "\n", "utf-8");
}

/**
 * Read the pinned version from .dev-tasks/version.
 * Returns null if no pin file exists.
 */
export async function readPin(repoRoot: string): Promise<string | null> {
  try {
    const content = await readFile(pinPath(repoRoot), "utf-8");
    return content.trim();
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Remove the pin file (.dev-tasks/version).
 * Returns true if the pin was removed, false if no pin existed.
 */
export async function removePin(repoRoot: string): Promise<boolean> {
  try {
    await rm(pinPath(repoRoot));
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}
