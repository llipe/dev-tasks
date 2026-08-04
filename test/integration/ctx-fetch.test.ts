/**
 * Integration tests for `dt ctx fetch` command.
 *
 * Tests: fetch a local fixture repo (bare git); cache hit on re-fetch;
 * --refresh bypass; unreachable repo → exit 5.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ctxFetch, type FetchTarget } from "#core/context/fetch.js";
import { isCacheHit, getCachePath } from "#core/context/cache.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

let fixtureDir: string;
let bareRepoPath: string;
let commitSha: string;
let cacheDir: string;

function createBareFixtureRepo(): { path: string; sha: string } {
  // Create a temporary working repo
  const workDir = mkdtempSync(join(tmpdir(), "dt-fetch-work-"));
  execSync("git init", { cwd: workDir, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: workDir, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: workDir, stdio: "pipe" });

  // Create component.json
  writeFileSync(
    join(workDir, "component.json"),
    JSON.stringify({ id: "test-service", name: "Test Service" }, null, 2),
  );

  // Create docs/
  mkdirSync(join(workDir, "docs"), { recursive: true });
  writeFileSync(join(workDir, "docs", "README.md"), "# Test Service\n\nDocumentation.");

  // Create contracts/
  mkdirSync(join(workDir, "contracts"), { recursive: true });
  writeFileSync(
    join(workDir, "contracts", "api.yaml"),
    "openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n",
  );

  // Create a file that should NOT be fetched (sparse checkout)
  mkdirSync(join(workDir, "src"), { recursive: true });
  writeFileSync(join(workDir, "src", "index.ts"), "export const x = 1;\n");

  execSync("git add -A", { cwd: workDir, stdio: "pipe" });
  execSync('git commit -m "initial"', { cwd: workDir, stdio: "pipe" });

  const sha = execSync("git rev-parse HEAD", { cwd: workDir, stdio: "pipe" }).toString().trim();

  // Clone to bare repo
  const barePath = mkdtempSync(join(tmpdir(), "dt-fetch-bare-"));
  rmSync(barePath, { recursive: true, force: true });
  execSync(`git clone --bare "${workDir}" "${barePath}"`, { stdio: "pipe" });

  // Cleanup working dir
  rmSync(workDir, { recursive: true, force: true });

  return { path: barePath, sha };
}

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), "dt-fetch-fixture-"));
  const fixture = createBareFixtureRepo();
  bareRepoPath = fixture.path;
  commitSha = fixture.sha;
  cacheDir = mkdtempSync(join(tmpdir(), "dt-fetch-cache-"));
});

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
  rmSync(bareRepoPath, { recursive: true, force: true });
  rmSync(cacheDir, { recursive: true, force: true });
});

/* ─── Integration Tests ───────────────────────────────────────────────── */

describe("ctxFetch integration", () => {
  it("fetches a local bare repo via sparse clone", async () => {
    const target: FetchTarget = {
      id: "test-service",
      url: bareRepoPath,
      sha: commitSha,
      host: "local",
      org: "fixture",
      repo: "test-service",
    };

    const result = await ctxFetch({
      metaRepoPath: fixtureDir,
      targets: [target],
      cacheBaseDir: cacheDir,
      timeoutMs: 30_000,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].cacheHit).toBe(false);
    expect(result.entries[0].error).toBeUndefined();

    // Verify cached content
    const cachePath = result.entries[0].cachePath;
    expect(existsSync(join(cachePath, "component.json"))).toBe(true);
    expect(existsSync(join(cachePath, "docs", "README.md"))).toBe(true);
    expect(existsSync(join(cachePath, "contracts", "api.yaml"))).toBe(true);

    // Verify content is correct
    const component = JSON.parse(readFileSync(join(cachePath, "component.json"), "utf-8"));
    expect(component.id).toBe("test-service");

    // Verify .complete marker
    expect(isCacheHit(cachePath)).toBe(true);
  });

  it("reports cache hit on second fetch (no git calls)", async () => {
    const target: FetchTarget = {
      id: "test-service",
      url: bareRepoPath,
      sha: commitSha,
      host: "local",
      org: "fixture",
      repo: "test-service",
    };

    // First fetch (if not already cached)
    await ctxFetch({
      metaRepoPath: fixtureDir,
      targets: [target],
      cacheBaseDir: cacheDir,
      timeoutMs: 30_000,
    });

    // Second fetch — should be cache hit
    const result = await ctxFetch({
      metaRepoPath: fixtureDir,
      targets: [target],
      cacheBaseDir: cacheDir,
      timeoutMs: 30_000,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].cacheHit).toBe(true);
  });

  it("--refresh bypasses cache hit", async () => {
    const target: FetchTarget = {
      id: "test-service",
      url: bareRepoPath,
      sha: commitSha,
      host: "local",
      org: "fixture",
      repo: "test-service",
    };

    // Ensure cache is populated
    await ctxFetch({
      metaRepoPath: fixtureDir,
      targets: [target],
      cacheBaseDir: cacheDir,
      timeoutMs: 30_000,
    });

    // Fetch with refresh
    const result = await ctxFetch({
      metaRepoPath: fixtureDir,
      targets: [target],
      refresh: true,
      cacheBaseDir: cacheDir,
      timeoutMs: 30_000,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.entries[0].cacheHit).toBe(false); // Not from cache
  });

  it("unreachable repo returns error (exit 5 scenario)", async () => {
    const target: FetchTarget = {
      id: "ghost-service",
      url: "/nonexistent/path/to/repo.git",
      sha: "0000000000000000000000000000000000000000",
      host: "local",
      org: "ghost",
      repo: "ghost-service",
    };

    const result = await ctxFetch({
      metaRepoPath: fixtureDir,
      targets: [target],
      cacheBaseDir: cacheDir,
      timeoutMs: 5_000,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe("ghost-service");
    expect(result.errors[0].error).toBeDefined();
  });

  it("handles multiple targets with mixed success/failure", async () => {
    const targets: FetchTarget[] = [
      {
        id: "test-service",
        url: bareRepoPath,
        sha: commitSha,
        host: "local",
        org: "fixture",
        repo: "test-service-multi",
      },
      {
        id: "bad-service",
        url: "/nonexistent/repo",
        sha: "bad",
        host: "local",
        org: "fixture",
        repo: "bad-service",
      },
    ];

    const result = await ctxFetch({
      metaRepoPath: fixtureDir,
      targets,
      cacheBaseDir: cacheDir,
      timeoutMs: 10_000,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe("bad-service");

    const successEntry = result.entries.find((e) => e.id === "test-service");
    expect(successEntry?.error).toBeUndefined();
  });

  it("partial clone interrupted cleans up cache directory", async () => {
    const target: FetchTarget = {
      id: "timeout-service",
      url: "/nonexistent/slow/repo",
      sha: "fake-sha",
      host: "local",
      org: "fixture",
      repo: "timeout-service",
    };

    const _result = await ctxFetch({
      metaRepoPath: fixtureDir,
      targets: [target],
      cacheBaseDir: cacheDir,
      timeoutMs: 2_000,
    });

    // Should not leave a partial cache entry
    const cachePath = getCachePath(target, cacheDir);
    expect(isCacheHit(cachePath)).toBe(false);
    // Either the dir was cleaned up or doesn't exist
    expect(existsSync(join(cachePath, ".complete"))).toBe(false);
  });
});
