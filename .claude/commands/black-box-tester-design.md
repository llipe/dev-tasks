---
description: "Generate a compliance test plan and traceability matrix from a spec or story (Design Mode), via the black-box-tester subagent."
argument-hint: "<workstream/specification-*.md | workstream/user-stories-*.md> #<issue> [spec|story] (repo: owner/repo)"
---

Delegate to the **`black-box-tester` subagent** (via the Task tool) in **Design Mode**.

**Inputs:** $ARGUMENTS

The subagent extracts numbered acceptance criteria, invokes the test-design skills (`activity-e2e-test-design`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics`), and writes `/workstream/test-plan-*.md` + `/workstream/traceability-matrix-*.md`, then publishes a summary/link into the GitHub issue. Hand off to `/developer`, then run `/black-box-tester-validate` after implementation.
