/**
 * Batches 1 to 7 of the migration plan (spec §8.3, FR-19, FR-20; §16a
 * A-66, A-67, A-71, A-73, A-81 to A-84; D-19, D-27, D-73, D-81, D-82,
 * D-87, D-91, D-92, D-97, D-103).
 *
 * Pure: it turns a snapshot, its classification, the roadmap rows and the
 * owner's previous answers into review lists and write rows. It proposes
 * only what the scope rules permit, and only what is not already so (A-66):
 * a label that exists, a link that is present, a status row that is there
 * produce no row, so re-planning after a full apply proposes no write.
 *
 * Never: a title edit (D-19), a hierarchy or `level:` write on a standalone
 * issue (D-82), a Status write or any Project write (D-27, D-81), a relink
 * of an issue that already has a parent, or a deleted label (D-91).
 *
 * Row grammar, which `--apply` (S-015) builds argv from. Target is
 * `label:<name>`, `#<number>`, `W-<id>` for an issue this plan creates, or
 * `new issue` on a create row. Detail by Action:
 *
 * | Action           | Target           | Detail                                                  |
 * | ---------------- | ---------------- | ------------------------------------------------------- |
 * | `create-label`   | `label:<name>`   | `color: <HEX>; description: <text>`                     |
 * | `edit-label`     | `label:<name>`   | `description: <text>`                                   |
 * | `create-issue`   | `new issue`      | `template: prd\|wave; label: <level label>; title: <t>` |
 * | `add-label`      | `#N` or `W-<id>` | `<label name>`                                          |
 * | `remove-label`   | `#N`             | `<label name>`                                          |
 * | `link-sub-issue` | parent           | `sub-issue <#N or W-id>`                                |
 * | `add-blocked-by` | the blocked `#N` | `blocked by #<blocker>`                                 |
 * | `status-comment` | PRD `#N` or `W-` | `create: <rows>` or `add: <rows>`, rows `<wave> = <state>, <#N, W-id or —>` joined by `; ` |
 *
 * Batch 7 is the user's: printed steps, never run (D-81, D-97).
 */
import {
  isYes,
  informationKey,
  parseBlockingAnswer,
  parseTypeAnswer,
  parseUnmappedAnswer,
  type PreviousAnswers,
} from "./answers.js";
import {
  isRetiredLabel,
  LABEL_DESCRIPTION_MAX,
  LEVEL_DEFINITIONS,
  LEVEL_LABELS,
  PRIORITY_CRITICAL,
  PRIORITY_DEFINITIONS,
  PRIORITY_HIGH,
  RETIRED_DESCRIPTION_PREFIX,
  RETIRED_TYPE_LABELS,
  TYPE_COLORS,
  TYPE_DEFINITIONS,
  TYPE_LABEL_PREFIX,
  TYPE_SET,
  type LabelDefinition,
} from "./conventions.js";
import {
  issueKind,
  prdTitleForms,
  type IssueKind,
  type MigrationPlanClassification,
} from "./classify.js";
import { mapStory, titlePrd } from "./map.js";
import {
  emptyMigrationPlanBatches,
  formatWriteId,
  type MigrationPlanAction,
  type MigrationPlanBatch,
  type MigrationPlanBatchKey,
  type MigrationPlanInformation,
  type MigrationPlanReview,
  type MigrationPlanRoadmapNote,
} from "./planfile.js";
import { roadmapPrds, stateFileWave, waveId, type RoadmapRow } from "./roadmap.js";
import type { MigrationSnapshot, SnapshotIssue } from "./snapshot.js";

export interface MigrationPlanInput {
  snapshot: MigrationSnapshot;
  classification: MigrationPlanClassification;
  rows: readonly RoadmapRow[];
  answers: PreviousAnswers;
}

export interface MigrationPlanBuild {
  review: MigrationPlanReview;
  batches: MigrationPlanBatch[];
}

/** GitHub-ops' title limit (§ Title Format). */
export const TITLE_MAX = 80;

