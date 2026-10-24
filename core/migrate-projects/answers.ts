/**
 * The owner's answers, carried from the previous plan file into the next
 * `--plan` (S-014 AC-6, task 4.7; spec §8.2, §16a A-50, A-73, A-83; CT-26).
 *
 * `--apply` never derives a write from an answer (A-50): `--plan` reads the
 * answers, applies them before batching, and writes a fresh plan reading
 * `Approved: no`, which the owner approves as rebuilt. An answered row stays
 * in its review table with its answer, so a third `--plan` reads it again
 * and produces the same plan (EC-134).
 *
 * Grammar, after the cell trim:
 * - Unmapped: a roadmap wave id `<PRD key> <Phase/Wave>`, exactly as the
 *   roadmap cells read, or `standalone` in any letter case.
 * - Needs a type: one of the eight types, with or without `type: `.
 * - Needs a blocking link: `#<issue it blocks>` or `lower priority to high`.
 * - Information: free text; only `yes` on a PRD question is read (A-83).
 * Anything else is invalid: the item stays listed with the reason, and no
 * write is made from it.
 */
import { TYPE_LABEL_PREFIX, TYPE_SET, type IssueType } from "./conventions.js";
import type { MigrationPlan } from "./planfile.js";
import { waveId, type RoadmapRow } from "./roadmap.js";

export interface PreviousAnswers {
  unmapped: Map<number, string>;
  needsType: Map<number, string>;
  needsBlockingLink: Map<number, string>;
  /** Keyed by `informationKey(ref, note)`. */
  information: Map<string, string>;
}

export function emptyAnswers(): PreviousAnswers {
  return {
    unmapped: new Map(),
    needsType: new Map(),
    needsBlockingLink: new Map(),
    information: new Map(),
  };
}

export function informationKey(ref: string, note: string): string {
  return `${ref}\u0000${note}`;
}

/** The non-empty answers in `plan`'s review tables. */
export function readAnswers(plan: MigrationPlan): PreviousAnswers {
  const a = emptyAnswers();
  const put = <K>(m: Map<K, string>, k: K, v: string) => {
    if (v.length > 0) m.set(k, v);
  };
  for (const r of plan.review.unmapped) put(a.unmapped, r.issue, r.answer);
  for (const r of plan.review.needsType) put(a.needsType, r.issue, r.answer);
  for (const r of plan.review.needsBlockingLink) put(a.needsBlockingLink, r.issue, r.answer);
  for (const r of plan.review.information)
    put(a.information, informationKey(r.ref, r.note), r.answer);
  return a;
}

export type UnmappedAnswer =
  | { kind: "none" }
  | { kind: "wave"; row: RoadmapRow }
  | { kind: "standalone" }
  | { kind: "invalid"; text: string };

export function parseUnmappedAnswer(text: string, rows: readonly RoadmapRow[]): UnmappedAnswer {
  if (text.length === 0) return { kind: "none" };
  if (text.toLowerCase() === "standalone") return { kind: "standalone" };
  const hits = rows.filter((r) => waveId(r) === text);
  return hits.length === 1 ? { kind: "wave", row: hits[0] } : { kind: "invalid", text };
}

/** The answered type, `"invalid"`, or `null` for no answer. */
export function parseTypeAnswer(text: string): IssueType | "invalid" | null {
  if (text.length === 0) return null;
  const t = text.toLowerCase();
  const name = t.startsWith(TYPE_LABEL_PREFIX) ? t.slice(TYPE_LABEL_PREFIX.length) : t;
  return (TYPE_SET as readonly string[]).includes(name) ? (name as IssueType) : "invalid";
}

export const LOWER_TO_HIGH = "lower priority to high";

export type BlockingAnswer =
  | { kind: "none" }
  | { kind: "blocks"; issue: number }
  | { kind: "lower" }
  | { kind: "invalid"; text: string };

export function parseBlockingAnswer(text: string): BlockingAnswer {
  if (text.length === 0) return { kind: "none" };
  if (text.toLowerCase() === LOWER_TO_HIGH) return { kind: "lower" };
  const m = text.match(/^#(\d+)$/);
  return m ? { kind: "blocks", issue: Number(m[1]) } : { kind: "invalid", text };
}

/** `yes` on an Information question, in any letter case. */
export function isYes(text: string | undefined): boolean {
  return text !== undefined && text.toLowerCase() === "yes";
}
