/**
 * CLI handler for `dt ctx fetch --repos <ids> --meta-repo <path> [--refresh] [--concurrency 8] [--json]`.
 *
 * Sparse-clones only component.json, docs/, and contracts/ and caches by SHA.
 * Exit codes: 0 = success, 5 = fetch failure (timeout/unreachable).
 */

import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parse as yamlParse } from "yaml";
import { ctxFetch, type FetchTarget, type FetchOptions } from "#core/context/fetch.js";
import { runGC, type GCOptions } from "#core/context/cache.js";
import { ExitCode } from "#core/exit-codes.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface CtxFetchCliOptions {
  json: boolean;
  repos?: string;
  metaRepo?: string;
  refresh?: boolean;
  concurrency?: number;
  cacheBaseDir?: string;
}

export interface CtxGCCliOptions {
  json: boolean;
  maxSize?: string;
  maxAge?: string;
  cacheBaseDir?: string;
}

interface RegistryEntry {
  id: string;
  url: string;
  branch?: string;
  sha?: string;
  host?: string;
  org?: string;
  repo?: string;
  path?: string;
}

interface IndexComponent {
  id: string;
  origin_sha?: string;
  repo_url?: string;
  host?: string;
  org?: string;
  repo?: string;
}

/* ─── Fetch Command ───────────────────────────────────────────────────── */

/**
 * Run the `dt ctx fetch` command.
 * Resolves target repos from registry/index, fetches sparse content into cache.
 */
