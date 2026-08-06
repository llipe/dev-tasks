/**
 * CLI adapter for `dt verify contract-diff`.
 *
 * Usage: dt verify contract-diff --base <path> --head <path> [--json]
 *
 * Exit codes:
 *   0 — no breaking changes detected
 *   8 — breaking change detected
 *   1 — unexpected error (malformed spec, missing file, etc.)
 *   2 — incorrect usage (missing required flags)
 */

import { ExitCode } from "#core/exit-codes.js";
import { runContractDiff } from "#core/verify/contract-diff.js";
import type { ContractDiffResult } from "#core/verify/types.js";

export interface VerifyContractDiffCliOptions {
  /** Path to base (old) spec */
  basePath: string | undefined;
  /** Path to head (new) spec */
  headPath: string | undefined;
  /** Output JSON */
  json: boolean;
}

export function runVerifyContractDiff(options: VerifyContractDiffCliOptions): number {
  const { basePath, headPath, json } = options;

  if (!basePath || !headPath) {
    const msg = "Usage: dt verify contract-diff --base <path> --head <path> [--json]";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    } else {
      process.stderr.write(`Error: --base and --head are required.\n${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  let result: ContractDiffResult;
  try {
    result = runContractDiff({ basePath, headPath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      process.stdout.write(JSON.stringify({ error: message }) + "\n");
    } else {
      process.stderr.write(`Error: ${message}\n`);
    }
    return ExitCode.GeneralError;
  }

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const breakingFindings = result.findings.filter((f) => f.kind === "breaking");
    const nonBreakingFindings = result.findings.filter((f) => f.kind === "non-breaking");

    if (breakingFindings.length > 0) {
      process.stdout.write(`\n⚠ ${breakingFindings.length} breaking change(s) detected:\n\n`);
      for (const f of breakingFindings) {
        process.stdout.write(`  [${f.code}] ${f.message}\n`);
        process.stdout.write(`    at ${f.path}\n\n`);
      }
    }

    if (nonBreakingFindings.length > 0) {
      process.stdout.write(`ℹ ${nonBreakingFindings.length} non-breaking change(s):\n\n`);
      for (const f of nonBreakingFindings) {
        process.stdout.write(`  [${f.code}] ${f.message}\n`);
      }
      process.stdout.write("\n");
    }

    if (!result.breaking && breakingFindings.length === 0 && nonBreakingFindings.length === 0) {
      process.stdout.write("No changes detected.\n");
    } else if (!result.breaking) {
      process.stdout.write("✓ No breaking changes.\n");
    }
  }

  return result.breaking ? ExitCode.BreakingChange : ExitCode.Success;
}