const WRITE_TARGET_NEW = "new issue";

/**
 * The retired form of a label description (D-91, A-82): `Retired (D-91): `
 * in front, the whole cut from its end to GitHub's 100 characters. `null`
 * when it is already marked (any `Retired (` lead), so it is never doubled.
 */
export function retiredDescription(description: string): string | null {
  if (description.startsWith("Retired (")) return null;
  return `${RETIRED_DESCRIPTION_PREFIX}${description}`.slice(0, LABEL_DESCRIPTION_MAX).trimEnd();
}

/** A wave tracking issue title from its roadmap row, cut at a word to 80 characters (A-84). */
export function waveTitle(prd: string, phase: string, scope: string): string {
  const head = `[PRD-${prd}] Wave ${phase}: `;
  if (head.length + scope.length <= TITLE_MAX) return head + scope;
  let cut = scope.slice(0, TITLE_MAX - head.length - 1);
  const space = cut.lastIndexOf(" ");
  if (space > 0) cut = cut.slice(0, space);
  return `${head}${cut.replace(/[\s,;:—–-]+$/u, "")}…`;
}

/** A PRD tracking issue title: the shortest accepted form of the PRD file's H1 (A-53). */
export function prdTitle(name: string, h1: string): string {
  const forms = prdTitleForms(name, h1);
  return `[PRD-${name}] ${forms[forms.length - 1]}`;
}

/** The github-ops PRD-table State for a roadmap row (A-67). */
export function prdState(row: RoadmapRow, hasWaveIssue: boolean): string {
  if (row.status === "Done") return "shipped";
  if (row.status === "In progress") return "in progress";
  return hasWaveIssue ? "published" : "not started";
}

/**
 * Batch 7: the Project cleanup the user runs with their own session (D-81,
 * D-96, D-97). The CLI never reads the Project, so the number stays `<n>`.
 * This builder is the only place in the module that names these commands;
 * PT-80 pins that, and nothing in the module runs them.
 */
export function projectCleanupSteps(owner: string): string[] {
  return [
    `List the Project's pull-request items with your own session: gh project item-list <n> --owner ${owner} --limit 500 --format json --jq '.items[] | select(.content.type == "PullRequest") | .id' (<n> is the Project number)`,
    `Delete each listed item: gh project item-delete <n> --owner ${owner} --id <item-id>`,
    "On the Project's Workflows page, set the auto-add workflow's filter to `is:issue`, so pull requests are no longer added (FR-20)",
    "On the Project's Workflows page, turn the default workflows back on (Item closed, Pull request merged), so Status follows issues and pull requests natively (D-27)",
  ];
}

// --- drafting -------------------------------------------------------------------

/** Placeholder for a row's ID inside a Target or Detail, resolved once every row is numbered. */
const ref = (key: string) => `\u0000${key}\u0000`;

interface Draft {
  key: string;
  batch: MigrationPlanBatchKey;
  action: MigrationPlanAction;
  target: string;
  detail: string;
  deps: string[];
}

class Drafts {
  readonly rows: Draft[] = [];
  private readonly keys = new Set<string>();
  add(
    batch: MigrationPlanBatchKey,
    action: MigrationPlanAction,
    target: string,
    detail: string,
    deps: Array<string | null> = [],
    key?: string,
  ): string {
    const k = key ?? `${batch}:${this.rows.length}`;
    this.rows.push({
      key: k,
      batch,
      action,
      target,
      detail,
      deps: deps.filter((d): d is string => d !== null && this.keys.has(d)),
    });
    this.keys.add(k);
    return k;
  }
  has(key: string): boolean {
    return this.keys.has(key);
  }
  /** The key, when that row exists; for dependencies on an optional create. */
  ifAny(key: string): string | null {
    return this.keys.has(key) ? key : null;
  }
}

const labelKey = (name: string) => `label:${name}`;
const prdKey = (prd: string) => `create:prd:${prd}`;
const waveKey = (row: RoadmapRow) => `create:wave:${waveId(row)}`;

