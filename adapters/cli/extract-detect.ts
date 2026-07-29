/**
 * CLI handler for `dt extract detect`.
 * Outputs detection results in human-readable or JSON format.
 */

import { resolve } from "node:path";
import {
  runDetection,
  registerProvider,
  getRequiresHuman,
  getMatchingProvider,
} from "#core/extract/detect.js";
import { nodeTsProvider } from "#core/extract/providers/node-ts.js";
import type { Capability, DetectionResult, RequiresHumanEntry } from "#core/extract/provider.js";
import { ExitCode } from "#core/exit-codes.js";

/** All capabilities that could be desired for full extraction. */
const ALL_CAPABILITIES: Capability[] = [
  "openapi_native",
  "openapi_ast",
  "db_introspection",
  "orm_ast",
  "topic_ast",
  "payload_typed",
];

export interface ExtractDetectOptions {
  json: boolean;
  targetDir?: string;
}

export interface ExtractDetectOutput {
  detection: DetectionResult | null;
  requires_human: RequiresHumanEntry[];
}

/**
 * Run the extract detect command.
 * Returns exit code.
 */
export function runExtractDetect(options: ExtractDetectOptions): number {
  // Register providers
  registerProvider(nodeTsProvider);

  const rootDir = resolve(options.targetDir ?? process.cwd());
  const detection = runDetection({ rootDir });

  let requiresHuman: RequiresHumanEntry[] = [];

  if (detection) {
    const provider = getMatchingProvider({ rootDir });
    if (provider) {
      // Check which capabilities are missing
      requiresHuman = getRequiresHuman(provider, ALL_CAPABILITIES);
    }
  }

  const output: ExtractDetectOutput = {
    detection,
    requires_human: requiresHuman,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  return ExitCode.Success;
}

function printHumanOutput(output: ExtractDetectOutput): void {
  const { detection, requires_human } = output;

  if (!detection) {
    process.stderr.write("No supported stack detected in this repository.\n");
    process.stderr.write("Ensure a package.json with recognized dependencies exists.\n");
    return;
  }

  process.stdout.write("Stack Detection Results\n");
  process.stdout.write("=======================\n\n");

  process.stdout.write(`Stack: ${detection.stack.join(", ")}\n`);
  process.stdout.write(`Type Hint: ${detection.type_hint}\n\n`);

  if (detection.http) {
    process.stdout.write("HTTP Framework\n");
    process.stdout.write(`  Framework: ${detection.http.framework}\n`);
    process.stdout.write(`  OpenAPI Strategy: ${detection.http.openapi_strategy}\n`);
    process.stdout.write("  Strategy Counts:\n");
    process.stdout.write(`    Route 1 (native): ${detection.http.strategy_counts.route1}\n`);
    process.stdout.write(`    Route 2 (boot):   ${detection.http.strategy_counts.route2}\n`);
    process.stdout.write(`    Route 3 (AST):    ${detection.http.strategy_counts.route3}\n`);
    process.stdout.write("  Evidence:\n");
    for (const ev of detection.http.evidence) {
      process.stdout.write(`    - ${ev.signal} (${ev.location})`);
      if (ev.detail) process.stdout.write(` — ${ev.detail}`);
      process.stdout.write("\n");
    }
    process.stdout.write("\n");
  }

  if (detection.orm) {
    process.stdout.write("ORM\n");
    process.stdout.write(`  Kind: ${detection.orm.kind}\n`);
    process.stdout.write(`  Schema Path: ${detection.orm.schema_path ?? "(not found)"}\n`);
    process.stdout.write("\n");
  }

  if (detection.messaging) {
    process.stdout.write("Messaging\n");
    process.stdout.write(`  Client: ${detection.messaging.client}\n`);
    process.stdout.write("  Evidence:\n");
    for (const ev of detection.messaging.evidence) {
      process.stdout.write(`    - ${ev.signal} (${ev.location})\n`);
    }
    process.stdout.write("\n");
  }

  if (requires_human.length > 0) {
    process.stdout.write("Requires Human (missing capabilities)\n");
    for (const entry of requires_human) {
      process.stdout.write(`  - ${entry.artifact}: ${entry.reason}\n`);
    }
    process.stdout.write("\n");
  }
}
