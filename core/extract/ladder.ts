/**
 * Extraction ladder runner.
 *
 * Runs extraction rungs in order (declared → observed → inferred) and returns
 * the first usable result with provenance metadata and confidence policy.
 *
 * Confidence policy (enforced, not convention):
 * - declared → high
 * - observed → high
 * - inferred → low (capped — an inferred rung MUST NOT emit medium or high)
 */

/**
 * The kind of extraction rung, determining execution order and confidence.
 */
export type RungKind = "declared" | "observed" | "inferred";

/**
 * Confidence level assigned by the ladder based on rung kind.
 */
export type LadderConfidence = "high" | "low";

/**
 * A single extraction rung definition.
 */
export interface Rung<T> {
  /** The rung classification */
  kind: RungKind;
  /** Human-readable name for diagnostics */
  name: string;
  /** Execute the rung — returns result + diagnostics, or null for unavailable */
  execute: () => RungOutput<T>;
}

/**
 * Output from a single rung execution.
 */
export interface RungOutput<T> {
  /** The extraction result, or null if the rung is unavailable */
  result: T | null;
  /** Diagnostic messages from this rung (always collected) */
  diagnostics: string[];
}

/**
 * Provenance metadata for the winning rung.
 */
export interface RungProvenance {
  /** Which rung kind produced the result */
  rung: RungKind;
  /** Name of the winning rung */
  name: string;
}

/**
 * The complete result from running the ladder.
 */
export interface LadderResult<T> {
  /** The extraction result from the winning rung, or null if all failed */
  result: T | null;
  /** Which rung kind won (null if no rung produced a result) */
  winningRung: RungKind | null;
  /** Confidence level determined by the ladder policy */
  confidence: LadderConfidence;
  /** Provenance metadata for the winning rung */
  provenance: RungProvenance | null;
  /** Collected diagnostics from all attempted rungs */
  diagnostics: string[];
}

/**
 * Confidence policy: maps rung kind to confidence level.
 * Inferred is always capped at "low" regardless of what the rung claims.
 */
export function getConfidenceForRung(kind: RungKind): LadderConfidence {
  switch (kind) {
    case "declared":
      return "high";
    case "observed":
      return "high";
    case "inferred":
      return "low";
  }
}

/**
 * Run the extraction ladder.
 *
 * Executes rungs in array order (caller should provide them as
 * declared → observed → inferred). Stops at the first rung that
 * produces a non-null result. Collects diagnostics from all attempted rungs.
 *
 * Confidence is determined by the ladder policy, not the rung output.
 */
export function runLadder<T>(rungs: Rung<T>[]): LadderResult<T> {
  const allDiagnostics: string[] = [];

  for (const rung of rungs) {
    let output: RungOutput<T>;
    try {
      output = rung.execute();
    } catch (err) {
      // Rung threw — treat as unavailable with a diagnostic
      const message = err instanceof Error ? err.message : String(err);
      allDiagnostics.push(`${rung.name} failed: ${message}`);
      continue;
    }

    // Collect diagnostics from this rung regardless of result
    allDiagnostics.push(...output.diagnostics);

    if (output.result !== null) {
      // Winner found — apply confidence policy and return
      return {
        result: output.result,
        winningRung: rung.kind,
        confidence: getConfidenceForRung(rung.kind),
        provenance: { rung: rung.kind, name: rung.name },
        diagnostics: allDiagnostics,
      };
    }
  }

  // All rungs failed
  return {
    result: null,
    winningRung: null,
    confidence: "low",
    provenance: null,
    diagnostics: allDiagnostics,
  };
}
