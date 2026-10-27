/**
 * `dev-tasks migrate projects --apply` (S-015; spec §6, §8.4, §13; §16a
 * A-49 to A-51, A-64, A-67, A-80, A-82, A-93; D-22, D-27, D-79 to D-81,
 * D-88, D-91, D-92, D-101).
 *
 * The only writer in the module. It runs an approved plan's batches 1 to 6
 * in order and records each write's state in the plan file after its
 * call, so an interruption loses at most the write in flight and a re-run
 * resumes. It never runs batch 7 and never makes a Project call (D-81,
 * D-22): batch 7's steps are printed for the user. It never deletes
 * anything, never writes a title and never writes a Status (D-91, D-19,
 * D-27). Answers in the review tables never become writes here (A-50):
 * only batch rows do, and a fresh `--plan` turns answers into rows.
 *
 * Gates, in this order, each refusing with nothing written:
 *
 * 1. The plan file is missing, unparsable, or a row does not match its
 *    Action's grammar → `InvalidUsage` (2).
 * 2. `gh` is missing or unauthenticated → `DependencyError` (11).
 * 3. The header is not exactly one `Approved: yes` line → 14 (D-80).
 * 4. `Plan digest:` no longer matches the rows → 14 (A-51).
 * 5. The lock `workstream/.migration-projects.lock` is held → 14 (A-80).
 * 6. While every row still reads `pending`, the snapshot hash differs →
 *    14, "regenerate the plan" (D-101). Once any row is `done`, `failed`
 *    or `skipped`, the hash is not compared: the done writes themselves
 *    changed the repository.
 *
 * Every write then checks its own target first (D-101, A-49): already in
 * the desired state → `skipped(already applied)`; in neither the state the
 * plan expected nor the desired one → `failed(target changed)`. The state
 * it checks is the snapshot this run read at its start, advanced by each
 * write this run made; a status comment, the sensitive case, is re-read
 * just before its write. So a write that landed but whose state was never
 * recorded (a killed process, a failed write-back) is detected on the next
 * run, never repeated, and a created issue is found again by its exact
 * title instead of being created twice.
 *
 * States (CT-28): `pending`; `done`; `done(#N)` for a created issue, whose
 * number dependent rows resolve on this or a later run; `failed(<first
 * stderr line>)`; `skipped(already applied)`, or `skipped(already applied,
 * #N)` for a create found by its title; `skipped(depends on W-NNN)` when a
 * row it depends on is not applied. A re-run executes `pending`, `failed`
 * and `skipped(depends on …)` rows (the last were never attempted), never a
 * `done` or `skipped(already applied)` one (D-88).
 *
 * Argv is built only from a row's Action, Target and Detail, from the
 * closed Action set (A-51), every value as `--flag=value` and a label name
 * after `--` (A-93), so no value is ever read as an option. Bodies go
 * through `--body-file` (or `--field=body=@<file>` for an edit) in a temp
 * directory, each file removed after its call.
 */
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ExitCode } from "../exit-codes.js";
import { hasLabel } from "./conventions.js";
import { firstLine, GhNotFoundError, paginatedItems, type GhRunner } from "./gh.js";
import type { LocalReader } from "./local-reader.js";
import { TITLE_MAX } from "./plan.js";
import {
  computePlanDigest,
  MigrationPlanParseError,
  parseMigrationPlan,
  renderMigrationPlan,
  type MigrationPlan,
  type MigrationPlanWrite,
} from "./planfile.js";
import {
  AUTH_HINT,
  parseStatusRows,
  readSnapshot,
  snapshotHash,
  SnapshotError,
  SNAPSHOT_ERROR_EXIT,
  STATUS_MARKER,
  type MigrationSnapshot,
} from "./snapshot.js";
import { REVIEW_LABELS, summarizeMigrationPlan, type MigrationPlanSummary } from "./summary.js";

/** The lock against two concurrent runs, relative to the repository root (A-80). */
export const MIGRATION_APPLY_LOCK = "workstream/.migration-projects.lock";

/** The plan-file store `--apply` reads and writes back; see `createPlanFileStore`. */
export interface MigrationApplyStore {
  read(path: string): string | undefined;
  write(path: string, content: string): void;
}

export interface MigrationApplyLock {
  /** `false` when another run holds it. */
  acquire(): boolean;
  release(): void;
}

