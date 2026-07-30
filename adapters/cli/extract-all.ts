/**
 * CLI handler for `dt extract all [--interactive] [--force]`.
 * Orchestrates the full extraction pipeline:
 * detect → schema → openapi → asyncapi → component → report
 *
 * Exit codes:
 * - 0: success
 * - 13: required fields unresolved
 * - 14: reconciliation conflict
 */

import { resolve, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { registerProvider, runDetection } from "#core/extract/detect.js";
import { nodeTsProvider } from "#core/extract/providers/node-ts.js";
import {
  deriveComponent,
  computeFieldHashes,
  reconcileComponent,
  getMissingRequiredFields,
  type ExtractionInputs,
  type ConfirmationResult,
  type ComponentYaml,
} from "#core/extract/component.js";
import { promptNonDerivableFields } from "#core/extract/prompt.js";
import {
  buildExtractionReport,
  serializeReport,
  type ReportInputs,
  type StrategyEntry,
  type UnresolvedItem,
  type RequiresHumanItem,
  type ExtractionReport,
} from "#core/extract/report.js";
import { hashContent } from "#core/distribution/hash.js";
import { ExitCode } from "#core/exit-codes.js";
import type { Confidence } from "#core/extract/component.js";

export interface ExtractAllOptions {
  json: boolean;
  interactive: boolean;
  force: boolean;
  targetDir?: string;
}

export interface ExtractAllOutput {
  component: ComponentYaml | null;
  report: ExtractionReport | null;
  conflicts: string[];
  missing_required: string[];
  exitCode: number;
  message?: string;
}

/**
 * Run the full extraction pipeline.
 */
export async function runExtractAll(options: ExtractAllOptions): Promise<number> {
  const rootDir = resolve(options.targetDir ?? process.cwd());

  // Stage 1: Detect
  registerProvider(nodeTsProvider);
  const detection = runDetection({ rootDir });

  const strategies: StrategyEntry[] = [];
  const unresolvedItems: UnresolvedItem[] = [];
  const requiresHumanItems: RequiresHumanItem[] = [];
  const confidenceEntries: Confidence[] = [];

  let endpointsResolved = 0;
  const endpointsUnresolved = 0;
  let topicsResolved = 0;
  const topicsUnresolved = 0;
  let tablesResolved = 0;
  const tablesUnresolved = 0;

  if (detection) {
    strategies.push({
      stage: "detect",
      strategy: "node-ts",
      source: "detected",
      confidence: "high",
    });
    confidenceEntries.push("high");
  }

  // Stage 2: Schema extraction (uses existing outputs if available)
  const schemaResult = readSchemaResult(rootDir);
  if (schemaResult) {
    strategies.push({
      stage: "schema",
      strategy: detection?.orm?.kind ? `${detection.orm.kind}-ast` : "file",
      source: "introspected",
      confidence: "high",
    });
    tablesResolved = schemaResult.tables.length;
    confidenceEntries.push("high");
  }

  // Stage 3: OpenAPI extraction
  const openApiResult = readOpenApiResult(rootDir);
  if (openApiResult) {
    const strategy = detection?.http?.openapi_strategy ?? "unknown";
    strategies.push({
      stage: "openapi",
      strategy: `route-${strategy}`,
      source: "inferred",
      confidence: "medium",
    });
    endpointsResolved = openApiResult.endpoints.length;
    confidenceEntries.push("medium");
  }

  // Stage 4: AsyncAPI extraction
  const asyncApiResult = readAsyncApiResult(rootDir);
  if (asyncApiResult) {
    strategies.push({
      stage: "asyncapi",
      strategy: "kafkajs-ast",
      source: "inferred",
      confidence: "medium",
    });
    topicsResolved = asyncApiResult.topics.length;
    confidenceEntries.push("medium");
  }

  // Stage 5: Component derivation
  const repoName = rootDir.split("/").pop() ?? "unknown";
  let repoSha = "unknown";
  try {
    repoSha = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf-8" }).trim();
  } catch {
    // Not a git repo
  }

  const extractorVersion = getExtractorVersion();

  const inputs: ExtractionInputs = {
    detection,
    schemaResult,
    openApiResult,
    asyncApiResult,
    repoName,
    repoSha,
    extractorVersion,
  };

  // Prompt for non-derivable fields
  const prompted = await promptNonDerivableFields(options.interactive);

  // No LLM inference in pipeline (stub)
  const confirmed: ConfirmationResult = {
    description: false,
    aliases: false,
    subdomain: false,
    consumesCriticality: false,
  };

  const component = deriveComponent({
    inputs,
    inference: null,
    prompted,
    confirmed,
  });

  // Check reconciliation against existing component.json
  const componentPath = join(rootDir, "component.json");
  let conflicts: string[] = [];

  if (existsSync(componentPath) && !options.force) {
    const existing = readExistingComponent(componentPath);
    if (existing) {
      const existingHashes = computeFieldHashesFromRaw(existing);
      const provenanceHashes = existing._provenance?.field_hashes ?? {};
      const newHashes = computeFieldHashes(component);

      const actions = reconcileComponent(existingHashes, provenanceHashes, newHashes);
      conflicts = Object.entries(actions)
        .filter(([, action]) => action === "conflict")
        .map(([field]) => field);

      if (conflicts.length > 0) {
        const output: ExtractAllOutput = {
          component: null,
          report: null,
          conflicts,
          missing_required: [],
          exitCode: ExitCode.ReconciliationConflict,
          message: `Reconciliation conflict on fields: ${conflicts.join(", ")}`,
        };

        if (options.json) {
          process.stdout.write(JSON.stringify(output, null, 2) + "\n");
        } else {
          process.stderr.write(
            `Conflict: fields [${conflicts.join(", ")}] were manually edited.\n`,
          );
          process.stderr.write("Use --force to overwrite, or resolve manually.\n");
        }
        return ExitCode.ReconciliationConflict;
      }
    }
  }

  // Write component.json
  writeFileSync(componentPath, JSON.stringify(component, null, 2) + "\n", "utf-8");

  // Non-derivable fields that are empty → requires_human
  const missingRequired = getMissingRequiredFields(component);
  for (const field of missingRequired) {
    requiresHumanItems.push({
      field,
      reason: "Non-derivable field not provided",
      category: "non-derivable",
    });
  }

  // Stage 6: Build and write extraction_report.json
  const reportInputs: ReportInputs = {
    strategies,
    endpointsResolved,
    endpointsUnresolved,
    topicsResolved,
    topicsUnresolved,
    tablesResolved,
    tablesUnresolved,
    unresolved: unresolvedItems,
    requiresHuman: requiresHumanItems,
    confidenceEntries,
  };

  const report = buildExtractionReport(reportInputs);
  const reportPath = join(rootDir, "extraction_report.json");
  writeFileSync(reportPath, serializeReport(report), "utf-8");

  const output: ExtractAllOutput = {
    component,
    report,
    conflicts: [],
    missing_required: missingRequired,
    exitCode: missingRequired.length > 0 ? ExitCode.MissingRequiredField : ExitCode.Success,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  if (missingRequired.length > 0) {
    return ExitCode.MissingRequiredField;
  }

  return ExitCode.Success;
}

// --- Helpers ---

function getExtractorVersion(): string {
  try {
    let dir = import.meta.dirname;
    for (let i = 0; i < 5; i++) {
      const candidate = resolve(dir, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as { version?: string };
        if (pkg.version) return pkg.version;
      } catch {
        // keep going
      }
      dir = resolve(dir, "..");
    }
  } catch {
    // fallback
  }
  return "unknown";
}

function readSchemaResult(rootDir: string): ExtractionInputs["schemaResult"] {
  const schemaPath = join(rootDir, "docs/schema.md");
  if (!existsSync(schemaPath)) return null;
  // Parse tables from schema.md (simplified — look for table headers)
  try {
    const content = readFileSync(schemaPath, "utf-8");
    const tables = extractTableNames(content);
    return { tables, filePath: "docs/schema.md" };
  } catch {
    return null;
  }
}

function readOpenApiResult(rootDir: string): ExtractionInputs["openApiResult"] {
  const paths = ["docs/openapi.yaml", "docs/openapi.json", "openapi.yaml", "openapi.json"];
  for (const p of paths) {
    const fullPath = join(rootDir, p);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        const endpoints = extractEndpoints(content);
        return { endpoints, filePath: p };
      } catch {
        return { endpoints: [], filePath: p };
      }
    }
  }
  return null;
}

