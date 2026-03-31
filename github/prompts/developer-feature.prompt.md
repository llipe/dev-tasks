---
mode: agent
description: "Build a new feature end-to-end using the developer agent — Feature Mode."
---

Run the `developer` agent to design and implement a new feature:

- **Repository:** `<owner/repo>`
- **Feature description:**
  > <Describe the feature in one or more sentences, or paste a PRD excerpt here>
- **Execution mode:** step-gated *(change to `pre-approved autonomous batch` to skip approval gates)*

The agent will chain: `refine` → `generate-spec` → `generate-stories` → `publish-github` → `plan` → `implement`.

PRD and specification documents will be created under `/workstream/`. User stories will be published as GitHub Issues before implementation begins.
