#!/usr/bin/env node
/**
 * dev-tasks CLI — bootstrap binary.
 * Commands: install, update, status, pin, unpin, doctor
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "#adapters/cli/parse-args.js";
import { ExitCode } from "#core/exit-codes.js";
import { installFiles } from "#core/distribution/install.js";
import { isValidProfile, VALID_PROFILES, type Profile } from "#core/distribution/profiles.js";
import { runUpdate } from "#core/distribution/update.js";
import { writePin, removePin } from "#core/distribution/pin.js";
import { getStatus } from "#core/distribution/status.js";
import { runDoctor } from "#core/distribution/doctor.js";
import { runMigration } from "#core/distribution/migrate.js";

const COMMANDS = ["install", "update", "status", "pin", "unpin", "doctor", "migrate"] as const;

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
  install    Install dev-tasks agent toolkit into the target repository
  update     Update installed files (respects pin; fetches from registry if pinned)
  status     Show installed vs. pinned vs. latest versions
  pin        Pin to a specific version
  unpin      Remove the version pin
  doctor     Check environment prerequisites
  migrate    Migrate from legacy dev-tasks.sh installation

Options:
  --profile <p>  Platform profile: copilot, claude, kiro, both, all (default: all)
  --version      Print version
  --json         Output as JSON
  --pin <ver>    Pin to a specific version (used with install)
  --force        Force-overwrite conflicting files (backs them up first)
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
      // Validate --profile flag
      const profileValue = args.flags.profile ?? "all";
      if (!isValidProfile(profileValue)) {
        process.stderr.write(
          `Invalid profile: "${profileValue}"\nValid profiles: ${VALID_PROFILES.join(", ")}\n`,
        );
        process.exit(ExitCode.InvalidUsage);
      }
      const profile = profileValue as Profile;

      const pinVersion = args.flags.pin ?? currentVersion;
      const result = await installFiles({
        sourceDir: packageRoot,
        targetDir,
        version: currentVersion,
        pin: pinVersion,
        profile,
      });

      if (args.flags.json) {
        process.stdout.write(
          JSON.stringify(
            {
              command: "install",
              version: currentVersion,
              pinned: pinVersion,
              profile,
              platforms: result.platforms,
              installed: result.installed.length,
              files: result.installed,
              manifestPath: result.manifestPath,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        process.stdout.write(
          `Installed ${result.installed.length} file(s) for profile "${profile}" (v${currentVersion})\n`,
        );
        process.stdout.write(`Platforms: ${result.platforms.join(", ")}\n`);
        for (const file of result.installed) {
          process.stdout.write(`  ✓ ${file.path}\n`);
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

    case "unpin": {
      const removed = await removePin(targetDir);
      if (args.flags.json) {
        process.stdout.write(JSON.stringify({ command: "unpin", removed }, null, 2) + "\n");
      } else {
        if (removed) {
          process.stdout.write("Version pin removed.\n");
        } else {
          process.stdout.write("No version pin found.\n");
        }
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
      const result = await runUpdate({
        targetDir,
        sourceDir: packageRoot,
        force: args.flags.force,
        version: currentVersion,
      });

      const hasConflicts = result.conflicts.length > 0;

      if (args.flags.json) {
        process.stdout.write(
          JSON.stringify(
            {
              command: "update",
              resolvedVersion: result.resolvedVersion,
              fetched: result.fetched,
              autoMigrated: result.autoMigrated,
              conflicts: result.conflicts.map((c) => ({
                path: c.path,
                action: c.action,
                localHash: c.localHash,
                originHash: c.originHash,
                packageHash: c.packageHash,
              })),
              updated: result.updated.map((u) => ({
                path: u.path,
                action: u.action,
              })),
              installed: result.installed.map((i) => ({
                path: i.path,
                action: i.action,
              })),
              skipped: result.skipped.map((s) => ({
                path: s.path,
                action: s.action,
              })),
              backupDir: result.backupDir,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        // Human-readable output
        if (result.autoMigrated) {
          process.stdout.write("Auto-migrated: created manifest from existing managed files.\n\n");
        }
        if (result.fetched) {
          process.stdout.write(`Pinned to ${result.resolvedVersion} (fetched from registry).\n\n`);
        }
        if (
          result.installed.length === 0 &&
          result.updated.length === 0 &&
          result.conflicts.length === 0 &&
          result.skipped.length === 0
        ) {
          process.stdout.write("Nothing to update — no manifest found or no files installed.\n");
        } else {
          if (result.installed.length > 0) {
            process.stdout.write(`Installed ${result.installed.length} new file(s):\n`);
            for (const f of result.installed) {
              process.stdout.write(`  + ${f.path}\n`);
            }
          }
          if (result.updated.length > 0) {
            process.stdout.write(`Updated ${result.updated.length} file(s):\n`);
            for (const f of result.updated) {
              process.stdout.write(`  ↑ ${f.path}\n`);
            }
          }
          if (result.skipped.length > 0) {
            process.stdout.write(`Skipped ${result.skipped.length} file(s) (up to date).\n`);
          }
          if (result.backupDir) {
            process.stdout.write(`Backup created at: ${result.backupDir}\n`);
          }
          if (hasConflicts) {
            process.stdout.write(`\nConflicts detected (${result.conflicts.length} file(s)):\n`);
            for (const c of result.conflicts) {
              process.stdout.write(`  ✗ ${c.path}\n`);
              process.stdout.write(`    local:   ${c.localHash}\n`);
              process.stdout.write(`    origin:  ${c.originHash}\n`);
              process.stdout.write(`    package: ${c.packageHash}\n`);
            }
            process.stdout.write("\nUse --force to backup conflicting files and overwrite.\n");
          }
        }
      }

      process.exit(hasConflicts ? ExitCode.ReconciliationConflict : ExitCode.Success);
      break;
    }

    case "migrate": {
      const result = await runMigration(targetDir);

      if (args.flags.json) {
        process.stdout.write(
          JSON.stringify(
            {
              command: "migrate",
              success: result.success,
              manifestWritten: result.manifestWritten,
              reason: result.reason,
              filesDiscovered: result.filesDiscovered,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        if (result.manifestWritten) {
          process.stdout.write(`Migration complete: ${result.reason}\n`);
          process.stdout.write(
            `Manifest written with ${result.filesDiscovered} file(s) marked as modified: unknown.\n`,
          );
          process.stdout.write(
            "\nYour first 'dev-tasks update' will report conflicts for these files.\n",
          );
          process.stdout.write(
            "This is expected — review changes before accepting them, or use --force.\n",
          );
        } else {
          process.stdout.write(`No migration needed: ${result.reason}\n`);
        }
      }
      process.exit(ExitCode.Success);
      break;
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(ExitCode.GeneralError);
});
