/**
 * The migration plan file: render and parse (spec §5; §16a A-51, A-65,
 * A-77 to A-79, A-92).
 *
 * The file is the approval artifact and the durable record (D-93), read by
 * a person and by `--apply`, so the format is strict where a mistake could
 * cause a write and lenient where a person edits:
 *
 * - Header: `# Migration plan: <owner/repo>`, then `Format: 1`,
 *   `Generated:`, `Snapshot:` (SHA-256 of the snapshot), `Plan digest:`
 *   (SHA-256 over every batch row's ID, Action, Target and Detail) and
 *   `Approved: no`. Approval is exactly one line reading `Approved: yes`.
 *   Unknown header lines are kept and written back.
 * - `## Needs your answer`: one table per review list, then `## Batches`:
 *   one table per batch, in spec §8.3's order. Unknown sections are
 *   refused; extra columns are kept.
 * - Write IDs are `W-NNN`, widening past 999; the Action set is closed; a
 *   State follows the CT-28 grammar.
 * - Cells escape `\`, `|`, newlines and tabs, and an edge space, so any
 *   title or label name round-trips byte for byte. Only issue numbers,
 *   titles and label names ever appear: never an issue body (spec §12).
 */
import { createHash } from "node:crypto";

export const MIGRATION_PLAN_FORMAT = 1;

/** The closed set of write actions (CT-27, A-51); `--apply` builds argv only from these. */
export const MIGRATION_PLAN_ACTIONS = [
  "create-label",
  "edit-label",
  "create-issue",
  "add-label",
  "remove-label",
  "link-sub-issue",
  "add-blocked-by",
  "status-comment",
] as const;

export type MigrationPlanAction = (typeof MIGRATION_PLAN_ACTIONS)[number];
export type MigrationPlanRunner = "cli" | "user";

/** The batches, in spec §8.3's order, with 4b for blocking-link answers (A-73). */
export const MIGRATION_PLAN_BATCHES = [
  { key: "1", name: "Labels", runner: "cli" },
  { key: "2", name: "Tracking issues", runner: "cli" },
  { key: "3", name: "Hierarchy", runner: "cli" },
  { key: "4", name: "Story and type labels", runner: "cli" },
  { key: "4b", name: "Blocking links and priorities", runner: "cli" },
  { key: "5", name: "Retired labels", runner: "cli" },
  { key: "6", name: "Status comments", runner: "cli" },
  { key: "7", name: "Project cleanup", runner: "user" },
] as const satisfies ReadonlyArray<{ key: string; name: string; runner: MigrationPlanRunner }>;

export type MigrationPlanBatchKey = (typeof MIGRATION_PLAN_BATCHES)[number]["key"];

/** Cells in columns this version does not know, kept on write-back; absent when none. */
export type MigrationPlanExtra = Record<string, string>;

