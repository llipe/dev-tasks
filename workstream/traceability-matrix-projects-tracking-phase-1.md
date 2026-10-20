# Traceability Matrix: projects-tracking — Wave 1 (conventions and hierarchy)

## Changelog

| Version | Date       | Summary                                   | Author   |
| ------- | ---------- | ----------------------------------------- | -------- |
| 1.0     | 2026-10-20 | Initial traceability matrix, Design Mode. | verifier |

Format: `PRD FR/AC -> story AC -> Test-Case-ID(s) -> Status`. Every `Status` is `planned`: this is a pre-implementation Design Mode artifact; `verifier` Audit Mode replaces it with `Pass | Fail | Drift` per story, and with the observed value for every `DF-*` row whose event has occurred (`pending` until then).

Test-case ID series are defined in `workstream/test-plan-projects-tracking-phase-1.md`: `PT` parity/static assertions in `test/unit/projects-tracking-parity.test.ts`, `CT` contract-shape assertions, `LT` existing gates, `DF` dogfood observations (D-39, a `gh` read after a named event; never a mock), `EC` edge cases, `RT` enumerated tactics, `A` findings. "Verified by" is `static`, `dogfood`, or `static + dogfood` — a behavioural criterion is never reported as verified by a static test alone.

## PRD-Level Acceptance Criteria (wave 1 scope)

| PRD AC | Description                                                                                                   | Story AC(s)                              | Positive test(s)                   | Negative/edge test(s)                 | Verified by        | Finding(s)   | Status  |
| ------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------- | ------------------------------------- | ------------------ | ------------ | ------- |
| AC-1   | Publish creates PRD, wave and N story issues with the sub-issue hierarchy, proven by `GET .../sub_issues`.    | S-002 AC-2, AC-4; S-006 AC-2             | PT-7, PT-10, CT-11, DF-1 (wave 2)  | EC-6, EC-8, EC-9, EC-11, DF-1b        | static + dogfood   | A-13, A-17   | planned |
| AC-2   | Tracking issues carry `level:` and no `type:`/`priority:`; the label rule exempts them.                        | S-001 AC-2; S-002 AC-4                   | PT-2, CT-6, DF-1 (labels read)     | PT-3, EC-4                            | static + dogfood   | A-4          | planned |
| AC-3a  | No prompt file in any tree contains `gh project item-edit`/`item-add`, proven by a test.                       | S-006 AC-1                               | PT-28, PT-29, RT-1                 | PT-28b, EC-34 to EC-38                | static             | A-11         | planned |
| AC-3b  | Story issue carries exactly one marked comment after three sub-tasks and a PR open; table names 3 of N + PR.   | S-003 AC-1, AC-2; S-004 AC-1; S-006 AC-3 | PT-12, PT-14, CT-1, CT-2, DF-2     | EC-14 to EC-17, EC-21, EC-40          | static + dogfood   | A-7, A-8     | planned |
| AC-4   | Taxonomy drops `status: ready`/`status: in-progress`; keeps blocked, needs-refinement, deferred as flags.       | S-001 AC-2                               | PT-2 (`status: deferred` row)      | PT-3, EC-3                            | static             | —            | planned |
| AC-5   | Runbook names every FR-8 setting; no instruction to change a default automation.                              | S-005 AC-3, AC-5                         | PT-25, CT-10, DF-4                 | PT-25 negatives, EC-32, EC-33         | static + dogfood   | A-5, A-6     | planned |
| AC-6   | activity-publish-github's execution-method rules name `gh` as primary.                                        | S-002 AC-1                               | PT-6                               | PT-6 negative, EC-12                  | static             | —            | planned |
| AC-7   | Three-tree parity for every changed prompt file.                                                              | S-001 AC-5; S-002 AC-6; S-003 AC-5; S-004 AC-4; S-005 AC-6 | PT-1 to PT-25 (3 trees each), PT-18, LT-5, LT-6 | EC-1, EC-5, EC-12, EC-19, EC-25, EC-28 | static | A-1, A-3, A-15 | planned |
| AC-14  | `pnpm run validate` passes.                                                                                   | every story's Execution Commands         | LT-3                               | LT-1, LT-2, LT-4 to LT-8              | static             | A-2          | planned |

