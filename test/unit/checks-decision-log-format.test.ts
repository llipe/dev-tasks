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
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { checkDecisionLogContent } from "../../core/checks/decision-log-format.js";

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

  it("passes the real, large, known-good workstream/decisions-shared-understanding.md fixture", () => {
    const content = readFileSync(
      join(REPO_ROOT, "workstream/decisions-shared-understanding.md"),
      "utf-8",
    );
    const result = checkDecisionLogContent(content, "workstream/decisions-shared-understanding.md");
    expect(result.failures, JSON.stringify(result.failures, null, 2)).toEqual([]);
  });
});
