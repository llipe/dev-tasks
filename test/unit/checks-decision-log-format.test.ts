/**
 * Unit tests for the decision-log format check (S-007; specification
 * §14 "Format").
 *
 * The check validates any `workstream/decisions-*.md` file against
 * three rules pulled straight from the format itself (specification §5,
 * unchanged by this feature): `ID` is unique within the file, `Phase`
 * is `WHAT` or `HOW`, and any `Supersedes` value resolves to an
 * existing `ID` in the same file.
 *
 * Per the story's Business Rules, uniqueness and `Phase` are hard
 * failures; a dangling `Supersedes` is reported the same way
 * docs-structure reports staleness (D-21's precedent) — printed, not
 * failed — so a work-in-progress log mid-session is never blocked.
 *
 * Fixtures are inlined as strings rather than fixture-directory trees
 * (unlike docs-structure): the whole input is one Markdown file's
 * content, small enough that a directory tree buys nothing.
 */
import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkDecisionLogContent,
  checkDecisionLogFormat,
} from "../../core/checks/decision-log-format.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

const HEADER =
  "| ID   | Phase | Branch | Question | Recommended | Answer | Accepted rec. | Supersedes | Author | Date       |\n" +
  "| ---- | ----- | ------ | -------- | ----------- | ------ | -------------- | ---------- | ------ | ---------- |\n";

function row(id: string, phase: string, supersedes = "—"): string {
  return `| ${id} | ${phase} | b | q | r | a | yes | ${supersedes} | @llipe | 2026-09-20 |\n`;
}

