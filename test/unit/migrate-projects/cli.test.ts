/**
 * S-013 AC-1, AC-2 at Layer 2: the real binary, the real `execFile("gh")`
 * runner, and a fake `gh` placed alone (with a `node` symlink) on a
 * purpose-built `PATH`, with the clock injected through `DEV_TASKS_NOW`
 * (spec §16a A-63, A-64, A-85, A-88). MC-1 to MC-10, EC-101, EC-116.
 * S-015 AC-8 and the `--apply` CLI (MC-11 to MC-17, E2E-20 to E2E-24).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, spawnSync } from "node:child_process";
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
import { runMigrationApply } from "#core/migrate-projects/index.js";
import {
  emptyMigrationPlanBatches,
  parseMigrationPlan,
  renderMigrationPlan,
} from "#core/migrate-projects/planfile.js";
import {
  cloneModel,
  loadModel,
  respond,
  type FakeOptions,
  type GhResultLike,
  type RepoModel,
} from "./helpers/fake-github.js";
import { applyRunner, normalizeArgv } from "./helpers/fake-github-writes.js";
import { approve, memoryLock } from "./helpers/apply-run.js";
import { isWrite } from "./helpers/is-write.js";
import { memoryStore, planModel } from "./helpers/plan-run.js";
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
        // S-014: #10 and #11 carry `phase:` labels but no `[PRD-…]` prefix (D-98).
        unmapped: 2,
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
    // Counts equal the file's rows (CT-35).
    const file = readFileSync(planAt(DEFAULT_PLAN), "utf-8");
    const labelRows = file
      .slice(file.indexOf("### 1. Labels"), file.indexOf("### 2. Tracking issues"))
      .split("\n")
      .filter((l) => l.startsWith("| W-")).length;
    expect(labelRows).toBe(18);
    expect(batches[0]).toEqual({
      name: "Labels",
      pending: labelRows,
      done: 0,
      failed: 0,
      skipped: 0,
    });
    expect(batches[7]).toEqual({
      name: "Project cleanup",
      pending: 4,
      done: 0,
      failed: 0,
      skipped: 0,
    });
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

// S-014 AC-2 (task 4.2, S-013 audit F-3): a missing canonical table is a
// refusal, exit 2, with the pointer, not a roadmap note in a written plan.
describe("canonical roadmap first (S-014 AC-2, D-86)", () => {
  it.each([
    [
      "narrative",
      (m: RepoModel) => (m.files["docs/roadmap.md"] = "# Roadmap\n\nWave 1 shipped.\n"),
    ],
    ["missing", (m: RepoModel) => delete m.files["docs/roadmap.md"]],
  ])(
    "%s roadmap: exit 2, the pointer on stderr, no file, no GitHub read after the check (MC-8, E2E-19)",
    async (_name, edit) => {
      const model = loadModel("survey");
      edit(model);
      await setup(model);
      const r = run(["migrate", "projects", "--plan"]);
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/docs\/roadmap\.md (has no canonical table|is missing)/);
      expect(r.stderr).toContain("product-engineer's roadmap conversion");
      expect(r.stdout).toBe("");
      expect(existsSync(planAt(DEFAULT_PLAN))).toBe(false);
      expect(ghLog()).toEqual([
        ["auth", "status", "--hostname", "github.com"],
        ["repo", "view", "--json", "nameWithOwner"],
      ]);
    },
  );

  it("--json still prints the summary shape with exit code 2", async () => {
    const model = loadModel("survey");
    model.files["docs/roadmap.md"] = "# Roadmap\n";
    await setup(model);
    const r = run(["migrate", "projects", "--plan", "--json"]);
    expect(r.exitCode).toBe(2);
    expect(JSON.parse(r.stdout)).toMatchObject({
      exitCode: 2,
      error: expect.stringMatching(/product-engineer/),
    });
  });
});

describe("read failures (3.18, EC-157)", () => {
  it("a failed read exits 1, names the call on stderr, and writes no file", async () => {
    await setup(loadModel("survey"));
    const scenario = JSON.parse(readFileSync(join(tmp, "scenario.json"), "utf-8")) as {
      responses: Record<string, { stdout: string; stderr: string; exitCode: number }>;
    };
    const key = Object.keys(scenario.responses).find((k) => k.includes("/labels"))!;
    scenario.responses[key] = { stdout: "", stderr: "gh: Server Error (HTTP 500)\n", exitCode: 1 };
    writeFileSync(join(tmp, "scenario.json"), JSON.stringify(scenario));
    const r = run(["migrate", "projects", "--plan"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("labels");
    expect(r.stderr).toContain("HTTP 500");
    expect(r.stderr).not.toMatch(/\n\s+at /);
    expect(existsSync(planAt(DEFAULT_PLAN))).toBe(false);
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

  it.each([
    [["migrate", "projects", "--apply", "--repo", "acme/widgets"]],
    [["migrate", "projects", "--apply", "--out", "x.md"]],
    [["migrate", "projects", "--apply", "--plan-file"]],
    [["migrate", "projects", "--apply", "--force"]],
  ])("%j exits 2 before any gh call", async (args) => {
    await setup(loadModel("survey"));
    const r = run(args);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/migrate projects/);
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

// --- migrate projects --apply (S-015 AC-8, MC-11 to MC-17, E2E-20 to E2E-24) ------

interface ApplySetup {
  /** The plan file as written to the working tree. */
  text: string;
}

