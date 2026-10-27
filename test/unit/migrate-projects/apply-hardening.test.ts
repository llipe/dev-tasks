/**
 * S-015 hardening after the qa-engineer pass on PR #330 (tasks 5.18 to
 * 5.22, 5.24): the safety properties its surviving mutants named. A
 * hand-edited `done(#N)` never redirects a write (D15); a target that
 * changed between runs is refused, never overwritten (R2c, D3b, D5, D9b,
 * D11, D13, D13b); a lost write-back is detected for every action (D3, D6,
 * D9); body files and the run's temp dir are removed as they go (BD1,
 * BD3); the in-memory state is reset after a failed write-back (S2); the
 * plan file changing after the lock is taken is refused (G7); the comma
 * guard (C1).
 */
import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runMigrationApply } from "#core/migrate-projects/index.js";
import {
  computePlanDigest,
  parseMigrationPlan,
  renderMigrationPlan,
} from "#core/migrate-projects/planfile.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { applyRunner } from "./helpers/fake-github-writes.js";
import { applyModel, approve, memoryLock } from "./helpers/apply-run.js";
import { memoryStore, planModel, PLAN_PATH } from "./helpers/plan-run.js";
import { modelReader } from "./helpers/recording-runner.js";

const MARKER = "<!-- dev-tasks:status -->";

async function fresh(name = "ac11", edit: (m: RepoModel) => void = () => {}) {
  const model = cloneModel(loadModel(name));
  edit(model);
  const p = await planModel(model);
  return { model, approved: approve(p.text) };
}

/** Set one row's State by ID, as a hand edit of the record would. */
function setState(text: string, id: string, state: string): string {
  return text
    .split("\n")
    .map((l) => (l.startsWith(`| ${id} |`) ? l.replace(/\| [^|]*\|$/, `| ${state} |`) : l))
    .join("\n");
}

function failingStore(initial: string, failOn: number) {
  const store = memoryStore({ [PLAN_PATH]: initial });
  const write = store.write;
  let n = 0;
  store.write = (p, c) => {
    if (++n === failOn) throw new Error("ENOSPC: no space left on device");
    write(p, c);
  };
  return store;
}

const throwOn = (match: (argv: readonly string[]) => boolean) => ({
  onWrite: (argv: readonly string[]) => (match(argv) ? ("throw" as const) : undefined),
});

/** The survey fixture with one blocking-link answer, re-planned, approved: it has a 4b row. */
async function withBlockedBy() {
  const model = cloneModel(loadModel("survey"));
  const first = await planModel(model);
  const draft = parseMigrationPlan(first.text).plan;
  const item = draft.review.needsBlockingLink[0];
  const other = model.issues.find((i) => i.state === "open" && i.number !== item.issue)!;
  item.answer = `#${other.number}`;
  const second = await planModel(model, { previous: renderMigrationPlan(draft) });
  const approved = approve(second.text);
  const rows = parseMigrationPlan(approved).plan.batches.flatMap((b) => b.writes);
  const index = rows.findIndex((w) => w.action === "add-blocked-by");
  expect(index).toBeGreaterThan(-1);
  return {
    model,
    approved,
    row: rows[index],
    index: index + 1,
    blocked: other.number,
    blocker: item.issue,
  };
}

describe("a hand-edited done(#N) never redirects a write (5.18, D15, D15b)", () => {
  it.each([
    ["another issue's number", "done(#20)"],
    ["a number that is no open issue", "done(#999)"],
    ["a found-by-title record of another issue", "skipped(already applied, #1)"],
  ])(
    "%s: the dependants are `failed(target changed)`, nothing written against it",
    async (_, forged) => {
      const { model, approved } = await fresh();
      const first = await applyModel(model, approved, {
        runner: throwOn((a) => a[0] === "issue" && a[1] === "create"),
      });
      expect(first.states()["W-017"]).toBe("pending");
      // The create never ran, yet the record claims an issue: a forged record.
      const second = await applyModel(model, setState(first.text, "W-017", forged));
      for (const id of ["W-018", "W-019", "W-020", "W-021", "W-022", "W-032"])
        expect(second.states()[id], id).toBe("failed(target changed)");
      for (const argv of second.writes()) {
        expect(argv.join(" "), argv.join(" ")).not.toMatch(
          /issues\/(20|999|1)\/sub_issues|issue comment 1 /,
        );
      }
      expect(model.issues.filter((i) => i.parent !== null)).toEqual([]);
    },
  );
});

