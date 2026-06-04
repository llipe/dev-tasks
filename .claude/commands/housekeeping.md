---
description: "Fix auto-fixable lint, type, and test-wiring issues without changing logic, via the housekeeping subagent."
argument-hint: "[path/to/scope — blank for whole project]"
---

Delegate to the **`housekeeping` subagent** (via the Task tool) for a code-quality pass.

**Target scope:** $ARGUMENTS

The subagent fixes auto-fixable lint/formatting, missing type annotations, and broken test wiring (imports, mock paths, regenerated snapshots). It does **not** change test logic, business logic, or package versions without explicit confirmation — those are escalated, never applied silently.