/**
 * Write the model's files and a plan for it (approved unless told not to),
 * then build the replay table from an in-process `--apply` over a copy of
 * the model, so the binary's run sees the answers GitHub would give.
 */
async function setupApply(
  model: RepoModel,
  options: {
    approved?: boolean;
    planFile?: string;
    /** Change the repository after the plan was generated (a stale snapshot). */
    after?: (m: RepoModel) => void;
    /** Replace the answer to a matching write. */
    failWrite?: (argv: readonly string[]) => GhResultLike | undefined;
    fake?: FakeOptions;
    text?: string;
  } = {},
): Promise<ApplySetup> {
  for (const [path, content] of Object.entries(model.files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  const planned = options.text ?? (await planModel(cloneModel(model))).text;
  const text = options.approved === false || options.text !== undefined ? planned : approve(planned);
  const planFile = options.planFile ?? DEFAULT_PLAN;
  mkdirSync(dirname(planAt(planFile)), { recursive: true });
  writeFileSync(planAt(planFile), text);

  const copy = cloneModel(model);
  options.after?.(copy);
  for (const [path, content] of Object.entries(copy.files)) writeFileSync(join(cwd, path), content);
  const rec = applyRunner(copy, { ...options.fake, onWrite: (argv) => options.failWrite?.(argv) });
  const responses: Record<string, GhResultLike> = {};
  await runMigrationApply({
    runner: async (args) => {
      const r = await rec.runner(args);
      responses[normalizeArgv(args).join("\u0001")] = r;
      return r;
    },
    reader: modelReader(copy),
    planFile,
    store: memoryStore({ [planFile]: text }),
    lock: memoryLock(),
  });
  writeFileSync(join(tmp, "scenario.json"), JSON.stringify({ responses }));
  symlinkSync(FAKE_GH, join(pathDir, "gh"));
  return { text };
}

const writesInLog = () => ghLog().filter((a) => isWrite(a));
const LOCK = "workstream/.migration-projects.lock";

describe("migrate projects --apply gates (S-015 AC-1, AC-2; MC-11, MC-12, MC-16, MC-17)", () => {
  // MC-11, E2E-20
  it("`Approved: no`: exit 14, zero write argv, plan file byte-identical", async () => {
    const { text } = await setupApply(loadModel("ac11"), { approved: false });
    const r = run(["migrate", "projects", "--apply"]);
    expect(r.exitCode).toBe(14);
    expect(r.stderr).toMatch(/Approved: yes/);
    expect(writesInLog()).toEqual([]);
    expect(readFileSync(planAt(DEFAULT_PLAN), "utf-8")).toBe(text);
    expect(existsSync(join(cwd, LOCK))).toBe(false);
  });

  // MC-12, E2E-21
  it("a stale snapshot: exit 14, `regenerate the plan`, zero writes, file byte-identical", async () => {
    const { text } = await setupApply(loadModel("ac11"), {
      after: (m) => m.issues.find((i) => i.number === 20)!.labels.push("type: chore"),
    });
    const r = run(["migrate", "projects", "--apply"]);
    expect(r.exitCode).toBe(14);
    expect(r.stderr).toMatch(/regenerate the plan/);
    expect(writesInLog()).toEqual([]);
    expect(readFileSync(planAt(DEFAULT_PLAN), "utf-8")).toBe(text);
  });

  // MC-16
  it("a missing or unparsable plan file: exit 2, no gh call", async () => {
    await setup(loadModel("ac11"));
    expect(run(["migrate", "projects", "--apply"]).exitCode).toBe(2);
    mkdirSync(join(cwd, "workstream"), { recursive: true });
    writeFileSync(planAt(DEFAULT_PLAN), "# not a plan\n");
    const r = run(["migrate", "projects", "--apply"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/plan file/);
    expect(ghLog()).toEqual([]);
  });

  // MC-17
  it("gh unauthenticated: exit 11 after the auth check alone", async () => {
    await setupApply(loadModel("ac11"), { fake: { authFails: true } });
    const r = run(["migrate", "projects", "--apply"]);
    expect(r.exitCode).toBe(11);
    expect(r.stderr).toContain("gh auth login");
    expect(ghLog()).toEqual([["auth", "status", "--hostname", "github.com"]]);
  });

  it("a lock file left by another run: exit 14, zero writes", async () => {
    await setupApply(loadModel("ac11"));
    writeFileSync(join(cwd, LOCK), "pid 1\n");
    const r = run(["migrate", "projects", "--apply"]);
    expect(r.exitCode).toBe(14);
    expect(r.stderr).toContain(LOCK);
    expect(writesInLog()).toEqual([]);
  });
});

describe("migrate projects --apply runs (S-015 AC-8; MC-13 to MC-15, E2E-22, E2E-24)", () => {
  // MC-13, E2E-22
  it("every write succeeds: exit 0, states recorded, batch 7 printed, the lock gone", async () => {
    await setupApply(loadModel("ac11"));
    const r = run(["migrate", "projects", "--apply"]);
    expect(r.stderr).toBe("");
    expect(r.exitCode).toBe(0);
    const plan = parseMigrationPlan(readFileSync(planAt(DEFAULT_PLAN), "utf-8")).plan;
    for (const w of plan.batches.flatMap((b) => b.writes)) expect(w.state, w.id).toMatch(/^(done|skipped)/);
    expect(r.stdout).toMatch(/gh project item-list/);
    expect(r.stdout).toMatch(/you run these/i);
    expect(r.stdout).toContain(DEFAULT_PLAN);
    expect(existsSync(join(cwd, LOCK))).toBe(false);
    for (const argv of ghLog()) expect(argv[0]).not.toBe("project");
  });

  // MC-13, E2E-24, EC-103
  it("one write fails: exit 1; `--json` counts equal the file", async () => {
    await setupApply(loadModel("ac11"), {
      failWrite: (argv) =>
        argv[0] === "issue" && argv[1] === "create"
          ? { stdout: "", stderr: "HTTP 422: Validation Failed\n{}", exitCode: 1 }
          : undefined,
    });
    const r = run(["migrate", "projects", "--apply", "--json"]);
    expect(r.exitCode).toBe(1);
    const json = JSON.parse(r.stdout) as {
      command: string;
      mode: string;
      repo: string;
      planFile: string;
      exitCode: number;
      review: Record<string, number>;
      batches: { name: string; pending: number; done: number; failed: number; skipped: number }[];
    };
    expect(json).toMatchObject({
      command: "migrate projects",
      mode: "apply",
      repo: "acme/gizmos",
      planFile: DEFAULT_PLAN,
      exitCode: 1,
    });
    expect(json.review).toMatchObject({ unmapped: 2, needsType: 2 });
    const plan = parseMigrationPlan(readFileSync(planAt(DEFAULT_PLAN), "utf-8")).plan;
    const counted = plan.batches.map((b) => {
      const rows = [...b.writes, ...b.steps];
      const n = (p: RegExp) => rows.filter((x) => p.test(x.state)).length;
      return {
        name: b.name,
        pending: n(/^pending$/),
        done: n(/^done/),
        failed: n(/^failed/),
        skipped: n(/^skipped/),
      };
    });
    expect(json.batches).toEqual(counted);
    expect(json.batches[1]).toMatchObject({ name: "Tracking issues", failed: 1 });
    expect(json.batches[2]).toMatchObject({ name: "Hierarchy", skipped: 5 });
  });

  // MC-15
  it("--plan-file p.md reads and writes back p.md only", async () => {
    await setupApply(loadModel("ac11"), { planFile: "p.md" });
    const r = run(["migrate", "projects", "--apply", "--plan-file", "p.md"]);
    expect(r.exitCode).toBe(0);
    expect(readFileSync(planAt("p.md"), "utf-8")).toMatch(/\| done \|/);
    expect(existsSync(planAt(DEFAULT_PLAN))).toBe(false);
  });

  // E2E-23 at Layer 2: interrupted by a signal between calls, then resumed.
  it("interrupted mid-run by SIGINT: states so far kept, lock released; the resume repeats no done write", async () => {
    await setupApply(loadModel("ac11"));
    const child = spawn(process.execPath, [TSX_CLI, BIN, "migrate", "projects", "--apply"], {
      cwd,
      env: {
        PATH: pathDir,
        HOME: process.env.HOME ?? tmp,
        TMPDIR: process.env.TMPDIR ?? tmpdir(),
        TSX_TSCONFIG_PATH: resolve(ROOT, "tsconfig.json"),
        FAKE_GH_SCENARIO: join(tmp, "scenario.json"),
        FAKE_GH_LOG: join(tmp, "gh.log"),
        FAKE_GH_DELAY_MS: "150",
      },
    });
    const exited = new Promise<number | null>((done) => child.on("exit", (code) => done(code)));
    const deadline = Date.now() + 30_000;
    while (writesInLog().length < 3 && Date.now() < deadline) await new Promise((x) => setTimeout(x, 50));
    child.kill("SIGINT");
    const code = await exited;
    expect(code).not.toBe(0);
    expect(existsSync(join(cwd, LOCK))).toBe(false);
    const after = parseMigrationPlan(readFileSync(planAt(DEFAULT_PLAN), "utf-8")).plan;
    const done = after.batches.flatMap((b) => b.writes).filter((w) => w.state !== "pending");
    expect(done.length).toBeGreaterThan(0);
    expect(done.length).toBeLessThan(32);
    const firstLog = ghLog().filter((a) => isWrite(a)).map((a) => a.join(" "));
    rmSync(join(tmp, "gh.log"));

    const r = run(["migrate", "projects", "--apply"]);
    expect(r.exitCode).toBe(0);
    const doneArgv = new Set(firstLog.slice(0, done.length));
    for (const a of writesInLog()) expect(doneArgv.has(a.join(" ")), a.join(" ")).toBe(false);
    const final = parseMigrationPlan(readFileSync(planAt(DEFAULT_PLAN), "utf-8")).plan;
    for (const w of final.batches.flatMap((b) => b.writes)) expect(w.state, w.id).toMatch(/^(done|skipped)/);
  }, 60_000);
});
