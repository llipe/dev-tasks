/**
 * S-013 AC-1, AC-2 at Layer 2: the real binary, the real `execFile("gh")`
 * runner, and a fake `gh` placed alone (with a `node` symlink) on a
 * purpose-built `PATH`, with the clock injected through `DEV_TASKS_NOW`
 * (spec §16a A-63, A-64, A-85, A-88). MC-1 to MC-10, EC-101, EC-116.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { readSnapshot } from "#core/migrate-projects/snapshot.js";
import { emptyMigrationPlanBatches, renderMigrationPlan } from "#core/migrate-projects/planfile.js";
import { loadModel, respond, type FakeOptions, type RepoModel } from "./helpers/fake-github.js";
import { isWrite } from "./helpers/is-write.js";
import { modelReader } from "./helpers/recording-runner.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const TSX_CLI = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const BIN = resolve(ROOT, "bin/dev-tasks.ts");
const FAKE_GH = resolve(ROOT, "test/fixtures/migrate-projects/fake-gh/gh");
const NOW = "2026-10-24T12:00:00Z";
const DEFAULT_PLAN = "workstream/migration-projects.md";

let tmp: string;
let cwd: string;
let pathDir: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "migrate-projects-cli-"));
  cwd = join(tmp, "repo");
  pathDir = join(tmp, "bin");
  mkdirSync(cwd);
  mkdirSync(pathDir);
  symlinkSync(process.execPath, join(pathDir, "node"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Build the replay table from the model by running the same reads in process. */
