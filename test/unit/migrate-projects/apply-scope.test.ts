/**
 * S-015 AC-5, AC-6 (D-22, D-27, D-81, D-91; §16a A-51, A-60, A-82, A-93):
 * batch 7 is never executed and no `gh project` call is ever made; retired
 * labels leave open issues only, their definitions stay with the
 * `Retired (D-91): ` description, and nothing is deleted. MU-71 to MU-75,
 * E2E-26, EC-149 to EC-152, CT-31, CT-33.
 */
import { describe, it, expect } from "vitest";
import { formatMigrationApplySummary } from "#core/migrate-projects/index.js";
import { computePlanDigest, parseMigrationPlan } from "#core/migrate-projects/planfile.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { forbiddenReason } from "./helpers/fake-github-writes.js";
import { applyModel, approve } from "./helpers/apply-run.js";
import { planModel } from "./helpers/plan-run.js";

async function fresh(
  name: string,
  edit: (m: RepoModel) => void = () => {},
): Promise<{ model: RepoModel; approved: string }> {
  const model = cloneModel(loadModel(name));
  edit(model);
  const p = await planModel(model);
  return { model, approved: approve(p.text) };
}

const projectArgv = (argv: readonly string[]) =>
  argv.some((a) => a === "project" || /^projects?\b/.test(a) || /\/projects\b|projectV2/i.test(a));

describe("no Project call, batch 7 printed (AC-5, MU-71, MU-74, D-81, D-22, D-27)", () => {
  it.each(["ac11", "survey", "empty"])("%s: no argv names a Project; batch 7 stays the user's", async (name) => {
    const { model, approved } = await fresh(name);
    const steps = parseMigrationPlan(approved).plan.batches.find((b) => b.key === "7")!.steps;
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(0);
    for (const c of run.calls) expect(projectArgv(c.argv), c.argv.join(" ")).toBe(false);
    for (const s of run.plan.batches.find((b) => b.key === "7")!.steps) expect(s.state).toBe("pending");
    expect(run.result.steps).toEqual(steps.map((s) => s.step));
    const text = formatMigrationApplySummary(run.result);
    for (const s of steps) expect(text).toContain(s.step);
    expect(text).toMatch(/you run these/i);
  });

  it("a batch 7 step set back to pending or ticked done is still never run (EC-149)", async () => {
    const { model, approved } = await fresh("ac11");
    const ticked = approved.replace(/(\| W-033 \| .* \| )pending( \|)$/m, "$1done$2");
    const run = await applyModel(model, ticked);
    expect(run.result.exitCode).toBe(0);
    for (const c of run.calls) expect(projectArgv(c.argv)).toBe(false);
    expect(run.states()["W-033"]).toBe("done");
    expect(run.states()["W-034"]).toBe("pending");
  });

  it("batch 7 relabelled `(cli)` is refused as an unknown section (EC-149)", async () => {
    const { model, approved } = await fresh("ac11");
    const run = await applyModel(
      model,
      approved.replace("### 7. Project cleanup (you run these)", "### 7. Project cleanup (cli)"),
    );
    expect(run.result.exitCode).toBe(2);
    expect(run.calls).toEqual([]);
  });

  it("no write sets a Status or touches a title: `--title` appears only on an issue create", async () => {
    for (const name of ["ac11", "survey"]) {
      const { model, approved } = await fresh(name);
      const run = await applyModel(model, approved);
      for (const argv of run.writes()) {
        if (argv.some((a) => a.startsWith("--title")))
          expect(argv.slice(0, 2), argv.join(" ")).toEqual(["issue", "create"]);
        expect(argv.join(" "), argv.join(" ")).not.toMatch(/\bStatus\b|status_field|single_select/);
      }
    }
  });
});

