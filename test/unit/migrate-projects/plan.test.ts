/**
 * S-014 AC-3, AC-4, AC-5: the batches FR-19 and FR-20 permit, in spec
 * §8.3's order, as amended by §16a (A-66, A-67, A-71, A-73, A-81 to A-84;
 * D-87, D-91, D-92, D-97, D-103). MU-44 to MU-54, EC-125 to EC-133, RT-12
 * (the S-014 half: re-planning after the writes proposes none).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LEVEL_DEFINITIONS,
  PRIORITY_DEFINITIONS,
  RETIRED_DESCRIPTION_PREFIX,
  TYPE_COLORS,
  TYPE_DEFINITIONS,
  TYPE_SET,
} from "#core/migrate-projects/conventions.js";
import { MIGRATION_PLAN_ACTIONS, MIGRATION_PLAN_BATCHES } from "#core/migrate-projects/planfile.js";
import { projectCleanupSteps, retiredDescription } from "#core/migrate-projects/plan.js";
import { cloneModel, loadModel, type ModelIssue, type RepoModel } from "./helpers/fake-github.js";
import { applyPlanToModel } from "./helpers/model-apply.js";
import { planModel, triple } from "./helpers/plan-run.js";

const ROOT = resolve(import.meta.dirname, "../../..");

const ROADMAP =
  "# Roadmap\n\n| PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing |\n| --- | --- | --- | --- | --- | --- |\n" +
  "| [alpha](requirements/prd-alpha.md) | 1 | Alpha basics | Done | — | — |\n" +
  "| [alpha](requirements/prd-alpha.md) | 2 | Alpha search | In progress | — | — |\n" +
  "| [alpha](requirements/prd-alpha.md) | 3 | Alpha export | Not started | — | — |\n" +
  "| [beta](requirements/prd-beta.md) | 1 | Beta start | Not started | — | — |\n";

/** Every canonical label already present with its canonical description: batch 1 starts empty. */
function canonicalLabels(): RepoModel["labels"] {
  return [
    ...TYPE_SET.map((t) => ({
      name: `type: ${t}`,
      description: TYPE_DEFINITIONS[t],
      color: TYPE_COLORS[t],
    })),
    ...Object.entries(LEVEL_DEFINITIONS).map(([name, d]) => ({ name, ...d })),
    ...Object.entries(PRIORITY_DEFINITIONS).map(([name, d]) => ({ name, ...d })),
  ];
}

let nextId = 50000;
function issue(number: number, title: string, extra: Partial<ModelIssue> = {}): ModelIssue {
  return {
    id: nextId++,
    number,
    state: "open",
    title,
    body: `BODY-SENTINEL-${number}`,
    labels: [],
    milestone: null,
    parent: null,
    blocking: [],
    ...extra,
  };
}

function base(issues: ModelIssue[] = [], files: Record<string, string> = {}): RepoModel {
  return {
    repo: "acme/kit",
    labels: canonicalLabels(),
    issues,
    files: {
      "docs/roadmap.md": ROADMAP,
      "docs/requirements/prd-alpha.md": "# PRD: alpha — Alpha kit\n",
      "docs/requirements/prd-beta.md": "# PRD: beta — Beta kit\n",
      ...files,
    },
  };
}

const PRD_A = () => issue(1, "[PRD-alpha] Alpha kit", { labels: ["level: prd"] });
const WAVE_A2 = (parent: number | null = 1) =>
  issue(2, "[PRD-alpha] Wave 2: Alpha search", { labels: ["level: wave"], parent });
const STORY = (n: number, wave: string, extra: Partial<ModelIssue> = {}) =>
  issue(n, `[PRD-alpha] Story S-0${n}: s${n}`, {
    labels: ["type: enhancement", "level: story"],
    body: `**Story:** workstream/user-stories-alpha-phase-${wave}.md`,
    ...extra,
  });
const comment = (rows: string[]) => ({
  id: 7001,
  body: [
    "<!-- dev-tasks:status -->",
    "🔄 Update: x — Refs #1",
    "",
    "| Wave | State | Wave issue |",
    "| ---- | ----- | ---------- |",
    ...rows,
  ].join("\n"),
});

