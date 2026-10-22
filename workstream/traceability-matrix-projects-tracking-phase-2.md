# Traceability Matrix: projects-tracking — Wave 2 (planner and verifier)

## Changelog

| Version | Date       | Summary                                   | Author   |
| ------- | ---------- | ----------------------------------------- | -------- |
| 1.0     | 2026-10-22 | Initial traceability matrix, Design Mode. | verifier |

Format: `PRD FR/AC -> story AC -> Test-Case-ID(s) -> Status`. Every `Status` is `planned`: this is a pre-implementation Design Mode artifact. `verifier` Audit Mode replaces it with `Pass | Fail | Drift` per story, and with the observed value for every `DF-*` row whose event has happened (`pending` until then), marked `hand-applied` or `prompt-driven` (A-25).

Test-case ID series are defined in `workstream/test-plan-projects-tracking-phase-2.md` and continue wave 1's: `PT` parity/static assertions in `test/unit/projects-tracking-parity.test.ts` (PT-31 on), `CT` contract shapes (CT-13 on), `LT` existing gates (LT-9 on), `DF` dogfood reads after a named event of this wave's planner run (DF-6 on; D-39, never a mock), `EC` edge cases (EC-41 on), `RT` enumerated tactics (RT-4 on), `RV` document review, `A` findings (A-19 on). "Verified by" is `static`, `dogfood`, `static + dogfood` or `review`; a behavioural criterion is never reported as verified by a static test alone.

## PRD-Level Acceptance Criteria (wave 2 scope)

| PRD AC | Description                                                                                                                                  | Story AC(s)                                  | Positive test(s)                                   | Negative/edge test(s)                            | Verified by      | Event (dogfood)                                     | Finding(s)          | Status  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ | ---------------- | --------------------------------------------------- | ------------------- | ------- |
| AC-8   | One marker comment on the wave issue after story start, closeout, merge and a second story start; story 1 merged into integration, story 2 in progress; state file on the integration branch after each merge. | S-008 AC-3, AC-4; S-009 AC-1, AC-2            | PT-34, PT-35, PT-36, CT-13, CT-15, CT-21, DF-6, DF-8 | PT-37, EC-52, EC-53, EC-57, EC-58, DF-9          | static + dogfood | Each merge; S-010 story start                       | A-20, A-25, A-30    | planned |
| AC-9   | Consolidated PR body has `Closes #N` per merged story and `Closes #<wave>`, plus the roadmap `gh` commands; no story closed before merge.     | S-010 AC-1, AC-2; S-011 AC-1                  | PT-39, PT-40, PT-42, CT-17, CT-18, DF-10, DF-11, DF-14 | PT-42 negative, EC-62 to EC-64, EC-77, EC-79, RT-4 | static + dogfood | Consolidated PR open; merge                         | A-22, A-23, A-34, A-35 | planned |
| AC-10  | Rollup reports a row that disagrees with the wave's sub-issue states, advisory.                                                              | S-012 AC-1, AC-2                              | PT-51, PT-53, CT-22, LT-11                          | PT-52, EC-87 to EC-90, DF-18 (negative path)     | static + dogfood (negative path only) | Phase 5 step 3 rollup                               | A-26, A-36          | planned |
| AC-15  | One marker comment on the PRD issue after a wave is published and a run starts, listing the wave with its state.                             | S-018 AC-1, AC-2                              | PT-45, PT-50, CT-16, DF-16                          | EC-92, EC-93, EC-95 to EC-98, DF-16b             | static + dogfood | (a) first PRD write, (b) PR open, (c) close-out; publish half: wave 3 | A-21, A-27, A-29    | planned |

## PRD Functional Requirements (wave 2 scope)

