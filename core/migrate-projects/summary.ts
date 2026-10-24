/**
 * The per-batch and per-list counts `--plan` and `--apply` print (spec §10;
 * §16a A-64). Shared by both modes, so the counts a run prints are the
 * counts of the rows in the plan file it leaves behind (CT-35).
 */
import type { MigrationPlan, MigrationPlanBatchKey, MigrationPlanReview } from "./planfile.js";

export interface MigrationPlanBatchCounts {
  key: MigrationPlanBatchKey;
  name: string;
  runner: "cli" | "user";
  pending: number;
  done: number;
  failed: number;
  skipped: number;
}

export type MigrationPlanReviewCounts = Record<keyof MigrationPlanReview, number>;

export interface MigrationPlanSummary {
  batches: MigrationPlanBatchCounts[];
  review: MigrationPlanReviewCounts;
  /** The next action for the summary's last line. */
  next: string;
}

const ANSWERED_LISTS = new Set(["unmapped", "needsType", "needsBlockingLink"]);

/** A row's State reduced to the four counted kinds. */
export function countState(state: string): "pending" | "done" | "failed" | "skipped" {
  if (state.startsWith("done")) return "done";
  if (state.startsWith("failed")) return "failed";
  if (state.startsWith("skipped")) return "skipped";
  return "pending";
}

export function summarizeMigrationPlan(plan: MigrationPlan): MigrationPlanSummary {
  const batches = plan.batches.map((b) => {
    const counts = { pending: 0, done: 0, failed: 0, skipped: 0 };
    for (const row of [...b.writes, ...b.steps]) counts[countState(row.state)]++;
    return { key: b.key, name: b.name, runner: b.runner, ...counts };
  });
  // Lists with an Answer column count the rows still waiting for one.
  const waiting = (rows: Array<{ answer?: string }>, answered: boolean) =>
    rows.filter((r) => !answered || (r.answer ?? "") === "").length;
  const review = Object.fromEntries(
    Object.entries(plan.review).map(([k, v]) => [
      k,
      waiting(v as Array<{ answer?: string }>, ANSWERED_LISTS.has(k)),
    ]),
  ) as MigrationPlanReviewCounts;
  return { batches, review, next: "review the plan" };
}

export const REVIEW_LABELS: Record<keyof MigrationPlanReview, string> = {
  unmapped: "Unmapped issues",
  needsType: "Needs a type",
  needsBlockingLink: "Needs a blocking link",
  stateFiles: "State files",
  roadmap: "Roadmap notes",
  information: "Information",
};