describe("batch order (MU-44)", () => {
  it("1, 2, 3, 4, 4b, 5, 6, 7 with the spec §8.3 names; only 7 is the user's", async () => {
    const run = await planModel(base());
    expect(run.plan.batches.map((b) => [b.key, b.name, b.runner])).toEqual(
      MIGRATION_PLAN_BATCHES.map((b) => [b.key, b.name, b.runner]),
    );
    expect(run.plan.batches.map((b) => b.key)).toEqual(["1", "2", "3", "4", "4b", "5", "6", "7"]);
    expect(run.plan.batches.filter((b) => b.runner === "user").map((b) => b.key)).toEqual(["7"]);
  });
});

describe("batch 1: labels (MU-45, A-71, A-82, D-103)", () => {
  it("creates every missing `level:` and type label, with the github-ops colour and description", async () => {
    const m = base();
    m.labels = m.labels.filter((l) => !["level: wave", "type: test", "type: refactor"].includes(l.name));
    const run = await planModel(m);
    expect(run.batch("1").writes.map(triple)).toEqual([
      [
        "create-label",
        "label:level: wave",
        `color: ${LEVEL_DEFINITIONS["level: wave"].color}; description: ${LEVEL_DEFINITIONS["level: wave"].description}`,
      ],
      ["create-label", "label:type: refactor", `color: ${TYPE_COLORS.refactor}; description: ${TYPE_DEFINITIONS.refactor}`],
      ["create-label", "label:type: test", `color: ${TYPE_COLORS.test}; description: ${TYPE_DEFINITIONS.test}`],
    ]);
  });

  it("sets an existing type label's description to its definition, and leaves a matching one alone", async () => {
    const m = base();
    m.labels.find((l) => l.name === "type: tech-debt")!.description = "Debt";
    const run = await planModel(m);
    expect(run.batch("1").writes.map(triple)).toEqual([
      ["edit-label", "label:type: tech-debt", `description: ${TYPE_DEFINITIONS["tech-debt"]}`],
    ]);
  });

  // D-103
  it("sets the four priority descriptions to the D-84 and D-102 meanings, under 100 characters", async () => {
    const m = base();
    for (const l of m.labels) if (l.name.startsWith("priority: ")) l.description = "old";
    const run = await planModel(m);
    expect(run.batch("1").writes.map(triple)).toEqual(
      ["critical", "high", "medium", "low"].map((p) => [
        "edit-label",
        `label:priority: ${p}`,
        `description: ${PRIORITY_DEFINITIONS[`priority: ${p}` as keyof typeof PRIORITY_DEFINITIONS].description}`,
      ]),
    );
    expect(PRIORITY_DEFINITIONS["priority: critical"].description).toMatch(/Blocks a wave, PRD, or release from shipping/);
    expect(PRIORITY_DEFINITIONS["priority: high"].description).toMatch(/current wave or cycle; blocks no ship/);
    expect(PRIORITY_DEFINITIONS["priority: medium"].description).toMatch(/next/);
    expect(PRIORITY_DEFINITIONS["priority: low"].description).toMatch(/Backlog/);
    for (const d of [
      ...Object.values(PRIORITY_DEFINITIONS),
      ...Object.values(LEVEL_DEFINITIONS),
    ]) {
      expect(d.description.length).toBeLessThanOrEqual(100);
    }
  });

  // EC-133, A-82
  it("marks each retired definition present, on an issue or not, with `Retired (D-91): `", async () => {
    const m = base();
    m.labels.push(
      { name: "type: other", description: "Anything else", color: "CCCCCC" },
      { name: "wave: 3", description: "Wave 3", color: "C5DEF5" },
      { name: "status: blocked", description: "Waiting", color: "E4E669" },
      { name: "needs: merge", description: `${RETIRED_DESCRIPTION_PREFIX}Waiting to merge`, color: "C5DEF5" },
    );
    const run = await planModel(m);
    expect(run.batch("1").writes.map(triple)).toEqual([
      ["edit-label", "label:type: other", "description: Retired (D-91): Anything else"],
      ["edit-label", "label:wave: 3", "description: Retired (D-91): Wave 3"],
    ]);
  });

  it("the retired prefix is never doubled and the result never exceeds 100 characters", () => {
    expect(RETIRED_DESCRIPTION_PREFIX).toBe("Retired (D-91): ");
    expect(retiredDescription("Anything else")).toBe("Retired (D-91): Anything else");
    expect(retiredDescription("Retired (D-91): Anything else")).toBeNull();
    expect(retiredDescription("Retired (projects-tracking#D-91): x")).toBeNull();
    const long = "x".repeat(97);
    const out = retiredDescription(long)!;
    expect(out).toHaveLength(100);
    expect(out.startsWith(RETIRED_DESCRIPTION_PREFIX)).toBe(true);
    expect(retiredDescription("")).toBe("Retired (D-91):");
  });
});

