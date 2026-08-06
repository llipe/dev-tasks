/**
 * Tracker provider interface stub.
 *
 * Defines the contract for emitting derived tasks to an external tracker
 * (e.g., GitHub Issues, Jira). The actual implementation depends on the
 * Platform Providers spec (separate); this module provides only the interface
 * and a graceful no-op fallback.
 *
 * Spec: §6.6, RF-54.
 */

/* ─── Types ────────────────────────────────────────────────────────── */

/**
 * A derived task to be created in an external tracker.
 */
export interface DerivedTask {
  /** Target repository (e.g., "org/repo") */
  repo: string;
  /** Task title */
  title: string;
  /** Task body/description */
  body: string;
  /** Labels to apply */
  labels: string[];
  /** Metadata about the originating contract change */
  metadata: {
    contractId: string;
    consumerId: string;
    criticality: string;
  };
}

/**
 * Result of emitting a derived task.
 */
export interface EmitTaskResult {
  /** Whether the task was successfully emitted */
  success: boolean;
  /** URL or identifier of the created task (when successful) */
  taskUrl?: string;
  /** Error message (when failed) */
  error?: string;
}

/**
 * Tracker provider interface.
 *
 * Implementations create tasks/issues in external tracking systems.
 * The platform-providers spec will provide concrete implementations;
 * this stub defines the contract.
 */
export interface TrackerProvider {
  /** Human-readable name of the tracker (e.g., "github", "jira") */
  readonly name: string;

  /**
   * Check whether the provider is available and configured.
   * Returns false when credentials or configuration are missing.
   */
  isAvailable(): boolean;

  /**
   * Emit a derived task to the tracker.
   */
  emitTask(task: DerivedTask): Promise<EmitTaskResult>;
}

/* ─── No-op Fallback ───────────────────────────────────────────────── */

/**
 * A no-op tracker provider used when no real provider is configured.
 * Always reports unavailable; emitTask resolves with a graceful skip.
 */
export const nullTrackerProvider: TrackerProvider = {
  name: "null",

  isAvailable(): boolean {
    return false;
  },

  async emitTask(_task: DerivedTask): Promise<EmitTaskResult> {
    return {
      success: false,
      error: "No tracker provider configured. Install a platform provider to enable --emit-tasks.",
    };
  },
};

/**
 * Resolve the active tracker provider.
 *
 * Currently always returns the null provider. When the Platform Providers
 * spec is implemented, this will load the configured provider from
 * environment or config.
 */
export function resolveTrackerProvider(): TrackerProvider {
  return nullTrackerProvider;
}
