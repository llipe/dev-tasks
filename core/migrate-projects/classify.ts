/**
 * Classification for `migrate projects --plan` (spec §8.1 and §16a: D-82,
 * D-84, D-85, D-87, D-89, D-100; A-53, A-54, A-68 to A-72, A-76).
 *
 * Pure: it reads a snapshot and returns what each issue is and what needs a
 * human answer. It never proposes a write, and never invents a type or a
 * blocking link: those wait for the owner.
 */
import {
  hasLabel,
  hasLabelPrefix,
  LEVEL_LABELS,
  PRIORITY_CRITICAL,
  PRIORITY_LABEL_PREFIX,
  suggestType,
  TYPE_LABEL_PREFIX,
  validTypes,
  type IssueType,
} from "./conventions.js";
import type { MigrationSnapshot, SnapshotIssue } from "./snapshot.js";

/** A story by title (D-82). The pattern lives in this one constant (spec §16). */
export const STORY_TITLE_PATTERN = /\bStory S-\d+\b/;

/**
 * The `**Story:**` body line (A-54): optional backticks around the path and
 * an optional `→ S-NNN` suffix. Matched on a line of its own, outside code
 * fences, never inside a `>` quote (EC-108).
 */
const STORY_LINE =
  /^\*\*Story:\*\*\s+(`?)(workstream\/user-stories-([A-Za-z0-9._-]+?)(?:-phase-([A-Za-z0-9.]+))?\.md)\1(?:\s+→\s+S-\d+)?\s*$/;

const WAVE_TITLE = /^\[PRD-([^\]\s]+)\] Wave ([^\s:]+):/;
const PRD_PREFIX = /^\[PRD-([^\]\s]+)\] (.*)$/;

export interface StoryRef {
  path: string;
  slug: string;
  /** The `-phase-<N>` part, or `null` for a single-wave story file (A-55). */
  phase: string | null;
}

export type IssueKind =
  | { kind: "story"; storyRef: StoryRef | null }
  | { kind: "tracking"; level: "prd" | "wave"; prd: string; wave: string | null }
  | { kind: "standalone" };

export interface IssueShape {
  title: string;
  body: string | null;
  labels: readonly string[];
}

/** The `**Story:**` reference in `body`, or `null`. Handles CRLF bodies. */
export function parseStoryLine(body: string | null): StoryRef | null {
  if (body === null) return null;
  let inFence = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(STORY_LINE);
    if (m) return { path: m[2], slug: m[3], phase: m[4] ?? null };
  }
  return null;
}

/**
 * The titles a PRD tracking issue may carry for `name`: the PRD file's H1,
 * and the H1 without its `PRD:` and `<name> —` lead (A-53). This repository's
 * `# PRD: projects-tracking — GitHub Projects as …` is titled
 * `[PRD-projects-tracking] GitHub Projects as …`.
 */
export function prdTitleForms(name: string, h1: string): string[] {
  const forms = new Set<string>([h1]);
  const noPrd = h1.replace(/^PRD:\s*/, "");
  forms.add(noPrd);
  const lead = `${name} `;
  if (noPrd.startsWith(lead)) {
    const rest = noPrd.slice(lead.length).replace(/^[—–-]\s+/, "");
    if (rest !== noPrd.slice(lead.length)) forms.add(rest);
  }
  return [...forms].filter((f) => f.length > 0);
}

/**
 * Story, tracking issue or standalone (A-53). Stories first: a story title
 * carries the `[PRD-…]` prefix too. A tracking issue is a non-story titled
 * `[PRD-<name>] Wave <id>:`, or exactly `[PRD-<name>] <PRD title>`, or a
 * non-story with that prefix and a container label (`level: prd`,
 * `level: wave`, or the experiment's `type: prd`/`type: wave`).
 */
export function issueKind(issue: IssueShape, prdTitles: ReadonlyMap<string, string>): IssueKind {
  const storyRef = parseStoryLine(issue.body);
  if (STORY_TITLE_PATTERN.test(issue.title) || storyRef !== null) {
    return { kind: "story", storyRef };
  }
  const wave = issue.title.match(WAVE_TITLE);
  if (wave) return { kind: "tracking", level: "wave", prd: wave[1], wave: wave[2] };
  const prefixed = issue.title.match(PRD_PREFIX);
  if (prefixed) {
    const [, name, rest] = prefixed;
    const h1 = prdTitles.get(name);
    if (h1 !== undefined && prdTitleForms(name, h1).includes(rest)) {
      return { kind: "tracking", level: "prd", prd: name, wave: null };
    }
    const has = (l: string) => hasLabel(issue.labels, l);
    if (has(LEVEL_LABELS.wave) || has("type: wave")) {
      return { kind: "tracking", level: "wave", prd: name, wave: null };
    }
    if (has(LEVEL_LABELS.prd) || has("type: prd")) {
      return { kind: "tracking", level: "prd", prd: name, wave: null };
    }
  }
  return { kind: "standalone" };
}

// --- review lists -------------------------------------------------------------

export interface ClassifiedIssue {
  number: number;
  title: string;
  kind: IssueKind;
}

export interface NeedsTypeItem {
  issue: number;
  title: string;
  /** Every `type:` label on the issue, valid or retired, sorted. */
  currentTypeLabels: string[];
  suggested: IssueType | null;
}

export interface NeedsBlockingLinkItem {
  issue: number;
  title: string;
  priority: string;
  /** Always empty from `--plan`: a blocking link is never invented (D-84). */
  answer: "";
}

export interface StateFileNote {
  file: string;
  note: string;
}

export interface RoadmapNote {
  row: string;
  note: string;
}

export interface InformationNote {
  ref: string;
  note: string;
}

export interface MigrationPlanClassification {
  issues: ClassifiedIssue[];
  needsType: NeedsTypeItem[];
  needsBlockingLink: NeedsBlockingLinkItem[];
  stateFiles: StateFileNote[];
  roadmap: RoadmapNote[];
  information: InformationNote[];
}

/** `- Wave issue: #N` or `Wave issue: none`, the planner's Run Info line (D-89). */
const WAVE_ISSUE_LINE = /^\s*(?:[-*]\s+)?Wave issue:/m;

export function prdTitleMap(snapshot: MigrationSnapshot): Map<string, string> {
  return new Map(
    snapshot.prdFiles.filter((p) => p.h1 !== null).map((p) => [p.name, p.h1 as string]),
  );
}

function isContainer(issue: SnapshotIssue, kind: IssueKind): boolean {
  return (
    kind.kind === "tracking" ||
    hasLabel(issue.labels, LEVEL_LABELS.prd) ||
    hasLabel(issue.labels, LEVEL_LABELS.wave)
  );
}

export function classifySnapshot(snapshot: MigrationSnapshot): MigrationPlanClassification {
  const prdTitles = prdTitleMap(snapshot);
  const open = [...snapshot.openIssues].sort((a, b) => a.number - b.number);
  const issues = open.map((i) => ({
    number: i.number,
    title: i.title,
    kind: issueKind(i, prdTitles),
  }));
  const kindOf = new Map(issues.map((i) => [i.number, i.kind]));
  const trackingNumbers = new Set([
    ...issues.filter((i) => i.kind.kind === "tracking").map((i) => i.number),
    ...snapshot.closedTrackingIssues.map((i) => i.number),
  ]);

  const needsType: NeedsTypeItem[] = [];
  const needsBlockingLink: NeedsBlockingLinkItem[] = [];
  const information: InformationNote[] = [];

  for (const issue of open) {
    const kind = kindOf.get(issue.number)!;

    // D-85, A-68 to A-70: containers are exempt; only set members count.
    if (!isContainer(issue, kind) && validTypes(issue.labels).length !== 1) {
      needsType.push({
        issue: issue.number,
        title: issue.title,
        currentTypeLabels: issue.labels.filter((l) => hasLabelPrefix(l, TYPE_LABEL_PREFIX)).sort(),
        suggested: suggestType(issue.title, issue.labels),
      });
    }

    // D-84, A-72: what a critical issue blocks, read from `dependencies/blocking`.
    if (hasLabel(issue.labels, PRIORITY_CRITICAL) && (issue.blocking ?? []).length === 0) {
      needsBlockingLink.push({
        issue: issue.number,
        title: issue.title,
        priority: PRIORITY_CRITICAL,
        answer: "",
      });
    }

    // A-76: a story under something that is not a tracking issue is listed, never relinked.
    if (
      kind.kind === "story" &&
      typeof issue.parent === "number" &&
      !trackingNumbers.has(issue.parent)
    ) {
      information.push({
        ref: `#${issue.number}`,
        note: `story; parent #${issue.parent} is not a tracking issue; it is never relinked`,
      });
    }

    // EC-115: two priorities is an observation, not a list of its own.
    if (issue.labels.filter((l) => hasLabelPrefix(l, PRIORITY_LABEL_PREFIX)).length > 1) {
      information.push({
        ref: `#${issue.number}`,
        note: "carries several `priority:` labels; keep one",
      });
    }
  }

  if (!snapshot.closedSearchComplete) {
    information.push({
      ref: "search",
      note: "the closed tracking-issue search exceeded GitHub's 1,000-result window; closed tracking issues may be missing",
    });
  }

  // D-89, A-83: active state files only (never `workstream/archive/`); listed, never edited.
  const stateFiles = snapshot.stateFiles
    .filter((s) => !WAVE_ISSUE_LINE.test(s.content))
    .map((s) => ({
      file: s.path,
      note: "no `Wave issue:` line; the next planner resume adds it (D-89)",
    }));

  // D-86: the canonical table is checked when the snapshot is read
  // (`--plan` exits 2 without it); roadmap notes come from the plan.
  const roadmap: RoadmapNote[] = [];

  return { issues, needsType, needsBlockingLink, stateFiles, roadmap, information };
}
