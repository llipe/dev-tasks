/**
 * Process exit codes for the `dev-tasks` binary.
 *
 * Changelog:
 * - 2026-07-31: Aligned with spec §6.7. Replaced placeholder `RateLimit: 8`
 *   (no spec basis) with `BreakingChange: 8`. Added `StaleIndex: 9`,
 *   `InvalidScoping: 10`, `NoCandidates: 11`, `UnknownComponent: 12`,
 *   `IncompleteExtraction: 13`, `ReconciliationConflict: 14` to match spec.
 *   Legacy aliases preserved below for one release cycle.
 * - 2026-09-19: Pruned for the `dt` retirement (ADR-007). Removed every
 *   code and alias that existed only for the multi-repo context layer:
 *   `PartialCatalogBuild`/`NetworkError` (3), `CatalogValidationErrors`/
 *   `AuthError` (4), `FetchFailure`/`NotFound` (5), `InsufficientBudget`/
 *   `Conflict` (6), `GateAborted`/`Timeout` (7), `BreakingChange`/
 *   `RateLimit` (8), `StaleIndex`/`ValidationError` (9), `InvalidScoping`/
 *   `ConfigurationError` (10), `UnknownComponent`/`PermissionDenied` (12),
 *   `IncompleteExtraction`/`MissingRequiredField` (13). Value `11` is kept:
 *   `bin/dev-tasks.ts`'s `doctor` command already returns it under the
 *   `DependencyError` alias (dependency-check failure), so `DependencyError`
 *   is promoted from a deprecated alias of `NoCandidates` to the primary
 *   name; the numeric value is unchanged. `Success` (0), `GeneralError` (1),
 *   `InvalidUsage` (2), and `ReconciliationConflict` (14) are unchanged.
 */
export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidUsage: 2,
  DependencyError: 11,
  ReconciliationConflict: 14,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
