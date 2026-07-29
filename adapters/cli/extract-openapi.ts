/**
 * CLI handler for `dt extract openapi`.
 * Outputs OpenAPI extraction results in human-readable or JSON format.
 */

import { resolve } from "node:path";
import { extractRoute1 } from "#core/extract/openapi/route1.js";
import { extractRoute3 } from "#core/extract/openapi/route3.js";
import { validateOpenApi, extractionResultToDocument } from "#core/extract/openapi/validate.js";
import type { OpenApiExtractionResult } from "#core/extract/openapi/types.js";
import { ExitCode } from "#core/exit-codes.js";

export type OpenApiStrategy = "auto" | "1" | "3";

export interface ExtractOpenApiOptions {
  json: boolean;
  targetDir?: string;
  strategy?: OpenApiStrategy;
}

export interface ExtractOpenApiOutput {
  result: OpenApiExtractionResult | null;
  validation: { valid: boolean; errors: Array<{ path: string; message: string }> };
  strategy_used: string;
  message?: string;
}

/**
 * Run the extract openapi command.
 * Returns exit code.
 */
export function runExtractOpenApi(options: ExtractOpenApiOptions): number {
  const rootDir = resolve(options.targetDir ?? process.cwd());
  const strategy = options.strategy ?? "auto";

  let result: OpenApiExtractionResult | null = null;
  let strategyUsed = strategy;

  if (strategy === "1" || strategy === "auto") {
    try {
      result = extractRoute1(rootDir);
      if (result) strategyUsed = "1";
    } catch (error) {
      if (strategy === "1") {
        const msg = error instanceof Error ? error.message : String(error);
        if (options.json) {
          process.stdout.write(
            JSON.stringify({ result: null, error: msg, strategy_used: "1" }, null, 2) + "\n",
          );
        } else {
          process.stderr.write(`Route 1 error: ${msg}\n`);
        }
        return ExitCode.GeneralError;
      }
      // Auto mode: fall through to route 3
    }
  }

  if (!result && (strategy === "3" || strategy === "auto")) {
    result = extractRoute3(rootDir);
    strategyUsed = "3";
  }

  if (!result || result.endpoints.length === 0) {
    const output: ExtractOpenApiOutput = {
      result: null,
      validation: { valid: false, errors: [] },
      strategy_used: strategyUsed,
      message: "No OpenAPI routes could be extracted",
    };

    if (options.json) {
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } else {
      process.stderr.write("No OpenAPI routes could be extracted.\n");
      process.stderr.write(
        "Ensure the repository has route handlers (Express, Fastify, Hono, NestJS)\n",
      );
      process.stderr.write("or an on-disk openapi.yaml/json file.\n");
    }
    return ExitCode.Success;
  }

  // Validate the output
  const doc = extractionResultToDocument(result);
  const validation = validateOpenApi(doc);

  const output: ExtractOpenApiOutput = {
    result,
    validation,
    strategy_used: strategyUsed,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  return ExitCode.Success;
}

function printHumanOutput(output: ExtractOpenApiOutput): void {
  const { result, validation, strategy_used } = output;

  if (!result) {
    process.stderr.write("No OpenAPI routes extracted.\n");
    return;
  }

  process.stdout.write("OpenAPI Extraction Results\n");
  process.stdout.write("==========================\n\n");
  process.stdout.write(`Strategy: route ${strategy_used}\n`);
  process.stdout.write(`Source: ${result.source}\n`);
  process.stdout.write(`Confidence: ${result.confidence}\n`);
  process.stdout.write(`Endpoints: ${result.endpoints.length}\n`);
  process.stdout.write(`Unresolved: ${result.unresolved.length}\n`);
  process.stdout.write(`Validation: ${validation.valid ? "PASS" : "FAIL"}\n\n`);

  process.stdout.write("Endpoints:\n");
  for (const ep of result.endpoints) {
    const params =
      ep.parameters.length > 0
        ? ` [${ep.parameters.map((p) => `${p.name}:${p.in}`).join(", ")}]`
        : "";
    process.stdout.write(
      `  ${ep.method.toUpperCase().padEnd(7)} ${ep.path}${params} (${ep.confidence})\n`,
    );
  }

  if (result.unresolved.length > 0) {
    process.stdout.write("\nUnresolved Routes:\n");
    for (const u of result.unresolved) {
      process.stdout.write(`  ${u.file}:${u.line} — ${u.reason}\n`);
      process.stdout.write(`    ${u.snippet}\n`);
    }
  }

  if (!validation.valid) {
    process.stdout.write("\nValidation Errors:\n");
    for (const err of validation.errors) {
      process.stdout.write(`  ${err.path}: ${err.message}\n`);
    }
  }
}
