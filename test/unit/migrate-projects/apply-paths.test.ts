/**
 * S-015 (task 5.24, the qa coverage gap): the paths the scenario tests do
 * not reach. The real lock file; every row-grammar refusal (A-51), each
 * before any gh call; reads a row needs that fail or return unreadable
 * JSON; a create whose output has no issue URL; a reference with no
 * recorded number; errors that are not ours rethrown with the lock
 * released; and the summary and `--json` shapes when nothing was read.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLockFile,
  formatMigrationApplySummary,
  migrationApplyJson,
  runMigrationApply,
} from "#core/migrate-projects/index.js";
import { computePlanDigest, parseMigrationPlan } from "#core/migrate-projects/planfile.js";
import type { GhRunner } from "#core/migrate-projects/gh.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { applyModel, approve, memoryLock } from "./helpers/apply-run.js";
import { memoryStore, planModel, PLAN_PATH } from "./helpers/plan-run.js";
import { modelReader } from "./helpers/recording-runner.js";
import { respond } from "./helpers/fake-github.js";

async function fresh(edit: (m: RepoModel) => void = () => {}) {
  const model = cloneModel(loadModel("ac11"));
  edit(model);
  return { model, approved: approve((await planModel(model)).text) };
}

/** Add rows to batch `key`'s table (after its last row) and recompute the digest. */
function withRows(text: string, key: string, rows: string[]): string {
  const lines = text.split("\n");
  const head = lines.findIndex((l) => l.startsWith(`### ${key}. `));
  let at = head + 4; // heading, blank, header row, separator, then the first row
  while (lines[at]?.startsWith("| W-")) at++;
  lines.splice(at, 0, ...rows);
  const joined = lines.join("\n");
  const digest = computePlanDigest(parseMigrationPlan(joined).plan.batches);
  return joined.replace(/^Plan digest: [0-9a-f]{64}$/m, `Plan digest: ${digest}`);
}

const setState = (text: string, id: string, state: string) =>
  text
    .split("\n")
    .map((l) => (l.startsWith(`| ${id} |`) ? l.replace(/\| [^|]*\|$/, `| ${state} |`) : l))
    .join("\n");

