/**
 * CLI handler for `dt ctx assemble --scope <scope.json> --out <dir> [--budget 60000] [--json]`.
 *
 * Builds a layered, budgeted, deterministic context bundle.
 * Exit codes: 0 = success, 6 = non-truncable layers exceed budget.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { parse as yamlParse } from "yaml";
import { ExitCode } from "#core/exit-codes.js";
import {
  assemble,
  BudgetExceededError,
  DEFAULT_BUDGET,
  type AssembleOptions,
  type MetaRepoContent,
  type ScopeInput,
  type ComponentContent,
  type ContractFile,
  type BundleManifest,
} from "#core/context/assemble.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface CtxAssembleCliOptions {
  json: boolean;
  scope?: string;
  out?: string;
  budget?: number;
  metaRepo?: string;
  cachePath?: string;
}

/* ─── Constants ───────────────────────────────────────────────────────── */

/** Exit code for non-truncable budget exceeded (spec §6.3) */
const EXIT_BUDGET_EXCEEDED = 6;

/* ─── Main Command ────────────────────────────────────────────────────── */

/**
 * Run the `dt ctx assemble` command.
 */
export function runCtxAssemble(options: CtxAssembleCliOptions): number {
  const { json, scope: scopePath, out, budget, metaRepo, cachePath } = options;

  // Validate required flags
  if (!scopePath) {
    const msg = "Missing required flag: --scope <scope.json>";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
      process.stderr.write(
        "Usage: dt ctx assemble --scope <scope.json> --out <dir> [--budget 60000] [--json]\n",
      );
    }
    return ExitCode.InvalidUsage;
  }

  if (!out) {
    const msg = "Missing required flag: --out <dir>";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  // Resolve and validate scope file
  const scopeFilePath = resolve(scopePath);
  if (!existsSync(scopeFilePath)) {
    const msg = `Scope file not found: ${scopeFilePath}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  // Parse scope file
  let scopeInput: ScopeInput;
  try {
    const scopeRaw = readFileSync(scopeFilePath, "utf-8");
    scopeInput = JSON.parse(scopeRaw) as ScopeInput;
  } catch (err) {
    const msg = `Failed to parse scope file: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.ValidationError;
  }

  // Resolve meta-repo content
  const metaRepoPath = resolve(metaRepo ?? ".");
  const metaRepoContent = loadMetaRepoContent(metaRepoPath, scopeInput, cachePath);

  if (!metaRepoContent) {
    const msg = `Failed to load meta-repo content from: ${metaRepoPath}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  // Assemble the bundle
  const outDir = resolve(out);
  const assembleOptions: AssembleOptions = {
    scope: scopeInput,
    metaRepo: metaRepoContent,
    outDir,
    budget: budget ?? DEFAULT_BUDGET,
  };

  try {
    const manifest = assemble(assembleOptions);
    printOutput(manifest, json);
    return ExitCode.Success;
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      const msg = err.message;
      if (json) {
        process.stdout.write(
          JSON.stringify(
            {
              error: msg,
              required_tokens: err.requiredTokens,
              budget: err.budget,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return EXIT_BUDGET_EXCEEDED;
    }
    const msg = `Assembly failed: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.GeneralError;
  }
}

/* ─── Meta-Repo Content Loading ───────────────────────────────────────── */

/**
 * Load meta-repo content required for assembly.
 * Reads index.yaml, architecture.md, conventions.md, and per-component content.
 */
