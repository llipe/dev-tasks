/**
 * S-015 AC-3, AC-4 (D-88, D-101; §16a A-49, A-66, A-80, A-81): batches 1 to
 * 6 run in order, each write's state is written back to the plan file after
 * its call, and a re-run executes only what is not yet applied, so no
 * `done` write is ever repeated. Asserted on the fake GitHub model's
 * resulting state, not only on the argv. MU-63 to MU-70, E2E-22 to E2E-24,
 * EC-139, EC-141 to EC-145, the PRD AC-12 integration (task 5.15), RT-11
 * and RT-12 with the real `--apply`.
 */
import { describe, it, expect } from "vitest";
import { parseMigrationPlan, renderMigrationPlan } from "#core/migrate-projects/planfile.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { forbiddenReason } from "./helpers/fake-github-writes.js";
import { applyModel, approve } from "./helpers/apply-run.js";
import { memoryStore, planModel, PLAN_PATH } from "./helpers/plan-run.js";
import { prng, seedFromEnv } from "./helpers/prng.js";
import { randomAnswers, randomRepo } from "./helpers/random-repo.js";

const MARKER = "<!-- dev-tasks:status -->";
const RETIRED = [
  "status: ready",
  "status: in-progress",
  "type: prd",
  "type: wave",
  "type: story",
  "type: other",
  "needs: decision",
  "needs: approval",
  "needs: merge",
];
const isRetired = (l: string) => RETIRED.includes(l.toLowerCase()) || /^wave:/i.test(l);
const applied = /^(done|skipped\(already applied)/;

async function fresh(name = "ac11"): Promise<{ model: RepoModel; approved: string }> {
  const model = cloneModel(loadModel(name));
  const p = await planModel(model);
  return { model, approved: approve(p.text) };
}

const cliIds = (text: string) =>
  parseMigrationPlan(text).plan.batches.flatMap((b) => b.writes.map((w) => w.id));

describe("a full run (AC-3, E2E-22, PRD AC-12)", () => {
  it("exit 0, every row done or skipped, and the repository in the state the plan describes", async () => {
    const { model, approved } = await fresh();
    const titles = new Map(model.issues.map((i) => [i.number, i.title]));
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(0);
    const states = run.states();
    for (const id of cliIds(approved)) expect(states[id], id).toMatch(/^(done|skipped)/);
    expect(states["W-017"]).toBe("done(#23)");
    for (const id of ["W-033", "W-034", "W-035", "W-036"]) expect(states[id]).toBe("pending");

    const byNumber = (n: number) => model.issues.find((i) => i.number === n)!;
    for (const name of ["level: prd", "level: wave", "level: story", "type: test"])
      expect(
        model.labels.some((l) => l.name === name),
        name,
      ).toBe(true);
    for (const issue of model.issues.filter((i) => i.state === "open"))
      expect(issue.labels.filter(isRetired), `#${issue.number}`).toEqual([]);
    for (const name of [
      "needs: decision",
      "status: ready",
      "type: other",
      "type: prd",
      "wave: 2",
    ]) {
      const l = model.labels.find((x) => x.name === name);
      expect(l, name).toBeDefined();
      expect(l!.description.startsWith("Retired (D-91): "), name).toBe(true);
      expect(l!.description.match(/Retired \(/g)).toHaveLength(1);
    }
    const wave = byNumber(23);
    expect(wave.title).toBe("[PRD-alpha] Wave 2: Gizmo search and export");
    expect(wave.labels).toEqual(["level: wave"]);
    expect(wave.parent).toBe(1);
    for (const n of [10, 11, 12, 13]) {
      expect(byNumber(n).parent, `#${n}`).toBe(23);
      expect(byNumber(n).labels, `#${n}`).toContain("level: story");
    }
    for (const n of [14, 15, 20, 21, 22]) expect(byNumber(n).parent, `#${n}`).toBeNull();
    expect(byNumber(20).labels.some((l) => l.startsWith("level:"))).toBe(false);
    expect(byNumber(1).labels).toContain("level: prd");
    expect(byNumber(1).labels).not.toContain("type: prd");
    for (const [n, t] of titles) expect(byNumber(n).title, `#${n}`).toBe(t);
    const marked = (model.comments?.["1"] ?? []).filter((c) => c.body.startsWith(MARKER));
    expect(marked).toHaveLength(1);
    expect(marked[0].body).toMatch(/^\| 1 \| shipped \| — \|$/m);
    expect(marked[0].body).toMatch(/^\| 2 \| in progress \| #23 \|$/m);
    expect(run.calls.map((c) => forbiddenReason(c.argv)).filter((x) => x !== null)).toEqual([]);
  });

  // MU-63
  it("writes go in batch then row order; batch 7 is never issued", async () => {
    const { model, approved } = await fresh();
    const order: string[] = [];
    await applyModel(model, approved, { beforeWrite: (id) => order.push(id) });
    expect(order).toEqual([...order].sort());
    expect(order.length).toBeGreaterThan(20);
    expect(order.some((id) => ["W-033", "W-034", "W-035", "W-036"].includes(id))).toBe(false);
  });

  // MU-64: the state is on disk before the next call.
  it("after each call the file already holds that row's state", async () => {
    const { model, approved } = await fresh();
    const store = memoryStore({ [PLAN_PATH]: approved });
    let current = "";
    let checked = 0;
    await applyModel(model, approved, {
      store,
      beforeWrite: (id) => {
        current = id;
      },
      runner: {
        onWrite: () => {
          const plan = parseMigrationPlan(store.files[PLAN_PATH]).plan;
          for (const w of plan.batches.flatMap((b) => b.writes)) {
            if (w.id < current) expect(w.state, `${w.id} before ${current}`).not.toBe("pending");
            if (w.id >= current) expect(w.state, `${w.id} at ${current}`).toBe("pending");
          }
          checked++;
          return undefined;
        },
      },
    });
    expect(checked).toBeGreaterThan(20);
  });
});

describe("failed writes (AC-3, MU-65, MU-67, E2E-24, EC-141 to EC-143)", () => {
  it("a non-zero exit records `failed(<first stderr line>)`, escaped, and the run continues", async () => {
    const { model, approved } = await fresh();
    let current = "";
    const run = await applyModel(model, approved, {
      beforeWrite: (id) => {
        current = id;
      },
      runner: {
        onWrite: () =>
          current === "W-008"
            ? {
                stdout: "",
                stderr: "\nHTTP 422: Validation Failed | bad\nsecond line",
                exitCode: 1,
              }
            : undefined,
      },
    });
    expect(run.result.exitCode).toBe(1);
    expect(run.states()["W-008"]).toBe("failed(HTTP 422: Validation Failed | bad)");
    expect(run.text).toContain("failed(HTTP 422: Validation Failed \\| bad)");
    expect(run.states()["W-009"]).toBe("done");
    expect(run.states()["W-032"]).toBe("done");
  });

  it("a failed wave-issue create skips its links and comment rows; unrelated batches still run", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved, {
      runner: {
        onWrite: (argv) =>
          argv[0] === "issue" && argv[1] === "create"
            ? { stdout: "", stderr: "HTTP 422: Validation Failed\n{...}", exitCode: 1 }
            : undefined,
      },
    });
    expect(run.result.exitCode).toBe(1);
    const s = run.states();
    expect(s["W-017"]).toBe("failed(HTTP 422: Validation Failed)");
    for (const id of ["W-018", "W-019", "W-020", "W-021", "W-022", "W-032"])
      expect(s[id], id).toBe("skipped(depends on W-017)");
    for (const id of ["W-023", "W-025", "W-029", "W-030", "W-031"]) expect(s[id], id).toBe("done");
    expect(model.issues.some((i) => i.number === 23)).toBe(false);
    const counts = Object.fromEntries(run.result.summary!.batches.map((b) => [b.key, b]));
    expect(counts["2"]).toMatchObject({ failed: 1, done: 0 });
    expect(counts["3"]).toMatchObject({ skipped: 5, done: 0 });

    // The re-run creates it once and runs what waited on it.
    const second = await applyModel(model, run.text);
    expect(second.result.exitCode).toBe(0);
    expect(second.states()["W-017"]).toBe("done(#23)");
    for (const id of ["W-018", "W-019", "W-020", "W-021", "W-022", "W-032"])
      expect(second.states()[id], id).toBe("done");
    expect(second.writes().filter((a) => a[0] === "label")).toEqual([]);
    expect(model.issues.filter((i) => i.title.startsWith("[PRD-alpha] Wave 2"))).toHaveLength(1);
  });

  it("a failed label create skips the add-label rows that need it (A-81, EC-142)", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved, {
      runner: {
        onWrite: (argv) =>
          argv[0] === "label" && argv.at(-1) === "level: story"
            ? { stdout: "", stderr: "HTTP 500", exitCode: 1 }
            : undefined,
      },
    });
    const s = run.states();
    expect(s["W-003"]).toBe("failed(HTTP 500)");
    for (const id of ["W-025", "W-026", "W-027", "W-028"])
      expect(s[id]).toBe("skipped(depends on W-003)");
  });
});

