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

/* ─── Impact Types ─────────────────────────────────────────────────── */

/**
 * A consumer affected by a contract change.
 */
export interface ImpactConsumer {
  /** Component id of the consumer */
  id: string;
  /** Human-readable component name */
  name: string;
  /** Repository URL */
  repo: string;
  /** Criticality of the consumption relationship */
  criticality: string;
}

/**
 * Result of an impact analysis for a contract.
 */
export interface ImpactResult {
  /** The contract id that was analyzed */
  contractId: string;
  /** The provider component id */
  provider: string;
  /** List of affected consumers with criticality */
  consumers: ImpactConsumer[];
  /** Whether derived tasks were emitted (when --emit-tasks was used) */
  tasksEmitted: boolean;
  /** Per-consumer task emission results (only populated when --emit-tasks) */
  taskResults: ImpactTaskResult[];
}

/**
 * Result of emitting a derived task for a single consumer.
 */
export interface ImpactTaskResult {
  /** Consumer component id */
  consumerId: string;
  /** Whether the task was successfully emitted */
  success: boolean;
  /** URL or identifier of the created task */
  taskUrl?: string;
  /** Error message on failure */
  error?: string;
}

/**
 * Options for running impact analysis.
 */
export interface ImpactOptions {
  /** Contract id to analyze */
  contractId: string;
  /** Whether to emit derived tasks per consumer */
  emitTasks?: boolean;
}

/* ─── Drift Types ──────────────────────────────────────────────────── */

/**
 * Drift status for a single component.
 */
export interface DriftEntry {
  /** Component id */
  id: string;
  /** Component name */
  name: string;
  /** Repository path */
  repo: string;
  /** Days since last source code commit (over paths.source) */
  sourceDaysAgo: number;
  /** Days since last docs commit (over docs.root) */
  docsDaysAgo: number;
  /** Drift score: difference in days (docsDaysAgo - sourceDaysAgo) */
  driftDays: number;
  /** Whether drift exceeds the threshold */
  stale: boolean;
}

/**
 * Result of a drift analysis.
 */
export interface DriftResult {
  /** Threshold in days used for staleness detection */
  threshold: number;
  /** All component drift entries */
  entries: DriftEntry[];
  /** Only entries that exceed the threshold */
  staleEntries: DriftEntry[];
}

/**
 * Options for running drift analysis.
 */
export interface DriftOptions {
  /** Optional component id to check (if omitted, checks all) */
  id?: string;
  /** Staleness threshold in days (default: 30) */
  threshold?: number;
  /** Path to the repository root for git operations */
  repoRoot?: string;
}