async function setup(
  model: RepoModel,
  options: FakeOptions & { noGh?: boolean } = {},
): Promise<void> {
  for (const [path, content] of Object.entries(model.files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  const responses: Record<string, unknown> = {};
  const runner = async (args: readonly string[]) => {
    const r = respond(model, args, options);
    responses[args.join("\u0001")] = r;
    return r;
  };
  await readSnapshot({ runner, reader: modelReader(model) }).catch(() => undefined);
  writeFileSync(join(tmp, "scenario.json"), JSON.stringify({ responses }));
  if (options.noGh !== true) symlinkSync(FAKE_GH, join(pathDir, "gh"));
}

function run(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const r = spawnSync(process.execPath, [TSX_CLI, BIN, ...args], {
    cwd,
    encoding: "utf-8",
    env: {
      PATH: pathDir,
      HOME: process.env.HOME ?? tmp,
      TMPDIR: process.env.TMPDIR ?? tmpdir(),
      TSX_TSCONFIG_PATH: resolve(ROOT, "tsconfig.json"),
      DEV_TASKS_NOW: NOW,
      FAKE_GH_SCENARIO: join(tmp, "scenario.json"),
      FAKE_GH_LOG: join(tmp, "gh.log"),
    },
  });
  return { stdout: r.stdout, stderr: r.stderr, exitCode: r.status ?? -1 };
}

function ghLog(): string[][] {
  const p = join(tmp, "gh.log");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf-8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as string[]);
}

const planAt = (p: string) => join(cwd, p);

describe("migrate projects --plan (AC-1)", () => {
  // MC-1, E2E-16
  it("exit 0, the default plan file, one line per batch and list, the next action", async () => {
    await setup(loadModel("survey"));
    const r = run(["migrate", "projects", "--plan"]);
    expect(r.stderr).toBe("");
    expect(r.exitCode).toBe(0);
    const text = readFileSync(planAt(DEFAULT_PLAN), "utf-8");
    expect(text.split("\n")[0]).toBe("# Migration plan: acme/widgets");
    expect(text).toContain("Approved: no");
    expect(text).toContain(`Generated: ${NOW}`);
    for (const line of [
      "1. Labels",
      "7. Project cleanup",
      "Needs a type: 6",
      "Needs a blocking link: 2",
      "State files: 1",
    ]) {
      expect(r.stdout).toContain(line);
    }
    expect(r.stdout).toContain(DEFAULT_PLAN);
    expect(r.stdout).toMatch(/Next: review the plan/);
    const log = ghLog();
    expect(log[0]).toEqual(["auth", "status", "--hostname", "github.com"]);
    for (const argv of log) expect(isWrite(argv), argv.join(" ")).toBe(false);
  });

  // MC-2, MC-3, A-52
  it("--repo equal to the working tree is accepted; another repository exits 2", async () => {
    await setup(loadModel("survey"));
    expect(run(["migrate", "projects", "--plan", "--repo", "acme/widgets"]).exitCode).toBe(0);
    expect(ghLog().some((a) => a[0] === "repo" && a[1] === "view")).toBe(true);
    rmSync(planAt(DEFAULT_PLAN));
    const r = run(["migrate", "projects", "--plan", "--repo=other/repo"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/other\/repo/);
    expect(existsSync(planAt(DEFAULT_PLAN))).toBe(false);
  });

  // MC-4
  it.each([["--out", "x/y.md"], ["--out=x/y.md"]])(
    "%s writes there and leaves the default path alone",
    async (...flag) => {
      await setup(loadModel("survey"));
      const r = run(["migrate", "projects", "--plan", ...flag.filter((f) => f !== undefined)]);
      expect(r.exitCode).toBe(0);
      expect(existsSync(planAt("x/y.md"))).toBe(true);
      expect(existsSync(planAt(DEFAULT_PLAN))).toBe(false);
    },
  );

  // MC-5, CT-35, A-64
  it("--json prints only the A-64 JSON on stdout", async () => {
    await setup(loadModel("survey"));
    const r = run(["migrate", "projects", "--plan", "--json"]);
    expect(r.exitCode).toBe(0);
    const json = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(json).toMatchObject({
      command: "migrate projects",
      mode: "plan",
      repo: "acme/widgets",
      planFile: DEFAULT_PLAN,
      review: {
        unmapped: 0,
        needsType: 6,
        needsBlockingLink: 2,
        stateFiles: 1,
        roadmap: 0,
        information: 2,
      },
      exitCode: 0,
    });
    const batches = json.batches as {
      name: string;
      pending: number;
      done: number;
      failed: number;
      skipped: number;
    }[];
    expect(batches.map((b) => b.name)).toEqual([
      "Labels",
      "Tracking issues",
      "Hierarchy",
      "Story and type labels",
      "Blocking links and priorities",
      "Retired labels",
      "Status comments",
      "Project cleanup",
    ]);
    expect(batches[0]).toEqual({ name: "Labels", pending: 0, done: 0, failed: 0, skipped: 0 });
  });

  // EC-116, A-65
  it("refuses with 14 to overwrite a plan with a non-pending row, file untouched", async () => {
    await setup(loadModel("survey"));
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
    mkdirSync(join(cwd, "workstream"), { recursive: true });
    writeFileSync(planAt(DEFAULT_PLAN), applied);
    const r = run(["migrate", "projects", "--plan"]);
    expect(r.exitCode).toBe(14);
    expect(r.stderr).toMatch(/--out/);
    expect(readFileSync(planAt(DEFAULT_PLAN), "utf-8")).toBe(applied);
  });
});

describe("auth first (AC-2, D-96)", () => {
  // MC-6, E2E-18
  it("unauthenticated: exit 11, the `gh auth login` hint, one gh call, no file", async () => {
    await setup(loadModel("survey"), { authFails: true });
    const r = run(["migrate", "projects", "--plan"]);
    expect(r.exitCode).toBe(11);
    expect(r.stderr).toContain("gh auth login");
    expect(ghLog()).toEqual([["auth", "status", "--hostname", "github.com"]]);
    expect(existsSync(planAt(DEFAULT_PLAN))).toBe(false);
  });

  // MC-7, EC-101
  it("no gh on PATH: exit 11 with the hint, no file, no stack trace", async () => {
    await setup(loadModel("survey"), { noGh: true });
    const r = run(["migrate", "projects", "--plan"]);
    expect(r.exitCode).toBe(11);
    expect(r.stderr).toContain("gh auth login");
    expect(r.stderr).not.toMatch(/\n\s+at /);
    expect(existsSync(planAt(DEFAULT_PLAN))).toBe(false);
  });

  it("a failing `gh repo view`: exit 11 (A-64)", async () => {
    await setup(loadModel("survey"), { repoViewFails: true });
    expect(run(["migrate", "projects", "--plan"]).exitCode).toBe(11);
  });
});

describe("flags (A-63)", () => {
  // MC-9
  it.each([
    [["migrate", "projects"]],
    [["migrate", "projects", "--plan", "--apply"]],
    [["migrate", "projects", "--plan", "--bogus"]],
    [["migrate", "projects", "--plan", "--force"]],
    [["migrate", "projects", "--plan", "--out"]],
    [["migrate", "projects", "--plan", "--plan-file", "p.md"]],
    [["migrate", "projects", "--plan", "extra"]],
    [["migrate", "projects", "--plan", "--repo", "not-a-repo"]],
  ])("%j exits 2 and touches nothing", async (args) => {
    await setup(loadModel("survey"));
    const r = run(args);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/migrate projects/);
    expect(ghLog()).toEqual([]);
  });

  it("--apply is not available yet and exits 2 before any gh call", async () => {
    await setup(loadModel("survey"));
    const r = run(["migrate", "projects", "--apply"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/--apply/);
    expect(ghLog()).toEqual([]);
  });

  it("an invalid DEV_TASKS_NOW is refused rather than written into the plan", async () => {
    await setup(loadModel("survey"));
    const r = spawnSync(process.execPath, [TSX_CLI, BIN, "migrate", "projects", "--plan"], {
      cwd,
      encoding: "utf-8",
      env: {
        PATH: pathDir,
        HOME: process.env.HOME ?? tmp,
        TSX_TSCONFIG_PATH: resolve(ROOT, "tsconfig.json"),
        DEV_TASKS_NOW: "yesterday",
        FAKE_GH_SCENARIO: join(tmp, "scenario.json"),
        FAKE_GH_LOG: join(tmp, "gh.log"),
      },
    });
    expect(r.status).toBe(2);
  });
});

describe("help (AC-1, MC-10)", () => {
  it("lists `migrate projects` right after the `migrate docs` entry", () => {
    const r = spawnSync(process.execPath, [TSX_CLI, BIN, "--help"], {
      cwd: ROOT,
      encoding: "utf-8",
    });
    const lines = (r.stdout + r.stderr).split("\n");
    const docs = lines.findIndex((l) => /^\s+migrate docs\b/.test(l));
    const projects = lines.findIndex((l) => /^\s+migrate projects --plan\b/.test(l));
    expect(docs).toBeGreaterThan(-1);
    expect(projects).toBeGreaterThan(docs);
    const between = lines.slice(docs + 1, projects);
    expect(
      between.every((l) => /^\s{10,}\S/.test(l)),
      "only the docs entry's continuation lines sit between",
    ).toBe(true);
    expect(lines.slice(projects, projects + 4).join("\n")).toMatch(
      /--repo <owner\/repo>.*--out <path>.*--json/s,
    );
  });
});