## PRD Functional Requirements (wave 1 scope)

| FR    | Requirement (short form)                                                                        | Story AC(s)                    | Positive test(s)              | Negative/edge test(s)             | Verified by      | Finding(s)  | Status  |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------- | --------------------------------- | ---------------- | ----------- | ------- |
| FR-1  | Two tracking-issue title forms; `<id>` from the roadmap cell; story form unchanged.             | S-001 AC-1                     | PT-1, CT-5                    | PT-1 negative, EC-2, EC-10        | static           | —           | planned |
| FR-2  | `level:` category, one color family; `level: prd`/`level: wave` exempt from `type:`/`priority:`. | S-001 AC-2                     | PT-2, CT-6, DF-1 (labels)     | EC-4                              | static + dogfood | A-4         | planned |
| FR-3  | Find-or-create PRD and wave issues, attach sub-issues, report numbers, epic question removed.   | S-002 AC-2, AC-4, AC-5         | PT-7, PT-8, PT-10, PT-11, DF-1 | EC-6 to EC-9, EC-11, DF-1b        | static + dogfood | A-13, A-17  | planned |
| FR-4  | Wave issue body: scope, branch TBD, Artifacts, story list, no checkboxes.                       | S-002 AC-3                     | PT-9, CT-8, DF-1 (body read)  | PT-9 negative, EC-13              | static + dogfood | —           | planned |
| FR-6  | (wave 1 share) No agent writes Project Status; story PR carries `Closes #N`.                    | S-006 AC-1; S-004 AC-2         | PT-28, PT-20, DF-5 (E2E-6)    | PT-28b, EC-38                     | static + dogfood | A-6, A-9    | planned |
| FR-7  | Stage labels retired from the taxonomy; three flags stay.                                       | S-001 AC-2                     | PT-2                          | PT-3, EC-3 (D-31 negative)        | static           | —           | planned |
| FR-8  | activity-init step + runbook with the named settings and three views.                          | S-005 AC-1 to AC-5             | PT-23, PT-25, CT-10, LT-1, LT-2, DF-4 | PT-24/LT-5, EC-26 to EC-33  | static + dogfood | A-1, A-2, A-5, A-6 | planned |
| FR-9  | Publish names `gh` primary, MCP optional.                                                       | S-002 AC-1; S-001 AC-4         | PT-6, PT-5                    | PT-6/PT-5 negatives, LT-7         | static           | A-3         | planned |
| FR-10 | Parity tests for FR-1, FR-2, FR-3, FR-7, FR-9, FR-23 across three trees.                        | S-001 AC-5 … S-005 AC-6        | PT-0 (file shape), PT-1 to PT-25 | EC-1, EC-12, EC-19, EC-28      | static           | A-15        | planned |
| FR-23 | Mandatory marker-identified story status comment; fixed table; replaces optional comments.      | S-001 AC-3; S-003 AC-1, AC-2, AC-4; S-004 AC-1 | PT-4, PT-12, PT-13, PT-14, PT-16, PT-17, PT-19, CT-1, CT-2, CT-7, DF-2 | EC-14 to EC-17, EC-20, EC-21, EC-40 | static + dogfood | A-7, A-8, A-10 | planned |
| FR-24 | Main-thread developer resolves the parent and edits the wave comment; under planner, story only. | S-003 AC-3; S-004 AC-1         | PT-15, CT-3, CT-7, DF-3       | EC-18, DF-3 (404 path)            | static + dogfood | A-8, A-16   | planned |

## PRD Business Rules and Non-Goals (wave 1 relevant)

