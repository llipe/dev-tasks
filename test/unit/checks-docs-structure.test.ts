/**
 * Unit tests for the docs-structure check (S-004; PRD AC-24, AC-32).
 *
 * One fixture tree per condition under `test/fixtures/docs-structure/`,
 * each as small as the condition allows so a failure names one thing.
 *
 * The two rules that need care are the ones AC-10 calls out, because a
 * naive version of either produces false failures on this repository's
 * own clean tree:
 *
 *   - Rule 1 (index lists a missing file) must resolve relative to the
 *     index's own directory and accept a link to a directory, or
 *     `docs/README.md`'s links to `../README.md` and `requirements/`
 *     fail on a tree with nothing wrong with it.
 *   - Rule 2 (index omits an existing file) must be non-recursive, or
 *     the seven ADRs and four PRDs that no index lists individually are
 *     all flagged.
 *
 * A check that cries wolf on a clean tree gets disabled within a week,
 * so both are asserted directly rather than left to the real tree.
 */
import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  cpSync,
  rmSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkDocsStructure } from "../../core/checks/docs-structure.js";

const FIXTURES = join(import.meta.dirname, "../fixtures/docs-structure");
const REPO_ROOT = join(import.meta.dirname, "../..");

function fixture(name: string): string {
  return join(FIXTURES, name);
}

function rules(findings: Array<{ rule: string }>): string[] {
  return [...new Set(findings.map((f) => f.rule))].sort();
}

describe("checkDocsStructure", () => {
  describe("a clean tree", () => {
    it("reports no failures", () => {
      const result = checkDocsStructure(fixture("clean"));
      expect(result.failures, JSON.stringify(result.failures, null, 2)).toEqual([]);
    });

    it("is deterministic — the same tree gives the same result", () => {
      // AC-1's checkable property. "Pure" is the wrong word for a
      // function whose job is reading files; repeatability is not.
      const a = checkDocsStructure(fixture("clean"));
      const b = checkDocsStructure(fixture("clean"));
      expect(a).toEqual(b);
    });

    it("writes nothing", () => {
      const tmp = mkdtempSync(join(tmpdir(), "dt-docs-structure-"));
      try {
        cpSync(fixture("clean"), tmp, { recursive: true });
        const before = snapshot(tmp);
        checkDocsStructure(tmp);
        expect(snapshot(tmp)).toEqual(before);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe("index rules", () => {
    it("fails when an index lists a file that does not exist (AC-2)", () => {
      const result = checkDocsStructure(fixture("index-lists-missing"));
      expect(rules(result.failures)).toContain("index-lists-missing");
      expect(result.failures.some((f) => f.message.includes("gone.md"))).toBe(true);
    });

    it("fails when an index omits a file that does exist (AC-3)", () => {
      const result = checkDocsStructure(fixture("index-omits-file"));
      expect(rules(result.failures)).toContain("index-omits-file");
      expect(result.failures.some((f) => f.message.includes("orphan.md"))).toBe(true);
    });

    it("accepts a directory link and a repo-root-relative link (AC-10)", () => {
      // The false-failure case: docs/README.md links ../README.md and
      // requirements/. Neither is a broken link.
      const result = checkDocsStructure(fixture("index-links-directory"));
      expect(result.failures, JSON.stringify(result.failures, null, 2)).toEqual([]);
    });

    it("does not recurse into subdirectories for the omission rule (AC-10)", () => {
      // index-links-directory holds docs/requirements/prd-a.md, which no
      // index lists individually. A recursive rule would flag it.
      const result = checkDocsStructure(fixture("index-links-directory"));
      expect(result.failures.some((f) => f.message.includes("prd-a.md"))).toBe(false);
    });
  });

  describe("runbook rules", () => {
    it("fails on a filename that does not match the pattern (AC-4)", () => {
      const result = checkDocsStructure(fixture("runbook-bad-filename"));
      expect(rules(result.failures)).toContain("runbook-filename");
      expect(result.failures.some((f) => f.message.includes("runbook-deploy.md"))).toBe(true);
    });

    it("fails on missing frontmatter keys (AC-4)", () => {
      const result = checkDocsStructure(fixture("runbook-bad-frontmatter"));
      expect(rules(result.failures)).toContain("runbook-frontmatter");
      expect(result.failures.some((f) => f.message.includes("owner"))).toBe(true);
    });

    it("fails on a last_verified that is not a date (AC-4)", () => {
      const result = checkDocsStructure(fixture("runbook-invalid-date"));
      expect(rules(result.failures)).toContain("runbook-frontmatter");
      expect(result.failures.some((f) => f.message.includes("last_verified"))).toBe(true);
    });

    it("fails on a related entry naming a file that does not exist (AC-5)", () => {
      const result = checkDocsStructure(fixture("runbook-missing-related"));
      expect(rules(result.failures)).toContain("runbook-related");
      expect(result.failures.some((f) => f.message.includes("scripts/thing.sh"))).toBe(true);
    });

    it("fails on a related entry that escapes the repository root (AC-5)", () => {
      const result = checkDocsStructure(fixture("related-escapes-repo"));
      expect(rules(result.failures)).toContain("runbook-related");
      expect(result.failures.some((f) => /outside/i.test(f.message))).toBe(true);
    });
  });

  describe("staleness (AC-6, D-21)", () => {
    it("reports a last_verified older than 90 days without failing", () => {
      const result = checkDocsStructure(fixture("runbook-stale"));
      expect(result.staleness).toHaveLength(1);
      expect(result.staleness[0].message).toContain("2019-01-01");
      expect(result.failures).toEqual([]);
    });

    it("does not report a recently verified runbook", () => {
      // Stamped at test time rather than checked in: a fixture date is
      // fresh today and stale in three months, which would turn this
      // into a test that fails on a calendar boundary.
      const tmp = mkdtempSync(join(tmpdir(), "dt-docs-structure-fresh-"));
      try {
        cpSync(fixture("runbook-stale"), tmp, { recursive: true });
        const path = join(tmp, "docs/runbooks/runbook-deploy-thing.md");
        const today = new Date().toISOString().slice(0, 10);
        writeFileSync(
          path,
          readFileSync(path, "utf-8").replace(
            "last_verified: 2019-01-01",
            `last_verified: ${today}`,
          ),
          "utf-8",
        );

        const result = checkDocsStructure(tmp);
        expect(result.staleness).toEqual([]);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe("repositories without runbooks (AC-9)", () => {
    it("reports nothing for an absent docs/runbooks/", () => {
      const result = checkDocsStructure(fixture("no-runbooks-dir"));
      expect(result.failures).toEqual([]);
      expect(result.staleness).toEqual([]);
    });

    it("reports nothing for a runbooks directory holding only its index", () => {
      const result = checkDocsStructure(fixture("empty-runbooks-dir"));
      expect(result.failures).toEqual([]);
      expect(result.staleness).toEqual([]);
    });
  });

  describe("this repository", () => {
    it("passes its own check (AC-10)", () => {
      // The check ships enabled under `lint`. If it cannot pass the tree
      // it was written against, it is not a gate — it is a broken build.
      const result = checkDocsStructure(REPO_ROOT);
      expect(
        result.failures,
        `docs-structure failures on the real tree:\n${result.failures
          .map((f) => `  [${f.rule}] ${f.message}`)
          .join("\n")}`,
      ).toEqual([]);
    });
  });
});

/** Relative path -> content, for proving the check mutates nothing. */
function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) walk(full, rel);
      else out[rel] = readFileSync(full, "utf-8");
    }
  };
  walk(root, "");
  return out;
}
