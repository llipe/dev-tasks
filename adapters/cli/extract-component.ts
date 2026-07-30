/**
 * CLI handler for `dt extract component [--interactive]`.
 * Derives component.json from prior extraction outputs.
 */

import { resolve, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
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
import { hashContent } from "#core/distribution/hash.js";
import { ExitCode } from "#core/exit-codes.js";
import { registerProvider, runDetection } from "#core/extract/detect.js";
import { nodeTsProvider } from "#core/extract/providers/node-ts.js";

export interface ExtractComponentOptions {
  json: boolean;
  interactive: boolean;
  force: boolean;
  targetDir?: string;
}

export interface ExtractComponentOutput {
  component: ComponentYaml | null;
  conflicts: string[];
  missing_required: string[];
  written: boolean;
  message?: string;
}

/**
 * Run the extract component command.
 * Returns exit code.
 */
export async function runExtractComponent(options: ExtractComponentOptions): Promise<number> {
  const rootDir = resolve(options.targetDir ?? process.cwd());

  // Register providers and detect
  registerProvider(nodeTsProvider);
  const detection = runDetection({ rootDir });

  // Read prior extraction outputs (if available)
  const inputs = buildExtractionInputs(rootDir, detection);

  // Prompt for non-derivable fields (only if interactive)
  const prompted = await promptNonDerivableFields(options.interactive);

  // In non-interactive mode, no confirmation possible — all inferences are unconfirmed
  const confirmed: ConfirmationResult = {
    description: false,
    aliases: false,
    subdomain: false,
    consumesCriticality: false,
  };

  // Derive component
  const component = deriveComponent({
    inputs,
    inference: null, // LLM inference is a stub — not invoked without provider
    prompted,
    confirmed,
  });

  // Check for existing component.json and reconcile
  const componentPath = join(rootDir, "component.json");
  let conflicts: string[] = [];
  let written = false;

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
        const output: ExtractComponentOutput = {
          component: null,
          conflicts,
          missing_required: [],
          written: false,
          message: `Reconciliation conflict on fields: ${conflicts.join(", ")}. Use --force to overwrite.`,
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
  writeFileSync(componentPath, serializeComponent(component), "utf-8");
  written = true;

  // Check missing required fields
  const missingRequired = getMissingRequiredFields(component);

  const output: ExtractComponentOutput = {
    component,
    conflicts: [],
    missing_required: missingRequired,
    written,
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

function buildExtractionInputs(
  rootDir: string,
  detection: import("#core/extract/provider.js").DetectionResult | null,
): ExtractionInputs {
  let repoSha = "unknown";
  try {
    repoSha = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf-8" }).trim();
  } catch {
    // Not a git repo or git not available
  }

  const repoName = rootDir.split("/").pop() ?? "unknown";
  const extractorVersion = getExtractorVersion();

  return {
    detection,
    schemaResult: readSchemaResult(rootDir),
    openApiResult: readOpenApiResult(rootDir),
    asyncApiResult: readAsyncApiResult(rootDir),
    repoName,
    repoSha,
    extractorVersion,
  };
}

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
  // Look for schema extraction output
  const schemaPath = join(rootDir, "docs/schema.md");
  if (!existsSync(schemaPath)) return null;
  return { tables: [], filePath: "docs/schema.md" };
}

function readOpenApiResult(rootDir: string): ExtractionInputs["openApiResult"] {
  const openapiPath = join(rootDir, "docs/openapi.yaml");
  if (!existsSync(openapiPath)) return null;
  return { endpoints: [], filePath: "docs/openapi.yaml" };
}

function readAsyncApiResult(rootDir: string): ExtractionInputs["asyncApiResult"] {
  const asyncapiPath = join(rootDir, "docs/asyncapi.yaml");
  if (!existsSync(asyncapiPath)) return null;
  return { topics: [], filePath: "docs/asyncapi.yaml" };
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

function serializeComponent(component: ComponentYaml): string {
  return JSON.stringify(component, null, 2) + "\n";
}

function printHumanOutput(output: ExtractComponentOutput): void {
  if (!output.component) {
    process.stderr.write("Component derivation failed.\n");
    return;
  }

  process.stdout.write("Component Extraction Results\n");
  process.stdout.write("============================\n\n");
  process.stdout.write(`Name: ${output.component.name}\n`);
  process.stdout.write(`Type: ${output.component.type}\n`);
  process.stdout.write(`Stack: ${output.component.stack.join(", ")}\n`);
  process.stdout.write(`Provides: ${output.component.provides.length} endpoints\n`);
  process.stdout.write(`Consumes: ${output.component.consumes.length} dependencies\n`);
  process.stdout.write(`Datastores: ${output.component.datastores.join(", ") || "(none)"}\n`);
  process.stdout.write(`Written: ${output.written ? "yes" : "no"}\n`);

  if (output.missing_required.length > 0) {
    process.stdout.write(`\nMissing required fields: ${output.missing_required.join(", ")}\n`);
    process.stdout.write("Re-run with --interactive to provide these values.\n");
  }
}
