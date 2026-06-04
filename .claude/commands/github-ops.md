---
description: "Audit and standardize GitHub artifacts — issues, PRs, branches, labels, milestones — via the github-ops subagent."
argument-hint: "audit | issue #N | pr #N | labels | milestones (repo: owner/repo)"
---

Delegate to the **`github-ops` subagent** (via the Task tool) to enforce GitHub consistency conventions.

**Scope:** $ARGUMENTS

Pass the repository (`owner/repo`) and the requested scope. The subagent produces a compliance report, applies auto-fixable corrections (title format, label taxonomy, body structure), and escalates anything that needs a human decision. It enforces the merge-authority policy: no agent merges into `main` without user approval.
