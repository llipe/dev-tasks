/**
 * Random repositories and random owner answers for the `--apply` walk
 * (RT-11, RT-12). Shaped like the S-014 generator in `plan.test.ts`: one
 * PRD with a roadmap of shipped, active and future waves, a second PRD
 * with no tracking issue, stories mapped by body line or label, prefixed
 * and plain standalone issues, retired labels, critical issues, and
 * sometimes a status comment already on the PRD issue.
 */
import { TYPE_SET } from "#core/migrate-projects/conventions.js";
import type { MigrationPlan } from "#core/migrate-projects/planfile.js";
import type { ModelIssue, RepoModel } from "./fake-github.js";
import type { Prng } from "./prng.js";

const ROADMAP =
  "# Roadmap\n\n| PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing |\n| --- | --- | --- | --- | --- | --- |\n" +
  "| [alpha](requirements/prd-alpha.md) | 1 | Alpha basics | Done | — | — |\n" +
  "| [alpha](requirements/prd-alpha.md) | 2 | Alpha search | In progress | — | — |\n" +
  "| [alpha](requirements/prd-alpha.md) | 3 | Alpha export | Not started | — | — |\n" +
  "| [beta](requirements/prd-beta.md) | 1 | Beta start | In progress | — | — |\n";

const POOL = [
  "type: bug",
  "type: enhancement",
  "Type: Docs",
  "type: other",
  "type: prd",
  "status: ready",
  "Status: Ready",
  "status: blocked",
  "wave: 2",
  "phase: 1",
  "phase: 2",
  "phase: 3",
  "needs: merge",
  "priority: high",
  "priority: critical",
  "level: story",
  "bug",
];

export function randomRepo(r: Prng): RepoModel {
  let id = 60000;
  const issue = (number: number, title: string, extra: Partial<ModelIssue> = {}): ModelIssue => ({
    id: id++,
    number,
    state: "open",
    title,
    body: `BODY-SENTINEL-${number}`,
    labels: [],
    milestone: null,
    parent: null,
    blocking: [],
    ...extra,
  });
  const labels: RepoModel["labels"] = [
    { name: "type: bug", description: "Old bug", color: "D73A4A" },
    { name: "type: enhancement", description: "New or changed behavior", color: "A2EEEF" },
    { name: "Type: Docs", description: "Docs", color: "0075CA" },
    { name: "priority: critical", description: "Urgent", color: "B60205" },
    { name: "priority: high", description: "Soon", color: "D93F0B" },
    { name: "status: blocked", description: "Blocked", color: "000000" },
    { name: "phase: 1", description: "", color: "EEEEEE" },
    { name: "phase: 2", description: "", color: "EEEEEE" },
    { name: "phase: 3", description: "", color: "EEEEEE" },
    { name: "bug", description: "Something isn't working", color: "D73A4A" },
    { name: "level: story", description: "Story issue; the unit of work", color: "7986CB" },
  ].filter(() => r.bool(0.7));
  for (const name of ["type: other", "type: prd", "status: ready", "wave: 2", "needs: merge"]) {
    if (r.bool(0.6))
      labels.push({
        name,
        description: r.bool() ? "Old" : r.bool() ? "Retired (D-91): Old" : "x".repeat(r.int(70, 99)),
        color: "CCCCCC",
      });
  }
  const has = (name: string) => labels.some((l) => l.name.toLowerCase() === name.toLowerCase());
  const pick = () => {
    const chosen = [...new Set(Array.from({ length: r.int(0, 3) }, () => r.pick(POOL)))].filter(
      has,
    );
    return chosen.filter(
      (l, i) => chosen.findIndex((x) => x.toLowerCase() === l.toLowerCase()) === i,
    );
  };

  const issues: ModelIssue[] = [];
  const comments: RepoModel["comments"] = {};
  if (r.bool(0.7)) {
    issues.push(issue(1, "[PRD-alpha] Alpha kit", { labels: has("type: prd") && r.bool() ? ["type: prd"] : [] }));
    if (r.bool(0.4)) {
      const rows = ["| 1 | shipped | — |", "| 2 | in progress | #2 |", "| 3 | not started | — |"];
      comments["1"] = [
        {
          id: 7001,
          body: [
            "<!-- dev-tasks:status -->",
            "🔄 Update: x — Refs #1",
            "",
            "| Wave | State | Wave issue |",
            "| ---- | ----- | ---------- |",
            ...rows.filter(() => r.bool()),
          ].join("\n"),
        },
      ];
    }
  }
  if (r.bool(0.4)) {
    issues.push(
      issue(2, "[PRD-alpha] Wave 2: Alpha search", {
        labels: [],
        parent: r.bool() && issues.length > 0 ? 1 : null,
        state: r.bool(0.85) ? "open" : "closed",
      }),
    );
  }
  const count = r.int(1, 9);
  for (let k = 0; k < count; k++) {
    const num = 10 + k;
    const labels = pick();
    const kind = r.int(0, 4);
    if (kind === 0) {
      issues.push(
        issue(num, `[PRD-alpha] Story S-0${num}: s`, {
          labels,
          body: `**Story:** workstream/user-stories-alpha-phase-${r.pick(["1", "2", "3", "9"])}.md`,
        }),
      );
    } else if (kind === 1) {
      issues.push(
        issue(num, `${r.bool() ? "[PRD-beta] " : ""}Story S-1${num}: s`, {
          labels,
          body: r.bool() ? "**Story:** workstream/user-stories-beta.md" : "",
        }),
      );
    } else if (kind === 2) {
      issues.push(issue(num, `[PRD-alpha] ${r.pick(["fix: a", "chore: b", "docs c"])}`, { labels }));
    } else {
      issues.push(
        issue(num, r.pick(["fix: a", "[chore] b", "docs: c", "plain d"]), {
          labels,
          state: r.bool(0.9) ? "open" : "closed",
        }),
      );
    }
  }
  const files: Record<string, string> = {
    "docs/roadmap.md": ROADMAP,
    "docs/requirements/prd-alpha.md": "# PRD: alpha — Alpha kit\n",
    "docs/requirements/prd-beta.md": "# PRD: beta — Beta kit\n",
  };
  if (r.bool(0.3)) files["workstream/planner-state-alpha-phase-3.md"] = "x";
  return { repo: "acme/kit", labels, issues, files, comments };
}

/** Fill the review lists the way an owner would, at random (A-50: a fresh --plan turns them into rows). */
export function randomAnswers(plan: MigrationPlan, r: Prng, openNumbers: number[]): void {
  for (const u of plan.review.unmapped)
    if (r.bool(0.6)) u.answer = r.pick(["alpha 2", "alpha 3", "beta 1", "standalone"]);
  for (const t of plan.review.needsType) if (r.bool(0.7)) t.answer = r.pick([...TYPE_SET]);
  for (const b of plan.review.needsBlockingLink) {
    if (!r.bool(0.8)) continue;
    const others = openNumbers.filter((n) => n !== b.issue);
    b.answer = others.length > 0 && r.bool() ? `#${r.pick(others)}` : "lower priority to high";
  }
  for (const i of plan.review.information) if (/answer `yes`/.test(i.note) && r.bool()) i.answer = "yes";
}
