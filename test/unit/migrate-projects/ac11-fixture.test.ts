/**
 * S-014 AC-7; PRD AC-11, in one test (MU-59, E2E-17, RV-3).
 *
 * The expected plan below was written by hand from FR-19, spec §8.3 and
 * §16a and `test/fixtures/migrate-projects/ac11/`, before `map.ts` and
 * `plan.ts` existed. It is never regenerated from the code under test: when
 * the fixture changes, this table changes by hand.
 */
import { describe, it, expect } from "vitest";
import { loadModel } from "./helpers/fake-github.js";
import { isWrite } from "./helpers/is-write.js";
import { planModel } from "./helpers/plan-run.js";

type Row = [id: string, action: string, target: string, detail: string, dependsOn: string[]];

const EXPECTED: Record<string, Row[]> = {
  "1": [
    ["W-001", "create-label", "label:level: prd", "color: 3F51B5; description: PRD tracking issue; a container for waves, not work", []],
    ["W-002", "create-label", "label:level: wave", "color: 5C6BC0; description: Wave tracking issue; a container for stories, not work", []],
    ["W-003", "create-label", "label:level: story", "color: 7986CB; description: Story issue; the unit of work", []],
    ["W-004", "create-label", "label:type: security", "color: B60205; description: Security vulnerability, hardening, or compliance work", []],
    ["W-005", "create-label", "label:type: refactor", "color: D4C5F9; description: Code restructure, no behavior change", []],
    ["W-006", "create-label", "label:type: test", "color: BFDADC; description: Test-only work", []],
    ["W-007", "create-label", "label:type: tech-debt", "color: 5319E7; description: Deferred engineering work that fits no other type", []],
    ["W-008", "edit-label", "label:type: bug", "description: Behavior that differs from the spec or intent", []],
    ["W-009", "edit-label", "label:type: docs", "description: Documentation changes", []],
    ["W-010", "edit-label", "label:type: chore", "description: Maintenance, dependencies, tooling, or CI", []],
    ["W-011", "edit-label", "label:priority: high", "description: Lands in the current wave or cycle; blocks no ship", []],
    ["W-012", "edit-label", "label:needs: decision", "description: Retired (D-91): Waiting on a decision", []],
    ["W-013", "edit-label", "label:status: ready", "description: Retired (D-91): Ready to start", []],
    ["W-014", "edit-label", "label:type: other", "description: Retired (D-91): Anything else", []],
    ["W-015", "edit-label", "label:type: prd", "description: Retired (D-91): PRD tracking issue", []],
    ["W-016", "edit-label", "label:wave: 2", "description: Retired (D-91): Wave 2", []],
  ],
  // Wave 1 is `Done`: no wave issue (FR-19). #1 is reused (D-87).
  "2": [
    ["W-017", "create-issue", "new issue", "template: wave; label: level: wave; title: [PRD-alpha] Wave 2: Gizmo search and export", ["W-002"]],
  ],
  "3": [
    ["W-018", "link-sub-issue", "#1", "sub-issue W-017", ["W-017"]],
    ["W-019", "link-sub-issue", "W-017", "sub-issue #10", ["W-017"]],
    ["W-020", "link-sub-issue", "W-017", "sub-issue #11", ["W-017"]],
    ["W-021", "link-sub-issue", "W-017", "sub-issue #12", ["W-017"]],
    ["W-022", "link-sub-issue", "W-017", "sub-issue #13", ["W-017"]],
  ],
  "4": [
    ["W-023", "add-label", "#1", "level: prd", ["W-001"]],
    ["W-024", "remove-label", "#1", "type: prd", []],
    ["W-025", "add-label", "#10", "level: story", ["W-003"]],
    ["W-026", "add-label", "#11", "level: story", ["W-003"]],
    ["W-027", "add-label", "#12", "level: story", ["W-003"]],
    ["W-028", "add-label", "#13", "level: story", ["W-003"]],
  ],
  "4b": [],
  "5": [
    ["W-029", "remove-label", "#12", "wave: 2", []],
    ["W-030", "remove-label", "#13", "status: ready", []],
    ["W-031", "remove-label", "#21", "needs: decision", []],
  ],
  "6": [
    ["W-032", "status-comment", "#1", "create: 1 = shipped, —; 2 = in progress, W-017", ["W-017"]],
  ],
};

describe("the AC-11 fixture (S-014 AC-7, PRD AC-11, MU-59)", () => {
  it("yields exactly the expected batches and lists, with zero writes and no body", async () => {
    const run = await planModel(loadModel("ac11"));

    // Zero writes from --plan (D-90), by the independent oracle.
    for (const c of run.calls) expect(isWrite(c), c.join(" ")).toBe(false);

    // Batches 1 to 6, row for row.
    for (const [key, rows] of Object.entries(EXPECTED)) {
      expect(
        run.batch(key).writes.map((w): Row => [w.id, w.action, w.target, w.detail, w.dependsOn]),
        `batch ${key}`,
      ).toEqual(rows);
      expect(run.batch(key).writes.every((w) => w.state === "pending")).toBe(true);
    }

    // Batch 7: the four user steps, after the last CLI row.
    expect(run.batch("7").steps.map((s) => s.id)).toEqual(["W-033", "W-034", "W-035", "W-036"]);

    // The review lists.
    expect(run.plan.review).toEqual({
      unmapped: [
        {
          issue: 14,
          title: "Story S-008: Gizmo import",
          why: "no `**Story:**` line; no `phase:` label; milestone `Alpha 2` is not a mapping rule (D-98)",
          answer: "",
        },
        {
          issue: 15,
          title: "Story S-009: Gizmo sync",
          why: "no `**Story:**` line; no `phase:` label",
          answer: "",
        },
      ],
      needsType: [
        { issue: 21, title: "fix: handle an empty config file", currentTypeLabels: [], suggested: "bug", answer: "" },
        {
          issue: 22,
          title: "[chore] Tidy the release scripts",
          currentTypeLabels: ["type: chore", "type: docs"],
          suggested: "docs",
          answer: "",
        },
      ],
      needsBlockingLink: [],
      stateFiles: [],
      roadmap: [],
      information: [],
    });

    // No title change, nothing for the standalone bug (#20), no body.
    const all = run.plan.batches.flatMap((b) => b.writes);
    expect(all.some((w) => w.target === "#20" || w.detail.includes("#20"))).toBe(false);
    expect(all.filter((w) => w.action === "create-issue").every((w) => w.target === "new issue")).toBe(true);
    expect(run.text).not.toMatch(/BODY-SENTINEL|zebra-quartz/);
    expect(run.text).toContain("Approved: no");
  });
});
