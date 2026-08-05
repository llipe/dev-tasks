/**
 * Init-pipeline exit codes per spec §6.7.
 *
 * These are the exit codes specific to the `dt init` orchestration pipeline.
 * They are distinct from the generic ExitCode enum in core/exit-codes.ts
 * which covers general CLI error categories.
 *
 * Each code maps to a specific failure in the init pipeline:
 * - 6:  Budget exceeded (non-truncable minimum exceeds budget)
 * - 7:  Gate abort (system decision, not an error — G1-G4)
 * - 9:  Stale index (index age exceeds --max-index-age)
 * - 10: Invalid scope after LLM retry (schema or id validation failed twice)
 * - 11: No candidates (lexical resolve produced zero results)
 * - 12: Unknown component (scope references id not in catalog index)
 */

/** Exit 6: Insufficient context budget — non-truncable layers exceed the token budget */
export const EXIT_BUDGET_EXCEEDED = 6;

/** Exit 7: Gate aborted — a G1-G4 rule triggered; system decision, not an error */
export const EXIT_GATE_ABORT = 7;

/** Exit 9: Stale index — catalog index age exceeds --max-index-age */
export const EXIT_STALE_INDEX = 9;

/** Exit 10: Invalid scope — LLM output failed validation after one repair retry */
export const EXIT_INVALID_SCOPE = 10;

/** Exit 11: No candidates — lexical resolve produced zero results for the task text */
export const EXIT_NO_CANDIDATES = 11;

/** Exit 12: Unknown component — scope references a component id not in the catalog */
export const EXIT_UNKNOWN_COMPONENT = 12;
