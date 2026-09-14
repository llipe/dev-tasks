---
agent: infra-engineer
description: "Plan infrastructure changes as approved, reversible steps and record the result for a draft PR handoff."
---

Run the `infra-engineer` agent for an infrastructure change.

- **Request:** `<environment and change request>`
- **Environment file:** `infra/environments.yaml`
- **Record root:** `infra/changes/<YYYYMMDD>-<ChangeId>/`

The agent must use the complete infra-engineer contract: discover → plan → approve plan → one approved step at a time with backup, apply, verify, and record. It blocks template-status environments, identity mismatches, missing tools or version floors, missing production backup/revert, foundation writes, unbounded log queries, and unapproved changes. It never creates or pushes tags or pushes/merges to `main`.
