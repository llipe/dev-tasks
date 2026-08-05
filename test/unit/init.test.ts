/**
 * Unit tests for core/context/init.ts and core/context/session-lock.ts
 *
 * Tests: pin resolution; freshness check logic (stale/fresh boundary);
 * session-lock assembly; unknown component detection; task hash computation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as yamlStringify } from "yaml";

import {
  resolveMetaRepoSha,
  loadAndCheckIndex,
  validateComponents,
  buildFetchTargets,
  StaleIndexError,
  UnknownComponentError,
  MetaRepoError,
  DEFAULT_MAX_INDEX_AGE,
} from "#core/context/init.js";
import {
  computeTaskHash,
  buildSessionLock,
  writeSessionLock,
  readSessionLock,
  type SessionLock,
} from "#core/context/session-lock.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { BundleManifest } from "#core/context/assemble.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "dt-init-test-"));
}

function makeGitRepo(dir: string): string {
  mkdirSync(dir, { recursive: true });
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "README.md"), "# Test\n");
  execSync("git add -A", { cwd: dir, stdio: "pipe" });
  execSync('git commit -m "initial"', { cwd: dir, stdio: "pipe" });
  return execSync("git rev-parse HEAD", { cwd: dir, stdio: "pipe", encoding: "utf-8" }).trim();
}

function makeIndex(overrides?: Partial<CatalogIndex>): CatalogIndex {
  return {
    generated_at: new Date().toISOString(),
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth Service",
        description: "Handles authentication",
        repo: "https://github.com/acme/auth-service.git",
        type: "service",
        domain: "identity",
        owner: "team-security",
        criticality: "critical",
        lifecycle: "active",
        stack: ["typescript"],
        aliases: ["auth"],
        provides: [{ id: "auth-api", kind: "rest", source: "manual", confidence: "high" }],
        consumes: [{ contract: "user-api", criticality: "high" }],
        datastores: ["auth-db"],
        origin_sha: "abc123def456",
      },
      {
        id: "user-service",
        name: "User Service",
        description: "Manages user profiles",
        repo: "https://github.com/acme/user-service.git",
        type: "service",
        domain: "identity",
        owner: "team-platform",
        criticality: "high",
        lifecycle: "active",
        stack: ["typescript"],
        aliases: ["users"],
        provides: [{ id: "user-api", kind: "rest", source: "manual", confidence: "high" }],
        consumes: [],
        datastores: ["user-db"],
        origin_sha: "def456abc789",
      },
    ],
    contracts: {
      "auth-api": { provider: "auth-service", kind: "rest", consumers: ["user-service"] },
      "user-api": { provider: "user-service", kind: "rest", consumers: ["auth-service"] },
    },
    domains: [{ name: "identity", components: ["auth-service", "user-service"] }],
    flows: [],
    extraction_quality: {
      total: { high: 10, medium: 3, low: 1 },
      per_component: [],
    },
    errors: [],
    ...overrides,
  };
}

function setupMetaRepo(tmpDir: string, index?: CatalogIndex): string {
  const metaDir = join(tmpDir, "meta-repo");
  makeGitRepo(metaDir);

  // Create catalog/index.yaml
  mkdirSync(join(metaDir, "catalog"), { recursive: true });
  const idx = index ?? makeIndex();
  writeFileSync(join(metaDir, "catalog", "index.yaml"), yamlStringify(idx));

  // Commit the index
  execSync("git add -A", { cwd: metaDir, stdio: "pipe" });
  execSync('git commit -m "add catalog"', { cwd: metaDir, stdio: "pipe" });

  return metaDir;
}

/* ─── resolveMetaRepoSha ─────────────────────────────────────────────── */

describe("resolveMetaRepoSha", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns a valid SHA for a git repo", () => {
    const repoDir = join(tmpDir, "repo");
    const expectedSha = makeGitRepo(repoDir);
    const result = resolveMetaRepoSha(repoDir);
    expect(result).toBe(expectedSha);
    expect(result).toMatch(/^[0-9a-f]{40}$/);
  });

  it("throws MetaRepoError for non-existent path", () => {
    expect(() => resolveMetaRepoSha(join(tmpDir, "nonexistent"))).toThrow(MetaRepoError);
    expect(() => resolveMetaRepoSha(join(tmpDir, "nonexistent"))).toThrow("does not exist");
  });

  it("throws MetaRepoError for non-git directory", () => {
    const notGit = join(tmpDir, "not-git");
    mkdirSync(notGit, { recursive: true });
    writeFileSync(join(notGit, "file.txt"), "hello");
    expect(() => resolveMetaRepoSha(notGit)).toThrow(MetaRepoError);
    expect(() => resolveMetaRepoSha(notGit)).toThrow("not a git repository");
  });
});

