/**
 * Manifest read/write for .dev-tasks/manifest.json.
 * Generalized to track all managed files across platform profiles.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Entry tracking a single managed file.
 */
export interface ManagedFileEntry {
  /** Relative path in the consumer repo (e.g. ".github/agents/developer.agent.md") */
  path: string;
  /** Platform profile this file belongs to (copilot, claude, kiro) */
  profile: string;
  /** Current SHA-256 hash of the installed file */
  sha256: string;
  /** SHA-256 hash as originally shipped (for reconciliation) */
  origin_sha256: string;
}

/**
 * @deprecated Legacy skill entry — use ManagedFileEntry instead.
 */
export interface SkillEntry {
  name: string;
  path: string;
  sha256: string;
  origin_sha256: string;
}

/**
 * The manifest structure stored at .dev-tasks/manifest.json.
 */
export interface Manifest {
  version: string;
  pinned: string;
  installed_at: string;
  /** Managed file entries (current format). */
  files: ManagedFileEntry[];
  /** @deprecated Legacy skills array — present in older manifests. */
  skills?: SkillEntry[];
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
 * Handles migration from legacy (skills-only) format.
 */
export async function readManifest(repoRoot: string): Promise<Manifest | null> {
  try {
    const raw = await readFile(manifestPath(repoRoot), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Handle legacy manifests that only have `skills` and no `files`
    if (!parsed.files && Array.isArray(parsed.skills)) {
      const legacySkills = parsed.skills as SkillEntry[];
      const files: ManagedFileEntry[] = legacySkills.map((s) => ({
        path: s.path,
        profile: "legacy",
        sha256: s.sha256,
        origin_sha256: s.origin_sha256,
      }));
      return {
        version: (parsed.version as string) ?? "unknown",
        pinned: (parsed.pinned as string) ?? "unknown",
        installed_at: (parsed.installed_at as string) ?? "",
        files,
        skills: legacySkills,
        extraction: (parsed.extraction as Record<string, unknown>) ?? {},
      };
    }

    return {
      version: (parsed.version as string) ?? "unknown",
      pinned: (parsed.pinned as string) ?? "unknown",
      installed_at: (parsed.installed_at as string) ?? "",
      files: (parsed.files as ManagedFileEntry[]) ?? [],
      skills: parsed.skills as SkillEntry[] | undefined,
      extraction: (parsed.extraction as Record<string, unknown>) ?? {},
    };
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