describe("retired labels (AC-6, MU-72, MU-73, MU-75, D-91, A-82)", () => {
  it("removed from open issues only; closed issues keep them; every definition kept, prefixed once", async () => {
    const { model, approved } = await fresh("ac11", (m) => {
      m.issues.find((i) => i.number === 5)!.labels.push("status: ready");
    });
    const before = model.labels.map((l) => l.name);
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(0);
    expect(model.issues.find((i) => i.number === 5)!.labels).toContain("status: ready");
    for (const name of before) expect(model.labels.some((l) => l.name === name), name).toBe(true);
    for (const name of ["needs: decision", "status: ready", "type: other", "type: prd", "wave: 2"]) {
      const d = model.labels.find((l) => l.name === name)!.description;
      expect(d.startsWith("Retired (D-91): "), name).toBe(true);
      expect(d.indexOf("Retired (", 1), name).toBe(-1);
    }
    for (const c of run.calls) expect(forbiddenReason(c.argv), c.argv.join(" ")).toBeNull();
    expect(run.calls.some((c) => c.argv[0] === "label" && c.argv[1] === "delete")).toBe(false);

    // A second plan and apply never prefix twice (EC-151, A-66).
    const again = await planModel(model);
    const second = await applyModel(model, approve(again.text));
    expect(second.writes()).toEqual([]);
    for (const name of ["needs: decision", "status: ready"]) {
      expect(model.labels.find((l) => l.name === name)!.description.match(/Retired \(/g)).toHaveLength(1);
    }
  });

  it("a description at GitHub's limit is cut to 100 characters, prefix kept (EC-150)", async () => {
    const long = "A".repeat(95);
    const { model, approved } = await fresh("ac11", (m) => {
      m.labels.find((l) => l.name === "needs: decision")!.description = long;
    });
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(0);
    const d = model.labels.find((l) => l.name === "needs: decision")!.description;
    expect(d.length).toBeLessThanOrEqual(100);
    expect(d.startsWith("Retired (D-91): AAAA")).toBe(true);
  });
});

describe("argv from the row only, values as `--flag=value` (A-51, A-93, CT-31, EC-152)", () => {
  /** A plan with one hand-written row added to batch 5, its digest recomputed. */
  function withRow(text: string, row: string): string {
    const lines = text.split("\n");
    const at = lines.findIndex((l) => l.startsWith("| W-031 |"));
    lines.splice(at + 1, 0, row);
    const joined = lines.join("\n");
    const digest = computePlanDigest(parseMigrationPlan(joined).plan.batches);
    return joined.replace(/^Plan digest: [0-9a-f]{64}$/m, `Plan digest: ${digest}`);
  }

  it("a label name starting with `-` is passed as `--remove-label=-wip`, never as its own argument", async () => {
    const { model, approved } = await fresh("ac11", (m) => {
      m.labels.push({ name: "-wip", description: "", color: "EEEEEE" });
      m.issues.find((i) => i.number === 21)!.labels.push("-wip");
    });
    const run = await applyModel(model, withRow(approved, "| W-040 | remove-label | #21 | -wip |  | pending |"));
    expect(run.result.exitCode).toBe(0);
    expect(run.writes()).toContainEqual(["issue", "edit", "21", "--repo=acme/gizmos", "--remove-label=-wip"]);
    expect(model.issues.find((i) => i.number === 21)!.labels).not.toContain("-wip");
  });

  it("every option is `--flag=value`, `-X <METHOD>` or the `--` before a label name; `--repo` is the plan's", async () => {
    for (const name of ["ac11", "survey"]) {
      const { model, approved } = await fresh(name);
      const run = await applyModel(model, approved);
      for (const argv of run.writes()) {
        argv.forEach((a, i) => {
          if (!a.startsWith("-")) {
            if (i > 0 && argv[i - 1] === "-X") expect(["POST", "PATCH"]).toContain(a);
            return;
          }
          const ok = a === "-X" || /^--[a-z-]+=/.test(a) || (a === "--" && i === argv.length - 2);
          expect(ok, `${argv.join(" ")}: ${a}`).toBe(true);
        });
        for (const a of argv.filter((x) => x.startsWith("--repo=")))
          expect(a).toBe(`--repo=${model.repo}`);
      }
    }
  });

  it("a row whose Detail does not match its Action's grammar is refused before any write (2)", async () => {
    const { model, approved } = await fresh("ac11");
    const run = await applyModel(
      model,
      withRow(approved, "| W-040 | link-sub-issue | #1 | sub-issue #20 --repo=x/y |  | pending |"),
    );
    expect(run.result.exitCode).toBe(2);
    expect(run.result.error).toMatch(/W-040/);
    expect(run.writes()).toEqual([]);
  });
});
