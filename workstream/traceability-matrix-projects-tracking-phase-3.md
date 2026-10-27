# Traceability Matrix: projects-tracking — Wave 3 (migration of an existing repository)

## Changelog

| Version | Date       | Summary                                   | Author   |
| ------- | ---------- | ----------------------------------------- | -------- |
| 1.1     | 2026-10-26 | Wave 3 rollup F-5: execution note added; AC-13 reads as amended by D-99. Per-row Observed and Status columns stay as designed; observed results live in the per-story fidelity reports and the rollup. | planner  |
| 1.0     | 2026-10-24 | Initial traceability matrix, Design Mode. | verifier |

Format: `PRD FR/AC -> story AC -> Test-Case-ID(s) -> Observed result -> Status`. This is a pre-implementation Design Mode artifact, so every `Observed result` is `—` and every `Status` is `planned`. `verifier` Audit Mode replaces them with the observed value and `Pass | Fail | Drift` per story. For every `DF-*` row it records the observed read once the event has happened, or `pending` until then.

**Execution note (2026-10-26).** All six stories merged (PRs #326 to #332). Observed results are recorded in `workstream/fidelity-report-S-013.md`, `-S-014.md`, `-S-015.md`, `-S-016.md`, `-S-019.md`, `-S-017-part-1.md`, `-S-017-part-2.md` and the rollup `workstream/fidelity-report-projects-tracking-phase-3-rollup.md`; this matrix keeps its Design Mode `planned` statuses. PRD AC-13 is amended by D-99: the plan lists state files without a `Wave issue:` line, and the planner's resume adds it; it is covered by `classify.test.ts`, not uncovered.

Test-case IDs are defined in `workstream/test-plan-projects-tracking-phase-3.md`:

| Series | Layer / kind | Location |
| ------ | ------------ | -------- |
| `MU` | Layer 1 behaviour | `test/unit/migrate-projects/*.test.ts` |
| `MC` | Layer 2 CLI through a fake `gh` on PATH | `test/unit/migrate-projects/cli.test.ts` |
| `RT` | Layer 1 property and fuzz | `test/unit/migrate-projects/properties.test.ts` |
| `PT` | Layer 1 static parity; presence only, per `TESTING.md` § Known limitations | `test/unit/projects-tracking-wave-3-parity.test.ts` |
| `CT` | contract shapes | — |
| `LT` | existing gates | — |
| `E2E` | composed scenarios | — |
| `EC` | edge cases | — |
| `DF` | Layer 4 dogfood reads after a live event | — |
| `RV` | review checks | — |
| `A` | Design Mode findings | — |

## PRD-Level Acceptance Criteria (wave 3 scope)

| PRD AC | Description | Story AC(s) | Positive test(s) | Negative/edge test(s) | Verified by | Finding(s) | Observed | Status |
| ------ | ----------- | ----------- | ---------------- | --------------------- | ----------- | ---------- | -------- | ------ |
| AC-11 | Fixture dry run: exactly the FR-19 writes, the unmappable issue named, no title change, no parent for the bug, nothing changed before approval. | S-013 AC-6; S-014 AC-1, AC-3, AC-5, AC-7 | MU-59, MU-36 to MU-38, MU-44 to MU-50, E2E-16, E2E-17, MC-1 | MU-31, MU-39, MU-54, RT-9, RT-10, RT-13, EC-120 to EC-124 | behaviour (L1, L2) | A-53 to A-57, A-71 | — | planned |
| AC-12 | After the approved run: no open issue with a retired label, no PR item on the Project, no Status written. | S-015 AC-3 to AC-6; S-017 AC-3 | MU-75, MU-73, E2E-22, DF-29 | MU-69, MU-71, MU-72, MU-74, E2E-23, E2E-26, RT-11, EC-149, DF-26 (owner tick, Project half) | behaviour + dogfood | A-49, A-82 | — | planned |
| AC-13 | Fixture roadmap passes roadmap-parity after conversion; each active state file carries the wave issue line. | S-014 AC-2; S-016 AC-1 to AC-3 | MU-35 (first half), MU-33, LT-18, PT-68 to PT-70 | MU-34, MU-22 (listed, not edited), EC-161 | behaviour + static | **A-58**, A-59 | — | planned (first half); **uncovered by design (second half) until A-58** |
| AC-16 | Three github-ops copies state type set and tie-break, priority scale, `**Blocks:**` line and dependency commands identically; audit reports the three checks. | S-019 AC-1 to AC-4, AC-7 | PT-55 to PT-57, PT-59 to PT-63, PT-66 | PT-58, PT-59 negative, PT-60 negative, PT-67, EC-158 to EC-160 | static (presence only) | A-68, A-72, A-89 | — | planned |

## PRD Functional Requirements (wave 3 scope)

| FR | Requirement (short form) | Story AC(s) | Positive test(s) | Negative/edge test(s) | Verified by | Finding(s) | Status |
| -- | ------------------------ | ----------- | ---------------- | --------------------- | ----------- | ---------- | ------ |
| FR-17 | `--plan` dry run, batches, review lists; `--apply` only approved, states, resume. | S-013 AC-1 to AC-7; S-014 AC-3; S-015 AC-1 to AC-4; S-017 AC-2 | MU-24 to MU-26, MU-44, MU-63, MU-64, MU-68, MC-1, MC-13, E2E-16, E2E-22 | MU-31, MU-60 to MU-62, MC-11, MC-12, E2E-20, E2E-21, E2E-23, RT-10, RT-11, RT-14 | behaviour + dogfood | A-49, A-50, A-51, A-65, A-79, A-80 | planned |
| FR-18 | Mapping precedence; unmapped never guessed. | S-014 AC-1, AC-6 | MU-36 to MU-38, MU-55 | MU-39 to MU-43, MU-58, RT-9, EC-120 to EC-124 | behaviour | A-54 to A-57 | planned |
| FR-19 | Scope rules; story definition; titles unchanged. | S-013 AC-4; S-014 AC-3 to AC-5 | MU-1 to MU-6, MU-46, MU-47, MU-52 | MU-5, MU-53, MU-54, RT-13, EC-125 to EC-131 | behaviour | A-53, A-83, A-91 | planned |
| FR-20 | Retired labels removed from open issues, definitions kept; Project batch by the user; no Status backfill. | S-014 AC-3; S-015 AC-5, AC-6; S-017 AC-1, AC-3 | MU-49, MU-51, MU-73, MU-75, DF-26, DF-29 | MU-71, MU-72, MU-74, EC-132, EC-133, EC-149 to EC-151 | behaviour + dogfood | A-60, A-61, A-82 | planned |
| FR-21 | Roadmap conversion; state-file `Wave issue` line. | S-016 AC-1 to AC-3; S-014 AC-2 | PT-68 to PT-70, MU-33, MU-35 | MU-34, MU-22, PT-72, EC-161 to EC-163 | static + behaviour | A-58, A-59 | planned (state-file half uncovered, A-58) |
| FR-22 | Runbook in the same PR; this repository migrated; Done on consolidated merge. | S-017 AC-1 to AC-5 | PT-75, PT-76, LT-20, LT-21, DF-21 to DF-29, RV-5 | PT-77, PT-79, EC-164 to EC-167 | static + dogfood | A-62, A-65, A-90 | planned |
| FR-26 | Type set, tie-break, priority scale, `**Blocks:**`, aggregation. | S-019 AC-1 to AC-7; S-013 AC-4 | PT-55 to PT-66, MU-7 to MU-12, RT-15 | PT-58, PT-60, PT-67, MU-13 to MU-16, EC-112 to EC-114, EC-158 to EC-160 | static + behaviour | A-68 to A-72, A-87, A-89 | planned |

## Story Acceptance Criteria

| Story AC | Description (short) | Positive test(s) | Negative/edge test(s) | Contract(s) | Finding(s) | Observed | Status |
| -------- | ------------------- | ---------------- | --------------------- | ----------- | ---------- | -------- | ------ |
| S-019/AC-1 | Type set, definitions, exactly-one rule, tie-break, `type: test` row, `tech-debt` narrowed, `type: other` retired | PT-55, PT-56, PT-57, PT-59 | PT-58, PT-59 negative, EC-158 | — | A-68, A-70 | — | planned |
| S-019/AC-2 | Priority scale; `**Blocks:**` rule | PT-60, PT-61 | PT-60 negative, EC-159 | — | A-72 | — | planned |
| S-019/AC-3 | Dependency POST and DELETE; agent-may-write sentence | PT-62 | PT-62 (DELETE literal), PT-67 | CT-40 | A-89 | — | planned |
| S-019/AC-4 | Audit: critical without relation; zero/several types; retired label on open issue | PT-63 | EC-160, A-72 negative wording | — | A-68, A-72 | — | planned |
| S-019/AC-5 | product-engineer aggregation queries | PT-64 | PT-67 (no `role:`) | — | A-86 | — | planned |
| S-019/AC-6 | publish: exactly one `type:` per story | PT-65 | PT-58 (no `type: other` offered) | — | — | — | planned |
| S-019/AC-7 | Pins byte-identical; `type: other` negative | PT-66 | PT-58 | — | — | — | planned |
| S-016/AC-1 | Conversion step | PT-68 | PT-72, EC-161 to EC-163 | CT-37 | A-59 | — | planned |
| S-016/AC-2 | Migration dependency; exact match | PT-69, MC-8 | MU-34, MU-37 | CT-37 | A-56 | — | planned |
| S-016/AC-3 | State files not edited; planner resume adds line | PT-70, MU-22 | MU-22 (file byte-identical) | — | A-58, A-83 | — | planned |
| S-016/AC-4 | Pins byte-identical | PT-71, LT-18 | PT-72 | — | A-86 | — | planned |
| S-013/AC-1 | Command, flags, defaults, `--help` | MC-1 to MC-5, MC-10, E2E-16 | MC-9, EC-116 | CT-24, CT-35 | A-52, A-63, A-65 | — | planned |
| S-013/AC-2 | `gh auth status` first; exit 11 with hint; nothing else read | MU-17, MC-6, E2E-18 | MC-7, EC-101, EC-102 | CT-31, CT-34 | A-88 | — | planned |
| S-013/AC-3 | Snapshot through the injectable runner, paginated | MU-18, MU-21, MU-22 | MU-19, MU-20, MU-23, RT-8, EC-105, EC-119, EC-157 | CT-31, CT-32 | A-52, A-74, A-75, A-76, A-91 | — | planned |
| S-013/AC-4 | Classification; needs a type; needs a blocking link | MU-1 to MU-4, MU-6 to MU-10, MU-12 | MU-5, MU-11, MU-13 to MU-16, RT-13, RT-15, EC-106 to EC-115 | CT-38 | A-53, A-54, A-68 to A-70, A-72 | — | planned |
| S-013/AC-5 | Planfile render and parse round-trip with answers | MU-24 to MU-26 | MU-27 to MU-30, RT-7, EC-111 | CT-24 to CT-30 | A-77, A-78 | — | planned |
| S-013/AC-6 | `--plan` makes zero write calls | MU-31, E2E-16 | RT-10 | CT-32 | — | — | planned |
| S-013/AC-7 | No issue bodies in the file | MU-32 | RT-7 (sentinel), EC-118 | CT-30 | A-84 | — | planned |
| S-014/AC-1 | Mapping precedence | MU-36 to MU-38 | MU-39 to MU-43, RT-9, EC-120 to EC-124 | CT-37, CT-38 | A-54 to A-57 | — | planned |
| S-014/AC-2 | Missing table exits 2 | MC-8, E2E-19 | MU-34 | CT-34, CT-37 | A-59, A-64 | — | planned |
| S-014/AC-3 | Batches 1–7, order and contents | MU-44 to MU-51 | MU-47 (wrong wave), EC-125 to EC-133 | CT-27, CT-36 | A-66, A-67, A-71, A-81, A-83, A-84 | — | planned |
| S-014/AC-4 | Reused tracking issues; two matches | MU-52, MU-3 | MU-53, EC-129, EC-130 | — | A-53, A-91 | — | planned |
| S-014/AC-5 | No title, standalone hierarchy or Status write | MU-54 | RT-13, MU-72 | CT-27 | — | — | planned |
| S-014/AC-6 | Answers carried over | MU-55, MU-56, E2E-25 | MU-57, MU-58, EC-135 to EC-137 | CT-26 | A-50, A-73 | — | planned |
| S-014/AC-7 | AC-11 fixture in one test | MU-59, E2E-17 | MU-59 (no bug parent, zero writes), RV-3 | — | A-57 | — | planned |
| S-015/AC-1 | `Approved: no` → 14, nothing written | MU-60, MC-11, E2E-20 | MU-61, RT-14, EC-147, EC-148 | CT-25, CT-34 | A-50, A-51, A-79 | — | planned |
| S-015/AC-2 | Stale snapshot → 14 "regenerate the plan" | MU-62, MC-12, E2E-21 | EC-138 | CT-34 | **A-49** | — | planned |
| S-015/AC-3 | Batches 1–6 in order; states written back per call | MU-63, MU-64, MU-70 | MU-65, MU-67, E2E-24, EC-139 to EC-143, EC-152 | CT-28, CT-29, CT-31, CT-33 | A-80, A-81, A-93 | — | planned |
| S-015/AC-4 | Re-run only `pending`/`failed`; no `done` repeated | MU-68, MU-69, E2E-23 | MU-66, RT-11, RT-12, EC-144 to EC-146 | CT-28 | **A-49**, A-66, A-80 | — | planned |
| S-015/AC-5 | Batch 7 never executed; no `gh project` call | MU-63, MU-51 | MU-71, E2E-26, EC-149, PT-80 | CT-33 | A-60 | — | planned |
| S-015/AC-6 | Retired labels removed; descriptions prefixed; no delete | MU-73, MU-75 | MU-72, EC-150, EC-151 | CT-33 | A-82 | — | planned |
| S-015/AC-7 | Bodies via `--body-file`; marker procedure | MU-76, MU-78 | MU-77, EC-153, EC-154 | CT-33, CT-36 | A-67 | — | planned |
| S-015/AC-8 | Exit 1 on any failed, else 0; `--json` counts | MC-13, MC-14, E2E-22 | E2E-24, MC-16, MC-17, EC-103, EC-155 | CT-34, CT-35 | A-64 | — | planned |
| S-017/AC-1 | Runbook sections in order | PT-75 | LT-20 (FR-48 headings), EC-167 | — | A-62, A-65 | — | planned |
| S-017/AC-2 | github-ops migration mode ×3 | PT-73, PT-74, PT-78, DF-23, DF-24 | PT-74 negative, EC-164, EC-165 | CT-39 | A-50, A-61 | — | planned |
| S-017/AC-3 | This repository migrated; plan file committed in a chore PR | DF-22, DF-25, DF-28, DF-29 | DF-27, EC-166, EC-167 | — | A-49, A-65, A-66, A-90 | pending | planned |
| S-017/AC-4 | Runbook indexed; docs-structure green | PT-76, LT-21 | LT-20 | — | A-62 | — | planned |
| S-017/AC-5 | Mode pins; runbook sole `item-delete` file in `docs/`; PT-28b green | PT-77, PT-78, LT-19 | PT-79 | — | A-61 | — | planned |

## Decision Constraints

| Decision | Test(s) | Status |
| -------- | ------- | ------ |
| D-79 | MU-31, RT-10, MC-1, PT-73 | planned |
| D-80 | MU-60, MU-61, MC-11, PT-74, DF-24 | planned |
| D-81 | MU-51, MU-71, PT-80, DF-26 | planned |
| D-82 | MU-1, MU-2, MU-6, MU-54 | planned |
| D-83 | PT-64, PT-67 | planned |
| D-84 | MU-12 to MU-16, PT-60, PT-61 | planned |
| D-85 | MU-7 to MU-11, RT-15, PT-55 to PT-59, PT-81 | planned |
| D-86 | MU-34, MU-37, MU-41, MC-8, PT-69 | planned |
| D-87 | MU-3, MU-4, MU-52, MU-53 | planned |
| D-88 | MU-63 to MU-70, RT-11 | planned |
| D-89 | MU-22, PT-70 | planned |
| D-90 | harness, MU-59 | planned |
| D-91 | MU-49, MU-72, MU-73, MU-75 | planned |
| D-92 | MU-50, MU-78 | planned |
| D-93 | PT-75, DF-28 | planned |
| D-94 | RV-5 | planned |
| D-95 | RV-3, RV-4 | planned |
| D-96 | MU-17, MC-6, MC-7, MC-17 | planned |
| D-97 | MU-51, MU-71 | planned |

## Coverage Status

| Scope | Count | Covered (≥1 positive + ≥1 negative/edge) | Uncovered | Notes |
| ----- | ----- | ---------------------------------------- | --------- | ----- |
| PRD ACs (wave 3) | 4 | 3 full, 1 partial | AC-13 second half | AC-13's "each active state file carries the line" is unreachable by migration under D-89 (A-58). AC-12's Project half rests on the owner's tick (DF-26). |
| PRD FRs (wave 3) | 7 | 7 | 0 | FR-21's state-file half as AC-13. |
| Story ACs | 38 | 38 | 0 | S-015 AC-2 and AC-4 contradict each other on resume (A-49); both are tested, but one test must change once the decision is made. |
| Decisions D-79 to D-97 | 19 | 19 | 0 | — |
| Findings to decide before S-013 freezes the plan-file contract | 10 | — | — | A-49 to A-58. |
| Findings that would turn an existing gate red if ignored | 3 | — | — | A-59 (roadmap-parity import), A-62 (`runbook-set` exact list), A-61 (PT-28b). |

## Test-Case Counts

| Series | Count | Layer |
| ------ | ----- | ----- |
| MU | 78 | Layer 1 behaviour |
| MC | 17 | Layer 2 CLI |
| RT | 9 (8 property/fuzz/walk, 1 enumerated) | Layer 1 |
| PT | 27 | Layer 1 static |
| LT | 10 | existing gates |
| DF | 9 | Layer 4 dogfood |
| RV | 3 | review |
| E2E | 12 scenarios (composed from the above) | — |
| CT | 17 contracts | — |
| EC | 67 edge cases | — |
