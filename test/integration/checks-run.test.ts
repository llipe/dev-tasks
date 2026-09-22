/**
 * Integration tests for the docs-structure check as `lint` runs it
 * (S-004 AC-7, AC-10), and for the glossary check at the same entry
 * point (S-002 AC-1/AC-2/AC-4, IT-8, D-48, D-66, D-75).
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

/**
 * The glossary check through the same process boundary (S-002, IT-8).
 *
 * `checks-glossary.test.ts` proves the rules. What only a process run
 * proves is the wiring D-66 depends on: a structural failure reaches
 * stderr and exits 1, the same tree exits 0 once the term is repaired,
 * an absent package map prints one `stale:` line on stdout and still
 * exits 0, and a repository with no glossary at all says nothing
 * (D-75 — absence is `doctor`'s warning). A unit test asserting that
 * `run.ts` contains the string `checkGlossary` cannot tell any of these
 * apart from a check whose findings are never concatenated.
 */
describe("core/checks/run.ts — glossary check (S-002 AC-1/AC-2/AC-4, IT-8)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dt-checks-glossary-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const TECH_WITH_MAP = [
    "# Technical Guidelines",
    "",
    "## Package Map",
    "",
    "| Package | Path | Purpose | Owner | Canonical scripts | Bounded context |",
    "| ------- | ---- | ------- | ----- | ----------------- | ---------------- |",
    "| `@acme/thing` | `.` | harness | platform | `lint` | Widget management |",
    "",
  ].join("\n");

  const FRONTMATTER = [
    "---",
    "version: 1.0",
    "name: Ubiquitous Language",
    "description: Canonical domain vocabulary, organized by bounded context.",
    "status: active",
    "owner: product-engineer",
    "---",
    "",
  ].join("\n");

  /** A glossary whose one term is complete unless a bullet is dropped. */
  function glossary(options: { omit?: string } = {}): string {
    const bullets = [
      "- Definition: A thing that widgets are managed as.",
      "- Forbidden synonyms: none",
      "- Invariants: none",
      "- Origin: docs/requirements/prd-widgets.md",
      "- Status: active",
    ].filter((b) => options.omit === undefined || !b.startsWith(`- ${options.omit}:`));

    return [
      FRONTMATTER,
      "# Ubiquitous Language",
      "",
      "Prose the template puts between the title and the changelog, so a",
      "parser that assumes the changelog comes first is caught here.",
      "",
      "## Changelog",
      "",
      "| Version | Date | Summary | Author |",
      "| ------- | ---- | ------- | ------ |",
      "| 1.0 | 2026-09-22 | +widget | product-engineer |",
      "",
      "## Bounded Context: Widget management",
      "",
      "### widget",
      "",
      ...bullets,
      "",
    ].join("\n");
  }

  function writeGlossary(content: string): void {
    mkdirSync(join(tmpDir, "docs/domain"), { recursive: true });
    writeFileSync(join(tmpDir, "docs/domain/ubiquitous-language.md"), content, "utf-8");
  }

  it("exits 1 on a term missing a required field, and 0 once it is restored", () => {
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "docs/tech.md"), TECH_WITH_MAP, "utf-8");
    writeGlossary(glossary({ omit: "Invariants" }));

    const broken = runCheck(tmpDir);
    expect(broken.exitCode).toBe(1);
    expect(broken.stderr).toContain("[glossary-field-missing]");
    expect(broken.stderr).toContain("docs/domain/ubiquitous-language.md");
    expect(broken.stderr).toContain("Invariants");

    writeGlossary(glossary());
    const fixed = runCheck(tmpDir);
    expect(fixed.exitCode, fixed.stderr).toBe(0);
    expect(fixed.stderr).toBe("");
  });

  it("exits 1 on a bounded context that resolves to nothing in the package map", () => {
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "docs/tech.md"), TECH_WITH_MAP, "utf-8");
    writeGlossary(
      glossary().replace("## Bounded Context: Widget management", "## Bounded Context: Billing"),
    );

    const result = runCheck(tmpDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[glossary-context-unresolved]");
    expect(result.stderr).toContain("Billing");
  });

  it("prints one stale line on stdout and exits 0 when docs/tech.md has no package map", () => {
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "docs/tech.md"), "# Technical Guidelines\n", "utf-8");
    writeGlossary(glossary());

    const result = runCheck(tmpDir);
    expect(result.exitCode, result.stderr).toBe(0);
    const stale = result.stdout
      .split("\n")
      .filter((l) => l.includes("glossary-package-map-absent"));
    expect(stale).toHaveLength(1);
    expect(stale[0]).toContain("stale:");
    expect(stale[0]).toContain("activity-init");
  });

  it("says nothing at all about a repository that has no glossary yet (D-75)", () => {
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "docs/tech.md"), TECH_WITH_MAP, "utf-8");

    const result = runCheck(tmpDir);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("glossary");
    expect(result.stderr).toBe("");
  });
});
