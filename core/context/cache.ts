/**
 * SHA-keyed immutable cache for multi-repo context fetching.
 *
 * Cache layout: <baseDir>/<host>/<org>/<repo>/<sha>/
 * Each entry is immutable once the `.complete` marker exists.
 *
 * LRU GC evicts by last-access time when total exceeds budget.
 *
 * Spec: §6.3 RF-36.
 */

import { existsSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import type { FetchTarget } from "./fetch.js";

/* ─── Constants ───────────────────────────────────────────────────────── */

/** Default cache base directory */
const DEFAULT_CACHE_BASE = join(homedir(), ".dev-tasks", "cache");

/** Marker file indicating a cache entry is complete (immutable) */
const COMPLETE_MARKER = ".complete";

/** Default max cache size in bytes (5 GB) */
export const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024 * 1024;

/** Default max age in milliseconds (30 days) */
export const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/* ─── Cache Path Derivation ───────────────────────────────────────────── */

/**
 * Derive the cache path for a given fetch target.
 * Layout: <baseDir>/<host>/<org>/<repo>/<sha>/
 */
export function getCachePath(target: FetchTarget, baseDir?: string): string {
  const base = baseDir ?? DEFAULT_CACHE_BASE;
  return join(base, target.host, target.org, target.repo, target.sha);
}

/**
 * Return the default cache base directory path.
 */
export function getDefaultCacheBase(): string {
  return DEFAULT_CACHE_BASE;
}

/* ─── Cache Hit Detection ─────────────────────────────────────────────── */

/**
 * Check if a cache entry is a hit (directory exists and is marked complete).
 */
export function isCacheHit(cachePath: string): boolean {
  return existsSync(join(cachePath, COMPLETE_MARKER));
}

/* ─── Cache Write Operations ──────────────────────────────────────────── */

/**
 * Mark a cache entry as complete (immutable from this point).
 */
export function markCacheComplete(cachePath: string): void {
  const markerPath = join(cachePath, COMPLETE_MARKER);
  writeFileSync(markerPath, new Date().toISOString(), "utf-8");
}

/**
 * Touch the cache entry to update its last-access time (for LRU).
 */
export function touchCacheEntry(cachePath: string): void {
  const now = new Date();
  try {
    utimesSync(cachePath, now, now);
  } catch {
    // best effort — directory might not exist
  }
}

/* ─── LRU Garbage Collection ──────────────────────────────────────────── */

export interface GCOptions {
  /** Max total cache size in bytes (default: 5 GB) */
  maxSizeBytes?: number;
  /** Max age in milliseconds (default: 30 days) */
  maxAgeMs?: number;
  /** Override cache base directory (for testing) */
  cacheBaseDir?: string;
}

export interface GCResult {
  /** Number of entries evicted */
  evicted: number;
  /** Total size after GC (bytes) */
  remainingBytes: number;
  /** Total entries remaining */
  remainingEntries: number;
}

interface CacheEntry {
  path: string;
  sizeBytes: number;
  lastAccessTime: number;
}

/**
 * Run LRU garbage collection on the cache.
 * Evicts entries by last-access time when:
 * - Total size exceeds maxSizeBytes (default 5 GB), OR
 * - Entry age exceeds maxAgeMs (default 30 days)
 */
export function runGC(options: GCOptions = {}): GCResult {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const baseDir = options.cacheBaseDir ?? DEFAULT_CACHE_BASE;

  if (!existsSync(baseDir)) {
    return { evicted: 0, remainingBytes: 0, remainingEntries: 0 };
  }

  // Collect all cache entries (leaf directories with .complete marker)
  const entries = collectCacheEntries(baseDir);

  const now = Date.now();
  let evicted = 0;

  // Phase 1: Evict entries older than maxAgeMs
  const ageFiltered: CacheEntry[] = [];
  for (const entry of entries) {
    const age = now - entry.lastAccessTime;
    if (age > maxAgeMs) {
      rmSync(entry.path, { recursive: true, force: true });
      evicted++;
    } else {
      ageFiltered.push(entry);
    }
  }

  // Phase 2: Evict by LRU if total size exceeds budget
  // Sort by last-access time ascending (oldest first)
  ageFiltered.sort((a, b) => a.lastAccessTime - b.lastAccessTime);

  let totalSize = ageFiltered.reduce((sum, e) => sum + e.sizeBytes, 0);
  const remaining: CacheEntry[] = [];

  for (const entry of ageFiltered) {
    if (totalSize > maxSizeBytes) {
      rmSync(entry.path, { recursive: true, force: true });
      totalSize -= entry.sizeBytes;
      evicted++;
    } else {
      remaining.push(entry);
    }
  }

  // Clean up empty parent directories
  cleanupEmptyDirs(baseDir);

  return {
    evicted,
    remainingBytes: remaining.reduce((sum, e) => sum + e.sizeBytes, 0),
    remainingEntries: remaining.length,
  };
}

/* ─── Internal Helpers ────────────────────────────────────────────────── */

/**
 * Recursively collect all SHA-level cache directories (those with .complete marker).
 */
function collectCacheEntries(baseDir: string): CacheEntry[] {
  const entries: CacheEntry[] = [];

  function walk(dir: string, depth: number): void {
    if (!existsSync(dir)) return;

    let items: string[];
    try {
      items = readdirSync(dir);
    } catch {
      return;
    }

    // If we find a .complete marker, this is a cache entry
    if (items.includes(COMPLETE_MARKER)) {
      const sizeBytes = getDirSize(dir);
      const stat = statSync(dir);
      entries.push({
        path: dir,
        sizeBytes,
        lastAccessTime: stat.atimeMs,
      });
      return;
    }

    // Otherwise recurse into subdirectories (max depth 4: host/org/repo/sha)
    if (depth >= 4) return;
    for (const item of items) {
      const fullPath = join(dir, item);
      try {
        const s = statSync(fullPath);
        if (s.isDirectory()) {
          walk(fullPath, depth + 1);
        }
      } catch {
        // skip inaccessible
      }
    }
  }

  walk(baseDir, 0);
  return entries;
}

/**
 * Get total size of a directory (recursive).
 */
function getDirSize(dir: string): number {
  let total = 0;

  function walkSize(d: string): void {
    let items: string[];
    try {
      items = readdirSync(d);
    } catch {
      return;
    }
    for (const item of items) {
      const fullPath = join(d, item);
      try {
        const s = statSync(fullPath);
        if (s.isDirectory()) {
          walkSize(fullPath);
        } else {
          total += s.size;
        }
      } catch {
        // skip
      }
    }
  }

  walkSize(dir);
  return total;
}

/**
 * Remove empty directories up the tree from baseDir.
 */
function cleanupEmptyDirs(baseDir: string): void {
  function walkClean(dir: string): boolean {
    if (!existsSync(dir)) return true;

    let items: string[];
    try {
      items = readdirSync(dir);
    } catch {
      return false;
    }

    // Recurse into subdirectories
    for (const item of items) {
      const fullPath = join(dir, item);
      try {
        const s = statSync(fullPath);
        if (s.isDirectory()) {
          const empty = walkClean(fullPath);
          if (empty) {
            rmSync(fullPath, { recursive: true, force: true });
          }
        }
      } catch {
        // skip
      }
    }

    // Re-read after cleanup
    try {
      items = readdirSync(dir);
    } catch {
      return true;
    }
    return items.length === 0;
  }

  walkClean(baseDir);
}
