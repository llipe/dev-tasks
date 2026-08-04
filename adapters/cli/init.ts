/**
 * CLI handler for `dt init --components <ids> [--meta-repo <path>] [--max-index-age 240] [--no-llm] [--out <dir>] [--json]`.
 *
 * Manual-scope init: pin meta-repo, check freshness, assemble bundle,
 * emit session.lock.json.
 *
 * Exit codes:
 * - 0: success
 * - 2: --no-llm without --components (invalid usage)
 * - 9: stale index (ValidationError)
 * - 12: unknown component (PermissionDenied maps to exit 12)
 */

import { resolve } from "node:path";
import { ExitCode } from "#core/exit-codes.js";
import {
  init,
  StaleIndexError,
  UnknownComponentError,
  MetaRepoError,
  NoLlmWithoutComponentsError,
  DEFAULT_MAX_INDEX_AGE,
  type InitResult,
} from "#core/context/init.js";
import { BudgetExceededError } from "#core/context/assemble.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface InitCliOptions {
  json: boolean;
  components?: string;
  metaRepo?: string;
  maxIndexAge?: number;
  noLlm?: boolean;
  out?: string;
  budget?: number;
  cacheBaseDir?: string;
  concurrency?: number;
}

/* ─── Exit Codes (spec-specific) ──────────────────────────────────────── */

/** Exit 9: Stale index */
const EXIT_STALE_INDEX = 9;

/** Exit 12: Unknown component */
const EXIT_UNKNOWN_COMPONENT = 12;

/** Exit 6: Budget exceeded */
const EXIT_BUDGET_EXCEEDED = 6;

/* ─── Main Command ────────────────────────────────────────────────────── */

/**
 * Run the `dt init` command.
 */
export async function runInit(options: InitCliOptions): Promise<number> {
  const { json, components, metaRepo, maxIndexAge, noLlm, out, budget, cacheBaseDir, concurrency } =
    options;

  // Guard: --no-llm without --components → exit 2
  if (noLlm && !components) {
    const err = new NoLlmWithoutComponentsError();
    if (json) {
      process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  // Guard: --components is required for now (manual scope only)
  if (!components) {
    const msg = "Missing required flag: --components <ids> (comma-separated component ids)";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
      process.stderr.write(
        "Usage: dt init --components <ids> [--meta-repo <path>] [--max-index-age 240] [--out <dir>] [--json]\n",
      );
    }
    return ExitCode.InvalidUsage;
  }

  const componentIds = components.split(",").map((s) => s.trim());
  if (componentIds.length === 0 || componentIds.some((id) => !id)) {
    const msg = "Invalid --components: must be comma-separated non-empty component ids";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  const metaRepoPath = resolve(metaRepo ?? ".");
  const outDir = resolve(out ?? ".dt-context");

  try {
    const result: InitResult = await init({
      components: componentIds,
      metaRepoPath,
      outDir,
      maxIndexAge: maxIndexAge ?? DEFAULT_MAX_INDEX_AGE,
      budget,
      cacheBaseDir,
      concurrency,
    });

    printOutput(result, json);
    return ExitCode.Success;
  } catch (err) {
    if (err instanceof StaleIndexError) {
      const msg = err.message;
      if (json) {
        process.stdout.write(
          JSON.stringify(
            {
              error: msg,
              age_minutes: err.ageMinutes,
              max_minutes: err.maxMinutes,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return EXIT_STALE_INDEX;
    }

    if (err instanceof UnknownComponentError) {
      const msg = err.message;
      if (json) {
        process.stdout.write(
          JSON.stringify(
            {
              error: msg,
              unknown_components: err.unknownIds,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return EXIT_UNKNOWN_COMPONENT;
    }

    if (err instanceof MetaRepoError) {
      const msg = err.message;
      if (json) {
        process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return ExitCode.GeneralError;
    }

    if (err instanceof NoLlmWithoutComponentsError) {
      if (json) {
        process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + "\n");
      } else {
        process.stderr.write(`Error: ${err.message}\n`);
      }
      return ExitCode.InvalidUsage;
    }

    if (err instanceof BudgetExceededError) {
      if (json) {
        process.stdout.write(
          JSON.stringify(
            {
              error: err.message,
              required_tokens: err.requiredTokens,
              budget: err.budget,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        process.stderr.write(`Error: ${err.message}\n`);
      }
      return EXIT_BUDGET_EXCEEDED;
    }

    // Generic error
    const msg = `Init failed: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.GeneralError;
  }
}

/* ─── Output ──────────────────────────────────────────────────────────── */

function printOutput(result: InitResult, json: boolean): void {
  if (json) {
    const output = {
      success: true,
      meta_repo_sha: result.metaRepoSha,
      index_age_minutes: result.indexAgeMinutes,
      scope: result.sessionLock.scope,
      bundle_files: result.bundleManifest.files.length,
      total_tokens: result.bundleManifest.totalTokens,
      budget: result.bundleManifest.budget,
      lock_file: result.lockFilePath,
      repo_shas: result.sessionLock.repo_shas,
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    process.stdout.write(`✓ Context initialized\n`);
    process.stdout.write(`  Meta-repo SHA: ${result.metaRepoSha.slice(0, 12)}\n`);
    process.stdout.write(`  Index age: ${result.indexAgeMinutes} minutes\n`);
    process.stdout.write(
      `  Scope: ${result.sessionLock.scope.components.join(", ")} (${result.sessionLock.scope.source})\n`,
    );
    process.stdout.write(
      `  Bundle: ${result.bundleManifest.files.length} files, ${result.bundleManifest.totalTokens} tokens\n`,
    );
    process.stdout.write(`  Lock: ${result.lockFilePath}\n`);
  }
}