function readAsyncApiResult(rootDir: string): ExtractionInputs["asyncApiResult"] {
  const paths = ["docs/asyncapi.yaml", "docs/asyncapi.json", "asyncapi.yaml"];
  for (const p of paths) {
    const fullPath = join(rootDir, p);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        const topics = extractTopicNames(content);
        return { topics, filePath: p };
      } catch {
        return { topics: [], filePath: p };
      }
    }
  }
  return null;
}

function extractTableNames(schemaContent: string): string[] {
  const tables: string[] = [];
  const regex = /^##\s+(\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(schemaContent)) !== null) {
    tables.push(match[1]);
  }
  return tables;
}

function extractEndpoints(content: string): Array<{ method: string; path: string }> {
  const endpoints: Array<{ method: string; path: string }> = [];
  // Simple YAML path extraction: look for paths like /users:
  const pathRegex = /^\s{2}(\/[^\s:]+):/gm;
  const methodRegex = /^\s{4}(get|post|put|patch|delete):/gm;
  let pathMatch: RegExpExecArray | null;
  const pathPositions: Array<{ path: string; pos: number }> = [];

  while ((pathMatch = pathRegex.exec(content)) !== null) {
    pathPositions.push({ path: pathMatch[1], pos: pathMatch.index });
  }

  let methodMatch: RegExpExecArray | null;
  while ((methodMatch = methodRegex.exec(content)) !== null) {
    // Find which path this method belongs to
    let currentPath = "/";
    for (const pp of pathPositions) {
      if (pp.pos <= methodMatch.index) currentPath = pp.path;
    }
    endpoints.push({ method: methodMatch[1].toUpperCase(), path: currentPath });
  }

  return endpoints;
}

