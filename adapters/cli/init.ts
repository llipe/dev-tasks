/**
 * CLI handler for `dt init`.
 *
 * Two modes:
 * 1. Manual scope: `dt init --components <ids> [options]`
 * 2. Task scope:   `dt init --task "<text>" [options]` (full pipeline per spec §8.4)
 *
 * Exit codes per spec §6.7:
 * - 0:  success
 * - 1:  unexpected error
 * - 2:  invalid usage (--no-llm without --components)
 * - 6:  budget exceeded
 * - 7:  gate abort (system decision)
 * - 9:  stale index
 * - 10: invalid scope after LLM retry
 * - 11: no candidates
 * - 12: unknown component
 */

import { resolve } from "node:path";
import { ExitCode } from "#core/exit-codes.js";
import {
  EXIT_BUDGET_EXCEEDED,
  EXIT_GATE_ABORT,
  EXIT_STALE_INDEX,
  EXIT_INVALID_SCOPE,
  EXIT_NO_CANDIDATES,
  EXIT_UNKNOWN_COMPONENT,
} from "#core/context/exit-codes.js";
import {
  init,
  initWithTask,
  StaleIndexError,
  UnknownComponentError,
  MetaRepoError,
  NoLlmWithoutComponentsError,
  NoCandidatesError,
  GateAbortError,
  InvalidScopeError,
  DEFAULT_MAX_INDEX_AGE,
  type InitResult,
  type InitWithTaskResult,
} from "#core/context/init.js";
import { BudgetExceededError } from "#core/context/assemble.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface InitCliOptions {
  json: boolean;
  task?: string;
  components?: string;
  metaRepo?: string;
  maxIndexAge?: number;
  maxComponents?: number;
  flow?: string;
  noLlm?: boolean;
  out?: string;
  budget?: number;
  cacheBaseDir?: string;
  concurrency?: number;
}

/* ─── Main Command ────────────────────────────────────────────────────── */

/**
 * Run the `dt init` command.
 */
export async function runInit(options: InitCliOptions): Promise<number> {
  const {
    json,
    task,
    components,
    metaRepo,
    maxIndexAge,
    noLlm,
    out,
    budget,
    cacheBaseDir,
    concurrency,
    maxComponents,
    flow,
  } = options;

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

  // Route: --task mode (full pipeline)
  if (task) {
    return runInitWithTask({
      json,
      task,
      metaRepo,
      maxIndexAge,
      maxComponents,
      flow,
      out,
      budget,
      cacheBaseDir,
      concurrency,
    });
  }

  // Route: --components mode (manual scope)
  if (!components) {
    const msg = 'Missing required flag: --task "<text>" or --components <ids>';
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
      process.stderr.write(
        'Usage: dt init --task "<text>" [--flow <id>] [--max-components 4] [--budget 60000] [--out <dir>] [--json]\n',
      );
      process.stderr.write(
        "       dt init --components <ids> [--meta-repo <path>] [--max-index-age 240] [--out <dir>] [--json]\n",
      );
    }
    return ExitCode.InvalidUsage;
  }

  return runInitManual({
    json,
    components,
    metaRepo,
    maxIndexAge,
    out,
    budget,
    cacheBaseDir,
    concurrency,
  });
}

/* ─── Manual Scope Mode ───────────────────────────────────────────────── */

async function runInitManual(options: {
  json: boolean;
  components: string;
  metaRepo?: string;
  maxIndexAge?: number;
  out?: string;
  budget?: number;
  cacheBaseDir?: string;
  concurrency?: number;
}): Promise<number> {
  const { json, components, metaRepo, maxIndexAge, out, budget, cacheBaseDir, concurrency } =
    options;

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

    printManualOutput(result, json);
    return ExitCode.Success;
  } catch (err) {
    return handleInitError(err, json);
  }
}

/* ─── Task Scope Mode ─────────────────────────────────────────────────── */

async function runInitWithTask(options: {
  json: boolean;
  task: string;
  metaRepo?: string;
  maxIndexAge?: number;
  maxComponents?: number;
  flow?: string;
  out?: string;
  budget?: number;
  cacheBaseDir?: string;
  concurrency?: number;
}): Promise<number> {
  const {
    json,
    task,
    metaRepo,
    maxIndexAge,
    maxComponents,
    flow,
    out,
    budget,
    cacheBaseDir,
    concurrency,
  } = options;

  const metaRepoPath = resolve(metaRepo ?? ".");
  const outDir = resolve(out ?? ".dt-context");

  // Load LLM provider from environment
  const llmProvider = loadLlmProvider();
  if (!llmProvider) {
    const msg =
      "LLM provider not configured. Set DT_LLM_PROVIDER or pass --provider to use --task mode.";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.GeneralError;
  }

  try {
    const result: InitWithTaskResult = await initWithTask({
      task,
      metaRepoPath,
      outDir,
      maxIndexAge: maxIndexAge ?? DEFAULT_MAX_INDEX_AGE,
      budget,
      maxComponents,
      flow,
      cacheBaseDir,
      concurrency,
      llmProvider,
    });

    printTaskOutput(result, json);
    return ExitCode.Success;
  } catch (err) {
    return handleInitError(err, json);
  }
}

