/**
 * S-013 AC-4: classification and the review lists (D-82, D-84, D-85, D-87,
 * D-100; spec §16a A-53, A-54, A-68 to A-72). MU-1 to MU-16, EC-106 to
 * EC-114, RT-13, RT-15.
 */
import { describe, it, expect } from "vitest";
import {
  classifySnapshot,
  issueKind,
  parseStoryLine,
  STORY_TITLE_PATTERN,
} from "#core/migrate-projects/classify.js";
import { readSnapshot, type MigrationSnapshot } from "#core/migrate-projects/snapshot.js";
import { suggestType } from "#core/migrate-projects/conventions.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { modelReader, recordingRunner } from "./helpers/recording-runner.js";
import { prng, seedFromEnv } from "./helpers/prng.js";

const PRDS = new Map([["alpha", "PRD: alpha — Alpha widgets"]]);
const issue = (title: string, labels: string[] = [], body = "") => ({ title, labels, body });

async function snapshotOf(model: RepoModel): Promise<MigrationSnapshot> {
  return readSnapshot({ runner: recordingRunner(model).runner, reader: modelReader(model) });
}

describe("story (D-82, A-54)", () => {
  // MU-1
  it("title `Story S-<digits>` is a story; near misses are not", () => {
    expect(issueKind(issue("Story S-12: list"), PRDS).kind).toBe("story");
    expect(issueKind(issue("[PRD-alpha] Story S-001: Gadget"), PRDS).kind).toBe("story");
    for (const t of ["Story S-: x", "Storys S-1", "story s-1", "AStory S-1"]) {
      expect(issueKind(issue(t), PRDS).kind, t).toBe("standalone");
    }
    expect(STORY_TITLE_PATTERN.source).toBe("\\bStory S-\\d+\\b");
  });

  // MU-2, CT-38, EC-107
  it("the `**Story:**` line in its plain, backtick, arrow and CRLF forms", () => {
    const forms = [
      "**Story:** workstream/user-stories-alpha-phase-2.md",
      "**Story:** `workstream/user-stories-alpha-phase-2.md`",
      "**Story:** `workstream/user-stories-alpha-phase-2.md` → S-019",
      "## Summary\r\n\r\n**Story:** `workstream/user-stories-alpha-phase-2.md` → S-019\r\n\r\nmore",
    ];
    for (const body of forms) {
      expect(parseStoryLine(body), body).toEqual({
        path: "workstream/user-stories-alpha-phase-2.md",
        slug: "alpha",
        phase: "2",
      });
      expect(issueKind(issue("Gadget export", [], body), PRDS).kind).toBe("story");
    }
    expect(parseStoryLine("**Story:** workstream/user-stories-alpha.md")).toEqual({
      path: "workstream/user-stories-alpha.md",
      slug: "alpha",
      phase: null,
    });
  });

  // EC-108: a quoted or fenced example never classifies an issue.
  it("ignores the line inside a `>` quote or a code fence", () => {
    expect(parseStoryLine("> **Story:** workstream/user-stories-alpha-phase-2.md")).toBeNull();
    expect(
      parseStoryLine("```\n**Story:** workstream/user-stories-alpha-phase-1.md\n```"),
    ).toBeNull();
    expect(parseStoryLine("**Story:** see the file")).toBeNull();
  });

  // EC-106
  it("a story title with an empty or null body is a story", () => {
    expect(issueKind(issue("Story S-001: x", [], ""), PRDS).kind).toBe("story");
    expect(issueKind({ title: "Story S-001: x", labels: [], body: null }, PRDS).kind).toBe("story");
  });
});

describe("a story with a tracking signal is a story (EC-110, A-53, qa mutant M1)", () => {
  const line = "**Story:** `workstream/user-stories-alpha-phase-1.md` → S-001";
  it.each([
    ["[PRD-alpha] Story S-001: x", ["level: wave"], ""],
    ["[PRD-alpha] Story S-001: x", ["type: prd"], ""],
    ["[PRD-alpha] Story S-001: x", ["level: prd", "type: wave"], ""],
    ["[PRD-alpha] Wave 1: x", [], line],
    ["[PRD-alpha] Alpha widgets", ["level: prd"], line],
  ])("%s %j with body %j", (title, labels, body) => {
    expect(issueKind(issue(title, labels, body), PRDS).kind).toBe("story");
  });

  it("classifySnapshot keeps it a story", async () => {
    const model = cloneModel(loadModel("empty"));
    model.issues.push({
      id: 1,
      number: 1,
      state: "open",
      title: "[PRD-alpha] Wave 1: x",
      body: line,
      labels: ["level: wave"],
      milestone: null,
      parent: null,
      blocking: [],
    });
    const c = classifySnapshot(await snapshotOf(model));
    expect(c.issues[0].kind.kind).toBe("story");
  });
});

