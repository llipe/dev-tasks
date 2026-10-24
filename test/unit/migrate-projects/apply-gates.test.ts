/**
 * S-015 AC-1, AC-2 and the §16a gates (A-49, A-50, A-51, A-64, A-79, A-80;
 * D-80, D-101): `--apply` refuses, writing nothing, in this order: a missing
 * or unparsable plan file (2), `gh` missing or unauthenticated (11), a plan
 * not approved (14), a plan digest that no longer matches its rows (14), a
 * lock held by another run (14), and a stale snapshot while every row is
 * still `pending` (14, "regenerate the plan"). MU-60 to MU-62, MC-11 and
 * MC-12 in process, EC-138, EC-146 to EC-148, EC-156, CT-25, RT-14.
 */
import { describe, it, expect } from "vitest";
import { GhNotFoundError, type GhRunner } from "#core/migrate-projects/gh.js";
import { runMigrationApply } from "#core/migrate-projects/index.js";
import { computePlanDigest, parseMigrationPlan } from "#core/migrate-projects/planfile.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { normalizeArgv } from "./helpers/fake-github-writes.js";
import { applyModel, approve, memoryLock } from "./helpers/apply-run.js";
import { memoryStore, planModel, PLAN_PATH } from "./helpers/plan-run.js";
import { modelReader } from "./helpers/recording-runner.js";
import { prng, seedFromEnv } from "./helpers/prng.js";

async function fresh(name = "ac11"): Promise<{ model: RepoModel; text: string; approved: string }> {
  const model = cloneModel(loadModel(name));
  const p = await planModel(model);
  return { model, text: p.text, approved: approve(p.text) };
}

/** Replace one plan row's Detail cell by ID, keeping the rest of the line. */
function editDetail(text: string, id: string, detail: string): string {
  return text
    .split("\n")
    .map((l) => {
      if (!l.startsWith(`| ${id} |`)) return l;
      const cells = l.split(" | ");
      cells[3] = detail;
      return cells.join(" | ");
    })
    .join("\n");
}

// 5.19 (G2b): scenario k fails gate k and every later gate, and passes
// every earlier one, so the code it exits with proves which gate ran first.
describe("the gate order (5.19, A-64, D-80, D-101)", () => {
  const GATES = [
    ["unparsable", 2, /not a valid migration plan/],
    ["auth", 11, /gh auth login/],
    ["approval", 14, /not approved/],
    ["digest", 14, /Plan digest/],
    ["lock", 14, /\.migration-projects\.lock/],
    ["stale while pending", 14, /regenerate the plan/],
  ] as const;
  it.each(GATES.map((g, k) => [g[0], k, g[1], g[2]] as const))(
    "%s fails first: exit %#",
    async (_, k, code, message) => {
      const { model, approved } = await fresh();
      let text = approved;
      if (k <= 5) model.issues.find((i) => i.number === 20)!.labels.push("type: chore");
      if (k <= 3) text = editDetail(text, "W-008", "description: Anything at all");
      if (k <= 2) text = text.replace(/^Approved: yes$/m, "Approved: no");
      if (k <= 0) text = text.replace("Format: 1", "Format: 9");
      const run = await applyModel(model, text, {
        lock: memoryLock(k <= 4),
        runner: { authFails: k <= 1 },
      });
      expect(run.result.exitCode).toBe(code);
      expect(run.result.error).toMatch(message);
      expect(run.writes()).toEqual([]);
      expect(run.store.files[PLAN_PATH]).toBe(text);
    },
  );
});

describe("plan file gates (A-64, EC-156)", () => {
  it("a missing plan file exits 2 before any gh call", async () => {
    const { model } = await fresh();
    const run = await applyModel(model, undefined);
    expect(run.result.exitCode).toBe(2);
    expect(run.result.error).toMatch(/migration-projects\.md/);
    expect(run.calls).toEqual([]);
    expect(run.lock.acquired).toBe(0);
  });

  it.each([
    ["not a plan", "hello\n"],
    ["Format: 2", (t: string) => t.replace("Format: 1", "Format: 2")],
    ["an unknown state", (t: string) => t.replace("| pending |", "| maybe |")],
  ])("an unparsable plan (%s) exits 2 before any gh call", async (_, mutate) => {
    const { model, approved } = await fresh();
    const text = typeof mutate === "string" ? mutate : mutate(approved);
    const run = await applyModel(model, text);
    expect(run.result.exitCode).toBe(2);
    expect(run.calls).toEqual([]);
    expect(run.store.files[PLAN_PATH]).toBe(text);
  });
});