/* ─── loadAndCheckIndex ───────────────────────────────────────────────── */

describe("loadAndCheckIndex", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns index and age for a fresh index", () => {
    const metaDir = setupMetaRepo(tmpDir);
    const { index, ageMinutes } = loadAndCheckIndex(metaDir, DEFAULT_MAX_INDEX_AGE);
    expect(index).toBeDefined();
    expect(index.components.length).toBe(2);
    expect(ageMinutes).toBeGreaterThanOrEqual(0);
    expect(ageMinutes).toBeLessThan(5); // should be very fresh
  });

  it("throws StaleIndexError when index is too old", () => {
    const metaDir = join(tmpDir, "stale-meta");
    makeGitRepo(metaDir);
    mkdirSync(join(metaDir, "catalog"), { recursive: true });

    // Create index generated 300 minutes ago
    const staleTime = new Date(Date.now() - 300 * 60 * 1000).toISOString();
    const idx = makeIndex({ generated_at: staleTime });
    writeFileSync(join(metaDir, "catalog", "index.yaml"), yamlStringify(idx));

    expect(() => loadAndCheckIndex(metaDir, 240)).toThrow(StaleIndexError);
    try {
      loadAndCheckIndex(metaDir, 240);
    } catch (err) {
      expect(err).toBeInstanceOf(StaleIndexError);
      const staleErr = err as StaleIndexError;
      expect(staleErr.ageMinutes).toBeGreaterThanOrEqual(299);
      expect(staleErr.maxMinutes).toBe(240);
    }
  });

  it("passes when index age is exactly at the boundary", () => {
    const metaDir = join(tmpDir, "boundary-meta");
    makeGitRepo(metaDir);
    mkdirSync(join(metaDir, "catalog"), { recursive: true });

    // Index at exactly 239 minutes ago (just within 240 limit)
    const borderTime = new Date(Date.now() - 239 * 60 * 1000).toISOString();
    const idx = makeIndex({ generated_at: borderTime });
    writeFileSync(join(metaDir, "catalog", "index.yaml"), yamlStringify(idx));

    const { ageMinutes } = loadAndCheckIndex(metaDir, 240);
    expect(ageMinutes).toBeLessThanOrEqual(240);
  });

  it("throws MetaRepoError when catalog/index.yaml is missing", () => {
    const metaDir = join(tmpDir, "no-index-meta");
    makeGitRepo(metaDir);
    expect(() => loadAndCheckIndex(metaDir, 240)).toThrow(MetaRepoError);
    expect(() => loadAndCheckIndex(metaDir, 240)).toThrow("Catalog index not found");
  });

  it("throws MetaRepoError when generated_at field is missing", () => {
    const metaDir = join(tmpDir, "no-gentime-meta");
    makeGitRepo(metaDir);
    mkdirSync(join(metaDir, "catalog"), { recursive: true });

    const idx = makeIndex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (idx as any).generated_at;
    writeFileSync(join(metaDir, "catalog", "index.yaml"), yamlStringify(idx));

    expect(() => loadAndCheckIndex(metaDir, 240)).toThrow(MetaRepoError);
    expect(() => loadAndCheckIndex(metaDir, 240)).toThrow("missing 'generated_at'");
  });
});

/* ─── validateComponents ──────────────────────────────────────────────── */

describe("validateComponents", () => {
  const index = makeIndex();

  it("passes for known component ids", () => {
    expect(() => validateComponents(["auth-service", "user-service"], index)).not.toThrow();
  });

  it("passes for a single known component", () => {
    expect(() => validateComponents(["auth-service"], index)).not.toThrow();
  });

  it("throws UnknownComponentError for unknown id", () => {
    expect(() => validateComponents(["auth-service", "unknown-service"], index)).toThrow(
      UnknownComponentError,
    );
  });

  it("includes all unknown ids in the error", () => {
    try {
      validateComponents(["auth-service", "foo", "bar"], index);
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownComponentError);
      const uce = err as UnknownComponentError;
      expect(uce.unknownIds).toEqual(["foo", "bar"]);
    }
  });
});

/* ─── buildFetchTargets ───────────────────────────────────────────────── */

