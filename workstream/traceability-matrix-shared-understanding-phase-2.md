# Traceability Matrix: Shared Understanding — Phase 2

## Changelog

| Version | Date       | Summary                                     | Author   |
| ------- | ---------- | --------------------------------------------- | -------- |
| 1.0     | 2026-09-21 | Initial traceability matrix, Design Mode.    | verifier |

Format: `AC-ID -> Test-Case-ID(s) -> Observed-Result`. `Observed-Result` is blank (pending implementation) for every row — this is a pre-implementation Design Mode artifact; `verifier` Audit Mode fills this column per story after implementation.

Positive test case = an E2E scenario, contract-validation scenario, or scenario fixture from the test plan asserting the criterion holds under normal operation. Negative/edge test case = an EC-series or randomized-tactic case from the test plan asserting the criterion's boundary/failure behavior. Every row below carries at least one of each, per this plan's non-negotiable AC-mapping rule.

## PRD-Level Acceptance Criteria (Phase 2 scope)

| AC-ID | Description                                                                                          | Positive Test Case(s)         | Negative/Edge Test Case(s) | Observed-Result |
| ----- | -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------ | ---------------- |
| AC-01 | `activity-refine` does not draft a PRD before the WHAT exit gate is satisfied.                            | E2E-1                            | E2E-5, EC-7, EC-8               |                   |
| AC-02 | `activity-generate-spec` does not draft a spec before the HOW exit gate is satisfied.                     | E2E-2                            | E2E-5, EC-7, EC-8               |                   |
| AC-03 | Grilling session produces/appends `decisions-<feature>.md`, one row per resolved question, unique IDs, qualified citation form. | E2E-1, E2E-2, CT-2                | EC-3, EC-9                      |                   |
| AC-04 | Codebase-answerable question resolved via direct read/`researcher`, never asked.                          | E2E-3                            | EC-2                             |                   |
| AC-05 | PRD/spec/task list cite decision IDs inline and list them in a "Decisions" section.                       | E2E-1, E2E-2, CT-6                | EC-3 (empty-but-present Decisions section) |     |
| AC-09 | Issue Mode: caps at 8, glossary read-only, reuses prior decisions.                                        | E2E-6                            | EC-14, EC-15                    |                   |
| AC-16 | `planner` passes `decision_log_path` to every `developer` delegation; task list cites IDs.                | E2E-7, CT-1                       | EC-16                           |                   |

## Story-Level Acceptance Criteria

### S-001 — `activity-grill` core skill (#213)

| AC-ID     | Description                                                                                   | Positive Test Case(s) | Negative/Edge Test Case(s) | Observed-Result |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ | ---------------- |
| S-001-AC-1 | Codebase/docs-answerable question resolved via direct read, no user prompt.                       | E2E-3                    | EC-2                            |                   |
| S-001-AC-2 | Unresolvable question asked one at a time, each with a recommended answer.                        | E2E-1                    | EC-1                            |                   |
| S-001-AC-3 | Every resolved question (asked or self-resolved) appended as one row with full schema.            | E2E-1, E2E-3, CT-2        | EC-9, EC-10                     |                   |
| S-001-AC-4 | Decision-tree summary at every 10th question, cap, and exit attempt.                              | E2E-4                    | EC-6                             |                   |
| S-001-AC-5 | On cap reached, presents open list and asks continue/stop — never auto-decides.                   | E2E-4                    | EC-4, EC-6                      |                   |
| S-001-AC-6 | Exit gate satisfied only on empty list AND explicit confirmation; tone/emoji/silence insufficient.| E2E-1 (positive path)     | E2E-5, EC-7, EC-8                |                   |
| S-001-AC-7 | Issue Mode: glossary read-only, scope limited, prior-decision reuse with qualified citation.      | E2E-6                    | EC-14, EC-15                    |                   |
| S-001-AC-8 | Once per phase, states that accepting every recommendation reproduces assumptions.                | E2E-1 (manual session)    | N/A — presence/absence check, no failure mode beyond omission (report via content review) |     |
| S-001-AC-9 | Skill file present with equivalent content in all three trees.                                    | Parity test (`skill-parity-grilling.test.ts`) | N/A — binary pass/fail, no edge variant |     |

### S-002 — Wire into `activity-refine` (#214)

| AC-ID     | Description                                                                              | Positive Test Case(s) | Negative/Edge Test Case(s) | Observed-Result |
| --------- | --------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ | ---------------- |
| S-002-AC-1 | PRD Creation mode invokes WHAT phase before drafting; no draft before exit gate.              | E2E-1                    | E2E-5                           |                   |
| S-002-AC-2 | Issue Refinement mode invokes Issue Mode cap, reuses prior decisions in qualified form.       | E2E-6                    | EC-14                           |                   |
| S-002-AC-3 | Every decision-shaped requirement cites inline; `## Decisions` lists every ID consumed.       | E2E-1                    | EC-1 (trivial feature, section legitimately empty) |     |
| S-002-AC-4 | Change present with equivalent behavior in all three trees.                                   | Parity test               | N/A                              |                   |

### S-003 — Wire into `activity-generate-spec` (#215)

