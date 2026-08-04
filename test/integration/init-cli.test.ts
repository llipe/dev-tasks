/**
 * Integration tests for `dt init --components` CLI command.
 *
 * Tests: end-to-end init over local fixture repos → lock + bundle emitted;
 * re-run with same inputs → byte-for-byte identical bundle (SHA match);
 * stale index → exit 9; unknown component → exit 12;
 * --no-llm without components → exit 2; meta-repo path not a git repo → clear error.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as yamlStringify } from "yaml";

import { init, StaleIndexError, UnknownComponentError, MetaRepoError } from "#core/context/init.js";
import { readSessionLock } from "#core/context/session-lock.js";
import { runInit } from "#adapters/cli/init.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

let fixtureDir: string;
let metaRepoPath: string;
let bareRepoAuth: string;
let bareRepoUser: string;
let authSha: string;
let userSha: string;
let cacheDir: string;

function createBareRepo(
  name: string,
  files: Record<string, string>,
): { path: string; sha: string } {
  const workDir = mkdtempSync(join(tmpdir(), `dt-init-work-${name}-`));
  execSync("git init", { cwd: workDir, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: workDir, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: workDir, stdio: "pipe" });

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(workDir, filePath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }

  execSync("git add -A", { cwd: workDir, stdio: "pipe" });
  execSync('git commit -m "initial"', { cwd: workDir, stdio: "pipe" });

  const sha = execSync("git rev-parse HEAD", {
    cwd: workDir,
    stdio: "pipe",
    encoding: "utf-8",
  }).trim();

  // Clone to bare
  const barePath = mkdtempSync(join(tmpdir(), `dt-init-bare-${name}-`));
  rmSync(barePath, { recursive: true, force: true });
  execSync(`git clone --bare "${workDir}" "${barePath}"`, { stdio: "pipe" });
  rmSync(workDir, { recursive: true, force: true });

  return { path: barePath, sha };
}

function makeTestIndex(
  authUrl: string,
  authSha: string,
  userUrl: string,
  userSha: string,
): CatalogIndex {
  return {
    generated_at: new Date().toISOString(),
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth Service",
        description: "Handles authentication",
        repo: authUrl,
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
        origin_sha: authSha,
      },
      {
        id: "user-service",
        name: "User Service",
        description: "Manages user profiles",
        repo: userUrl,
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
        origin_sha: userSha,
      },
    ],
    contracts: {
      "auth-api": { provider: "auth-service", kind: "rest", consumers: [] },
      "user-api": { provider: "user-service", kind: "rest", consumers: ["auth-service"] },
    },
    domains: [{ name: "identity", components: ["auth-service", "user-service"] }],
    flows: [],
    extraction_quality: {
      total: { high: 10, medium: 3, low: 1 },
      per_component: [],
    },
    errors: [],
  };
}

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), "dt-init-fixture-"));
  cacheDir = mkdtempSync(join(tmpdir(), "dt-init-cache-"));

  // Create bare fixture repos
  const authResult = createBareRepo("auth", {
    "component.json": JSON.stringify({ id: "auth-service", name: "Auth Service" }, null, 2),
    "docs/README.md": "# Auth Service\n\nAuthentication documentation.",
    "contracts/auth-api.yaml":
      "openapi: 3.0.0\ninfo:\n  title: Auth API\n  version: 1.0.0\npaths: {}\n",
  });
  bareRepoAuth = authResult.path;
  authSha = authResult.sha;

  const userResult = createBareRepo("user", {
    "component.json": JSON.stringify({ id: "user-service", name: "User Service" }, null, 2),
    "docs/README.md": "# User Service\n\nUser management documentation.",
    "contracts/user-api.yaml":
      "openapi: 3.0.0\ninfo:\n  title: User API\n  version: 1.0.0\npaths: {}\n",
  });
  bareRepoUser = userResult.path;
  userSha = userResult.sha;

  // Create meta-repo with catalog index referencing bare repos
  metaRepoPath = join(fixtureDir, "meta-repo");
  mkdirSync(metaRepoPath, { recursive: true });
  execSync("git init", { cwd: metaRepoPath, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: metaRepoPath, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: metaRepoPath, stdio: "pipe" });

  // Create catalog/index.yaml
  mkdirSync(join(metaRepoPath, "catalog"), { recursive: true });
  const index = makeTestIndex(bareRepoAuth, authSha, bareRepoUser, userSha);
  writeFileSync(join(metaRepoPath, "catalog", "index.yaml"), yamlStringify(index));

  // Create architecture.md and conventions.md
  writeFileSync(join(metaRepoPath, "architecture.md"), "# Architecture\n\nSystem overview.");
  writeFileSync(join(metaRepoPath, "conventions.md"), "# Conventions\n\nNaming conventions.");

  execSync("git add -A", { cwd: metaRepoPath, stdio: "pipe" });
  execSync('git commit -m "initial meta-repo"', { cwd: metaRepoPath, stdio: "pipe" });
});

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
  rmSync(bareRepoAuth, { recursive: true, force: true });
  rmSync(bareRepoUser, { recursive: true, force: true });
  rmSync(cacheDir, { recursive: true, force: true });
});

/* ─── End-to-End Init ─────────────────────────────────────────────────── */

