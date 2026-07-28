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
  verify               Verify component.yaml integrity
  validate-component   Validate component.yaml against schema

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

// Command routing — stubs for now
process.stderr.write(`Command '${args.command}' is not yet implemented.\n`);
process.exit(ExitCode.GeneralError);
