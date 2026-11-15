---
agent: product-engineer
description: "Run the repeatable refactoring review: baseline, discover, assess, prioritize with your approval, and hand selected items to the PRD/spec chain."
---

Run the `product-engineer` agent for a refactoring review, following the `activity-refactor-review` skill exactly. The skill is the single source of truth for the process, including its Setup section.

- **Mode:** `<delta | full — leave blank for full on the first run, delta afterwards>`
- **Path:** `<directory to narrow the scope to — leave blank for the whole repository>`
- **Dimensions:** `<comma-separated subset of R1 to R8 — leave blank for all>`

The agent runs five steps in order:

1. **Baseline** — records SHA and gate results; stops when `test` is red; loads the register and the roadmap.
2. **Discover** — runs the fixed code smell measurements (linter rules on the command line, `jscpd` as a per-run download), then sweeps each dimension for evidence.
3. **Assess** — reasoning, friction, proposal, do-nothing case, invariants, safety net, and a score per candidate.
4. **Prioritize** — matches against the register, ranks, presents, then **stops and waits** for `Selected`, `Deferred`, or `Rejected` per item.
5. **Convert** — writes a refactoring brief per selected item and routes it to Issue Mode or Feature Mode.

The agent will **not**:

- change application code or tests
- select, defer, or reject an item on your behalf
- write a PRD or specification as part of the review
- record a finding without file-level evidence, reasoning, and a named friction

Output: `/workstream/refactor-review-<YYYY-MM-DD>.md` and an updated `docs/refactoring-register.md`.