describe("batch 2: tracking issues (MU-46, FR-19, A-83, A-84)", () => {
  it("reuses an exact match and creates nothing when the wave and PRD issues exist", async () => {
    const run = await planModel(base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2 })]));
    expect(run.batch("2").writes).toEqual([]);
    expect(run.batch("3").writes).toEqual([]);
    expect(run.batch("4").writes).toEqual([]);
  });

  it("creates the PRD issue and the wave issue for a mapped open story, showing title and template", async () => {
    const run = await planModel(base([STORY(10, "2", { labels: ["type: enhancement"] })]));
    expect(run.batch("2").writes.map(triple)).toEqual([
      ["create-issue", "new issue", "template: prd; label: level: prd; title: [PRD-alpha] Alpha kit"],
      ["create-issue", "new issue", "template: wave; label: level: wave; title: [PRD-alpha] Wave 2: Alpha search"],
    ]);
  });

  it("no wave issue for a `Done` row: its open story goes on the Information table (A-83)", async () => {
    const run = await planModel(base([PRD_A(), STORY(10, "1")]));
    expect(run.batch("2").writes).toEqual([]);
    expect(run.batch("3").writes).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "#10", note: expect.stringMatching(/alpha 1 is `Done`/) }),
    );
  });

  // EC-125
  it("a wave with only closed stories and an active state file gets a wave issue", async () => {
    const closed = STORY(10, "3", { state: "closed" });
    const run = await planModel(
      base([PRD_A(), closed], {
        "workstream/planner-state-alpha-phase-3.md": "# Planner state\n\n- Wave issue: none\n",
      }),
    );
    expect(run.batch("2").writes.map((w) => w.detail)).toEqual([
      "template: wave; label: level: wave; title: [PRD-alpha] Wave 3: Alpha export",
    ]);
  });

  it("a wave with neither an open story nor a state file gets none", async () => {
    const run = await planModel(base([PRD_A()]));
    expect(run.batch("2").writes).toEqual([]);
  });

  // A-83: a PRD with no mapped story gets its issue only on a `yes`.
  it("asks before creating a PRD issue for a PRD with no mapped story", async () => {
    const run = await planModel(base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2 })]));
    expect(run.plan.review.information).toContainEqual({
      ref: "[PRD-beta]",
      note: "no mapped story and no open PRD tracking issue; answer `yes` to create its PRD tracking issue (A-83)",
      answer: "",
    });
    expect(run.batch("2").writes).toEqual([]);
  });

  it("a closed wave issue is never reused: the in-scope wave gets a new one (A-91)", async () => {
    const closedWave = issue(2, "[PRD-alpha] Wave 2: Alpha search", {
      labels: ["level: wave"],
      parent: 1,
      state: "closed",
    });
    const run = await planModel(base([PRD_A(), closedWave, STORY(10, "2", { labels: ["type: enhancement"] })]));
    expect(run.batch("2").writes.map((w) => w.detail)).toEqual([
      "template: wave; label: level: wave; title: [PRD-alpha] Wave 2: Alpha search",
    ]);
  });

  it("a long Scope cell is cut at a word boundary to keep the title within 80 characters", async () => {
    const m = base([PRD_A(), STORY(10, "2", { labels: ["type: enhancement"] })]);
    m.files["docs/roadmap.md"] = ROADMAP.replace(
      "Alpha search",
      "Search across every gizmo, gadget and widget the catalogue holds, with filters and saved queries",
    );
    const run = await planModel(m);
    const title = run.batch("2").writes[0].detail.split("; title: ")[1];
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toMatch(/^\[PRD-alpha\] Wave 2: Search across every gizmo, .*…$/);
  });
});

