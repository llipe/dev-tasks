/**
 * S-014 AC-6 (task 4.7, S-013 audit F-1): `--plan` reads the previous plan
 * file's answers, applies them before batching, and resets `Approved: no`
 * (A-50). Unmapped → wave id or "standalone"; needs a type → type; needs a
 * blocking link → "#issue" or "lower priority to high" (A-73, batch 4b).
 * MU-55 to MU-58, E2E-25, EC-134 to EC-137, CT-26.
 */
import { describe, it, expect } from "vitest";
import {
  parseBlockingAnswer,
  parseTypeAnswer,
  parseUnmappedAnswer,
  readAnswers,
} from "#core/migrate-projects/answers.js";
import { parseRoadmapTable } from "#core/checks/roadmap.js";
import {
  emptyMigrationPlanBatches,
  parseMigrationPlan,
  renderMigrationPlan,
  type MigrationPlan,
} from "#core/migrate-projects/planfile.js";
import { runMigrationPlan } from "#core/migrate-projects/index.js";
import { cloneModel, loadModel } from "./helpers/fake-github.js";
import { memoryStore, NOW, PLAN_PATH, planModel, triple } from "./helpers/plan-run.js";
import { modelReader, recordingRunner } from "./helpers/recording-runner.js";

/** Fill answers into a rendered plan, the way github-ops or the owner would. */
function answer(
  text: string,
  edit: (p: MigrationPlan) => void,
  opts: { approve?: boolean } = {},
): string {
  const p = parseMigrationPlan(text).plan;
  edit(p);
  if (opts.approve === true) p.approved = true;
  return renderMigrationPlan(p);
}

const setAnswer = (list: Array<{ issue: number; answer: string }>, n: number, a: string) => {
  const row = list.find((r) => r.issue === n);
  if (row === undefined) throw new Error(`no review row for #${n}`);
  row.answer = a;
};

describe("answer grammar (CT-26, EC-135)", () => {
  const rows = (() => {
    const r = parseRoadmapTable(
      "| PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing |\n| --- | --- | --- | --- | --- | --- |\n| [alpha](x) | 2 | s | Done | — | — |\n| [beta](y) | All | s | Done | — | — |\n",
    );
    if (!r.ok) throw new Error(r.reason);
    return r.rows;
  })();

  it("unmapped: a roadmap wave id exactly, or standalone in any case", () => {
    expect(parseUnmappedAnswer("alpha 2", rows)).toMatchObject({ kind: "wave", row: { prd: "alpha", phase: "2" } });
    expect(parseUnmappedAnswer("beta All", rows)).toMatchObject({ kind: "wave", row: { prd: "beta" } });
    for (const s of ["standalone", "Standalone", "STANDALONE"]) {
      expect(parseUnmappedAnswer(s, rows)).toEqual({ kind: "standalone" });
    }
    for (const bad of ["alpha  2", "alpha 02", "alpha", "2", "gamma 1", "stand alone"]) {
      expect(parseUnmappedAnswer(bad, rows), bad).toEqual({ kind: "invalid", text: bad });
    }
    expect(parseUnmappedAnswer("", rows)).toEqual({ kind: "none" });
  });

  it("type: one of the eight, with or without the `type: ` prefix", () => {
    expect(parseTypeAnswer("bug")).toBe("bug");
    expect(parseTypeAnswer("type: tech-debt")).toBe("tech-debt");
    expect(parseTypeAnswer("Bug")).toBe("bug");
    expect(parseTypeAnswer("other")).toBe("invalid");
    expect(parseTypeAnswer("type: prd")).toBe("invalid");
    expect(parseTypeAnswer("")).toBeNull();
  });

  it("blocking link: `#N` or the literal phrase", () => {
    expect(parseBlockingAnswer("#17")).toEqual({ kind: "blocks", issue: 17 });
    expect(parseBlockingAnswer("lower priority to high")).toEqual({ kind: "lower" });
    expect(parseBlockingAnswer("Lower priority to high")).toEqual({ kind: "lower" });
    expect(parseBlockingAnswer("17")).toEqual({ kind: "invalid", text: "17" });
    expect(parseBlockingAnswer("")).toEqual({ kind: "none" });
  });

  it("readAnswers keys review answers by issue and information answers by ref and note", () => {
    const p = parseMigrationPlan(renderMigrationPlan({
      repo: "o/r",
      generated: "2026-10-24T00:00:00Z",
      snapshot: "a".repeat(64),
      approved: false,
      extraHeaders: [],
      review: {
        unmapped: [{ issue: 3, title: "t", why: "w", answer: "alpha 2" }],
        needsType: [{ issue: 4, title: "t", currentTypeLabels: [], suggested: null, answer: "bug" }],
        needsBlockingLink: [{ issue: 5, title: "t", priority: "priority: critical", answer: "#3" }],
        stateFiles: [],
        roadmap: [],
        information: [{ ref: "[PRD-beta]", note: "n", answer: "yes" }, { ref: "#9", note: "m", answer: "" }],
      },
      batches: emptyMigrationPlanBatches(),
    })).plan;
    const a = readAnswers(p);
    expect(a.unmapped.get(3)).toBe("alpha 2");
    expect(a.needsType.get(4)).toBe("bug");
    expect(a.needsBlockingLink.get(5)).toBe("#3");
    expect(a.information.get("[PRD-beta]\u0000n")).toBe("yes");
    expect(a.information.has("#9\u0000m")).toBe(false);
  });
});