/** The real lock: a file created exclusively (`wx`), removed on release. */
export function createLockFile(path: string): MigrationApplyLock {
  let held = false;
  return {
    acquire() {
      mkdirSync(dirname(path), { recursive: true });
      let fd: number;
      try {
        fd = openSync(path, "wx");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") return false;
        throw err;
      }
      try {
        writeSync(fd, `pid ${process.pid}\nstarted ${new Date().toISOString()}\n`);
      } finally {
        closeSync(fd);
      }
      held = true;
      return true;
    },
    release() {
      if (!held) return;
      held = false;
      rmSync(path, { force: true });
    },
  };
}

/** Hooks for tests and tracing; never changes what is written. */
export interface MigrationApplyObserver {
  /** Called just before each write call, with the row's ID and the argv. */
  beforeWrite?(id: string, argv: readonly string[]): void;
}

export interface MigrationApplyRunOptions {
  runner: GhRunner;
  reader: LocalReader;
  /** `--plan-file`, as the user typed it. */
  planFile: string;
  store: MigrationApplyStore;
  lock: MigrationApplyLock;
  /** Where body files go; a fresh directory under the OS temp dir by default, removed after. */
  tmpDir?: string;
  observer?: MigrationApplyObserver;
}

export interface MigrationApplyRunResult {
  exitCode: number;
  repo: string | null;
  planFile: string;
  /** The plan file's counts after the run; `null` when it could not be read. */
  summary: MigrationPlanSummary | null;
  /** Batch 7's steps, printed for the user to run (D-81). */
  steps: string[];
  /** Set on a non-zero exit: what went wrong and what to do. */
  error?: string;
}

// --- row grammar (the plan.ts Detail table) ---------------------------------------

const ISSUE = /^#(\d+)$/;
const WRITE_REF = /^W-\d{3,}$/;
type Ref = { number: number } | { id: string };

type Row =
  | { action: "create-label"; name: string; color: string; description: string }
  | { action: "edit-label"; name: string; description: string }
  | { action: "create-issue"; template: "prd" | "wave"; label: string; title: string }
  | { action: "add-label" | "remove-label"; issue: Ref; label: string }
  | { action: "link-sub-issue"; parent: Ref; child: Ref }
  | { action: "add-blocked-by"; blocked: number; blocker: number }
  | {
      action: "status-comment";
      issue: Ref;
      mode: "create" | "add";
      rows: Array<{ wave: string; state: string; issue: Ref | null }>;
    };

const refOf = (text: string): Ref | null => {
  const m = text.match(ISSUE);
  if (m) return { number: Number(m[1]) };
  return WRITE_REF.test(text) ? { id: text } : null;
};

const labelName = (target: string): string | null =>
  target.startsWith("label:") && target.length > "label:".length && !/[\n\r\t]/.test(target)
    ? target.slice("label:".length)
    : null;

const validLabel = (name: string) => name.length > 0 && name.length <= 50 && !/[\n\r\t]/.test(name);

