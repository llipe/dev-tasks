/**
 * CLI handler for `dt catalog resolve|get|deps|consumers|flow|closure|coverage`.
 *
 * All subcommands support --json output.
 * Reads catalog/index.yaml from the working directory or --index path.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { catalogResolve } from "#core/catalog/resolve.js";
import {
  catalogGet,
  catalogDeps,
  catalogConsumers,
  catalogFlow,
  catalogClosure,
} from "#core/catalog/queries.js";
import { catalogCoverage } from "#core/catalog/coverage.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { DepsDirection } from "#core/catalog/queries.js";
import { ExitCode } from "#core/exit-codes.js";

/* ─── Shared Helpers ───────────────────────────────────────────────── */

function loadIndex(indexPath: string): CatalogIndex | null {
  try {
    const raw = readFileSync(indexPath, "utf-8");
    return parseYaml(raw) as CatalogIndex;
  } catch {
    return null;
  }
}

function resolveIndexPath(providedPath?: string): string | null {
  if (providedPath) {
    const abs = resolve(providedPath);
    return existsSync(abs) ? abs : null;
  }
  const defaultPath = resolve("catalog/index.yaml");
  return existsSync(defaultPath) ? defaultPath : null;
}

function printError(msg: string, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify({ error: msg }) + "\n");
  } else {
    process.stderr.write(`✗ ${msg}\n`);
  }
}

/* ─── CLI Options Parsing ──────────────────────────────────────────── */

export interface CatalogQueryCliArgs {
  subcommand: string;
  positional: string[];
  json: boolean;
}

/**
 * Parse subcommand-specific flags from positional args.
 */
function parseSubcommandFlags(positional: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < positional.length; i++) {
    const arg = positional[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key.includes("=")) {
        const [k, v] = key.split("=", 2);
        flags[k] = v;
      } else {
        // Check if next arg is a value or another flag
        const next = positional[i + 1];
        if (next && !next.startsWith("--")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    }
  }

  return flags;
}

/* ─── Subcommand Handlers ──────────────────────────────────────────── */

export function runCatalogQuery(args: CatalogQueryCliArgs): number {
  const { subcommand, positional, json } = args;
  const flags = parseSubcommandFlags(positional);
  const indexPath = resolveIndexPath(flags["index"] as string | undefined);

  if (!indexPath) {
    printError("Catalog index not found. Run `dt catalog build` first.", json);
    return ExitCode.NotFound;
  }

  const index = loadIndex(indexPath);
  if (!index) {
    printError(`Failed to parse catalog index: ${indexPath}`, json);
    return ExitCode.GeneralError;
  }

  switch (subcommand) {
    case "resolve":
      return handleResolve(index, flags, json);
    case "get":
      return handleGet(index, flags, json);
    case "deps":
      return handleDeps(index, flags, json);
    case "consumers":
      return handleConsumers(index, flags, json);
    case "flow":
      return handleFlow(index, flags, json);
    case "closure":
      return handleClosure(index, flags, json);
    case "coverage":
      return handleCoverage(index, flags, json);
    default:
      printError(`Unknown catalog subcommand: ${subcommand}`, json);
      return ExitCode.InvalidUsage;
  }
}

function handleResolve(
  index: CatalogIndex,
  flags: Record<string, string | boolean>,
  json: boolean,
): number {
  const text = flags["text"] as string | undefined;
  if (!text) {
    printError("Missing required flag: --text <query>", json);
    return ExitCode.InvalidUsage;
  }

  const threshold = flags["threshold"] ? parseInt(flags["threshold"] as string, 10) : undefined;
  const limit = flags["limit"] ? parseInt(flags["limit"] as string, 10) : undefined;

  const candidates = catalogResolve(index, text, { threshold, limit });

  if (json) {
    process.stdout.write(JSON.stringify({ candidates, count: candidates.length }, null, 2) + "\n");
  } else {
    if (candidates.length === 0) {
      process.stdout.write("No matches found.\n");
    } else {
      process.stdout.write(`Found ${candidates.length} candidate(s):\n\n`);
      for (const c of candidates) {
        const signalStr = c.signals.map((s) => `${s.type}(${s.matched})`).join(", ");
        process.stdout.write(`  ${c.id}  score=${c.score}  [${signalStr}]\n`);
      }
    }
  }

  return ExitCode.Success;
}