describe("gh gates (A-64, A-88, MC-17)", () => {
  it("gh unauthenticated exits 11 after the auth check alone", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved, { runner: { authFails: true } });
    expect(run.result.exitCode).toBe(11);
    expect(run.result.error).toMatch(/gh auth login/);
    expect(run.calls.map((c) => c.argv)).toEqual([["auth", "status", "--hostname", "github.com"]]);
    expect(run.store.files[PLAN_PATH]).toBe(approved);
  });

  it("gh missing exits 11", async () => {
    const { model, approved } = await fresh();
    const store = memoryStore({ [PLAN_PATH]: approved });
    const runner: GhRunner = async () => {
      throw new GhNotFoundError();
    };
    const result = await runMigrationApply({
      runner,
      reader: modelReader(model),
      planFile: PLAN_PATH,
      store,
      lock: memoryLock(),
    });
    expect(result.exitCode).toBe(11);
    expect(store.files[PLAN_PATH]).toBe(approved);
  });
});

describe("approval (AC-1, MU-60, MU-61, CT-25, D-80)", () => {
  it("`Approved: no` exits 14, writes nothing, leaves the file byte-identical, takes no lock", async () => {
    const { model, text } = await fresh();
    const before = JSON.stringify(model);
    const run = await applyModel(model, text);
    expect(run.result.exitCode).toBe(14);
    expect(run.result.error).toMatch(/Approved: yes/);
    expect(run.writes()).toEqual([]);
    expect(run.store.files[PLAN_PATH]).toBe(text);
    expect(JSON.stringify(model)).toBe(before);
    expect(run.lock.acquired).toBe(0);
  });

  it.each([
    ["Approved: Yes"],
    ["Approved: yes "],
    ["Approved: yes\nApproved: yes"],
    ["Approved: yes\nApproved: no"],
    ["Approved: no\n```\nApproved: yes\n```"],
  ])("the near miss %j is refused with exactly 14 and zero writes", async (line) => {
    const { model, text } = await fresh();
    const mutated = text.replace(/^Approved: no$/m, line);
    const run = await applyModel(model, mutated);
    expect(run.result.exitCode).toBe(14);
    expect(run.result.error).toMatch(/not approved/);
    expect(run.writes()).toEqual([]);
    expect(run.store.files[PLAN_PATH]).toBe(mutated);
  });

  // `approved: yes` is no `Approved:` line at all: the file lacks a required header.
  it("a lower-case `approved: yes` leaves no Approved line: exit 2, zero writes", async () => {
    const { model, text } = await fresh();
    const run = await applyModel(model, text.replace(/^Approved: no$/m, "approved: yes"));
    expect(run.result.exitCode).toBe(2);
    expect(run.calls).toEqual([]);
  });

  // CT-25: an `Approved: yes` in a fence below the header is plan text, not approval.
  it("a fenced `Approved: yes` in the plan body does not approve (14)", async () => {
    const { model, text } = await fresh();
    const fenced = text.replace(
      "## Needs your answer\n",
      "## Needs your answer\n\n```\nApproved: yes\n```\n",
    );
    expect(fenced).not.toBe(text);
    const run = await applyModel(model, fenced);
    expect(run.result.exitCode).toBe(14);
    expect(run.writes()).toEqual([]);
  });

  it("exactly `Approved: yes` proceeds", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(0);
    expect(run.writes().length).toBeGreaterThan(0);
  });
});

describe("plan digest (A-51, EC-148, E2E-26)", () => {
  it("a Detail edited after approval exits 14 with zero writes", async () => {
    const { model, approved } = await fresh();
    const edited = editDetail(approved, "W-008", "description: Anything at all");
    const run = await applyModel(model, edited);
    expect(run.result.exitCode).toBe(14);
    expect(run.result.error).toMatch(/Plan digest/);
    expect(run.writes()).toEqual([]);
    expect(run.store.files[PLAN_PATH]).toBe(edited);
  });

  it("a Detail carrying `--repo other/repo` is refused, never passed to gh", async () => {
    const { model, approved } = await fresh();
    const edited = editDetail(approved, "W-025", "level: story --repo other/repo");
    const run = await applyModel(model, edited);
    expect(run.result.exitCode).toBe(14);
    expect(run.calls.some((c) => c.argv.some((a) => a.includes("other/repo")))).toBe(false);
  });

  it("an inserted row exits 14 with zero writes", async () => {
    const { model, approved } = await fresh();
    const inserted = approved.replace(
      "| W-028 | add-label | #13 | level: story | W-003 | pending |",
      "| W-028 | add-label | #13 | level: story | W-003 | pending |\n| W-900 | add-label | #20 | level: story |  | pending |",
    );
    expect(inserted).not.toBe(approved);
    const run = await applyModel(model, inserted);
    expect(run.result.exitCode).toBe(14);
    expect(run.writes()).toEqual([]);
  });

  it("a forged `gh project` row is refused as an unknown action (2), zero writes", async () => {
    const { model, approved } = await fresh();
    const forged = approved
      .replace(
        "| W-022 | link-sub-issue | W-017 | sub-issue #13 | W-017 | pending |",
        "| W-022 | link-sub-issue | W-017 | sub-issue #13 | W-017 | pending |\n| W-950 | gh project item-delete | #1 | --id x |  | pending |",
      )
      .replace(/(\| W-03[3-6] \| .* \| )pending( \|)$/gm, "$1done$2");
    const run = await applyModel(model, forged);
    expect(run.result.exitCode).toBe(2);
    expect(run.calls).toEqual([]);
  });
});

