/**
 * CLI handler for `dt catalog build --registry <path> [--concurrency 8] [--json]`.
 *
 * Aggregates component manifests from a registry and generates catalog/index.yaml.
 * Idempotent: nothing written when nothing changed.
 * Exit codes: 0 = success, 3 = partial failure (some repos errored).
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { catalogBuild } from "#core/catalog/build.js";
import { ExitCode } from "#core/exit-codes.js";

export interface CatalogBuildOptions {
  json: boolean;
  registry?: string;
  concurrency?: number;
  catalogDir?: string;
}

export interface CatalogBuildOutput {
  success: boolean;
  written: boolean;
  components_count: number;
  errors_count: number;
  errors: Array<{ repo: string; error: string }>;
  generated_at: string;
}

/**
 * Run the `dt catalog build` command.
 * Returns the process exit code: 0 if all repos succeeded, 3 if partial failure.
 */
export async function runCatalogBuild(options: CatalogBuildOptions): Promise<number> {
  const { json, registry, concurrency, catalogDir } = options;

  if (!registry) {
    if (json) {
      process.stdout.write(
        JSON.stringify({ error: "Missing required flag: --registry <path>" }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(
        "Usage: dt catalog build --registry <path> [--concurrency 8] [--json]\n",
      );
    }
    return ExitCode.InvalidUsage;
  }

  const registryPath = resolve(registry);
  if (!existsSync(registryPath)) {
    if (json) {
      process.stdout.write(
        JSON.stringify({ error: `Registry file not found: ${registryPath}` }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Registry file not found: ${registryPath}\n`);
    }
    return ExitCode.NotFound;
  }

  const result = await catalogBuild({
    registryPath,
    concurrency,
    catalogDir: catalogDir ? resolve(catalogDir) : undefined,
  });

  const output: CatalogBuildOutput = {
    success: result.errors.length === 0,
    written: result.written,
    components_count: result.index.components.length,
    errors_count: result.errors.length,
    errors: result.errors.map((e) => ({ repo: e.repo, error: e.error })),
    generated_at: result.index.generated_at,
  };

  if (json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  // Exit 3 for partial failure per spec
  return result.errors.length > 0 ? ExitCode.NetworkError : ExitCode.Success;
}

function printHumanOutput(output: CatalogBuildOutput): void {
  if (output.written) {
    process.stdout.write(`✓ Catalog built: ${output.components_count} components indexed\n`);
  } else {
    process.stdout.write(
      `✓ Catalog unchanged: ${output.components_count} components (no write needed)\n`,
    );
  }

  if (output.errors_count > 0) {
    process.stderr.write(`\n⚠ ${output.errors_count} error(s):\n`);
    for (const err of output.errors) {
      process.stderr.write(`  ${err.repo}: ${err.error}\n`);
    }
  }
}