/* ─── Error Handling ──────────────────────────────────────────────────── */

function handleInitError(err: unknown, json: boolean): number {
  if (err instanceof StaleIndexError) {
    if (json) {
      process.stdout.write(
        JSON.stringify(
          { error: err.message, age_minutes: err.ageMinutes, max_minutes: err.maxMinutes },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    return EXIT_STALE_INDEX;
  }

  if (err instanceof NoCandidatesError) {
    if (json) {
      process.stdout.write(
        JSON.stringify({ error: err.message, task: err.taskText }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    return EXIT_NO_CANDIDATES;
  }

  if (err instanceof InvalidScopeError) {
    if (json) {
      process.stdout.write(
        JSON.stringify({ error: err.message, validation_errors: err.errors }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    return EXIT_INVALID_SCOPE;
  }

  if (err instanceof UnknownComponentError) {
    if (json) {
      process.stdout.write(
        JSON.stringify({ error: err.message, unknown_components: err.unknownIds }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    return EXIT_UNKNOWN_COMPONENT;
  }

  if (err instanceof GateAbortError) {
    if (json) {
      process.stdout.write(
        JSON.stringify(
          {
            error: err.message,
            abort_rule: err.abortRule,
            review_flags: err.reviewFlags,
          },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write(`Gate aborted (${err.abortRule}): ${err.message}\n`);
      if (err.reviewFlags.length > 0) {
        process.stderr.write("  Review flags:\n");
        for (const flag of err.reviewFlags) {
          process.stderr.write(`    [${flag.rule}] ${flag.message}\n`);
        }
      }
    }
    return EXIT_GATE_ABORT;
  }

  if (err instanceof BudgetExceededError) {
    if (json) {
      process.stdout.write(
        JSON.stringify(
          { error: err.message, required_tokens: err.requiredTokens, budget: err.budget },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    return EXIT_BUDGET_EXCEEDED;
  }

  if (err instanceof MetaRepoError) {
    if (json) {
      process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
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

  // Generic error
  const msg = `Init failed: ${err instanceof Error ? err.message : String(err)}`;
  if (json) {
    process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
  } else {
    process.stderr.write(`Error: ${msg}\n`);
  }
  return ExitCode.GeneralError;
}

/* ─── Output ──────────────────────────────────────────────────────────── */

function printManualOutput(result: InitResult, json: boolean): void {
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

function printTaskOutput(result: InitWithTaskResult, json: boolean): void {
  if (json) {
    const output = {
      session: {
        task_hash: result.session.task_hash,
        meta_repo_sha: result.session.meta_repo_sha,
        index_age_minutes: result.session.index_age_minutes,
        created_at: result.session.created_at,
        lock_file: result.lockFilePath,
      },
      bundle: {
        files: result.bundle.files.length,
        total_tokens: result.bundle.totalTokens,
        budget: result.bundle.budget,
        truncated: result.bundle.truncated,
      },
      scope: {
        primary: result.scope.primary,
        secondary: result.scope.secondary,
        contracts_crossed: result.scope.contracts_crossed,
        confidence: result.scope.confidence,
        flow: result.scope.flow,
      },
      review_flags: result.review_flags,
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    process.stdout.write(`✓ Context initialized (task-scoped)\n`);
    process.stdout.write(`  Meta-repo SHA: ${result.metaRepoSha.slice(0, 12)}\n`);
    process.stdout.write(`  Index age: ${result.indexAgeMinutes} minutes\n`);
    process.stdout.write(`  Primary: ${result.scope.primary.join(", ")}\n`);
    process.stdout.write(`  Secondary: ${result.scope.secondary.join(", ") || "(none)"}\n`);
    process.stdout.write(`  Confidence: ${result.scope.confidence}\n`);
    process.stdout.write(
      `  Bundle: ${result.bundle.files.length} files, ${result.bundle.totalTokens} tokens\n`,
    );
    process.stdout.write(`  Lock: ${result.lockFilePath}\n`);
    if (result.review_flags.length > 0) {
      process.stdout.write(`  Review flags:\n`);
      for (const flag of result.review_flags) {
        process.stdout.write(`    [${flag.rule}] ${flag.message}\n`);
      }
    }
  }
}

/* ─── LLM Provider Loading ────────────────────────────────────────────── */

/**
 * Load an LLM provider from environment configuration.
 * Returns null if no provider is configured.
 *
 * Future: support multiple providers via DT_LLM_PROVIDER env var.
 * For now, checks if the environment has the necessary configuration.
 */
function loadLlmProvider(): import("#core/scope/types.js").LlmScopeProvider | null {
  // Check for provider configuration in environment
  const provider = process.env.DT_LLM_PROVIDER;
  if (!provider) return null;

  // Return a provider that delegates to the configured backend
  // This is a placeholder — actual implementation depends on the provider SDK
  return {
    async scopeCall(_systemPrompt: string, _userInput: string): Promise<string> {
      // The actual LLM call implementation will be provided by the provider plugin
      // For now, this enables the pipeline to be wired and tested with mocks
      throw new Error(
        `LLM provider "${provider}" is configured but not yet implemented. Use mocks for testing.`,
      );
    },
  };
}
