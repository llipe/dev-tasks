---
agent: developer
description: "Implement a GitHub Issue end-to-end using the developer agent — Issue Mode."
---

Run the `developer` agent to implement the following GitHub Issue:

- **Repository:** `<owner/repo>`
- **Issue number:** `#<issue-number>`
- **Execution mode:** step-gated *(change to `pre-approved autonomous batch` to skip approval gates)*

The agent will chain: `refine` → `plan` → `implement`.

A Draft PR will be opened before any code is written. You will be prompted to approve each sub-task in step-gated mode. Documentation will be updated via `technical-writer` before the PR is marked ready for review.
