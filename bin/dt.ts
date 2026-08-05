#!/usr/bin/env node
/**
 * dt CLI — runtime binary.
 * Commands: extract, catalog, ctx, scope, init, verify, validate-component
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "#adapters/cli/parse-args.js";
import { ExitCode } from "#core/exit-codes.js";

const COMMANDS = [
  "extract",
  "catalog",
  "ctx",
  "scope",
  "init",
  "verify",
  "validate-component",
] as const;

function getVersion(): string {
  // Walk up from bin/ (source) or dist/bin/ (compiled) to find package.json
  let dir = import.meta.dirname;
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // not found, keep going up
    }
    dir = resolve(dir, "..");
  }
  return "unknown";
}

function printUsage(): void {
  const usage = `Usage: dt <command> [options]

Commands:
  extract              Extract component metadata from the repository
  catalog              Manage the service catalog
  ctx                  Generate or query multi-repo context
  scope                Define and manage extraction scope
  init                 Initialize a new component configuration
  verify               Verify component.json integrity
  validate-component   Validate component.json against schema

Options:
  --version      Print version
  --json         Output as JSON
  --meta-repo    Path to meta repository
  -v, --verbose  Verbose output
  -h, --help     Show this help message
`;
  process.stderr.write(usage);
}

const args = parseArgs(process.argv.slice(2));

if (args.flags.version) {
  process.stdout.write(getVersion() + "\n");
  process.exit(ExitCode.Success);
}

if (args.flags.help) {
  printUsage();
  process.exit(ExitCode.Success);
}

if (!args.command) {
  printUsage();
  process.exit(ExitCode.InvalidUsage);
}

if (!COMMANDS.includes(args.command as (typeof COMMANDS)[number])) {
  process.stderr.write(`Unknown command: ${args.command}\n\n`);
  printUsage();
  process.exit(ExitCode.InvalidUsage);
}

// Command routing
if (args.command === "extract") {
  const subcommand = args.positional[0];
  if (subcommand === "detect") {
    const { runExtractDetect } = await import("#adapters/cli/extract-detect.js");
    const targetDir = args.positional[1]; // optional: path to repo
    const exitCode = runExtractDetect({
      json: args.flags.json,
      targetDir,
    });
    process.exit(exitCode);
  } else if (subcommand === "schema") {
    const { runExtractSchema } = await import("#adapters/cli/extract-schema.js");
    const targetDir = args.positional[1]; // optional: path to repo
    const exitCode = await runExtractSchema({
      json: args.flags.json,
      targetDir,
      dbUrl: args.flags.dbUrl,
    });
    process.exit(exitCode);
  } else if (subcommand === "openapi") {
    const { runExtractOpenApi } = await import("#adapters/cli/extract-openapi.js");
    const targetDir = args.positional[1]; // optional: path to repo
    const strategyFlag = args.flags.strategy as "auto" | "1" | "3" | undefined;
    const exitCode = runExtractOpenApi({
      json: args.flags.json,
      targetDir,
      strategy: strategyFlag,
    });
    process.exit(exitCode);
  } else if (subcommand === "asyncapi") {
    const { runExtractAsyncApi } = await import("#adapters/cli/extract-asyncapi.js");
    const targetDir = args.positional[1]; // optional: path to repo
    const exitCode = runExtractAsyncApi({
      json: args.flags.json,
      targetDir,
    });
    process.exit(exitCode);
  } else if (subcommand === "component") {
    const { runExtractComponent } = await import("#adapters/cli/extract-component.js");
    const targetDir = args.positional[1]; // optional: path to repo
    const exitCode = await runExtractComponent({
      json: args.flags.json,
      interactive: args.flags.interactive,
      force: args.flags.force,
      targetDir,
    });
    process.exit(exitCode);
  } else if (subcommand === "all") {
    const { runExtractAll } = await import("#adapters/cli/extract-all.js");
    const targetDir = args.positional[1]; // optional: path to repo
    const exitCode = await runExtractAll({
      json: args.flags.json,
      interactive: args.flags.interactive,
      force: args.flags.force,
      targetDir,
    });
    process.exit(exitCode);
  } else if (!subcommand) {
    process.stderr.write("Usage: dt extract <subcommand>\n\n");
    process.stderr.write("Subcommands:\n");
    process.stderr.write("  detect    Detect repository stack and framework\n");
    process.stderr.write("  schema    Extract database schema\n");
    process.stderr.write("  openapi   Extract OpenAPI specification\n");
    process.stderr.write("  asyncapi  Extract AsyncAPI specification\n");
    process.stderr.write("  component Derive component.json\n");
    process.stderr.write("  all       Run full extraction pipeline\n");
    process.exit(ExitCode.InvalidUsage);
  } else {
    process.stderr.write(`Subcommand 'extract ${subcommand}' is not yet implemented.\n`);
    process.exit(ExitCode.GeneralError);
  }
} else if (args.command === "validate-component") {
  const { runValidateComponent } = await import("#adapters/cli/validate-component.js");
  const path = args.positional[0];
  const exitCode = runValidateComponent({
    json: args.flags.json,
    path,
  });
  process.exit(exitCode);
} else if (args.command === "catalog") {
  const subcommand = args.positional[0];
  if (subcommand === "build") {
    const { runCatalogBuild } = await import("#adapters/cli/catalog-build.js");
    // Parse --registry and --concurrency from remaining positional/flags
    let registry: string | undefined;
    let concurrency: number | undefined;
    for (let i = 1; i < args.positional.length; i++) {
      const p = args.positional[i];
      if (p === "--registry" && args.positional[i + 1]) {
        registry = args.positional[++i];
      } else if (p === "--concurrency" && args.positional[i + 1]) {
        concurrency = parseInt(args.positional[++i], 10);
      } else if (p.startsWith("--registry=")) {
        registry = p.slice("--registry=".length);
      } else if (p.startsWith("--concurrency=")) {
        concurrency = parseInt(p.slice("--concurrency=".length), 10);
      }
    }
    const exitCode = await runCatalogBuild({
      json: args.flags.json,
      registry,
      concurrency,
    });
    process.exit(exitCode);
  } else if (subcommand === "validate") {
    const { runCatalogValidate } = await import("#adapters/cli/catalog-validate.js");
    // Parse --strict, --catalog-dir, --index from remaining positional/flags
    let strict = false;
    let catalogDir: string | undefined;
    let indexPath: string | undefined;
    for (let i = 1; i < args.positional.length; i++) {
      const p = args.positional[i];
      if (p === "--strict") {
        strict = true;
      } else if (p === "--catalog-dir" && args.positional[i + 1]) {
        catalogDir = args.positional[++i];
      } else if (p.startsWith("--catalog-dir=")) {
        catalogDir = p.slice("--catalog-dir=".length);
      } else if (p === "--index" && args.positional[i + 1]) {
        indexPath = args.positional[++i];
      } else if (p.startsWith("--index=")) {
        indexPath = p.slice("--index=".length);
      }
    }
    const exitCode = runCatalogValidate({
      json: args.flags.json,
      strict,
      catalogDir,
      indexPath,
    });
    process.exit(exitCode);
  } else if (subcommand === "scaffold") {
    const { runCatalogScaffold } = await import("#adapters/cli/catalog-scaffold.js");
    let out: string | undefined;
    for (let i = 1; i < args.positional.length; i++) {
      const p = args.positional[i];
      if (p === "--out" && args.positional[i + 1]) {
        out = args.positional[++i];
      } else if (p.startsWith("--out=")) {
        out = p.slice("--out=".length);
      }
    }
    const exitCode = runCatalogScaffold({
      json: args.flags.json,
      out,
      force: args.flags.force,
    });
    process.exit(exitCode);
  } else if (
    subcommand === "resolve" ||
    subcommand === "get" ||
    subcommand === "deps" ||
    subcommand === "consumers" ||
    subcommand === "flow" ||
    subcommand === "closure" ||
    subcommand === "coverage"
  ) {
    const { runCatalogQuery } = await import("#adapters/cli/catalog-query.js");
    const exitCode = runCatalogQuery({
      subcommand,
      positional: args.positional.slice(1),
      json: args.flags.json,
    });
    process.exit(exitCode);
  } else if (!subcommand) {
    process.stderr.write("Usage: dt catalog <subcommand>\n\n");
    process.stderr.write("Subcommands:\n");
    process.stderr.write("  build       Build the catalog index from registry\n");
    process.stderr.write("  validate    Validate catalog referential integrity\n");
    process.stderr.write("  resolve     Resolve text to components\n");
    process.stderr.write("  get         Get a component by id\n");
    process.stderr.write("  deps        List dependencies of a component\n");
    process.stderr.write("  consumers   List consumers of a contract\n");
    process.stderr.write("  flow        Show flow with participants\n");
    process.stderr.write("  closure     Compute transitive dependency closure\n");
    process.stderr.write("  coverage    Report extraction quality\n");
    process.stderr.write("  scaffold    Generate meta-repo scaffold\n");
    process.exit(ExitCode.InvalidUsage);
  } else {
    process.stderr.write(`Subcommand 'catalog ${subcommand}' is not yet implemented.\n`);
    process.exit(ExitCode.GeneralError);
  }
} else if (args.command === "ctx") {
  const subcommand = args.positional[0];
  if (subcommand === "fetch") {
    const { runCtxFetch } = await import("#adapters/cli/ctx-fetch.js");
    // Parse --repos, --refresh, --concurrency from remaining positional/flags
    let repos: string | undefined;
    let refresh = false;
    let concurrency: number | undefined;
    for (let i = 1; i < args.positional.length; i++) {
      const p = args.positional[i];
      if (p === "--repos" && args.positional[i + 1]) {
        repos = args.positional[++i];
      } else if (p.startsWith("--repos=")) {
        repos = p.slice("--repos=".length);
      } else if (p === "--refresh") {
        refresh = true;
      } else if (p === "--concurrency" && args.positional[i + 1]) {
        concurrency = parseInt(args.positional[++i], 10);
      } else if (p.startsWith("--concurrency=")) {
        concurrency = parseInt(p.slice("--concurrency=".length), 10);
      }
    }
    const exitCode = await runCtxFetch({
      json: args.flags.json,
      repos,
      metaRepo: args.flags.metaRepo,
      refresh,
      concurrency,
    });
    process.exit(exitCode);
  } else if (subcommand === "gc") {
    const { runCtxGC } = await import("#adapters/cli/ctx-fetch.js");
    let maxSize: string | undefined;
    let maxAge: string | undefined;
    for (let i = 1; i < args.positional.length; i++) {
      const p = args.positional[i];
      if (p === "--max-size" && args.positional[i + 1]) {
        maxSize = args.positional[++i];
      } else if (p.startsWith("--max-size=")) {
        maxSize = p.slice("--max-size=".length);
      } else if (p === "--max-age" && args.positional[i + 1]) {
        maxAge = args.positional[++i];
      } else if (p.startsWith("--max-age=")) {
        maxAge = p.slice("--max-age=".length);
      }
    }
    const exitCode = runCtxGC({
      json: args.flags.json,
      maxSize,
      maxAge,
    });
    process.exit(exitCode);
  } else if (subcommand === "assemble") {
    const { runCtxAssemble } = await import("#adapters/cli/ctx-assemble.js");
    let scope: string | undefined;
    let out: string | undefined;
    let budget: number | undefined;
    let cachePath: string | undefined;
    for (let i = 1; i < args.positional.length; i++) {
      const p = args.positional[i];
      if (p === "--scope" && args.positional[i + 1]) {
        scope = args.positional[++i];
      } else if (p.startsWith("--scope=")) {
        scope = p.slice("--scope=".length);
      } else if (p === "--out" && args.positional[i + 1]) {
        out = args.positional[++i];
      } else if (p.startsWith("--out=")) {
        out = p.slice("--out=".length);
      } else if (p === "--budget" && args.positional[i + 1]) {
        budget = parseInt(args.positional[++i], 10);
      } else if (p.startsWith("--budget=")) {
        budget = parseInt(p.slice("--budget=".length), 10);
      } else if (p === "--cache-path" && args.positional[i + 1]) {
        cachePath = args.positional[++i];
      } else if (p.startsWith("--cache-path=")) {
        cachePath = p.slice("--cache-path=".length);
      }
    }
    const exitCode = runCtxAssemble({
      json: args.flags.json,
      scope,
      out,
      budget,
      metaRepo: args.flags.metaRepo,
      cachePath,
    });
    process.exit(exitCode);
  } else if (!subcommand) {
    process.stderr.write("Usage: dt ctx <subcommand>\n\n");
    process.stderr.write("Subcommands:\n");
    process.stderr.write("  fetch     Sparse-clone repos and cache by SHA\n");
    process.stderr.write("  gc        Run cache garbage collection\n");
    process.stderr.write("  assemble  Build layered context bundle\n");
    process.exit(ExitCode.InvalidUsage);
  } else {
    process.stderr.write(`Subcommand 'ctx ${subcommand}' is not yet implemented.\n`);
    process.exit(ExitCode.GeneralError);
  }
} else if (args.command === "init") {
  const { runInit } = await import("#adapters/cli/init.js");
  // Parse --components, --max-index-age, --no-llm, --out, --budget, --concurrency
  let components: string | undefined;
  let maxIndexAge: number | undefined;
  let noLlm = false;
  let out: string | undefined;
  let budget: number | undefined;
  let concurrency: number | undefined;
  for (const p of args.positional) {
    if (p === "--no-llm") {
      noLlm = true;
    } else if (p.startsWith("--components=")) {
      components = p.slice("--components=".length);
    } else if (p.startsWith("--max-index-age=")) {
      maxIndexAge = parseInt(p.slice("--max-index-age=".length), 10);
    } else if (p.startsWith("--out=")) {
      out = p.slice("--out=".length);
    } else if (p.startsWith("--budget=")) {
      budget = parseInt(p.slice("--budget=".length), 10);
    } else if (p.startsWith("--concurrency=")) {
      concurrency = parseInt(p.slice("--concurrency=".length), 10);
    }
  }
  // Handle --key value style
  for (let i = 0; i < args.positional.length; i++) {
    const p = args.positional[i];
    if (p === "--components" && args.positional[i + 1]) {
      components = args.positional[++i];
    } else if (p === "--max-index-age" && args.positional[i + 1]) {
      maxIndexAge = parseInt(args.positional[++i], 10);
    } else if (p === "--out" && args.positional[i + 1]) {
      out = args.positional[++i];
    } else if (p === "--budget" && args.positional[i + 1]) {
      budget = parseInt(args.positional[++i], 10);
    } else if (p === "--concurrency" && args.positional[i + 1]) {
      concurrency = parseInt(args.positional[++i], 10);
    }
  }
  const exitCode = await runInit({
    json: args.flags.json,
    components,
    metaRepo: args.flags.metaRepo,
    maxIndexAge,
    noLlm,
    out,
    budget,
    concurrency,
  });
  process.exit(exitCode);
} else if (args.command === "scope") {
  // The scope command requires an LLM provider.
  // Parse --task and --candidates to check usage, but actual execution needs a provider.
  // Future: load provider from config/environment.
  const _scopeImport = await import("#adapters/cli/scope.js");
  void _scopeImport; // loaded to verify import works
  const msg = "LLM provider not configured. Set DT_LLM_PROVIDER or pass --provider.";
  if (args.flags.json) {
    process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
  } else {
    process.stderr.write(`Error: ${msg}\n`);
    process.stderr.write(
      'Usage: dt scope --task "<text>" --candidates <path> [--out <dir>] [--json]\n',
    );
  }
  process.exit(ExitCode.ConfigurationError);
} else {
  process.stderr.write(`Command '${args.command}' is not yet implemented.\n`);
  process.exit(ExitCode.GeneralError);
}
