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
import {
  MIGRATION_PLAN_ACTIONS,
  MIGRATION_PLAN_BATCHES,
  parseMigrationPlan,
  renderMigrationPlan,
} from "#core/migrate-projects/planfile.js";
import { projectCleanupSteps, retiredDescription } from "#core/migrate-projects/plan.js";
import { cloneModel, loadModel, type ModelIssue, type RepoModel } from "./helpers/fake-github.js";
import { applyPlanToModel } from "./helpers/model-apply.js";
import { planModel, triple } from "./helpers/plan-run.js";
import { prng, seedFromEnv } from "./helpers/prng.js";

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
    m.labels = m.labels.filter(
      (l) => !["level: wave", "type: test", "type: refactor"].includes(l.name),
    );
    const run = await planModel(m);
    expect(run.batch("1").writes.map(triple)).toEqual([
      [
        "create-label",
        "label:level: wave",
        `color: ${LEVEL_DEFINITIONS["level: wave"].color}; description: ${LEVEL_DEFINITIONS["level: wave"].description}`,
      ],
      [
        "create-label",
        "label:type: refactor",
        `color: ${TYPE_COLORS.refactor}; description: ${TYPE_DEFINITIONS.refactor}`,
      ],
      [
        "create-label",
        "label:type: test",
        `color: ${TYPE_COLORS.test}; description: ${TYPE_DEFINITIONS.test}`,
      ],
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
    expect(PRIORITY_DEFINITIONS["priority: critical"].description).toMatch(
      /Blocks a wave, PRD, or release from shipping/,
    );
    expect(PRIORITY_DEFINITIONS["priority: high"].description).toMatch(
      /current wave or cycle; blocks no ship/,
    );
    expect(PRIORITY_DEFINITIONS["priority: medium"].description).toMatch(/next/);
    expect(PRIORITY_DEFINITIONS["priority: low"].description).toMatch(/Backlog/);
    for (const d of [...Object.values(PRIORITY_DEFINITIONS), ...Object.values(LEVEL_DEFINITIONS)]) {
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
      {
        name: "needs: merge",
        description: `${RETIRED_DESCRIPTION_PREFIX}Waiting to merge`,
        color: "C5DEF5",
      },
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
      [
        "create-issue",
        "new issue",
        "template: prd; label: level: prd; title: [PRD-alpha] Alpha kit",
      ],
      [
        "create-issue",
        "new issue",
        "template: wave; label: level: wave; title: [PRD-alpha] Wave 2: Alpha search",
      ],
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
    const run = await planModel(
      base([PRD_A(), closedWave, STORY(10, "2", { labels: ["type: enhancement"] })]),
    );
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
    const run = await planModel(
      base([PRD_A(), WAVE_A2(null), STORY(10, "2"), STORY(11, "2", { parent: 2 })]),
    );
    expect(run.batch("3").writes.map(triple)).toEqual([
      ["link-sub-issue", "#1", "sub-issue #2"],
      ["link-sub-issue", "#2", "sub-issue #10"],
    ]);
  });

  it("a story under the wrong wave is listed, never relinked", async () => {
    const wave3 = issue(3, "[PRD-alpha] Wave 3: Alpha export", {
      labels: ["level: wave"],
      parent: 1,
    });
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
      expect.objectContaining({
        ref: "#2",
        note: expect.stringMatching(/parent is #9; it is never relinked/),
      }),
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
      issue(2, "[PRD-alpha] Wave 2: Alpha search", {
        labels: ["type: wave", "level: wave"],
        parent: 1,
      }),
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
    const run = await planModel(
      base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2, labels: ["level: story"] })]),
    );
    expect(run.plan.review.needsType.map((n) => n.issue)).toEqual([10]);
    expect(run.batch("4").writes).toEqual([]);
  });

  it("`add-label` depends on the create of its label (A-81)", async () => {
    const m = base([
      PRD_A(),
      WAVE_A2(),
      STORY(10, "2", { parent: 2, labels: ["type: enhancement"] }),
    ]);
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
        labels: [
          "type: bug",
          "status: ready",
          "status: blocked",
          "needs: approval",
          "wave: 2",
          "wave:3",
        ],
      }),
      issue(21, "[bug] b", { labels: ["type: bug", "status: in-progress"], state: "closed" }),
      issue(22, "[bug] c", {
        labels: ["type: bug", "status: needs-refinement", "status: deferred"],
      }),
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
    const closed = issue(3, "[PRD-alpha] Wave 1: Alpha basics", {
      labels: ["level: wave"],
      parent: 1,
      state: "closed",
    });
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
    m.comments = {
      "1": [comment(["| 1 | shipped | — |", "| 2 | published | #2 |", "| 3 | x | — |"])],
    };
    const run = await planModel(m);
    expect(run.batch("6").writes).toEqual([]);
  });

  it("a created wave issue appears by its create row, which the comment depends on", async () => {
    const run = await planModel(base([PRD_A(), STORY(10, "2", { labels: ["type: enhancement"] })]));
    const create = run.batch("2").writes[0];
    const row = run.batch("6").writes[0];
    expect(row.detail).toBe(
      `create: 1 = shipped, —; 2 = in progress, ${create.id}; 3 = not started, —`,
    );
    expect(row.dependsOn).toEqual([create.id]);
  });

  it("a `Not started` wave with an issue reads `published`", async () => {
    const w3 = issue(3, "[PRD-alpha] Wave 3: Alpha export", { labels: ["level: wave"], parent: 1 });
    const run = await planModel(base([PRD_A(), w3, STORY(10, "3", { parent: 3 })]));
    expect(run.batch("6").writes[0].detail).toBe(
      "create: 1 = shipped, —; 2 = in progress, —; 3 = published, #3",
    );
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
    expect(
      run.writes().filter((w) => w.action !== "edit-label" && w.action !== "create-label"),
    ).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({
        ref: "[PRD-alpha]",
        note: expect.stringMatching(/two wave tracking issues match alpha 2 \(#2, #3\)/),
      }),
    );
  });
});