describe("tracking issue (D-87, A-53)", () => {
  // MU-3
  it("`[PRD-<name>] <PRD H1 title>` is a PRD tracking issue with or without labels", () => {
    for (const labels of [[], ["level: prd"], ["type: prd"]]) {
      expect(issueKind(issue("[PRD-alpha] Alpha widgets", labels), PRDS)).toEqual({
        kind: "tracking",
        level: "prd",
        prd: "alpha",
        wave: null,
      });
    }
    // The H1 itself (`PRD: alpha — Alpha widgets`) also matches.
    expect(issueKind(issue("[PRD-alpha] PRD: alpha — Alpha widgets"), PRDS).kind).toBe("tracking");
  });

  // MU-4, EC-109
  it("`[PRD-<name>] Wave <id>:` is a wave tracking issue; the prefix is exact", () => {
    expect(issueKind(issue("[PRD-alpha] Wave 1: Widgets"), PRDS)).toEqual({
      kind: "tracking",
      level: "wave",
      prd: "alpha",
      wave: "1",
    });
    expect(issueKind(issue("[PRD-x] Wave 3a: Things", ["level: wave"]), PRDS).kind).toBe(
      "tracking",
    );
    for (const t of ["[PRD-alpha] Wave1: x", "[prd-alpha] Wave 1: x", "PRD-alpha Wave 1: x"]) {
      expect(issueKind(issue(t), PRDS).kind, t).toBe("standalone");
    }
  });

  // MU-5, EC-110
  it("stories first: a prefixed story is a story; another prefixed issue is standalone", () => {
    expect(issueKind(issue("[PRD-alpha] Story S-001: Gadget", ["level: story"]), PRDS).kind).toBe(
      "story",
    );
    expect(issueKind(issue("[PRD-alpha] Remove old fallback"), PRDS).kind).toBe("standalone");
    // ...unless it carries a container label (A-53).
    expect(issueKind(issue("[PRD-alpha] Remove old fallback", ["level: wave"]), PRDS)).toEqual({
      kind: "tracking",
      level: "wave",
      prd: "alpha",
      wave: null,
    });
    expect(issueKind(issue("[PRD-alpha] Old name", ["type: prd"]), PRDS).kind).toBe("tracking");
    // A container label without the prefix is not enough.
    expect(issueKind(issue("Alpha widgets", ["level: prd"]), PRDS).kind).toBe("standalone");
  });

  // MU-6
  it("everything else is standalone", () => {
    expect(issueKind(issue("fix: crash", ["phase: 1"], "Follow-up to #10"), PRDS).kind).toBe(
      "standalone",
    );
  });
});

describe("type suggestions (D-85, D-100, A-69, A-70)", () => {
  // MU-10, MU-11, RT-15: the enumerated table.
  it.each([
    ["fix: x", "bug"],
    ["fix(api): x", "bug"],
    ["fix!: x", "bug"],
    ["Fix: x", "bug"],
    ["feat: x", "enhancement"],
    ["feat(test): x", "enhancement"],
    ["test: x", "test"],
    ["docs: x", "docs"],
    ["refactor: x", "refactor"],
    ["chore: x", "chore"],
    ["ci: x", "chore"],
    ["build: x", "chore"],
    ["[chore] bump", "chore"],
    ["[docs] readme", "docs"],
    ["[PRD-alpha] fix: crash", "bug"],
    ["perf: x", null],
    ["style: x", null],
    ["revert: x", null],
    ["Story S-001: x", null],
    ["no prefix at all", null],
  ])("%s suggests %s", (title, expected) => {
    expect(suggestType(title, [])).toBe(expected);
  });

  it("two valid types suggest the tie-break winner among them (A-69)", () => {
    expect(suggestType("fix: x", ["type: bug", "type: security"])).toBe("security");
    expect(suggestType("feat: x", ["type: docs", "type: test"])).toBe("test");
  });

  it("a default unprefixed label suggests its type; `story` suggests none (D-100)", () => {
    expect(suggestType("Update the README", ["documentation"])).toBe("docs");
    expect(suggestType("Something", ["bug"])).toBe("bug");
    expect(suggestType("Something", ["enhancement"])).toBe("enhancement");
    expect(suggestType("Something", ["chore"])).toBe("chore");
    expect(suggestType("Something", ["story"])).toBeNull();
    // The title prefix is tried before the default label.
    expect(suggestType("docs: x", ["bug"])).toBe("docs");
  });
});

