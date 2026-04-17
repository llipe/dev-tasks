---
agent: black-box-tester
description: "Generate a compliance test plan from a specification or user story — Design Mode."
---

Run the `black-box-tester` agent in **Design Mode** to generate a compliance test plan:

- **Repository:** `<owner/repo>`
- **GitHub Issue:** `#<issue-number>`
- **Source artifact:** `<workstream/specification-*.md | workstream/user-stories-*.md | issue body>`
- **Input type:** `spec` or `story`

The agent will chain: intake → requirement extraction → test design → reporting & publication.

Skills invoked:
- `activity-e2e-test-design` — E2E black-box scenarios
- `activity-contract-test-design` — Contract validation scenarios
- `activity-edge-case-refinement` — Categorized edge-case catalog
- `activity-random-test-tactics` — Randomized and property-based tactics

Artifacts produced:
- `/workstream/test-plan-{issue-or-story-id}.md` — Compliance test plan
- `/workstream/traceability-matrix-{issue-or-story-id}.md` — AC-to-test mapping
- GitHub issue updated with test plan summary or artifact link

When complete, hand off to `developer` for implementation, then use `black-box-tester-validate` after implementation to verify compliance.
