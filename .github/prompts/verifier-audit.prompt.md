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

When defects or Unintended drift are found, hand off to `developer` for fixes (or `product-engineer` for spec-gap escalation), then re-run the audit.
