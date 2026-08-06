/**
 * Process exit codes per spec §6.7.
 * Exported as a const object for use across all CLI binaries.
 *
 * Changelog:
 * - 2026-07-31: Aligned with spec §6.7. Replaced placeholder `RateLimit: 8`
 *   (no spec basis) with `BreakingChange: 8`. Added `StaleIndex: 9`,
 *   `InvalidScoping: 10`, `NoCandidates: 11`, `UnknownComponent: 12`,
 *   `IncompleteExtraction: 13`, `ReconciliationConflict: 14` to match spec.
 *   Legacy aliases preserved below for one release cycle.
 */
export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidUsage: 2,
  PartialCatalogBuild: 3,
  CatalogValidationErrors: 4,
  FetchFailure: 5,
  InsufficientBudget: 6,
  GateAborted: 7,
  BreakingChange: 8,
  StaleIndex: 9,
  InvalidScoping: 10,
  NoCandidates: 11,
  UnknownComponent: 12,
  IncompleteExtraction: 13,
  ReconciliationConflict: 14,

  // Legacy aliases (deprecated — will be removed in next major)
  /** @deprecated Use PartialCatalogBuild */
  NetworkError: 3,
  /** @deprecated Use CatalogValidationErrors */
  AuthError: 4,
  /** @deprecated Use FetchFailure */
  NotFound: 5,
  /** @deprecated Use InsufficientBudget */
  Conflict: 6,
  /** @deprecated Use GateAborted */
  Timeout: 7,
  /** @deprecated Use BreakingChange */
  RateLimit: 8,
  /** @deprecated Use StaleIndex */
  ValidationError: 9,
  /** @deprecated Use InvalidScoping */
  ConfigurationError: 10,
  /** @deprecated Use NoCandidates */
  DependencyError: 11,
  /** @deprecated Use UnknownComponent */
  PermissionDenied: 12,
  /** @deprecated Use IncompleteExtraction */
  MissingRequiredField: 13,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
