---
mode: agent
description: "Orchestrate multi-story execution from a /workstream task file or GitHub milestone."
---

Run the `planner` agent to orchestrate a multi-story implementation:

- **Repository:** `<owner/repo>`
- **Task source** *(choose one)*:
  - Task file: `workstream/<tasks-prd-XXX-description.md>`
  - GitHub milestone: `<milestone-name-or-id>`
- **Developer execution mode:** pre-approved autonomous batch *(change to `step-gated` for manual approval per sub-task)*

The planner will present a dependency-based batch plan and pause for your approval before any work begins.

- Integration branch: `integration/<plan-id>-<short-description>`
- Story branches and PRs are created by `developer` per `github-ops` conventions
- Final output: one consolidated PR to `main` after all batches complete