function loadMetaRepoContent(
  metaRepoPath: string,
  scope: ScopeInput,
  cachePath?: string,
): MetaRepoContent | null {
  // Load catalog index
  const indexPath = resolve(metaRepoPath, "catalog", "index.yaml");
  if (!existsSync(indexPath)) {
    return null;
  }

  let index: CatalogIndex;
  try {
    const indexContent = readFileSync(indexPath, "utf-8");
    index = yamlParse(indexContent) as CatalogIndex;
  } catch {
    return null;
  }

  // Load architecture.md
  let architectureMd: string | undefined;
  const archPath = resolve(metaRepoPath, "architecture.md");
  if (existsSync(archPath)) {
    architectureMd = readFileSync(archPath, "utf-8");
  }

  // Load conventions.md
  let conventionsMd: string | undefined;
  const convPath = resolve(metaRepoPath, "conventions.md");
  if (existsSync(convPath)) {
    conventionsMd = readFileSync(convPath, "utf-8");
  }

  // Load per-component content from cache
  const componentContent = new Map<string, ComponentContent>();
  const allIds = [...scope.primary, ...scope.secondary];

  for (const id of allIds) {
    const content = loadComponentContent(id, index, metaRepoPath, cachePath);
    if (content) {
      componentContent.set(id, content);
    }
  }

  // Load flow content
  let flowContent: Map<string, string> | undefined;
  if (scope.flow) {
    flowContent = new Map();
    const flowDir = resolve(metaRepoPath, "catalog", "flows");
    if (existsSync(flowDir)) {
      const flowFile = resolve(flowDir, `${scope.flow}.md`);
      if (existsSync(flowFile)) {
        flowContent.set(scope.flow, readFileSync(flowFile, "utf-8"));
      }
      // Also try yaml
      const flowYaml = resolve(flowDir, `${scope.flow}.yaml`);
      if (!flowContent.has(scope.flow) && existsSync(flowYaml)) {
        flowContent.set(scope.flow, readFileSync(flowYaml, "utf-8"));
      }
    }
  }

  return {
    basePath: metaRepoPath,
    index,
    architectureMd,
    conventionsMd,
    componentContent,
    flowContent,
  };
}

/**
 * Load component content from cache or catalog directory.
 */
function loadComponentContent(
  id: string,
  index: CatalogIndex,
  metaRepoPath: string,
  cachePath?: string,
): ComponentContent | null {
  const comp = index.components.find((c) => c.id === id);
  if (!comp) return null;

  let docs = "";
  const contracts: ContractFile[] = [];

  // Try to load from cache directory first
  if (cachePath) {
    const cachedDocsDir = resolve(cachePath, id, "docs");
    if (existsSync(cachedDocsDir)) {
      docs = readDirMarkdown(cachedDocsDir);
    }

    const cachedContractsDir = resolve(cachePath, id, "contracts");
    if (existsSync(cachedContractsDir)) {
      const contractFiles = readDirFiles(cachedContractsDir);
      for (const [filename, content] of contractFiles) {
        // Derive contract id from filename
        const contractId = filename.replace(/\.[^.]+$/, "");
        // Find confidence from provides
        const provideEntry = comp.provides.find((p) => p.id === contractId);
        contracts.push({
          id: contractId,
          content,
          confidence: provideEntry?.confidence ?? "unknown",
        });
      }
    }
  }

  // Fallback: try component directory in catalog
  if (!docs) {
    const compDir = resolve(metaRepoPath, "catalog", "components", id);
    if (existsSync(compDir)) {
      const docsDir = resolve(compDir, "docs");
      if (existsSync(docsDir)) {
        docs = readDirMarkdown(docsDir);
      }
    }
  }

  return { docs, contracts };
}

/**
 * Read all markdown files in a directory and concatenate them.
 */
function readDirMarkdown(dir: string): string {
  const parts: string[] = [];
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const file of files) {
      const filePath = resolve(dir, file);
      const stat = statSync(filePath);
      if (stat.isFile()) {
        parts.push(readFileSync(filePath, "utf-8"));
      }
    }
  } catch {
    // ignore read errors
  }
  return parts.join("\n\n");
}

/**
 * Read all files in a directory and return as [filename, content] pairs.
 */
function readDirFiles(dir: string): [string, string][] {
  const result: [string, string][] = [];
  try {
    const files = readdirSync(dir).sort();
    for (const file of files) {
      const filePath = resolve(dir, file);
      const stat = statSync(filePath);
      if (stat.isFile()) {
        result.push([file, readFileSync(filePath, "utf-8")]);
      }
    }
  } catch {
    // ignore
  }
  return result;
}

/* ─── Output ──────────────────────────────────────────────────────────── */

function printOutput(manifest: BundleManifest, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
  } else {
    process.stdout.write(`✓ Bundle assembled: ${manifest.files.length} files\n`);
    process.stdout.write(`  Total tokens: ${manifest.totalTokens} / ${manifest.budget}\n`);
    if (manifest.truncated.length > 0) {
      process.stdout.write(`  Truncated layers: ${manifest.truncated.length}\n`);
      for (const t of manifest.truncated) {
        process.stdout.write(`    - ${t.layerId}: ${t.originalTokens} → ${t.truncatedTo}\n`);
      }
    }
    process.stdout.write("  Files:\n");
    for (const f of manifest.files) {
      process.stdout.write(`    ${f.filename} (${f.tokens} tokens)\n`);
    }
  }
}