| FR    | Requirement (short form)                                                                    | Story AC(s)                         | Positive test(s)                                  | Negative/edge test(s)                         | Verified by      | Finding(s)                     | Status  |
| ----- | ------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- | --------------------------------------------- | ---------------- | ------------------------------ | ------- |
| FR-11 | Commit the state file on the integration branch after every merge, same step.               | S-008 AC-3, AC-4                    | PT-34, PT-35, CT-13, CT-21, LT-9, DF-6, DF-7       | EC-44, EC-45, EC-48 to EC-51                  | static + dogfood | A-25, A-32, A-36               | planned |
| FR-12 | Wave status comment at run start, story start, closeout, merge, block; fixed content.       | S-009 AC-1, AC-2, AC-3              | PT-36, PT-38, CT-15, CT-20, DF-8                   | PT-37, EC-52 to EC-61, DF-9                   | static + dogfood | A-20, A-30, A-31, A-40         | planned |
| FR-13 | Planner never closes a story; closes at consolidated PR merge.                              | S-010 AC-1, AC-5                    | PT-39, PT-49, DF-10                                | PT-49 negatives, EC-68, EC-69, EC-71, EC-74   | static + dogfood | A-43                           | planned |
| FR-14 | Roadmap row from `gh issue list` / `gh pr list`, cited in the PR body.                      | S-011 AC-1, AC-2                    | PT-42, PT-43, CT-18, LT-11, DF-14, DF-15           | PT-42 negative, EC-76 to EC-79, EC-81         | static + dogfood | A-22, A-23, A-46               | planned |
| FR-15 | `Closes` per merged story and the wave, from the state table; github-ops rule extended.     | S-010 AC-2, AC-4                    | PT-40, PT-48, CT-17, CT-23, DF-11                  | EC-62 to EC-64, EC-70, RT-4                   | static + dogfood | A-34, A-35, A-47, A-48         | planned |
| FR-16 | Rollup compares the row with the wave issue and its sub-issues; advisory.                   | S-012 AC-1, AC-2                    | PT-51, PT-53, CT-22, LT-11                         | PT-52, EC-87 to EC-91, DF-18                  | static + dogfood | A-26, A-28, A-36               | planned |
| FR-25 | PRD status comment at publish, run start, PR open, merge; Artifacts updated by producer.    | S-018 AC-1, AC-2, AC-3; S-011 AC-2 (shipped step) | PT-32, PT-45, PT-46, PT-50, CT-16, CT-20, DF-16, DF-17 | EC-92 to EC-99, DF-16b                     | static + dogfood | A-21, A-27, A-29, A-39         | planned |

## Follow-up #285

| Criterion | Description                                                               | Story AC(s)       | Positive test(s)               | Negative/edge test(s) | Verified by      | Finding(s) | Status          |
| --------- | ------------------------------------------------------------------------- | ----------------- | ------------------------------ | --------------------- | ---------------- | ---------- | --------------- |
| #285-AC1  | Wave 2 spec documents D-50 (Status at consolidated PR open and merge).    | spec §1, §6       | RV-1                           | —                     | review           | —          | met (reviewed 2026-10-22) |
| #285-AC2  | Consolidated-PR step requires `Closes #N` per story and the wave.         | S-010 AC-2        | PT-40, CT-17, DF-11            | EC-62 to EC-64, RT-4  | static + dogfood | A-34, A-48 | planned         |
| #285-AC3  | `TESTING.md` DF-5 row: In progress at open; Done at merge; first wave 2 run. | S-010 AC-3; S-011 AC-2 | PT-41, PT-43, DF-12, DF-13 | EC-65 to EC-67, EC-75 | static + dogfood | A-37, A-38 | planned         |
| #285-AC4  | Spec cites D-50 for status transitions.                                   | spec v1.0         | RV-2                           | —                     | review           | —          | met (reviewed 2026-10-22) |

## Story-Level Acceptance Criteria

### S-008 — Wave issue and committed checkpoint (#291)

| Story AC | Description                                                                                 | PRD link             | Positive test(s)                     | Negative/edge test(s)                 | Verified by      | Finding(s)       | Status  |
| -------- | ------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------ | ------------------------------------- | ---------------- | ---------------- | ------- |
| AC-1     | `plan` header `Wave issue: #N` after `Source:`, or `none` with a note.                      | D-59                 | PT-31, CT-14, LT-13                  | PT-31 bold negative, EC-46, EC-47     | static           | A-19             | planned |
| AC-2     | Phase 0: header line → D-36 search with `startswith` → `skipped(no wave issue)`.            | D-59, D-36           | PT-33, CT-22, DF-7                   | EC-41 to EC-43, LT-11 (Phase 0 span)  | static + dogfood | A-36             | planned |
| AC-3     | Run Info `Wave issue` after `Repository`; resume reads it; handoff passes it.               | FR-11, D-59          | PT-34, CT-13, LT-10, DF-7, DF-19     | EC-48                                 | static + dogfood | A-25             | planned |
| AC-4     | Step 13: `git add -f`, `chore(planner): checkpoint after <story> merge`, push.              | FR-11, D-52, PRD AC-8 | PT-35, CT-21, DF-6                   | LT-9, EC-44, EC-45, EC-49 to EC-51    | static + dogfood | A-25, A-36, A-45 | planned |
| AC-5     | `describe("plan")`, `describe("planner")` with explicit paths.                              | D-34                 | PT-31 to PT-35, RT-5                 | PT-47 (no whole-file comparison)      | static           | A-44             | planned |