function handleGet(
  index: CatalogIndex,
  flags: Record<string, string | boolean>,
  json: boolean,
): number {
  const id = flags["id"] as string | undefined;
  if (!id) {
    printError("Missing required flag: --id <component-id>", json);
    return ExitCode.InvalidUsage;
  }

  const component = catalogGet(index, id);
  if (!component) {
    printError(`Component not found: ${id}`, json);
    return ExitCode.NotFound;
  }

  if (json) {
    process.stdout.write(JSON.stringify(component, null, 2) + "\n");
  } else {
    process.stdout.write(`${component.id} (${component.name})\n`);
    process.stdout.write(`  domain: ${component.domain}\n`);
    process.stdout.write(`  type: ${component.type}\n`);
    process.stdout.write(`  lifecycle: ${component.lifecycle}\n`);
    process.stdout.write(`  criticality: ${component.criticality}\n`);
    process.stdout.write(`  owner: ${component.owner}\n`);
    process.stdout.write(
      `  provides: ${component.provides.map((p) => p.id).join(", ") || "none"}\n`,
    );
    process.stdout.write(
      `  consumes: ${component.consumes.map((c) => c.contract).join(", ") || "none"}\n`,
    );
    process.stdout.write(`  aliases: ${component.aliases.join(", ") || "none"}\n`);
  }

  return ExitCode.Success;
}

function handleDeps(
  index: CatalogIndex,
  flags: Record<string, string | boolean>,
  json: boolean,
): number {
  const id = flags["id"] as string | undefined;
  if (!id) {
    printError("Missing required flag: --id <component-id>", json);
    return ExitCode.InvalidUsage;
  }

  const depth = flags["depth"] ? parseInt(flags["depth"] as string, 10) : undefined;
  const direction = (flags["direction"] as DepsDirection | undefined) ?? "down";

  if (direction !== "up" && direction !== "down" && direction !== "both") {
    printError("--direction must be up, down, or both", json);
    return ExitCode.InvalidUsage;
  }

  const result = catalogDeps(index, id, { depth, direction });
  if (!result) {
    printError(`Component not found: ${id}`, json);
    return ExitCode.NotFound;
  }

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          id: result.id,
          direction,
          depth: depth ?? "unlimited",
          count: result.dependencies.length,
          dependencies: result.dependencies.map((d) => ({
            id: d.id,
            name: d.name,
            domain: d.domain,
          })),
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(
      `Dependencies of ${id} (direction=${direction}, depth=${depth ?? "∞"}):\n\n`,
    );
    if (result.dependencies.length === 0) {
      process.stdout.write("  (none)\n");
    } else {
      for (const dep of result.dependencies) {
        process.stdout.write(`  ${dep.id} (${dep.domain})\n`);
      }
    }
  }

  return ExitCode.Success;
}

function handleConsumers(
  index: CatalogIndex,
  flags: Record<string, string | boolean>,
  json: boolean,
): number {
  const contract = flags["contract"] as string | undefined;
  if (!contract) {
    printError("Missing required flag: --contract <contract-id>", json);
    return ExitCode.InvalidUsage;
  }

  const result = catalogConsumers(index, contract);
  if (!result) {
    printError(`Contract not found: ${contract}`, json);
    return ExitCode.NotFound;
  }

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          contract: result.contract,
          provider: result.provider,
          count: result.consumers.length,
          consumers: result.consumers.map((c) => ({ id: c.id, name: c.name, domain: c.domain })),
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(`Consumers of ${contract} (provider: ${result.provider}):\n\n`);
    if (result.consumers.length === 0) {
      process.stdout.write("  (none)\n");
    } else {
      for (const c of result.consumers) {
        process.stdout.write(`  ${c.id} (${c.domain})\n`);
      }
    }
  }

  return ExitCode.Success;
}