/**
 * MU-54's oracle (qa gap 2), written here from §16a A-53 rather than taken
 * from classify.ts: standalone means no `Story S-NNN` title, no `**Story:**`
 * line, and not a tracking title. A `[PRD-x]`-prefixed issue can be
 * standalone, so the prefix alone never exempts it.
 */
function standaloneOracle(model: RepoModel): Set<string> {
  const prdForms = new Set<string>();
  for (const [path, text] of Object.entries(model.files)) {
    const file = path.match(/^docs\/requirements\/prd-(.+)\.md$/);
    const h1 = text.split("\n").find((l) => l.startsWith("# "));
    if (!file || h1 === undefined) continue;
    const name = file[1];
    const full = h1.slice(2).trim();
    const noPrd = full.replace(/^PRD:\s*/, "");
    const noName = noPrd.startsWith(`${name} `)
      ? noPrd.slice(name.length + 1).replace(/^[—–-]\s+/, "")
      : noPrd;
    for (const f of [full, noPrd, noName]) prdForms.add(`[PRD-${name}] ${f}`);
  }
  const container = ["level: prd", "level: wave", "type: prd", "type: wave"];
  return new Set(
    model.issues
      .filter((i) => {
        if (/\bStory S-\d+\b/.test(i.title)) return false;
        if (/^\s*\*\*Story:\*\*/m.test(i.body ?? "")) return false;
        if (/^\[PRD-[^\]\s]+\] Wave [^\s:]+:/.test(i.title)) return false;
        if (prdForms.has(i.title)) return false;
        if (/^\[PRD-/.test(i.title) && i.labels.some((l) => container.includes(l.toLowerCase())))
          return false;
        return true;
      })
      .map((i) => `#${i.number}`),
  );
}

