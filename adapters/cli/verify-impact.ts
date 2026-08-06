/**
 * CLI adapter for `dt verify impact`.
 *
 * Usage: dt verify impact --contract <id> [--emit-tasks] [--json]
 *
 * Exit codes:
 *   0 — success (consumers listed)
 *   1 — unexpected error
 *   2 — incorrect usage (missing required flags)
 *   12 — unknown component/contract
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { ExitCode } from "#core/exit-codes.js";
import { runImpact } from "#core/verify/impact.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { ImpactResult } from "#core/verify/types.js";

export interface VerifyImpactCliOptions {
  /** Contract id to analyze */
  contractId: string | undefined;
  /** Whether to emit derived tasks */
  emitTasks: boolean;
  /** Output JSON */
  json: boolean;
  /** Path to catalog index file */
  indexPath: string | undefined;
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

export async function runVerifyImpact(options: VerifyImpactCliOptions): Promise<number> {
  const { contractId, emitTasks, json, indexPath } = options;

  if (!contractId) {
    const msg = "Usage: dt verify impact --contract <id> [--emit-tasks] [--json]";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    } else {
      process.stderr.write(`Error: --contract is required.\n${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

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

  // Run impact analysis
  let result: ImpactResult | null;
  try {
    result = await runImpact(index, { contractId, emitTasks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      process.stdout.write(JSON.stringify({ error: message }) + "\n");
    } else {
      process.stderr.write(`Error: ${message}\n`);
    }
    return ExitCode.GeneralError;
  }

  if (!result) {
    const msg = `Contract "${contractId}" not found in catalog index.`;
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
    process.stdout.write(`\nContract: ${result.contractId} (provider: ${result.provider})\n`);
    process.stdout.write(`Consumers: ${result.consumers.length}\n\n`);

    if (result.consumers.length === 0) {
      process.stdout.write("  No consumers found.\n");
    } else {
      for (const consumer of result.consumers) {
        process.stdout.write(
          `  ${consumer.id} (criticality: ${consumer.criticality}) — ${consumer.repo}\n`,
        );
      }
    }

    if (emitTasks) {
      process.stdout.write("\n");
      if (result.tasksEmitted) {
        process.stdout.write(
          `Tasks emitted: ${result.taskResults.filter((r) => r.success).length}/${result.taskResults.length}\n`,
        );
        for (const tr of result.taskResults) {
          if (tr.success) {
            process.stdout.write(`  [ok] ${tr.consumerId} → ${tr.taskUrl ?? "created"}\n`);
          } else {
            process.stdout.write(`  [skip] ${tr.consumerId}: ${tr.error}\n`);
          }
        }
      } else {
        process.stdout.write("Tasks not emitted: tracker provider unavailable.\n");
        if (result.taskResults.length > 0) {
          process.stdout.write(`  ${result.taskResults[0].error}\n`);
        }
      }
    }

    process.stdout.write("\n");
  }

  return ExitCode.Success;
}