### S-009 — Wave status comment (#292)

| Story AC | Description                                                                                 | PRD link             | Positive test(s)               | Negative/edge test(s)                      | Verified by      | Finding(s)             | Status  |
| -------- | ------------------------------------------------------------------------------------------- | -------------------- | ------------------------------ | ------------------------------------------ | ---------------- | ---------------------- | ------- |
| AC-1     | Created at run start; edited at story start, closeout, merge, block; by reference.          | FR-12, D-53, PRD AC-8 | PT-36, CT-15, DF-8             | PT-36 D-33 negative, EC-52 to EC-54, EC-57, EC-58, EC-61 | static + dogfood | A-20, A-30, A-40 | planned |
| AC-2     | Per-merge sentence gone; Invariants "edit the wave status comment".                         | D-53                 | PT-37, DF-9                    | PT-37 negatives, EC-59, EC-60, LT-9        | static + dogfood | A-31, A-32, A-45       | planned |
| AC-3     | `wave_status: skipped(no wave issue)` / `failed(<reason>)` to Decisions Log and run summary; never blocks a merge. | D-53, spec §9 | PT-38, CT-20 | EC-55, EC-56                        | static           | —                      | planned |
| AC-4     | Parity assertions incl. negative.                                                           | D-34                 | PT-36 to PT-38                 | PT-37                                      | static           | A-45                   | planned |

### S-010 — Nobody closes; `Closes` at ship (#293)

| Story AC | Description                                                                                 | PRD link                       | Positive test(s)                 | Negative/edge test(s)                  | Verified by      | Finding(s)        | Status  |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------- | -------------------------------------- | ---------------- | ----------------- | ------- |
| AC-1     | Planner never closes a story issue; closes at consolidated PR merge.                        | FR-13, D-54, PRD AC-9          | PT-39, DF-10                     | PT-39 negative (`gh issue close`), EC-74 | static + dogfood | —               | planned |
| AC-2     | `Closes #N` per state-table story and `Closes #<wave>`; `Refs` otherwise.                   | FR-15, D-56, PRD AC-9, #285-AC2 | PT-40, CT-17, DF-11             | EC-62 to EC-64, EC-70, RT-4            | static + dogfood | A-34, A-35, A-47  | planned |
| AC-3     | Project Status read after PR open; `project_observation:` in PR body and `TESTING.md` DF-5. | #285-AC3, D-50                 | PT-41, CT-20, DF-12              | PT-41 negatives, LT-14 (PT-28/28b), EC-65 to EC-67, EC-72 | static + dogfood | A-25, A-37, A-38 | planned |
| AC-4     | github-ops `## Why` consolidated-PR sentence.                                               | D-56                           | PT-48, CT-23                     | PT-48 (old sentence kept)              | static           | —                 | planned |
| AC-5     | implement rules 12, 13, lifecycle row, Final Instruction 5: nobody closes.                  | D-54, FR-13                    | PT-49, LT-12, DF-20 (pending)    | PT-49 negatives, EC-68, EC-69, EC-71   | static + dogfood | A-43              | planned |
| AC-6     | Parity extensions with negatives.                                                           | D-34                           | PT-39 to PT-41, PT-48, PT-49     | PT-49 negatives                        | static           | —                 | planned |

### S-011 — Roadmap from `gh`; Phase 6 close-out (#294)

| Story AC | Description                                                                                 | PRD link                       | Positive test(s)                 | Negative/edge test(s)                       | Verified by      | Finding(s)                   | Status  |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------- | ------------------------------------------- | ---------------- | ---------------------------- | ------- |
| AC-1     | Step 5: `In progress`, two commands verbatim, `What's missing` names the PR, cited in body. | FR-14, D-55, PRD AC-9          | PT-42, CT-18, LT-11, DF-14       | PT-42 negative, EC-76 to EC-79              | static + dogfood | A-22, A-23                   | planned |
| AC-2     | `## Phase 6 - Close-out`, ten ordered steps.                                                | FR-14, D-55, D-58, D-61        | PT-43, CT-19, DF-13, DF-15       | EC-73 to EC-75, EC-80 to EC-82, EC-85, EC-86 | static + dogfood | A-24, A-36, A-41, A-42, A-46 | planned |
| AC-3     | Step 9 "then run Phase 6"; Output Contract and Invariants: complete only after Phase 6.     | D-61                           | PT-44, DF-15                     | EC-83, EC-84                                | static + dogfood | A-33, A-41                   | planned |
| AC-4     | Parity assertions.                                                                          | D-34                           | PT-42 to PT-44                   | PT-43 (no `13. ` line, LT-9)                | static           | A-44                         | planned |

