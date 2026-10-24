/**
 * S-013 AC-2, AC-3: the read-only snapshot through one injectable
 * `GhRunner` and a `LocalReader` (spec §5, §9; §16a A-52, A-74 to A-76,
 * A-88, A-91). MU-17 to MU-23, EC-101, EC-105, RT-8.
 */
import { describe, it, expect } from "vitest";
import {
  readSnapshot,
  snapshotHash,
  SnapshotError,
  type MigrationSnapshot,
} from "#core/migrate-projects/snapshot.js";
import { GhNotFoundError, parseJsonStream } from "#core/migrate-projects/gh.js";
import { cloneModel, loadModel, type RepoModel } from "./helpers/fake-github.js";
import { modelReader, recordingRunner } from "./helpers/recording-runner.js";
import { prng, seedFromEnv } from "./helpers/prng.js";

async function read(
  model: RepoModel,
  opts: Parameters<typeof recordingRunner>[1] = {},
  repo?: string,
) {
  const rec = recordingRunner(model, opts);
  const reader = modelReader(model);
  const snapshot = await readSnapshot({ runner: rec.runner, reader, repo });
  return { snapshot, calls: rec.calls, reads: reader.reads };
}

async function readError(
  model: RepoModel,
  opts: Parameters<typeof recordingRunner>[1] = {},
  repo?: string,
) {
  const rec = recordingRunner(model, opts);
  const reader = modelReader(model);
  try {
    await readSnapshot({ runner: rec.runner, reader, repo });
  } catch (err) {
    return { err: err as SnapshotError, calls: rec.calls, reads: reader.reads };
  }
  throw new Error("readSnapshot did not fail");
}

describe("auth first (D-96, A-88)", () => {
  // MU-17
  it("the first call is `gh auth status --hostname github.com`", async () => {
    const { calls } = await read(loadModel("survey"));
    expect(calls[0]).toEqual(["auth", "status", "--hostname", "github.com"]);
  });

  it("on failure nothing else is read, from GitHub or the working tree", async () => {
    const { err, calls, reads } = await readError(loadModel("survey"), { authFails: true });
    expect(err).toBeInstanceOf(SnapshotError);
    expect(err.kind).toBe("auth");
    expect(err.message).toContain("gh auth login");
    expect(calls).toHaveLength(1);
    expect(reads).toEqual([]);
  });

  // EC-101
  it("`gh` missing is a dependency failure with the same hint", async () => {
    const reader = modelReader(loadModel("survey"));
    const runner = async () => {
      throw new GhNotFoundError();
    };
    await expect(readSnapshot({ runner, reader })).rejects.toMatchObject({
      kind: "gh-missing",
      message: expect.stringContaining("gh auth login"),
    });
  });
});

describe("repository (A-52, A-64)", () => {
  it("defaults to the working tree's `gh repo view --json nameWithOwner`", async () => {
    const { snapshot, calls } = await read(loadModel("survey"));
    expect(calls[1]).toEqual(["repo", "view", "--json", "nameWithOwner"]);
    expect(snapshot.repo).toBe("acme/widgets");
  });

  it("accepts `--repo` equal to the working tree, case-insensitively", async () => {
    const { snapshot } = await read(loadModel("survey"), {}, "Acme/Widgets");
    expect(snapshot.repo).toBe("acme/widgets");
  });

  it("refuses `--repo` naming another repository than the working tree", async () => {
    const { err, calls } = await readError(loadModel("survey"), {}, "other/repo");
    expect(err.kind).toBe("repo-mismatch");
    expect(calls).toHaveLength(2);
  });

  it("a failing `repo view` is a dependency failure", async () => {
    const { err } = await readError(loadModel("survey"), { repoViewFails: true });
    expect(err.kind).toBe("repo-view");
  });
});

