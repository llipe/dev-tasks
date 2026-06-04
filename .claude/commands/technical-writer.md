---
description: "Synchronize /docs with the current state of the codebase via the technical-writer subagent."
argument-hint: "<feature/milestone> [workstream/<file>.md] [docs/requirements/<prd>.md]"
---

Delegate to the **`technical-writer` subagent** (via the Task tool) to update documentation to current state.

**Context:** $ARGUMENTS

The subagent updates `/docs` artifacts, creates a new ADR in `/docs/adr/` if `technical-guidelines.md` changed, updates `/docs/user-guide/` for user-visible changes, and keeps docs-site navigation in sync with pages on disk. It never modifies application code.