| Rule / Non-goal                                                   | Story AC(s)         | Test(s)                       | Verified by | Status  |
| ----------------------------------------------------------------- | ------------------- | ----------------------------- | ----------- | ------- |
| No agent writes Project Status, ever.                              | S-006 AC-1          | PT-28, PT-28b, PT-29, E2E-6   | static + dogfood | planned |
| A story or wave issue is closed by GitHub at ship, never by an agent. | S-004 AC-2       | PT-20 (developer only; A-9)   | static      | planned |
| A tracking issue is a container: no `type:`, `priority:`, assignee. | S-001 AC-2; S-002 AC-4 | PT-2, DF-1 (labels)        | static + dogfood | planned |
| No prompt file contains a `gh project` write command.              | S-006 AC-1          | PT-28, PT-28b, PT-25 negative | static      | planned |
| One status comment per issue, by marker, edited in place.          | S-001 AC-3; S-003 AC-2 | PT-4, PT-14, CT-1, DF-2 (`length == 1`, `updated_at > created_at`) | static + dogfood | planned |
| Non-goal: stage checklist / Stage field on the wave issue.         | S-002 AC-3          | PT-9 negative (no `- [ ]`)    | static      | planned |
| Non-goal: agent-written Status incl. Merged/In review.             | S-006 AC-1          | PT-28                         | static      | planned |
| Non-goal: views created by automation.                             | S-005 AC-3          | PT-25 (filters given as text) | static      | planned |
| Goal 5: nothing breaks without a Project.                          | S-002, S-003        | PT-28b, E2E-7                 | static + dogfood | planned |

## Story-Level Acceptance Criteria

### S-001 — github-ops conventions (#270)

| Story AC | Description                                                                                           | PRD link      | Positive test(s)       | Negative/edge test(s)         | Verified by | Finding(s) | Status  |
| -------- | ----------------------------------------------------------------------------------------------------- | ------------- | ---------------------- | ----------------------------- | ----------- | ---------- | ------- |
| AC-1     | Two title rows in all three copies with the `<id>` sentence.                                          | FR-1, D-32    | PT-1, CT-5             | PT-1 negative (story row unchanged), EC-2 | static | —     | planned |
| AC-2     | Level category; stage rows gone; `status: deferred`; exemption clause.                                | FR-2, FR-7, PRD AC-2, AC-4 | PT-2, CT-6 | PT-3, EC-3, EC-4            | static      | A-4        | planned |
| AC-3     | Status comment subsection: marker, prefix, three tables, procedure.                                   | FR-23, D-33, D-37 | PT-4, CT-1 to CT-4 | PT-4 negative (A-10), EC-17   | static      | A-10       | planned |
| AC-4     | `gh` primary sentence identical across trees.                                                         | D-16, FR-9    | PT-5                   | PT-5 negatives, LT-7, EC-5    | static      | A-3        | planned |
| AC-5     | Parity file with `describe("github-ops")` and the negative row assertion.                             | FR-10         | PT-0, PT-1 to PT-5     | PT-3                          | static      | A-15       | planned |

### S-002 — Publish creates and reuses the hierarchy (#271)

| Story AC | Description                                                                    | PRD link          | Positive test(s)       | Negative/edge test(s)            | Verified by      | Finding(s) | Status  |
| -------- | ------------------------------------------------------------------------------ | ----------------- | ---------------------- | -------------------------------- | ---------------- | ---------- | ------- |
| AC-1     | `gh` primary, MCP optional, method recorded.                                   | FR-9, PRD AC-6    | PT-6                   | PT-6 negative, EC-12             | static           | —          | planned |
| AC-2     | Epic question removed; find-or-create with the D-36 search and three outcomes. | FR-3, D-36        | PT-7, PT-8, CT-11, DF-1 | EC-6 to EC-8, EC-11, DF-1b      | static + dogfood | A-13, A-17 | planned |
| AC-3     | Wave body template: scope, TBD branch, Artifacts, Stories, no checkboxes.      | FR-4, D-14        | PT-9, CT-8             | PT-9 negative, EC-13             | static           | —          | planned |
| AC-4     | Attach each story, wave under PRD, verify, `hierarchy:` report.                | FR-3, D-02, PRD AC-1 | PT-10, DF-1         | PT-10 negative (no inline `--body`), EC-9 | static + dogfood | — | planned |
| AC-5     | Report lines `PRD issue`, `Wave issue`, `Hierarchy`; Final Instructions.       | FR-3              | PT-11, CT-9, DF-1 (report read) | —                       | static + dogfood | —          | planned |
| AC-6     | `describe("activity-publish-github")` block.                                   | FR-10             | PT-6 to PT-11          | EC-12                            | static           | A-15       | planned |

