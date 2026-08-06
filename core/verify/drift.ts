/**
 * Drift heuristic: computes docs/code recency per component.
 *
 * Uses `git log` to determine the last commit date for source paths and
 * docs paths, then computes a drift score (days difference). This is a
 * prioritization signal, not a proof of staleness.
 *
 * Spec: §6.6, RF-52.
 */

import { execSync } from "node:child_process";
import type { CatalogIndex, ComponentSummary } from "../catalog/index-model.js";
import type { DriftResult, DriftEntry, DriftOptions } from "./types.js";

/** Default staleness threshold in days */
const DEFAULT_THRESHOLD = 30;

/**
 * Get the last commit date for a set of paths in a git repository.
 * Returns the date as a Date object, or null if no commits are found.
 *
 * @param paths - Glob patterns or directory paths to check.
 * @param repoRoot - Root of the git repository.
 */
export function getLastCommitDate(paths: string[], repoRoot: string): Date | null {
  if (paths.length === 0) return null;

  try {
    // Use git log to find the most recent commit touching any of the paths
    const result = execSync(`git log -1 --format=%aI -- ${paths.map((p) => `"${p}"`).join(" ")}`, {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!result) return null;
    const date = new Date(result);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Compute the number of days between a date and now.
 */
export function daysAgo(date: Date | null, now: Date = new Date()): number {
  if (!date) return Infinity;
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Derive source and docs paths from a component summary.
 *
 * Heuristic:
 * - Source paths: from component's provides[].source or fallback to "src/"
 * - Docs paths: "docs/" relative to the component's repo
 */
export function deriveComponentPaths(component: ComponentSummary): {
  sourcePaths: string[];
  docsPaths: string[];
} {
  const sourcePaths: string[] = [];

  // Collect source paths from provides entries
  for (const p of component.provides) {
    if (p.source) {
      sourcePaths.push(p.source);
    }
  }

  // Fallback: use common source directories
  if (sourcePaths.length === 0) {
    sourcePaths.push("src/");
  }

  // Docs paths: conventional docs directory
  const docsPaths = ["docs/", "README.md"];

  return { sourcePaths, docsPaths };
}

/**
 * Compute drift for a single component.
 */
export function computeComponentDrift(
  component: ComponentSummary,
  repoRoot: string,
  threshold: number,
  now: Date = new Date(),
): DriftEntry {
  const { sourcePaths, docsPaths } = deriveComponentPaths(component);

  const sourceDate = getLastCommitDate(sourcePaths, repoRoot);
  const docsDate = getLastCommitDate(docsPaths, repoRoot);

  const sourceDaysAgo = daysAgo(sourceDate, now);
  const docsDaysAgo = daysAgo(docsDate, now);

  // Drift = how much more stale docs are compared to source
  // If source was changed recently but docs weren't, drift is high
  const driftDays =
    docsDaysAgo === Infinity || sourceDaysAgo === Infinity ? 0 : docsDaysAgo - sourceDaysAgo;

  const stale = driftDays > threshold;

  return {
    id: component.id,
    name: component.name,
    repo: component.repo,
    sourceDaysAgo: sourceDaysAgo === Infinity ? -1 : sourceDaysAgo,
    docsDaysAgo: docsDaysAgo === Infinity ? -1 : docsDaysAgo,
    driftDays: Math.max(0, driftDays),
    stale,
  };
}

/**
 * Run drift analysis across components in the catalog.
 *
 * @param index - The catalog index.
 * @param options - Drift analysis options.
 * @returns DriftResult with all entries and stale entries.
 */
export function runDrift(index: CatalogIndex, options: DriftOptions = {}): DriftResult {
  const { id, threshold = DEFAULT_THRESHOLD, repoRoot = "." } = options;
  const now = new Date();

  // Filter to specific component if --id provided
  let components: ComponentSummary[];
  if (id) {
    const component = index.components.find((c) => c.id === id);
    components = component ? [component] : [];
  } else {
    components = index.components;
  }

  const entries: DriftEntry[] = components.map((c) =>
    computeComponentDrift(c, repoRoot, threshold, now),
  );

  const staleEntries = entries.filter((e) => e.stale);

  return {
    threshold,
    entries,
    staleEntries,
  };
}
