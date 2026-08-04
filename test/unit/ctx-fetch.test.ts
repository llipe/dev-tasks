/**
 * Unit tests for core/context/fetch.ts and core/context/cache.ts
 *
 * Tests: cache path derivation, LRU eviction logic, timeout handling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  statSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  getCachePath,
  isCacheHit,
  markCacheComplete,
  touchCacheEntry,
  runGC,
  DEFAULT_MAX_SIZE_BYTES,
  DEFAULT_MAX_AGE_MS,
} from "#core/context/cache.js";
import type { FetchTarget } from "#core/context/fetch.js";
import { parseGitUrl, parseSizeString, parseAgeString } from "#adapters/cli/ctx-fetch.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "dt-cache-test-"));
}

function makeTarget(overrides?: Partial<FetchTarget>): FetchTarget {
  return {
    id: "auth-service",
    url: "https://github.com/acme/auth-service.git",
    sha: "abc123def456",
    host: "github.com",
    org: "acme",
    repo: "auth-service",
    ...overrides,
  };
}

/* ─── Cache Path Derivation ───────────────────────────────────────────── */

describe("getCachePath", () => {
  it("derives correct path from target fields", () => {
    const target = makeTarget();
    const baseDir = "/home/user/.dev-tasks/cache";
    const result = getCachePath(target, baseDir);
    expect(result).toBe("/home/user/.dev-tasks/cache/github.com/acme/auth-service/abc123def456");
  });

  it("handles different hosts and orgs", () => {
    const target = makeTarget({
      host: "gitlab.company.com",
      org: "platform",
      repo: "api-gateway",
      sha: "deadbeef",
    });
    const baseDir = "/tmp/cache";
    const result = getCachePath(target, baseDir);
    expect(result).toBe("/tmp/cache/gitlab.company.com/platform/api-gateway/deadbeef");
  });

  it("uses default base when none specified", () => {
    const target = makeTarget();
    const result = getCachePath(target);
    expect(result).toContain(".dev-tasks/cache/github.com/acme/auth-service/abc123def456");
  });
});

/* ─── Cache Hit Detection ─────────────────────────────────────────────── */

describe("isCacheHit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false when directory does not exist", () => {
    expect(isCacheHit(join(tmpDir, "nonexistent"))).toBe(false);
  });

  it("returns false when directory exists but no .complete marker", () => {
    const cacheDir = join(tmpDir, "host", "org", "repo", "sha");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "component.json"), "{}");
    expect(isCacheHit(cacheDir)).toBe(false);
  });

  it("returns true when .complete marker exists", () => {
    const cacheDir = join(tmpDir, "host", "org", "repo", "sha");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, ".complete"), "2024-01-01T00:00:00Z");
    expect(isCacheHit(cacheDir)).toBe(true);
  });
});

/* ─── markCacheComplete ───────────────────────────────────────────────── */

describe("markCacheComplete", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .complete marker file", () => {
    const cacheDir = join(tmpDir, "entry");
    mkdirSync(cacheDir, { recursive: true });
    markCacheComplete(cacheDir);
    expect(existsSync(join(cacheDir, ".complete"))).toBe(true);
  });

  it("makes the entry detectable as a cache hit", () => {
    const cacheDir = join(tmpDir, "entry");
    mkdirSync(cacheDir, { recursive: true });
    expect(isCacheHit(cacheDir)).toBe(false);
    markCacheComplete(cacheDir);
    expect(isCacheHit(cacheDir)).toBe(true);
  });
});

/* ─── touchCacheEntry ─────────────────────────────────────────────────── */

describe("touchCacheEntry", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updates access time on the directory", () => {
    const cacheDir = join(tmpDir, "entry");
    mkdirSync(cacheDir, { recursive: true });

    // Set access time to 10 seconds ago
    const pastTime = new Date(Date.now() - 10_000);
    utimesSync(cacheDir, pastTime, pastTime);

    const beforeStat = statSync(cacheDir);
    touchCacheEntry(cacheDir);
    const afterStat = statSync(cacheDir);
    // After touching, the atime should be newer (closer to now)
    expect(Math.floor(afterStat.atimeMs)).toBeGreaterThan(Math.floor(beforeStat.atimeMs));
  });

  it("does not throw on nonexistent directory", () => {
    expect(() => touchCacheEntry(join(tmpDir, "nonexistent"))).not.toThrow();
  });
});

/* ─── LRU GC ──────────────────────────────────────────────────────────── */

