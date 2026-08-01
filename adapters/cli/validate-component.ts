/**
 * CLI handler for `dt validate-component <path>`.
 * Validates a component.json manifest against the bundled JSON Schema
 * (draft 2020-12), entirely offline. Spec: specification-multi-repo-context.md
 * section 6.2 / 8.1 (component-repo PR CI), section 15 (component-repo CI usage).
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateComponentFile,
  type ValidateArtifactResult,
} from "#core/catalog/validate-component.js";
import { ExitCode } from "#core/exit-codes.js";

export interface ValidateComponentOptions {
  json: boolean;
  path?: string;
}

export interface ValidateComponentOutput {
  path: string;
  valid: boolean;
  errors: ValidateArtifactResult["errors"];
}

/**
 * Run the `dt validate-component <path>` command.
 * Returns the process exit code: 0 if valid, ExitCode.AuthError (4) if invalid
 * (per spec section 6.7 — "4: Catalog validation errors"), ExitCode.InvalidUsage (2)
 * if no path was given, ExitCode.NotFound (5) if the file does not exist.
 */
export function runValidateComponent(options: ValidateComponentOptions): number {
  const targetPath = options.path;

  if (!targetPath) {
    if (options.json) {
      process.stdout.write(
        JSON.stringify({ error: "Missing required argument: <path>" }, null, 2) + "\n",
      );
    } else {
      process.stderr.write("Usage: dt validate-component <path> [--json]\n");
    }
    return ExitCode.InvalidUsage;
  }

  const absPath = resolve(targetPath);
  if (!existsSync(absPath)) {
    if (options.json) {
      process.stdout.write(
        JSON.stringify({ path: absPath, error: "File not found" }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`File not found: ${absPath}\n`);
    }
    return ExitCode.NotFound;
  }

  const result = validateComponentFile(absPath);

  const output: ValidateComponentOutput = {
    path: absPath,
    valid: result.valid,
    errors: result.errors,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  return result.valid ? ExitCode.Success : ExitCode.AuthError;
}

function printHumanOutput(output: ValidateComponentOutput): void {
  if (output.valid) {
    process.stdout.write(`✓ ${output.path} is valid\n`);
    return;
  }

  process.stderr.write(`✗ ${output.path} is invalid\n\n`);
  for (const err of output.errors) {
    process.stderr.write(`  ${err.path || "/"}: ${err.message} (${err.keyword})\n`);
  }
}