function extractTopicNames(
  content: string,
): Array<{ name: string; direction: "provides" | "consumes" }> {
  const topics: Array<{ name: string; direction: "provides" | "consumes" }> = [];
  // Simple channel name extraction from AsyncAPI YAML
  const channelRegex = /^\s{2}([a-zA-Z0-9_-]+):/gm;
  let match: RegExpExecArray | null;
  while ((match = channelRegex.exec(content)) !== null) {
    const name = match[1];
    if (name === "channels" || name === "info" || name === "asyncapi") continue;
    // Default to consumes — can be refined by operation type
    topics.push({ name, direction: "consumes" });
  }
  return topics;
}

function readExistingComponent(filePath: string): ComponentYaml | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as ComponentYaml;
  } catch {
    return null;
  }
}

function computeFieldHashesFromRaw(component: ComponentYaml): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const [key, value] of Object.entries(component)) {
    if (key === "_provenance") continue;
    if (value === undefined || value === "") continue;
    hashes[key] = hashContent(JSON.stringify(value));
  }
  return hashes;
}

function printHumanOutput(output: ExtractAllOutput): void {
  if (!output.component) {
    process.stderr.write("Extraction pipeline failed.\n");
    return;
  }

  process.stdout.write("Full Extraction Pipeline Results\n");
  process.stdout.write("================================\n\n");
  process.stdout.write(`Component: ${output.component.name}\n`);
  process.stdout.write(`Type: ${output.component.type}\n`);
  process.stdout.write(`Stack: ${output.component.stack.join(", ")}\n\n`);

  if (output.report) {
    process.stdout.write("Strategies:\n");
    for (const s of output.report.strategies) {
      process.stdout.write(`  ${s.stage}: ${s.strategy} (${s.confidence})\n`);
    }

    process.stdout.write("\nCoverage:\n");
    const cov = output.report.coverage;
    process.stdout.write(
      `  Endpoints: ${cov.endpoints.resolved}/${cov.endpoints.total} resolved\n`,
    );
    process.stdout.write(`  Topics: ${cov.topics.resolved}/${cov.topics.total} resolved\n`);
    process.stdout.write(`  Tables: ${cov.tables.resolved}/${cov.tables.total} resolved\n`);

    process.stdout.write("\nConfidence:\n");
    const cc = output.report.confidence_counts;
    process.stdout.write(`  High: ${cc.high}, Medium: ${cc.medium}, Low: ${cc.low}\n`);

    if (output.report.unresolved.length > 0) {
      process.stdout.write("\nUnresolved:\n");
      for (const u of output.report.unresolved) {
        process.stdout.write(`  [${u.stage}] ${u.location}: ${u.reason}\n`);
      }
    }

    if (output.report.requires_human.length > 0) {
      process.stdout.write("\nRequires Human:\n");
      for (const r of output.report.requires_human) {
        process.stdout.write(`  ${r.field}: ${r.reason}\n`);
      }
    }
  }

  process.stdout.write(`\nFiles written: component.json, extraction_report.json\n`);

  if (output.missing_required.length > 0) {
    process.stdout.write(
      `\nWARNING: Missing required fields: ${output.missing_required.join(", ")}\n`,
    );
    process.stdout.write("Re-run with --interactive to provide these values.\n");
  }
}
