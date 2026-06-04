---
description: "Validate delivered behavior against requirements and a test plan (Validate Mode), via the black-box-tester subagent."
argument-hint: "<workstream/test-plan-*.md> <source spec/story> #<issue> [PR/branch] (repo: owner/repo)"
---

Delegate to the **`black-box-tester` subagent** (via the Task tool) in **Validate Mode**.

**Inputs:** $ARGUMENTS

The subagent collects per-AC evidence (pass/fail/drift), runs randomized tests with captured seeds, and writes `/workstream/validation-report-*.md` with a per-AC result table, edge-case outcomes, drift summary, and final compliance verdict, then updates the issue/PR. When defects are found, hand off to `/developer` and re-run.