describe("batch 3: hierarchy (MU-47, EC-127, EC-128)", () => {
  it("links the wave under the PRD and the story under the wave, skipping links present", async () => {
    const run = await planModel(base([PRD_A(), WAVE_A2(null), STORY(10, "2"), STORY(11, "2", { parent: 2 })]));
    expect(run.batch("3").writes.map(triple)).toEqual([
      ["link-sub-issue", "#1", "sub-issue #2"],
      ["link-sub-issue", "#2", "sub-issue #10"],
    ]);
  });

  it("a story under the wrong wave is listed, never relinked", async () => {
    const wave3 = issue(3, "[PRD-alpha] Wave 3: Alpha export", { labels: ["level: wave"], parent: 1 });
    const run = await planModel(base([PRD_A(), WAVE_A2(), wave3, STORY(10, "2", { parent: 3 })]));
    expect(run.batch("3").writes).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({
        ref: "#10",
        note: "story maps to alpha 2 (#2) but its parent is #3; it is never relinked",
      }),
    );
  });

  it("a wave under a different PRD is listed, never relinked", async () => {
    const other = issue(9, "[PRD-beta] Beta kit", { labels: ["level: prd"] });
    const run = await planModel(base([PRD_A(), other, WAVE_A2(9), STORY(10, "2", { parent: 2 })]));
    expect(run.batch("3").writes).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "#2", note: expect.stringMatching(/parent is #9; it is never relinked/) }),
    );
  });

  it("links to issues the plan creates name their create row and depend on it (A-81)", async () => {
    const run = await planModel(base([STORY(10, "2", { labels: ["type: enhancement"] })]));
    const [prd, wave] = run.batch("2").writes;
    const links = run.batch("3").writes;
    expect(links.map(triple)).toEqual([
      ["link-sub-issue", prd.id, `sub-issue ${wave.id}`],
      ["link-sub-issue", wave.id, "sub-issue #10"],
    ]);
    expect(links[0].dependsOn).toEqual([prd.id, wave.id]);
    expect(links[1].dependsOn).toEqual([wave.id]);
  });
});

describe("batch 4: story and type labels (MU-48, MU-52, D-87, EC-130)", () => {
  it("`level: story` on mapped stories only; never on an unmapped story or a standalone issue", async () => {
    const run = await planModel(
      base([
        PRD_A(),
        WAVE_A2(),
        STORY(10, "2", { labels: ["type: enhancement"], parent: 2 }),
        issue(11, "Story S-011: unmapped", { labels: ["type: enhancement"] }),
        issue(12, "[bug] standalone", { labels: ["type: bug", "phase: 2"] }),
      ]),
    );
    expect(run.batch("4").writes.map(triple)).toEqual([["add-label", "#10", "level: story"]]);
  });

  it("a reused pre-level PRD issue gets `level: prd` and loses `type: prd` once, never retitled", async () => {
    const m = base([
      issue(1, "[PRD-alpha] Alpha kit", { labels: ["type: prd"] }),
      issue(2, "[PRD-alpha] Wave 2: Alpha search", { labels: ["type: wave", "level: wave"], parent: 1 }),
      STORY(10, "2", { parent: 2 }),
    ]);
    m.labels.push(
      { name: "type: prd", description: "Retired (D-91): PRD", color: "5319E7" },
      { name: "type: wave", description: "Retired (D-91): Wave", color: "5319E7" },
    );
    const run = await planModel(m);
    expect(run.batch("4").writes.map(triple)).toEqual([
      ["add-label", "#1", "level: prd"],
      ["remove-label", "#1", "type: prd"],
      ["remove-label", "#2", "type: wave"],
    ]);
    expect(run.batch("5").writes).toEqual([]);
    for (const w of run.writes()) expect(w.detail).not.toMatch(/^title:/);
  });

  it("no type rows without a confirmed answer", async () => {
    const run = await planModel(base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2, labels: ["level: story"] })]));
    expect(run.plan.review.needsType.map((n) => n.issue)).toEqual([10]);
    expect(run.batch("4").writes).toEqual([]);
  });

  it("`add-label` depends on the create of its label (A-81)", async () => {
    const m = base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2, labels: ["type: enhancement"] })]);
    m.labels = m.labels.filter((l) => l.name !== "level: story");
    const run = await planModel(m);
    const create = run.batch("1").writes[0];
    expect(triple(create)[1]).toBe("label:level: story");
    expect(run.batch("4").writes[0].dependsOn).toEqual([create.id]);
  });
});