describe("dt init --components (end-to-end)", () => {
  it("produces session.lock.json and bundle files for valid components", async () => {
    const outDir = join(fixtureDir, "out-1");

    const result = await init({
      components: ["auth-service"],
      metaRepoPath,
      outDir,
      cacheBaseDir: cacheDir,
    });

    // session.lock.json exists
    expect(existsSync(join(outDir, "session.lock.json"))).toBe(true);

    // Bundle files exist
    expect(result.bundleManifest.files.length).toBeGreaterThan(0);
    for (const file of result.bundleManifest.files) {
      expect(existsSync(join(outDir, file.filename))).toBe(true);
    }

    // Session lock has correct structure
    const lock = readSessionLock(outDir);
    expect(lock.meta_repo_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(lock.scope.components).toEqual(["auth-service"]);
    expect(lock.scope.source).toBe("manual");
    expect(lock.repo_shas["auth-service"]).toBe(authSha);
    expect(lock.total_tokens).toBeGreaterThan(0);
    expect(lock.index_age_minutes).toBeGreaterThanOrEqual(0);
  });

  it("reproducibility: re-run with same inputs produces identical bundle (SHA match)", async () => {
    const outDir1 = join(fixtureDir, "out-repro-1");
    const outDir2 = join(fixtureDir, "out-repro-2");

    const result1 = await init({
      components: ["auth-service"],
      metaRepoPath,
      outDir: outDir1,
      cacheBaseDir: cacheDir,
    });

    const result2 = await init({
      components: ["auth-service"],
      metaRepoPath,
      outDir: outDir2,
      cacheBaseDir: cacheDir,
    });

    // Same number of files
    expect(result1.bundleManifest.files.length).toBe(result2.bundleManifest.files.length);

    // Same SHA-256 per file
    for (let i = 0; i < result1.bundleManifest.files.length; i++) {
      expect(result1.bundleManifest.files[i].sha256).toBe(result2.bundleManifest.files[i].sha256);
      expect(result1.bundleManifest.files[i].filename).toBe(
        result2.bundleManifest.files[i].filename,
      );
    }

    // Same total tokens
    expect(result1.bundleManifest.totalTokens).toBe(result2.bundleManifest.totalTokens);

    // Same task hash
    expect(result1.sessionLock.task_hash).toBe(result2.sessionLock.task_hash);
  });

  it("multiple components init produces correct scope", async () => {
    const outDir = join(fixtureDir, "out-multi");

    await init({
      components: ["auth-service", "user-service"],
      metaRepoPath,
      outDir,
      cacheBaseDir: cacheDir,
    });

    const lock = readSessionLock(outDir);
    expect(lock.scope.components).toEqual(["auth-service", "user-service"]);
    expect(lock.repo_shas["auth-service"]).toBe(authSha);
    expect(lock.repo_shas["user-service"]).toBe(userSha);
  });
});

/* ─── Error Cases ─────────────────────────────────────────────────────── */

describe("dt init error cases", () => {
  it("stale index → throws StaleIndexError", async () => {
    // Create a meta-repo with a very stale index
    const staleMetaDir = join(fixtureDir, "stale-meta");
    mkdirSync(staleMetaDir, { recursive: true });
    execSync("git init", { cwd: staleMetaDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: staleMetaDir, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: staleMetaDir, stdio: "pipe" });

    mkdirSync(join(staleMetaDir, "catalog"), { recursive: true });
    const staleIndex = makeTestIndex(bareRepoAuth, authSha, bareRepoUser, userSha);
    staleIndex.generated_at = new Date(Date.now() - 300 * 60 * 1000).toISOString(); // 300 min ago
    writeFileSync(join(staleMetaDir, "catalog", "index.yaml"), yamlStringify(staleIndex));

    execSync("git add -A", { cwd: staleMetaDir, stdio: "pipe" });
    execSync('git commit -m "stale"', { cwd: staleMetaDir, stdio: "pipe" });

    await expect(
      init({
        components: ["auth-service"],
        metaRepoPath: staleMetaDir,
        outDir: join(fixtureDir, "out-stale"),
        cacheBaseDir: cacheDir,
      }),
    ).rejects.toThrow(StaleIndexError);
  });

  it("unknown component → throws UnknownComponentError", async () => {
    await expect(
      init({
        components: ["nonexistent-service"],
        metaRepoPath,
        outDir: join(fixtureDir, "out-unknown"),
        cacheBaseDir: cacheDir,
      }),
    ).rejects.toThrow(UnknownComponentError);
  });

  it("meta-repo path not a git repo → throws MetaRepoError", async () => {
    const notGit = join(fixtureDir, "not-git");
    mkdirSync(notGit, { recursive: true });
    writeFileSync(join(notGit, "file.txt"), "hello");

    await expect(
      init({
        components: ["auth-service"],
        metaRepoPath: notGit,
        outDir: join(fixtureDir, "out-notgit"),
        cacheBaseDir: cacheDir,
      }),
    ).rejects.toThrow(MetaRepoError);
  });
});

/* ─── CLI Exit Code Tests ─────────────────────────────────────────────── */

describe("runInit CLI exit codes", () => {
  it("--no-llm without --components → exit 2", async () => {
    const code = await runInit({
      json: true,
      noLlm: true,
      // no components
    });
    expect(code).toBe(2);
  });

  it("missing --components → exit 2", async () => {
    const code = await runInit({
      json: true,
      // no components, no noLlm
    });
    expect(code).toBe(2);
  });

  it("unknown component → exit 12", async () => {
    const code = await runInit({
      json: true,
      components: "unknown-service",
      metaRepo: metaRepoPath,
      out: join(fixtureDir, "out-cli-unknown"),
      cacheBaseDir: cacheDir,
    });
    expect(code).toBe(12);
  });

  it("stale index → exit 9", async () => {
    // Create a meta-repo with a very stale index
    const staleMetaDir = join(fixtureDir, "stale-meta-cli");
    mkdirSync(staleMetaDir, { recursive: true });
    execSync("git init", { cwd: staleMetaDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', { cwd: staleMetaDir, stdio: "pipe" });
    execSync('git config user.name "Test"', { cwd: staleMetaDir, stdio: "pipe" });

    mkdirSync(join(staleMetaDir, "catalog"), { recursive: true });
    const staleIndex = makeTestIndex(bareRepoAuth, authSha, bareRepoUser, userSha);
    staleIndex.generated_at = new Date(Date.now() - 500 * 60 * 1000).toISOString();
    writeFileSync(join(staleMetaDir, "catalog", "index.yaml"), yamlStringify(staleIndex));

    execSync("git add -A", { cwd: staleMetaDir, stdio: "pipe" });
    execSync('git commit -m "stale"', { cwd: staleMetaDir, stdio: "pipe" });

    const code = await runInit({
      json: true,
      components: "auth-service",
      metaRepo: staleMetaDir,
      out: join(fixtureDir, "out-cli-stale"),
      cacheBaseDir: cacheDir,
    });
    expect(code).toBe(9);
  });

  it("successful init → exit 0", async () => {
    const code = await runInit({
      json: true,
      components: "auth-service",
      metaRepo: metaRepoPath,
      out: join(fixtureDir, "out-cli-success"),
      cacheBaseDir: cacheDir,
    });
    expect(code).toBe(0);
  });
});
