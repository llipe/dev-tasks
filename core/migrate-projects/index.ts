/**
 * `dev-tasks migrate projects` (D-79): the module entry.
 *
 * `--plan` reads a snapshot, classifies it, and writes the migration plan
 * file. It never writes to GitHub (FR-17, AC-6), and the file never holds an
 * issue body (spec §12). It maps stories to waves (FR-18), batches the
 * writes the scope rules permit (FR-19, FR-20), and carries the owner's
 * answers from the previous plan file into the next (S-014). `--apply`
 * (S-015, `apply.ts`) is the only writer: it runs an approved plan's
 * batches 1 to 6 and records each write's state in the plan file.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ExitCode } from "../exit-codes.js";
import { classifySnapshot, type MigrationPlanClassification } from "./classify.js";
import { emptyAnswers, readAnswers, type PreviousAnswers } from "./answers.js";
import { planMigration } from "./plan.js";
import { loadRoadmap } from "./roadmap.js";
import {
  MigrationPlanParseError,
  parseMigrationPlan,
  planHasNonPendingRows,
  renderMigrationPlan,
  type MigrationPlan,
  type MigrationPlanReview,
} from "./planfile.js";
import {
  readSnapshot,
  snapshotHash,
  SnapshotError,
  SNAPSHOT_ERROR_EXIT,
  type MigrationSnapshot,
} from "./snapshot.js";
import { REVIEW_LABELS, summarizeMigrationPlan, type MigrationPlanSummary } from "./summary.js";
import type { GhRunner } from "./gh.js";
import type { LocalReader } from "./local-reader.js";

export * from "./gh.js";
export * from "./local-reader.js";
export * from "./conventions.js";
export * from "./classify.js";
export * from "./snapshot.js";
export * from "./planfile.js";
export * from "./roadmap.js";
export * from "./map.js";
export * from "./answers.js";
export * from "./plan.js";
export * from "./summary.js";
export * from "./apply.js";

export const DEFAULT_PLAN_FILE = "workstream/migration-projects.md";

/** Where the plan file is read and written; injectable so tests stay in memory. */
export interface PlanFileStore {
  read(path: string): string | undefined;
  write(path: string, content: string): void;
}

/** The real store: paths resolve against `root`; writes go through a temp file and a rename. */
export function createPlanFileStore(resolvePath: (p: string) => string): PlanFileStore {
  return {
    read(path) {
      const full = resolvePath(path);
      return existsSync(full) ? readFileSync(full, "utf-8") : undefined;
    },
    write(path, content) {
      const full = resolvePath(path);
      mkdirSync(dirname(full), { recursive: true });
      const tmp = `${full}.tmp-${process.pid}`;
      writeFileSync(tmp, content);
      renameSync(tmp, full);
    },
  };
}

export interface MigrationPlanRunOptions {
  runner: GhRunner;
  reader: LocalReader;
  /** `--repo`, checked against the working tree (A-52). */
  repo?: string;
  /** `--out`, as the user typed it. */
  out: string;
  /** The clock; `Generated:` is second precision. */
  now: () => Date;
  store: PlanFileStore;
}

export interface MigrationPlanRunResult {
  exitCode: number;
  repo: string | null;
  planFile: string;
  summary: MigrationPlanSummary | null;
  /** Set on a non-zero exit: what went wrong and what to do. */
  error?: string;
}