### S-003 — Mandatory story status comment and main-thread wave update (#272)

| Story AC | Description                                                                  | PRD link            | Positive test(s)        | Negative/edge test(s)                  | Verified by      | Finding(s) | Status  |
| -------- | ---------------------------------------------------------------------------- | ------------------- | ----------------------- | -------------------------------------- | ---------------- | ---------- | ------- |
| AC-1     | MUST rule with the event list replaces the optional rule.                    | FR-23, D-38         | PT-12, DF-2             | PT-13, EC-20                           | static + dogfood | A-7, A-10  | planned |
| AC-2     | Find by marker, create or PATCH, `status_comment:` values.                   | D-26, D-28, D-37    | PT-14, CT-1, CT-7, DF-2 | EC-14 to EC-17, EC-21                  | static + dogfood | A-8        | planned |
| AC-3     | Parent lookup; 200 edits the wave row; 404 skips; planner owns.              | FR-24, D-29         | PT-15, CT-3, DF-3       | EC-18, DF-3 (404 observed on wave 1)   | static + dogfood | A-8, A-16  | planned |
| AC-4     | Checklist rules unchanged; lifecycle "During" entry.                         | FR-23               | PT-16, PT-17            | LT-6 (span identical)                  | static           | A-9        | planned |
| AC-5     | `describe("implement")` block over skill, instruction, steering.             | FR-10               | PT-12 to PT-18          | EC-19                                  | static           | A-15       | planned |

### S-004 — Developer reports status-comment outcomes; merged means main (#273)

| Story AC | Description                                                        | PRD link       | Positive test(s)     | Negative/edge test(s)      | Verified by      | Finding(s) | Status  |
| -------- | ------------------------------------------------------------------ | -------------- | -------------------- | -------------------------- | ---------------- | ---------- | ------- |
| AC-1     | `status_comment:` and `wave_status:` beside `checklist_sync:`.     | FR-23, D-30    | PT-19, CT-7, DF-5    | EC-22, LT-6 (memo lines)   | static + dogfood | —          | planned |
| AC-2     | Rule 6: never close; GitHub closes at main merge.                  | D-22 (FR-13 wording) | PT-20          | PT-20 negative, EC-24      | static           | A-9        | planned |
| AC-3     | Pointer to implement's procedure, not a restatement.               | D-38, D-33     | PT-21                | PT-21 negatives            | static           | —          | planned |
| AC-4     | Collapse test still passes; `describe("developer")` block.         | FR-10          | LT-4, PT-19 to PT-21 | EC-23, EC-25               | static           | —          | planned |

### S-005 — activity-init recommends a Project; runbook ships (#274)

