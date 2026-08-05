/**
 * CLI handler for `dt scope gate --scope <scope.json> [--max-components 4] [--json]`.
 *
 * Runs graph closure expansion + gate rules G1-G7.
 * On G1 abort, includes a partition proposal.
 *
 * Exit codes:
 * - 0: success (all gates passed)
 * - 2: invalid usage (missing required flags)
 * - 5: file not found
 * - 7: gate abort (G1-G4)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ExitCode } from "#core/exit-codes.js";
import { expandClosure } from "#core/scope/closure.js";
import { runGate } from "#core/scope/gate.js";
import { buildPartitionProposal } from "#core/scope/partition.js";
import type { ScopeOutput } from "#core/scope/types.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import { parse as yamlParse } from "yaml";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface ScopeGateCliOptions {
  json: boolean;
  scope?: string;
  metaRepo?: string;
  maxComponents?: number;
}

/* ─── Exit Codes ──────────────────────────────────────────────────────── */

/** Exit code 7: gate abort (spec §8.3) */
export const EXIT_GATE_ABORT = 7;

/* ─── Main Command ────────────────────────────────────────────────────── */

/**
 * Run the `dt scope gate` command.
 */
export function runScopeGate(options: ScopeGateCliOptions): number {
  const { json, scope: scopePath, metaRepo, maxComponents } = options;

  // Validate required flags
  if (!scopePath) {
    const msg = "Missing required flag: --scope <path-to-scope.json>";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  // Load scope output
  const scopeFile = resolve(scopePath);
  if (!existsSync(scopeFile)) {
    const msg = `Scope file not found: ${scopeFile}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  let scopeOutput: ScopeOutput;
  try {
    scopeOutput = JSON.parse(readFileSync(scopeFile, "utf-8")) as ScopeOutput;
  } catch (err) {
    const msg = `Failed to parse scope file: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.GeneralError;
  }

  // Load index
  const metaRepoPath = resolve(metaRepo ?? ".");
  const indexPath = resolve(metaRepoPath, "catalog", "index.yaml");
  if (!existsSync(indexPath)) {
    const msg = `Catalog index not found: ${indexPath}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  let index: CatalogIndex;
  try {
    index = yamlParse(readFileSync(indexPath, "utf-8")) as CatalogIndex;
  } catch (err) {
    const msg = `Failed to parse catalog index: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.GeneralError;
  }

  // Run closure expansion
  const closureResult = expandClosure(scopeOutput, index);

  // Run gate rules
  const gateResult = runGate(scopeOutput, closureResult, index, { maxComponents });

  if (!gateResult.passed) {
    // Generate partition proposal for G1 aborts
    const partitionProposal =
      gateResult.abortRule === "G1" ? buildPartitionProposal(closureResult, index) : undefined;

    if (json) {
      process.stdout.write(
        JSON.stringify(
          {
            passed: false,
            abort_reason: gateResult.abortReason,
            abort_rule: gateResult.abortRule,
            review_flags: gateResult.reviewFlags,
            closure: {
              primary: closureResult.primary,
              secondary: closureResult.secondary,
              source_map: closureResult.sourceMap,
            },
            partition_proposal: partitionProposal ?? null,
          },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write(`✗ Gate abort (${gateResult.abortRule}): ${gateResult.abortReason}\n`);
      if (partitionProposal) {
        process.stderr.write(`\n  Partition proposal:\n`);
        for (const part of partitionProposal.partitions) {
          process.stderr.write(
            `    ${part.order + 1}. [${part.domain}] ${part.components.join(", ")}\n`,
          );
        }
        process.stderr.write(`\n  ${partitionProposal.rationale}\n`);
      }
    }
    return EXIT_GATE_ABORT;
  }

  // Success
  printOutput(closureResult, gateResult.reviewFlags, json);
  return ExitCode.Success;
}

/* ─── Output ──────────────────────────────────────────────────────────── */

function printOutput(
  closure: { primary: string[]; secondary: string[]; sourceMap: Record<string, string> },
  reviewFlags: { rule: string; message: string }[],
  json: boolean,
): void {
  if (json) {
    const result = {
      passed: true,
      closure: {
        primary: closure.primary,
        secondary: closure.secondary,
        source_map: closure.sourceMap,
      },
      review_flags: reviewFlags,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(
      `✓ Gate passed (${closure.primary.length} primary, ${closure.secondary.length} secondary)\n`,
    );
    if (closure.secondary.length > 0) {
      process.stdout.write(`  Secondary: ${closure.secondary.join(", ")}\n`);
    }
    if (reviewFlags.length > 0) {
      process.stdout.write(`  Review flags:\n`);
      for (const flag of reviewFlags) {
        process.stdout.write(`    [${flag.rule}] ${flag.message}\n`);
      }
    }
  }
}