describe("re-runs (AC-4, D-88, MU-66, MU-68 to MU-70, EC-144, EC-145)", () => {
  it("a second run after full success issues zero writes and exits 0", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved);
    const second = await applyModel(model, first.text);
    expect(second.result.exitCode).toBe(0);
    expect(second.writes()).toEqual([]);
    expect(second.text).toBe(first.text);
  });

  // Task 5.15, MU-69, E2E-23: the PRD AC-12 integration.
  it("a runner that throws on write 5 aborts; the resumed run repeats writes 1 to 4 zero times", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === 5 ? "throw" : undefined) },
    });
    expect(first.result.exitCode).toBe(1);
    expect(first.result.error).toMatch(/interrupted/);
    const s = first.states();
    for (const id of ["W-001", "W-002", "W-003", "W-004"]) expect(s[id]).toBe("done");
    for (const id of cliIds(approved).slice(4)) expect(s[id], id).toBe("pending");
    const firstWrites = first
      .writes()
      .slice(0, 4)
      .map((a) => a.join("\u0001"));

    const ids: string[] = [];
    const second = await applyModel(model, first.text, { beforeWrite: (id) => ids.push(id) });
    expect(second.result.exitCode).toBe(0);
    expect(ids.filter((id) => ["W-001", "W-002", "W-003", "W-004"].includes(id))).toEqual([]);
    for (const argv of second.writes()) expect(firstWrites).not.toContain(argv.join("\u0001"));

    // The final state equals an uninterrupted run's.
    const { model: other, approved: same } = await fresh();
    await applyModel(other, same);
    expect(model).toEqual(other);
  });

  it("a created issue's number is recorded and a dependent link on a later run resolves to it", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: {
        onWrite: (argv) =>
          argv[0] === "api" && argv[3] === "repos/acme/gizmos/issues/1/sub_issues"
            ? { stdout: "", stderr: "HTTP 502: Bad Gateway", exitCode: 1 }
            : undefined,
      },
    });
    expect(first.states()["W-017"]).toBe("done(#23)");
    expect(first.states()["W-018"]).toBe("failed(HTTP 502: Bad Gateway)");
    const second = await applyModel(model, first.text);
    expect(second.writes()).toEqual([
      ["api", "-X", "POST", "repos/acme/gizmos/issues/1/sub_issues", "--field=sub_issue_id=800023"],
    ]);
    expect(second.states()["W-018"]).toBe("done");
    expect(model.issues.find((i) => i.number === 23)!.parent).toBe(1);
    expect(model.issues.filter((i) => i.number > 22)).toHaveLength(1);
  });

  it("a label already present when its row runs is `skipped(already applied)`, with no write", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === 2 ? "throw" : undefined) },
    });
    expect(first.states()["W-001"]).toBe("done");
    model.labels.push({
      name: "Level: Wave",
      color: "5C6BC0",
      description: "Wave tracking issue; a container for stories, not work",
    });
    const second = await applyModel(model, first.text);
    expect(second.states()["W-002"]).toBe("skipped(already applied)");
    expect(second.writes().some((a) => a[0] === "label" && /level: wave/i.test(a.at(-1)!))).toBe(
      false,
    );
  });

  it("a label present with another description is `failed(target changed)`, never overwritten", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === 2 ? "throw" : undefined) },
    });
    model.labels.push({ name: "level: wave", color: "000000", description: "Something else" });
    const second = await applyModel(model, first.text);
    expect(second.states()["W-002"]).toBe("failed(target changed)");
    expect(model.labels.find((l) => l.name === "level: wave")!.description).toBe("Something else");
  });

  it("a target in neither the before nor the after state is `failed(target changed)` (D-101)", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === 18 ? "throw" : undefined) },
    });
    expect(first.states()["W-017"]).toBe("done(#23)");
    // Meanwhile someone gives #10 another parent.
    model.issues.find((i) => i.number === 10)!.parent = 1;
    const second = await applyModel(model, first.text);
    expect(second.result.exitCode).toBe(1);
    expect(second.states()["W-019"]).toBe("failed(target changed)");
    expect(second.states()["W-020"]).toBe("done");
    expect(model.issues.find((i) => i.number === 10)!.parent).toBe(1);
  });
});