function handleFlow(
  index: CatalogIndex,
  flags: Record<string, string | boolean>,
  json: boolean,
): number {
  const id = flags["id"] as string | undefined;
  if (!id) {
    printError("Missing required flag: --id <flow-id>", json);
    return ExitCode.InvalidUsage;
  }

  const result = catalogFlow(index, id);
  if (!result) {
    printError(`Flow not found: ${id}`, json);
    return ExitCode.NotFound;
  }

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          flow: result.flow,
          components: result.components.map((c) => ({ id: c.id, name: c.name, domain: c.domain })),
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(`Flow: ${result.flow.name} (${result.flow.id})\n`);
    if (result.flow.description) {
      process.stdout.write(`  ${result.flow.description}\n`);
    }
    process.stdout.write(`\n  Participants:\n`);
    for (const c of result.components) {
      process.stdout.write(`    ${c.id} (${c.domain})\n`);
    }
  }

  return ExitCode.Success;
}

function handleClosure(
  index: CatalogIndex,
  flags: Record<string, string | boolean>,
  json: boolean,
): number {
  const idsStr = flags["ids"] as string | undefined;
  if (!idsStr) {
    printError("Missing required flag: --ids <id1,id2,...>", json);
    return ExitCode.InvalidUsage;
  }

  const ids = idsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const includeConsumers = flags["include-consumers"] === true;
  const max = flags["max"] ? parseInt(flags["max"] as string, 10) : undefined;

  const result = catalogClosure(index, ids, { includeConsumers, max });
  if (!result) {
    printError(`One or more component ids not found: ${ids.join(", ")}`, json);
    return ExitCode.NotFound;
  }

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          roots: result.roots,
          includeConsumers,
          max: max ?? "unlimited",
          count: result.components.length,
          capped: result.capped,
          deduplicated: result.deduplicated,
          components: result.components.map((c) => ({ id: c.id, name: c.name, domain: c.domain })),
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(
      `Closure for [${ids.join(", ")}] (consumers=${includeConsumers}, max=${max ?? "∞"}):\n\n`,
    );
    process.stdout.write(`  ${result.components.length} components total:\n`);
    for (const c of result.components) {
      const isRoot = ids.includes(c.id) ? " (root)" : "";
      process.stdout.write(`    ${c.id} (${c.domain})${isRoot}\n`);
    }
    if (result.capped) {
      process.stdout.write(`\n  ⚠ Result capped at ${max} components\n`);
    }
  }

  return ExitCode.Success;
}

function handleCoverage(
  index: CatalogIndex,
  flags: Record<string, string | boolean>,
  json: boolean,
): number {
  const id = flags["id"] as string | undefined;

  const report = catalogCoverage(index, id);
  if (!report) {
    printError(`Component not found: ${id}`, json);
    return ExitCode.NotFound;
  }

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(`Extraction Quality Coverage${id ? ` (${id})` : ""}:\n\n`);
    process.stdout.write(
      `  Total fields: ${report.total.fields}  ` +
        `high=${report.total.high} (${(report.ratios.high * 100).toFixed(0)}%)  ` +
        `medium=${report.total.medium} (${(report.ratios.medium * 100).toFixed(0)}%)  ` +
        `low=${report.total.low} (${(report.ratios.low * 100).toFixed(0)}%)\n\n`,
    );

    if (report.components.length <= 20) {
      for (const c of report.components) {
        const bar =
          `h=${c.counts.high} m=${c.counts.medium} l=${c.counts.low}` +
          (c.unresolved > 0 ? ` unresolved=${c.unresolved}` : "");
        process.stdout.write(`  ${c.id}: ${bar}\n`);
      }
    } else {
      process.stdout.write(
        `  (${report.components.length} components — use --json for full list)\n`,
      );
    }
  }

  return ExitCode.Success;
}