describe("scope guards (MU-54, AC-5, D-19, D-27, D-82)", () => {
  it("the oracle guards a `[PRD-x]`-prefixed standalone issue (qa gap 2)", () => {
    const m = base([
      issue(5, "[PRD-alpha] fix: crash", { labels: ["type: bug", "phase: 2"] }),
      STORY(10, "2"),
      PRD_A(),
    ]);
    expect([...standaloneOracle(m)]).toEqual(["#5"]);
  });

  it("a `[PRD-x]`-prefixed standalone with a `phase:` label gets no level and no parent", async () => {
    const m = base([
      PRD_A(),
      WAVE_A2(),
      issue(5, "[PRD-alpha] fix: crash", { labels: ["type: bug", "phase: 2"] }),
    ]);
    const run = await planModel(m);
    expect(run.writes().filter((w) => w.target === "#5" || w.detail.includes("#5"))).toEqual([]);
  });

  it.each(["survey", "ac11", "empty"])(
    "%s: no title write, no hierarchy on a standalone, no Status",
    async (name) => {
      const model = loadModel(name);
      const run = await planModel(model);
      const standalone = standaloneOracle(model);
      for (const w of run.writes()) {
        // `status-comment` is the PRD comment (D-92), not a Project Status.
        expect(w.action).not.toMatch(/title|project|^status$|set-status/i);
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
    },
  );
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

// RT-12 and RT-13 over random repositories (qa gap 3): every row respects
// the scope guards and every dependency is an earlier row; answers are
// filled at random and fed to a second --plan (A-50); once that plan's rows,
// including batch 4 type rows and batch 4b blocking links and priority
// switches, are applied, a third --plan proposes no batch 1 to 6 row (A-66).
describe("random repositories (RT-12, RT-13)", () => {
  it("guards hold, answers apply, and re-planning after the writes proposes none", async () => {
    const seed = seedFromEnv(1761265014);
    const r = prng(seed);
    const pool = [
      "type: bug",
      "type: enhancement",
      "Type: Docs",
      "type: other",
      "type: prd",
      "status: ready",
      "Status: Ready",
      "status: blocked",
      "wave: 2",
      "phase: 1",
      "phase: 2",
      "phase: 3",
      "needs: merge",
      "priority: high",
      "priority: critical",
      "level: story",
      "bug",
    ];
    const seen = { typeRow: 0, blockedBy: 0, toHigh: 0, comment: 0 };
    for (let iter = 0; iter < 200; iter++) {
      const ctx = `seed ${seed} iter ${iter}`;
      const m = base();
      m.labels = m.labels.filter(() => r.bool(0.7));
      for (const name of ["type: other", "type: prd", "status: ready", "wave: 2", "needs: merge"]) {
        if (r.bool()) {
          m.labels.push({
            name,
            description: r.bool() ? "Old" : "Retired (D-91): Old",
            color: "CCCCCC",
          });
        }
      }
      const issues: ModelIssue[] = [];
      if (r.bool(0.6)) {
        issues.push(issue(1, "[PRD-alpha] Alpha kit", { labels: r.bool() ? ["type: prd"] : [] }));
        if (r.bool(0.4)) {
          seen.comment++;
          const rows = [
            "| 1 | shipped | — |",
            "| 2 | in progress | #2 |",
            "| 3 | not started | — |",
          ];
          m.comments = { "1": [comment(rows.filter(() => r.bool()))] };
        }
      }
      if (r.bool(0.4)) {
        issues.push(
          issue(2, "[PRD-alpha] Wave 2: Alpha search", {
            labels: ["level: wave"],
            parent: r.bool() && issues.length > 0 ? 1 : null,
            state: r.bool(0.8) ? "open" : "closed",
          }),
        );
      }
      const count = r.int(0, 8);
      for (let k = 0; k < count; k++) {
        const num = 10 + k;
        const labels = [...new Set(Array.from({ length: r.int(0, 3) }, () => r.pick(pool)))];
        // A label GitHub would refuse twice (case-insensitive) keeps one spelling.
        const unique = labels.filter(
          (l, i) => labels.findIndex((x) => x.toLowerCase() === l.toLowerCase()) === i,
        );
        const kind = r.int(0, 4);
        if (kind === 0) {
          issues.push(
            issue(num, `[PRD-alpha] Story S-0${num}: s`, {
              labels: unique,
              body: `**Story:** workstream/user-stories-alpha-phase-${r.pick(["1", "2", "3", "9"])}.md`,
            }),
          );
        } else if (kind === 1) {
          issues.push(
            issue(num, `${r.bool() ? "[PRD-alpha] " : ""}Story S-0${num}: s`, { labels: unique }),
          );
        } else if (kind === 2) {
          // RT-13: a prefixed standalone issue, guarded like any other.
          issues.push(
            issue(num, `[PRD-alpha] ${r.pick(["fix: a", "chore: b", "docs c"])}`, {
              labels: unique,
            }),
          );
        } else {
          issues.push(
            issue(num, r.pick(["fix: a", "[chore] b", "docs: c", "plain d"]), {
              labels: unique,
              state: r.bool(0.9) ? "open" : "closed",
            }),
          );
        }
      }
      m.issues = issues;
      if (r.bool(0.3)) m.files["workstream/planner-state-alpha-phase-3.md"] = "x";

      const standalone = standaloneOracle(m);
      const guard = (run: Awaited<ReturnType<typeof planModel>>) => {
        const ids = new Set<string>();
        for (const w of run.writes()) {
          for (const d of w.dependsOn) expect(ids.has(d), `${ctx} ${w.id}`).toBe(true);
          ids.add(w.id);
          if (w.action === "link-sub-issue") {
            expect(standalone.has(w.target), `${ctx} ${w.id}`).toBe(false);
            expect(standalone.has(w.detail.slice("sub-issue ".length)), `${ctx} ${w.id}`).toBe(
              false,
            );
          }
          if (w.action === "add-label" && w.detail.startsWith("level: ")) {
            expect(standalone.has(w.target), `${ctx} ${w.id}`).toBe(false);
          }
          if (w.action === "edit-label") {
            expect(w.detail.length - "description: ".length, ctx).toBeLessThanOrEqual(100);
          }
        }
      };

      const first = await planModel(m);
      guard(first);
      // Answers, at random, the way the owner would give them.
      const p = parseMigrationPlan(first.text).plan;
      const openNumbers = m.issues.filter((i) => i.state === "open").map((i) => i.number);
      for (const u of p.review.unmapped)
        if (r.bool(0.6)) u.answer = r.pick(["alpha 2", "alpha 3", "standalone"]);
      for (const t of p.review.needsType) if (r.bool(0.7)) t.answer = r.pick([...TYPE_SET]);
      for (const b of p.review.needsBlockingLink) {
        if (!r.bool(0.8)) continue;
        const others = openNumbers.filter((n) => n !== b.issue);
        b.answer = others.length > 0 && r.bool() ? `#${r.pick(others)}` : "lower priority to high";
      }
      const second = await planModel(m, { previous: renderMigrationPlan(p) });
      guard(second);
      expect(second.plan.approved, ctx).toBe(false);
      for (const w of second.batch("4").writes) {
        if (w.action === "add-label" && w.detail.startsWith("type: ")) seen.typeRow++;
      }
      for (const w of second.batch("4b").writes) {
        if (w.action === "add-blocked-by") seen.blockedBy++;
        if (w.action === "add-label" && w.detail === "priority: high") seen.toHigh++;
      }
      applyPlanToModel(m, second.plan);
      const third = await planModel(m, { previous: second.text });
      for (const b of third.plan.batches.filter((x) => x.runner === "cli")) {
        expect(b.writes.map(triple), `${ctx} batch ${b.key}`).toEqual([]);
      }
    }
    // The generator reaches every answer kind and the existing comment.
    expect(seen.typeRow).toBeGreaterThan(0);
    expect(seen.blockedBy).toBeGreaterThan(0);
    expect(seen.toHigh).toBeGreaterThan(0);
    expect(seen.comment).toBeGreaterThan(0);
  });
});

// 4.15 (qa gap 1, the surviving mutant): a `Done` row keeps its open wave
// issue for the status comment, and still links no story under it.
describe("a `Done` row with an open wave issue (4.15, A-83)", () => {
  it("links no story, notes it, and the comment row keeps the wave issue", async () => {
    const wave1 = issue(4, "[PRD-alpha] Wave 1: Alpha basics", {
      labels: ["level: wave"],
      parent: 1,
    });
    const run = await planModel(base([PRD_A(), wave1, STORY(10, "1", { parent: null })]));
    expect(run.writes().filter((w) => w.action === "link-sub-issue")).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "#10", note: expect.stringMatching(/alpha 1 is `Done`/) }),
    );
    expect(run.batch("6").writes[0].detail).toBe(
      "create: 1 = shipped, #4; 2 = in progress, —; 3 = not started, —",
    );
  });

  it("an unlinked kept wave issue of a `Done` row is still linked under its PRD", async () => {
    const wave1 = issue(4, "[PRD-alpha] Wave 1: Alpha basics", {
      labels: ["level: wave"],
      parent: null,
    });
    const run = await planModel(base([PRD_A(), wave1, STORY(10, "1", { parent: null })]));
    expect(run.batch("3").writes.map(triple)).toEqual([["link-sub-issue", "#1", "sub-issue #4"]]);
  });
});

