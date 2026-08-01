/**
 * Integration tests for `dt validate-component <path>`.
 * Runs the actual bin/dt.ts binary as a subprocess (no network access
 * required) against golden valid/invalid fixtures.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");
const DT_BIN = resolve(ROOT, "bin/dt.ts");
const FIXTURES_DIR = join(ROOT, "test/fixtures/schemas");

function runDt(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(TSX, [DT_BIN, ...args], {
      cwd: ROOT,
      encoding: "utf-8",
      env: { ...process.env, NODE_ENV: "test" },
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("dt validate-component — valid fixture", () => {
  it("exits 0 on a valid component.json (human output)", () => {
    const result = runDt(["validate-component", join(FIXTURES_DIR, "valid/component.json")]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/valid/i);
  });

  it("exits 0 on a valid component.json (--json output)", () => {
    const result = runDt([
      "validate-component",
      join(FIXTURES_DIR, "valid/component.json"),
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toEqual([]);
  });
});

describe("dt validate-component — invalid fixture", () => {
  it("exits 4 on an invalid component.json (human output) with error details", () => {
    const result = runDt([
      "validate-component",
      join(FIXTURES_DIR, "invalid/component-bad-id.json"),
    ]);
    expect(result.exitCode).toBe(4);
    expect(result.stderr).toMatch(/invalid/i);
    expect(result.stderr).toMatch(/\/id/);
  });

  it("exits 4 on an invalid component.json (--json output) with structured errors", () => {
    const result = runDt([
      "validate-component",
      join(FIXTURES_DIR, "invalid/component-bad-id.json"),
      "--json",
    ]);
    expect(result.exitCode).toBe(4);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.some((e: { path: string }) => e.path === "/id")).toBe(true);
  });

  it("exits 4 for a missing required manual field", () => {
    const result = runDt([
      "validate-component",
      join(FIXTURES_DIR, "invalid/component-missing-manual-field.json"),
      "--json",
    ]);
    expect(result.exitCode).toBe(4);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(false);
  });

  it("exits 4 for an unknown top-level key", () => {
    const result = runDt([
      "validate-component",
      join(FIXTURES_DIR, "invalid/component-unknown-key.json"),
      "--json",
    ]);
    expect(result.exitCode).toBe(4);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(false);
  });
});

describe("dt validate-component — usage errors", () => {
  it("exits 2 when no path is given", () => {
    const result = runDt(["validate-component"]);
    expect(result.exitCode).toBe(2);
  });

  it("exits 5 when the file does not exist", () => {
    const result = runDt(["validate-component", join(FIXTURES_DIR, "does-not-exist.json")]);
    expect(result.exitCode).toBe(5);
  });
});
