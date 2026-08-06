/**
 * Shared types for contract-diff verification.
 */

/**
 * Classification of a detected change.
 */
export type ChangeKind = "breaking" | "non-breaking";

/**
 * A single diff finding from comparing two contract versions.
 */
export interface DiffFinding {
  /** Classification: breaking or non-breaking */
  kind: ChangeKind;
  /** Machine-readable code for the change class */
  code: string;
  /** Human-readable description */
  message: string;
  /** JSON-path or location reference within the spec */
  path: string;
}

/**
 * Result of a single contract diff operation.
 */
export interface ContractDiffResult {
  /** Contract type that was compared */
  contractType: "openapi" | "asyncapi";
  /** Whether any breaking changes were detected */
  breaking: boolean;
  /** All findings */
  findings: DiffFinding[];
}

/**
 * Options for running contract-diff.
 */
export interface ContractDiffOptions {
  /** Path to the base (old) contract spec */
  basePath: string;
  /** Path to the head (new) contract spec */
  headPath: string;
  /** Output as JSON */
  json?: boolean;
}

/**
 * Confidence level for payload (re-exported for convenience).
 */
export type PayloadConfidence = "high" | "medium" | "low";