// 4.18 (EC-117, D-106): GitHub matches label names case-insensitively.
describe("label names match case-insensitively (4.18, EC-117, D-106)", () => {
  it("an existing label in another case is reused, and its description set on its own name", async () => {
    const m = base();
    m.labels = m.labels.filter((l) => l.name !== "type: bug" && l.name !== "level: story");
    m.labels.push(
      { name: "Type: Bug", description: "Broken", color: "D93F0B" },
      {
        name: "Level: Story",
        description: LEVEL_DEFINITIONS["level: story"].description,
        color: "7986CB",
      },
      { name: "Status: Ready", description: "Ready", color: "0E8A16" },
    );
    const run = await planModel(m);
    expect(run.batch("1").writes.map(triple)).toEqual([
      ["edit-label", "label:Type: Bug", `description: ${TYPE_DEFINITIONS.bug}`],
      ["edit-label", "label:Status: Ready", "description: Retired (D-91): Ready"],
    ]);
  });

  it("issue labels in another case count: level, retired and type labels", async () => {
    const m = base([
      PRD_A(),
      WAVE_A2(),
      STORY(10, "2", { parent: 2, labels: ["Type: Enhancement", "Level: Story", "Status: Ready"] }),
      issue(20, "[bug] x", { labels: ["TYPE: BUG", "Priority: Critical"] }),
    ]);
    const run = await planModel(m);
    expect(run.batch("4").writes).toEqual([]);
    expect(run.batch("5").writes.map(triple)).toEqual([["remove-label", "#10", "Status: Ready"]]);
    expect(run.plan.review.needsType.map((n) => n.issue)).toEqual([]);
    expect(run.plan.review.needsBlockingLink.map((n) => n.issue)).toEqual([20]);
    expect(run.calls.map((c) => c.join(" "))).toContain(
      "api --paginate repos/acme/kit/issues/20/dependencies/blocking?per_page=100",
    );
  });

  it("a type answer removes other types by their own spelling and never re-adds one present", async () => {
    const m = base([issue(20, "fix: x", { labels: ["Type: Bug", "type: docs"] })]);
    const first = await planModel(m);
    const p = parseMigrationPlan(first.text).plan;
    p.review.needsType[0].answer = "bug";
    const second = await planModel(m, { previous: renderMigrationPlan(p) });
    expect(second.batch("4").writes.map(triple)).toEqual([["remove-label", "#20", "type: docs"]]);
  });

  it("a `Phase:` label in another case maps like `phase:`", async () => {
    const run = await planModel(
      base([
        PRD_A(),
        WAVE_A2(),
        issue(10, "[PRD-alpha] Story S-010: s", { labels: ["type: enhancement", "Phase: 2"] }),
      ]),
    );
    expect(run.batch("3").writes.map(triple)).toEqual([["link-sub-issue", "#2", "sub-issue #10"]]);
  });
});