/** An issue the plan refers to: an existing number or a create row. */
type IssueRef = { number: number } | { key: string };
const refText = (r: IssueRef) => ("number" in r ? `#${r.number}` : ref(r.key));
const refDep = (r: IssueRef) => ("key" in r ? r.key : null);

interface Tracking {
  issue: SnapshotIssue;
  kind: Extract<IssueKind, { kind: "tracking" }>;
}

export function planMigration(input: MigrationPlanInput): MigrationPlanBuild {
  const { snapshot, classification, rows, answers } = input;
  const owner = snapshot.repo.split("/")[0];
  const drafts = new Drafts();
  const information: MigrationPlanInformation[] = [];
  const roadmapNotes: MigrationPlanRoadmapNote[] = [];
  const info = (r: string, note: string) => {
    information.push({
      ref: r,
      note,
      answer: answers.information.get(informationKey(r, note)) ?? "",
    });
  };

  for (const n of classification.information) info(n.ref, n.note);
  roadmapNotes.push(...classification.roadmap.map((r) => ({ ...r })));

  const prdTitles = new Map(
    snapshot.prdFiles.filter((p) => p.h1 !== null).map((p) => [p.name, p.h1 as string]),
  );
  const open = [...snapshot.openIssues].sort((a, b) => a.number - b.number);
  const openByNumber = new Map(open.map((i) => [i.number, i]));
  const kindOf = new Map(classification.issues.map((i) => [i.number, i.kind]));
  const labels = new Map(snapshot.labels.map((l) => [l.name, l]));
  const prdKeys = roadmapPrds(rows);

  // --- tracking issues (D-87, A-91) ---------------------------------------------
  const openTracking: Tracking[] = [];
  for (const issue of open) {
    const kind = kindOf.get(issue.number);
    if (kind?.kind === "tracking") openTracking.push({ issue, kind });
  }
  const closedTracking: Tracking[] = [...snapshot.closedTrackingIssues]
    .sort((a, b) => a.number - b.number)
    .map((issue) => ({ issue, kind: issueKind(issue, prdTitles) }))
    .filter((t): t is Tracking => t.kind.kind === "tracking");

  const prdIssues = new Map<string, number[]>();
  const waveIssues = new Map<string, number[]>();
  const closedWave = new Map<string, number>();
  const push = (m: Map<string, number[]>, k: string, n: number) =>
    m.set(k, [...(m.get(k) ?? []), n]);
  for (const t of openTracking) {
    if (t.kind.level === "prd") push(prdIssues, t.kind.prd, t.issue.number);
    else if (t.kind.wave !== null) push(waveIssues, `${t.kind.prd} ${t.kind.wave}`, t.issue.number);
    else
      info(
        `#${t.issue.number}`,
        "wave tracking issue without `Wave <id>:` in its title; it matches no roadmap row",
      );
    if (!prdKeys.includes(t.kind.prd)) {
      roadmapNotes.push({
        row: `#${t.issue.number}`,
        note: `tracking issue for PRD ${t.kind.prd}, which no roadmap row has`,
      });
    } else if (
      t.kind.level === "wave" &&
      t.kind.wave !== null &&
      !rows.some((r) => r.prd === t.kind.prd && r.phase === t.kind.wave)
    ) {
      roadmapNotes.push({
        row: `#${t.issue.number}`,
        note: `wave tracking issue for ${t.kind.prd} ${t.kind.wave}, which no roadmap row has`,
      });
    }
  }
  for (const t of closedTracking) {
    if (t.kind.level === "wave" && t.kind.wave !== null) {
      const k = `${t.kind.prd} ${t.kind.wave}`;
      if (!closedWave.has(k)) closedWave.set(k, t.issue.number);
    }
  }

  // Two matches stop that PRD (D-87, D-36): listed, every row omitted.
  const omitted = new Set<string>();
  for (const [prd, numbers] of [...prdIssues].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (numbers.length > 1) {
      omitted.add(prd);
      info(
        `[PRD-${prd}]`,
        `two PRD tracking issues match (${numbers.map((n) => `#${n}`).join(", ")}); this PRD's batches are omitted until one remains (D-87)`,
      );
    }
  }
  for (const [wave, numbers] of [...waveIssues].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (numbers.length > 1) {
      const prd = wave.slice(0, wave.lastIndexOf(" "));
      omitted.add(prd);
      info(
        `[PRD-${prd}]`,
        `two wave tracking issues match ${wave} (${numbers.map((n) => `#${n}`).join(", ")}); this PRD's batches are omitted until one remains (D-87)`,
      );
    }
  }
  const openPrdIssue = (prd: string) =>
    prdIssues.get(prd)?.length === 1 ? prdIssues.get(prd)![0] : null;
  const openWaveIssue = (row: RoadmapRow) => {
    const n = waveIssues.get(waveId(row));
    return n?.length === 1 ? n[0] : null;
  };

  // --- mapping (FR-18) and the unmapped list ----------------------------------------
  const review: MigrationPlanReview = {
    unmapped: [],
    needsType: [],
    needsBlockingLink: [],
    stateFiles: classification.stateFiles.map((s) => ({ ...s })),
    roadmap: roadmapNotes,
    information,
  };
  const mapped: Array<{ issue: SnapshotIssue; row: RoadmapRow }> = [];
  /** Issues whose PRD is omitted: no row targets them (MU-53). */
  const untouchable = new Set<number>();
  const listed = {
    unmapped: new Set<number>(),
    needsType: new Set<number>(),
    needsBlockingLink: new Set<number>(),
  };

  for (const issue of open) {
    const kind = kindOf.get(issue.number);
    if (kind?.kind === "tracking" && omitted.has(kind.prd)) untouchable.add(issue.number);
    if (kind?.kind !== "story") continue;
    const result = mapStory(
      {
        number: issue.number,
        title: issue.title,
        labels: issue.labels,
        milestone: issue.milestone,
        storyRef: kind.storyRef,
      },
      rows,
    );
    const prefix = titlePrd(issue.title);
    if (result.mapped) {
      if (omitted.has(result.row.prd)) {
        untouchable.add(issue.number);
        continue;
      }
      for (const n of result.notes) info(`#${issue.number}`, n);
      mapped.push({ issue, row: result.row });
      continue;
    }
    if (prefix !== null && omitted.has(prefix)) {
      untouchable.add(issue.number);
      continue;
    }
    listed.unmapped.add(issue.number);
    const typed = answers.unmapped.get(issue.number) ?? "";
    const answer = parseUnmappedAnswer(typed, rows);
    if (answer.kind === "wave" && !omitted.has(answer.row.prd)) {
      mapped.push({ issue, row: answer.row });
      review.unmapped.push({
        issue: issue.number,
        title: issue.title,
        why: result.reason,
        answer: typed,
      });
    } else if (answer.kind === "standalone") {
      review.unmapped.push({
        issue: issue.number,
        title: issue.title,
        why: result.reason,
        answer: typed,
      });
    } else if (answer.kind === "invalid" || answer.kind === "wave") {
      review.unmapped.push({
        issue: issue.number,
        title: issue.title,
        why: `invalid answer "${typed}": not a roadmap wave id (\`<PRD> <Phase/Wave>\`) or "standalone"; ${result.reason}`,
        answer: "",
      });
    } else {
      review.unmapped.push({
        issue: issue.number,
        title: issue.title,
        why: result.reason,
        answer: "",
      });
    }
  }

  // --- needs a type (D-85) ------------------------------------------------------------
  const typeAnswers: Array<{ issue: number; type: (typeof TYPE_SET)[number] }> = [];
  for (const n of classification.needsType) {
    listed.needsType.add(n.issue);
    const typed = answers.needsType.get(n.issue) ?? "";
    const t = parseTypeAnswer(typed);
    let answer = typed;
    if (t === "invalid") {
      answer = "";
      info(`#${n.issue}`, `invalid answer "${typed}": not one of the eight types (D-85)`);
    } else if (t !== null && !untouchable.has(n.issue)) {
      typeAnswers.push({ issue: n.issue, type: t });
    }
    review.needsType.push({
      issue: n.issue,
      title: n.title,
      currentTypeLabels: n.currentTypeLabels,
      suggested: n.suggested,
      answer,
    });
  }

  // --- needs a blocking link (D-84, A-73) -------------------------------------------
  const blockingAnswers: Array<{ issue: number; blocks: number | null }> = [];
  for (const n of classification.needsBlockingLink) {
    listed.needsBlockingLink.add(n.issue);
    const typed = answers.needsBlockingLink.get(n.issue) ?? "";
    const a = parseBlockingAnswer(typed);
    let answer = typed;
    const invalid = (why: string) => {
      answer = "";
      info(`#${n.issue}`, `invalid answer "${typed}": ${why}`);
    };
    if (a.kind === "invalid") invalid('not "#<issue it blocks>" or "lower priority to high"');
    else if (a.kind === "blocks" && (!openByNumber.has(a.issue) || a.issue === n.issue)) {
      invalid(
        a.issue === n.issue ? "an issue cannot block itself" : `#${a.issue} is not an open issue`,
      );
    } else if (a.kind === "blocks" && !untouchable.has(n.issue))
      blockingAnswers.push({ issue: n.issue, blocks: a.issue });
    else if (a.kind === "lower" && !untouchable.has(n.issue))
      blockingAnswers.push({ issue: n.issue, blocks: null });
    review.needsBlockingLink.push({ issue: n.issue, title: n.title, priority: n.priority, answer });
  }

  // MU-57: an answer whose item is gone is dropped and reported.
  for (const [list, m] of [
    ["unmapped", answers.unmapped],
    ["needsType", answers.needsType],
    ["needsBlockingLink", answers.needsBlockingLink],
  ] as const) {
    for (const [issue, typed] of [...m].sort(([a], [b]) => a - b)) {
      if (!listed[list].has(issue))
        info(
          `#${issue}`,
          `answer \`${typed}\` dropped: the issue is no longer open or no longer needs it`,
        );
    }
  }

  // --- scope: which waves and PRDs get tracking issues (FR-19, A-83) -------------------
  const activeWaves = new Set<string>();
  for (const s of snapshot.stateFiles) {
    const w = stateFileWave(s.path);
    if (w !== null) activeWaves.add(waveId({ prd: w.prd, phase: w.phase ?? "All" }));
  }
  const mappedByRow = new Map<RoadmapRow, SnapshotIssue[]>();
  for (const m of mapped) mappedByRow.set(m.row, [...(mappedByRow.get(m.row) ?? []), m.issue]);

  const waveRef = new Map<RoadmapRow, IssueRef>();
  const needsWave: RoadmapRow[] = [];
  for (const row of rows) {
    if (omitted.has(row.prd)) continue;
    const stories = mappedByRow.get(row) ?? [];
    const existing = openWaveIssue(row);
    if (row.status === "Done") {
      for (const s of stories) {
        info(
          `#${s.number}`,
          `roadmap row ${waveId(row)} is \`Done\` but this story is open; a shipped wave gets no wave issue and no link (A-83)`,
        );
      }
      if (existing !== null) waveRef.set(row, { number: existing });
      continue;
    }
    if (existing !== null) {
      waveRef.set(row, { number: existing });
    } else if (stories.length > 0 || activeWaves.has(waveId(row))) {
      needsWave.push(row);
    }
  }

  const prdNames = [...new Set([...prdKeys, ...snapshot.prdFiles.map((p) => p.name).sort()])];
  const prdRef = new Map<string, IssueRef>();
  const prdNeeded = new Set<string>();
  for (const prd of prdNames) {
    if (omitted.has(prd)) continue;
    const hasMapped = mapped.some((m) => m.row.prd === prd);
    const hasWave = needsWave.some((r) => r.prd === prd);
    const existing = openPrdIssue(prd);
    if (existing !== null) {
      prdRef.set(prd, { number: existing });
      continue;
    }
    const question =
      "no mapped story and no open PRD tracking issue; answer `yes` to create its PRD tracking issue (A-83)";
    if (hasMapped || hasWave) prdNeeded.add(prd);
    else if (snapshot.prdFiles.some((p) => p.name === prd)) {
      if (isYes(answers.information.get(informationKey(`[PRD-${prd}]`, question))))
        prdNeeded.add(prd);
      info(`[PRD-${prd}]`, question);
    }
  }

  // --- batch 1: labels (A-71, A-82, D-103) ---------------------------------------------
  const needHigh = blockingAnswers.some((b) => b.blocks === null);
  const createLabel = (name: string, d: LabelDefinition) => {
    if (!labels.has(name))
      drafts.add(
        "1",
        "create-label",
        `label:${name}`,
        `color: ${d.color}; description: ${d.description}`,
        [],
        labelKey(name),
      );
  };
  for (const [name, d] of Object.entries(LEVEL_DEFINITIONS)) createLabel(name, d);
  for (const t of TYPE_SET)
    createLabel(`${TYPE_LABEL_PREFIX}${t}`, {
      color: TYPE_COLORS[t],
      description: TYPE_DEFINITIONS[t],
    });
  if (needHigh) createLabel(PRIORITY_HIGH, PRIORITY_DEFINITIONS[PRIORITY_HIGH]);
  const editDescription = (name: string, description: string) => {
    const l = labels.get(name);
    if (l !== undefined && l.description !== description)
      drafts.add("1", "edit-label", `label:${name}`, `description: ${description}`);
  };
  for (const t of TYPE_SET) editDescription(`${TYPE_LABEL_PREFIX}${t}`, TYPE_DEFINITIONS[t]);
  for (const [name, d] of Object.entries(PRIORITY_DEFINITIONS))
    editDescription(name, d.description);
  for (const l of [...snapshot.labels].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    if (!isRetiredLabel(l.name)) continue;
    const d = retiredDescription(l.description);
    if (d !== null) drafts.add("1", "edit-label", `label:${l.name}`, `description: ${d}`);
  }

  // --- batch 2: tracking issues (FR-19, A-84) ------------------------------------------
  for (const prd of prdNames) {
    if (!prdNeeded.has(prd)) continue;
    const h1 = prdTitles.get(prd);
    if (h1 === undefined) {
      info(
        `[PRD-${prd}]`,
        `no \`docs/requirements/prd-${prd}.md\` heading to title its PRD tracking issue; none is created`,
      );
      continue;
    }
    const closed = closedTracking.find((t) => t.kind.level === "prd" && t.kind.prd === prd);
    if (closed !== undefined)
      info(
        `#${closed.issue.number}`,
        `closed PRD tracking issue for ${prd}; a closed tracking issue is never a parent, so a new one is created (A-91)`,
      );
    const key = drafts.add(
      "2",
      "create-issue",
      WRITE_TARGET_NEW,
      `template: prd; label: ${LEVEL_LABELS.prd}; title: ${prdTitle(prd, h1)}`,
      [drafts.ifAny(labelKey(LEVEL_LABELS.prd))],
      prdKey(prd),
    );
    prdRef.set(prd, { key });
  }
  for (const row of needsWave) {
    if (!prdRef.has(row.prd)) {
      info(
        `[PRD-${row.prd}]`,
        `wave ${waveId(row)} needs a wave issue, but the PRD has no tracking issue to hold it; none is created`,
      );
      continue;
    }
    if (/[\s:]/.test(row.phase)) {
      info(
        `[PRD-${row.prd}]`,
        `wave ${waveId(row)}: a \`Phase/Wave\` cell with a space or colon cannot form a \`Wave <id>:\` title; none is created`,
      );
      continue;
    }
    const closed = closedWave.get(waveId(row));
    if (closed !== undefined)
      info(
        `#${closed}`,
        `closed wave tracking issue for ${waveId(row)}; a closed tracking issue is never a parent, so a new one is created (A-91)`,
      );
    const key = drafts.add(
      "2",
      "create-issue",
      WRITE_TARGET_NEW,
      `template: wave; label: ${LEVEL_LABELS.wave}; title: ${waveTitle(row.prd, row.phase, row.scope)}`,
      [drafts.ifAny(labelKey(LEVEL_LABELS.wave))],
      waveKey(row),
    );
    waveRef.set(row, { key });
  }

  // --- batch 3: hierarchy, skipping links present, never relinking (A-76) ------------
  const trackingNumbers = new Set([...openTracking, ...closedTracking].map((t) => t.issue.number));
  for (const row of rows) {
    const w = waveRef.get(row);
    const p = prdRef.get(row.prd);
    if (w === undefined || p === undefined) continue;
    if ("number" in w) {
      const parent = openByNumber.get(w.number)?.parent ?? null;
      if (parent !== null) {
        if (!("number" in p) || parent !== p.number) {
          info(
            `#${w.number}`,
            `wave maps to PRD ${row.prd} (${refText(p)}) but its parent is #${parent}; it is never relinked`,
          );
        }
        continue;
      }
    }
    drafts.add("3", "link-sub-issue", refText(p), `sub-issue ${refText(w)}`, [
      refDep(p),
      refDep(w),
    ]);
  }
  for (const m of mapped) {
    const w = waveRef.get(m.row);
    if (w === undefined || m.row.status === "Done") continue;
    const parent = m.issue.parent ?? null;
    if (parent !== null) {
      const same = "number" in w && parent === w.number;
      if (!same && trackingNumbers.has(parent)) {
        info(
          `#${m.issue.number}`,
          `story maps to ${waveId(m.row)} (${refText(w)}) but its parent is #${parent}; it is never relinked`,
        );
      }
      continue;
    }
    drafts.add("3", "link-sub-issue", refText(w), `sub-issue #${m.issue.number}`, [refDep(w)]);
  }

  // --- batch 4: level and type labels (D-87, MU-56) ------------------------------------
  const removed = new Set<string>();
  const remove = (batch: MigrationPlanBatchKey, issue: number, label: string) => {
    removed.add(`${issue}\u0000${label}`);
    drafts.add(batch, "remove-label", `#${issue}`, label);
  };
  for (const t of openTracking) {
    if (omitted.has(t.kind.prd)) continue;
    const level = t.kind.level === "prd" ? LEVEL_LABELS.prd : LEVEL_LABELS.wave;
    if (!t.issue.labels.includes(level))
      drafts.add("4", "add-label", `#${t.issue.number}`, level, [drafts.ifAny(labelKey(level))]);
    for (const l of [...t.issue.labels].sort()) {
      if ((RETIRED_TYPE_LABELS as readonly string[]).includes(l)) remove("4", t.issue.number, l);
    }
  }
  for (const m of [...mapped].sort((a, b) => a.issue.number - b.issue.number)) {
    if (!m.issue.labels.includes(LEVEL_LABELS.story)) {
      drafts.add("4", "add-label", `#${m.issue.number}`, LEVEL_LABELS.story, [
        drafts.ifAny(labelKey(LEVEL_LABELS.story)),
      ]);
    }
  }
  for (const a of typeAnswers) {
    const issue = openByNumber.get(a.issue)!;
    const label = `${TYPE_LABEL_PREFIX}${a.type}`;
    if (!issue.labels.includes(label))
      drafts.add("4", "add-label", `#${a.issue}`, label, [drafts.ifAny(labelKey(label))]);
    for (const l of [...issue.labels].sort()) {
      if (l.startsWith(TYPE_LABEL_PREFIX) && l !== label) remove("4", a.issue, l);
    }
  }

  // --- batch 4b: blocking links and priorities (A-73) ---------------------------------
  for (const b of blockingAnswers) {
    if (b.blocks !== null)
      drafts.add("4b", "add-blocked-by", `#${b.blocks}`, `blocked by #${b.issue}`);
    else {
      const issue = openByNumber.get(b.issue)!;
      if (!issue.labels.includes(PRIORITY_HIGH))
        drafts.add("4b", "add-label", `#${b.issue}`, PRIORITY_HIGH, [
          drafts.ifAny(labelKey(PRIORITY_HIGH)),
        ]);
      remove("4b", b.issue, PRIORITY_CRITICAL);
    }
  }

  // --- batch 5: retired labels, open issues only, definitions kept (D-91) -------------
  for (const issue of open) {
    if (untouchable.has(issue.number)) continue;
    for (const l of [...issue.labels].sort()) {
      if (isRetiredLabel(l) && !removed.has(`${issue.number}\u0000${l}`))
        drafts.add("5", "remove-label", `#${issue.number}`, l);
    }
  }

  // --- batch 6: PRD status comments, create or add missing rows (D-92, D-73, A-67) ------
  for (const prd of prdNames) {
    const p = prdRef.get(prd);
    if (p === undefined) continue;
    const prdRows = rows.filter((r) => r.prd === prd);
    if (prdRows.length === 0) continue;
    const comment = "number" in p ? (openByNumber.get(p.number)?.statusComment ?? null) : null;
    if (comment !== null && comment.markers > 1) {
      info(
        `#${(p as { number: number }).number}`,
        `${comment.markers} comments carry the status marker; batch 6 edits the oldest (${comment.id}); remove the others`,
      );
    }
    const present = new Set((comment?.rows ?? []).map((r) => r.wave));
    const deps: Array<string | null> = [refDep(p)];
    const cells: string[] = [];
    for (const row of prdRows) {
      if (present.has(row.phase)) continue;
      const w = waveRef.get(row);
      const closed = closedWave.get(waveId(row));
      const issueText = w !== undefined ? refText(w) : closed !== undefined ? `#${closed}` : "—";
      if (w !== undefined) deps.push(refDep(w));
      cells.push(
        `${row.phase} = ${prdState(row, w !== undefined || closed !== undefined)}, ${issueText}`,
      );
    }
    if (cells.length === 0) continue;
    drafts.add(
      "6",
      "status-comment",
      refText(p),
      `${comment === null ? "create" : "add"}: ${cells.join("; ")}`,
      deps,
    );
  }

  // --- numbering ------------------------------------------------------------------------
  const steps = projectCleanupSteps(owner);
  const total = drafts.rows.length + steps.length;
  const ids = new Map<string, string>();
  const batches = emptyMigrationPlanBatches();
  const order = batches.map((b) => b.key);
  const sorted = [...drafts.rows].sort((a, b) => order.indexOf(a.batch) - order.indexOf(b.batch));
  sorted.forEach((d, i) => ids.set(d.key, formatWriteId(i + 1, total)));
  const resolve = (text: string) =>
    text.replace(/\u0000([^\u0000]+)\u0000/g, (_, k: string) => ids.get(k)!);
  for (const d of sorted) {
    batches
      .find((b) => b.key === d.batch)!
      .writes.push({
        id: ids.get(d.key)!,
        action: d.action,
        target: resolve(d.target),
        detail: resolve(d.detail),
        dependsOn: [...new Set(d.deps)].map((k) => ids.get(k)!),
        state: "pending",
      });
  }
  batches.find((b) => b.runner === "user")!.steps = steps.map((step, i) => ({
    id: formatWriteId(sorted.length + i + 1, total),
    step,
    state: "pending",
  }));
  for (const n of review.information) n.note = resolve(n.note);

  return { review, batches };
}