describe("reads (CT-32; A-74 to A-76, A-91)", () => {
  // MU-21, MU-23
  it("issues exactly the expected reads, every list paginated", async () => {
    const { calls } = await read(loadModel("survey"));
    const keys = calls.map((c) => c.join(" "));
    const r = "repos/acme/widgets";
    expect(new Set(keys)).toEqual(
      new Set([
        "auth status --hostname github.com",
        "repo view --json nameWithOwner",
        `api --paginate ${r}/labels?per_page=100`,
        `api --paginate ${r}/issues?state=open&per_page=100`,
        `api --paginate search/issues?q=${encodeURIComponent("repo:acme/widgets is:issue is:closed PRD in:title")}&per_page=100`,
        // Tracking issues, open and closed: sub-issues and parent.
        ...[1, 2, 30].flatMap((n) => [
          `api --paginate ${r}/issues/${n}/sub_issues?per_page=100`,
          `api ${r}/issues/${n}/parent`,
        ]),
        // Stories: parent (A-76).
        ...[10, 11, 12, 13].map((n) => `api ${r}/issues/${n}/parent`),
        // Critical issues: what they block (A-72).
        ...[20, 21, 22].map(
          (n) => `api --paginate ${r}/issues/${n}/dependencies/blocking?per_page=100`,
        ),
      ]),
    );
    expect(keys.length, "no read is repeated").toBe(new Set(keys).size);
    for (const c of calls.filter((c) => c[0] === "api" && !c.at(-1)!.endsWith("/parent"))) {
      expect(c, c.join(" ")).toContain("--paginate");
    }
    // No fixed cap (A-75): no `--limit` anywhere.
    expect(keys.some((k) => k.includes("--limit"))).toBe(false);
  });

  it("records REST numeric ids, labels, milestone, parent, sub-issues and blocking", async () => {
    const { snapshot } = await read(loadModel("survey"));
    const byNo = new Map(snapshot.openIssues.map((i) => [i.number, i]));
    expect(byNo.get(12)).toMatchObject({ id: 90012, parent: 2, milestone: "Alpha" });
    expect(byNo.get(2)).toMatchObject({ subIssues: [12], parent: 1 });
    expect(byNo.get(21)).toMatchObject({ blocking: [11] });
    expect(byNo.get(23)!.body).toBe("");
    expect(byNo.has(40), "pull requests are not issues").toBe(false);
    expect(snapshot.closedTrackingIssues.map((i) => i.number)).toEqual([30]);
    expect(snapshot.closedTrackingIssues[0]).toMatchObject({
      state: "closed",
      subIssues: [31],
      parent: 1,
    });
    expect(snapshot.closedSearchComplete).toBe(true);
  });

  // MU-22, D-89, A-83
  it("reads the roadmap, the PRD titles and active state files from the working tree", async () => {
    const { snapshot, reads } = await read(loadModel("survey"));
    expect(snapshot.roadmap).toContain("| PRD | Phase/Wave |");
    expect(snapshot.prdFiles).toEqual([{ name: "alpha", h1: "PRD: alpha — Alpha widgets" }]);
    expect(snapshot.stateFiles.map((s) => s.path)).toEqual([
      "workstream/planner-state-alpha-phase-1.md",
      "workstream/planner-state-alpha-phase-2.md",
    ]);
    expect(reads).not.toContain("workstream/archive/planner-state-alpha-phase-0.md");
  });

  it("a missing roadmap reads as null, not an error", async () => {
    const model = cloneModel(loadModel("survey"));
    delete model.files["docs/roadmap.md"];
    const { snapshot } = await read(model);
    expect(snapshot.roadmap).toBeNull();
  });

  // EC-105, MU-23: more than 1,000 open issues, all read.
  it("reads 1,200 open issues across pages, never truncating", async () => {
    const model = cloneModel(loadModel("empty"));
    for (let n = 1; n <= 1200; n++) {
      model.issues.push({
        id: n,
        number: n,
        state: "open",
        title: `t${n}`,
        body: "",
        labels: [],
        milestone: null,
        parent: null,
        blocking: [],
      });
    }
    const { snapshot } = await read(model, { pageSize: 100 });
    expect(snapshot.openIssues).toHaveLength(1200);
  });

  it("a search beyond GitHub's 1,000-result window is flagged, not trusted", async () => {
    const { snapshot } = await read(loadModel("survey"), { searchIncomplete: true });
    expect(snapshot.closedSearchComplete).toBe(false);
  });

  // EC-157
  it("a failing read stops with an error naming the call", async () => {
    const model = loadModel("survey");
    const rec = recordingRunner(model);
    const runner: typeof rec.runner = async (args) =>
      args.join(" ").includes("/labels")
        ? { stdout: "", stderr: "gh: Server Error (HTTP 500)\nmore", exitCode: 1 }
        : rec.runner(args);
    const err = await readSnapshot({ runner, reader: modelReader(model) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SnapshotError);
    expect((err as SnapshotError).kind).toBe("read");
    expect((err as SnapshotError).message).toContain("labels");
    expect((err as SnapshotError).message).toContain("HTTP 500");
  });
});

describe("parseJsonStream (gh --paginate output)", () => {
  it("merges concatenated arrays and splits concatenated objects", () => {
    expect(parseJsonStream("[1,2][3]\n[4]")).toEqual([[1, 2], [3], [4]]);
    expect(parseJsonStream('{"a":"}{"}{"b":[1]}')).toEqual([{ a: "}{" }, { b: [1] }]);
    expect(parseJsonStream("")).toEqual([]);
    expect(() => parseJsonStream("[1,")).toThrow();
  });
});

// --- hash ---------------------------------------------------------------------

function permute(s: MigrationSnapshot, seed: number): MigrationSnapshot {
  const r = prng(seed);
  const issues = (list: MigrationSnapshot["openIssues"]) =>
    r.shuffle(list).map((i) => ({
      ...i,
      labels: r.shuffle(i.labels),
      ...(i.subIssues ? { subIssues: r.shuffle(i.subIssues) } : {}),
      ...(i.blocking ? { blocking: r.shuffle(i.blocking) } : {}),
    }));
  return {
    ...s,
    labels: r.shuffle(s.labels),
    openIssues: issues(s.openIssues),
    closedTrackingIssues: issues(s.closedTrackingIssues),
    stateFiles: r.shuffle(s.stateFiles),
    prdFiles: r.shuffle(s.prdFiles),
  };
}

describe("snapshot hash (spec §12)", () => {
  // MU-18
  it("is SHA-256 hex and stable under reordering of every array", async () => {
    const { snapshot } = await read(loadModel("survey"));
    const h = snapshotHash(snapshot);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshotHash(permute(snapshot, 7))).toBe(h);
  });

  it("is the same whatever order the model serves issues and labels in", async () => {
    const a = await read(loadModel("survey"));
    const model = cloneModel(loadModel("survey"));
    model.issues.reverse();
    model.labels.reverse();
    for (const i of model.issues) i.labels.reverse();
    const b = await read(model);
    expect(snapshotHash(b.snapshot)).toBe(snapshotHash(a.snapshot));
  });

  // MU-19
  it.each([
    ["a label added to one issue", (m: RepoModel) => m.issues[2].labels.push("type: docs")],
    ["a title", (m: RepoModel) => (m.issues[2].title += "!")],
    ["a milestone", (m: RepoModel) => (m.issues[2].milestone = "Beta")],
    ["a parent", (m: RepoModel) => (m.issues.find((i) => i.number === 10)!.parent = 2)],
    ["the roadmap file", (m: RepoModel) => (m.files["docs/roadmap.md"] += "\n")],
    [
      "a state file",
      (m: RepoModel) => (m.files["workstream/planner-state-alpha-phase-2.md"] += "x"),
    ],
    ["a label description", (m: RepoModel) => (m.labels[0].description += ".")],
  ])("changes with %s", async (_name, mutate) => {
    const base = snapshotHash((await read(loadModel("survey"))).snapshot);
    const model = cloneModel(loadModel("survey"));
    mutate(model);
    expect(snapshotHash((await read(model)).snapshot)).not.toBe(base);
  });

  // MU-20
  it("holds no volatile field", async () => {
    const { snapshot } = await read(loadModel("survey"));
    const json = JSON.stringify(snapshot);
    for (const field of ["updated_at", "created_at", "comments", "node_id"]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});

// RT-8: order independence and single-field sensitivity, seeded.
describe("RT-8 hash property", () => {
  const seed = seedFromEnv(8008);
  it(`order-independent and sensitive (seed ${seed})`, async () => {
    const r = prng(seed);
    const { snapshot } = await read(loadModel("survey"));
    const h = snapshotHash(snapshot);
    for (let iter = 0; iter < 300; iter++) {
      expect(snapshotHash(permute(snapshot, r.int(0, 2 ** 31))), `seed ${seed} iter ${iter}`).toBe(
        h,
      );
      const m: MigrationSnapshot = JSON.parse(JSON.stringify(snapshot));
      const target = r.pick(m.openIssues);
      switch (r.int(0, 3)) {
        case 0:
          target.title += String.fromCharCode(r.int(33, 126));
          break;
        case 1:
          target.labels.push(`x-${iter}`);
          break;
        case 2:
          target.body += " ";
          break;
        default:
          target.milestone = target.milestone === null ? "M" : null;
      }
      expect(snapshotHash(m), `seed ${seed} iter ${iter}`).not.toBe(h);
    }
  });
});