// 4.19 (qa gap 5): the remaining branches.
describe("remaining branches (4.19)", () => {
  it("a wave tracking issue without `Wave <id>:` is noted", async () => {
    const run = await planModel(
      base([PRD_A(), issue(3, "[PRD-alpha] Gadget wave", { labels: ["level: wave"] })]),
    );
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "#3", note: expect.stringMatching(/without `Wave <id>:`/) }),
    );
  });

  it("tracking issues naming no roadmap PRD or wave are roadmap notes", async () => {
    const run = await planModel(
      base([
        PRD_A(),
        issue(3, "[PRD-gamma] Wave 1: g", { labels: ["level: wave"] }),
        issue(4, "[PRD-alpha] Wave 7: s", { labels: ["level: wave"] }),
      ]),
    );
    expect(run.plan.review.roadmap).toEqual([
      { row: "#3", note: "tracking issue for PRD gamma, which no roadmap row has" },
      { row: "#4", note: "wave tracking issue for alpha 7, which no roadmap row has" },
    ]);
  });

  it("an unmapped story whose prefix names an omitted PRD is neither listed nor targeted", async () => {
    const run = await planModel(
      base([
        issue(1, "[PRD-alpha] Alpha kit"),
        issue(3, "[PRD-alpha] Alpha kit"),
        issue(10, "[PRD-alpha] Story S-010: s", { labels: ["status: ready"] }),
      ]),
    );
    expect(run.plan.review.unmapped).toEqual([]);
    expect(run.writes().some((w) => w.target === "#10")).toBe(false);
  });

  it("a needed PRD without an H1 and its wave get notes, never a create", async () => {
    const m = base([STORY(10, "2", { labels: ["type: enhancement"] })]);
    m.files["docs/requirements/prd-alpha.md"] = "no heading here\n";
    const run = await planModel(m);
    expect(run.batch("2").writes).toEqual([]);
    const notes = run.plan.review.information.map((i) => i.note);
    expect(notes).toContain(
      "no `docs/requirements/prd-alpha.md` heading to title its PRD tracking issue; none is created",
    );
    expect(notes).toContain(
      "wave alpha 2 needs a wave issue, but the PRD has no tracking issue to hold it; none is created",
    );
  });

  it("a `Phase/Wave` cell with a space or colon cannot title a wave issue", async () => {
    const m = base([
      issue(9, "[PRD-beta] Beta kit", { labels: ["level: prd"] }),
      issue(10, "[PRD-beta] Story S-010: s", {
        labels: ["type: enhancement", "phase: Beta launch"],
      }),
    ]);
    m.files["docs/roadmap.md"] =
      ROADMAP +
      "| [beta](requirements/prd-beta.md) | Beta launch | Launch | Not started | — | — |\n";
    const run = await planModel(m);
    expect(run.batch("2").writes).toEqual([]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "[PRD-beta]", note: expect.stringMatching(/space or colon/) }),
    );
  });

  it("several marker comments are noted; batch 6 edits the oldest", async () => {
    const m = base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2 })]);
    m.comments = {
      "1": [{ ...comment(["| 1 | shipped | — |"]), id: 7002 }, comment(["| 1 | shipped | — |"])],
    };
    const run = await planModel(m);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({
        ref: "#1",
        note: "2 comments carry the status marker; batch 6 edits the oldest (7001); remove the others",
      }),
    );
    expect(run.batch("6").writes[0].detail).toMatch(/^add: 2 = /);
  });

  it("a blocking answer naming the issue itself is invalid", async () => {
    const m = base([issue(30, "[bug] a", { labels: ["type: bug", "priority: critical"] })]);
    const first = await planModel(m);
    const p = parseMigrationPlan(first.text).plan;
    p.review.needsBlockingLink[0].answer = "#30";
    const second = await planModel(m, { previous: renderMigrationPlan(p) });
    expect(second.batch("4b").writes).toEqual([]);
    expect(second.plan.review.information).toContainEqual(
      expect.objectContaining({
        ref: "#30",
        note: 'invalid answer "#30": an issue cannot block itself',
      }),
    );
  });

  it("a state file without -phase-N makes the PRD's `All` wave active", async () => {
    const m = base([], {
      "docs/requirements/prd-gamma.md": "# PRD: gamma — Gamma kit\n",
      "workstream/planner-state-gamma.md": "x",
    });
    m.files["docs/roadmap.md"] =
      ROADMAP + "| [gamma](requirements/prd-gamma.md) | All | Gamma all | In progress | — | — |\n";
    const run = await planModel(m);
    expect(run.batch("2").writes.map((w) => w.detail)).toEqual([
      "template: prd; label: level: prd; title: [PRD-gamma] Gamma kit",
      "template: wave; label: level: wave; title: [PRD-gamma] Wave All: Gamma all",
    ]);
  });

  // EC-129: decided as A-91 reads: only open matches count.
  it("one closed and one open PRD match: the open one is reused, nothing omitted", async () => {
    const closed = issue(3, "[PRD-alpha] Alpha kit", { labels: ["level: prd"], state: "closed" });
    const run = await planModel(base([PRD_A(), closed, WAVE_A2(), STORY(10, "2", { parent: 2 })]));
    expect(run.batch("2").writes).toEqual([]);
    expect(run.batch("6").writes.map((w) => w.target)).toEqual(["#1"]);
    expect(run.plan.review.information.some((i) => /two PRD tracking issues/.test(i.note))).toBe(
      false,
    );
  });

  // EC-131
  it("a PRD whose rows are all `Done`, with no open story, gets only the question", async () => {
    const m = base([PRD_A(), WAVE_A2(), STORY(10, "2", { parent: 2 })], {
      "docs/requirements/prd-gamma.md": "# PRD: gamma — Gamma kit\n",
    });
    m.files["docs/roadmap.md"] =
      ROADMAP +
      "| [gamma](requirements/prd-gamma.md) | 1 | G1 | Done | — | — |\n| [gamma](requirements/prd-gamma.md) | 2 | G2 | Done | — | — |\n";
    const run = await planModel(m);
    expect(run.batch("2").writes).toEqual([]);
    expect(run.batch("6").writes.map((w) => w.target)).toEqual(["#1"]);
    expect(run.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "[PRD-gamma]", answer: "" }),
    );
  });
});
