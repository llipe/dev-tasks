---
agent: product-engineer
description: "Refine and plan a GitHub Issue for implementation."
---

Run the `product-engineer` agent to refine and plan a GitHub Issue:

- **Repository:** `<owner/repo>`
- **Issue number:** `#<issue-number>`

The agent will chain: `refine` → `plan`.

Artifacts produced:
- Lightweight refinement doc under `/workstream/`
- GitHub Issue updated with "Refined Scope" section
- Execution-ready task list under `/workstream/`

When complete, use `developer` (Execute Mode) to start implementation.
