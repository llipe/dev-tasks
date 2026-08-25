---
agent: researcher
description: "Perform bounded codebase research and emit a structured artifact with file-level evidence."
---

Run the `researcher` agent for a codebase investigation.

- **Research question:** `<a single, focused question about the codebase>`
- **Target scope:** `<package, module, directory, or issue reference — leave blank for broad research>`

The agent runs one procedure:

1. **Intake** — receives the research question; asks one clarification if vague.
2. **Multi-repo detection** — checks for `component.json` and uses `dt context`/catalog if available, otherwise falls back to direct scanning.
3. **Slice execution** — investigates all eight slices: S1 Components/modules, S2 APIs/contracts, S3 UI surfaces, S4 Tests, S5 Data model, S6 Config/env/CI, S7 Relationships, S8 Prior history.
4. **Synthesis** — writes answer-first summary, compiles relevance-ranked file map, derives relationships, risks, and gaps.
5. **Budget enforcement** — ensures report <= 250 lines and <= 30 cited files.
6. **Provenance** — records repository, branch, commit SHA, date; consumers treat the artifact as stale when HEAD advances.

The agent will **not**:

- write application code, PRDs, specs, task lists, or tests
- render a verdict, grade, or approval
- act as part of the completion-gate sequence
- exceed the 250-line / 30-file budget caps

Output: `/workstream/research-issue-<n>-<slug>.md` (or `/workstream/research-<slug>-<date>.md` when no issue exists).

Invoked conditionally by `product-engineer` (pre-refine, pre-spec), `developer` (troubleshooting), or `planner` (pre-orchestration). Use this prompt for standalone research.
