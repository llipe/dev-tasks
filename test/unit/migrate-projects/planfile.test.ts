/**
 * S-013 AC-5, AC-7: the plan file renders in the spec §5 shape and parses
 * back without loss (§16a A-51, A-77 to A-79, A-92). MU-24 to MU-30,
 * CT-24 to CT-30, RT-7.
 */
import { describe, it, expect } from "vitest";
import {
  computePlanDigest,
  emptyMigrationPlanBatches,
  formatWriteId,
  MigrationPlanParseError,
  parseMigrationPlan,
  planHasNonPendingRows,
  renderMigrationPlan,
  MIGRATION_PLAN_ACTIONS,
  type MigrationPlan,
  type MigrationPlanBatch,
} from "#core/migrate-projects/planfile.js";
import { prng, seedFromEnv } from "./helpers/prng.js";

function samplePlan(): MigrationPlan {
  const batches = emptyMigrationPlanBatches();
  const b = (key: string): MigrationPlanBatch => batches.find((x) => x.key === key)!;
  b("1").writes.push(
    { id: "W-001", action: "create-label", target: "label:level: story", detail: "color 0E8A16", dependsOn: [], state: "pending" },
    { id: "W-002", action: "edit-label", target: "label:type: other", detail: "description Retired (D-91): Anything else", dependsOn: [], state: "done" },
  );
  b("2").writes.push({ id: "W-003", action: "create-issue", target: "W-003", detail: "[PRD-alpha] Wave 3: Things | template wave", dependsOn: ["W-001"], state: "done(#77)" });
  b("3").writes.push({ id: "W-004", action: "link-sub-issue", target: "#12", detail: "parent W-003", dependsOn: ["W-003"], state: "skipped(depends on W-003)" });
  b("4").writes.push({ id: "W-005", action: "add-label", target: "#12", detail: "level: story", dependsOn: [], state: "failed(HTTP 422: Validation Failed)" });
  b("7").steps.push(
    { id: "W-006", step: "List pull-request items with the query below", state: "pending" },
    { id: "W-007", step: "Set the auto-add filter to `is:issue`", state: "done" },
  );
  return {
    repo: "acme/widgets",
    generated: "2026-10-24T12:00:00Z",
    snapshot: "0123456789abcdef".repeat(4),
    approved: false,
    extraHeaders: [],
    review: {
      unmapped: [{ issue: 16, title: "Story S-009: Orphan", why: "no `**Story:**` line, no `phase:` label", answer: "" }],
      needsType: [
        { issue: 12, title: "Story S-003: Gadget search", currentTypeLabels: ["type: bug", "type: enhancement"], suggested: "bug", answer: "" },
        { issue: 25, title: "perf: faster list", currentTypeLabels: [], suggested: null, answer: "" },
      ],
      needsBlockingLink: [{ issue: 20, title: "fix: crash", priority: "priority: critical", answer: "" }],
      stateFiles: [{ file: "workstream/planner-state-alpha-phase-2.md", note: "no `Wave issue:` line" }],
      roadmap: [{ row: "alpha 3", note: "Done row with an open story" }],
      information: [{ ref: "#13", note: "parent #24 is not a tracking issue", answer: "" }],
    },
    batches,
  };
}

