/**
 * Sparse-clone git fetch for multi-repo context.
 *
 * Fetches only `component.json`, `docs/`, and `contracts/` via
 * blob-filtered sparse checkout (depth 1) and caches by SHA.
 *
 * Spec: §6.3 RF-36.
 */

import { execa } from "execa";
import { mkdirSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getCachePath, isCacheHit, markCacheComplete, touchCacheEntry } from "./cache.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface FetchTarget {
  /** Component id (used for reporting) */
  id: string;
  /** Git clone URL (https or ssh) */
  url: string;
  /** Pinned SHA to checkout */
  sha: string;
  /** Host segment for cache path (e.g. "github.com") */
  host: string;
  /** Org/owner segment */
  org: string;
  /** Repo name segment */
  repo: string;
}

export interface FetchOptions {
  /** Meta-repo base path (for resolving registry) */
  metaRepoPath: string;
  /** Targets to fetch */
  targets: FetchTarget[];
  /** Bypass cache and re-fetch even if SHA dir exists */
  refresh?: boolean;
  /** Max concurrent fetch operations (default: 8) */
  concurrency?: number;
  /** Per-repo timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Override cache base directory (for testing) */
  cacheBaseDir?: string;
}

export interface FetchResultEntry {
  id: string;
  /** Whether the result was served from cache */
  cacheHit: boolean;
  /** Path to cached content */
  cachePath: string;
  /** Error message if fetch failed */
  error?: string;
}

export interface FetchResult {
  entries: FetchResultEntry[];
  errors: FetchResultEntry[];
}

/* ─── Sparse Paths ────────────────────────────────────────────────────── */

/** Paths to include in sparse checkout */
const SPARSE_PATHS = ["component.json", "docs", "contracts"];

/* ─── Core Fetch Logic ────────────────────────────────────────────────── */

/**
 * Perform a sparse-clone fetch of a single target into the cache.
 *
 * Sequence:
 * 1. git clone --filter=blob:none --no-checkout --depth 1 <url> <tmp>
 * 2. git -C <tmp> sparse-checkout set docs contracts component.json
 * 3. git -C <tmp> checkout <sha>
 * 4. Copy sparse content into cache directory
 */
async function fetchSingle(
  target: FetchTarget,
  options: { refresh: boolean; timeoutMs: number; cacheBaseDir?: string },
): Promise<FetchResultEntry> {
  const cachePath = getCachePath(target, options.cacheBaseDir);

  // Check cache hit (unless --refresh)
  if (!options.refresh && isCacheHit(cachePath)) {
    touchCacheEntry(cachePath);
    return { id: target.id, cacheHit: true, cachePath };
  }

  // Create a temporary directory for cloning
  const tmpDir = await mkdtemp(join(tmpdir(), `dt-fetch-${target.id}-`));

  try {
    // Step 1: Shallow clone with blob filter (no checkout)
    await execGit(
      ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", target.url, tmpDir],
      { timeoutMs: options.timeoutMs },
    );

    // Step 2: Configure sparse checkout
    await execGit(["sparse-checkout", "set", ...SPARSE_PATHS], {
      cwd: tmpDir,
      timeoutMs: options.timeoutMs,
    });

    // Step 3: Checkout the pinned SHA
    await execGit(["checkout", target.sha], {
      cwd: tmpDir,
      timeoutMs: options.timeoutMs,
    });

    // Step 4: Move content into cache
    mkdirSync(cachePath, { recursive: true });

    // Copy sparse-checkout content (not .git) into cache
    await execa("rsync", ["-a", "--exclude=.git", `${tmpDir}/`, `${cachePath}/`], {
      timeout: options.timeoutMs,
    });

    markCacheComplete(cachePath);

    return { id: target.id, cacheHit: false, cachePath };
  } catch (err: unknown) {
    // Clean up partial cache on failure
    try {
      rmSync(cachePath, { recursive: true, force: true });
    } catch {
      // best effort
    }

    const message = err instanceof Error ? err.message : String(err);
    return { id: target.id, cacheHit: false, cachePath, error: message };
  } finally {
    // Clean up temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

/* ─── Git Execution Helper ────────────────────────────────────────────── */

interface ExecGitOptions {
  cwd?: string;
  timeoutMs: number;
}

async function execGit(args: string[], options: ExecGitOptions): Promise<string> {
  const result = await execa("git", args, {
    cwd: options.cwd,
    timeout: options.timeoutMs,
    reject: true,
  });
  return result.stdout;
}

/* ─── Concurrent Fetch Orchestrator ───────────────────────────────────── */

/**
 * Fetch multiple repos concurrently with a concurrency limit.
 * Returns all results including errors.
 */
export async function ctxFetch(options: FetchOptions): Promise<FetchResult> {
  const concurrency = options.concurrency ?? 8;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const refresh = options.refresh ?? false;

  const entries: FetchResultEntry[] = [];
  const targets = [...options.targets];

  // Process in batches
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((target) =>
        fetchSingle(target, {
          refresh,
          timeoutMs,
          cacheBaseDir: options.cacheBaseDir,
        }),
      ),
    );
    entries.push(...batchResults);
  }

  const errors = entries.filter((e) => e.error !== undefined);

  return { entries, errors };
}
