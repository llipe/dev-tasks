/**
 * S-013 AC-6, AC-7: `--plan` makes zero write calls and the plan file never
 * carries an issue body (FR-17, D-90, spec §12). MU-31, MU-32, EC-104,
 * EC-118, RT-10.
 */
import { describe, it, expect } from "vitest";
import {
  runMigrationPlan,
  formatMigrationPlanSummary,
  migrationPlanJson,
  type PlanFileStore,
} from "#core/migrate-projects/index.js";
import {
  emptyMigrationPlanBatches,
  parseMigrationPlan,
  renderMigrationPlan,
} from "#core/migrate-projects/planfile.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { isWrite } from "./helpers/is-write.js";
import { modelReader, recordingRunner } from "./helpers/recording-runner.js";
import { prng, seedFromEnv } from "./helpers/prng.js";

const NOW = () => new Date("2026-10-24T12:00:00Z");

function memoryStore(
  initial: Record<string, string> = {},
): PlanFileStore & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    read: (p) => (Object.hasOwn(files, p) ? files[p] : undefined),
    write: (p, c) => {
      files[p] = c;
    },
  };
}

async function plan(model: RepoModel) {
  const rec = recordingRunner(model);
  const store = memoryStore();
  const result = await runMigrationPlan({
    runner: rec.runner,
    reader: modelReader(model),
    out: "workstream/migration-projects.md",
    now: NOW,
    store,
  });
  return { result, calls: rec.calls, store };
}

describe("--plan is read-only (AC-6, MU-31)", () => {
  it.each(["survey", "empty"])(
    "%s: every gh call is a read by the independent oracle",
    async (name) => {
      const { result, calls } = await plan(loadModel(name));
      expect(result.exitCode).toBe(0);
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) expect(isWrite(c), c.join(" ")).toBe(false);
    },
  );

  it("the oracle itself flags the writes S-015 will make", () => {
    for (const w of [
      ["label", "create", "level: story"],
      ["issue", "edit", "12", "--add-label=level: story"],
      ["api", "-X", "POST", "repos/o/r/issues/1/sub_issues", "-F", "sub_issue_id=9"],
      ["api", "repos/o/r/issues/1/sub_issues", "-F", "sub_issue_id=9"],
      ["api", "--method=PATCH", "repos/o/r/issues/comments/1"],
      ["project", "item-list", "1"],
    ]) {
      expect(isWrite(w), w.join(" ")).toBe(true);
    }
    expect(isWrite(["api", "-X", "GET", "repos/o/r/labels"])).toBe(false);
  });

  // EC-104
  it("zero open issues: exit 0, empty review lists but the A-83 PRD question", async () => {
    const { result, store } = await plan(loadModel("empty"));
    expect(result.exitCode).toBe(0);
    const parsed = parseMigrationPlan(store.files["workstream/migration-projects.md"]).plan;
    const { information, ...lists } = parsed.review;
    expect(Object.values(lists).every((list) => list.length === 0)).toBe(true);
    // S-014: a PRD file with no mapped story is asked about, never created unasked.
    expect(information.map((i) => i.ref)).toEqual(["[PRD-alpha]"]);
  });

  it("writes the plan file only, with `Approved: no` and the injected clock", async () => {
    const { store, result } = await plan(loadModel("survey"));
    expect(Object.keys(store.files)).toEqual(["workstream/migration-projects.md"]);
    const text = store.files["workstream/migration-projects.md"];
    expect(text).toContain("Approved: no");
    expect(text).toContain("Generated: 2026-10-24T12:00:00Z");
    expect(result.summary!.next).toBe("review the plan");
  });
});

describe("no issue bodies anywhere (AC-7, MU-32, EC-118)", () => {
  it("no sentinel or body phrase in the plan file, the summary or --json", async () => {
    const model = cloneModel(loadModel("survey"));
    model.issues[3].body += "\nghp_FAKEtoken1234567890abcdefABCDEF";
    const { result, store } = await plan(model);
    const outputs = [
      store.files["workstream/migration-projects.md"],
      formatMigrationPlanSummary(result),
      JSON.stringify(migrationPlanJson(result)),
    ];
    for (const out of outputs) {
      expect(out).not.toMatch(/BODY-SENTINEL-\d+/);
      expect(out).not.toContain("zebra-quartz");
      expect(out).not.toContain("ghp_FAKEtoken");
      expect(out).not.toContain("Follow-up to #10");
    }
    // Titles and label names are there.
    expect(outputs[0]).toContain("fix: widget crash on empty list");
    expect(outputs[0]).toContain("`type: other`");
  });
});

