---
description: "Perform a grey-box fidelity audit of delivered work against requirements and PRD/spec intent (Audit Mode), via the verifier subagent."
argument-hint: "<source spec/story> <workstream/tasks-*.md> #<issue> [PR/branch] (repo: owner/repo)"
---

Delegate to the **`verifier` subagent** (via the Task tool) in **Audit Mode**.

**Inputs:** $ARGUMENTS

The subagent cross-checks the codebase implementation, `/workstream` artifacts, the test suite vs. acceptance criteria, and the original PRD/spec intent (grey-box audit). It collects per-AC evidence (pass/fail/drift), classifies every drift item by impact (Critical/Major/Minor) and intent (Intended/Unintended/Undetermined), and writes `/workstream/fidelity-report-*.md` with a verdict-first header, a human-readable "what changed and why" summary, a per-AC result table, and the drift catalog, then updates the issue/PR. The audit is additive and non-blocking. When defects or Unintended drift are found, hand off to `/developer` (or escalate spec gaps to `/product-engineer`) and re-run.