export interface MigrationPlanWrite {
  id: string;
  action: MigrationPlanAction;
  target: string;
  detail: string;
  dependsOn: string[];
  state: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanStep {
  id: string;
  step: string;
  /** `pending` or `done`: the user ticks a step by setting `done` (A-79). */
  state: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanBatch {
  key: MigrationPlanBatchKey;
  name: string;
  runner: MigrationPlanRunner;
  /** CLI batches carry writes. */
  writes: MigrationPlanWrite[];
  /** The user batch (7) carries steps. */
  steps: MigrationPlanStep[];
}

export interface MigrationPlanUnmapped {
  issue: number;
  title: string;
  why: string;
  answer: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanNeedsType {
  issue: number;
  title: string;
  currentTypeLabels: string[];
  suggested: string | null;
  answer: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanNeedsBlockingLink {
  issue: number;
  title: string;
  priority: string;
  answer: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanStateFile {
  file: string;
  note: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanRoadmapNote {
  row: string;
  note: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanInformation {
  ref: string;
  note: string;
  answer: string;
  extra?: MigrationPlanExtra;
}

export interface MigrationPlanReview {
  unmapped: MigrationPlanUnmapped[];
  needsType: MigrationPlanNeedsType[];
  needsBlockingLink: MigrationPlanNeedsBlockingLink[];
  stateFiles: MigrationPlanStateFile[];
  roadmap: MigrationPlanRoadmapNote[];
  information: MigrationPlanInformation[];
}

export interface MigrationPlan {
  repo: string;
  /** ISO-8601 UTC, second precision. */
  generated: string;
  /** SHA-256 hex of the snapshot the plan was built from. */
  snapshot: string;
  approved: boolean;
  /** Header lines this version does not know, kept in order. */
  extraHeaders: string[];
  review: MigrationPlanReview;
  batches: MigrationPlanBatch[];
}

export interface ParsedMigrationPlan {
  plan: MigrationPlan;
  /** The `Plan digest:` line as written; compare with `computePlanDigest(plan.batches)`. */
  planDigest: string;
}

export class MigrationPlanParseError extends Error {
  readonly line: number;
  constructor(line: number, message: string) {
    super(line > 0 ? `plan file line ${line}: ${message}` : `plan file: ${message}`);
    this.name = "MigrationPlanParseError";
    this.line = line;
  }
}

export function emptyMigrationPlanBatches(): MigrationPlanBatch[] {
  return MIGRATION_PLAN_BATCHES.map((b) => ({ ...b, writes: [], steps: [] }));
}

export function emptyMigrationPlanReview(): MigrationPlanReview {
  return {
    unmapped: [],
    needsType: [],
    needsBlockingLink: [],
    stateFiles: [],
    roadmap: [],
    information: [],
  };
}

/** `W-` plus the number, zero-padded to three digits or to the width of `total` (A-78). */
export function formatWriteId(n: number, total: number): string {
  const width = Math.max(3, String(Math.max(total, n)).length);
  return `W-${String(n).padStart(width, "0")}`;
}

/** SHA-256 over every CLI row's ID, Action, Target and Detail, in file order (A-51). */
export function computePlanDigest(batches: readonly MigrationPlanBatch[]): string {
  const rows = batches.flatMap((b) => b.writes.map((w) => [w.id, w.action, w.target, w.detail]));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

/** True when any write or step is not `pending`: the file is then a record, not a draft (A-65). */
export function planHasNonPendingRows(plan: MigrationPlan): boolean {
  return plan.batches.some(
    (b) =>
      b.writes.some((w) => w.state !== "pending") || b.steps.some((s) => s.state !== "pending"),
  );
}

// --- cells ----------------------------------------------------------------------

function escapeCore(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function escapeEdge(ch: string): string {
  return ch === " " ? "\\s" : `\\u{${ch.codePointAt(0)!.toString(16)}}`;
}

/** Escape a value for a table cell; a leading or trailing space survives the cell trim. */
export function escapeCell(value: string): string {
  let out = escapeCore(value);
  out = out.replace(/^\s/u, escapeEdge);
  out = out.replace(/\s$/u, escapeEdge);
  return out;
}

/** Undo `escapeCell`; an unknown escape is kept as typed. */
export function unescapeCell(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== "\\" || i === raw.length - 1) {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    const simple: Record<string, string> = {
      "\\": "\\",
      "|": "|",
      n: "\n",
      r: "\r",
      t: "\t",
      s: " ",
      "`": "`",
    };
    if (Object.hasOwn(simple, next)) {
      out += simple[next];
      i++;
      continue;
    }
    const u = raw.slice(i).match(/^\\u\{([0-9a-f]{1,6})\}/);
    if (u) {
      out += String.fromCodePoint(parseInt(u[1], 16));
      i += u[0].length - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function renderList(items: readonly string[]): string {
  return items.map((i) => `\`${escapeCore(i).replace(/`/g, "\\`")}\``).join(", ");
}

function parseList(raw: string, line: number): string[] {
  const items: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && /[\s,]/.test(raw[i])) i++;
    if (i >= raw.length) break;
    if (raw[i] !== "`") {
      // A hand-typed plain list: comma-separated names.
      return raw
        .split(",")
        .map((s) => unescapeCell(s.trim()))
        .filter((s) => s.length > 0);
    }
    let j = i + 1;
    let item = "";
    while (j < raw.length && raw[j] !== "`") {
      if (raw[j] === "\\" && j + 1 < raw.length) {
        item += raw.slice(j, j + 2);
        j += 2;
      } else {
        item += raw[j++];
      }
    }
    if (j >= raw.length)
      throw new MigrationPlanParseError(line, "unterminated `` ` `` in a label list");
    items.push(unescapeCell(item));
    i = j + 1;
  }
  return items;
}

/** Split a table line on unescaped `|`; cells are trimmed, not unescaped. */
function splitRow(line: string, lineNo: number): string[] {
  const t = line.trim();
  if (!t.startsWith("|") || !t.endsWith("|") || t.length < 2) {
    throw new MigrationPlanParseError(lineNo, "a table row must start and end with `|`");
  }
  const cells: string[] = [];
  let cur = "";
  for (let i = 1; i < t.length; i++) {
    const ch = t[i];
    if (ch === "\\" && i + 1 < t.length) {
      cur += ch + t[i + 1];
      i++;
    } else if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length > 0)
    throw new MigrationPlanParseError(lineNo, "a table row must end with `|`");
  return cells;
}

const SEPARATOR_CELL = /^:?-+:?$/;

// --- table specs ----------------------------------------------------------------

interface ColumnSpec<T> {
  header: string;
  /** Header text that also identifies this column (answer columns: any `Answer…`). */
  accepts?: (h: string) => boolean;
  render(row: T): string;
  parse(raw: string, row: Partial<T>, line: number): void;
}

interface TableSpec<T extends { extra?: MigrationPlanExtra }> {
  columns: ColumnSpec<T>[];
  make(partial: Partial<T>, line: number): T;
}

const ISSUE_CELL = /^#(\d+)$/;

function issueColumn<T extends { issue: number }>(): ColumnSpec<T> {
  return {
    header: "Issue",
    render: (r) => `#${r.issue}`,
    parse: (raw, row, line) => {
      const m = unescapeCell(raw).match(ISSUE_CELL);
      if (!m)
        throw new MigrationPlanParseError(
          line,
          `Issue cell must read #<number>, not ${JSON.stringify(raw)}`,
        );
      (row as { issue: number }).issue = Number(m[1]);
    },
  };
}

function textColumn<T>(header: string, key: keyof T & string): ColumnSpec<T> {
  return {
    header,
    render: (r) => escapeCell(String(r[key])),
    parse: (raw, row) => {
      (row as Record<string, unknown>)[key] = unescapeCell(raw);
    },
  };
}

function answerColumn<T extends { answer: string }>(header: string): ColumnSpec<T> {
  return {
    header,
    accepts: (h) => h.startsWith("Answer"),
    render: (r) => escapeCell(r.answer),
    parse: (raw, row) => {
      // A typed answer is trimmed; whitespace-only reads as empty.
      (row as { answer: string }).answer = unescapeCell(raw).replace(/^\s+|\s+$/g, "");
    },
  };
}

function required<T>(row: Partial<T>, keys: Array<keyof T & string>, line: number): T {
  for (const k of keys) {
    if (row[k] === undefined) throw new MigrationPlanParseError(line, `missing ${k}`);
  }
  return row as T;
}

const UNMAPPED: TableSpec<MigrationPlanUnmapped> = {
  columns: [
    issueColumn(),
    textColumn("Title", "title"),
    textColumn("Why", "why"),
    answerColumn('Answer (wave id, or "standalone")'),
  ],
  make: (p, l) => required(p, ["issue", "title", "why", "answer"], l),
};

const NEEDS_TYPE: TableSpec<MigrationPlanNeedsType> = {
  columns: [
    issueColumn(),
    textColumn("Title", "title"),
    {
      header: "Current type labels",
      render: (r) => renderList(r.currentTypeLabels),
      parse: (raw, row, line) => {
        row.currentTypeLabels = parseList(raw, line);
      },
    },
    {
      header: "Suggested",
      render: (r) => (r.suggested === null ? "—" : escapeCell(r.suggested)),
      parse: (raw, row) => {
        const v = unescapeCell(raw);
        row.suggested = v === "—" || v === "" ? null : v;
      },
    },
    answerColumn("Answer"),
  ],
  make: (p, l) => required(p, ["issue", "title", "currentTypeLabels", "suggested", "answer"], l),
};

const NEEDS_BLOCKING_LINK: TableSpec<MigrationPlanNeedsBlockingLink> = {
  columns: [
    issueColumn(),
    textColumn("Title", "title"),
    textColumn("Priority", "priority"),
    answerColumn('Answer (#issue it blocks, or "lower priority to high")'),
  ],
  make: (p, l) => required(p, ["issue", "title", "priority", "answer"], l),
};

const STATE_FILES: TableSpec<MigrationPlanStateFile> = {
  columns: [textColumn("File", "file"), textColumn("Note", "note")],
  make: (p, l) => required(p, ["file", "note"], l),
};

const ROADMAP_NOTES: TableSpec<MigrationPlanRoadmapNote> = {
  columns: [textColumn("Row", "row"), textColumn("Note", "note")],
  make: (p, l) => required(p, ["row", "note"], l),
};

const INFORMATION: TableSpec<MigrationPlanInformation> = {
  columns: [textColumn("Ref", "ref"), textColumn("Note", "note"), answerColumn("Answer")],
  make: (p, l) => required(p, ["ref", "note", "answer"], l),
};

const WRITE_ID = /^W-\d{3,}$/;
const WRITE_STATE = /^(pending|done|done\(#\d+\)|failed\(.+\)|skipped\(.+\))$/s;
const STEP_STATE = /^(pending|done)$/;

const WRITES: TableSpec<MigrationPlanWrite> = {
  columns: [
    textColumn("ID", "id"),
    {
      header: "Action",
      render: (r) => r.action,
      parse: (raw, row, line) => {
        const v = unescapeCell(raw);
        if (!(MIGRATION_PLAN_ACTIONS as readonly string[]).includes(v)) {
          throw new MigrationPlanParseError(
            line,
            `unknown action ${JSON.stringify(v)}; actions are ${MIGRATION_PLAN_ACTIONS.join(", ")}`,
          );
        }
        row.action = v as MigrationPlanAction;
      },
    },
    textColumn("Target", "target"),
    textColumn("Detail", "detail"),
    {
      header: "Depends on",
      render: (r) => r.dependsOn.join(", "),
      parse: (raw, row) => {
        row.dependsOn = unescapeCell(raw)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      },
    },
    {
      header: "State",
      render: (r) => escapeCell(r.state),
      parse: (raw, row, line) => {
        const v = unescapeCell(raw);
        if (!WRITE_STATE.test(v))
          throw new MigrationPlanParseError(line, `unknown state ${JSON.stringify(v)}`);
        row.state = v;
      },
    },
  ],
  make: (p, l) => required(p, ["id", "action", "target", "detail", "dependsOn", "state"], l),
};

const STEPS: TableSpec<MigrationPlanStep> = {
  columns: [
    textColumn("ID", "id"),
    textColumn("Step", "step"),
    {
      header: "State",
      render: (r) => escapeCell(r.state),
      parse: (raw, row, line) => {
        const v = unescapeCell(raw);
        if (!STEP_STATE.test(v)) {
          throw new MigrationPlanParseError(
            line,
            `step ${row.id ?? "?"} state must be pending or done, not ${JSON.stringify(v)}`,
          );
        }
        row.state = v;
      },
    },
  ],
  make: (p, l) => required(p, ["id", "step", "state"], l),
};

const REVIEW_SECTIONS = [
  { key: "unmapped", heading: "Unmapped issues (FR-18)", spec: UNMAPPED },
  { key: "needsType", heading: "Needs a type (D-85)", spec: NEEDS_TYPE },
  { key: "needsBlockingLink", heading: "Needs a blocking link (D-84)", spec: NEEDS_BLOCKING_LINK },
  { key: "stateFiles", heading: "State files (D-89)", spec: STATE_FILES },
  { key: "roadmap", heading: "Roadmap notes (D-86)", spec: ROADMAP_NOTES },
  { key: "information", heading: "Information", spec: INFORMATION },
] as const;

type ReviewKey = (typeof REVIEW_SECTIONS)[number]["key"];

function batchHeading(b: { key: string; name: string; runner: MigrationPlanRunner }): string {
  return `${b.key}. ${b.name} (${b.runner === "cli" ? "cli" : "you run these"})`;
}

// --- render ---------------------------------------------------------------------

function renderTable<T extends { extra?: MigrationPlanExtra }>(
  spec: TableSpec<T>,
  rows: readonly T[],
): string[] {
  const extras: string[] = [];
  for (const r of rows)
    for (const k of Object.keys(r.extra ?? {})) if (!extras.includes(k)) extras.push(k);
  const headers = [...spec.columns.map((c) => c.header), ...extras.map(escapeCell)];
  const out = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const r of rows) {
    const cells = [
      ...spec.columns.map((c) => c.render(r)),
      ...extras.map((k) => escapeCell(r.extra?.[k] ?? "")),
    ];
    out.push(`| ${cells.join(" | ")} |`);
  }
  return out;
}

export function renderMigrationPlan(plan: MigrationPlan): string {
  const out: string[] = [
    `# Migration plan: ${plan.repo}`,
    "",
    `Format: ${MIGRATION_PLAN_FORMAT}`,
    `Generated: ${plan.generated}`,
    `Snapshot: ${plan.snapshot}`,
    `Plan digest: ${computePlanDigest(plan.batches)}`,
    `Approved: ${plan.approved ? "yes" : "no"}`,
    ...plan.extraHeaders,
    "",
    "## Needs your answer",
    "",
    "Answer in the Answer column, then run `dev-tasks migrate projects --plan` again: it reads the answers and rebuilds the batches. Nothing is written to GitHub until the plan reads `Approved: yes` and `--apply` runs.",
    "",
  ];
  for (const s of REVIEW_SECTIONS) {
    out.push(`### ${s.heading}`, "");
    out.push(
      ...renderTable(
        s.spec as TableSpec<{ extra?: MigrationPlanExtra }>,
        plan.review[s.key] as Array<{ extra?: MigrationPlanExtra }>,
      ),
      "",
    );
  }
  out.push(
    "## Batches",
    "",
    "Each row is one write. `--apply` runs batches 1 to 6 in order and records each row's State; batch 7 is yours to run.",
    "",
  );
  for (const b of plan.batches) {
    out.push(`### ${batchHeading(b)}`, "");
    if (b.runner === "user") out.push(...renderTable(STEPS, b.steps), "");
    else out.push(...renderTable(WRITES, b.writes), "");
  }
  return out.join("\n");
}

// --- parse ----------------------------------------------------------------------

const HEADER_KEYS = ["Format", "Generated", "Snapshot", "Plan digest", "Approved"] as const;
const HEX64 = /^[0-9a-f]{64}$/;

interface TableState {
  name: string;
  headerLine: number;
  headers: string[] | null;
  separatorSeen: boolean;
  closed: boolean;
  rows: Array<{ cells: string[]; line: number }>;
}

function parseTable<T extends { extra?: MigrationPlanExtra }>(
  spec: TableSpec<T>,
  t: TableState,
): T[] {
  if (t.headers === null)
    throw new MigrationPlanParseError(t.headerLine, `section "${t.name}" has no table`);
  const headers = t.headers.map(unescapeCell);
  const index = spec.columns.map((c) =>
    headers.findIndex((h) => h === c.header || (c.accepts?.(h) ?? false)),
  );
  spec.columns.forEach((c, i) => {
    if (index[i] === -1)
      throw new MigrationPlanParseError(
        t.headerLine,
        `section "${t.name}" is missing the ${c.header} column`,
      );
  });
  const known = new Set(index);
  return t.rows.map(({ cells, line }) => {
    if (cells.length !== headers.length) {
      throw new MigrationPlanParseError(
        line,
        `row has ${cells.length} cells, the header has ${headers.length}`,
      );
    }
    const row: Partial<T> = {};
    spec.columns.forEach((c, i) => c.parse(cells[index[i]], row, line));
    const extra: MigrationPlanExtra = {};
    headers.forEach((h, i) => {
      if (!known.has(i)) {
        const v = unescapeCell(cells[i]);
        if (v.length > 0) extra[h] = v;
      }
    });
    const made = spec.make(row, line);
    return Object.keys(extra).length > 0 ? { ...made, extra } : made;
  });
}

export function parseMigrationPlan(text: string): ParsedMigrationPlan {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  const title = lines[0]?.match(/^# Migration plan: (\S+)$/);
  if (!title)
    throw new MigrationPlanParseError(1, "missing the `# Migration plan: <owner/repo>` line");

  // Header block: up to the first `## ` heading.
  const header: Partial<Record<(typeof HEADER_KEYS)[number], string>> = {};
  const extraHeaders: string[] = [];
  let approvedLines = 0;
  let i = 1;
  for (; i < lines.length && !lines[i].startsWith("## "); i++) {
    const line = lines[i];
    if (line.length === 0) continue;
    const m = line.match(/^(Format|Generated|Snapshot|Plan digest|Approved):(?: (.*))?$/);
    if (!m) {
      extraHeaders.push(line);
      continue;
    }
    const key = m[1] as (typeof HEADER_KEYS)[number];
    if (key === "Approved") {
      approvedLines++;
      header.Approved = line;
      continue;
    }
    if (header[key] !== undefined)
      throw new MigrationPlanParseError(i + 1, `duplicate ${key}: line`);
    header[key] = m[2] ?? "";
  }
  for (const key of HEADER_KEYS) {
    if (header[key] === undefined)
      throw new MigrationPlanParseError(0, `missing the \`${key}:\` header line`);
  }
  if (header.Format !== String(MIGRATION_PLAN_FORMAT)) {
    throw new MigrationPlanParseError(
      0,
      `unsupported Format: ${header.Format}; this version reads Format: ${MIGRATION_PLAN_FORMAT}`,
    );
  }
  if (!HEX64.test(header.Snapshot!))
    throw new MigrationPlanParseError(0, "Snapshot: must be 64 lowercase hex characters");
  if (!HEX64.test(header["Plan digest"]!))
    throw new MigrationPlanParseError(0, "Plan digest: must be 64 lowercase hex characters");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(header.Generated!)) {
    throw new MigrationPlanParseError(0, "Generated: must be an ISO-8601 UTC timestamp");
  }
  const approved = approvedLines === 1 && header.Approved === "Approved: yes";

  // Sections.
  const reviewTitles = new Map<string, ReviewKey>(REVIEW_SECTIONS.map((s) => [s.heading, s.key]));
  const batchTitles = new Map<string, MigrationPlanBatchKey>(
    MIGRATION_PLAN_BATCHES.map((b) => [batchHeading(b), b.key]),
  );
  const tables = new Map<string, TableState>();
  let part: "none" | "review" | "batches" = "none";
  let current: TableState | null = null;
  let seenReview = false;
  let seenBatches = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    if (line.startsWith("## ")) {
      current = null;
      if (line === "## Needs your answer" && !seenReview && !seenBatches) {
        part = "review";
        seenReview = true;
      } else if (line === "## Batches" && seenReview && !seenBatches) {
        part = "batches";
        seenBatches = true;
      } else {
        throw new MigrationPlanParseError(n, `unexpected section ${JSON.stringify(line)}`);
      }
      continue;
    }
    if (line.startsWith("### ")) {
      const name = line.slice(4);
      const id =
        part === "review"
          ? reviewTitles.get(name)
          : part === "batches"
            ? batchTitles.get(name)
            : undefined;
      if (id === undefined)
        throw new MigrationPlanParseError(n, `unknown section ${JSON.stringify(line)}`);
      const key = `${part}:${id}`;
      if (tables.has(key))
        throw new MigrationPlanParseError(n, `duplicate section ${JSON.stringify(line)}`);
      current = {
        name,
        headerLine: n,
        headers: null,
        separatorSeen: false,
        closed: false,
        rows: [],
      };
      tables.set(key, current);
      continue;
    }
    if (line.trimStart().startsWith("|")) {
      if (current === null) throw new MigrationPlanParseError(n, "a table outside any section");
      if (current.closed)
        throw new MigrationPlanParseError(n, `section "${current.name}" has a second table`);
      const cells = splitRow(line, n);
      if (current.headers === null) {
        current.headers = cells;
        current.headerLine = n;
      } else if (!current.separatorSeen) {
        if (!cells.every((c) => SEPARATOR_CELL.test(c)))
          throw new MigrationPlanParseError(n, "expected the table's separator row");
        current.separatorSeen = true;
      } else {
        current.rows.push({ cells, line: n });
      }
      continue;
    }
    if (current !== null && current.headers !== null) current.closed = true;
  }
  if (!seenReview)
    throw new MigrationPlanParseError(0, "missing the `## Needs your answer` section");
  if (!seenBatches) throw new MigrationPlanParseError(0, "missing the `## Batches` section");

  const table = (key: string, name: string): TableState => {
    const t = tables.get(key);
    if (t === undefined) throw new MigrationPlanParseError(0, `missing the "${name}" section`);
    return t;
  };

  const review = emptyMigrationPlanReview();
  for (const s of REVIEW_SECTIONS) {
    (review as Record<ReviewKey, unknown[]>)[s.key] = parseTable(
      s.spec as TableSpec<{ extra?: MigrationPlanExtra }>,
      table(`review:${s.key}`, s.heading),
    );
  }

  const batches = emptyMigrationPlanBatches();
  const ids = new Set<string>();
  for (const b of batches) {
    const t = table(`batches:${b.key}`, batchHeading(b));
    const rows = b.runner === "user" ? parseTable(STEPS, t) : parseTable(WRITES, t);
    for (const [k, row] of rows.entries()) {
      const line = t.rows[k].line;
      if (!WRITE_ID.test(row.id))
        throw new MigrationPlanParseError(line, `ID ${JSON.stringify(row.id)} must read W-NNN`);
      if (ids.has(row.id)) throw new MigrationPlanParseError(line, `duplicate ID ${row.id}`);
      if ("dependsOn" in row) {
        for (const d of row.dependsOn) {
          if (!ids.has(d))
            throw new MigrationPlanParseError(
              line,
              `${row.id} depends on ${d}, which is not an earlier row`,
            );
        }
      }
      ids.add(row.id);
    }
    if (b.runner === "user") b.steps = rows as MigrationPlanStep[];
    else b.writes = rows as MigrationPlanWrite[];
  }

  return {
    plan: {
      repo: title[1],
      generated: header.Generated!,
      snapshot: header.Snapshot!,
      approved,
      extraHeaders,
      review,
      batches,
    },
    planDigest: header["Plan digest"]!,
  };
}