describe("write-back failures (EC-139, A-80)", () => {
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

  it("a write that lands but whose state is not written back is `skipped(already applied)` next run", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, { store: failingStore(approved, 3) });
    expect(first.result.exitCode).toBe(1);
    expect(first.result.error).toMatch(/ENOSPC/);
    expect(first.states()["W-003"]).toBe("pending");
    expect(model.labels.some((l) => l.name === "level: story")).toBe(true);
    expect(first.lock.held).toBe(false);
    const second = await applyModel(model, first.text);
    expect(second.states()["W-003"]).toBe("skipped(already applied)");
    expect(second.writes().some((a) => a.at(-1) === "level: story" && a[0] === "label")).toBe(
      false,
    );
  });

  it("a created issue whose state was lost is found by its title, never created twice", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, { store: failingStore(approved, 17) });
    expect(first.states()["W-017"]).toBe("pending");
    expect(model.issues.some((i) => i.number === 23)).toBe(true);
    const second = await applyModel(model, first.text);
    expect(second.result.exitCode).toBe(0);
    expect(second.states()["W-017"]).toBe("skipped(already applied, #23)");
    expect(second.writes().some((a) => a[0] === "issue" && a[1] === "create")).toBe(false);
    expect(model.issues.find((i) => i.number === 13)!.parent).toBe(23);
    expect(model.issues.filter((i) => i.number > 22)).toHaveLength(1);
  });
});

