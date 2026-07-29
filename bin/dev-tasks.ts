#!/usr/bin/env node
/**
 * dev-tasks CLI — bootstrap binary.
 * Commands: install, update, status, pin, doctor
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "#adapters/cli/parse-args.js";
import { ExitCode } from "#core/exit-codes.js";
import { installSkills } from "#core/distribution/install.js";
import { writePin } from "#core/distribution/pin.js";
import { getStatus } from "#core/distribution/status.js";
import { runDoctor } from "#core/distribution/doctor.js";

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

function getPackageRoot(): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, "package.json");
    try {
      readFileSync(candidate, "utf-8");
      return dir;
    } catch {
      // not found, keep going up
    }
    dir = resolve(dir, "..");
  }
  return process.cwd();
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
  --pin <ver>    Pin to a specific version (used with install)
  --meta-repo    Path to meta repository
  -v, --verbose  Verbose output
  -h, --help     Show this help message
`;
  process.stderr.write(usage);
}

async function main(): Promise<void> {
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

  const targetDir = process.cwd();
  const packageRoot = getPackageRoot();
  const currentVersion = getVersion();

  switch (args.command) {
    case "install": {
      const pinVersion = args.flags.pin ?? currentVersion;
      const result = await installSkills({
        sourceDir: packageRoot,
        targetDir,
        version: currentVersion,
        pin: pinVersion,
      });

      if (args.flags.json) {
        process.stdout.write(
          JSON.stringify(
            {
              command: "install",
              version: currentVersion,
              pinned: pinVersion,
              installed: result.installed.length,
              skills: result.installed,
              manifestPath: result.manifestPath,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        process.stdout.write(
          `Installed ${result.installed.length} skill(s) (v${currentVersion})\n`,
        );
        for (const skill of result.installed) {
          process.stdout.write(`  ✓ ${skill.name} → ${skill.path}\n`);
        }
        process.stdout.write(`Manifest written to ${result.manifestPath}\n`);
      }
      process.exit(ExitCode.Success);
      break;
    }

    case "pin": {
      const version = args.positional[0];
      if (!version) {
        process.stderr.write("Usage: dev-tasks pin <version>\n");
        process.exit(ExitCode.InvalidUsage);
      }
      await writePin(targetDir, version);
      if (args.flags.json) {
        process.stdout.write(JSON.stringify({ command: "pin", version }, null, 2) + "\n");
      } else {
        process.stdout.write(`Pinned to version ${version}\n`);
      }
      process.exit(ExitCode.Success);
      break;
    }

    case "status": {
      const result = await getStatus(targetDir, currentVersion);
      if (args.flags.json) {
        process.stdout.write(JSON.stringify({ command: "status", ...result }, null, 2) + "\n");
      } else {
        process.stdout.write(`Installed: ${result.installed ?? "not installed"}\n`);
        process.stdout.write(`Pinned:    ${result.pinned ?? "none"}\n`);
        process.stdout.write(`Latest:    ${result.latest}\n`);
        process.stdout.write(`Status:    ${result.upToDate ? "up to date" : "update available"}\n`);
      }
      process.exit(ExitCode.Success);
      break;
    }

    case "doctor": {
      const checks = await runDoctor({ repoRoot: targetDir });
      if (args.flags.json) {
        const allPass = checks.every((c) => c.pass);
        process.stdout.write(
          JSON.stringify({ command: "doctor", ok: allPass, checks }, null, 2) + "\n",
        );
      } else {
        for (const check of checks) {
          const icon = check.pass ? "✓" : "✗";
          process.stdout.write(`  ${icon} ${check.name}: ${check.message}\n`);
        }
        const allPass = checks.every((c) => c.pass);
        process.stdout.write(allPass ? "\nAll checks passed.\n" : "\nSome checks failed.\n");
      }
      const allPass = checks.every((c) => c.pass);
      process.exit(allPass ? ExitCode.Success : ExitCode.DependencyError);
      break;
    }

    case "update": {
      // Stub — will be implemented in S-003
      process.stderr.write("Command 'update' is not yet implemented.\n");
      process.exit(ExitCode.GeneralError);
      break;
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(ExitCode.GeneralError);
});
