/**
 * Catalog validation engine — V01-V19 checks.
 * Spec: specification-multi-repo-context.md §6.2 (validate checks).
 *
 * Errors abort with exit 4; warnings do not.
 * Under `--strict`, certain warnings are promoted to errors.
 */

import type { CatalogIndex } from "./index-model.js";

/* ─── Severity and Check Types ─────────────────────────────────────── */

export type CheckSeverity = "error" | "warning";

export interface CheckResult {
  /** Check identifier (e.g., "V01", "V04") */
  check: string;
  /** Human-readable description of the check */
  description: string;
  /** Severity: error or warning */
  severity: CheckSeverity;
  /** Whether this check passed */
  passed: boolean;
  /** Violations found (empty if passed) */
  violations: CheckViolation[];
}

export interface CheckViolation {
  /** Component or entity id where the violation was found */
  entity: string;
  /** Human-readable message describing the violation */
  message: string;
  /** Additional context (e.g., the unresolved contract id) */
  context?: Record<string, unknown>;
}

/* ─── Validation Configuration ─────────────────────────────────────── */

export interface ValidateOptions {
  /** Promote warnings to errors (e.g., undeclared cycles) */
  strict: boolean;
  /** Cycle pairs that are intentionally allowed */
  allowedCycles?: string[][];
}

/* ─── Aggregated Validation Report ─────────────────────────────────── */

export interface ValidationReport {
  /** All check results */
  checks: CheckResult[];
  /** Total errors found */
  errorCount: number;
  /** Total warnings found */
  warningCount: number;
  /** Whether the catalog passed validation (no errors) */
  passed: boolean;
}

/* ─── Check Function Signature ─────────────────────────────────────── */

/**
 * A check function receives the index and options, returns a CheckResult.
 */
export type CheckFn = (index: CatalogIndex, options: ValidateOptions) => CheckResult;

/* ─── Result Aggregation ───────────────────────────────────────────── */

/**
 * Aggregate individual check results into a final report.
 */
export function aggregateResults(checks: CheckResult[]): ValidationReport {
  let errorCount = 0;
  let warningCount = 0;

  for (const check of checks) {
    if (!check.passed) {
      if (check.severity === "error") {
        errorCount += check.violations.length;
      } else {
        warningCount += check.violations.length;
      }
    }
  }

  return {
    checks,
    errorCount,
    warningCount,
    passed: errorCount === 0,
  };
}

/**
 * Helper to create a passing check result.
 */
export function passCheck(
  check: string,
  description: string,
  severity: CheckSeverity,
): CheckResult {
  return { check, description, severity, passed: true, violations: [] };
}

/**
 * Helper to create a failing check result.
 */
export function failCheck(
  check: string,
  description: string,
  severity: CheckSeverity,
  violations: CheckViolation[],
): CheckResult {
  return { check, description, severity, passed: false, violations };
}

/* ─── Orchestrator ─────────────────────────────────────────────────── */

import {
  checkV01,
  checkV01WithDir,
  checkV02,
  checkV03,
  checkV04,
  checkV05,
  checkV06,
  checkV06WithDir,
  checkV07,
  checkV07WithDir,
  checkV08,
  checkV09,
  checkV10,
  checkV11,
  checkV11WithDir,
  checkV12,
  checkV13,
  checkV14,
  checkV15,
  checkV16,
  checkV17,
  checkV18,
  checkV19,
} from "./checks/index.js";

export interface CatalogValidateOptions extends ValidateOptions {
  /** Path to the catalog directory (enables V01/V06/V07/V11 file-level checks) */
  catalogDir?: string;
}

/**
 * Run all V01-V19 checks against a catalog index.
 * Returns a complete validation report.
 */
export function catalogValidate(
  index: CatalogIndex,
  options: CatalogValidateOptions,
): ValidationReport {
  const checks: CheckResult[] = [];

  // V01: Schema validation
  if (options.catalogDir) {
    checks.push(checkV01WithDir(index, options.catalogDir));
  } else {
    checks.push(checkV01(index, options));
  }

  // V02/V03: Identity uniqueness
  checks.push(checkV02(index, options));
  checks.push(checkV03(index, options));

  // V04: Referential integrity
  checks.push(checkV04(index, options));

  // V05: Domain existence
  checks.push(checkV05(index, options));

  // V06/V07: Path existence
  if (options.catalogDir) {
    checks.push(checkV06WithDir(index, options.catalogDir));
    checks.push(checkV07WithDir(index, options.catalogDir));
  } else {
    checks.push(checkV06(index, options));
    checks.push(checkV07(index, options));
  }

  // V08/V09/V10: Contract field enums
  checks.push(checkV08(index, options));
  checks.push(checkV09(index, options));
  checks.push(checkV10(index, options));

  // V11: Non-empty manual fields
  if (options.catalogDir) {
    checks.push(checkV11WithDir(index, options.catalogDir));
  } else {
    checks.push(checkV11(index, options));
  }

  // V12: Undeclared cycles
  checks.push(checkV12(index, options));

  // V13: Orphan contracts
  checks.push(checkV13(index, options));

  // V14/V15: Lifecycle/criticality enums
  checks.push(checkV14(index, options));
  checks.push(checkV15(index, options));

  // V16: Deprecated with active consumers
  checks.push(checkV16(index, options));

  // V17: Low-confidence components
  checks.push(checkV17(index, options));

  // V18: Low-payload contracts with consumers
  checks.push(checkV18(index, options));

  // V19: Domain membership consistency
  checks.push(checkV19(index, options));

  return aggregateResults(checks);
}
