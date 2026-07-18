---
agent: product-engineer
description: "Design and plan a new feature end-to-end — from PRD to task list."
---

Run the `product-engineer` agent to design a new feature:

- **Repository:** `<owner/repo>`
- **Feature description:**
  > <Describe the feature in one or more sentences, or paste a PRD excerpt here>

The agent will chain: `refine` → `generate-spec` → `generate-stories` → `publish-github` → `plan` → `verifier` (Design Mode) recommendation.

Artifacts produced:

- PRD under `/docs/requirements/`
- Specification under `/workstream/`
- User stories published as GitHub Issues
- Execution-ready task list under `/workstream/`

When complete, use `verifier` (Design Mode) to generate a test-first compliance test plan, then use `developer` (Execute Mode) or `planner` to start implementation.