describe("classifySnapshot on the survey fixture", () => {
  it("classifies every open issue exactly once and skips pull requests", async () => {
    const c = classifySnapshot(await snapshotOf(loadModel("survey")));
    const kinds = Object.fromEntries(c.issues.map((i) => [i.number, i.kind.kind]));
    expect(kinds).toEqual({
      1: "tracking",
      2: "tracking",
      10: "story",
      11: "story",
      12: "story",
      13: "story",
      14: "standalone",
      20: "standalone",
      21: "standalone",
      22: "standalone",
      23: "standalone",
      24: "standalone",
      25: "standalone",
    });
  });

  // MU-7 to MU-9, A-68: zero, two, retired-only; tracking issues exempt.
  it("lists zero- and multi-type issues under needs a type with suggestions", async () => {
    const c = classifySnapshot(await snapshotOf(loadModel("survey")));
    expect(c.needsType.map((n) => [n.issue, n.currentTypeLabels, n.suggested])).toEqual([
      [12, ["type: bug", "type: enhancement"], "bug"],
      [13, [], "enhancement"],
      [20, [], "bug"],
      [21, ["type: other"], "enhancement"],
      [23, [], "docs"],
      [25, [], null],
    ]);
    // #1 carries only `type: prd` and #2 nothing, but both are tracking issues.
    expect(c.needsType.map((n) => n.issue)).not.toContain(1);
    expect(c.needsType.map((n) => n.issue)).not.toContain(2);
  });

  it("a `level: prd` or `level: wave` issue is exempt even when not prefixed", async () => {
    const model = cloneModel(loadModel("survey"));
    model.issues.find((i) => i.number === 25)!.labels.push("level: wave");
    const c = classifySnapshot(await snapshotOf(model));
    expect(c.needsType.map((n) => n.issue)).not.toContain(25);
  });

  // MU-12 to MU-16, A-72
  it("lists `priority: critical` issues with no blocking relation, never inventing one", async () => {
    const c = classifySnapshot(await snapshotOf(loadModel("survey")));
    // #20 has a **Blocks:** line but no relation: still listed (A-72).
    // #21 blocks #11: not listed. #22 has no relation: listed.
    expect(c.needsBlockingLink).toEqual([
      {
        issue: 20,
        title: "fix: widget crash on empty list",
        priority: "priority: critical",
        answer: "",
      },
      { issue: 22, title: "[chore] bump dependencies", priority: "priority: critical", answer: "" },
    ]);
  });

  it("a `priority: high` issue is never on the blocking-link list (MU-15)", async () => {
    const model = cloneModel(loadModel("survey"));
    const i22 = model.issues.find((i) => i.number === 22)!;
    i22.labels = i22.labels.filter((l) => l !== "priority: critical");
    const c = classifySnapshot(await snapshotOf(model));
    expect(c.needsBlockingLink.map((n) => n.issue)).toEqual([20]);
  });

  // D-89, A-83: active state files without the line are listed; archived ones never.
  it("lists active planner state files without a `Wave issue:` line", async () => {
    const c = classifySnapshot(await snapshotOf(loadModel("survey")));
    expect(c.stateFiles.map((s) => s.file)).toEqual(["workstream/planner-state-alpha-phase-2.md"]);
  });

  // A-76, EC-115: a story parented to a non-tracking issue, and two priorities.
  it("records information notes, never a write", async () => {
    const c = classifySnapshot(await snapshotOf(loadModel("survey")));
    expect(c.information.map((n) => n.ref)).toEqual(["#13", "#22"]);
    expect(c.information[0].note).toMatch(/parent #24 is not a tracking issue/);
    expect(c.information[1].note).toMatch(/several `priority:` labels/);
  });

  // S-014 AC-2 (S-013 audit F-3): no roadmap note any more; the read refuses.
  it("a roadmap without the canonical table is refused before classification (D-86)", async () => {
    const model = cloneModel(loadModel("survey"));
    model.files["docs/roadmap.md"] = "# Roadmap\n\nWave 1 shipped; wave 2 is next.\n";
    await expect(snapshotOf(model)).rejects.toMatchObject({
      kind: "roadmap",
      message: expect.stringMatching(/no canonical table.*product-engineer's roadmap conversion/),
    });
  });

  it("a missing roadmap is refused the same way (D-86)", async () => {
    const model = cloneModel(loadModel("survey"));
    delete model.files["docs/roadmap.md"];
    await expect(snapshotOf(model)).rejects.toMatchObject({
      kind: "roadmap",
      message: expect.stringMatching(/^docs\/roadmap\.md is missing; .*product-engineer/),
    });
  });

  it("an incomplete closed-issue search is an Information note", async () => {
    const model = loadModel("survey");
    const snapshot = await readSnapshot({
      runner: recordingRunner(model, { searchIncomplete: true }).runner,
      reader: modelReader(model),
    });
    const note = classifySnapshot(snapshot).information.find((n) => n.ref === "search");
    expect(note?.note).toMatch(/1,000-result window/);
  });

  it("the canonical roadmap gives no roadmap note", async () => {
    const c = classifySnapshot(await snapshotOf(loadModel("survey")));
    expect(c.roadmap).toEqual([]);
  });
});

// RT-13: every issue gets exactly one classification, whatever its shape.
describe("RT-13 every issue classified exactly once, story first", () => {
  const seed = seedFromEnv(13013);
  it(`random open issues (seed ${seed})`, async () => {
    const r = prng(seed);
    const titles = [
      "Story S-7: a",
      "[PRD-alpha] Story S-9: b",
      "[PRD-alpha] Alpha widgets",
      "[PRD-alpha] Wave 2: c",
      "[PRD-beta] Wave x: d",
      "[PRD-alpha] other",
      "fix: e",
      "plain",
      "[chore] f",
    ];
    const labelPool = [
      "level: prd",
      "level: wave",
      "type: prd",
      "type: wave",
      "type: bug",
      "phase: 1",
      "bug",
    ];
    const bodies = [
      "",
      "**Story:** workstream/user-stories-alpha-phase-1.md",
      "x\r\ny",
      "> **Story:** q",
    ];
    for (let iter = 0; iter < 300; iter++) {
      const model = cloneModel(loadModel("empty"));
      const n = r.int(0, 25);
      for (let k = 1; k <= n; k++) {
        model.issues.push({
          id: 1000 + k,
          number: k,
          state: "open",
          title: r.pick(titles),
          body: r.pick(bodies),
          labels: labelPool.filter(() => r.bool(0.25)),
          milestone: null,
          parent: null,
          blocking: [],
        });
      }
      const c = classifySnapshot(await snapshotOf(model));
      const numbers = c.issues.map((i) => i.number);
      expect(numbers, `seed ${seed} iter ${iter}`).toEqual(model.issues.map((i) => i.number));
      // An independent oracle for which kind wins: story first, then tracking (A-53).
      for (const i of c.issues) {
        const src = model.issues.find((m) => m.number === i.number)!;
        const story = /\bStory S-\d+\b/.test(src.title) || src.body === bodies[1];
        const container = ["level: prd", "level: wave", "type: prd", "type: wave"].some((l) =>
          src.labels.includes(l),
        );
        const tracking =
          /^\[PRD-[^\]\s]+\] Wave [^\s:]+:/.test(src.title) ||
          src.title === "[PRD-alpha] Alpha widgets" ||
          (src.title.startsWith("[PRD-") && container);
        const expected = story ? "story" : tracking ? "tracking" : "standalone";
        expect(
          i.kind.kind,
          `seed ${seed} iter ${iter} #${i.number} ${src.title} ${JSON.stringify(src.labels)} ${JSON.stringify(src.body)}`,
        ).toBe(expected);
      }
    }
  });
});