describe("lock file (A-80, EC-146)", () => {
  it("a lock held by another run exits 14 with zero writes, the file untouched", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved, { lock: memoryLock(true) });
    expect(run.result.exitCode).toBe(14);
    expect(run.result.error).toMatch(/\.migration-projects\.lock/);
    expect(run.writes()).toEqual([]);
    expect(run.store.files[PLAN_PATH]).toBe(approved);
  });

  it("the lock is released after a full run, a failed write and an interruption", async () => {
    for (const onWrite of [
      undefined,
      () => ({ stdout: "", stderr: "HTTP 500", exitCode: 1 }),
      (_: readonly string[], i: number) => (i === 3 ? ("throw" as const) : undefined),
    ]) {
      const { model, approved } = await fresh();
      const run = await applyModel(model, approved, { runner: { onWrite } });
      expect(run.lock.acquired).toBe(1);
      expect(run.lock.held).toBe(false);
    }
  });
});

describe("stale snapshot (AC-2, MU-62, D-101)", () => {
  it("while every row is pending, a changed repository exits 14, `regenerate the plan`, zero writes", async () => {
    const { model, approved } = await fresh();
    model.issues.find((i) => i.number === 20)!.labels.push("type: chore");
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(14);
    expect(run.result.error).toMatch(/regenerate the plan/);
    expect(run.writes()).toEqual([]);
    expect(run.store.files[PLAN_PATH]).toBe(approved);
    expect(run.lock.held).toBe(false);
  });

  it("an unchanged repository proceeds", async () => {
    const { model, approved } = await fresh();
    expect((await applyModel(model, approved)).result.exitCode).toBe(0);
  });

  // EC-138, A-49: the repository changed because of the done writes; resume, do not refuse.
  it("once a row is done, the hash is not compared: the run resumes", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === 4 ? "throw" : undefined) },
    });
    expect(first.result.exitCode).not.toBe(0);
    // An unrelated change too: it must not stop the resume.
    model.issues.find((i) => i.number === 22)!.title = "[chore] Tidy the release scripts again";
    const second = await applyModel(model, first.text);
    expect(second.result.exitCode).toBe(0);
    for (const [id, s] of Object.entries(second.states())) {
      if (Number(id.slice(2)) <= 32) expect(s, id).toMatch(/^(done|skipped)/);
    }
  });

  it("a plan for another repository exits 2 before any write", async () => {
    const { model, approved } = await fresh();
    const other = approved.replace("# Migration plan: acme/gizmos", "# Migration plan: acme/other");
    const run = await applyModel(model, other);
    expect(run.result.exitCode).toBe(2);
    expect(run.result.error).toMatch(/acme\/other/);
    expect(run.writes()).toEqual([]);
  });
});