describe("refuses to overwrite an applied record (A-65, EC-116)", () => {
  it("exit 14 and the file untouched when a row is not pending", async () => {
    const model = loadModel("survey");
    const batches = emptyMigrationPlanBatches();
    batches[0].writes.push({
      id: "W-001",
      action: "create-label",
      target: "label:level: story",
      detail: "",
      dependsOn: [],
      state: "done",
    });
    const applied = renderMigrationPlan({
      repo: "acme/widgets",
      generated: "2026-10-23T00:00:00Z",
      snapshot: "a".repeat(64),
      approved: true,
      extraHeaders: [],
      review: {
        unmapped: [],
        needsType: [],
        needsBlockingLink: [],
        stateFiles: [],
        roadmap: [],
        information: [],
      },
      batches,
    });
    const store = memoryStore({ "workstream/migration-projects.md": applied });
    const rec = recordingRunner(model);
    const result = await runMigrationPlan({
      runner: rec.runner,
      reader: modelReader(model),
      out: "workstream/migration-projects.md",
      now: NOW,
      store,
    });
    expect(result.exitCode).toBe(14);
    expect(result.error).toMatch(/--out/);
    expect(store.files["workstream/migration-projects.md"]).toBe(applied);
  });

  it("exit 14 for an existing file that is not a migration plan", async () => {
    const model = loadModel("survey");
    const store = memoryStore({ "workstream/migration-projects.md": "# My notes\n" });
    const result = await runMigrationPlan({
      runner: recordingRunner(model).runner,
      reader: modelReader(model),
      out: "workstream/migration-projects.md",
      now: NOW,
      store,
    });
    expect(result.exitCode).toBe(14);
    expect(store.files["workstream/migration-projects.md"]).toBe("# My notes\n");
  });

  it("overwrites an all-pending plan", async () => {
    const model = loadModel("survey");
    const first = await plan(model);
    const store = memoryStore({ ...first.store.files });
    const result = await runMigrationPlan({
      runner: recordingRunner(model).runner,
      reader: modelReader(model),
      out: "workstream/migration-projects.md",
      now: () => new Date("2026-10-25T00:00:00Z"),
      store,
    });
    expect(result.exitCode).toBe(0);
    expect(store.files["workstream/migration-projects.md"]).toContain(
      "Generated: 2026-10-25T00:00:00Z",
    );
  });

  // EC-134: unchanged repository, same plan except Generated.
  it("two plans of an unchanged repository differ only in Generated", async () => {
    const model = loadModel("survey");
    const a = (await plan(model)).store.files["workstream/migration-projects.md"];
    const store = memoryStore();
    await runMigrationPlan({
      runner: recordingRunner(model).runner,
      reader: modelReader(model),
      out: "p.md",
      now: () => new Date("2026-10-25T00:00:00Z"),
      store,
    });
    expect(store.files["p.md"].replace(/^Generated: .*$/m, "")).toBe(
      a.replace(/^Generated: .*$/m, ""),
    );
  });
});

describe("precondition exits", () => {
  it("auth failure: exit 11, the hint, one call, no file", async () => {
    const model = loadModel("survey");
    const rec = recordingRunner(model, { authFails: true });
    const store = memoryStore();
    const result = await runMigrationPlan({
      runner: rec.runner,
      reader: modelReader(model),
      out: "x.md",
      now: NOW,
      store,
    });
    expect(result.exitCode).toBe(11);
    expect(result.error).toContain("gh auth login");
    expect(rec.calls).toHaveLength(1);
    expect(store.files).toEqual({});
  });

  it("--repo naming another repository: exit 2, no file", async () => {
    const model = loadModel("survey");
    const store = memoryStore();
    const result = await runMigrationPlan({
      runner: recordingRunner(model).runner,
      reader: modelReader(model),
      repo: "other/repo",
      out: "x.md",
      now: NOW,
      store,
    });
    expect(result.exitCode).toBe(2);
    expect(store.files).toEqual({});
  });

  it("a failing read: exit 1, no file", async () => {
    const model = loadModel("survey");
    const rec = recordingRunner(model);
    const store = memoryStore();
    const runner: typeof rec.runner = async (args) =>
      args.join(" ").includes("/labels")
        ? { stdout: "", stderr: "gh: boom (HTTP 502)", exitCode: 1 }
        : rec.runner(args);
    const result = await runMigrationPlan({
      runner,
      reader: modelReader(model),
      out: "x.md",
      now: NOW,
      store,
    });
    expect(result.exitCode).toBe(1);
    expect(store.files).toEqual({});
  });
});

// RT-10: random snapshots, zero writes, seeded.
describe("RT-10 --plan never issues a write", () => {
  const seed = seedFromEnv(10010);
  it(`random repositories (seed ${seed})`, async () => {
    const r = prng(seed);
    const titles = [
      "Story S-1: a",
      "[PRD-alpha] Wave 2: b",
      "[PRD-alpha] Alpha widgets",
      "fix: c",
      "feat(x): d",
      "[chore] e",
      "plain",
    ];
    const labels = [
      "level: prd",
      "level: wave",
      "type: prd",
      "type: bug",
      "type: other",
      "priority: critical",
      "phase: 1",
      "status: ready",
      "bug",
    ];
    for (let iter = 0; iter < 300; iter++) {
      const model = cloneModel(loadModel("survey"));
      model.issues = [];
      const n = r.int(0, 20);
      for (let k = 1; k <= n; k++) {
        model.issues.push({
          id: 5000 + k,
          number: k,
          state: r.bool(0.8) ? "open" : "closed",
          title: r.pick(titles),
          body: r.bool()
            ? "**Story:** workstream/user-stories-alpha-phase-2.md"
            : "BODY-SENTINEL-x",
          labels: labels.filter(() => r.bool(0.2)),
          milestone: r.bool() ? "Alpha" : null,
          parent: k > 1 && r.bool(0.3) ? r.int(1, k - 1) : null,
          blocking: k > 1 && r.bool(0.3) ? [r.int(1, k - 1)] : [],
        });
      }
      const { result, calls, store } = await plan(model);
      const ctx = `seed ${seed} iter ${iter}`;
      expect(result.exitCode, ctx).toBe(0);
      for (const c of calls) expect(isWrite(c), `${ctx}: ${c.join(" ")}`).toBe(false);
      expect(store.files["workstream/migration-projects.md"], ctx).not.toContain("BODY-SENTINEL");
    }
  });
});
