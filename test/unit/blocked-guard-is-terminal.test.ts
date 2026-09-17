/**
 * Deterministic checks for the "a blocked guard is terminal" contract
 * (issue #179, task 11.0).
 *
 * The Task 9.0 defect was an agent routing around a block instead of
 * stopping. This file cannot execute a live `/planner` run against a
 * deliberately blocked merge (that requires a real agent session), but it
 * mechanically verifies the textual contract every consumer of this rule
 * depends on is actually present where it needs to be:
 *
 *  - CLAUDE.md and AGENTS.md both state the "blocked guard is a decision,
 *    not an obstacle" rule in General Agent Guidelines.
 *  - `.claude/commands/planner.md` has an Error Handling row for a merge
 *    command blocked by git-guard that requires: verbatim report, marking
 *    the story blocked, writing the checkpoint, asking the user, and never
 *    attempting an alternative merge path.
 *  - `.claude/agents/developer.md` (reused unchanged by
 *    `.claude/commands/developer.md`) carries the equivalent rule for the
 *    commit and PR paths.
 *
 * The AC "a /planner run against a deliberately blocked merge stops and
 * reports, leaving the integration branch untouched" is additionally
 * verified manually (see the story's closeout payload for the exact steps);
 * this file is the automated half of that AC.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("blocked guard is terminal, not a routing problem (issue #179)", () => {
  it("CLAUDE.md General Agent Guidelines states the rule", () => {
    const content = read("CLAUDE.md");
    expect(content).toMatch(/blocked guard is a decision, not an obstacle/i);
    expect(content).toMatch(
      /must not\*\* attempt an alternative command, tool surface, or sequence/i,
    );
  });

  it("AGENTS.md General Agent Guidelines mirrors the rule", () => {
    const content = read("AGENTS.md");
    expect(content).toMatch(/blocked guard as a decision, not an obstacle/i);
    expect(content).toMatch(
      /must not\*\* attempt an alternative command, tool surface, or sequence/i,
    );
  });

  it(".claude/commands/planner.md has an Error Handling row for a merge command blocked by git-guard", () => {
    const content = read(".claude/commands/planner.md");
    const row = content
      .split("\n")
      .find((line) => /merge command blocked by git-guard/i.test(line));
    expect(
      row,
      "planner.md missing the 'merge command blocked by git-guard' Error Handling row",
    ).toBeTruthy();
    const line = row as string;
    expect(line).toMatch(/verbatim/i);
    expect(line).toMatch(/blocked/i);
    expect(line).toMatch(/checkpoint/i);
    expect(line).toMatch(/ask the user/i);
    expect(line).toMatch(/never attempt an alternative/i);
  });

  it(".claude/agents/developer.md carries the equivalent rule for commit and PR paths", () => {
    const content = read(".claude/agents/developer.md");
    expect(content).toMatch(/blocked guard is terminal, not a routing problem/i);
    expect(content).toMatch(/git commit.*git push.*gh pr create.*gh pr merge/i);
    expect(content).toMatch(
      /must not\*\* attempt an alternative command, tool surface, or sequence/i,
    );
  });

  it(".claude/commands/developer.md reuses the developer agent contract unchanged (no divergent policy)", () => {
    const content = read(".claude/commands/developer.md");
    expect(content).toMatch(/developer.*agent contract/i);
    expect(content).toMatch(/\.claude\/agents\/developer\.md/);
  });
});
