---
agent: black-box-tester
description: "Validate delivered behavior against requirements — Validate Mode."
---

Run the `black-box-tester` agent in **Validate Mode** to check compliance of delivered code:

- **Repository:** `<owner/repo>`
- **GitHub Issue:** `#<issue-number>`
- **Source artifact:** `<workstream/specification-*.md | workstream/user-stories-*.md | issue body>`
- **Test plan:** `<workstream/test-plan-*.md>`
- **PR or branch:** `<PR-number or branch-name>` *(optional — for implementation context)*

The agent will chain: intake → requirement extraction → evidence collection → reporting & publication.

Artifacts produced:
- `/workstream/validation-report-{issue-or-story-id}.md` — Per-AC pass/fail, edge-case results, drift summary, compliance verdict
- GitHub issue or PR updated with validation summary

The validation report includes:
- Per-AC result table (pass / fail / drift)
- Edge-case outcome summary
- Randomized test runs with seed and result
- Drift detection (requested behavior missing, or unexpected behavior delivered)
- Final compliance verdict with confidence score and defect list

When defects are found, hand off to `developer` for fixes, then re-run validation.
