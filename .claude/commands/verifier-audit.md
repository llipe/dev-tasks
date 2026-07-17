---
description: "Perform a grey-box fidelity audit of delivered work against requirements and PRD/spec intent (Audit Mode), via the verifier subagent."
argument-hint: "<source spec/story> <workstream/tasks-*.md> #<issue> [PR/branch] (repo: owner/repo)"
---

Delegate to the **`verifier` subagent** (via the Task tool) in **Audit Mode**.

**Inputs:** $ARGUMENTS

The subagent cross-checks the codebase implementation, `/workstream` artifacts, the test suite vs. acceptance criteria, and the original PRD/spec intent (grey-box audit). It collects per-AC evidence (pass/fail/drift), classifies every drift item by impact (Critical/Major/Minor) and intent (Intended/Unintended/Undetermined), and writes `/workstream/fidelity-report-*.md` with a verdict-first header, a human-readable "what changed and why" summary, a per-AC result table, and the drift catalog, then updates the issue/PR. The audit is additive and non-blocking. This mode is now also invoked automatically as a mandatory, non-skippable step by `/developer` (post-implementation, pre-PR-ready, per issue) and by `/planner` (per-story and PRD-level rollup) — this manual command remains available for ad-hoc or standalone audits outside that automatic flow. When defects or Unintended drift are found, they route to `/product-engineer`'s `activity-drift-reconciliation` skill (task-list/checklist expansion, new issue via `github-ops`, or a human-confirmed PRD/spec changelog update); implementation defects still go to `/developer` for fixes. Re-run the audit after remediation.