// RT-11: a stateful random walk over --apply with injected failures and
// interruptions, then RT-12 with the real --apply: re-planning the final
// state proposes no batch 1 to 6 row (A-66).
describe("random walks (RT-11, RT-12)", () => {
  it("no applied write repeats, no create lands twice, and re-planning proposes nothing", async () => {
    const seed = seedFromEnv(1761310000);
    const r = prng(seed);
    const seen = {
      interrupted: 0,
      failed: 0,
      regenerated: 0,
      landedThenThrew: 0,
      resumed: 0,
      changed: 0,
      targetChanged: 0,
    };
    for (let walk = 0; walk < 200; walk++) {
      const ctx = `seed ${seed} walk ${walk}`;
      const model = randomRepo(r);
      const first = await planModel(model);
      const draft = parseMigrationPlan(first.text).plan;
      randomAnswers(
        draft,
        r,
        model.issues.filter((i) => i.state === "open").map((i) => i.number),
      );
      let text = approve((await planModel(model, { previous: renderMigrationPlan(draft) })).text);
      const original = new Set(model.issues.map((i) => i.number));
      // 5.20: in some walks someone else changes targets between runs.
      const changing = r.bool(0.4);
      const change = () => {
        const open = model.issues.filter((i) => i.state === "open");
        if (open.length === 0) return;
        const i = r.pick(open);
        const k = r.int(0, 2);
        if (k === 0 && i.labels.length > 0) i.labels.splice(r.int(0, i.labels.length - 1), 1);
        else if (k === 1 && model.labels.length > 0) {
          const l = r.pick(model.labels).name;
          if (!i.labels.some((x) => x.toLowerCase() === l.toLowerCase())) i.labels.push(l);
        } else i.parent = null;
        seen.changed++;
      };
      for (let run = 0; run < 6; run++) {
        const last = run === 5;
        if (changing && run > 0 && r.bool(0.5)) change();
        const before = parseMigrationPlan(text).plan.batches.flatMap((b) => b.writes);
        const startState = new Map(before.map((w) => [w.id, w.state]));
        const issued: string[] = [];
        const result = await applyModel(model, text, {
          beforeWrite: (id) => issued.push(id),
          runner: {
            onWrite: () => {
              if (last) return undefined;
              const x = r.next();
              if (x < 0.04) return "throw";
              if (x < 0.07) return "apply-then-throw";
              if (x < 0.13) return { stdout: "", stderr: "HTTP 502: Bad Gateway", exitCode: 1 };
              return undefined;
            },
          },
        });
        const e = result.result.error ?? "";
        if (/interrupted after/.test(e)) seen.landedThenThrew++;
        else if (/interrupted/.test(e)) seen.interrupted++;
        expect(result.calls.map((c) => forbiddenReason(c.argv)).filter(Boolean), ctx).toEqual([]);
        if (result.result.exitCode === 14 && /regenerate the plan/.test(e)) {
          // A write landed before any state was recorded: the owner re-plans.
          seen.regenerated++;
          text = approve((await planModel(model, { previous: undefined })).text);
          continue;
        }
        expect([0, 1], `${ctx} run ${run}: ${e}`).toContain(result.result.exitCode);
        for (const id of issued) {
          expect(startState.get(id), `${ctx} run ${run} reissued ${id}`).not.toMatch(applied);
        }
        if (issued.length > 0 && [...startState.values()].some((s) => s !== "pending"))
          seen.resumed++;
        for (const w of result.plan.batches.flatMap((b) => b.writes)) {
          const was = startState.get(w.id)!;
          if (applied.test(was)) expect(w.state, `${ctx} ${w.id}`).toBe(was);
          if (/^failed/.test(w.state)) seen.failed++;
        }
        // No create lands twice: each issue --apply created has a title no other open issue has.
        const titles = model.issues.filter((i) => i.state === "open").map((i) => i.title);
        for (const i of model.issues.filter((x) => !original.has(x.number))) {
          expect(
            titles.filter((x) => x === i.title),
            `${ctx} duplicate ${i.title}`,
          ).toHaveLength(1);
        }
        for (const [n, list] of Object.entries(model.comments ?? {}))
          expect(
            list.filter((c) => c.body.startsWith(MARKER)).length,
            `${ctx} #${n}`,
          ).toBeLessThanOrEqual(1);
        text = result.text;
        if (last) {
          const done = /^(done|skipped)/;
          // A changed target is refused, never forced: `failed(target changed)` is its only failure.
          const allowedEnd = changing ? /^(done|skipped|failed\(target changed\))/ : done;
          if (!changing) expect(result.result.exitCode, `${ctx}: ${e}`).toBe(0);
          for (const w of result.plan.batches.flatMap((b) => b.writes)) {
            expect(w.state, `${ctx} ${w.id} ${w.action}`).toMatch(allowedEnd);
            if (w.state === "failed(target changed)") seen.targetChanged++;
          }
        }
      }
      // RT-12: the final state needs no further write (unless someone else changed it).
      if (changing) continue;
      const again = await planModel(model);
      for (const b of again.plan.batches.filter((x) => x.runner === "cli"))
        expect(
          b.writes.map((w) => `${w.action} ${w.target} ${w.detail}`),
          `${ctx} batch ${b.key}`,
        ).toEqual([]);
    }
    expect(seen.interrupted).toBeGreaterThan(0);
    expect(seen.landedThenThrew).toBeGreaterThan(0);
    expect(seen.failed).toBeGreaterThan(0);
    expect(seen.resumed).toBeGreaterThan(0);
    expect(seen.changed).toBeGreaterThan(0);
  }, 120_000);
});
