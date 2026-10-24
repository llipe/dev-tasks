/**
 * S-014 AC-1: FR-18's precedence, as amended by §16a (A-54 to A-57, D-98):
 * the `**Story:**` line, then a `phase:` label scoped to the PRD in the
 * title prefix, else unmapped with the reason. Never fuzzy (D-18, D-86).
 * MU-36 to MU-43, EC-120 to EC-124, RT-9.
 */
import { describe, it, expect } from "vitest";
import { parseRoadmapTable, type RoadmapRow } from "#core/checks/roadmap.js";
import { parseStoryLine } from "#core/migrate-projects/classify.js";
import { mapStory, titlePrd, type StoryToMap } from "#core/migrate-projects/map.js";
import { prng, seedFromEnv } from "./helpers/prng.js";

const HEADER =
  "| PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing |\n| --- | --- | --- | --- | --- | --- |\n";

function rows(...cells: Array<[string, string]>): RoadmapRow[] {
  const text =
    HEADER +
    cells
      .map(
        ([prd, phase]) =>
          `| [${prd}](requirements/prd-${prd}.md) | ${phase} | s | Not started | — | — |\n`,
      )
      .join("");
  const r = parseRoadmapTable(text);
  if (!r.ok) throw new Error(r.reason);
  return r.rows;
}

const ROADMAP = rows(["alpha", "1"], ["alpha", "2"], ["beta", "1"], ["gamma", "All"]);

function story(partial: Partial<StoryToMap> & { body?: string }): StoryToMap {
  return {
    number: partial.number ?? 10,
    title: partial.title ?? "[PRD-alpha] Story S-001: x",
    labels: partial.labels ?? [],
    milestone: partial.milestone ?? null,
    storyRef: partial.storyRef ?? parseStoryLine(partial.body ?? ""),
  };
}

const LINE = (slug: string) => `**Story:** workstream/user-stories-${slug}.md`;

describe("mapStory (FR-18, AC-1)", () => {
  // MU-36
  it("rule 1: the **Story:** line maps by the PRD link text and the phase", () => {
    const r = mapStory(story({ body: LINE("alpha-phase-2") }), ROADMAP);
    expect(r.mapped).toBe(true);
    if (r.mapped) {
      expect(r.row.prd).toBe("alpha");
      expect(r.row.phase).toBe("2");
      expect(r.rule).toBe("story-line");
      expect(r.notes).toEqual([]);
    }
  });

  it("rule 1 tolerates backticks and the → S-NNN suffix (A-54)", () => {
    const r = mapStory(
      story({ body: "**Story:** `workstream/user-stories-alpha-phase-1.md` → S-019" }),
      ROADMAP,
    );
    expect(r.mapped && r.row.phase).toBe("1");
  });

  // EC-124, A-55
  it("rule 1: a story file without -phase-N maps to the PRD's `All` row", () => {
    const r = mapStory(story({ title: "Story S-1: g", body: LINE("gamma") }), ROADMAP);
    expect(r.mapped && r.row.prd).toBe("gamma");
    const none = mapStory(story({ title: "Story S-1: a", body: LINE("alpha") }), ROADMAP);
    expect(none.mapped).toBe(false);
  });

  // EC-123, A-55
  it("rule 1 never prefix-guesses a slug: `alph` and `alpha-x` are unmapped", () => {
    for (const slug of ["alph-phase-1", "alpha-x-phase-1"]) {
      const r = mapStory(story({ title: "Story S-1: a", body: LINE(slug) }), ROADMAP);
      expect(r.mapped, slug).toBe(false);
      if (!r.mapped) expect(r.reason).toMatch(/no roadmap row/);
    }
  });

  // MU-37, A-56
  it("rule 2: `phase: 2` maps only to the cell `2` of the title prefix's PRD", () => {
    const r = mapStory(story({ labels: ["phase: 2"] }), ROADMAP);
    expect(r.mapped && r.rule).toBe("phase-label");
    expect(r.mapped && r.row.prd).toBe("alpha");
    const near = rows(["alpha", "02"], ["alpha", "2.0"], ["alpha", "Wave 2"]);
    expect(mapStory(story({ labels: ["phase: 2"] }), near).mapped).toBe(false);
  });

  // EC-120, A-56: `phase: 1` matches alpha 1 and beta 1, but the prefix scopes it.
  it("rule 2 is scoped: `phase: 1` on a [PRD-beta] story maps to beta 1, not alpha 1", () => {
    const r = mapStory(story({ title: "[PRD-beta] Story S-1: b", labels: ["phase: 1"] }), ROADMAP);
    expect(r.mapped && r.row.prd).toBe("beta");
  });

  it("rule 2 without a title prefix maps nothing, and says why (D-98)", () => {
    const r = mapStory(story({ title: "Story S-1: x", labels: ["phase: 1"] }), ROADMAP);
    expect(r.mapped).toBe(false);
    if (!r.mapped) {
      expect(r.reason).toMatch(/`phase: 1`/);
      expect(r.reason).toMatch(/title prefix/);
      expect(r.reason).toMatch(/2 rows repository-wide/);
    }
  });

  // MU-41: ambiguity inside the scoped PRD.
  it("a `phase:` label matching two rows is unmapped, reason ambiguous", () => {
    const dup = rows(["alpha", "1"], ["alpha", "1"]);
    const r = mapStory(story({ labels: ["phase: 1"] }), dup);
    expect(r.mapped).toBe(false);
    if (!r.mapped) expect(r.reason).toMatch(/ambiguous/);
    const two = mapStory(story({ labels: ["phase: 1", "phase: 2"] }), ROADMAP);
    expect(two.mapped).toBe(false);
    if (!two.mapped) expect(two.reason).toMatch(/ambiguous/);
  });

  // MU-40, EC-122
  it("body line and label disagree: the body line wins and both are cited", () => {
    const r = mapStory(story({ body: LINE("alpha-phase-2"), labels: ["phase: 1"] }), ROADMAP);
    expect(r.mapped).toBe(true);
    if (r.mapped) {
      expect(r.row.phase).toBe("2");
      expect(r.notes).toHaveLength(1);
      expect(r.notes[0]).toMatch(/alpha 2/);
      expect(r.notes[0]).toMatch(/`phase: 1`/);
      expect(r.notes[0]).toMatch(/alpha 1/);
    }
  });

  // MU-43: a line naming an absent row falls through to rule 2, and the reason records it.
  it("a **Story:** line naming no row falls through to the label", () => {
    const r = mapStory(story({ body: LINE("alpha-phase-9"), labels: ["phase: 2"] }), ROADMAP);
    expect(r.mapped && r.rule).toBe("phase-label");
    if (r.mapped) expect(r.notes.join(" ")).toMatch(/alpha 9/);
  });

  // MU-38 superseded (D-98), MU-42, EC-121: the milestone is not a rule.
  it("a milestone never maps, even when exactly one wave could own it", () => {
    const r = mapStory(story({ title: "Story S-8: m", milestone: "alpha 2" }), ROADMAP);
    expect(r.mapped).toBe(false);
    if (!r.mapped) expect(r.reason).toMatch(/milestone `alpha 2` is not a mapping rule \(D-98\)/);
  });

  // MU-39
  it("nothing yields a row: unmapped with a reason naming each rule tried", () => {
    const r = mapStory(story({ title: "Story S-9: n" }), ROADMAP);
    expect(r.mapped).toBe(false);
    if (!r.mapped) expect(r.reason).toBe("no `**Story:**` line; no `phase:` label");
  });

  it("titlePrd reads the [PRD-<name>] prefix exactly", () => {
    expect(titlePrd("[PRD-alpha] Story S-1: x")).toBe("alpha");
    expect(titlePrd("Story S-1: x")).toBeNull();
    expect(titlePrd(" [PRD-alpha] x")).toBeNull();
  });
});