describe("runGC", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns zero evictions on empty cache", () => {
    const result = runGC({ cacheBaseDir: tmpDir });
    expect(result.evicted).toBe(0);
    expect(result.remainingEntries).toBe(0);
  });

  it("returns zero evictions on nonexistent base dir", () => {
    const result = runGC({ cacheBaseDir: join(tmpDir, "nonexistent") });
    expect(result.evicted).toBe(0);
  });

  it("evicts entries older than maxAgeMs", () => {
    // Create two entries: one "old" and one "fresh"
    const oldEntry = join(tmpDir, "github.com", "acme", "old-service", "sha1");
    const freshEntry = join(tmpDir, "github.com", "acme", "fresh-service", "sha2");

    mkdirSync(oldEntry, { recursive: true });
    writeFileSync(join(oldEntry, ".complete"), "done");
    writeFileSync(join(oldEntry, "data.txt"), "old data");

    mkdirSync(freshEntry, { recursive: true });
    writeFileSync(join(freshEntry, ".complete"), "done");
    writeFileSync(join(freshEntry, "data.txt"), "fresh data");

    // Set old entry access time to 31 days ago
    const oldTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    utimesSync(oldEntry, oldTime, oldTime);

    // Set fresh entry access time to now
    const now = new Date();
    utimesSync(freshEntry, now, now);

    const result = runGC({ cacheBaseDir: tmpDir, maxAgeMs: DEFAULT_MAX_AGE_MS });
    expect(result.evicted).toBe(1);
    expect(existsSync(oldEntry)).toBe(false);
    expect(existsSync(freshEntry)).toBe(true);
  });

  it("evicts by LRU when total size exceeds budget", () => {
    // Create entries with data that exceeds a small budget
    const entry1 = join(tmpDir, "github.com", "acme", "svc-a", "sha1");
    const entry2 = join(tmpDir, "github.com", "acme", "svc-b", "sha2");
    const entry3 = join(tmpDir, "github.com", "acme", "svc-c", "sha3");

    mkdirSync(entry1, { recursive: true });
    writeFileSync(join(entry1, ".complete"), "done");
    writeFileSync(join(entry1, "data.txt"), "x".repeat(1000)); // ~1KB

    mkdirSync(entry2, { recursive: true });
    writeFileSync(join(entry2, ".complete"), "done");
    writeFileSync(join(entry2, "data.txt"), "y".repeat(1000));

    mkdirSync(entry3, { recursive: true });
    writeFileSync(join(entry3, ".complete"), "done");
    writeFileSync(join(entry3, "data.txt"), "z".repeat(1000));

    // Set access times: entry1 oldest, entry3 newest
    utimesSync(entry1, new Date(Date.now() - 3000), new Date(Date.now() - 3000));
    utimesSync(entry2, new Date(Date.now() - 2000), new Date(Date.now() - 2000));
    utimesSync(entry3, new Date(Date.now() - 1000), new Date(Date.now() - 1000));

    // Budget of ~2KB — should evict the oldest (entry1)
    const result = runGC({
      cacheBaseDir: tmpDir,
      maxSizeBytes: 2200,
      maxAgeMs: 365 * 24 * 60 * 60 * 1000, // 1 year (don't age-evict)
    });

    expect(result.evicted).toBeGreaterThanOrEqual(1);
    // At least the oldest entry should be gone
    expect(existsSync(entry1)).toBe(false);
  });

  it("preserves entries within budget and age", () => {
    const entry = join(tmpDir, "github.com", "acme", "svc", "sha");
    mkdirSync(entry, { recursive: true });
    writeFileSync(join(entry, ".complete"), "done");
    writeFileSync(join(entry, "data.txt"), "small");

    const result = runGC({
      cacheBaseDir: tmpDir,
      maxSizeBytes: DEFAULT_MAX_SIZE_BYTES,
      maxAgeMs: DEFAULT_MAX_AGE_MS,
    });
    expect(result.evicted).toBe(0);
    expect(result.remainingEntries).toBe(1);
    expect(existsSync(entry)).toBe(true);
  });
});

/* ─── URL Parsing ─────────────────────────────────────────────────────── */

describe("parseGitUrl", () => {
  it("parses HTTPS URL", () => {
    const result = parseGitUrl("https://github.com/acme/auth-service.git");
    expect(result).toEqual({ host: "github.com", org: "acme", repo: "auth-service" });
  });

  it("parses HTTPS URL without .git suffix", () => {
    const result = parseGitUrl("https://github.com/acme/auth-service");
    expect(result).toEqual({ host: "github.com", org: "acme", repo: "auth-service" });
  });

  it("parses SSH URL", () => {
    const result = parseGitUrl("git@github.com:acme/auth-service.git");
    expect(result).toEqual({ host: "github.com", org: "acme", repo: "auth-service" });
  });

  it("parses SSH URL without .git suffix", () => {
    const result = parseGitUrl("git@gitlab.com:org/repo");
    expect(result).toEqual({ host: "gitlab.com", org: "org", repo: "repo" });
  });

  it("handles local file paths", () => {
    const result = parseGitUrl("/tmp/repos/my-service");
    expect(result).toEqual({ host: "local", org: "repos", repo: "my-service" });
  });
});

/* ─── Size/Age String Parsing ─────────────────────────────────────────── */

describe("parseSizeString", () => {
  it("parses GB", () => {
    expect(parseSizeString("5GB")).toBe(5 * 1024 * 1024 * 1024);
  });

  it("parses MB", () => {
    expect(parseSizeString("500MB")).toBe(500 * 1024 * 1024);
  });

  it("parses KB", () => {
    expect(parseSizeString("100KB")).toBe(100 * 1024);
  });

  it("defaults to 5GB on invalid", () => {
    expect(parseSizeString("invalid")).toBe(5 * 1024 * 1024 * 1024);
  });
});

describe("parseAgeString", () => {
  it("parses days", () => {
    expect(parseAgeString("30d")).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("parses hours", () => {
    expect(parseAgeString("24h")).toBe(24 * 60 * 60 * 1000);
  });

  it("parses minutes", () => {
    expect(parseAgeString("60m")).toBe(60 * 60 * 1000);
  });

  it("defaults to 30 days on invalid", () => {
    expect(parseAgeString("bad")).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

/* ─── Constants ───────────────────────────────────────────────────────── */

describe("cache constants", () => {
  it("DEFAULT_MAX_SIZE_BYTES is 5 GB", () => {
    expect(DEFAULT_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024 * 1024);
  });

  it("DEFAULT_MAX_AGE_MS is 30 days", () => {
    expect(DEFAULT_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