/** ISO-8601 UTC at second precision, the `Generated:` form. */
export function formatGenerated(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * The plan `--plan` writes for a snapshot: the review lists and batches 1
 * to 7 (S-014), with the previous plan's answers applied before batching
 * (A-50). Always `Approved: no`: the owner approves the plan as rebuilt.
 */
export function buildMigrationPlan(
  snapshot: MigrationSnapshot,
  classification: MigrationPlanClassification,
  now: Date,
  answers: PreviousAnswers = emptyAnswers(),
): MigrationPlan {
  const roadmap = loadRoadmap(snapshot.roadmap);
  const { review, batches } = planMigration({
    snapshot,
    classification,
    rows: roadmap.ok ? roadmap.rows : [],
    answers,
  });
  return {
    repo: snapshot.repo,
    generated: formatGenerated(now),
    snapshot: snapshotHash(snapshot),
    approved: false,
    extraHeaders: [],
    review,
    batches,
  };
}

/** `migrate projects --plan`. Returns an exit code from `core/exit-codes.ts`; never throws for an expected failure. */
export async function runMigrationPlan(
  options: MigrationPlanRunOptions,
): Promise<MigrationPlanRunResult> {
  const planFile = options.out;
  let snapshot: MigrationSnapshot;
  try {
    snapshot = await readSnapshot({
      runner: options.runner,
      reader: options.reader,
      repo: options.repo,
    });
  } catch (err) {
    if (err instanceof SnapshotError) {
      return {
        exitCode: SNAPSHOT_ERROR_EXIT[err.kind],
        repo: options.repo ?? null,
        planFile,
        summary: null,
        error: err.message,
      };
    }
    throw err;
  }

  // A-65: an applied record, or a file that is not a plan, is never overwritten.
  // A draft's answers are read and applied before batching (A-50, task 4.7).
  const existing = options.store.read(planFile);
  let answers = emptyAnswers();
  if (existing !== undefined) {
    let refuse: string | null = null;
    try {
      const previous = parseMigrationPlan(existing).plan;
      if (planHasNonPendingRows(previous)) {
        refuse = `${planFile} records applied writes (a row is not pending); choose another --out`;
      } else if (previous.repo.toLowerCase() === snapshot.repo.toLowerCase()) {
        answers = readAnswers(previous);
      }
    } catch (err) {
      if (!(err instanceof MigrationPlanParseError)) throw err;
      refuse = `${planFile} exists and is not a migration plan (${err.message}); choose another --out`;
    }
    if (refuse !== null) {
      return {
        exitCode: ExitCode.ReconciliationConflict,
        repo: snapshot.repo,
        planFile,
        summary: null,
        error: refuse,
      };
    }
  }

  const plan = buildMigrationPlan(snapshot, classifySnapshot(snapshot), options.now(), answers);
  options.store.write(planFile, renderMigrationPlan(plan));
  return {
    exitCode: ExitCode.Success,
    repo: snapshot.repo,
    planFile,
    summary: summarizeMigrationPlan(plan),
  };
}

/** The one-screen plain-text summary (spec §10). */
export function formatMigrationPlanSummary(result: MigrationPlanRunResult): string {
  if (result.summary === null) return `migrate projects --plan: ${result.error ?? "failed"}`;
  const s = result.summary;
  const lines = [`Migration plan for ${result.repo}`, "", "Batches:"];
  for (const b of s.batches) {
    const rows = b.pending + b.done + b.failed + b.skipped;
    lines.push(`  ${b.key}. ${b.name} (${b.runner}): ${rows} ${rows === 1 ? "row" : "rows"}`);
  }
  lines.push("", "Needs your answer:");
  for (const [k, label] of Object.entries(REVIEW_LABELS)) {
    lines.push(`  ${label}: ${s.review[k as keyof MigrationPlanReview]}`);
  }
  lines.push("", `Plan file: ${result.planFile}`, `Next: ${s.next}`);
  return lines.join("\n");
}

/** The `--json` shape (A-64). */
export function migrationPlanJson(result: MigrationPlanRunResult): Record<string, unknown> {
  return {
    command: "migrate projects",
    mode: "plan",
    repo: result.repo,
    planFile: result.planFile,
    batches: (result.summary?.batches ?? []).map((b) => ({
      name: b.name,
      pending: b.pending,
      done: b.done,
      failed: b.failed,
      skipped: b.skipped,
    })),
    review: result.summary?.review ?? null,
    exitCode: result.exitCode,
    ...(result.error !== undefined ? { error: result.error } : {}),
  };
}