describe("batch 5: retired labels (MU-49, D-91, EC-132)", () => {
  it("removes every retired label from open issues only, keeps the flags, deletes nothing", async () => {
    const m = base([
      issue(20, "[bug] a", {
        labels: ["type: bug", "status: ready", "status: blocked", "needs: approval", "wave: 2", "wave:3"],
      }),
      issue(21, "[bug] b", { labels: ["type: bug", "status: in-progress"], state: "closed" }),
      issue(22, "[bug] c", { labels: ["type: bug", "status: needs-refinement", "status: deferred"] }),
    ]);
    const run = await planModel(m);
    expect(run.batch("5").writes.map(triple)).toEqual([
      ["remove-label", "#20", "needs: approval"],
      ["remove-label", "#20", "status: ready"],
      ["remove-label", "#20", "wave: 2"],
      ["remove-label", "#20", "wave:3"],
    ]);
    expect(MIGRATION_PLAN_ACTIONS.some((a) => /delete/.test(a))).toBe(false);
  });
});

describe("batch 6: PRD status comments (MU-50, D-73, D-92, A-67)", () => {
  it("creates the comment when none carries the marker: one row per roadmap row, `—` without an issue", async () => {
    const run = await planModel(base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2 })]));
    expect(run.batch("6").writes.map(triple)).toEqual([
      ["status-comment", "#1", "create: 1 = shipped, —; 2 = in progress, #2; 3 = not started, —"],
    ]);
  });

  it("a closed wave issue keeps its number in the row (A-67)", async () => {
    const closed = issue(3, "[PRD-alpha] Wave 1: Alpha basics", { labels: ["level: wave"], parent: 1, state: "closed" });
    const run = await planModel(base([PRD_A(), WAVE_A2(), closed, STORY(10, "2", { parent: 2 })]));
    expect(run.batch("6").writes[0].detail).toBe(
      "create: 1 = shipped, #3; 2 = in progress, #2; 3 = not started, —",
    );
  });

  it("adds only the missing rows to an existing comment and never rewrites one", async () => {
    const m = base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2 })]);
    m.comments = { "1": [comment(["| 1 | shipped (PR #5, before tracking issues) | — |"])] };
    const run = await planModel(m);
    expect(run.batch("6").writes.map(triple)).toEqual([
      ["status-comment", "#1", "add: 2 = in progress, #2; 3 = not started, —"],
    ]);
  });

  it("proposes nothing when every roadmap row has a row (A-66)", async () => {
    const m = base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2 })]);
    m.comments = { "1": [comment(["| 1 | shipped | — |", "| 2 | published | #2 |", "| 3 | x | — |"])] };
    const run = await planModel(m);
    expect(run.batch("6").writes).toEqual([]);
  });

  it("a created wave issue appears by its create row, which the comment depends on", async () => {
    const run = await planModel(base([PRD_A(), STORY(10, "2", { labels: ["type: enhancement"] })]));
    const create = run.batch("2").writes[0];
    const row = run.batch("6").writes[0];
    expect(row.detail).toBe(`create: 1 = shipped, —; 2 = in progress, ${create.id}; 3 = not started, —`);
    expect(row.dependsOn).toEqual([create.id]);
  });

  it("a `Not started` wave with an issue reads `published`", async () => {
    const w3 = issue(3, "[PRD-alpha] Wave 3: Alpha export", { labels: ["level: wave"], parent: 1 });
    const run = await planModel(base([PRD_A(), w3, STORY(10, "3", { parent: 3 })]));
    expect(run.batch("6").writes[0].detail).toBe("create: 1 = shipped, —; 2 = in progress, —; 3 = published, #3");
  });
});

describe("batch 7: Project cleanup (MU-51, D-81, D-97)", () => {
  it("prints the item query, the delete template and the two Workflows-page steps, no Project number", async () => {
    const run = await planModel(base());
    const steps = run.batch("7").steps;
    expect(steps.map((s) => s.step)).toEqual(projectCleanupSteps("acme"));
    expect(steps.every((s) => s.state === "pending")).toBe(true);
    const text = steps.map((s) => s.step).join("\n");
    expect(text).toContain(
      `gh project item-list <n> --owner acme --limit 500 --format json --jq '.items[] | select(.content.type == "PullRequest") | .id'`,
    );
    expect(text).toContain("gh project item-delete <n> --owner acme --id <item-id>");
    expect(text).toMatch(/Workflows.*auto-add.*`is:issue`/i);
    expect(text).toMatch(/Workflows.*default workflows/i);
    expect(text).not.toMatch(/item-list \d/);
    expect(steps).toHaveLength(4);
  });
});