describe("checkDecisionLogContent", () => {
  it("passes a clean fixture with no rows at all", () => {
    const content = "# Decisions: x\n\nNo tables yet.\n";
    const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
    expect(result.failures).toEqual([]);
    expect(result.staleness).toEqual([]);
  });

  it("passes a clean fixture with unique IDs, valid Phase, and resolvable Supersedes", () => {
    const content =
      "## WHAT phase\n\n" +
      HEADER +
      row("D-01", "WHAT") +
      row("D-02", "WHAT", "D-01") +
      "\n## HOW phase\n\n" +
      HEADER +
      row("D-03", "HOW");
    const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
    expect(result.failures).toEqual([]);
    expect(result.staleness).toEqual([]);
  });

  it("fails on a duplicate ID within the file", () => {
    const content =
      "## WHAT phase\n\n" +
      HEADER +
      row("D-01", "WHAT") +
      "\n## HOW phase\n\n" +
      HEADER +
      row("D-01", "HOW");
    const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
    expect(
      result.failures.some((f) => f.rule === "duplicate-id" && f.message.includes("D-01")),
    ).toBe(true);
  });

  it("fails on an invalid Phase value", () => {
    const content = "## WHAT phase\n\n" + HEADER + row("D-01", "WHY");
    const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
    expect(
      result.failures.some((f) => f.rule === "invalid-phase" && f.message.includes("D-01")),
    ).toBe(true);
  });

  it("reports (does not fail) a dangling Supersedes reference", () => {
    const content = "## WHAT phase\n\n" + HEADER + row("D-01", "WHAT", "D-99");
    const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
    expect(result.failures).toEqual([]);
    expect(
      result.staleness.some((f) => f.rule === "dangling-supersedes" && f.message.includes("D-99")),
    ).toBe(true);
  });

  it("treats a Supersedes value pointing at a different file's ID as dangling (intra-file only)", () => {
    // The column resolves within this file only — a value that happens to
    // look like a valid ID from another feature's log is still dangling here.
    const content = "## WHAT phase\n\n" + HEADER + row("D-01", "WHAT", "other-feature#D-05");
    const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
    expect(result.failures).toEqual([]);
    expect(result.staleness.some((f) => f.rule === "dangling-supersedes")).toBe(true);
  });

  it("treats an em-dash Supersedes value as 'no supersedes', not a dangling reference", () => {
    const content = "## WHAT phase\n\n" + HEADER + row("D-01", "WHAT", "—");
    const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
    expect(result.failures).toEqual([]);
    expect(result.staleness).toEqual([]);
  });

  describe("cell-count validation (#245)", () => {
    // `splitRow` splits on every `|`, escaped or not. An escaped pipe
    // (`\\|`) inside any cell adds a cell and slides every later column
    // one position right. Before this rule, only the three positional
    // reads (ID, Phase, Supersedes) could notice — a shift landing after
    // `Supersedes` (Author, Date) was completely silent. Each column gets
    // its own injection so none of them can regress back to silence.
    const COLUMNS = [
      "ID",
      "Phase",
      "Branch",
      "Question",
      "Recommended",
      "Answer",
      "Accepted rec.",
      "Supersedes",
      "Author",
      "Date",
    ];
    const CLEAN = ["D-01", "WHAT", "b", "q", "r", "a", "yes", "—", "@llipe", "2026-09-20"];

    function rowWithEscapedPipeIn(column: number): string {
      const cells = [...CLEAN];
      cells[column] = `${cells[column]} \\| injected`;
      return `| ${cells.join(" | ")} |\n`;
    }

    it.each(COLUMNS.map((name, index) => [name, index] as const))(
      "fails a row with an escaped pipe in the %s column, naming the cell counts",
      (_name, index) => {
        const content = "## WHAT phase\n\n" + HEADER + rowWithEscapedPipeIn(index);
        const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
        const mismatch = result.failures.filter((f) => f.rule === "cell-count-mismatch");
        expect(mismatch, JSON.stringify(result, null, 2)).toHaveLength(1);
        expect(mismatch[0].message).toContain("11 cells");
        expect(mismatch[0].message).toContain("10");
        // The row is skipped, not read positionally: no shifted-column
        // finding may ride along with the mismatch.
        expect(result.failures.filter((f) => f.rule !== "cell-count-mismatch")).toEqual([]);
        expect(result.staleness).toEqual([]);
      },
    );

    it("fails a row with too few cells", () => {
      const content =
        "## WHAT phase\n\n" + HEADER + "| D-01 | WHAT | b | q | r | a | yes | — | @llipe |\n";
      const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
      expect(
        result.failures.some(
          (f) => f.rule === "cell-count-mismatch" && f.message.includes("9 cells"),
        ),
      ).toBe(true);
    });

    it("still checks the well-formed rows around a malformed one", () => {
      const content =
        "## WHAT phase\n\n" +
        HEADER +
        row("D-01", "WHAT") +
        rowWithEscapedPipeIn(8) +
        row("D-02", "WHY");
      const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
      const rules = result.failures.map((f) => f.rule).sort();
      expect(rules).toEqual(["cell-count-mismatch", "invalid-phase"]);
    });

    it("reports the real D-60 row shape (6 escaped pipes, 16 cells) instead of mis-parsing it", () => {
      // The row as it stood before changelog 1.14 of
      // workstream/decisions-shared-understanding.md reworded it. Parsed
      // positionally it put `function\` in the Supersedes column and
      // printed a `dangling-supersedes` line on every `lint` run.
      const d60 =
        "| D-60 | HOW   | phase-3/fr-23-extraction | FR-23 needs new exported identifiers from a diff. " +
        "TypeScript compiler API, or a regex over `export` declarations? | — | " +
        "Resolved from D-49's reasoning: regex over added lines matching " +
        "`export (const\\|let\\|function\\|class\\|type\\|interface\\|enum) <Identifier>` " +
        "(and `export { … }` lists). | n/a | — | product-engineer | 2026-09-21 |\n";
      const content = "## HOW phase\n\n" + HEADER + d60;
      const result = checkDecisionLogContent(content, "workstream/decisions-x.md");
      expect(result.staleness, "must not mis-parse into dangling-supersedes").toEqual([]);
      const mismatch = result.failures.filter((f) => f.rule === "cell-count-mismatch");
      expect(mismatch).toHaveLength(1);
      expect(mismatch[0].message).toContain("D-60");
      expect(mismatch[0].message).toContain("16 cells");
      expect(mismatch[0].message).toContain("10");
    });
  });

  it("imports no Markdown or other parser — it ships inside dist/core without devDependencies", () => {
    const source = readFileSync(join(REPO_ROOT, "core/checks/decision-log-format.ts"), "utf-8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const specifier of imports) {
      const allowed =
        specifier.startsWith("node:") || specifier.startsWith("./") || specifier.startsWith("../");
      expect(allowed, `unexpected import '${specifier}'`).toBe(true);
    }
    expect(source).not.toMatch(/from\s+"(yaml|js-yaml|marked|remark|markdown-it|typescript)"/);
  });

  it("passes the real, large, known-good workstream/decisions-shared-understanding.md fixture", () => {
    const content = readFileSync(
      join(REPO_ROOT, "workstream/decisions-shared-understanding.md"),
      "utf-8",
    );
    const result = checkDecisionLogContent(content, "workstream/decisions-shared-understanding.md");
    expect(result.failures, JSON.stringify(result.failures, null, 2)).toEqual([]);
    // Staleness too, and not as an afterthought: this assertion used to
    // stop at `failures`, and a `dangling-supersedes` on D-60 printed on
    // every `lint` run for three merges with the suite fully green. The
    // cause was a Markdown escape — `\|` inside the Decision cell — which
    // splits the row into eighteen cells and slides a regex fragment into
    // the Supersedes column. A row that needs an escaped pipe should say
    // the same thing in words instead.
    expect(result.staleness, JSON.stringify(result.staleness, null, 2)).toEqual([]);
  });
});

