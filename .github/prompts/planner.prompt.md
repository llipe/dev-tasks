---
agent: planner
description: "Orchestrate multi-story execution from a /workstream task file or GitHub milestone."
---

Run the `planner` agent to orchestrate a multi-story implementation:

- **Repository:** `<owner/repo>`
- **Task source** _(choose one)_:
  - Task file: `workstream/<tasks-prd-XXX-description.md>`
  - GitHub milestone: `<milestone-name-or-id>`
- **Developer execution mode:** pre-approved autonomous sequential _(change to `step-gated` for manual approval per sub-task)_

The planner will present a dependency-based batch plan and pause for your approval before any work begins.

- Integration branch: `integration/<plan-id>-<short-description>`
- Story branches and PRs are created by `developer` per `github-ops` conventions
- Final output: one consolidated PR from integration branch to `main` plus a mandatory `PR Directives (User Action Required)` block (review, approve, merge steps)
