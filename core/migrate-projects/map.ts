/**
 * FR-18's mapping precedence, as amended by §16a (A-54 to A-57, D-98):
 *
 * 1. The `**Story:** workstream/user-stories-<slug>-phase-<N>.md` body line,
 *    to the row whose PRD key is `<slug>` and `Phase/Wave` is `<N>` (`All`
 *    for a file without `-phase-N`).
 * 2. A `phase: X` label, to the row whose `Phase/Wave` equals `X` exactly,
 *    among the rows of the PRD named by the title's `[PRD-<name>]` prefix.
 * 3. Otherwise unmapped, with the reason. The milestone is not a rule.
 *
 * A rule maps only when it yields exactly one row; zero or several rows
 * fall through to the next rule. Pure and never fuzzy (D-18, D-86).
 */
import type { StoryRef } from "./classify.js";
import { hasLabelPrefix } from "./conventions.js";
import { roadmapRows, waveId, type RoadmapRow } from "./roadmap.js";

export interface StoryToMap {
  number: number;
  title: string;
  labels: readonly string[];
  milestone: string | null;
  storyRef: StoryRef | null;
}

export type MapResult =
  | {
      mapped: true;
      row: RoadmapRow;
      rule: "story-line" | "phase-label";
      /** What else pointed elsewhere, cited for the owner (MU-40, MU-43). */
      notes: string[];
    }
  | { mapped: false; reason: string };

const PHASE_LABEL = "phase: ";
const TITLE_PRD = /^\[PRD-([^\]\s]+)\]/;

/** The `<name>` of a leading `[PRD-<name>]` title prefix, or `null`. */
export function titlePrd(title: string): string | null {
  return title.match(TITLE_PRD)?.[1] ?? null;
}

function rowsText(rows: readonly RoadmapRow[]): string {
  return rows.map(waveId).join(", ");
}

export function mapStory(story: StoryToMap, rows: readonly RoadmapRow[]): MapResult {
  const tried: string[] = [];
  const notes: string[] = [];

  // Rule 1.
  let line: RoadmapRow | null = null;
  if (story.storyRef === null) {
    tried.push("no `**Story:**` line");
  } else {
    const named = waveId({ prd: story.storyRef.slug, phase: story.storyRef.phase ?? "All" });
    const hits = roadmapRows(rows, story.storyRef.slug, story.storyRef.phase);
    if (hits.length === 1) line = hits[0];
    else if (hits.length === 0)
      tried.push(`the \`**Story:**\` line names ${named}, which no roadmap row has`);
    else
      tried.push(
        `the \`**Story:**\` line names ${named}, which ${hits.length} roadmap rows have (ambiguous)`,
      );
  }

  // Rule 2, evaluated even when rule 1 hits, so a disagreement is cited.
  const phases = story.labels.filter((l) => hasLabelPrefix(l, PHASE_LABEL));
  const values = phases.map((l) => l.slice(PHASE_LABEL.length));
  const scope = titlePrd(story.title);
  let label: RoadmapRow | null = null;
  let labelWhy: string;
  const labelsText = phases.map((l) => `\`${l}\``).join(", ");
  if (phases.length === 0) {
    labelWhy = "no `phase:` label";
  } else if (scope === null) {
    const wide = rows.filter((r) => values.includes(r.phase)).length;
    labelWhy = `${labelsText} is matched only within the PRD of the \`[PRD-<name>]\` title prefix, and the title has none (D-98); it matches ${wide} ${wide === 1 ? "row" : "rows"} repository-wide`;
  } else {
    const hits = rows.filter((r) => r.prd === scope && values.includes(r.phase));
    if (hits.length === 1) {
      label = hits[0];
      labelWhy = "";
    } else if (hits.length === 0) {
      labelWhy = `${labelsText} matches no \`Phase/Wave\` cell of PRD ${scope}`;
    } else {
      labelWhy = `${labelsText} matches ${hits.length} rows of PRD ${scope} (${rowsText(hits)}): ambiguous`;
    }
  }

  if (line !== null) {
    if (label !== null && label !== line) {
      notes.push(
        `mapped to ${waveId(line)} by the \`**Story:**\` line; its ${labelsText} label names ${waveId(label)}; the body line wins (FR-18)`,
      );
    }
    return { mapped: true, row: line, rule: "story-line", notes };
  }
  if (label !== null) {
    notes.push(
      ...tried
        .filter((t) => t !== "no `**Story:**` line")
        .map((t) => `${t}; mapped by its \`phase:\` label instead`),
    );
    return { mapped: true, row: label, rule: "phase-label", notes };
  }
  tried.push(labelWhy);
  if (story.milestone !== null) {
    tried.push(`milestone \`${story.milestone}\` is not a mapping rule (D-98)`);
  }
  return { mapped: false, reason: tried.join("; ") };
}