describe("checkDecisionLogFormat (repository walk)", () => {
  // `checkDecisionLogFormat` is what `core/checks/run.ts` calls: it
  // discovers `workstream/decisions-*.md` files (via the private
  // `decisionLogFiles`) and runs the content check on each. These cases
  // pin the discovery and the wiring, not the row rules themselves.
  function tempRepo(): string {
    return mkdtempSync(join(tmpdir(), "decision-log-format-"));
  }

  function withRepo(fn: (root: string) => void): void {
    const root = tempRepo();
    try {
      fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("reports a cell-count-mismatch failure for a mismatched row in workstream/decisions-x.md", () => {
    withRepo((root) => {
      mkdirSync(join(root, "workstream"));
      const mismatched =
        "| D-01 | WHAT | b | q | r \\| injected | a | yes | — | @llipe | 2026-09-20 |\n";
      writeFileSync(
        join(root, "workstream", "decisions-x.md"),
        "## WHAT phase\n\n" + HEADER + mismatched,
      );

      const result = checkDecisionLogFormat(root);
      expect(result.failures.map((f) => f.rule)).toContain("cell-count-mismatch");
      expect(result.failures.every((f) => f.path === "workstream/decisions-x.md")).toBe(true);
    });
  });

  it("reports nothing for a well-formed workstream/decisions-x.md", () => {
    withRepo((root) => {
      mkdirSync(join(root, "workstream"));
      writeFileSync(
        join(root, "workstream", "decisions-x.md"),
        "## WHAT phase\n\n" + HEADER + row("D-01", "WHAT"),
      );

      const result = checkDecisionLogFormat(root);
      expect(result.failures).toEqual([]);
      expect(result.staleness).toEqual([]);
    });
  });

  it("ignores files in workstream/ that are not decisions-*.md", () => {
    withRepo((root) => {
      mkdirSync(join(root, "workstream"));
      writeFileSync(
        join(root, "workstream", "tasks-x.md"),
        "## WHAT phase\n\n" + HEADER + row("D-01", "NOT-A-PHASE"),
      );

      const result = checkDecisionLogFormat(root);
      expect(result.failures).toEqual([]);
    });
  });

  it("reports nothing and does not throw when there is no workstream/ directory", () => {
    withRepo((root) => {
      expect(() => checkDecisionLogFormat(root)).not.toThrow();
      const result = checkDecisionLogFormat(root);
      expect(result.failures).toEqual([]);
      expect(result.staleness).toEqual([]);
    });
  });
});
