/**
 * S-015 AC-7 (spec §6, §12; D-92, A-67): every issue body and comment body
 * goes through a file in the OS temp directory, removed after the call,
 * and the PRD status comment follows the wave 1 marker procedure: found by
 * its marker, created when absent, edited in place by id when present, with
 * only the missing rows added. MU-76 to MU-78, EC-153, EC-154, CT-36.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { realpathSync } from "node:fs";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { applyModel, approve } from "./helpers/apply-run.js";
import { planModel } from "./helpers/plan-run.js";

const MARKER = "<!-- dev-tasks:status -->";

async function fresh(edit: (m: RepoModel) => void = () => {}) {
  const model = cloneModel(loadModel("ac11"));
  edit(model);
  const p = await planModel(model);
  return { model, approved: approve(p.text) };
}

const TMP = [tmpdir(), realpathSync(tmpdir())];
const underTmp = (p: string) => TMP.some((t) => p.startsWith(`${t}/`));

describe("bodies through files (AC-7, MU-76, MU-77, EC-153)", () => {
  it("every create and comment uses `--body-file`, a PATCH `--field=body=@`; never `--body`", async () => {
    const { model, approved } = await fresh((m) => {
      m.comments = {
        "1": [
          {
            id: 7001,
            body: `${MARKER}\n🔄 Update: x — Refs #1\n\n| Wave | State | Wave issue |\n| ---- | ----- | ---------- |\n| 1 | shipped | — |`,
          },
        ],
      };
    });
    // A plan with a PATCH: rebuild with the comment present.
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(0);
    const bodied = run.calls.filter((c) => c.write && c.bodies.length > 0);
    const kinds = bodied.map((c) => c.argv.slice(0, 2).join(" "));
    expect(kinds).toContain("issue create");
    expect(kinds).toContain("api -X");
    for (const c of run.calls) {
      expect(c.argv.some((a) => a === "--body" || a.startsWith("--body=") || a === "-b")).toBe(
        false,
      );
      if (c.argv[0] === "issue" && ["create", "comment"].includes(c.argv[1]))
        expect(
          c.argv.filter((a) => a.startsWith("--body-file=")),
          c.argv.join(" "),
        ).toHaveLength(1);
      if (c.argv[0] === "api" && c.argv[2] === "PATCH")
        expect(c.argv.at(-1)).toMatch(/^--field=body=@/);
    }
  });

  it("each body file is under the OS temp dir, readable during the call, gone after", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved);
    const files = run.calls.flatMap((c) => c.bodies);
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      expect(underTmp(f.path), f.path).toBe(true);
      expect(f.content).not.toBe("<missing>");
      expect(existsSync(f.path), f.path).toBe(false);
    }
  });

  it("the file is removed after a failed call and after a thrown runner", async () => {
    for (const outcome of ["fail", "throw"] as const) {
      const { model, approved } = await fresh();
      const run = await applyModel(model, approved, {
        runner: {
          onWrite: (argv) =>
            argv[0] === "issue" && argv[1] === "create"
              ? outcome === "throw"
                ? "throw"
                : { stdout: "", stderr: "HTTP 500", exitCode: 1 }
              : undefined,
        },
      });
      const files = run.calls.flatMap((c) => c.bodies);
      expect(files.length, outcome).toBeGreaterThan(0);
      for (const f of files) expect(existsSync(f.path), `${outcome} ${f.path}`).toBe(false);
    }
  });

  it("the tracking issue body follows the publish template and holds no other issue's text", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved);
    const create = run.calls.find((c) => c.argv[0] === "issue" && c.argv[1] === "create")!;
    const body = create.bodies[0].content;
    expect(body).toMatch(/^Scope: Gizmo search and export$/m);
    expect(body).toMatch(/^Integration branch: TBD$/m);
    expect(body).toMatch(/^## Stories$/m);
    expect(body).not.toMatch(/BODY-SENTINEL|zebra-quartz/);
    expect(create.argv).toContain("--title=[PRD-alpha] Wave 2: Gizmo search and export");
    expect(create.argv).toContain("--label=level: wave");
  });
});

describe("the PRD status comment by marker (AC-7, MU-78, EC-154, D-92, A-67)", () => {
  it("no marker comment: one is created, marker first, with the prefix line and one row per wave", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved);
    const comment = run.calls.find((c) => c.argv[0] === "issue" && c.argv[1] === "comment")!;
    expect(comment.argv.slice(0, 4)).toEqual(["issue", "comment", "1", "--repo=acme/gizmos"]);
    const body = comment.bodies[0].content;
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body.split("\n")[1]).toMatch(/^🔄 Update: .+ — Refs #1$/);
    expect(body).toMatch(/^\| Wave \| State \| Wave issue \|$/m);
    expect(body).toMatch(/^\| 1 \| shipped \| — \|$/m);
    expect(body).toMatch(/^\| 2 \| in progress \| #23 \|$/m);
    expect((model.comments?.["1"] ?? []).filter((c) => c.body.startsWith(MARKER))).toHaveLength(1);
  });

  it("an existing marker comment (the planner's) is edited by id: its text and rows kept, missing rows added", async () => {
    const existing = [
      MARKER,
      "🔄 Update: wave 1 shipped — Refs #1",
      "",
      "| Wave | State                | Wave issue |",
      "| ---- | -------------------- | ---------- |",
      "| 1    | shipped              | —          |",
      "",
      "Kept text after the table.",
    ].join("\n");
    const { model, approved } = await fresh((m) => {
      m.comments = {
        "1": [
          { id: 7001, body: "an unrelated comment" },
          { id: 7002, body: existing },
        ],
      };
    });
    expect(approved).toContain("add: 2 = in progress, W-017");
    const run = await applyModel(model, approved);
    expect(run.result.exitCode).toBe(0);
    const patch = run.calls.find((c) => c.argv[0] === "api" && c.argv[2] === "PATCH")!;
    expect(patch.argv[3]).toBe("repos/acme/gizmos/issues/comments/7002");
    expect(run.calls.some((c) => c.argv[0] === "issue" && c.argv[1] === "comment")).toBe(false);
    const body = model.comments!["1"].find((c) => c.id === 7002)!.body;
    expect(body.startsWith(existing.split("\n").slice(0, 6).join("\n"))).toBe(true);
    expect(body).toMatch(/^\| 1 {4}\| shipped {14}\| — {10}\|$/m);
    expect(body).toMatch(/^\| 2 \| in progress \| #23 \|$/m);
    expect(body).toContain("Kept text after the table.");
    expect(body.indexOf("| 2 | in progress")).toBeLessThan(body.indexOf("Kept text"));
    expect(model.comments!["1"].find((c) => c.id === 7001)!.body).toBe("an unrelated comment");
  });

  it("two applies leave exactly one marker comment", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved);
    await applyModel(model, first.text);
    const again = await planModel(model);
    await applyModel(model, approve(again.text));
    expect((model.comments?.["1"] ?? []).filter((c) => c.body.startsWith(MARKER))).toHaveLength(1);
  });

  it("two marker comments: the oldest is edited, none posted", async () => {
    const mk = (id: number) => ({
      id,
      body: `${MARKER}\n🔄 Update: x — Refs #1\n\n| Wave | State | Wave issue |\n| ---- | ----- | ---------- |\n| 1 | shipped | — |`,
    });
    const { model, approved } = await fresh((m) => {
      m.comments = { "1": [mk(7009), mk(7003)] };
    });
    const run = await applyModel(model, approved);
    const patch = run.calls.find((c) => c.argv[0] === "api" && c.argv[2] === "PATCH")!;
    expect(patch.argv[3]).toBe("repos/acme/gizmos/issues/comments/7003");
    expect(model.comments!["1"]).toHaveLength(2);
  });
});
