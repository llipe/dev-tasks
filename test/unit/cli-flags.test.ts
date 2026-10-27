/**
 * Layer 2: every command refuses an unknown flag and a value flag with no
 * value with exit 2 before doing anything (S-013 task 3.16, the regression
 * the qa-engineer gate found on PR #328). Each case runs the real binary in
 * an empty temporary directory and asserts it is still empty afterwards, so
 * a command that ran anyway (an install, a legacy migration) is caught.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const TSX_CLI = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const BIN = resolve(ROOT, "bin/dev-tasks.ts");

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "dev-tasks-flags-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function run(args: string[]) {
  const r = spawnSync(process.execPath, [TSX_CLI, BIN, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, TSX_TSCONFIG_PATH: resolve(ROOT, "tsconfig.json") },
  });
  return { stdout: r.stdout, stderr: r.stderr, exitCode: r.status ?? -1 };
}

describe("unknown and valueless flags exit 2 and change nothing", () => {
  it.each([
    [["--bogus", "install"], "--bogus"],
    [["install", "--bogus"], "--bogus"],
    [["install", "--profile", "--json"], "--profile"],
    [["install", "--profile="], "--profile"],
    [["update", "--pin", "--json"], "--pin"],
    [["update", "--bogus"], "--bogus"],
    [["status", "--bogus"], "--bogus"],
    [["pin", "-x"], "-x"],
    [["pin", "--bogus", "1.0.0"], "--bogus"],
    [["migrate", "docs", "--forse"], "--forse"],
    [["migrate", "--bogus"], "--bogus"],
  ])("%j", (args, flag) => {
    const r = run(args);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain(flag);
    expect(readdirSync(cwd)).toEqual([]);
  });

  it.each([[["migrate", "--plan"]], [["migrate", "--apply"]]])(
    "%j points to `migrate projects` and never runs the legacy migration",
    (args) => {
      const r = run(args);
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/dev-tasks migrate projects/);
      expect(r.stdout).not.toMatch(/migration/i);
      expect(readdirSync(cwd)).toEqual([]);
    },
  );

  it("a clean `pin` with no version still exits 2 with its usage", () => {
    const r = run(["pin"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/Usage: dev-tasks pin/);
  });
});
