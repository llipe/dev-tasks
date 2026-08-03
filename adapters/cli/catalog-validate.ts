/**
 * CLI handler for `dt catalog validate [--strict] [--json]`.
 *
 * Runs V01-V19 referential integrity and structural checks against
 * the catalog index. Errors abort with exit 4; warnings do not.
 */

import { resolve, dirname } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { catalogValidate } from "#core/catalog/validate.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { ValidationReport } from "#core/catalog/validate.js";
import { ExitCode } from "#core/exit-codes.js";

export interface CatalogValidateCliOptions {
  json: boolean;
  strict: boolean;
  catalogDir?: string;
  indexPath?: string;
  allowedCycles?: string[][];
}

export interface CatalogValidateOutput {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  checks: Array<{
    check: string;
    description: string;
    severity: string;
    passed: boolean;
    violationCount: number;
    violations: Array<{
      entity: string;
      message: string;
    }>;
  }>;
}

/**
 * Load and parse the catalog index.yaml.
 */
function loadIndex(indexPath: string): CatalogIndex | null {
  try {
    const raw = readFileSync(indexPath, "utf-8");
    return parseYaml(raw) as CatalogIndex;
  } catch {
    return null;
  }
}

/**
 * Convert the internal report to CLI output format.
 */
function toOutput(report: ValidationReport): CatalogValidateOutput {
  return {
    passed: report.passed,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    checks: report.checks.map((c) => ({
      check: c.check,
      description: c.description,
      severity: c.severity,
      passed: c.passed,
      violationCount: c.violations.length,
      violations: c.violations.map((v) => ({
        entity: v.entity,
        message: v.message,
      })),
    })),
  };
}

/**
 * Run the `dt catalog validate` command.
 * Returns exit code: 0 if no errors, 4 if validation errors present.
 */
export function runCatalogValidate(options: CatalogValidateCliOptions): number {
  const { json, strict, allowedCycles } = options;

  // Determine catalog directory and index path
  let catalogDir = options.catalogDir ? resolve(options.catalogDir) : undefined;
  let indexPath = options.indexPath ? resolve(options.indexPath) : undefined;

  // Default: look for catalog/index.yaml in cwd
  if (!indexPath && !catalogDir) {
    const defaultPath = resolve("catalog/index.yaml");
    if (existsSync(defaultPath)) {
      indexPath = defaultPath;
      catalogDir = dirname(indexPath);
    }
  }

  if (!indexPath && catalogDir) {
    indexPath = resolve(catalogDir, "index.yaml");
  }

  if (!indexPath || !existsSync(indexPath)) {
    const msg = "Catalog index not found. Run `dt catalog build` first.";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    } else {
      process.stderr.write(`✗ ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  const index = loadIndex(indexPath);
  if (!index) {
    const msg = `Failed to parse catalog index: ${indexPath}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    } else {
      process.stderr.write(`✗ ${msg}\n`);
    }
    return ExitCode.GeneralError;
  }

  const report = catalogValidate(index, {
    strict,
    catalogDir,
    allowedCycles,
  });

  const output = toOutput(report);

  if (json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  return report.passed ? ExitCode.Success : ExitCode.AuthError;
}

function printHumanOutput(output: CatalogValidateOutput): void {
  const failedChecks = output.checks.filter((c) => !c.passed);
  const passedChecks = output.checks.filter((c) => c.passed);

  if (output.passed) {
    process.stdout.write(
      `✓ Catalog validation passed (${passedChecks.length} checks, ${output.warningCount} warning(s))\n`,
    );
  } else {
    process.stderr.write(
      `✗ Catalog validation failed: ${output.errorCount} error(s), ${output.warningCount} warning(s)\n`,
    );
  }

  // Print failed checks
  for (const check of failedChecks) {
    const icon = check.severity === "error" ? "✗" : "⚠";
    process.stderr.write(`\n  ${icon} ${check.check}: ${check.description} [${check.severity}]\n`);
    for (const v of check.violations) {
      process.stderr.write(`    - ${v.entity}: ${v.message}\n`);
    }
  }

  // Summary of passed checks
  if (passedChecks.length > 0 && failedChecks.length > 0) {
    process.stdout.write(`\n  ✓ ${passedChecks.length} check(s) passed\n`);
  }
}
