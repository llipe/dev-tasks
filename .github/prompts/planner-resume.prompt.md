---
agent: planner
description: "Resume an interrupted multi-story execution run from the last checkpoint."
---

Resume the `planner` agent from an existing checkpoint:

- **Repository:** `<owner/repo>`
- **State file:** `workstream/planner-state-<plan-id>.md`

The planner will read the checkpoint state file, display completed and pending stories, and ask for confirmation before resuming from the next pending story.

Use this prompt when a previous planner run was interrupted (context loss, session timeout, etc.) and you want to continue from where it left off.
