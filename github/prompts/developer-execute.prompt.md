---
mode: agent
description: "Execute an existing task list using the developer agent — Execute Mode."
---

Run the `developer` agent in Execute Mode against an existing task file:

- **Repository:** `<owner/repo>`
- **GitHub Issue:** `#<issue-number>`
- **Task list path:** `workstream/<tasks-prd-XXX-description.md>`
- **Execution mode:** step-gated *(change to `pre-approved autonomous batch` to run autonomously)*

The agent will run `implement` directly — `refine`, `plan`, and all spec/story activities are skipped. Use this when a planning pass has already been completed and the task file is fully scoped.