describe("the real lock file (A-80)", () => {
  it("acquires once, refuses a second holder, releases, and creates its directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "apply-lock-"));
    try {
      const path = join(dir, "workstream", ".migration-projects.lock");
      const a = createLockFile(path);
      const b = createLockFile(path);
      a.release(); // not held: a no-op
      expect(a.acquire()).toBe(true);
      expect(readFileSync(path, "utf-8")).toMatch(/^pid \d+\nstarted /);
      expect(b.acquire()).toBe(false);
      b.release(); // not its lock: the file stays
      expect(existsSync(path)).toBe(true);
      a.release();
      expect(existsSync(path)).toBe(false);
      expect(b.acquire()).toBe(true);
      b.release();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an error other than an existing lock is thrown, not read as `held`", () => {
    const dir = mkdtempSync(join(tmpdir(), "apply-lock-"));
    try {
      writeFileSync(join(dir, "workstream"), "a file, not a directory");
      expect(() => createLockFile(join(dir, "workstream", "x.lock")).acquire()).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("row grammar refusals: exit 2 naming the row, before any gh call (A-51)", () => {
  const long = "x".repeat(101);
  it.each([
    [
      "1",
      "| W-901 | create-label | label:x | color: 000000; description: " + long + " |  | pending |",
    ],
    ["1", "| W-901 | create-label | label:x | color: 000000; description: a\\nb |  | pending |"],
    ["1", "| W-901 | create-label | nolabel | color: 000000; description: a |  | pending |"],
    ["1", "| W-901 | create-label | label:x | colour: red |  | pending |"],
    ["1", "| W-901 | edit-label | label:x | description: " + long + " |  | pending |"],
    ["1", "| W-901 | edit-label | label:x | text: a |  | pending |"],
    ["1", "| W-901 | edit-label | #3 | description: a |  | pending |"],
    [
      "2",
      "| W-901 | create-issue | #3 | template: wave; label: level: wave; title: [PRD-a] Wave 1: x |  | pending |",
    ],
    ["2", "| W-901 | create-issue | new issue | title: [PRD-a] Wave 1: x |  | pending |"],
    [
      "2",
      "| W-901 | create-issue | new issue | template: prd; label: level: wave; title: [PRD-a] A |  | pending |",
    ],
    [
      "2",
      "| W-901 | create-issue | new issue | template: wave; label: level: wave; title: Wave 1 x |  | pending |",
    ],
    [
      "2",
      `| W-901 | create-issue | new issue | template: prd; label: level: prd; title: [PRD-a] ${"y".repeat(80)} |  | pending |`,
    ],
    ["4", "| W-901 | add-label | label:x | level: story |  | pending |"],
    ["4", "| W-901 | remove-label | W-017 | level: story |  | pending |"],
    ["4", "| W-901 | add-label | #20 |  |  | pending |"],
    ["4", "| W-901 | add-label | W-001 | level: story |  | pending |"],
    ["3", "| W-901 | link-sub-issue | label:x | sub-issue #20 |  | pending |"],
    ["3", "| W-901 | link-sub-issue | #1 | child #20 |  | pending |"],
    ["4b", "| W-901 | add-blocked-by | W-017 | blocked by #20 |  | pending |"],
    ["4b", "| W-901 | add-blocked-by | #21 | blocks #20 |  | pending |"],
    ["4b", "| W-901 | add-blocked-by | #20 | blocked by #20 |  | pending |"],
    ["6", "| W-901 | status-comment | label:x | create: 1 = shipped, — |  | pending |"],
    ["6", "| W-901 | status-comment | #1 | rows: 1 = shipped, — |  | pending |"],
    ["6", "| W-901 | status-comment | #1 | create: 1 shipped |  | pending |"],
  ])("batch %s: %s", async (key, row) => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, withRows(approved, key, [row]));
    expect(run.result.exitCode, run.result.error).toBe(2);
    expect(run.result.error).toMatch(/W-901/);
    expect(run.calls).toEqual([]);
  });
});

describe("reads a row needs (link parent, blocking list, issue id, comments)", () => {
  const fail = { stdout: "", stderr: "HTTP 500: Server Error", exitCode: 1 };
  const garbage = { stdout: "not json", stderr: "", exitCode: 0 };

  it("a child whose parent the snapshot did not read: 404 links; a failed or unreadable read fails the row", async () => {
    for (const [answer, expected] of [
      [undefined, "done"],
      [fail, "failed(HTTP 500: Server Error)"],
      [garbage, "failed(unreadable parent of #20)"],
    ] as const) {
      const { model, approved } = await fresh();
      const text = withRows(approved, "3", [
        "| W-901 | link-sub-issue | #1 | sub-issue #20 |  | pending |",
      ]);
      const run = await applyModel(model, text, {
        runner: { onRead: (a) => (a[1]?.endsWith("/issues/20/parent") ? answer : undefined) },
      });
      expect(run.states()["W-901"]).toBe(expected);
    }
  });

  it("a blocker whose blocking list the snapshot did not read: read live; failed or unreadable fails the row", async () => {
    for (const [answer, expected] of [
      [undefined, "done"],
      [fail, "failed(HTTP 500: Server Error)"],
      [garbage, "failed(unreadable blocking list of #21)"],
    ] as const) {
      const { model, approved } = await fresh();
      const text = withRows(approved, "4b", [
        "| W-901 | add-blocked-by | #20 | blocked by #21 |  | pending |",
      ]);
      const run = await applyModel(model, text, {
        runner: {
          onRead: (a) =>
            a.join(" ").includes("issues/21/dependencies/blocking") ? answer : undefined,
        },
      });
      expect(run.states()["W-901"]).toBe(expected);
      if (expected === "done")
        expect(model.issues.find((i) => i.number === 21)!.blocking).toEqual([20]);
    }
  });

  it("the id of an issue this run created: a failed read or one with no id fails the link", async () => {
    for (const [answer, expected] of [
      [fail, "failed(HTTP 500: Server Error)"],
      [{ stdout: "{}", stderr: "", exitCode: 0 }, "failed(no id for #23)"],
    ] as const) {
      const { model, approved } = await fresh();
      const run = await applyModel(model, approved, {
        runner: {
          onRead: (a) => (a.join(" ") === "api repos/acme/gizmos/issues/23" ? answer : undefined),
        },
      });
      expect(run.states()["W-018"]).toBe(expected);
    }
  });

  it("the status comment list: a failed or unreadable read fails the row", async () => {
    for (const [answer, expected] of [
      [fail, "failed(HTTP 500: Server Error)"],
      [garbage, "failed(unreadable comments of #1)"],
    ] as const) {
      const { model, approved } = await fresh();
      let snapshotDone = false;
      const run = await applyModel(model, approved, {
        beforeWrite: () => {
          snapshotDone = true;
        },
        runner: {
          onRead: (a) =>
            snapshotDone && a.join(" ").includes("issues/1/comments") ? answer : undefined,
        },
      });
      expect(run.states()["W-032"]).toBe(expected);
    }
  });
});

describe("odd answers and records", () => {
  it("a create whose gh output has no issue URL is failed with what gh printed", async () => {
    const { model: m2, approved: a2 } = await fresh();
    const run = await applyModel(m2, a2, {
      runner: {
        onWrite: (a) =>
          a[0] === "issue" && a[1] === "create"
            ? { stdout: "\n", stderr: "", exitCode: 0 }
            : undefined,
      },
    });
    expect(run.states()["W-017"]).toBe(
      "failed(created, but gh printed no issue URL: empty output)",
    );
  });

  it("a W- reference to a create recorded `done` with no number fails its dependants", async () => {
    const { model, approved } = await fresh();
    const text = withRows(setState(approved, "W-017", "done"), "4", [
      "| W-901 | add-label | W-017 | type: test |  | pending |",
    ]);
    const run = await applyModel(model, text);
    expect(run.states()["W-901"]).toBe("failed(W-017 has no recorded issue number)");
    expect(run.states()["W-032"]).toBe("failed(W-017 has no recorded issue number)");
    expect(run.states()["W-018"]).toBe("failed(W-017 has no recorded issue number)");
  });

  it("an add-label target closed since is `failed(target changed)`", async () => {
    const { model, approved } = await fresh();
    const first = await applyModel(model, approved, {
      runner: { onWrite: (_, i) => (i === 25 ? "throw" : undefined) },
    });
    model.issues.find((i) => i.number === 10)!.state = "closed";
    const second = await applyModel(model, first.text);
    expect(second.states()["W-025"]).toBe("failed(target changed)");
  });

  it("an empty stderr records `failed(exit <code>)`; a thrown non-Error still interrupts", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, approved, {
      runner: {
        onWrite: (_, i) => (i === 1 ? { stdout: "", stderr: "", exitCode: 4 } : undefined),
      },
    });
    expect(run.states()["W-001"]).toBe("failed(exit 4)");
    const { model: m2, approved: a2 } = await fresh();
    const store = memoryStore({ [PLAN_PATH]: a2 });
    const lock = memoryLock();
    let writes = 0;
    const runner: GhRunner = async (args) => {
      if (args[0] === "label" && ++writes === 2) throw "a string, not an Error";
      return respond(m2, args);
    };
    const result = await runMigrationApply({
      runner,
      reader: modelReader(m2),
      planFile: PLAN_PATH,
      store,
      lock,
    });
    expect(result.exitCode).toBe(1);
    expect(result.error).toMatch(/interrupted at W-002 \(a string, not an Error\)/);
  });

  it("a row whose dependency was skipped by hand waits: the next action says run --apply again", async () => {
    const { model, approved } = await fresh();
    const run = await applyModel(model, setState(approved, "W-003", "skipped(by hand)"));
    expect(run.result.exitCode).toBe(0);
    expect(run.states()["W-025"]).toBe("skipped(depends on W-003)");
    expect(run.result.summary!.next).toBe("run --apply again to finish the writes left");
  });

  it("an existing marker comment with no PRD table gets one appended; CRLF line endings are kept", async () => {
    const { model, approved } = await fresh((m) => {
      m.comments = {
        "1": [
          {
            id: 7001,
            body: "<!-- dev-tasks:status -->\r\n🔄 Update: x — Refs #1\r\n\r\nNo table yet.",
          },
        ],
      };
    });
    const run = await applyModel(model, approved);
    expect(run.states()["W-032"]).toBe("done");
    const body = model.comments!["1"][0].body;
    expect(
      body.startsWith(
        "<!-- dev-tasks:status -->\r\n🔄 Update: x — Refs #1\r\n\r\nNo table yet.\r\n\r\n| Wave | State | Wave issue |",
      ),
    ).toBe(true);
    expect(body).toContain("| 2 | in progress | #23 |");
    expect(body.split("\n").every((l, i, all) => i === all.length - 1 || l.endsWith("\r"))).toBe(
      true,
    );
  });
});

describe("errors that are not ours, and exit codes (A-64)", () => {
  it("auth failing with an empty stderr names the exit code", async () => {
    const { model, approved } = await fresh();
    const result = await runMigrationApply({
      runner: async () => ({ stdout: "", stderr: "", exitCode: 4 }),
      reader: modelReader(model),
      planFile: PLAN_PATH,
      store: memoryStore({ [PLAN_PATH]: approved }),
      lock: memoryLock(),
    });
    expect(result.exitCode).toBe(11);
    expect(result.error).toMatch(/\(exit 4\)/);
  });

  it("an unexpected error in the auth check is thrown", async () => {
    const { model, approved } = await fresh();
    await expect(
      runMigrationApply({
        runner: async () => {
          throw new Error("boom");
        },
        reader: modelReader(model),
        planFile: PLAN_PATH,
        store: memoryStore({ [PLAN_PATH]: approved }),
        lock: memoryLock(),
      }),
    ).rejects.toThrow("boom");
  });

  it("an unexpected error while reading the snapshot is thrown, with the lock released", async () => {
    const { model, approved } = await fresh();
    const lock = memoryLock();
    await expect(
      runMigrationApply({
        runner: async (a) => {
          if (a[0] === "api") throw new Error("socket closed");
          return respond(model, a);
        },
        reader: modelReader(model),
        planFile: PLAN_PATH,
        store: memoryStore({ [PLAN_PATH]: approved }),
        lock,
      }),
    ).rejects.toThrow("socket closed");
    expect(lock.held).toBe(false);
  });

  it("a snapshot that cannot be read maps to its exit code: a failed read 1, a lost roadmap table 2", async () => {
    const { model, approved } = await fresh();
    const read = await applyModel(model, approved, {
      runner: {
        onRead: (a) =>
          a.join(" ").includes("/labels")
            ? { stdout: "", stderr: "HTTP 500", exitCode: 1 }
            : undefined,
      },
    });
    expect(read.result.exitCode).toBe(1);
    expect(read.writes()).toEqual([]);
    model.files["docs/roadmap.md"] = "# Roadmap\n";
    const roadmap = await applyModel(model, approved);
    expect(roadmap.result.exitCode).toBe(2);
    expect(roadmap.writes()).toEqual([]);
  });

  it("the summary and --json when no plan could be read", async () => {
    const { model } = await fresh();
    const r = (await applyModel(model, undefined)).result;
    expect(formatMigrationApplySummary(r)).toMatch(/^migrate projects --apply: .*not found/);
    expect(migrationApplyJson(r)).toEqual({
      command: "migrate projects",
      mode: "apply",
      repo: null,
      planFile: PLAN_PATH,
      batches: [],
      review: null,
      exitCode: 2,
      error: r.error,
    });
    expect(formatMigrationApplySummary({ ...r, error: undefined })).toBe(
      "migrate projects --apply: failed",
    );
  });

  it("--json after a run carries per-batch counts and no error key", async () => {
    const { model, approved } = await fresh();
    const j = migrationApplyJson((await applyModel(model, approved)).result) as {
      batches: Array<{ name: string; done: number }>;
      error?: string;
    };
    expect(j.batches[0]).toMatchObject({ name: "Labels", done: 16 });
    expect("error" in j).toBe(false);
  });
});
