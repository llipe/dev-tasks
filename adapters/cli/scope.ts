/**
 * CLI handler for `dt scope --task "<text>" --candidates <resolve-output> [--json]`.
 *
 * Runs the LLM scoping step: assembles input, calls LLM, validates output,
 * retries once on failure, records calibration.
 *
 * Exit codes:
 * - 0: success
 * - 2: invalid usage (missing required flags)
 * - 10: invalid scope after retry
 * - 11: no candidates (empty resolve output)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ExitCode } from "#core/exit-codes.js";
import { runScoping, EXIT_INVALID_SCOPE } from "#core/scope/scoping.js";
import type { LlmScopeProvider, ScopeOutput } from "#core/scope/types.js";
import type { ResolveCandidate } from "#core/catalog/resolve.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import { parse as yamlParse } from "yaml";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface ScopeCliOptions {
  json: boolean;
  task?: string;
  candidates?: string;
  metaRepo?: string;
  out?: string;
  skipCalibration?: boolean;
}

/* ─── Exit Codes ──────────────────────────────────────────────────────── */

/** Exit 11: No candidates from resolve */
const EXIT_NO_CANDIDATES = 11;

/* ─── Main Command ────────────────────────────────────────────────────── */

/**
 * Run the `dt scope` command.
 */
export async function runScope(
  options: ScopeCliOptions,
  llmProvider: LlmScopeProvider,
): Promise<number> {
  const { json, task, candidates: candidatesPath, metaRepo, out, skipCalibration } = options;

  // Validate required flags
  if (!task) {
    const msg = 'Missing required flag: --task "<text>"';
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  if (!candidatesPath) {
    const msg = "Missing required flag: --candidates <path-to-resolve-output.json>";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  // Load candidates
  const candidatesFile = resolve(candidatesPath);
  if (!existsSync(candidatesFile)) {
    const msg = `Candidates file not found: ${candidatesFile}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  let candidates: ResolveCandidate[];
  try {
    candidates = JSON.parse(readFileSync(candidatesFile, "utf-8")) as ResolveCandidate[];
  } catch (err) {
    const msg = `Failed to parse candidates file: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.GeneralError;
  }

  // Guard: empty candidates
  if (!candidates || candidates.length === 0) {
    const msg = "No candidates from resolve — cannot scope with zero candidates";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return EXIT_NO_CANDIDATES;
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

  // Run scoping
  const result = await runScoping({
    taskText: task,
    candidates,
    index,
    llmProvider,
    baseDir: out ?? process.cwd(),
    skipCalibration,
  });

  if (!result.success) {
    if (json) {
      process.stdout.write(
        JSON.stringify(
          {
            error: "Invalid scope after retry",
            errors: result.errors,
            repair_attempted: result.repairAttempted,
          },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write("Error: Invalid scope after retry\n");
      for (const e of result.errors) {
        process.stderr.write(`  - ${e}\n`);
      }
    }
    return EXIT_INVALID_SCOPE;
  }

  // Output
  printOutput(result.output, result.repairAttempted, result.calibrationPath, json);
  return ExitCode.Success;
}

/* ─── Output ──────────────────────────────────────────────────────────── */

function printOutput(
  output: ScopeOutput,
  repairAttempted: boolean,
  calibrationPath: string | undefined,
  json: boolean,
): void {
  if (json) {
    const result = {
      success: true,
      scope: output,
      repair_attempted: repairAttempted,
      calibration_path: calibrationPath ?? null,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(`✓ Scope determined (confidence: ${output.confidence})\n`);
    process.stdout.write(`  Primary: ${output.primary.join(", ")}\n`);
    if (output.secondary.length > 0) {
      process.stdout.write(`  Secondary: ${output.secondary.join(", ")}\n`);
    }
    if (output.contracts_crossed.length > 0) {
      process.stdout.write(`  Contracts crossed: ${output.contracts_crossed.join(", ")}\n`);
    }
    if (output.unresolved.length > 0) {
      process.stdout.write(`  Unresolved: ${output.unresolved.join(", ")}\n`);
    }
    if (repairAttempted) {
      process.stdout.write(`  (repair attempt was needed)\n`);
    }
    if (calibrationPath) {
      process.stdout.write(`  Calibration: ${calibrationPath}\n`);
    }
  }
}