| Story AC | Description                                                               | PRD link          | Positive test(s)       | Negative/edge test(s)           | Verified by      | Finding(s)      | Status  |
| -------- | ------------------------------------------------------------------------- | ----------------- | ---------------------- | ------------------------------- | ---------------- | --------------- | ------- |
| AC-1     | Subsection after Branch Protection, ≤4 sentences, runbook link, 3 trees. | FR-8              | PT-23                  | PT-24/LT-5, EC-28, EC-29        | static           | A-1             | planned |
| AC-2     | Runbook frontmatter and seven sections; docs-structure clean.            | D-35              | CT-10, LT-1            | LT-2 (exact list), EC-31        | static           | A-2             | planned |
| AC-3     | Every step named; no default automation changed.                         | FR-8, D-10, PRD AC-5 | PT-25               | PT-25 negatives, EC-26, EC-27, EC-32, EC-33 | static | A-5, A-6     | planned |
| AC-4     | README row.                                                              | D-35              | LT-1 (`index-omits-file`), LT-2 (index lists on-disk) | — | static       | —               | planned |
| AC-5     | Exercised once on `llipe/dev-tasks`; `last_verified`; Project number in PR body. | spec §14   | DF-4                   | EC-30, EC-32 (record workflow names) | dogfood     | A-6             | planned |
| AC-6     | `describe("activity-init")` block.                                       | FR-10             | PT-23, PT-25           | LT-5                            | static           | A-1, A-15       | planned |

### S-006 — Guard against Project writes; dogfood rows in TESTING.md (#275)

| Story AC | Description                                                                  | PRD link            | Positive test(s)        | Negative/edge test(s)          | Verified by | Finding(s)   | Status  |
| -------- | ---------------------------------------------------------------------------- | ------------------- | ----------------------- | ------------------------------ | ----------- | ------------ | ------- |
| AC-1     | `describe("no Project writes")` walks every `.md` in three trees.            | PRD AC-3a, D-23     | PT-28, PT-29, RT-1      | PT-28b, EC-34 to EC-38         | static      | A-11         | planned |
| AC-2     | Dogfood checks table: PRD AC-1 (pending, wave 2) and PRD AC-3 rows.          | D-39                | CT-12, PT-30            | EC-39, A-16 (FR-24 row)        | static      | A-12, A-16   | planned |
| AC-3     | S-001 to S-005 rows filled with issue numbers at closure.                    | D-39                | CT-12, DF-2 (per story) | EC-40                          | static + dogfood | A-7     | planned |

## Decision Constraints (D-28 to D-39)

| Decision | Test(s)                    | Status  |
| -------- | -------------------------- | ------- |
| D-28     | PT-14, CT-7, EC-14         | planned |
| D-29     | PT-15, CT-7, DF-3          | planned |
| D-30     | PT-19, DF-5                | planned |
| D-31     | PT-3 (D-31 negative)       | planned |
| D-32     | PT-1, EC-10                | planned |
| D-33     | PT-4, PT-21, CT-2 to CT-4  | planned |
| D-34     | PT-0                       | planned |
| D-35     | LT-1, LT-2, CT-10          | planned |
| D-36     | PT-7, CT-11, DF-1, DF-1b   | planned |
| D-37     | CT-1, PT-14, EC-17         | planned |
| D-38     | PT-12, PT-21, LT-4         | planned |
| D-39     | DF-1 to DF-5, CT-12, PT-30 | planned |

## Coverage Status

| Scope                         | Count | Covered (≥1 positive + ≥1 negative/edge) | Uncovered | Notes                                                                                                   |
| ----------------------------- | ----- | ---------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| PRD ACs (wave 1)              | 8 (AC-1 to AC-7 with AC-3 split, AC-14) | 8               | 0         | AC-1 and AC-3b are dogfood by design (D-39) with a named event each.                                     |
| PRD FRs (wave 1)              | 11    | 11                                       | 0         | FR-5 withdrawn; FR-6 wave-1 share only.                                                                 |
| Story ACs                     | 29    | 29                                       | 0         | S-005 AC-5 is dogfood-only (the runbook exercise); every other AC has a static positive.                 |
| Findings requiring a decision before the story starts | 4 | — | — | A-1 (heading level), A-2 (`EXPECTED_RUNBOOKS`), A-3 (MCP alignment scope), A-7 (rows for #270/#271). |
| Findings needing a dogfood observation | 2 | — | — | A-6 (default workflow names, DF-4), A-13 (search count, DF-1).                                                |
