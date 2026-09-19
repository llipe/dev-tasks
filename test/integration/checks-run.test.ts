/**
 * Integration tests for the docs-structure check as `lint` runs it
 * (S-004 AC-7, AC-10).
 *
 * These drive `tsx core/checks/run.ts` as a process, with its working
 * directory set to a seeded tree — which is exactly how the `lint`
 * script invokes it. The unit tests cover the rules; what is proven
 * here is the part a unit test cannot: that the entry point exits
 * non-zero on a failure, zero once fixed, and that it runs at all
 * without a build step (D-48).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "../..");
const RUN = resolve(ROOT, "core/checks/run.ts");
const FIXTURES = resolve(ROOT, "test/fixtures/docs-structure");
// Absolute path: the check runs with its cwd set to the seeded tree, and
// `pnpm exec` would resolve tsx from there, where there is no project.
const TSX = resolve(ROOT, "node_modules/.bin/tsx");

function runCheck(cwd: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(TSX, [RUN], {
      cwd,
      encoding: "utf-8",
      timeout: 60_000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.status ?? 1 };
  }
}

describe("core/checks/run.ts as the lint step", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dt-checks-run-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function seed(fixture: string): void {
    cpSync(join(FIXTURES, fixture), tmpDir, { recursive: true });
  }

  it("exits 0 on a clean tree and prints nothing", () => {
    seed("clean");
    const result = runCheck(tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  it("exits 0 on a repository with no docs/ at all", () => {
    // Nothing to check is not a failure. A consumer who has not adopted
    // this structure must not be blocked by a gate about it.
    const result = runCheck(tmpDir);
    expect(result.exitCode).toBe(0);
  });

  it.each([
    ["index-lists-missing", "gone.md"],
    ["index-omits-file", "orphan.md"],
    ["runbook-bad-filename", "runbook-deploy.md"],
    ["runbook-bad-frontmatter", "owner"],
    ["runbook-missing-related", "scripts/thing.sh"],
    ["runbook-invalid-date", "last_verified"],
    ["related-escapes-repo", "outside the repository"],
  ])("exits non-zero on %s and names the problem", (fixture, expected) => {
    seed(fixture);
    const result = runCheck(tmpDir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(expected);
  });

  it("exits 0 once the seeded failure is fixed", () => {
    seed("index-lists-missing");
    expect(runCheck(tmpDir).exitCode).not.toBe(0);

    // Create the file the index promised. Nothing else changes.
    writeFileSync(join(tmpDir, "docs/gone.md"), "# Back\n", "utf-8");

    const fixed = runCheck(tmpDir);
    expect(fixed.exitCode).toBe(0);
    expect(fixed.stderr).toBe("");
  });

  it("reports staleness on stdout and still exits 0 (AC-6)", () => {
    seed("runbook-stale");
    const result = runCheck(tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stale");
    expect(result.stdout).toContain("2019-01-01");
  });

  it("does not flag the shipped runbook template a consumer just installed", () => {
    // `install` writes docs/runbooks/runbook-template.md. Its filename
    // has one segment and its frontmatter is placeholders, so a check
    // that treats it as a runbook fails every consumer's first lint.
    seed("clean");
    mkdirSync(join(tmpDir, "docs/runbooks"), { recursive: true });
    cpSync(
      resolve(ROOT, "templates/runbooks/runbook-template.md"),
      join(tmpDir, "docs/runbooks/runbook-template.md"),
    );

    const result = runCheck(tmpDir);
    expect(result.exitCode, result.stderr).toBe(0);
  });

  it("is chained after eslint in the lint script, not in place of it (AC-7)", () => {
    // `&&` is what keeps an ESLint failure fatal: the check never runs,
    // and lint still exits non-zero. Replacing it with `;` or `||` would
    // let a lint error through, which no unit test would notice.
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.lint).toBe("eslint . --max-warnings 0 && tsx core/checks/run.ts");
    expect(pkg.scripts.lint).not.toContain("dist/");
  });
});
