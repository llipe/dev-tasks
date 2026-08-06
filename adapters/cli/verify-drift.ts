/**
 * CLI adapter for `dt verify drift`.
 *
 * Usage: dt verify drift [--id <comp>] [--threshold <days>] [--index <path>] [--json]
 *
 * Exit codes:
 *   0 — success (drift report generated)
 *   1 — unexpected error
 *   12 — unknown component (when --id is specified but not found)
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { ExitCode } from "#core/exit-codes.js";
import { runDrift } from "#core/verify/drift.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { DriftResult } from "#core/verify/types.js";

export interface VerifyDriftCliOptions {
  /** Component id to check (optional — checks all if omitted) */
  id: string | undefined;
  /** Staleness threshold in days */
  threshold: number | undefined;
  /** Output JSON */
  json: boolean;
  /** Path to catalog index file */
  indexPath: string | undefined;
  /** Path to repository root for git operations */
  repoRoot: string | undefined;
}

/**
 * Load the catalog index from a file path.
 */
function loadCatalogIndex(indexPath: string): CatalogIndex {
  const content = readFileSync(indexPath, "utf-8");
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as CatalogIndex;
  }
  return parseYaml(trimmed) as CatalogIndex;
}

export function runVerifyDrift(options: VerifyDriftCliOptions): number {
  const { id, threshold, json, indexPath, repoRoot } = options;

  // Load catalog index
  const resolvedIndexPath = indexPath ?? "catalog/index.yaml";
  let index: CatalogIndex;
  try {
    index = loadCatalogIndex(resolvedIndexPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      process.stdout.write(
        JSON.stringify({ error: `Failed to load catalog index: ${message}` }) + "\n",
      );
    } else {
      process.stderr.write(
        `Error: Failed to load catalog index at "${resolvedIndexPath}": ${message}\n`,
      );
    }
    return ExitCode.GeneralError;
  }

  // Run drift analysis
  let result: DriftResult;
  try {
    result = runDrift(index, { id, threshold, repoRoot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      process.stdout.write(JSON.stringify({ error: message }) + "\n");
    } else {
      process.stderr.write(`Error: ${message}\n`);
    }
    return ExitCode.GeneralError;
  }

  // Check if --id was specified but yielded no results (component not found)
  if (id && result.entries.length === 0) {
    const msg = `Component "${id}" not found in catalog index.`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.UnknownComponent;
  }

  // Output results
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(`\nDrift Analysis (threshold: ${result.threshold} days)\n`);
    process.stdout.write(`${"─".repeat(60)}\n\n`);

    if (result.entries.length === 0) {
      process.stdout.write("  No components found.\n");
    } else {
      // Header
      process.stdout.write(
        `  ${"Component".padEnd(25)} ${"Source".padEnd(10)} ${"Docs".padEnd(10)} ${"Drift".padEnd(10)} Status\n`,
      );
      process.stdout.write(`  ${"─".repeat(65)}\n`);

      for (const entry of result.entries) {
        const sourceStr = entry.sourceDaysAgo === -1 ? "n/a" : `${entry.sourceDaysAgo}d`;
        const docsStr = entry.docsDaysAgo === -1 ? "n/a" : `${entry.docsDaysAgo}d`;
        const driftStr = `${entry.driftDays}d`;
        const status = entry.stale ? "STALE" : "ok";

        process.stdout.write(
          `  ${entry.id.padEnd(25)} ${sourceStr.padEnd(10)} ${docsStr.padEnd(10)} ${driftStr.padEnd(10)} ${status}\n`,
        );
      }

      process.stdout.write(`\n`);
      if (result.staleEntries.length > 0) {
        process.stdout.write(
          `  ${result.staleEntries.length} component(s) with stale docs (drift > ${result.threshold} days)\n`,
        );
      } else {
        process.stdout.write(`  All docs are within the ${result.threshold}-day threshold.\n`);
      }
    }

    process.stdout.write("\n");
  }

  return ExitCode.Success;
}
