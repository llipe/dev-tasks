/**
 * Pins for the wave 2 rollup follow-ups to the planner prompt (#305, #307,
 * #310, #311; decisions D-71 to D-74 in workstream/decisions-projects-tracking.md).
 * Each assertion holds in all three planner copies, and each pinned line is
 * byte-identical across them. Like the rest of the parity suite, these prove
 * that a sentence is present, not that an agent follows it (TESTING.md, Known
 * limitations).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const PLANNER = [
  ".claude/commands/planner.md",
  ".github/agents/planner.agent.md",
  ".kiro/agents/planner.md",
] as const;

const read = (f: string): string => readFileSync(resolve(ROOT, f), "utf-8");

/** The one line of `text` holding `marker`; fails on zero or several. */
function lineWith(text: string, marker: string, where: string): string {
  const lines = text.split("\n").filter((l) => l.includes(marker));
  expect(lines, `${where}: expected one line with ${marker}`).toHaveLength(1);
  return lines[0]!;
}

/** The `## <heading>` or `### <heading>` section, up to the next heading of the same or a higher level. */
function section(text: string, heading: string, where: string): string {
  const at = text.search(
    new RegExp(`^#{2,3} ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"),
  );
  expect(at, `${where}: no section ${heading}`).toBeGreaterThanOrEqual(0);
  const level = text.slice(at).match(/^#+/)![0].length;
  const bodyAt = text.indexOf("\n", at) + 1;
  const next = text.slice(bodyAt).search(new RegExp(`^#{2,${level}} `, "m"));
  return next < 0 ? text.slice(at) : text.slice(at, bodyAt + next);
}

/** Assert the same pinned line in every copy, and that the copies agree. */
function pinned(get: (body: string, f: string) => string, markers: string[]): void {
  const seen = PLANNER.map((f) => {
    const line = get(read(f), f);
    for (const m of markers) expect(line, `${f}: lacks ${m}`).toContain(m);
    return line;
  });
  expect(new Set(seen).size, "line differs across planner copies").toBe(1);
}

describe("D-71 (#310): the developer-closeout wave edit is made and checked before the merge", () => {
  it("event 4 is never folded into the merge edit", () => {
    pinned(
      (b, f) => lineWith(section(b, "Wave Status Comment", f), "4. **Developer closeout**", f),
      [
        "before any merge gate runs",
        "`PR open`",
        "never folded into the merge edit",
        "merge gate 10",
        "D-71",
      ],
    );
  });

  it("merge gate 10 re-reads the comment and holds the merge until it reads PR open", () => {
    pinned(
      (b, f) =>
        lineWith(
          section(b, "Merge management rule (planner-owned)", f),
          "10. **Review the PR**",
          f,
        ),
      [
        "re-read the wave status comment by its marker",
        "`PR open`",
        "make the closeout edit now",
        "Merge only once",
        "`failed(<reason>)`",
        "`skipped(no wave issue)`",
        "Decisions Log",
        "D-71",
      ],
    );
  });

  it("the never-blocks rule names gate 10 as its one exception", () => {
    pinned(
      (b, f) => lineWith(section(b, "Wave Status Comment", f), "never blocks a merge gate", f),
      ["with one exception: merge gate 10 holds the merge", "satisfies it (D-71)"],
    );
  });
});

describe("D-72 (#305, RD-8): Done needs every story issue closed, as verifier trigger 1 does", () => {
  it("Phase 6 step 7 names the open-issue case and the verifier rule", () => {
    pinned(
      (b, f) => lineWith(section(b, "Phase 6 - Close-out", f), "7. **Roadmap row.**", f),
      [
        "every story issue from step 3 reads closed",
        "completeness rule of the verifier's Roadmap-Mismatch trigger 1",
        "`#N open (missed Closes keyword)`",
        "`product-engineer` sets the row to `Done` during drift reconciliation",
        "D-72",
      ],
    );
  });

  it("the verifier's trigger 1 still requires every sub-issue closed", () => {
    for (const f of [
      ".claude/agents/verifier.md",
      ".github/agents/verifier.agent.md",
      ".kiro/agents/verifier.md",
    ]) {
      expect(read(f), f).toContain("every sub-issue's `state` reads `closed`");
    }
  });

  it("workflow-chains states the same condition", () => {
    const chains = read("docs/workflow-chains.md");
    expect(chains).toContain(
      "and every story issue and the wave issue, when there is one, read closed",
    );
  });
});

describe("D-73 (#308, RD-12): a pre-hierarchy wave keeps its PRD row", () => {
  it("the PRD status comment keeps the row with a dash for the wave issue", () => {
    pinned(
      (b, f) => lineWith(section(b, "PRD Status Comment", f), "edits only this run's wave row", f),
      ["predates the tracking-issue hierarchy keeps its row", "`—`", "D-73"],
    );
  });
});

describe("D-74 (#311): a follow-up issue the run resolves closes through the consolidated PR", () => {
  it("the Closes lines include named follow-ups, and Phase 6 confirms them closed", () => {
    pinned(
      (b, f) =>
        lineWith(section(b, "Phase 5 - Consolidated Pull Request", f), "**Closes lines.**", f),
      [
        "A follow-up issue that the task plan names as resolved by this run gets `Closes #N`",
        "GitHub closes it at the merge",
        "D-74",
      ],
    );
    pinned(
      (b, f) =>
        lineWith(section(b, "Phase 6 - Close-out", f), "3. **Confirm the issues closed.**", f),
      ["every follow-up issue the consolidated PR carried under `Closes`"],
    );
  });
});

describe("#307: planner robustness edges (RD-7, RD-9, RD-11, RD-13)", () => {
  it("sub-issue reads paginate and fallback lists carry a limit", () => {
    for (const f of PLANNER) {
      const body = read(f);
      expect(body, f).not.toContain("`gh api repos/{o}/{r}/issues/{wave}/sub_issues");
      expect(
        body.split("gh api --paginate repos/{o}/{r}/issues/{wave}/sub_issues").length - 1,
        f,
      ).toBe(2);
      expect(body, f).not.toMatch(
        /gh (issue|pr) list --(search|base) [^`]*--state (all|merged) --json/,
      );
    }
  });

  it("the rollup verifier receives the wave issue (RD-9)", () => {
    pinned(
      (b, f) =>
        lineWith(section(b, "Phase 5 - Consolidated Pull Request", f), "3. Invoke `verifier`", f),
      ["Pass Run Info's `Wave issue: #N` line (or `Wave issue: none`) in the handoff"],
    );
  });

  it("the fidelity line defaults to pending, added when absent (RD-11)", () => {
    pinned(
      (b, f) =>
        lineWith(
          section(b, "Phase 5 - Consolidated Pull Request", f),
          "**Fidelity report line.**",
          f,
        ),
      [
        "the line's value stays `pending`",
        "a body without the line gets it added after `Task plan:`",
      ],
    );
  });

  // Step 13's opening differs by tree (D-60), so this pin checks the clause, not byte identity.
  it("the checkpoint commit is skipped when nothing changed (RD-13)", () => {
    for (const f of PLANNER) {
      const step = lineWith(
        section(read(f), "Merge management rule (planner-owned)", f),
        "13. **",
        f,
      );
      for (const m of ["`git diff --cached --quiet`", "`checkpoint: unchanged`"])
        expect(step, `${f}: step 13 lacks ${m}`).toContain(m);
    }
  });

  it("an integration branch already gone counts as deleted (RD-7)", () => {
    pinned(
      (b, f) =>
        lineWith(
          section(b, "Phase 6 - Close-out", f),
          "12. **Delete the integration branch, last.**",
          f,
        ),
      ["already gone, locally or on the remote", "counts as deleted"],
    );
  });
});

describe("#308 (RD-6): the Project read names its scope without asking for it", () => {
  it("Phase 5 and Phase 6 record a missing read:project scope and never request it", () => {
    for (const [sec, marker] of [
      ["Phase 5 - Consolidated Pull Request", "**Project Status observation (read only).**"],
      ["Phase 6 - Close-out", "5. **Read the Project Status (read only).**"],
    ] as const) {
      pinned(
        (b, f) => lineWith(section(b, sec, f), marker, f),
        ["`not observed(missing read:project scope)`", "never asks for more access"],
      );
    }
    pinned(
      (b, f) =>
        lineWith(
          section(b, "Phase 5 - Consolidated Pull Request", f),
          "**Project Status observation (read only).**",
          f,
        ),
      ["`read:project` scope", "RD-6"],
    );
  });
});
