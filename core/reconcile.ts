/**
 * Generic hash-based reconciliation engine.
 * Standalone module at core/ level — importable by both distribution (S-003)
 * and extraction (S-009) without circular dependencies.
 *
 * Determines the correct action for a file based on three hash values:
 * - localHash: current hash of the file on disk (null if file doesn't exist)
 * - originHash: hash at the time of last install/update (what we put there)
 * - packageHash: hash of the file in the current package version
 */

/**
 * The four possible reconciliation actions.
 */
export type ReconcileAction = "install" | "overwrite" | "skip" | "conflict";

/**
 * Determine the reconciliation action for a single file.
 *
 * Decision tree:
 * 1. Install  — file does NOT exist locally (localHash is null)
 * 2. Skip     — local hash == package hash (already up to date, regardless of origin)
 * 3. Overwrite — local hash == origin hash AND package hash differs (unedited, upstream changed)
 * 4. Conflict — local hash != origin hash AND local hash != package hash (user edited, can't auto-update)
 */
export function reconcile(
  localHash: string | null,
  originHash: string,
  packageHash: string,
): ReconcileAction {
  // File doesn't exist locally → install it
  if (localHash === null) {
    return "install";
  }

  // Already up to date (local matches package) → skip
  if (localHash === packageHash) {
    return "skip";
  }

  // User hasn't edited (local matches origin) but upstream changed → safe to overwrite
  if (localHash === originHash) {
    return "overwrite";
  }

  // User edited AND upstream differs → conflict
  return "conflict";
}