describe("render (CT-24, CT-27; MU-24)", () => {
  const text = renderMigrationPlan(samplePlan());
  const lines = text.split("\n");

  it("starts with the header lines in order", () => {
    expect(lines.slice(0, 8)).toEqual([
      "# Migration plan: acme/widgets",
      "",
      "Format: 1",
      "Generated: 2026-10-24T12:00:00Z",
      `Snapshot: ${"0123456789abcdef".repeat(4)}`,
      `Plan digest: ${computePlanDigest(samplePlan().batches)}`,
      "Approved: no",
      "",
    ]);
  });

  it("puts every review table before the batches, in the A-77 order", () => {
    const headings = lines.filter((l) => /^##+ /.test(l));
    expect(headings).toEqual([
      "## Needs your answer",
      "### Unmapped issues (FR-18)",
      "### Needs a type (D-85)",
      "### Needs a blocking link (D-84)",
      "### State files (D-89)",
      "### Roadmap notes (D-86)",
      "### Information",
      "## Batches",
      "### 1. Labels (cli)",
      "### 2. Tracking issues (cli)",
      "### 3. Hierarchy (cli)",
      "### 4. Story and type labels (cli)",
      "### 4b. Blocking links and priorities (cli)",
      "### 5. Retired labels (cli)",
      "### 6. Status comments (cli)",
      "### 7. Project cleanup (you run these)",
    ]);
  });

  it("uses the CT-26 and CT-27 table headers", () => {
    expect(text).toContain('| Issue | Title | Why | Answer (wave id, or "standalone") |');
    expect(text).toContain("| Issue | Title | Current type labels | Suggested | Answer |");
    expect(text).toContain('| Issue | Title | Priority | Answer (#issue it blocks, or "lower priority to high") |');
    expect(text).toContain("| ID | Action | Target | Detail | Depends on | State |");
    expect(text).toContain("| ID | Step | State |");
  });

  it("escapes `|` in cells so the table keeps its columns (CT-30)", () => {
    expect(text).toContain("| W-003 | create-issue | W-003 | [PRD-alpha] Wave 3: Things \\| template wave | W-001 | done(#77) |");
  });

  it("renders empty tables as header and separator only", () => {
    const empty = renderMigrationPlan({ ...samplePlan(), review: { unmapped: [], needsType: [], needsBlockingLink: [], stateFiles: [], roadmap: [], information: [] }, batches: emptyMigrationPlanBatches() });
    expect(parseMigrationPlan(empty).plan.batches.every((b) => b.writes.length === 0 && b.steps.length === 0)).toBe(true);
  });
});

describe("parse (MU-25 to MU-30)", () => {
  // MU-25
  it("parse(render(p)) deep-equals p, and render is a fixed point", () => {
    const p = samplePlan();
    const text = renderMigrationPlan(p);
    const parsed = parseMigrationPlan(text);
    expect(parsed.plan).toEqual(p);
    expect(parsed.planDigest).toBe(computePlanDigest(p.batches));
    expect(renderMigrationPlan(parsed.plan)).toBe(text);
  });

  // MU-26
  it("answers typed into the review tables survive; whitespace-only is empty", () => {
    const text = renderMigrationPlan(samplePlan())
      .replace("| #16 | Story S-009: Orphan | no `**Story:**` line, no `phase:` label |  |", "|#16|Story S-009: Orphan|no `**Story:**` line, no `phase:` label|  alpha 2  |")
      .replace("| #12 | Story S-003: Gadget search | `type: bug`, `type: enhancement` | bug |  |", "| #12 | Story S-003: Gadget search | `type: bug`, `type: enhancement` | bug | type: bug |")
      .replace("| #20 | fix: crash | priority: critical |  |", "| #20 | fix: crash | priority: critical | #2 |")
      .replace("| #25 | perf: faster list |  | — |  |", "| #25 | perf: faster list |  | — |    |");
    const { review } = parseMigrationPlan(text).plan;
    expect(review.unmapped[0].answer).toBe("alpha 2");
    expect(review.needsType[0].answer).toBe("type: bug");
    expect(review.needsType[1].answer).toBe("");
    expect(review.needsBlockingLink[0].answer).toBe("#2");
  });

  // MU-27, CT-30, EC-111
  it("pipes, backticks, backslashes, newlines and non-ASCII round-trip byte for byte", () => {
    const p = samplePlan();
    const nasty = " a|b `c` \\| d\\n <!-- e --> 🚀 漢字\nnext\r\tline ";
    p.review.unmapped[0].title = nasty;
    p.review.needsType[0].currentTypeLabels = ["type: a,b", "x|y", " sp "];
    p.batches[0].writes[0].detail = nasty;
    const back = parseMigrationPlan(renderMigrationPlan(p)).plan;
    expect(back.review.unmapped[0].title).toBe(nasty);
    expect(back.review.needsType[0].currentTypeLabels).toEqual(["type: a,b", "x|y", " sp "]);
    expect(back.batches[0].writes[0].detail).toBe(nasty);
  });

  // MU-28, CT-24
  it.each([
    ["# Migration plan:", /# Migration plan/],
    ["Snapshot:", /Snapshot/],
    ["Approved:", /Approved/],
    ["Format:", /Format/],
  ])("a missing `%s` line is a typed parse error naming it", (prefix, name) => {
    const text = renderMigrationPlan(samplePlan())
      .split("\n")
      .filter((l) => !l.startsWith(prefix))
      .join("\n");
    expect(() => parseMigrationPlan(text)).toThrow(MigrationPlanParseError);
    expect(() => parseMigrationPlan(text)).toThrow(name);
  });

  it("rejects an unknown major format and a malformed snapshot hash (CT-24, EC-156)", () => {
    const text = renderMigrationPlan(samplePlan());
    expect(() => parseMigrationPlan(text.replace("Format: 1", "Format: 2"))).toThrow(/Format/);
    expect(() => parseMigrationPlan(text.replace(/Snapshot: [0-9a-f]+/, "Snapshot: abc"))).toThrow(/Snapshot/);
  });

  // MU-29
  it("tolerates and preserves an extra header line and an extra column", () => {
    const text = renderMigrationPlan(samplePlan())
      .replace("Approved: no\n", "Approved: no\nReviewer: @owner\n")
      .replace("| Issue | Title | Priority | Answer (#issue it blocks, or \"lower priority to high\") |", "| Issue | Title | Priority | Answer (#issue it blocks, or \"lower priority to high\") | Notes |")
      .replace(/(\| -+ \| -+ \| -+ \| -+ \|)\n(\| #20 .*\|)\n/, "$1 --- |\n$2 owner asked |\n");
    const { plan } = parseMigrationPlan(text);
    expect(plan.extraHeaders).toEqual(["Reviewer: @owner"]);
    expect(plan.review.needsBlockingLink[0].extra).toEqual({ Notes: "owner asked" });
    const again = renderMigrationPlan(plan);
    expect(again).toContain("Reviewer: @owner");
    expect(again).toContain("| Notes |");
    expect(parseMigrationPlan(again).plan).toEqual(plan);
  });

  // MU-30, CT-28
  it.each(["pending", "done", "done(#12)", "failed(HTTP 422)", "skipped(already applied)", "skipped(depends on W-001)"])(
    "state %s parses",
    (state) => {
      const p = samplePlan();
      p.batches[0].writes[0].state = state;
      expect(parseMigrationPlan(renderMigrationPlan(p)).plan.batches[0].writes[0].state).toBe(state);
    },
  );

  it.each(["done?", "failed", "failed()", "skip", "Pending", ""])("state %j is a parse error", (state) => {
    const text = renderMigrationPlan(samplePlan()).replace("| color 0E8A16 |  | pending |", `| color 0E8A16 |  | ${state} |`);
    expect(() => parseMigrationPlan(text)).toThrow(MigrationPlanParseError);
  });

  it("a batch 7 step is pending or done only (A-79)", () => {
    const text = renderMigrationPlan(samplePlan()).replace("| W-006 | List pull-request items with the query below | pending |", "| W-006 | List pull-request items with the query below | failed(x) |");
    expect(() => parseMigrationPlan(text)).toThrow(/W-006/);
  });

  // CT-27, A-51: the action set is closed.
  it("refuses an unknown action, a duplicate ID and a dangling dependency", () => {
    const text = renderMigrationPlan(samplePlan());
    expect(() => parseMigrationPlan(text.replace("| W-005 | add-label |", "| W-005 | project-item-delete |"))).toThrow(/action/);
    expect(() => parseMigrationPlan(text.replace("| W-005 | add-label |", "| W-001 | add-label |"))).toThrow(/duplicate/);
    expect(() => parseMigrationPlan(text.replace("| parent W-003 | W-003 |", "| parent W-003 | W-099 |"))).toThrow(/W-099/);
    expect(() => parseMigrationPlan(text.replace("| W-005 | add-label |", "| W5 | add-label |"))).toThrow(/ID/);
    expect(MIGRATION_PLAN_ACTIONS).toContain("link-sub-issue");
    expect(MIGRATION_PLAN_ACTIONS.some((a) => a.includes("project"))).toBe(false);
  });

  it("refuses an unknown section heading", () => {
    const text = renderMigrationPlan(samplePlan()).replace("### 3. Hierarchy (cli)", "### 3. Hierarchy (user)");
    expect(() => parseMigrationPlan(text)).toThrow(MigrationPlanParseError);
  });
});

describe("approval grammar (CT-25, A-79)", () => {
  const base = renderMigrationPlan(samplePlan());
  it("exactly `Approved: yes` approves", () => {
    expect(parseMigrationPlan(base.replace("Approved: no", "Approved: yes")).plan.approved).toBe(true);
    expect(parseMigrationPlan(base).plan.approved).toBe(false);
  });
  it.each(["Approved: Yes", "Approved: yes ", "Approved: yes\nApproved: yes", "Approved: YES"])("%j does not", (line) => {
    expect(parseMigrationPlan(base.replace("Approved: no", line)).plan.approved).toBe(false);
  });
  it("`approved: yes` (lower case) is not the approval line, so it is missing", () => {
    expect(() => parseMigrationPlan(base.replace("Approved: no", "approved: yes"))).toThrow(/Approved/);
  });
});

describe("digest and IDs (A-51, A-78)", () => {
  it("the digest covers ID, Action, Target and Detail only", () => {
    const p = samplePlan();
    const d = computePlanDigest(p.batches);
    expect(d).toMatch(/^[0-9a-f]{64}$/);
    const states = samplePlan();
    states.batches[0].writes[0].state = "done";
    expect(computePlanDigest(states.batches)).toBe(d);
    const detail = samplePlan();
    detail.batches[0].writes[0].detail += "x";
    expect(computePlanDigest(detail.batches)).not.toBe(d);
  });

  it("the parsed digest is the file's line, so a hand edit is detectable", () => {
    const text = renderMigrationPlan(samplePlan()).replace("| color 0E8A16 |", "| color FFFFFF |");
    const parsed = parseMigrationPlan(text);
    expect(parsed.planDigest).not.toBe(computePlanDigest(parsed.plan.batches));
  });

  it("IDs are W-NNN, widening past 999", () => {
    expect(formatWriteId(1, 5)).toBe("W-001");
    expect(formatWriteId(42, 999)).toBe("W-042");
    expect(formatWriteId(7, 1200)).toBe("W-0007");
  });
});

describe("planHasNonPendingRows (A-65)", () => {
  it("is false for an all-pending plan and true once a row moved", () => {
    const p = samplePlan();
    expect(planHasNonPendingRows(p)).toBe(true);
    for (const b of p.batches) {
      for (const w of b.writes) w.state = "pending";
      for (const s of b.steps) s.state = "pending";
    }
    expect(planHasNonPendingRows(p)).toBe(false);
    p.batches.at(-1)!.steps[0].state = "done";
    expect(planHasNonPendingRows(p)).toBe(true);
  });
});

// RT-7: random plans round-trip, seeded.
describe("RT-7 planfile round-trip property", () => {
  const seed = seedFromEnv(7007);
  it(`random plans (seed ${seed})`, () => {
    const r = prng(seed);
    const pool = ["a", "Z", "|", "`", "\\", "*", "#", "<!--", "🚀", "漢", " ", ",", "\n", "\r", "\t", "—", "-", ":", "n"];
    const str = (max: number) => Array.from({ length: r.int(0, max) }, () => r.pick(pool)).join("");
    const states = ["pending", "done", "done(#3)", "failed(boom)", "skipped(already applied)"];
    for (let iter = 0; iter < 300; iter++) {
      const batches = emptyMigrationPlanBatches();
      let n = 0;
      const total = r.int(0, 40);
      for (let k = 0; k < total; k++) {
        n++;
        const id = formatWriteId(n, total);
        const batch = r.pick(batches);
        if (batch.runner === "user") batch.steps.push({ id, step: str(12) || "x", state: r.pick(["pending", "done"]) });
        else batch.writes.push({ id, action: r.pick(MIGRATION_PLAN_ACTIONS), target: str(8), detail: str(20), dependsOn: [], state: r.pick(states) });
      }
      const issues = Array.from({ length: r.int(0, 60) }, (_, k) => k + 1);
      const p: MigrationPlan = {
        repo: "o/r",
        generated: "2026-10-24T12:00:00Z",
        snapshot: "f".repeat(64),
        approved: r.bool(),
        extraHeaders: [],
        review: {
          unmapped: issues.filter(() => r.bool(0.2)).map((i) => ({ issue: i, title: str(15), why: str(10), answer: r.bool() ? "" : str(5).trim() })),
          needsType: issues.filter(() => r.bool(0.2)).map((i) => ({ issue: i, title: str(15), currentTypeLabels: Array.from({ length: r.int(0, 3) }, () => str(6)), suggested: r.bool() ? null : "bug", answer: "" })),
          needsBlockingLink: issues.filter(() => r.bool(0.1)).map((i) => ({ issue: i, title: str(15), priority: "priority: critical", answer: "" })),
          stateFiles: [],
          roadmap: [],
          information: issues.filter(() => r.bool(0.1)).map((i) => ({ ref: `#${i}`, note: str(10) || "n", answer: "" })),
        },
        batches,
      };
      const text = renderMigrationPlan(p);
      const ctx = `seed ${seed} iter ${iter}`;
      // Answers are trimmed by design (whitespace-only means empty), so compare against the trimmed form.
      for (const list of [p.review.unmapped, p.review.needsType, p.review.needsBlockingLink, p.review.information]) {
        for (const row of list) row.answer = row.answer.replace(/^[\s]+|[\s]+$/g, "");
      }
      expect(parseMigrationPlan(text).plan, ctx).toEqual(p);
      expect(renderMigrationPlan(parseMigrationPlan(text).plan), ctx).toBe(text);
    }
  });
});
