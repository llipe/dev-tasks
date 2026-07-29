/**
 * Manifest read/write for .dev-tasks/manifest.json.
 * Schema per spec §5.5.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface SkillEntry {
  name: string;
  path: string;
  sha256: string;
  origin_sha256: string;
}

export interface Manifest {
  version: string;
  pinned: string;
  installed_at: string;
  skills: SkillEntry[];
  extraction: Record<string, unknown>;
}

const MANIFEST_DIR = ".dev-tasks";
const MANIFEST_FILE = "manifest.json";

function manifestPath(repoRoot: string): string {
  return join(repoRoot, MANIFEST_DIR, MANIFEST_FILE);
}

/**
 * Read .dev-tasks/manifest.json from the given repo root.
 * Returns null if the file does not exist.
 */
export async function readManifest(repoRoot: string): Promise<Manifest | null> {
  try {
    const raw = await readFile(manifestPath(repoRoot), "utf-8");
    return JSON.parse(raw) as Manifest;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Write .dev-tasks/manifest.json to the given repo root.
 * Creates the .dev-tasks directory if needed.
 */
export async function writeManifest(repoRoot: string, manifest: Manifest): Promise<void> {
  const dir = join(repoRoot, MANIFEST_DIR);
  await mkdir(dir, { recursive: true });
  const content = JSON.stringify(manifest, null, 2) + "\n";
  await writeFile(manifestPath(repoRoot), content, "utf-8");
}