describe("targets that change between runs (5.20)", () => {
  it("R2c: a `skipped(already applied)` or `done` row is never re-run, whatever its target becomes", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved);
    expect(first.result.exitCode).toBe(0);
    // A label pre-existing as desired: a second, edited copy where W-002's row reads skipped.
    const recorded = setState(first.text, "W-002", "skipped(already applied)");
    model.labels = model.labels.filter(
      (l) => l.name !== "level: wave" && l.name !== "level: story",
    );
    model.issues.find((i) => i.number === 10)!.labels = [];
    model.issues.find((i) => i.number === 10)!.parent = null;
    const second = await applyModel(model, recorded);
    expect(second.writes()).toEqual([]);
    expect(second.states()["W-002"]).toBe("skipped(already applied)");
    expect(second.states()["W-003"]).toBe("done");
    expect(second.states()["W-019"]).toBe("done");
  });

  it("D3b: edit-label on a label deleted since is `failed(target changed)`", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === 8 ? "throw" : undefined) },
    });
    expect(first.states()["W-008"]).toBe("pending");
    model.labels = model.labels.filter((l) => l.name !== "type: bug");
    const second = await applyModel(model, first.text);
    expect(second.states()["W-008"]).toBe("failed(target changed)");
    expect(second.writes().some((a) => a[1] === "edit" && a.at(-1) === "type: bug")).toBe(false);
    expect(model.labels.some((l) => l.name === "type: bug")).toBe(false);
  });

  it("D9b: add-blocked-by on a blocked issue that no longer exists is `failed(target changed)`", async () => {
    const { model, approved, row, index, blocked } = await withBlockedBy();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === index ? "throw" : undefined) },
    });
    expect(first.states()[row.id]).toBe("pending");
    model.issues.find((i) => i.number === blocked)!.state = "closed";
    const second = await applyModel(model, first.text);
    expect(second.states()[row.id]).toBe("failed(target changed)");
    expect(second.writes().some((a) => /dependencies\/blocked_by/.test(a.join(" ")))).toBe(false);
  });

  it("D13: a planned `add:` with the marker comment gone is `failed(target changed)`, never a new marker comment", async () => {
    const { model, approved } = await fresh("ac11", (m) => {
      m.comments = {
        "1": [
          {
            id: 7001,
            body: `${MARKER}\n🔄 Update: x — Refs #1\n\n| Wave | State | Wave issue |\n| ---- | ----- | ---------- |\n| 1 | shipped | — |`,
          },
        ],
      };
    });
    const first = await applyModel(model, approved, { runner: throwOn((a) => a[2] === "PATCH") });
    model.comments = {};
    const second = await applyModel(model, first.text);
    expect(second.states()["W-032"]).toBe("failed(target changed)");
    expect(second.writes().some((a) => a[0] === "issue" && a[1] === "comment")).toBe(false);
    expect(model.comments).toEqual({});
  });

  it("D13b: a planned `create:` when a marker comment appeared since is `failed(target changed)`, no PATCH", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: throwOn((a) => a[0] === "issue" && a[1] === "comment"),
    });
    const theirs = `${MARKER}\n🔄 Update: planner — Refs #1\n\n| Wave | State | Wave issue |\n| ---- | ----- | ---------- |\n| 1 | shipped | — |`;
    model.comments = { "1": [{ id: 7100, body: theirs }] };
    const second = await applyModel(model, first.text);
    expect(second.states()["W-032"]).toBe("failed(target changed)");
    expect(second.writes().some((a) => a[2] === "PATCH" || a[1] === "comment")).toBe(false);
    expect(model.comments["1"]).toEqual([{ id: 7100, body: theirs }]);
  });

  it("D11: a row the comment gained since `--plan` is not added again; only the still-missing rows are", async () => {
    const header = `${MARKER}\n🔄 Update: x — Refs #1\n\n| Wave | State | Wave issue |\n| ---- | ----- | ---------- |`;
    const { model, approved } = await fresh("ac11", (m) => {
      m.comments = { "1": [{ id: 7001, body: header }] };
    });
    expect(approved).toContain("add: 1 = shipped, —; 2 = in progress, W-017");
    const first = await applyModel(model, approved, { runner: throwOn((a) => a[2] === "PATCH") });
    model.comments!["1"][0].body = `${header}\n| 1 | shipped | — |`;
    const second = await applyModel(model, first.text);
    expect(second.states()["W-032"]).toBe("done");
    const body = model.comments!["1"][0].body;
    expect(body.match(/^\| 1 \|/gm)).toHaveLength(1);
    expect(body.match(/^\| 2 \| in progress \| #23 \|$/gm)).toHaveLength(1);
  });

  it("D5: a same-titled issue without the `level:` label is not adopted: `failed(target changed)`, no create", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: throwOn((a) => a[0] === "issue" && a[1] === "create"),
    });
    model.issues.push({
      id: 812345,
      number: 40,
      state: "open",
      title: "[PRD-alpha] Wave 2: Gizmo search and export",
      body: "someone else's",
      labels: [],
      milestone: null,
      parent: null,
      blocking: [],
    });
    const second = await applyModel(model, first.text);
    expect(second.states()["W-017"]).toBe("failed(target changed)");
    expect(second.writes().some((a) => a[0] === "issue" && a[1] === "create")).toBe(false);
    expect(second.states()["W-019"]).toBe("skipped(depends on W-017)");
    expect(model.issues.find((i) => i.number === 40)!.labels).toEqual([]);
  });
});

