#!/usr/bin/env node
/**
 * dev-tasks CLI — bootstrap binary.
 * Commands: install, update, status, pin, doctor
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "#adapters/cli/parse-args.js";
import { ExitCode } from "#core/exit-codes.js";

const COMMANDS = ["install", "update", "status", "pin", "doctor"] as const;

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
  const usage = `Usage: dev-tasks <command> [options]

Commands:
  install    Install dev-tasks skills into the target repository
  update     Update installed skills (hash-based reconciliation)
  status     Show installed vs. pinned vs. latest versions
  pin        Pin to a specific version
  doctor     Check environment prerequisites

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
