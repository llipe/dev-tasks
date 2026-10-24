/**
 * Apply a migration plan's batch 1 to 6 rows to a fake GitHub model, on the
 * test side (RT-12, the S-014 half; A-66).
 *
 * Written from the Detail grammar the plan file documents, not by calling
 * production code, so "re-planning after apply proposes no writes" is not
 * checked by the code it is checking. S-015's `apply.ts` is the production
 * consumer of the same rows.
 */
import type { MigrationPlan } from "#core/migrate-projects/planfile.js";
import type { ModelIssue, RepoModel } from "./fake-github.js";

const MARKER = "<!-- dev-tasks:status -->";

export function applyPlanToModel(model: RepoModel, plan: MigrationPlan): RepoModel {
  const created = new Map<string, number>();
  const byNumber = () => new Map(model.issues.map((i) => [i.number, i]));
  const issueOf = (ref: string): ModelIssue => {
    const n = ref.startsWith("W-") ? created.get(ref) : Number(ref.replace(/^#/, ""));
    const issue = n === undefined ? undefined : byNumber().get(n);
    if (issue === undefined) throw new Error(`model-apply: no issue for ${ref}`);
    return issue;
  };
  const labelOf = (target: string): string => {
    if (!target.startsWith("label:")) throw new Error(`model-apply: not a label target: ${target}`);
    return target.slice("label:".length);
  };
  let nextNumber = Math.max(0, ...model.issues.map((i) => i.number)) + 1;
  let nextComment = 900000;

  for (const batch of plan.batches) {
    if (batch.runner === "user") continue;
    for (const w of batch.writes) {
      switch (w.action) {
        case "create-label": {
          const m = w.detail.match(/^color: ([0-9A-F]{6}); description: (.*)$/s);
          if (!m) throw new Error(`model-apply: bad create-label detail ${w.detail}`);
          model.labels.push({ name: labelOf(w.target), color: m[1], description: m[2] });
          break;
        }
        case "edit-label": {
          const m = w.detail.match(/^description: (.*)$/s);
          if (!m) throw new Error(`model-apply: bad edit-label detail ${w.detail}`);
          const label = model.labels.find((l) => l.name === labelOf(w.target));
          if (label === undefined) throw new Error(`model-apply: no label ${w.target}`);
          label.description = m[1];
          break;
        }
        case "create-issue": {
          const m = w.detail.match(
            /^template: (prd|wave); label: (level: (?:prd|wave)); title: (.*)$/s,
          );
          if (!m) throw new Error(`model-apply: bad create-issue detail ${w.detail}`);
          const number = nextNumber++;
          created.set(w.id, number);
          model.issues.push({
            id: 800000 + number,
            number,
            state: "open",
            title: m[3],
            body: `Created by the migration (${m[1]} template).`,
            labels: [m[2]],
            milestone: null,
            parent: null,
            blocking: [],
          });
          break;
        }
        case "add-label": {
          const issue = issueOf(w.target);
          if (!issue.labels.includes(w.detail)) issue.labels.push(w.detail);
          break;
        }
        case "remove-label": {
          const issue = issueOf(w.target);
          issue.labels = issue.labels.filter((l) => l !== w.detail);
          break;
        }
        case "link-sub-issue": {
          const m = w.detail.match(/^sub-issue (#\d+|W-\d+)$/);
          if (!m) throw new Error(`model-apply: bad link detail ${w.detail}`);
          const child = issueOf(m[1]);
          if (child.parent !== null) throw new Error(`model-apply: #${child.number} has a parent`);
          child.parent = issueOf(w.target).number;
          break;
        }
        case "add-blocked-by": {
          const m = w.detail.match(/^blocked by (#\d+)$/);
          if (!m) throw new Error(`model-apply: bad blocked-by detail ${w.detail}`);
          const blocker = issueOf(m[1]);
          const blocked = issueOf(w.target).number;
          if (!blocker.blocking.includes(blocked)) blocker.blocking.push(blocked);
          break;
        }
        case "status-comment": {
          const m = w.detail.match(/^(create|add): (.*)$/s);
          if (!m) throw new Error(`model-apply: bad status-comment detail ${w.detail}`);
          const rows = m[2].split("; ").map((r) => {
            const x = r.match(/^(.+?) = (.+), (—|#\d+|W-\d+)$/);
            if (!x) throw new Error(`model-apply: bad status row ${r}`);
            const issue = x[3].startsWith("W-") ? `#${created.get(x[3])}` : x[3];
            return `| ${x[1]} | ${x[2]} | ${issue} |`;
          });
          const target = issueOf(w.target);
          model.comments ??= {};
          const list = (model.comments[String(target.number)] ??= []);
          if (m[1] === "create") {
            list.push({
              id: nextComment++,
              body: [
                MARKER,
                `🔄 Update: migrated to projects-tracking — Refs #${target.number}`,
                "",
                "| Wave | State | Wave issue |",
                "| ---- | ----- | ---------- |",
                ...rows,
              ].join("\n"),
            });
          } else {
            const comment = list.find((c) => c.body.startsWith(MARKER));
            if (comment === undefined) throw new Error("model-apply: no status comment to add to");
            comment.body = `${comment.body}\n${rows.join("\n")}`;
          }
          break;
        }
      }
    }
  }
  return model;
}
