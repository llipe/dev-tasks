/**
 * CLI handler for `dt catalog scaffold [--out <dir>] [--force] [--json]`.
 *
 * Generates the meta-repo directory layout with template files.
 * Exit codes: 0 = success.
 */

import { resolve } from "node:path";
import { catalogScaffold } from "#core/catalog/scaffold.js";
import { ExitCode } from "#core/exit-codes.js";

export interface CatalogScaffoldOptions {
  json: boolean;
  out?: string;
  force?: boolean;
}

export interface CatalogScaffoldOutput {
  success: boolean;
  out_dir: string;
  created: string[];
  skipped: string[];
  directories: string[];
}

/**
 * Run the `dt catalog scaffold` command.
 * Returns the process exit code.
 */
export function runCatalogScaffold(options: CatalogScaffoldOptions): number {
  const { json, out, force } = options;

  const outDir = resolve(out ?? ".");

  const result = catalogScaffold({ outDir, force });

  const output: CatalogScaffoldOutput = {
    success: true,
    out_dir: outDir,
    created: result.created,
    skipped: result.skipped,
    directories: result.directories,
  };

  if (json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  return ExitCode.Success;
}

function printHumanOutput(output: CatalogScaffoldOutput): void {
  process.stdout.write(`\u2713 Meta-repo scaffold generated in: ${output.out_dir}\n`);

  if (output.directories.length > 0) {
    process.stdout.write(`\n  Directories created: ${output.directories.length}\n`);
  }

  if (output.created.length > 0) {
    process.stdout.write(`  Files created: ${output.created.length}\n`);
  }

  if (output.skipped.length > 0) {
    process.stdout.write(`  Files skipped (already exist): ${output.skipped.length}\n`);
    process.stdout.write(`  Use --force to overwrite existing files.\n`);
  }
}