describe("buildFetchTargets", () => {
  const index = makeIndex();

  it("builds targets from known components", () => {
    const targets = buildFetchTargets(["auth-service"], index);
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe("auth-service");
    expect(targets[0].url).toBe("https://github.com/acme/auth-service.git");
    expect(targets[0].sha).toBe("abc123def456");
    expect(targets[0].host).toBe("github.com");
    expect(targets[0].org).toBe("acme");
    expect(targets[0].repo).toBe("auth-service");
  });

  it("builds targets for multiple components", () => {
    const targets = buildFetchTargets(["auth-service", "user-service"], index);
    expect(targets).toHaveLength(2);
  });

  it("skips components not in index (should be validated beforehand)", () => {
    const targets = buildFetchTargets(["unknown"], index);
    expect(targets).toHaveLength(0);
  });
});

/* ─── computeTaskHash ─────────────────────────────────────────────────── */

describe("computeTaskHash", () => {
  it("produces a deterministic SHA-256 hex hash", () => {
    const hash = computeTaskHash(["auth-service", "user-service"]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is order-independent (sorted internally)", () => {
    const hash1 = computeTaskHash(["auth-service", "user-service"]);
    const hash2 = computeTaskHash(["user-service", "auth-service"]);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different component sets", () => {
    const hash1 = computeTaskHash(["auth-service"]);
    const hash2 = computeTaskHash(["user-service"]);
    expect(hash1).not.toBe(hash2);
  });
});

/* ─── buildSessionLock ────────────────────────────────────────────────── */

describe("buildSessionLock", () => {
  it("builds a valid session lock structure", () => {
    const manifest: BundleManifest = {
      files: [
        { filename: "00-index.md", layerId: "00-index", sha256: "aaa", tokens: 100 },
        {
          filename: "04-primary-auth-service.md",
          layerId: "04-primary-auth-service",
          sha256: "bbb",
          tokens: 500,
        },
      ],
      truncated: [],
      totalTokens: 600,
      budget: 60000,
    };

    const lock = buildSessionLock({
      components: ["auth-service"],
      source: "manual",
      metaRepoSha: "abc123def456789",
      indexAgeMinutes: 30,
      repoShas: { "auth-service": "abc123def456" },
      bundleManifest: manifest,
    });

    expect(lock.task_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(lock.meta_repo_sha).toBe("abc123def456789");
    expect(lock.index_age_minutes).toBe(30);
    expect(lock.scope.components).toEqual(["auth-service"]);
    expect(lock.scope.source).toBe("manual");
    expect(lock.repo_shas).toEqual({ "auth-service": "abc123def456" });
    expect(lock.bundle).toHaveLength(2);
    expect(lock.bundle[0].filename).toBe("00-index.md");
    expect(lock.bundle[0].sha256).toBe("aaa");
    expect(lock.bundle[0].tokens).toBe(100);
    expect(lock.total_tokens).toBe(600);
    expect(lock.created_at).toBeDefined();
  });

  it("sorts components in scope", () => {
    const manifest: BundleManifest = {
      files: [],
      truncated: [],
      totalTokens: 0,
      budget: 60000,
    };

    const lock = buildSessionLock({
      components: ["user-service", "auth-service"],
      source: "manual",
      metaRepoSha: "sha",
      indexAgeMinutes: 10,
      repoShas: {},
      bundleManifest: manifest,
    });

    expect(lock.scope.components).toEqual(["auth-service", "user-service"]);
  });
});

/* ─── writeSessionLock / readSessionLock ──────────────────────────────── */

describe("writeSessionLock / readSessionLock", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads back identical data", () => {
    const lock: SessionLock = {
      task_hash: "abc123",
      meta_repo_sha: "def456",
      index_age_minutes: 42,
      scope: { components: ["auth-service"], source: "manual" },
      repo_shas: { "auth-service": "sha1" },
      bundle: [{ filename: "00-index.md", sha256: "hash1", tokens: 100 }],
      total_tokens: 100,
      created_at: "2024-01-15T10:00:00.000Z",
      review_flags: [],
    };

    const path = writeSessionLock(tmpDir, lock);
    expect(existsSync(path)).toBe(true);
    expect(path).toContain("session.lock.json");

    const readBack = readSessionLock(tmpDir);
    expect(readBack).toEqual(lock);
  });

  it("produces valid JSON", () => {
    const lock: SessionLock = {
      task_hash: "hash",
      meta_repo_sha: "sha",
      index_age_minutes: 0,
      scope: { components: [], source: "manual" },
      repo_shas: {},
      bundle: [],
      total_tokens: 0,
      created_at: "2024-01-01T00:00:00.000Z",
      review_flags: [],
    };

    writeSessionLock(tmpDir, lock);
    const content = readFileSync(join(tmpDir, "session.lock.json"), "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });
});