export async function runCtxFetch(options: CtxFetchCliOptions): Promise<number> {
  const { json, repos, metaRepo, refresh, concurrency, cacheBaseDir } = options;

  if (!repos) {
    const msg = "Missing required flag: --repos <ids> (comma-separated component ids)";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
      process.stderr.write(
        "Usage: dt ctx fetch --repos <ids> --meta-repo <path> [--refresh] [--concurrency 8] [--json]\n",
      );
    }
    return ExitCode.InvalidUsage;
  }

  if (!metaRepo) {
    const msg = "Missing required flag: --meta-repo <path>";
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.InvalidUsage;
  }

  const metaRepoPath = resolve(metaRepo);
  if (!existsSync(metaRepoPath)) {
    const msg = `Meta-repo path not found: ${metaRepoPath}`;
    if (json) {
      process.stdout.write(JSON.stringify({ error: msg }, null, 2) + "\n");
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  // Resolve targets from index or registry
  const repoIds = repos.split(",").map((r) => r.trim());
  const targets = resolveTargets(repoIds, metaRepoPath);

  if (targets.errors.length > 0) {
    const msg = `Could not resolve repos: ${targets.errors.join(", ")}`;
    if (json) {
      process.stdout.write(
        JSON.stringify({ error: msg, unresolved: targets.errors }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return ExitCode.NotFound;
  }

  const fetchOptions: FetchOptions = {
    metaRepoPath,
    targets: targets.resolved,
    refresh: refresh ?? false,
    concurrency: concurrency ?? 8,
    cacheBaseDir,
  };

  const result = await ctxFetch(fetchOptions);

  if (json) {
    const output = {
      success: result.errors.length === 0,
      fetched: result.entries.length,
      cache_hits: result.entries.filter((e) => e.cacheHit).length,
      cache_misses: result.entries.filter((e) => !e.cacheHit && !e.error).length,
      errors: result.errors.map((e) => ({ id: e.id, error: e.error })),
      entries: result.entries.map((e) => ({
        id: e.id,
        cache_hit: e.cacheHit,
        path: e.cachePath,
        error: e.error,
      })),
    };
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    const hits = result.entries.filter((e) => e.cacheHit).length;
    const misses = result.entries.filter((e) => !e.cacheHit && !e.error).length;
    process.stdout.write(
      `✓ Fetched ${result.entries.length} repos (${hits} cache hits, ${misses} fetched)\n`,
    );
    if (result.errors.length > 0) {
      process.stderr.write(`\n⚠ ${result.errors.length} error(s):\n`);
      for (const err of result.errors) {
        process.stderr.write(`  ${err.id}: ${err.error}\n`);
      }
    }
  }

  // Exit 5 if any fetch failed
  return result.errors.length > 0 ? ExitCode.NotFound : ExitCode.Success;
}

/* ─── GC Command ──────────────────────────────────────────────────────── */

/**
 * Run the `dt ctx gc` command.
 * Evicts stale/oversized cache entries.
 */
export function runCtxGC(options: CtxGCCliOptions): number {
  const { json, maxSize, maxAge, cacheBaseDir } = options;

  const gcOptions: GCOptions = { cacheBaseDir };

  if (maxSize) {
    gcOptions.maxSizeBytes = parseSizeString(maxSize);
  }
  if (maxAge) {
    gcOptions.maxAgeMs = parseAgeString(maxAge);
  }

  const result = runGC(gcOptions);

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          evicted: result.evicted,
          remaining_bytes: result.remainingBytes,
          remaining_entries: result.remainingEntries,
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    if (result.evicted > 0) {
      process.stdout.write(
        `✓ GC evicted ${result.evicted} entries (${formatBytes(result.remainingBytes)} remaining)\n`,
      );
    } else {
      process.stdout.write(
        `✓ Cache clean — no eviction needed (${result.remainingEntries} entries)\n`,
      );
    }
  }

  return ExitCode.Success;
}

/* ─── Target Resolution ───────────────────────────────────────────────── */

interface ResolveResult {
  resolved: FetchTarget[];
  errors: string[];
}

/**
 * Resolve component ids to FetchTargets using the catalog index.
 */
function resolveTargets(ids: string[], metaRepoPath: string): ResolveResult {
  const resolved: FetchTarget[] = [];
  const errors: string[] = [];

  // Try to read catalog/index.yaml for component info
  const indexPath = resolve(metaRepoPath, "catalog", "index.yaml");
  let components: IndexComponent[] = [];

  if (existsSync(indexPath)) {
    try {
      const indexContent = readFileSync(indexPath, "utf-8");
      const index = yamlParse(indexContent) as { components?: IndexComponent[] };
      components = index.components ?? [];
    } catch {
      // Fall back to registry
    }
  }

  // Also read registry.yaml for URL info
  const registryPath = resolve(metaRepoPath, "registry.yaml");
  let registryEntries: RegistryEntry[] = [];

  if (existsSync(registryPath)) {
    try {
      const registryContent = readFileSync(registryPath, "utf-8");
      const registry = yamlParse(registryContent) as { repos?: RegistryEntry[] };
      registryEntries = registry.repos ?? [];
    } catch {
      // ignore
    }
  }

  for (const id of ids) {
    // Find in index first (has origin_sha)
    const comp = components.find((c) => c.id === id);
    // Find in registry (has url)
    const reg = registryEntries.find((r) => r.id === id);

    const url = comp?.repo_url ?? reg?.url;
    const sha = comp?.origin_sha ?? reg?.sha;

    if (!url || !sha) {
      errors.push(id);
      continue;
    }

    // Parse host/org/repo from URL
    const parsed = parseGitUrl(url);
    const host = comp?.host ?? reg?.host ?? parsed.host;
    const org = comp?.org ?? reg?.org ?? parsed.org;
    const repo = comp?.repo ?? reg?.repo ?? parsed.repo;

    resolved.push({ id, url, sha, host, org, repo });
  }

  return { resolved, errors };
}

/**
 * Parse a git URL into host/org/repo components.
 * Handles https://github.com/org/repo.git and git@github.com:org/repo.git
 */
function parseGitUrl(url: string): { host: string; org: string; repo: string } {
  // HTTPS format: https://github.com/org/repo.git
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { host: httpsMatch[1], org: httpsMatch[2], repo: httpsMatch[3] };
  }

  // SSH format: git@github.com:org/repo.git
  const sshMatch = url.match(/git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], org: sshMatch[2], repo: sshMatch[3] };
  }

  // File path (local repos for testing): /path/to/repo
  const parts = url.replace(/\/$/, "").split("/");
  return {
    host: "local",
    org: parts[parts.length - 2] ?? "unknown",
    repo: parts[parts.length - 1] ?? "unknown",
  };
}

/* ─── Utility Helpers ─────────────────────────────────────────────────── */

/**
 * Parse a human-readable size string (e.g., "5GB", "500MB") into bytes.
 */
function parseSizeString(s: string): number {
  const match = s.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB|B)?$/i);
  if (!match) return 5 * 1024 * 1024 * 1024; // default 5GB
  const value = parseFloat(match[1]);
  const unit = (match[2] ?? "B").toUpperCase();
  switch (unit) {
    case "GB":
      return value * 1024 * 1024 * 1024;
    case "MB":
      return value * 1024 * 1024;
    case "KB":
      return value * 1024;
    default:
      return value;
  }
}

/**
 * Parse a human-readable age string (e.g., "30d", "7d", "24h") into milliseconds.
 */
function parseAgeString(s: string): number {
  const match = s.match(/^(\d+)\s*(d|h|m)?$/i);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30 days
  const value = parseInt(match[1], 10);
  const unit = (match[2] ?? "d").toLowerCase();
  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    default:
      return value * 24 * 60 * 60 * 1000;
  }
}

/**
 * Format bytes for human display.
 */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export { parseGitUrl, parseSizeString, parseAgeString };