describe("answers carried into the next --plan (AC-6)", () => {
  // MU-55, E2E-25
  it("an unmapped story answered with a wave id is mapped, linked and labelled; Approved resets", async () => {
    const model = cloneModel(loadModel("ac11"));
    const first = await planModel(model);
    const prev = answer(
      first.text,
      (p) => {
        setAnswer(p.review.unmapped, 15, "alpha 2");
        setAnswer(p.review.needsType, 21, "type: bug");
      },
      { approve: true },
    );
    expect(prev).toContain("Approved: yes");
    const second = await planModel(model, { previous: prev });
    expect(second.text).toContain("Approved: no");
    expect(second.plan.approved).toBe(false);
    const wave = second.batch("2").writes.find((w) => w.detail.includes("Wave 2"))!;
    expect(second.batch("3").writes.map(triple)).toContainEqual(["link-sub-issue", wave.id, "sub-issue #15"]);
    expect(second.batch("4").writes.map(triple)).toContainEqual(["add-label", "#15", "level: story"]);
    // The answered row stays, with its answer, so a third --plan reads it again (EC-134).
    expect(second.plan.review.unmapped.find((u) => u.issue === 15)?.answer).toBe("alpha 2");
    const third = await planModel(model, { previous: second.text });
    expect(third.text).toBe(second.text);
  });

  it("an unmapped story answered `standalone` gets no `level:` and no link", async () => {
    const model = cloneModel(loadModel("ac11"));
    const first = await planModel(model);
    const second = await planModel(model, {
      previous: answer(first.text, (p) => setAnswer(p.review.unmapped, 15, "Standalone")),
    });
    const targets = second.writes().filter((w) => w.action !== "remove-label").map((w) => w.target + " " + w.detail);
    expect(targets.join("\n")).not.toMatch(/#15/);
    expect(second.plan.review.unmapped.find((u) => u.issue === 15)?.answer).toBe("Standalone");
  });

  // MU-56
  it("a type answer adds the type and removes every other `type:` label", async () => {
    const model = cloneModel(loadModel("ac11"));
    const first = await planModel(model);
    const second = await planModel(model, {
      previous: answer(first.text, (p) => {
        setAnswer(p.review.needsType, 22, "chore");
        setAnswer(p.review.needsType, 21, "bug");
      }),
    });
    const rows = second.batch("4").writes.map(triple);
    expect(rows).toContainEqual(["remove-label", "#22", "type: docs"]);
    expect(rows).not.toContainEqual(["add-label", "#22", "type: chore"]);
    expect(rows).toContainEqual(["add-label", "#21", "type: bug"]);
  });

  // MU-58
  it("an invalid answer stays listed with `invalid answer` and produces no write", async () => {
    const model = cloneModel(loadModel("ac11"));
    const first = await planModel(model);
    const second = await planModel(model, {
      previous: answer(first.text, (p) => {
        setAnswer(p.review.unmapped, 15, "alpha 9");
        setAnswer(p.review.needsType, 21, "other");
      }),
    });
    const u = second.plan.review.unmapped.find((x) => x.issue === 15)!;
    expect(u.why).toMatch(/^invalid answer "alpha 9"/);
    expect(u.answer).toBe("");
    expect(second.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "#21", note: expect.stringMatching(/^invalid answer "other"/) }),
    );
    expect(second.writes().some((w) => w.target === "#15" || (w.target === "#21" && w.action === "add-label"))).toBe(false);
  });

  // MU-57, EC-136
  it("an answer for an issue no longer open is dropped and reported", async () => {
    const model = cloneModel(loadModel("ac11"));
    const first = await planModel(model);
    const prev = answer(first.text, (p) => setAnswer(p.review.needsType, 21, "bug"));
    model.issues.find((i) => i.number === 21)!.state = "closed";
    const second = await planModel(model, { previous: prev });
    expect(second.plan.review.needsType.map((n) => n.issue)).not.toContain(21);
    expect(second.plan.review.information).toContainEqual({
      ref: "#21",
      note: "answer `bug` dropped: the issue is no longer open or no longer needs it",
      answer: "",
    });
  });

  // A-73, EC-137: blocking-link answers write batch 4b.
  it("blocking-link answers: `#N` adds the relation, the phrase relabels to high", async () => {
    const model = cloneModel(loadModel("ac11"));
    model.issues.push(
      { id: 70030, number: 30, state: "open", title: "[bug] a", body: "x", labels: ["type: bug", "priority: critical"], milestone: null, parent: null, blocking: [] },
      { id: 70031, number: 31, state: "open", title: "[bug] b", body: "x", labels: ["type: bug", "priority: critical"], milestone: null, parent: null, blocking: [] },
    );
    const first = await planModel(model);
    expect(first.plan.review.needsBlockingLink.map((n) => n.issue)).toEqual([30, 31]);
    const second = await planModel(model, {
      previous: answer(first.text, (p) => {
        setAnswer(p.review.needsBlockingLink, 30, "#1");
        setAnswer(p.review.needsBlockingLink, 31, "lower priority to high");
      }),
    });
    const rows = second.batch("4b").writes;
    expect(rows.map(triple)).toEqual([
      ["add-blocked-by", "#1", "blocked by #30"],
      ["add-label", "#31", "priority: high"],
      ["remove-label", "#31", "priority: critical"],
    ]);
  });

  it("a blocking answer naming an issue that is not open is invalid", async () => {
    const model = cloneModel(loadModel("ac11"));
    model.issues.push({ id: 70030, number: 30, state: "open", title: "[bug] a", body: "x", labels: ["type: bug", "priority: critical"], milestone: null, parent: null, blocking: [] });
    const first = await planModel(model);
    const second = await planModel(model, {
      previous: answer(first.text, (p) => setAnswer(p.review.needsBlockingLink, 30, "#999")),
    });
    expect(second.batch("4b").writes).toEqual([]);
    expect(second.plan.review.needsBlockingLink[0].answer).toBe("");
    expect(second.plan.review.information).toContainEqual(
      expect.objectContaining({ ref: "#30", note: expect.stringMatching(/^invalid answer "#999"/) }),
    );
  });

  it("a `yes` on the Information question creates the PRD issue (A-83)", async () => {
    const model = cloneModel(loadModel("ac11"));
    model.files["docs/requirements/prd-beta.md"] = "# PRD: beta — Beta gizmos\n";
    model.files["docs/roadmap.md"] += "| [beta](requirements/prd-beta.md) | 1 | Beta | Not started | — | — |\n";
    const first = await planModel(model);
    const q = first.plan.review.information.find((i) => i.ref === "[PRD-beta]");
    expect(q).toBeDefined();
    const second = await planModel(model, {
      previous: answer(first.text, (p) => {
        p.review.information.find((i) => i.ref === "[PRD-beta]")!.answer = "yes";
      }),
    });
    expect(second.batch("2").writes.map((w) => w.detail)).toContain(
      "template: prd; label: level: prd; title: [PRD-beta] Beta gizmos",
    );
  });

  // A-65 still holds: a record is never overwritten, answers or not.
  it("refuses with exit 14 when the previous plan has a row that is not pending", async () => {
    const model = cloneModel(loadModel("ac11"));
    const first = await planModel(model);
    const p = parseMigrationPlan(first.text).plan;
    p.batches[0].writes[0].state = "done";
    const store = memoryStore({ [PLAN_PATH]: renderMigrationPlan(p) });
    const result = await runMigrationPlan({
      runner: recordingRunner(model).runner,
      reader: modelReader(model),
      out: PLAN_PATH,
      now: NOW,
      store,
    });
    expect(result.exitCode).toBe(14);
  });

  it("answers from a plan for another repository are not read", async () => {
    const model = cloneModel(loadModel("ac11"));
    const first = await planModel(model);
    const prev = answer(first.text, (p) => {
      p.repo = "acme/other";
      setAnswer(p.review.unmapped, 15, "alpha 2");
    });
    const second = await planModel(model, { previous: prev });
    expect(second.plan.review.unmapped.find((u) => u.issue === 15)?.answer).toBe("");
  });

  it("the instruction line says what --plan does with the answers", async () => {
    const run = await planModel(loadModel("ac11"));
    expect(run.text).toContain(
      "Answer in the Answer column, then run `dev-tasks migrate projects --plan` again: it reads your answers, rebuilds the batches from them and resets `Approved: no`, so you approve the rebuilt plan.",
    );
  });
});