// RT-9: an independent oracle. For each story, count the rows each rule
// yields; the first rule with exactly one row maps, otherwise unmapped.
describe("RT-9: maps only on exactly one matching row", () => {
  it("agrees with the oracle on random roadmaps and stories", () => {
    const seed = seedFromEnv(1761264914);
    const r = prng(seed);
    const prds = ["alpha", "beta", "gamma", "delta"];
    const phases = ["1", "2", "3", "All", "02"];
    for (let iter = 0; iter < 500; iter++) {
      const cells: Array<[string, string]> = [];
      const nPrd = r.int(1, 4);
      for (let p = 0; p < nPrd; p++) {
        const nWave = r.int(1, 4);
        for (let w = 0; w < nWave; w++) cells.push([prds[p], r.pick(phases)]);
      }
      const roadmap = rows(...cells);
      const prd = r.pick([...prds, "omega"]);
      const prefix = r.bool() ? `[PRD-${r.pick([...prds, "omega"])}] ` : "";
      const lineWave = r.pick([...phases, null]);
      const body = r.bool()
        ? LINE(lineWave === null ? prd : `${prd}-phase-${lineWave}`)
        : "no line";
      const labels = r.bool() ? [`phase: ${r.pick(phases)}`] : [];
      if (r.bool() && labels.length > 0) labels.push(`phase: ${r.pick(phases)}`);
      const s = story({ title: `${prefix}Story S-1: x`, body, labels: [...new Set(labels)] });

      // Oracle.
      const count1 =
        s.storyRef === null
          ? 0
          : roadmap.filter(
              (row) => row.prd === s.storyRef!.slug && row.phase === (s.storyRef!.phase ?? "All"),
            );
      const scope = titlePrd(s.title);
      const phaseValues = s.labels.map((l) => l.slice("phase: ".length));
      const count2 =
        scope === null || phaseValues.length === 0
          ? 0
          : roadmap.filter((row) => row.prd === scope && phaseValues.includes(row.phase));
      const expected =
        Array.isArray(count1) && count1.length === 1
          ? count1[0]
          : Array.isArray(count2) && count2.length === 1
            ? count2[0]
            : null;

      const got = mapStory(s, roadmap);
      const ctx = JSON.stringify({ seed, iter, cells, title: s.title, body, labels: s.labels });
      if (expected === null) expect(got.mapped, ctx).toBe(false);
      else {
        expect(got.mapped, ctx).toBe(true);
        if (got.mapped) expect(got.row, ctx).toBe(expected);
      }
    }
  });
});
