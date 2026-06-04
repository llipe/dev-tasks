---
description: "Convert a PRD/SPEC into testable React mockups and a refinement handoff, via the ux-engineer subagent."
argument-hint: "<docs/requirements/prd-*.md | workstream/specification-*.md> <feature-slug> [variants 1-3] [palette]"
---

Delegate to the **`ux-engineer` subagent** (via the Task tool) to produce mockups for user testing.

**Inputs:** $ARGUMENTS

Provide the source artifact path, feature slug, number of variants (default 1, recommended 2-3), and optional palette. The subagent resolves UI standards from `/DESIGN.md` (creating a baseline if missing), scaffolds mockups under `/mockups/mockup-<feature>-<num>`, runs UX gap analysis, and writes a refinement handoff at `/workstream/ux-refinement-<feature>.md` for `/product-engineer`.