describe("two tracking-issue matches (MU-53, D-87)", () => {
  it("omits every row for that PRD and its stories, and lists both issues", async () => {
    const m = base([
      issue(1, "[PRD-alpha] Alpha kit", { labels: ["type: prd"] }),
      issue(3, "[PRD-alpha] Alpha kit", { labels: [] }),
      STORY(10, "2", { labels: ["type: enhancement", "status: ready"] }),
    ]);
    const run = await planModel(m);
    const targets = run.writes().map((w) => w.target);
    for (const t of ["#1", "#3", "#10"]) expect(targets).not.toContain(t);
    expect(run.batch("2").writes).toEqual([]);
    expect(run.batch("6").writes).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({
        ref: "[PRD-alpha]",
        note: "two PRD tracking issues match (#1, #3); this PRD's batches are omitted until one remains (D-87)",
      }),
    );
  });

  it("two open wave issues for one wave omit the PRD too", async () => {
    const m = base([
      PRD_A(),
      WAVE_A2(),
      issue(3, "[PRD-alpha] Wave 2: Alpha search again", { labels: ["level: wave"] }),
      STORY(10, "2"),
    ]);
    const run = await planModel(m);
    expect(run.writes().filter((w) => w.action !== "edit-label" && w.action !== "create-label")).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "[PRD-alpha]", note: expect.stringMatching(/two wave tracking issues match alpha 2 \(#2, #3\)/) }),
    );
  });
});

describe("scope guards (MU-54, AC-5, D-19, D-27, D-82)", () => {
  it.each(["survey", "ac11", "empty"])("%s: no title write, no hierarchy on a standalone, no Status", async (name) => {
    const model = loadModel(name);
    const run = await planModel(model);
    const standalone = new Set(
      model.issues
        .filter((i) => !/\bStory S-\d+\b/.test(i.title) && !/^\[PRD-[^\]]+\]/.test(i.title))
        .map((i) => `#${i.number}`),
    );
    for (const w of run.writes()) {
      expect(w.action).not.toMatch(/title|status|project/i);
      if (w.action === "create-issue") expect(w.target).toBe("new issue");
      else expect(w.detail, w.id).not.toMatch(/^title:/);
      if (w.action === "link-sub-issue") {
        expect(standalone.has(w.target), w.id).toBe(false);
        expect(standalone.has(w.detail.replace("sub-issue ", "")), w.id).toBe(false);
      }
      if (w.action === "add-label" && w.detail.startsWith("level: ")) {
        expect(standalone.has(w.target), w.id).toBe(false);
      }
      expect(w.detail, w.id).not.toMatch(/\bStatus\b/);
    }
    expect(MIGRATION_PLAN_ACTIONS).not.toContain("edit-title" as never);
  });
});

describe("rows (A-81, CT-27, CT-29)", () => {
  it("IDs run W-001 upward in batch order and every dependency is an earlier row", async () => {
    const run = await planModel(loadModel("ac11"));
    const all = [...run.plan.batches.flatMap((b) => [...b.writes, ...b.steps])];
    expect(all.map((w) => w.id)).toEqual(all.map((_, i) => `W-${String(i + 1).padStart(3, "0")}`));
    const seen = new Set<string>();
    for (const w of run.writes()) {
      for (const d of w.dependsOn) expect(seen.has(d), `${w.id} -> ${d}`).toBe(true);
      seen.add(w.id);
      expect(w.state).toBe("pending");
    }
  });
});

// RT-12, S-014 half (A-66): apply the plan's rows to the model on the test
// side, then plan again: batches 1 to 6 are empty, batch 7 is still printed.
describe("re-planning after the writes proposes none (RT-12, A-66)", () => {
  it.each(["survey", "ac11", "empty"])("%s", async (name) => {
    const model = cloneModel(loadModel(name));
    const first = await planModel(model);
    applyPlanToModel(model, first.plan);
    const second = await planModel(model);
    for (const b of second.plan.batches.filter((x) => x.runner === "cli")) {
      expect(b.writes.map(triple), `batch ${b.key}`).toEqual([]);
    }
    expect(second.batch("7").steps).toHaveLength(4);
  });
});

// PT-80's companion: plan.ts is the only module file that names the batch 7 commands.
describe("batch 7 strings live in plan.ts only (A-60)", () => {
  it("no other core/migrate-projects file names `gh project`", () => {
    const dir = resolve(ROOT, "core/migrate-projects");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
      const has = /gh project/.test(readFileSync(resolve(dir, f), "utf-8"));
      expect(has, f).toBe(f === "plan.ts");
    }
  });
});
