/**
 * Integration tests for `dt ctx assemble` CLI command.
 *
 * Tests: end-to-end assembly from scope + fixtures, SHA-256 reproducibility,
 * budget exceeded exit code, deterministic output.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures/context/assemble");
const BIN = resolve(import.meta.dirname, "../../bin/dt.ts");

function runDt(
  args: string[],
  opts?: { cwd?: string },
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execFileSync("npx", ["tsx", BIN, ...args], {
      cwd: opts?.cwd ?? FIXTURE_DIR,
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    return { stdout: result, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "dt-ctx-assemble-int-"));
}

/* ─── Tests ───────────────────────────────────────────────────────────── */

describe("dt ctx assemble — integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("assembles a bundle from scope + fixtures (human output)", () => {
    const outDir = join(tmpDir, "bundle");
    const result = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      outDir,
      "--meta-repo",
      FIXTURE_DIR,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Bundle assembled");
    expect(existsSync(join(outDir, "bundle.json"))).toBe(true);
    expect(existsSync(join(outDir, "00-index.md"))).toBe(true);
    expect(existsSync(join(outDir, "01-flow.md"))).toBe(true);
    expect(existsSync(join(outDir, "02-conventions-delta.md"))).toBe(true);
    expect(existsSync(join(outDir, "03-architecture.md"))).toBe(true);
  });

  it("assembles with --json flag and returns manifest", () => {
    const outDir = join(tmpDir, "bundle");
    const result = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      outDir,
      "--meta-repo",
      FIXTURE_DIR,
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const manifest = JSON.parse(result.stdout);
    expect(manifest.files).toBeDefined();
    expect(manifest.files.length).toBeGreaterThan(0);
    expect(manifest.budget).toBe(60000);
    expect(manifest.totalTokens).toBeLessThanOrEqual(60000);

    // Verify SHA-256 format
    for (const file of manifest.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.tokens).toBeGreaterThan(0);
    }
  });

  it("produces deterministic output (same SHA-256 on re-run)", () => {
    const outDir1 = join(tmpDir, "bundle1");
    const outDir2 = join(tmpDir, "bundle2");
    const scopePath = join(FIXTURE_DIR, "scope.json");

    const result1 = runDt([
      "ctx",
      "assemble",
      "--scope",
      scopePath,
      "--out",
      outDir1,
      "--meta-repo",
      FIXTURE_DIR,
      "--json",
    ]);
    const result2 = runDt([
      "ctx",
      "assemble",
      "--scope",
      scopePath,
      "--out",
      outDir2,
      "--meta-repo",
      FIXTURE_DIR,
      "--json",
    ]);

    expect(result1.exitCode).toBe(0);
    expect(result2.exitCode).toBe(0);

    const manifest1 = JSON.parse(result1.stdout);
    const manifest2 = JSON.parse(result2.stdout);

    expect(manifest1.files.length).toBe(manifest2.files.length);
    for (let i = 0; i < manifest1.files.length; i++) {
      expect(manifest1.files[i].sha256).toBe(manifest2.files[i].sha256);
      expect(manifest1.files[i].filename).toBe(manifest2.files[i].filename);
    }
  });

  it("records truncation when budget is tight", () => {
    const outDir = join(tmpDir, "bundle");
    // First, assemble with a large budget to find the non-truncable minimum
    const probeResult = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      join(tmpDir, "probe"),
      "--meta-repo",
      FIXTURE_DIR,
      "--json",
    ]);
    expect(probeResult.exitCode).toBe(0);
    const probeManifest = JSON.parse(probeResult.stdout);
    const totalTokens = probeManifest.totalTokens as number;
    // Use a budget that's above non-truncable minimum but below total
    // This ensures truncation happens on truncable layers
    const tightBudget = Math.max(Math.floor(totalTokens * 0.6), 300);

    const result = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      outDir,
      "--meta-repo",
      FIXTURE_DIR,
      "--budget",
      String(tightBudget),
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const manifest = JSON.parse(result.stdout);
    expect(manifest.totalTokens).toBeLessThanOrEqual(tightBudget);
    expect(manifest.truncated.length).toBeGreaterThan(0);

    for (const t of manifest.truncated) {
      expect(t.layerId).toBeDefined();
      expect(t.originalTokens).toBeGreaterThanOrEqual(t.truncatedTo);
    }
  });

  it("exits 6 when non-truncable layers exceed budget", () => {
    // Create a scope with a very large conventions file
    const bigMetaRepo = join(tmpDir, "big-meta");
    mkdirSync(join(bigMetaRepo, "catalog"), { recursive: true });

    // Copy index
    const indexContent = readFileSync(join(FIXTURE_DIR, "catalog", "index.yaml"), "utf-8");
    writeFileSync(join(bigMetaRepo, "catalog", "index.yaml"), indexContent);

    // Create huge conventions (non-truncable)
    const hugeConventions = "# Conventions\n\n" + "Important rule: ".repeat(50_000);
    writeFileSync(join(bigMetaRepo, "conventions.md"), hugeConventions);

    const outDir = join(tmpDir, "bundle");
    const result = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      outDir,
      "--meta-repo",
      bigMetaRepo,
      "--budget",
      "100",
      "--json",
    ]);

    expect(result.exitCode).toBe(6);
    const output = JSON.parse(result.stdout);
    expect(output.error).toContain("Non-truncable");
    expect(output.required_tokens).toBeGreaterThan(100);
    expect(output.budget).toBe(100);
  });

  it("exits 2 on missing --scope flag", () => {
    const result = runDt(["ctx", "assemble", "--out", join(tmpDir, "bundle"), "--json"]);

    expect(result.exitCode).toBe(2);
    const output = JSON.parse(result.stdout);
    expect(output.error).toContain("--scope");
  });

  it("exits 2 on missing --out flag", () => {
    const result = runDt(["ctx", "assemble", "--scope", join(FIXTURE_DIR, "scope.json"), "--json"]);

    expect(result.exitCode).toBe(2);
    const output = JSON.parse(result.stdout);
    expect(output.error).toContain("--out");
  });

  it("exits 5 on missing scope file", () => {
    const result = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(tmpDir, "nonexistent.json"),
      "--out",
      join(tmpDir, "bundle"),
      "--json",
    ]);

    expect(result.exitCode).toBe(5);
    const output = JSON.parse(result.stdout);
    expect(output.error).toContain("not found");
  });

  it("exits 5 when meta-repo has no catalog/index.yaml", () => {
    const emptyMeta = join(tmpDir, "empty-meta");
    mkdirSync(emptyMeta, { recursive: true });

    const result = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      join(tmpDir, "bundle"),
      "--meta-repo",
      emptyMeta,
      "--json",
    ]);

    expect(result.exitCode).toBe(5);
  });

  it("renders secondary components as summary only", () => {
    const outDir = join(tmpDir, "bundle");
    runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      outDir,
      "--meta-repo",
      FIXTURE_DIR,
    ]);

    const secondaryFile = join(outDir, "05-secondary-notification-service.md");
    expect(existsSync(secondaryFile)).toBe(true);
    const content = readFileSync(secondaryFile, "utf-8");
    expect(content).toContain("notification-service");
    expect(content).toContain("secondary");
    // Summary only — no full docs
    expect(content).not.toContain("## Documentation");
  });

  it("renders contracts with visible confidence badges", () => {
    const outDir = join(tmpDir, "bundle");
    runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      outDir,
      "--meta-repo",
      FIXTURE_DIR,
    ]);

    const contractsFile = join(outDir, "06-contracts.md");
    expect(existsSync(contractsFile)).toBe(true);
    const content = readFileSync(contractsFile, "utf-8");
    // Should contain confidence badges
    expect(content).toContain("[HIGH]");
  });

  it("produces files in fixed order matching layer priorities", () => {
    const outDir = join(tmpDir, "bundle");
    const result = runDt([
      "ctx",
      "assemble",
      "--scope",
      join(FIXTURE_DIR, "scope.json"),
      "--out",
      outDir,
      "--meta-repo",
      FIXTURE_DIR,
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const manifest = JSON.parse(result.stdout);
    const filenames = manifest.files.map((f: { filename: string }) => f.filename);

    // Verify ordering
    const expectedOrder = [
      "00-index.md",
      "01-flow.md",
      "02-conventions-delta.md",
      "03-architecture.md",
    ];
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(filenames[i]).toBe(expectedOrder[i]);
    }

    // Primary files come before secondary
    const primaryIdx = filenames.findIndex((f: string) => f.startsWith("04-"));
    const secondaryIdx = filenames.findIndex((f: string) => f.startsWith("05-"));
    const contractsIdx = filenames.findIndex((f: string) => f.startsWith("06-"));

    if (primaryIdx >= 0 && secondaryIdx >= 0) {
      expect(primaryIdx).toBeLessThan(secondaryIdx);
    }
    if (secondaryIdx >= 0 && contractsIdx >= 0) {
      expect(secondaryIdx).toBeLessThan(contractsIdx);
    }
  });
});
