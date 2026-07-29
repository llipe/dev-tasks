/**
 * Status reporting — compare installed vs. pinned vs. latest versions.
 */

import { readManifest } from "./manifest.js";
import { readPin } from "./pin.js";

export interface StatusResult {
  installed: string | null;
  pinned: string | null;
  latest: string;
  upToDate: boolean;
}

/**
 * Get the current status of the dev-tasks installation.
 * Compares installed version (from manifest), pinned version (from .dev-tasks/version),
 * and the latest published version.
 *
 * upToDate is true when:
 * - If pinned: installed version matches the pinned version
 * - If not pinned: installed version matches the latest version
 */
export async function getStatus(repoRoot: string, latestVersion: string): Promise<StatusResult> {
  const manifest = await readManifest(repoRoot);
  const pinned = await readPin(repoRoot);

  const installed = manifest?.version ?? null;

  // Determine if up-to-date:
  // - If pinned, compare installed against pin
  // - If not pinned, compare installed against latest
  let upToDate: boolean;
  if (installed === null) {
    upToDate = false;
  } else if (pinned !== null) {
    upToDate = installed === pinned;
  } else {
    upToDate = installed === latestVersion;
  }

  return {
    installed,
    pinned,
    latest: latestVersion,
    upToDate,
  };
}
