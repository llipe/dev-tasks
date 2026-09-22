/**
 * Parity checks for the `verifier`'s vocabulary conformance call
 * (S-005 AC-4, PT-4; FR-23, AC-15, D-60, D-63, D-64).
 *
 * Three trees carry the same agent. A rule stated in `.claude` and
 * missing from `.kiro` is a consumer on that platform whose audits
 * silently never run the scan, and nothing else in the suite would
 * notice.
 *
 * Every assertion here is **scoped to the block it is about** — the
 * Actions row, or the Vocabulary conformance bullet in the report
 * structure — and never to the whole file. A whole-file `includes` for
 * "advisory" passes against these files for reasons that have nothing
 * to do with this story: the runbook-coverage section says "advisory"
 * too, and so does the drift catalog. A marker that is already true
 * before the change proves nothing after it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const VERIFIER = [
  ".claude/agents/verifier.md",
  ".github/agents/verifier.agent.md",
  ".kiro/agents/verifier.md",
];

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

/** The lines of one `### ` section, up to the next heading. */
function section(content: string, heading: string): string[] {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`### ${heading}`));
  expect(start, `expected a '${heading}' section`).toBeGreaterThan(-1);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,3} /.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The `| **Actions** | … |` row of the Phase 3 table, and only that one.
 *
 * Five phases each carry an Actions row, and Phase 3 carries two — one
 * per mode. Four of the six have nothing to do with this story, and
 * Design Mode's is the one a careless scope would match first.
 */
function actionsRow(content: string): string {
  const phase3 = section(
    content,
    "Phase 3 — Test Design (Design Mode) / Evidence Collection (Audit Mode)",
  );
  const auditMode = phase3.findIndex((line) => line.trim().startsWith("**Audit Mode:**"));
  expect(auditMode, "expected an Audit Mode block in Phase 3").toBeGreaterThan(-1);
  const rows = phase3.slice(auditMode).filter((line) => line.includes("| **Actions**"));
  expect(rows, "expected exactly one Audit Mode Actions row").toHaveLength(1);
  return rows[0];
}

/** The `- **Vocabulary conformance** — …` bullet, and nothing after it. */
function vocabularyBullet(content: string): string {
  const lines = section(content, "Fidelity Report (Audit Mode)");
  const start = lines.findIndex((line) => line.trim().startsWith("- **Vocabulary conformance**"));
  expect(start, "expected a Vocabulary conformance bullet").toBeGreaterThan(-1);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim().startsWith("- ") || line.trim().length === 0);
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join("\n");
}

describe("S-005 AC-4 — the Audit Mode Actions row calls the scan", () => {
  for (const relPath of VERIFIER) {
    it(`${relPath} names the function, its two arguments, and where the lines come from`, () => {
      const row = actionsRow(read(relPath));
      expect(row).toContain("checkExportedIdentifiers(addedLines, glossaryMarkdown)");
      expect(row).toContain("core/checks");
      // Without this, "the added lines" is a phrase and not an
      // instruction: the auditor has to guess a base and a direction.
      expect(row).toContain("git diff <base>...HEAD");
      expect(row).toContain("docs/domain/ubiquitous-language.md");
    });

    it(`${relPath} states in the same row that hits are advisory and never block`, () => {
      // Scoped deliberately: "advisory" appears elsewhere in this file
      // for unrelated findings, so a whole-file match would survive
      // deleting this clause entirely.
      const row = actionsRow(read(relPath));
      expect(row).toMatch(/\*{0,2}advisory\*{0,2}/i);
      expect(row).toMatch(/\*{0,2}never block\*{0,2} PR readiness/i);
      expect(row).toContain("D-63");
    });

    it(`${relPath} keeps the scan beside the docs-structure call, not in place of it`, () => {
      const row = actionsRow(read(relPath));
      expect(row).toContain("checkDocsStructure(repoRoot)");
      expect(row.indexOf("checkDocsStructure")).toBeLessThan(
        row.indexOf("checkExportedIdentifiers"),
      );
    });
  }
});

describe("S-005 AC-4 — the report structure carries the finding class", () => {
  for (const relPath of VERIFIER) {
    it(`${relPath} describes what each hit names`, () => {
      const bullet = vocabularyBullet(read(relPath));
      expect(bullet).toContain("checkExportedIdentifiers");
      expect(bullet).toMatch(/forbidden synonym/i);
      expect(bullet).toMatch(/term that forbids it/i);
    });

    it(`${relPath} makes the finding class advisory inside that bullet`, () => {
      const bullet = vocabularyBullet(read(relPath));
      expect(bullet).toMatch(/\*{0,2}advisory\*{0,2} finding class/i);
      expect(bullet).toMatch(/\*{0,2}never block\*{0,2} PR readiness on one/i);
      expect(bullet).toContain("D-63");
    });

    it(`${relPath} warns that a regex produces false positives (D-60)`, () => {
      // An auditor who believes the scan is exact will file a rename
      // request they cannot justify, and the next one will ignore the
      // whole class.
      const bullet = vocabularyBullet(read(relPath));
      expect(bullet).toMatch(/false positive/i);
      expect(bullet).toContain("D-60");
    });

    it(`${relPath} says a canonical-term match is not a finding (D-64)`, () => {
      const bullet = vocabularyBullet(read(relPath));
      expect(bullet).toMatch(/canonical term/i);
      expect(bullet).toContain("D-64");
    });

    it(`${relPath} says an empty or absent glossary needs no note`, () => {
      expect(vocabularyBullet(read(relPath))).toMatch(/no findings and needs no note/i);
    });
  }
});

describe("S-005 AC-4 — the three trees say the same thing", () => {
  it("the Actions row's conformance clause is identical across trees", () => {
    // The clause, not the row: each tree's row may differ ahead of it,
    // and comparing whole rows would fail on an unrelated edit.
    const clauses = VERIFIER.map((p) => {
      const row = actionsRow(read(p));
      return row.slice(row.indexOf("Run the vocabulary conformance scan"));
    });
    expect(new Set(clauses).size, `divergent clauses: ${JSON.stringify(clauses, null, 2)}`).toBe(1);
  });

  it("the Vocabulary conformance bullet is identical across trees", () => {
    const bullets = VERIFIER.map((p) => vocabularyBullet(read(p)).trim());
    expect(new Set(bullets).size, "one tree's bullet has drifted from the others").toBe(1);
  });
});