### S-012 — Verifier rollup target (#295)

| Story AC | Description                                                                                 | PRD link                  | Positive test(s)            | Negative/edge test(s)       | Verified by      | Finding(s)       | Status  |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------- | --------------------------- | --------------------------- | ---------------- | ---------------- | ------- |
| AC-1     | Triggers 1 and 4 compare with the wave issue and sub-issues (D-36 search, `sub_issues`); merged-PR fallback. | FR-16, D-57, PRD AC-10 | PT-51, PT-52, CT-22, DF-18 | EC-87 to EC-91, LT-11   | static + dogfood | A-26, A-28, A-36 | planned |
| AC-2     | Still advisory; routes to product-engineer.                                                 | CLAUDE.md verifier rule   | PT-53, LT-11                | DF-18 (classified advisory) | static + dogfood | —                | planned |
| AC-3     | `describe("verifier")`.                                                                     | D-34                      | PT-51 to PT-53              | LT-11 (section identity)    | static           | —                | planned |

### S-018 — PRD status comment and Artifacts (#296)

| Story AC | Description                                                                                 | PRD link                  | Positive test(s)                 | Negative/edge test(s)            | Verified by      | Finding(s)              | Status  |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------- | -------------------------------- | ---------------- | ----------------------- | ------- |
| AC-1     | Publish creates or edits the PRD comment with the wave row `published`; `prd_status:` in the report. | FR-25, PRD AC-15  | PT-50, CT-16, CT-20, DF-16b (pending, wave 3) | EC-92, EC-93, EC-95, EC-96 | static + dogfood | A-21, A-27, A-36        | planned |
| AC-2     | Planner edits at run start (`in progress`), PR open (`consolidated PR #n open`), close-out (`shipped`); `prd_status` in state file. | FR-25, D-61, PRD AC-15 | PT-45, CT-16, CT-20, DF-16 | PT-45 D-33 negative, EC-97, EC-98 | static + dogfood | A-21, A-25, A-29, A-30 | planned |
| AC-3     | Wave body Artifacts: `plan` sets `Task plan:`; planner sets the fidelity report at Phase 5. | FR-25                     | PT-32, PT-46, DF-17              | EC-94, EC-99                     | static + dogfood | A-39                    | planned |
| AC-4     | Parity extensions for publish, planner, plan.                                               | D-34                      | PT-32, PT-45, PT-46, PT-50       | LT-13                            | static           | —                       | planned |

## Decision Constraints (D-52 to D-61)

| Decision | Test(s)                                  | Status  |
| -------- | ---------------------------------------- | ------- |
| D-52     | PT-35, CT-21, DF-6, LT-9                 | planned |
| D-53     | PT-36, PT-37, PT-38, DF-8, DF-9          | planned |
| D-54     | PT-39, PT-49, DF-10, DF-20               | planned |
| D-55     | PT-42, CT-18, DF-14                      | planned |
| D-56     | PT-40, PT-48, CT-17, CT-23, DF-11        | planned |
| D-57     | PT-51, PT-52, PT-53, CT-22, DF-18        | planned |
| D-58     | PT-43, DF-15                             | planned |
| D-59     | PT-31, PT-33, PT-34, CT-13, CT-14, DF-7  | planned |
| D-60     | PT-47, LT-9                              | planned |
| D-61     | PT-43, PT-44, CT-19, DF-15               | planned |

## Coverage Status

| Scope                                                     | Count | Covered (≥1 positive + ≥1 negative/edge) | Uncovered | Notes                                                                                                                          |
| --------------------------------------------------------- | ----- | ---------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PRD ACs (wave 2)                                          | 4     | 4                                        | 0         | AC-10 positive is static only (A-26); AC-15 publish half is wave 3 (DF-16b).                                                   |
| PRD FRs (wave 2)                                          | 7     | 7                                        | 0         | —                                                                                                                              |
| #285 criteria                                             | 4     | 4                                        | 0         | AC1 and AC4 met by review now; AC2 and AC3 dogfood on this run.                                                                |
| Story ACs                                                 | 26    | 26                                       | 0         | Six story edge cases have no AC text and stay untested unless A-36 adds a sentence.                                            |
| Findings needing a decision before their story starts     | 6     | —                                        | —         | A-19 (S-008), A-20 (S-009), A-21 (S-018), A-22, A-23, A-24 (S-011).                                                            |
| Findings about what the dogfood evidence means            | 2     | —                                        | —         | A-25 (hand-applied vs prompt-driven), A-26 (AC-10 positive unobservable on a clean run).                                       |
