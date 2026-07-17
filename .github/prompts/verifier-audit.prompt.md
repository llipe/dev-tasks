---
agent: verifier
description: "Grey-box fidelity audit of delivered work against requirements and PRD/spec intent — Audit Mode."
---

Run the `verifier` agent in **Audit Mode** to check the fidelity of delivered code:

- **Repository:** `<owner/repo>`
- **GitHub Issue:** `#<issue-number>`
- **Source artifact:** `<workstream/specification-*.md | workstream/user-stories-*.md | issue body>`
- **Task list:** `<workstream/tasks-*.md>`
- **PR or branch:** `<PR-number or branch-name>`
- **Test plan (optional):** `<workstream/test-plan-*.md>` if Design Mode already ran for this scope

The agent will chain: intake → requirement extraction → evidence collection (grey-box audit) → reporting & publication.

The grey-box audit cross-checks four sources: (a) the codebase implementation, (b) `/workstream` artifacts, (c) the test suite vs. acceptance criteria, and (d) the original PRD/spec intent.

Artifacts produced:

- `/workstream/fidelity-report-{issue-or-story-id}.md` — Per-AC fidelity results, drift catalog, human-readable summary, and overall verdict
- GitHub issue or PR updated with the report's header/verdict section

The fidelity report includes:

- Header/verdict first: overall fidelity verdict and highest drift impact
- Human-readable "what changed and why" summary, free of implementation jargon
- Per-AC result table (pass / fail / drift)
- Drift catalog with impact class (Critical/Major/Minor) and intent class (Intended/Unintended/Undetermined) per item — drift is non-blocking to completion
- Edge-case and randomized test outcomes (when a prior test plan exists)
- Recommendations per drift item

This mode is now also invoked automatically as a mandatory, non-skippable step by `developer` (post-implementation, pre-PR-ready, per issue) and by `planner` (per-story and PRD-level rollup) — this manual prompt remains available for ad-hoc or standalone audits outside that automatic flow. When defects or Unintended drift are found, they route to `product-engineer`'s `activity-drift-reconciliation` skill (task-list/checklist expansion, new issue via `github-ops`, or a human-confirmed PRD/spec changelog update), rather than only "hand off to developer for fixes" — implementation defects still go to `developer`, but write-back of drift findings is owned by `product-engineer`. Re-run the audit after remediation.