describe("answers never become writes in --apply (A-50, EC-147)", () => {
  it("an answer typed after the last --plan produces no write; the summary reports what waits", async () => {
    const { model, approved } = await fresh();
    const answered = approved.replace(
      /^(\| #15 \| .* \| )( \|)$/m,
      (_, a: string, b: string) => `${a}alpha 2${b}`,
    );
    expect(answered).not.toBe(approved);
    const run = await applyModel(model, answered);
    expect(run.result.exitCode).toBe(0);
    for (const argv of run.writes()) {
      expect(argv.join(" "), argv.join(" ")).not.toMatch(/(^| |\/)15( |$)|#15\b/);
    }
    expect(model.issues.find((i) => i.number === 15)!.parent).toBeNull();
    // #14 still waits; the needs-a-type rows #21 and #22 too.
    expect(run.result.summary!.review.unmapped).toBe(1);
    expect(run.result.summary!.review.needsType).toBe(2);
  });
});

// RT-14: mutations of an approved plan either refuse with zero writes or
// write exactly what the unmutated plan writes: the same argv for the same
// row, and the same sequence when the rows parse unchanged; never a write
// for an inserted row, never an uncaught throw.
describe("fuzzed plan files never cause an unapproved write (RT-14)", () => {
  it("500 mutations", async () => {
    const seed = seedFromEnv(1761300000);
    const r = prng(seed);
    const { approved } = await fresh();
    const baseIds: string[] = [];
    const baseline = await applyModel(cloneModel(loadModel("ac11")), approved, {
      beforeWrite: (id) => baseIds.push(id),
    });
    expect(baseline.result.exitCode).toBe(0);
    const key = (a: readonly string[]) => normalizeArgv(a).join("\u0001");
    const baseWrites = baseline.writes().map(key);
    const byRow = new Map(baseIds.map((id, i) => [id, baseWrites[i]]));
    const rowsOf = (t: string) =>
      JSON.stringify(parseMigrationPlan(t).plan.batches.map((b) => [b.writes, b.steps]));
    const unmutatedRows = rowsOf(approved);
    const states = [
      "done",
      "done(#5)",
      "done(#1)",
      "done(#999)",
      "failed(x)",
      "skipped(already applied)",
      "skipped(depends on W-001)",
      "garbage",
      "",
      "pending ",
    ];
    const actions = ["add-label", "remove-label", "create-label", "link-sub-issue", "edit-label"];
    const kinds = new Map<string, number>();
    for (let iter = 0; iter < 500; iter++) {
      const lines = approved.split("\n");
      const kind = r.pick(["delete", "duplicate", "truncate", "state", "insert", "pipe", "space"]);
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      let text: string;
      const at = r.int(0, lines.length - 1);
      if (kind === "delete") text = lines.filter((_, i) => i !== at).join("\n");
      else if (kind === "duplicate")
        text = [...lines.slice(0, at + 1), ...lines.slice(at)].join("\n");
      else if (kind === "truncate") text = approved.slice(0, r.int(0, approved.length - 1));
      else if (kind === "space") text = lines.map((l, i) => (i === at ? `${l}  ` : l)).join("\n");
      else if (kind === "pipe") {
        const rows = lines.map((l, i) => [l, i] as const).filter(([l]) => l.startsWith("|"));
        const [l, i] = r.pick(rows);
        const p = r.int(1, l.length - 1);
        lines[i] = r.bool() ? `${l.slice(0, p)}|${l.slice(p)}` : l.replace(/ \| /, " ");
        text = lines.join("\n");
      } else if (kind === "state") {
        const rows = lines.map((l, i) => [l, i] as const).filter(([l]) => /^\| W-\d+ \|/.test(l));
        const [l, i] = r.pick(rows);
        lines[i] = l.replace(/\| [^|]*\|$/, `| ${r.pick(states)} |`);
        text = lines.join("\n");
      } else {
        const rows = lines.map((l, i) => [l, i] as const).filter(([l]) => /^\| W-\d+ \|/.test(l));
        const [, i] = r.pick(rows);
        const row = `| W-${r.int(100, 999)} | ${r.pick(actions)} | ${r.pick(["#20", "#5", "label:x", "W-017", "#1"])} | ${r.pick(["level: story", "sub-issue #20", "description: x", "color: 000000; description: x"])} |  | pending |`;
        text = [...lines.slice(0, i + 1), row, ...lines.slice(i + 1)].join("\n");
      }
      const ctx = `seed ${seed} iter ${iter} ${kind}`;
      const ids: string[] = [];
      const run = await applyModel(cloneModel(loadModel("ac11")), text, {
        beforeWrite: (id) => ids.push(id),
      });
      expect([0, 1, 2, 14], ctx).toContain(run.result.exitCode);
      const writes = run.writes().map(key);
      if (run.result.exitCode === 2 || run.result.exitCode === 14) {
        expect(writes, ctx).toEqual([]);
        continue;
      }
      // Each write is exactly the unmutated plan's write for that row.
      ids.forEach((id, i) => expect(writes[i], `${ctx} ${id}`).toBe(byRow.get(id)));
      // Rows that parse unchanged write exactly the unmutated sequence.
      if (rowsOf(text) === unmutatedRows) expect(writes, ctx).toEqual(baseWrites);
    }
    for (const k of ["delete", "duplicate", "truncate", "state", "insert", "pipe", "space"]) {
      expect(kinds.get(k) ?? 0, k).toBeGreaterThan(0);
    }
  }, 120_000);
});

// The digest helper the gates use is the one the file was rendered with.
describe("the digest is over the rows the file holds (A-51)", () => {
  it("parse then recompute equals the header", async () => {
    const { approved } = await fresh();
    const parsed = parseMigrationPlan(approved);
    expect(computePlanDigest(parsed.plan.batches)).toBe(parsed.planDigest);
  });
});