describe("a lost write-back is detected for every action (5.21, D3, D6, D9)", () => {
  it.each([
    [
      "edit-label",
      8,
      "W-008",
      (a: readonly string[]) => a[0] === "label" && a[1] === "edit" && a.at(-1) === "type: bug",
    ],
    [
      "remove-label",
      24,
      "W-024",
      (a: readonly string[]) =>
        a.join(" ") === "issue edit 1 --repo=acme/gizmos --remove-label=type: prd",
    ],
    [
      "add-label",
      25,
      "W-025",
      (a: readonly string[]) =>
        a.join(" ") === "issue edit 10 --repo=acme/gizmos --add-label=level: story",
    ],
  ])(
    "%s: the next run records `skipped(already applied)` and writes it again zero times",
    async (_, failOn, id, same) => {
      const { model, approved } = await fresh();
      const first = await applyModel(model, approved, { store: failingStore(approved, failOn) });
      expect(first.result.exitCode).toBe(1);
      expect(first.states()[id]).toBe("pending");
      const second = await applyModel(model, first.text);
      expect(second.result.exitCode).toBe(0);
      expect(second.states()[id]).toBe("skipped(already applied)");
      expect(second.writes().some(same)).toBe(false);
    },
  );

  it("add-blocked-by: the blocking list is checked before the POST; no duplicate, no 422, exit 0", async () => {
    const { model, approved, row, index, blocked, blocker } = await withBlockedBy();
    const first = await applyModel(model, approved, { store: failingStore(approved, index) });
    expect(first.states()[row.id]).toBe("pending");
    expect(model.issues.find((i) => i.number === blocker)!.blocking).toEqual([blocked]);
    const second = await applyModel(model, first.text);
    expect(second.result.exitCode).toBe(0);
    expect(second.states()[row.id]).toBe("skipped(already applied)");
    expect(second.writes().some((a) => /dependencies\/blocked_by/.test(a.join(" ")))).toBe(false);
  });
});

