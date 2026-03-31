---
mode: agent
description: "Audit and standardize GitHub artifacts — issues, PRs, branches, labels, and milestones."
---

Run the `github-ops` agent to enforce GitHub consistency conventions:

- **Repository:** `<owner/repo>`
- **Scope** *(choose one or more)*:
  - `audit` — scan all open issues and PRs for convention violations
  - `issue #<number>` — standardize a specific issue
  - `pr #<number>` — standardize a specific pull request
  - `labels` — reconcile labels against the standard taxonomy
  - `milestones` — audit milestone naming and structure

The agent will produce a compliance report, apply auto-fixable corrections (title format, label names, body structure), and escalate items that require a human decision.