/** Parse one row by its Action's grammar, or say why it does not match. */
function parseRow(w: MigrationPlanWrite): Row | string {
  const d = w.detail;
  switch (w.action) {
    case "create-label": {
      const name = labelName(w.target);
      const m = d.match(/^color: ([0-9A-Fa-f]{6}); description: (.*)$/s);
      if (name === null || !validLabel(name)) return "Target must read label:<name>";
      if (!m) return "Detail must read `color: <HEX>; description: <text>`";
      if (m[2].length > 100 || /[\n\r]/.test(m[2]))
        return "a description is one line of at most 100 characters";
      return { action: w.action, name, color: m[1], description: m[2] };
    }
    case "edit-label": {
      const name = labelName(w.target);
      const m = d.match(/^description: (.*)$/s);
      if (name === null || !validLabel(name)) return "Target must read label:<name>";
      if (!m) return "Detail must read `description: <text>`";
      if (m[1].length > 100 || /[\n\r]/.test(m[1]))
        return "a description is one line of at most 100 characters";
      return { action: w.action, name, description: m[1] };
    }
    case "create-issue": {
      const m = d.match(/^template: (prd|wave); label: (level: prd|level: wave); title: (.+)$/s);
      if (w.target !== "new issue") return "Target must read `new issue`";
      if (!m) return "Detail must read `template: prd|wave; label: <level label>; title: <title>`";
      const template = m[1] as "prd" | "wave";
      if (m[2] !== `level: ${template}`) return "the label must be the template's `level:` label";
      const form =
        template === "prd" ? /^\[PRD-[^\]\s]+\] \S/ : /^\[PRD-[^\]\s]+\] Wave [^\s:]+: \S/;
      if (!form.test(m[3]) || /[\n\r]/.test(m[3]) || m[3].length > TITLE_MAX)
        return `the title must be a ${template} tracking-issue title of at most ${TITLE_MAX} characters`;
      return { action: w.action, template, label: m[2], title: m[3] };
    }
    case "add-label":
    case "remove-label": {
      const issue = refOf(w.target);
      if (issue === null || (w.action === "remove-label" && !("number" in issue)))
        return w.action === "add-label"
          ? "Target must read #<n> or W-<id>"
          : "Target must read #<n>";
      if (!validLabel(d)) return "Detail must be a label name";
      return { action: w.action, issue, label: d };
    }
    case "link-sub-issue": {
      const parent = refOf(w.target);
      const m = d.match(/^sub-issue (#\d+|W-\d{3,})$/);
      if (parent === null) return "Target must read #<n> or W-<id>";
      if (!m) return "Detail must read `sub-issue <#n or W-id>`";
      return { action: w.action, parent, child: refOf(m[1])! };
    }
    case "add-blocked-by": {
      const t = w.target.match(ISSUE);
      const m = d.match(/^blocked by #(\d+)$/);
      if (!t) return "Target must read #<n>";
      if (!m) return "Detail must read `blocked by #<n>`";
      if (t[1] === m[1]) return "an issue cannot block itself";
      return { action: w.action, blocked: Number(t[1]), blocker: Number(m[1]) };
    }
    case "status-comment": {
      const issue = refOf(w.target);
      const m = d.match(/^(create|add): (.+)$/s);
      if (issue === null) return "Target must read #<n> or W-<id>";
      if (!m) return "Detail must read `create: <rows>` or `add: <rows>`";
      const rows = [];
      for (const cell of m[2].split("; ")) {
        const x = cell.match(/^(.+?) = (.+), (—|#\d+|W-\d{3,})$/s);
        if (!x || /[|\n\r]/.test(cell))
          return `status row ${JSON.stringify(cell)} must read \`<wave> = <state>, <#n, W-id or —>\``;
        rows.push({ wave: x[1], state: x[2], issue: x[3] === "—" ? null : refOf(x[3]) });
      }
      return { action: w.action, issue, mode: m[1] as "create" | "add", rows };
    }
  }
}

/** The W- references a row's Target and Detail make. */
function rowRefs(row: Row): string[] {
  const refs: Ref[] = [];
  if (row.action === "add-label" || row.action === "remove-label") refs.push(row.issue);
  if (row.action === "link-sub-issue") refs.push(row.parent, row.child);
  if (row.action === "status-comment") {
    refs.push(row.issue);
    for (const r of row.rows) if (r.issue !== null) refs.push(r.issue);
  }
  return refs.flatMap((r) => ("id" in r ? [r.id] : []));
}

// --- states -------------------------------------------------------------------------

/** Applied: never run again (D-88). */
const isApplied = (state: string) =>
  /^done(\(#\d+\))?$|^skipped\(already applied(, #\d+)?\)$/.test(state);
/** Runnable on this run: never attempted, or attempted and failed. */
const isRunnable = (state: string) =>
  state === "pending" || state.startsWith("failed(") || state.startsWith("skipped(depends on ");
/** The issue number a create row recorded, if any. */
const createdNumber = (state: string): number | null => {
  const m = state.match(/^(?:done\(#(\d+)\)|skipped\(already applied, #(\d+)\))$/);
  return m ? Number(m[1] ?? m[2]) : null;
};

const failedState = (stderr: string, exitCode: number) => {
  const line = firstLine(stderr) || `exit ${exitCode}`;
  return `failed(${line})`;
};

// --- the run's view of the repository --------------------------------------------

interface LiveIssue {
  number: number;
  /** REST numeric id; read on first need for an issue this run created. */
  id?: number;
  title: string;
  labels: string[];
  /** Parent number; `undefined` when not read. */
  parent?: number | null;
  /** What it blocks; `undefined` when not read. */
  blocking?: number[];
}

class Live {
  readonly labels = new Map<string, { name: string; description: string }>();
  readonly issues = new Map<number, LiveIssue>();
  constructor(snapshot: MigrationSnapshot) {
    for (const l of snapshot.labels) this.labels.set(l.name.toLowerCase(), { ...l });
    for (const i of snapshot.openIssues) {
      this.issues.set(i.number, {
        number: i.number,
        id: i.id,
        title: i.title,
        labels: [...i.labels],
        parent: i.parent,
        blocking: i.blocking === undefined ? undefined : [...i.blocking],
      });
    }
  }
  label(name: string) {
    return this.labels.get(name.toLowerCase());
  }
}

/** Paginated list items, or `null` when the output is not JSON. */
function readItems(text: string): unknown[] | null {
  try {
    return paginatedItems(text);
  } catch {
    return null;
  }
}

/** JSON from a read, or `undefined` when it is not JSON: that fails the row, never the run. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Interrupts the run: a thrown runner error or a failed write-back (A-80). */
class Interrupted extends Error {
  constructor(
    readonly id: string,
    readonly cause: unknown,
    readonly writeBack = false,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

// --- bodies -----------------------------------------------------------------------

function trackingBody(row: Extract<Row, { action: "create-issue" }>): string {
  const credit = "created by `dev-tasks migrate projects --apply`";
  if (row.template === "prd") {
    const m = row.title.match(/^\[PRD-([^\]]+)\] (.+)$/s)!;
    return [
      `# ${m[2]}`,
      "",
      `PRD: [docs/requirements/prd-${m[1]}.md](/docs/requirements/prd-${m[1]}.md)`,
      "Roadmap: [docs/roadmap.md](/docs/roadmap.md)",
      "",
      "## Waves",
      "",
      `The waves are this issue's sub-issues, and its status comment lists them; ${credit}.`,
      "",
    ].join("\n");
  }
  const m = row.title.match(/^\[PRD-([^\]]+)\] Wave ([^\s:]+): (.+)$/s)!;
  return [
    `Scope: ${m[3]}`,
    "Integration branch: TBD",
    "",
    "## Artifacts",
    "",
    "- Specification: pending",
    "- Stories: pending",
    "- Task plan: pending",
    "",
    "## Stories",
    "",
    `The stories are this issue's sub-issues; ${credit}.`,
    "",
  ].join("\n");
}

const statusLine = (r: { wave: string; state: string; issue: string }) =>
  `| ${r.wave} | ${r.state} | ${r.issue} |`;

/** A new PRD status comment: the marker first, the prefix line, the table (github-ops § Status comment). */
function statusCommentBody(
  issue: number,
  rows: Array<{ wave: string; state: string; issue: string }>,
): string {
  return [
    STATUS_MARKER,
    `🔄 Update: migrated to projects-tracking by \`dev-tasks migrate projects --apply\` — Refs #${issue}`,
    "",
    "| Wave | State | Wave issue |",
    "| ---- | ----- | ---------- |",
    ...rows.map(statusLine),
    "",
  ].join("\n");
}

/** The existing comment with `rows` added after its PRD table's last row; nothing else changes (A-67). */
function withRows(
  body: string,
  rows: Array<{ wave: string; state: string; issue: string }>,
): string {
  const eol = body.includes("\r\n") ? "\r\n" : "\n";
  const lines = body.split(/\r?\n/);
  const header = lines.findIndex((l) => {
    const cells = l
      .trim()
      .split("|")
      .map((c) => c.trim());
    return l.trim().startsWith("|") && cells[1] === "Wave" && cells[3] === "Wave issue";
  });
  const added = rows.map(statusLine);
  if (header === -1) {
    const table = ["| Wave | State | Wave issue |", "| ---- | ----- | ---------- |", ...added];
    return [...lines, "", ...table].join(eol);
  }
  let end = header + 1;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  return [...lines.slice(0, end), ...added, ...lines.slice(end)].join(eol);
}

// --- the run ----------------------------------------------------------------------

interface Context {
  repo: string;
  runner: GhRunner;
  live: Live;
  byId: Map<string, MigrationPlanWrite>;
  parsed: Map<string, Row>;
  bodyDir: () => string;
  observer?: MigrationApplyObserver;
}

let bodyCount = 0;

async function withBody<T>(
  ctx: Context,
  content: string,
  use: (path: string) => Promise<T>,
): Promise<T> {
  const path = join(ctx.bodyDir(), `body-${process.pid}-${++bodyCount}.md`);
  writeFileSync(path, content);
  try {
    return await use(path);
  } finally {
    rmSync(path, { force: true });
  }
}

/** A read the row needs; a non-zero exit fails the row with its reason. */
async function read(
  ctx: Context,
  argv: string[],
): Promise<{ ok: true; stdout: string } | { ok: false; state: string }> {
  const r = await ctx.runner(argv);
  return r.exitCode === 0
    ? { ok: true, stdout: r.stdout }
    : { ok: false, state: failedState(r.stderr, r.exitCode) };
}

async function write(ctx: Context, id: string, argv: string[]) {
  ctx.observer?.beforeWrite?.(id, argv);
  return ctx.runner(argv);
}

/** Resolve a row's W- reference to the issue its create row made, checking it is that issue. */
function resolveRef(ctx: Context, ref: Ref): { number: number } | { state: string } {
  if ("number" in ref) return ref;
  const create = ctx.byId.get(ref.id)!;
  const n = createdNumber(create.state);
  if (n === null) return { state: `failed(${ref.id} has no recorded issue number)` };
  // A hand-edited record must never redirect a write: #N must be the issue the row created (D-101).
  const issue = ctx.live.issues.get(n);
  const title = (ctx.parsed.get(ref.id) as Extract<Row, { action: "create-issue" }>).title;
  if (issue === undefined || issue.title !== title) return { state: "failed(target changed)" };
  return { number: n };
}

async function issueId(ctx: Context, n: number): Promise<number | { state: string }> {
  const issue = ctx.live.issues.get(n)!;
  if (issue.id !== undefined) return issue.id;
  const r = await read(ctx, ["api", `repos/${ctx.repo}/issues/${n}`]);
  if (!r.ok) return { state: r.state };
  const id = (parseJson(r.stdout) as { id?: unknown } | undefined)?.id;
  if (typeof id !== "number") return { state: `failed(no id for #${n})` };
  issue.id = id;
  return id;
}

/** Run one row: check its target, write, and return its new state. */
async function runRow(ctx: Context, w: MigrationPlanWrite): Promise<string> {
  const row = ctx.parsed.get(w.id)!;
  for (const dep of [...new Set([...w.dependsOn, ...rowRefs(row)])]) {
    const s = ctx.byId.get(dep)?.state ?? "";
    if (!isApplied(s)) return `skipped(depends on ${dep})`;
  }
  const { live, repo } = ctx;
  const repoFlag = `--repo=${repo}`;
  const CHANGED = "failed(target changed)";
  const APPLIED = "skipped(already applied)";
  const comma = (l: string) =>
    l.includes(",")
      ? "failed(label name contains a comma, which gh splits; apply it by hand)"
      : null;

  switch (row.action) {
    case "create-label": {
      const l = live.label(row.name);
      if (l !== undefined) return l.description === row.description ? APPLIED : CHANGED;
      const r = await write(ctx, w.id, [
        "label",
        "create",
        repoFlag,
        `--color=${row.color}`,
        `--description=${row.description}`,
        "--",
        row.name,
      ]);
      if (r.exitCode !== 0) return failedState(r.stderr, r.exitCode);
      live.labels.set(row.name.toLowerCase(), { name: row.name, description: row.description });
      return "done";
    }
    case "edit-label": {
      const l = live.label(row.name);
      if (l === undefined) return CHANGED;
      if (l.description === row.description) return APPLIED;
      const r = await write(ctx, w.id, [
        "label",
        "edit",
        repoFlag,
        `--description=${row.description}`,
        "--",
        row.name,
      ]);
      if (r.exitCode !== 0) return failedState(r.stderr, r.exitCode);
      l.description = row.description;
      return "done";
    }
    case "create-issue": {
      const same = [...live.issues.values()].filter((i) => i.title === row.title);
      if (same.length === 1 && hasLabel(same[0].labels, row.label))
        return `skipped(already applied, #${same[0].number})`;
      if (same.length > 0) return CHANGED;
      const r = await withBody(ctx, trackingBody(row), (path) =>
        write(ctx, w.id, [
          "issue",
          "create",
          repoFlag,
          `--title=${row.title}`,
          `--label=${row.label}`,
          `--body-file=${path}`,
        ]),
      );
      if (r.exitCode !== 0) return failedState(r.stderr, r.exitCode);
      const m = r.stdout.match(/\/issues\/(\d+)\s*$/m);
      if (!m)
        return `failed(created, but gh printed no issue URL: ${firstLine(r.stdout) || "empty output"})`;
      const n = Number(m[1]);
      live.issues.set(n, {
        number: n,
        title: row.title,
        labels: [row.label],
        parent: null,
        blocking: [],
      });
      return `done(#${n})`;
    }
    case "add-label":
    case "remove-label": {
      const ref = resolveRef(ctx, row.issue);
      if ("state" in ref) return ref.state;
      const issue = live.issues.get(ref.number);
      if (issue === undefined) return CHANGED;
      const present = hasLabel(issue.labels, row.label);
      if (row.action === "add-label" ? present : !present) return APPLIED;
      const bad = comma(row.label);
      if (bad !== null) return bad;
      const flag = row.action === "add-label" ? "--add-label" : "--remove-label";
      const r = await write(ctx, w.id, [
        "issue",
        "edit",
        String(ref.number),
        repoFlag,
        `${flag}=${row.label}`,
      ]);
      if (r.exitCode !== 0) return failedState(r.stderr, r.exitCode);
      issue.labels =
        row.action === "add-label"
          ? [...issue.labels, live.label(row.label)?.name ?? row.label]
          : issue.labels.filter((l) => l.toLowerCase() !== row.label.toLowerCase());
      return "done";
    }
    case "link-sub-issue": {
      const parent = resolveRef(ctx, row.parent);
      if ("state" in parent) return parent.state;
      const child = resolveRef(ctx, row.child);
      if ("state" in child) return child.state;
      const c = live.issues.get(child.number);
      if (c === undefined || !live.issues.has(parent.number)) return CHANGED;
      if (c.parent === undefined) {
        const r = await ctx.runner(["api", `repos/${repo}/issues/${child.number}/parent`]);
        if (r.exitCode !== 0 && !/HTTP 404/.test(r.stderr))
          return failedState(r.stderr, r.exitCode);
        const parentNumber = (parseJson(r.stdout) as { number?: unknown } | undefined)?.number;
        if (r.exitCode === 0 && typeof parentNumber !== "number")
          return `failed(unreadable parent of #${child.number})`;
        c.parent = r.exitCode === 0 ? (parentNumber as number) : null;
      }
      if (c.parent === parent.number) return APPLIED;
      if (c.parent !== null) return CHANGED;
      const id = await issueId(ctx, child.number);
      if (typeof id !== "number") return id.state;
      const r = await write(ctx, w.id, [
        "api",
        "-X",
        "POST",
        `repos/${repo}/issues/${parent.number}/sub_issues`,
        `--field=sub_issue_id=${id}`,
      ]);
      if (r.exitCode !== 0) return failedState(r.stderr, r.exitCode);
      c.parent = parent.number;
      return "done";
    }
    case "add-blocked-by": {
      const blocker = live.issues.get(row.blocker);
      if (blocker === undefined || !live.issues.has(row.blocked)) return CHANGED;
      if (blocker.blocking === undefined) {
        const r = await read(ctx, [
          "api",
          "--paginate",
          `repos/${repo}/issues/${row.blocker}/dependencies/blocking?per_page=100`,
        ]);
        if (!r.ok) return r.state;
        const items = readItems(r.stdout);
        if (items === null) return `failed(unreadable blocking list of #${row.blocker})`;
        blocker.blocking = items.map((i) => (i as { number: number }).number);
      }
      if (blocker.blocking.includes(row.blocked)) return APPLIED;
      const id = await issueId(ctx, row.blocker);
      if (typeof id !== "number") return id.state;
      const r = await write(ctx, w.id, [
        "api",
        "-X",
        "POST",
        `repos/${repo}/issues/${row.blocked}/dependencies/blocked_by`,
        `--field=issue_id=${id}`,
      ]);
      if (r.exitCode !== 0) return failedState(r.stderr, r.exitCode);
      blocker.blocking.push(row.blocked);
      return "done";
    }
    case "status-comment": {
      const target = resolveRef(ctx, row.issue);
      if ("state" in target) return target.state;
      if (!live.issues.has(target.number)) return CHANGED;
      const rows: Array<{ wave: string; state: string; issue: string }> = [];
      for (const r of row.rows) {
        if (r.issue === null) rows.push({ wave: r.wave, state: r.state, issue: "—" });
        else {
          const n = resolveRef(ctx, r.issue);
          if ("state" in n) return n.state;
          rows.push({ wave: r.wave, state: r.state, issue: `#${n.number}` });
        }
      }
      // The marker procedure, read just before the write (github-ops § Status comment, D-92).
      const list = await read(ctx, [
        "api",
        "--paginate",
        `repos/${repo}/issues/${target.number}/comments?per_page=100`,
      ]);
      if (!list.ok) return list.state;
      const comments = readItems(list.stdout);
      if (comments === null) return `failed(unreadable comments of #${target.number})`;
      const marked = comments
        .map((c) => c as { id?: unknown; body?: unknown })
        .filter(
          (c): c is { id: number; body: string } =>
            typeof c.id === "number" &&
            typeof c.body === "string" &&
            c.body.startsWith(STATUS_MARKER),
        )
        .sort((a, b) => a.id - b.id);
      if (marked.length === 0) {
        if (row.mode === "add") return CHANGED;
        const r = await withBody(ctx, statusCommentBody(target.number, rows), (path) =>
          write(ctx, w.id, [
            "issue",
            "comment",
            String(target.number),
            repoFlag,
            `--body-file=${path}`,
          ]),
        );
        return r.exitCode === 0 ? "done" : failedState(r.stderr, r.exitCode);
      }
      const present = new Set(parseStatusRows(marked[0].body).map((r) => r.wave));
      const missing = rows.filter((r) => !present.has(r.wave));
      if (missing.length === 0) return APPLIED;
      if (row.mode === "create") return CHANGED;
      const r = await withBody(ctx, withRows(marked[0].body, missing), (path) =>
        write(ctx, w.id, [
          "api",
          "-X",
          "PATCH",
          `repos/${repo}/issues/comments/${marked[0].id}`,
          `--field=body=@${path}`,
        ]),
      );
      return r.exitCode === 0 ? "done" : failedState(r.stderr, r.exitCode);
    }
  }
}

function result(
  exitCode: number,
  planFile: string,
  plan: MigrationPlan | null,
  error?: string,
): MigrationApplyRunResult {
  const summary = plan === null ? null : summarizeMigrationPlan(plan);
  if (summary !== null) {
    const writes = plan!.batches.flatMap((b) => b.writes);
    summary.next =
      error !== undefined
        ? "fix the cause above, then run --apply again"
        : writes.some((w) => w.state.startsWith("failed("))
          ? "fix what failed (the State column says why), then run --apply again"
          : writes.some((w) => isRunnable(w.state))
            ? "run --apply again to finish the writes left"
            : "run the Project batch (batch 7) with your own session, then set each step's State to done";
  }
  return {
    exitCode,
    repo: plan?.repo ?? null,
    planFile,
    summary,
    steps: plan?.batches.flatMap((b) => b.steps.map((s) => s.step)) ?? [],
    ...(error !== undefined ? { error } : {}),
  };
}

/** `migrate projects --apply`. Returns an exit code from `core/exit-codes.ts`; never throws for an expected failure. */
export async function runMigrationApply(
  options: MigrationApplyRunOptions,
): Promise<MigrationApplyRunResult> {
  const { planFile, store, runner } = options;

  // 1. The plan file, every row by its grammar (A-51).
  const text = store.read(planFile);
  if (text === undefined)
    return result(
      ExitCode.InvalidUsage,
      planFile,
      null,
      `${planFile} not found; run --plan first, review it, and approve it`,
    );
  let plan: MigrationPlan;
  let digest: string;
  try {
    ({ plan, planDigest: digest } = parseMigrationPlan(text));
  } catch (err) {
    if (!(err instanceof MigrationPlanParseError)) throw err;
    return result(
      ExitCode.InvalidUsage,
      planFile,
      null,
      `${planFile} is not a valid migration plan (${err.message})`,
    );
  }
  const writes = plan.batches.filter((b) => b.runner === "cli").flatMap((b) => b.writes);
  const byId = new Map(writes.map((w) => [w.id, w]));
  const parsed = new Map<string, Row>();
  for (const w of writes) {
    const row = parseRow(w);
    if (typeof row === "string")
      return result(
        ExitCode.InvalidUsage,
        planFile,
        null,
        `${planFile}: ${w.id} (${w.action}): ${row}`,
      );
    for (const ref of rowRefs(row)) {
      if (byId.get(ref)?.action !== "create-issue")
        return result(
          ExitCode.InvalidUsage,
          planFile,
          null,
          `${planFile}: ${w.id} refers to ${ref}, which is not a create-issue row`,
        );
    }
    parsed.set(w.id, row);
  }

  // 2. gh (D-96, A-88).
  try {
    const auth = await runner(["auth", "status", "--hostname", "github.com"]);
    if (auth.exitCode !== 0)
      return result(
        ExitCode.DependencyError,
        planFile,
        plan,
        `gh is not authenticated to github.com (${firstLine(auth.stderr) || `exit ${auth.exitCode}`}); ${AUTH_HINT}`,
      );
  } catch (err) {
    if (err instanceof GhNotFoundError)
      return result(
        ExitCode.DependencyError,
        planFile,
        plan,
        `gh is not installed or not on PATH; install it, then ${AUTH_HINT}`,
      );
    throw err;
  }

  // 3. Approval (D-80, A-79) and 4. the digest (A-51).
  if (!plan.approved)
    return result(
      ExitCode.ReconciliationConflict,
      planFile,
      plan,
      `${planFile} is not approved: its header must hold exactly one line reading \`Approved: yes\`; review the plan, then approve it`,
    );
  if (computePlanDigest(plan.batches) !== digest)
    return result(
      ExitCode.ReconciliationConflict,
      planFile,
      plan,
      `${planFile}'s Plan digest: no longer matches its rows (a row was edited after the plan was generated); run --plan again and approve the new plan`,
    );

  // 5. The lock (A-80).
  if (!options.lock.acquire())
    return result(
      ExitCode.ReconciliationConflict,
      planFile,
      plan,
      `another --apply holds ${MIGRATION_APPLY_LOCK}; wait for it to finish, or remove the file if no run is active`,
    );
  let ownDir: string | null = null;
  try {
    if (store.read(planFile) !== text)
      return result(
        ExitCode.ReconciliationConflict,
        planFile,
        plan,
        `${planFile} changed while --apply started; run --apply again`,
      );
    if (!writes.some((w) => isRunnable(w.state))) return result(ExitCode.Success, planFile, plan);

    // 6. The snapshot: compared only while every row is pending (D-101).
    let snapshot: MigrationSnapshot;
    try {
      snapshot = await readSnapshot({ runner, reader: options.reader, repo: plan.repo });
    } catch (err) {
      if (err instanceof SnapshotError)
        return result(SNAPSHOT_ERROR_EXIT[err.kind], planFile, plan, err.message);
      throw err;
    }
    if (writes.every((w) => w.state === "pending") && snapshotHash(snapshot) !== plan.snapshot)
      return result(
        ExitCode.ReconciliationConflict,
        planFile,
        plan,
        "the repository changed since the plan was generated (its snapshot hash differs); regenerate the plan with --plan and approve it again",
      );

    const ctx: Context = {
      repo: snapshot.repo,
      runner,
      live: new Live(snapshot),
      byId,
      parsed,
      observer: options.observer,
      bodyDir: () => {
        if (options.tmpDir !== undefined) return options.tmpDir;
        ownDir ??= mkdtempSync(join(tmpdir(), "dev-tasks-migrate-"));
        return ownDir;
      },
    };
    for (const w of writes) {
      if (!isRunnable(w.state)) continue;
      let state: string;
      try {
        state = await runRow(ctx, w);
      } catch (err) {
        throw new Interrupted(w.id, err);
      }
      if (state === w.state) continue;
      const previous = w.state;
      w.state = state;
      try {
        store.write(planFile, renderMigrationPlan(plan));
      } catch (err) {
        // The file still holds the previous state; so must the result (F-6).
        w.state = previous;
        throw new Interrupted(w.id, err, true);
      }
    }
  } catch (err) {
    if (!(err instanceof Interrupted)) throw err;
    return result(
      ExitCode.GeneralError,
      planFile,
      plan,
      err.writeBack
        ? `could not record ${err.id}'s state in ${planFile} (${err.message}); the write may have landed: run --apply again, which checks it first (if no state was recorded yet, it will ask you to regenerate the plan with --plan)`
        : `interrupted at ${err.id} (${err.message}); the states so far are in ${planFile}: run --apply again to resume`,
    );
  } finally {
    options.lock.release();
    if (ownDir !== null) rmSync(ownDir, { recursive: true, force: true });
  }

  const failed = writes.some((w) => w.state.startsWith("failed("));
  return result(failed ? ExitCode.GeneralError : ExitCode.Success, planFile, plan);
}

// --- output -------------------------------------------------------------------------

/** The one-screen summary: per-batch states, what still waits for an answer, batch 7's steps. */
export function formatMigrationApplySummary(r: MigrationApplyRunResult): string {
  if (r.summary === null) return `migrate projects --apply: ${r.error ?? "failed"}`;
  const s = r.summary;
  const lines = [`Migration apply for ${r.repo}`, "", "Batches:"];
  for (const b of s.batches) {
    if (b.runner === "user") {
      lines.push(
        `  ${b.key}. ${b.name} (you run these): ${b.done} of ${b.pending + b.done} steps done`,
      );
      continue;
    }
    lines.push(
      `  ${b.key}. ${b.name}: ${b.done} done, ${b.skipped} skipped, ${b.failed} failed, ${b.pending} pending`,
    );
  }
  lines.push("", "Needs your answer (no write until answered and planned again):");
  for (const [k, label] of Object.entries(REVIEW_LABELS))
    lines.push(`  ${label}: ${s.review[k as keyof typeof REVIEW_LABELS]}`);
  if (r.steps.length > 0) {
    lines.push("", "Project cleanup (you run these; --apply never does):");
    r.steps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`));
  }
  lines.push("", `Plan file: ${r.planFile}`, `Next: ${s.next}`);
  return lines.join("\n");
}

/** The `--json` shape (A-64), `mode: "apply"`. */
export function migrationApplyJson(r: MigrationApplyRunResult): Record<string, unknown> {
  return {
    command: "migrate projects",
    mode: "apply",
    repo: r.repo,
    planFile: r.planFile,
    batches: (r.summary?.batches ?? []).map((b) => ({
      name: b.name,
      pending: b.pending,
      done: b.done,
      failed: b.failed,
      skipped: b.skipped,
    })),
    review: r.summary?.review ?? null,
    exitCode: r.exitCode,
    ...(r.error !== undefined ? { error: r.error } : {}),
  };
}
