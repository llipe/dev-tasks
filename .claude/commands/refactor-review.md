---
description: "Run the repeatable refactoring review: baseline, discover, assess, prioritize with your approval, and hand selected items to the PRD/spec chain."
argument-hint: "[delta | full] [path] [dimensions, e.g. R1,R4]"
---

# /refactor-review — Refactoring Review

**Runs in the main thread.** It pauses at Step 4 for your decision on every item, which a subagent cannot do.

**Request:** $ARGUMENTS

Follow the `activity-refactor-review` skill exactly. It is the single source of truth for the process; this command only fixes the entry conditions.

## Arguments

- **Mode**: `delta` or `full`. With no mode given, use `full` when `docs/refactoring-register.md` does not exist, otherwise `delta`.
- **Path**: optional; narrows the scope to a directory.
- **Dimensions**: optional; a comma-separated subset of `R1` to `R8`. Dimensions left out are reported as `Not swept`.

## Steps

1. **Baseline**: record SHA and gate results; stop when `test` is red; load the register and the roadmap.
2. **Discover**: sweep each dimension for evidence; mark empty ones `N/A` with a reason.
3. **Assess**: reasoning, friction, proposal, do-nothing case, invariants, safety net, and a score per candidate.
4. **Prioritize**: match against the register, rank, present, then **stop and wait** for `Selected`, `Deferred`, or `Rejected` per item.
5. **Convert**: write a refactoring brief per selected item and route it to `/product-engineer` (Issue Mode or Feature Mode).

## Models

Follow the skill's Model Tiers table. In Claude Code terms:

- **Session model** (your current `/model`): Baseline, discovery for R2, R3, R6, R7 and R8, and all of Assess, Prioritize, and Convert. Use the most capable model available, especially for a `full` run.
- **Smaller tier**: discovery for R1, R4 and R5 **MAY** be delegated to the `researcher` subagent (`model: haiku`), one dimension per delegation. It returns observations only; it never scores.

This command does not pin a model in its frontmatter, so it never overrides the model you chose for the session.

## This command will not

- change application code or tests
- select, defer, or reject an item on your behalf
- write a PRD or specification itself
- record a finding without file-level evidence, reasoning, and a named friction

Output: `/workstream/refactor-review-<YYYY-MM-DD>.md` and an updated `docs/refactoring-register.md`.