| AC-ID     | Description                                                                                    | Positive Test Case(s) | Negative/Edge Test Case(s) | Observed-Result |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ | ---------------- |
| S-003-AC-1 | HOW phase invoked before drafting; no spec section before exit gate.                                  | E2E-2                    | E2E-5                           |                   |
| S-003-AC-2 | Pre-step conditional `researcher` call sequenced before HOW phase starts.                             | E2E-2, EC-17              | EC-18                           |                   |
| S-003-AC-3 | Every decision-shaped design choice cites inline; `## Decisions (HOW phase)` lists IDs consumed.      | E2E-2                    | EC-1 (empty-but-present section) |                   |
| S-003-AC-4 | Change present with equivalent behavior in all three trees.                                           | Parity test               | N/A                              |                   |

### S-004 — Cite decisions in `plan`'s task lists (#216)

| AC-ID     | Description                                                                          | Positive Test Case(s) | Negative/Edge Test Case(s) | Observed-Result |
| --------- | ------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------ | ---------------- |
| S-004-AC-1 | Task list cites decision ID inline where traceable; `## Decisions Consumed` aggregates all.| CT-6                     | EC-3 (zero-decision spec, section present but empty) |     |
| S-004-AC-2 | Task with no traceable decision cites none — no fabrication.                              | CT-6                     | EC-3                             |                   |
| S-004-AC-3 | Change present with equivalent behavior in all three plan-equivalent files.               | Parity test               | N/A                              |                   |

### S-005 — `planner` → `developer` `decision_log_path` handoff (#217)

| AC-ID     | Description                                                                                | Positive Test Case(s) | Negative/Edge Test Case(s) | Observed-Result |
| --------- | ------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------ | ---------------- |
| S-005-AC-1 | `decision_log_path` passed unconditionally in every per-story delegation.                        | E2E-7, CT-1                | EC-16                           |                   |
| S-005-AC-2 | Field named identically, populated identically, across all three trees.                          | CT-1                       | N/A — parity binary check       |                   |
| S-005-AC-3 | Parity test fails if any tree omits the field.                                                   | CT-1 (the test itself is the evidence) | N/A                     |                   |

### S-006 — `implement` reads decision log first (#218)

| AC-ID     | Description                                                                                        | Positive Test Case(s) | Negative/Edge Test Case(s) | Observed-Result |
| --------- | ---------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ | ---------------- |
| S-006-AC-1 | Decision log read in full before any branch created, alongside the existing issue-open check.               | E2E-8                    | E2E-9                           |                   |
| S-006-AC-2 | Decision-shaped implementation commit cites it in commit body; PR body references consumed IDs.             | E2E-8 (manual review of commit/PR template) | N/A — presence/absence check |    |
| S-006-AC-3 | Missing decision log handled gracefully — proceeds without the read, notes absence, no failure.              | E2E-9                    | EC-3 (empty-but-present file, distinct from missing) |     |
| S-006-AC-4 | Change present with equivalent behavior in all three trees.                                                | Parity test               | N/A                              |                   |

### S-007 — ADR-008, `docs/tech.md` § Grilling, decision-log format check (#219)

| AC-ID     | Description                                                                                                                                     | Positive Test Case(s) | Negative/Edge Test Case(s) | Observed-Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ | ---------------- |
| S-007-AC-1 | `docs/adr/ADR-008-<slug>.md` exists, ADR-004/007 format, records exit-gate semantics and the retroactive install-if-absent category.                | Manual content review     | N/A — documentation completeness check |     |
| S-007-AC-2 | `docs/tech.md` gains § Grilling with `cap.what`/`cap.how`/`cap.issue` table, defaults 25/25/8.                                                       | CT-5                      | EC-4 (misconfigured cap value, consumed by `activity-grill`, not the table itself) |     |
| S-007-AC-3 | `core/checks` validator: unique `ID`, `Phase` ∈ {WHAT, HOW}, `Supersedes` resolves in-file; wired under `lint`.                                      | CT-2, CT-3, RT-1           | EC-9, EC-10, EC-11, EC-12, RT-2, RT-3 |     |
| S-007-AC-4 | `docs/adr/README.md` updated to list ADR-008.                                                                                                        | Manual content review     | N/A — presence check            |                   |

## Coverage Confirmation

- Every PRD-level Phase 2 AC (7 total: AC-01, AC-02, AC-03, AC-04, AC-05, AC-09, AC-16) has ≥1 positive and ≥1 negative/edge mapping, except where the criterion is a pure structural presence/absence check with no meaningful "negative" variant beyond its own absence (noted inline as `N/A` with a stated reason, never a silent gap).
- Every story-level AC (34 total across S-001–S-007) is mapped. Three categories of `N/A` negative-case are used deliberately, each stated: (1) parity-test binary checks (a file either has the field or it doesn't — the test itself is both the positive and the falsifying case), (2) prose-presence checks with no failure mode narrower than "content review finds it missing," (3) `SHOULD`-level reminders (S-001-AC-8) where the spec itself does not define a hard failure mode.
- Status: **Complete** for Design Mode. `Observed-Result` columns remain blank until `verifier` Audit Mode runs per story, per this feature's own delivery sequence (developer → verifier-audit, story by story).