describe("cleanup and state after failures (5.22, BD1, BD3, S2, G7)", () => {
  it("BD3: the run's own temp dir is removed, after success and after a thrown runner", async () => {
    for (const runner of [undefined, throwOn((a) => a[0] === "issue" && a[1] === "comment")]) {
      const { model, approved } = await fresh();
      const run = await applyModel(model, approved, { runner });
      const dirs = [...new Set(run.calls.flatMap((c) => c.bodies.map((b) => dirname(b.path))))];
      expect(dirs).toHaveLength(1);
      expect(existsSync(dirs[0]), dirs[0]).toBe(false);
    }
  });

  it("BD1 during the call: the previous body is removed before the next write starts", async () => {
    const { model, approved } = await fresh("ac11", (m) => {
      m.comments = {
        "1": [
          {
            id: 7001,
            body: `${MARKER}\nx\n\n| Wave | State | Wave issue |\n| ---- | ----- | ---------- |`,
          },
        ],
      };
    });
    const bodies: string[] = [];
    const leftovers: string[] = [];
    const store = memoryStore({ [PLAN_PATH]: approved });
    const rec = applyRunner(model, {
      onWrite: (argv) => {
        for (const p of bodies) if (existsSync(p)) leftovers.push(p);
        for (const a of argv) {
          const m = a.match(/^--body-file=(.+)$/) ?? a.match(/^--field=body=@(.+)$/);
          if (m) bodies.push(m[1]);
        }
        return undefined;
      },
    });
    await runMigrationApply({
      runner: rec.runner,
      reader: modelReader(model),
      planFile: PLAN_PATH,
      store,
      lock: memoryLock(),
    });
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(leftovers).toEqual([]);
  });

  it("a temp dir the caller passes is kept (the caller removes it) and left empty", async () => {
    const { model, approved } = await fresh();
    const dir = mkdtempSync(join(tmpdir(), "apply-own-"));
    try {
      const store = memoryStore({ [PLAN_PATH]: approved });
      const rec = applyRunner(model);
      await runMigrationApply({
        runner: rec.runner,
        reader: modelReader(model),
        planFile: PLAN_PATH,
        store,
        lock: memoryLock(),
        tmpDir: dir,
      });
      expect(rec.calls.flatMap((c) => c.bodies).every((b) => dirname(b.path) === dir)).toBe(true);
      expect(existsSync(dir)).toBe(true);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("S2: after a failed write-back the row reads pending in the result, not done", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved, { store: failingStore(approved, 3) });
    const labels = run.result.summary!.batches.find((b) => b.key === "1")!;
    expect(labels).toMatchObject({ done: 2, pending: 14 });
    expect(run.result.error).toMatch(/regenerate/);
  });

  // 5.28 (verifier F-6): the result's counts match the file on disk.
  it("a failed write-back restores the row's previous state, so the counts match the file", async () => {
    const { model, approved } = await fresh();
    let current = "";
    const fail = (reason: string) => ({
      beforeWrite: (id: string) => {
        current = id;
      },
      runner: {
        onWrite: () =>
          current === "W-008" ? { stdout: "", stderr: reason, exitCode: 1 } : undefined,
      },
    });
    const first = await applyModel(model, approved, fail("HTTP 500: first"));
    expect(first.states()["W-008"]).toBe("failed(HTTP 500: first)");
    // The re-run fails W-008 again, and that state cannot be written back.
    const second = await applyModel(model, first.text, {
      ...fail("HTTP 500: second"),
      store: failingStore(first.text, 1),
    });
    expect(second.result.exitCode).toBe(1);
    expect(second.states()["W-008"]).toBe("failed(HTTP 500: first)");
    const onDisk = parseMigrationPlan(second.text).plan;
    const counted = onDisk.batches.map((b) => {
      const rows = [...b.writes, ...b.steps];
      const n = (p: RegExp) => rows.filter((x) => p.test(x.state)).length;
      return {
        pending: n(/^pending$/),
        done: n(/^done/),
        failed: n(/^failed/),
        skipped: n(/^skipped/),
      };
    });
    expect(
      second.result.summary!.batches.map(({ pending, done, failed, skipped }) => ({
        pending,
        done,
        failed,
        skipped,
      })),
    ).toEqual(counted);
    expect(second.result.summary!.batches[0]).toMatchObject({ failed: 1, pending: 0 });
  });

  it("G7: the plan file changing after the lock is taken exits 14 with zero writes", async () => {
    const { model, approved } = await fresh();
    const store = memoryStore({ [PLAN_PATH]: approved });
    const lock = memoryLock();
    const acquire = lock.acquire;
    lock.acquire = () => {
      store.files[PLAN_PATH] = setState(approved, "W-001", "done");
      return acquire();
    };
    const run = await applyModel(model, undefined, { store, lock });
    expect(run.result.exitCode).toBe(14);
    expect(run.result.error).toMatch(/changed while --apply started/);
    expect(run.writes()).toEqual([]);
    expect(lock.held).toBe(false);
  });
});

describe("the comma guard (5.24, C1)", () => {
  it("a label name with a comma is `failed(...)`, never sent to gh, which would split it", async () => {
    const { model, approved } = await fresh("ac11", (m) => {
      m.labels.push({ name: "a,b", description: "", color: "EEEEEE" });
    });
    const lines = approved.split("\n");
    lines.splice(
      lines.findIndex((l) => l.startsWith("| W-031 |")) + 1,
      0,
      "| W-040 | add-label | #21 | a,b |  | pending |",
    );
    const joined = lines.join("\n");
    const text = joined.replace(
      /^Plan digest: [0-9a-f]{64}$/m,
      `Plan digest: ${computePlanDigest(parseMigrationPlan(joined).plan.batches)}`,
    );
    const run = await applyModel(model, text);
    expect(run.result.exitCode).toBe(1);
    expect(run.states()["W-040"]).toMatch(/^failed\(label name contains a comma/);
    expect(run.writes().some((a) => a.some((x) => x.includes("a,b")))).toBe(false);
  });
});
