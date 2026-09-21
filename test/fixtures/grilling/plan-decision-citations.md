# Scenario (f): `plan` cites decisions in a generated task list

**Verifies:** S-004-AC-1, S-004-AC-2 (FR-16).

## Setup

- Feature: `shared-understanding` (this repository's own Phase 2 feature —
  no invented feature needed, since the spec and decision log already
  exist).
- Source spec: `workstream/specification-shared-understanding-phase-2.md`
  §8 (Detailed Design), which explicitly traces each of §8.1-§8.7 back to
  D-53 through D-56 (and D-20 for §8.7's ADR-008 task).
- `plan` is run in Issue/Stories mode against this spec (or the equivalent
  user story S-001-S-007) to produce
  `workstream/tasks-shared-understanding-phase-2-plan.md`.

## Transcript (excerpt — task list this scenario predicts)

```
- [ ] 1.0 Implement Story S-001: Build the `activity-grill` core skill (#213)

  - [ ] 1.1 Implement resolve-before-ask precedence and depth-first traversal
  - [ ] 1.2 Implement decision-log append-per-resolution write, one row per D-NN
  - [ ] 1.3 Omit any `grill-me` attribution or credit line (D-53)
  - [ ] 1.4 Keep session state (open-questions list, tree position) in
        conversation context only — no `grill-state-<feature>.md` file (D-54)
  - [ ] 1.5 Read the configurable cap from `docs/tech.md` § Grilling when
        present, else fall back to the hardcoded 25/25/8 defaults (D-55)
  - [ ] 1.6 Check for a fresh pre-step `researcher` artifact before making
        the skill's own bounded `researcher` call (D-56)
  - [ ] 1.x Verify Acceptance Criterion: AC-9 three-tree parity
  - [ ] 1.z Run Tests: `pnpm run test -- skill-parity-grilling`

- [ ] 4.0 Implement Story S-004: Cite decisions in `plan`'s task lists (#216)

  - [ ] 4.1 Edit `.claude/skills/plan/SKILL.md`'s task-list output template:
        add inline citation guidance and a closing `## Decisions Consumed` section
  - [ ] 4.2 Mirror into `.github/instructions/plan.instructions.md` and
        `.kiro/steering/plan.md`
  - [ ] 4.z Run Tests: `pnpm run test -- skill-parity-grilling`

## Decisions Consumed

| ID   | Decision (short form)                                                          |
| ---- | -------------------------------------------------------------------------------- |
| D-53 | No `grill-me` attribution — independent implementation, no single canonical source. |
| D-54 | Conversation-only grilling session state — no separate `grill-state-*.md`.      |
| D-55 | Question caps configured in a `docs/tech.md` § Grilling subsection.            |
| D-56 | `activity-grill`'s own `researcher` budget reuses the pre-step artifact first. |
```

## Expected outcome

- Sub-tasks 1.3-1.6, which each implement one D-53-D-56 invariant, carry an
  inline citation (`(D-53)`, `(D-54)`, `(D-55)`, `(D-56)`) — traced from
  spec §8.1's own body text, which already names each decision next to the
  rule it produced.
- Sub-tasks with no traceable decision (1.1, 1.2, 1.x, 1.z, 4.1, 4.2, 4.z)
  cite none — `plan` does not fabricate a citation to give them one
  (S-004-AC-2).
- The task list's closing `## Decisions Consumed` section aggregates every
  ID cited anywhere in the list — here exactly D-53 through D-56, since
  those are the only citations this excerpt contains. (A full run against
  the complete spec would also pick up D-20 from §8.7's ADR-008 task, and
  any decisions traceable in stories S-002, S-003, S-005-S-007 not shown
  in this excerpt.)
- A `plan` revision that stopped aggregating cited IDs into `## Decisions
  Consumed`, or that started inventing a citation for a sub-task the spec
  does not trace to any decision, would make this fixture's expected
  outcome impossible — same regression-detection use as the other
  fixtures in this directory (S-004-AC-1).
