/**
 * Foundation-document migration (FR-45).
 *
 * `docs/product-context.md` and `docs/technical-guidelines.md` were
 * renamed to `docs/product.md` and `docs/tech.md`. A consumer repository
 * installed before the rename still carries the old names, and
 * `dev-tasks update` must never rename a consumer-owned file on its own,
 * so the transition is proposed rather than applied.
 *
 * Detection and mutation are separate exports on purpose: `doctor` needs
 * to report the old names without any path to renaming them.
 *
 * Asymmetry with the legacy `migrate` command is deliberate (D-52). That
 * command is detect-and-apply — `runMigration()` takes no options and
 * writes the manifest unconditionally. `migrate docs` proposes by
 * default and applies only under `--force`; adding a dry-run to the
 * legacy path would change a shipped command's default behavior.
 */

import { readFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createBackupDir, backupFile } from "./backup.js";

/** The rename pairs this migration performs, oldest name first. */
const RENAME_PAIRS: ReadonlyArray<{ from: string; to: string }> = [
  { from: "docs/product-context.md", to: "docs/product.md" },
  { from: "docs/technical-guidelines.md", to: "docs/tech.md" },
];

/**
 * Consumer-owned files that commonly name the foundation documents.
 * FR-45 also mentions "custom prompts", which have no defined location
 * in a consumer repository — those are reported by the agent reading
 * the proposal, not enumerated here.
 */
const CONSUMER_OWNED_FILES: ReadonlyArray<string> = ["CLAUDE.md", "AGENTS.md"];

const OLD_NAME_PATTERN = /product-context\.md|technical-guidelines\.md/;

export interface DocRename {
  /** Repo-relative path of the existing old-named document. */
  from: string;
  /** Repo-relative path it would be renamed to. */
  to: string;
  /** True when the target already exists — a partial migration. */
  targetExists: boolean;
  /** Set when the rename was not performed, with the reason. */
  skipped?: "target-exists";
  /** Set when the rename was attempted and failed. */
  error?: string;
}

export interface DocsMigrationResult {
  /** True only when the caller passed `apply` and mutations were attempted. */
  applied: boolean;
  renames: DocRename[];
  /** Consumer-owned files that still name an old document. */
  consumerReferences: string[];
  /** Where the originals were copied before renaming, when anything was renamed. */
  backupPath?: string;
}

export interface DocsMigrationOptions {
  /** Perform the rename. Without it the call is report-only. */
  apply: boolean;
}

/**
 * Report which foundation documents still carry an old name.
 * Read-only: it never touches the working tree.
 */
export async function detectOldFoundationDocs(repoRoot: string): Promise<DocRename[]> {
  return RENAME_PAIRS.filter((pair) => existsSync(join(repoRoot, pair.from))).map((pair) => ({
    from: pair.from,
    to: pair.to,
    targetExists: existsSync(join(repoRoot, pair.to)),
  }));
}

/** List consumer-owned files that still name an old foundation document. */
async function findConsumerReferences(repoRoot: string): Promise<string[]> {
  const hits: string[] = [];
  for (const relPath of CONSUMER_OWNED_FILES) {
    const full = join(repoRoot, relPath);
    if (!existsSync(full)) continue;
    const content = await readFile(full, "utf-8");
    if (OLD_NAME_PATTERN.test(content)) hits.push(relPath);
  }
  return hits;
}

/**
 * Propose the foundation-document rename, or perform it under `apply`.
 *
 * Applying backs each original up before renaming, and refuses any
 * rename whose target already exists rather than overwriting a file the
 * consumer may have already migrated by hand.
 */
export async function runDocsMigration(
  repoRoot: string,
  options: DocsMigrationOptions,
): Promise<DocsMigrationResult> {
  const detected = await detectOldFoundationDocs(repoRoot);
  const consumerReferences = await findConsumerReferences(repoRoot);

  if (detected.length === 0 || !options.apply) {
    return { applied: false, renames: detected, consumerReferences };
  }

  const backupPath = await createBackupDir(repoRoot);
  const renames: DocRename[] = [];

  for (const candidate of detected) {
    if (candidate.targetExists) {
      renames.push({ ...candidate, skipped: "target-exists" });
      continue;
    }
    const source = join(repoRoot, candidate.from);
    const backup = await backupFile(backupPath, source, candidate.from);
    if (!backup.success) {
      renames.push({ ...candidate, error: backup.error });
      continue;
    }
    try {
      await rename(source, join(repoRoot, candidate.to));
      renames.push(candidate);
    } catch (err: unknown) {
      renames.push({ ...candidate, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { applied: true, renames, consumerReferences, backupPath };
}

/** Human-readable proposal text, shared by `migrate docs` and `doctor`. */
export function formatProposal(result: DocsMigrationResult): string {
  if (result.renames.length === 0) return "Foundation documents already use the current names.";

  const lines = result.renames.map((r) =>
    r.targetExists
      ? `  ${r.from} -> ${r.to} (SKIPPED: ${r.to} already exists)`
      : `  ${r.from} -> ${r.to}`,
  );
  const out = [`Foundation documents to rename (${result.renames.length}):`, ...lines];

  if (result.consumerReferences.length > 0) {
    out.push(
      "",
      "These files still reference the old names and are yours to update:",
      ...result.consumerReferences.map((f) => `  ${f}`),
    );
  }
  out.push("", "Run `dev-tasks migrate docs --force` to apply. Originals are backed up first.");
  return out.join("\n");
}
