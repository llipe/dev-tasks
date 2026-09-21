# Traceability Matrix: Shared Understanding — Phase 3 (Ubiquitous Language)

## Changelog

| Version | Date       | Summary                                  | Author   |
| ------- | ---------- | ----------------------------------------- | -------- |
| 1.0     | 2026-09-21 | Initial traceability matrix, Design Mode. | verifier |

Format: `AC-ID -> Test-Case-ID(s) -> Observed-Result`. `Observed-Result` is blank for every row — this is a pre-implementation Design Mode artifact; `verifier` Audit Mode fills it per story after implementation.

Test-case ID series (defined in `workstream/test-plan-shared-understanding-phase-3.md`): `E2E` scenarios, `CT` contracts, `UT` unit cases (executable), `IT` integration cases (executable), `PT` parity tests (executable), `FX` hand-walked fixtures, `EC` edge cases, `RT` randomized tactics, `A` flagged ambiguities. Positive = a case asserting the criterion holds under normal operation; Negative/Edge = a case asserting its boundary or failure behavior. Every row carries at least one of each.

## PRD-Level Acceptance Criteria (Phase 3 scope)

| AC-ID | Description                                                                                                    | Positive Test Case(s)             | Negative/Edge Test Case(s)               | Ambiguity | Observed-Result |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- | --------- | --------------- |
| AC-06 | `install`/`update` scaffold the glossary when absent on every profile; byte-identical when present.             | E2E-1, E2E-2, IT-1, IT-4, CT-1    | IT-2, IT-3, IT-5, EC-30                   | —         |                 |
| AC-07 | A PRD with an unaccounted domain term fails refinement with a named finding.                                    | E2E-4(d), E2E-6, UT-V1, UT-V4, UT-V6, CT-7 | UT-V2, UT-V12, UT-V13, UT-R1, EC-13, EC-14, EC-15 | A-1, A-7, A-8, A-14 |     |
| AC-08 | A proposed term conflicting with an existing term or a forbidden synonym surfaces as a grilling question.       | E2E-5, FX-1, PT-1                  | E2E-10, EC-15 (same term, same definition: no question — in FX-1 setup), PT-1 negatives | — |        |
| AC-15 | New exported identifiers matching a forbidden synonym are reported by the verifier.                             | E2E-9, UT-X1..UT-X5, UT-X15, CT-8, PT-4 | UT-X6, UT-X7, UT-X8, UT-X11, EC-36     | A-2, A-17 |                 |

## PRD Functional Requirements and Non-Goals

| ID    | Requirement                                                                         | Positive Test Case(s)               | Negative/Edge Test Case(s)          | Ambiguity | Observed-Result |
| ----- | ----------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------- | --------- | --------------- |
| FR-17 | Glossary exists in every install; never overwritten; every profile.                  | E2E-1, IT-1, CT-1, CT-2              | IT-2, IT-3, IT-4, EC-30             | —         |                 |
| FR-18 | Organized by bounded context; seven fields per term (heading + context + five bullets). | UT-G1, UT-G15, UT-G17, CT-4          | UT-G2, EC-3, EC-4, EC-5             | A-12      |                 |
| FR-19 | Changelog; append-only; superseded terms marked with replacement and decision ID.    | UT-G5, UT-G13 (pass), UT-G14, EC-27, EC-28 | UT-G4, UT-G13 (removed), EC-29 | A-4       |                 |
| FR-20 | Use glossary terms or propose in Vocabulary; append on approval, not draft.          | E2E-4, FX-2, PT-2, UT-V5, CT-11      | EC-22, EC-24, EC-25, EC-32          | A-18      |                 |
| FR-21 | Conflicts surfaced as a question, never silently.                                    | E2E-5, FX-1, PT-1                    | E2E-10, PT-1 negatives              | —         |                 |
| FR-22 | One glossary at the root; no live meta-repo references (verified).                   | IT-9                                 | EC-41 (no per-package rule expected) | —        |                 |
| FR-23 | Verifier checks new exported identifiers; reports forbidden synonyms.                | E2E-9, UT-X1..UT-X5, CT-8            | UT-X6, UT-X7, UT-X10..UT-X12        | A-2       |                 |
| FR-63 | Bounded contexts map to package-map packages or explicit domains.                    | UT-G8, UT-G17, EC-10                 | UT-G7, UT-G19, EC-8, EC-9, EC-24    | A-15      |                 |
| NG-1  | No automatic term generation from code.                                              | UT-V12 (no prose scan), UT-X7 (canonical match reports nothing, creates nothing) | UT-X6 (unmatched identifier is not a proposal) | — |          |
| NG-2  | No tactical DDD patterns.                                                            | CT-4 (schema has no aggregate/entity fields)                                     | EC-5 (extra bullet ignored, not mandated)     | — |          |

## Story-Level Acceptance Criteria

### S-001 — Deliver the glossary install-if-absent and warn on absence (#229)

| AC-ID      | Description                                                                          | Positive Test Case(s)       | Negative/Edge Test Case(s)   | Ambiguity | Observed-Result |
| ---------- | ------------------------------------------------------------------------------------ | --------------------------- | ---------------------------- | --------- | --------------- |
| S-001-AC-1 | Template with five-key frontmatter, `status: unfilled`, empty changelog, no contexts. | CT-3, UT-G1                  | UT-G12, EC-40                | A-9       |                 |
| S-001-AC-2 | One `INSTALL_IF_ABSENT_FILES` entry tagged `ROOT_PROFILE_TAG`.                        | CT-1                         | IT-2 (delivered once on `all`) | —       |                 |
| S-001-AC-3 | Manifest lists template under `managed_paths`, target under `consumer_owned_paths`.   | CT-2, IT-6                   | IT-4 (consumer-owned survives `update`) | — |                |
| S-001-AC-4 | Fresh install on each profile creates the file byte-identical; re-run leaves it.      | E2E-1, E2E-2, IT-1, IT-4     | IT-2, IT-3, IT-5, EC-30      | —         |                 |
| S-001-AC-5 | `doctor` warns on absence proposing `update`; silent when present, even empty; never fails. | E2E-3, UT-D1, CT-10     | UT-D2, UT-D3, UT-D4, UT-D5, EC-1 | —     |                 |
| S-001-AC-6 | `docs/README.md` lists `domain/`; `lint` passes with no sub-index.                    | PT-7, IT-7                   | E2E-7 (docs-structure with the directory link) | — |           |

### S-002 — Validate glossary structure under `lint` (#230)

| AC-ID      | Description                                                                          | Positive Test Case(s)             | Negative/Edge Test Case(s)                    | Ambiguity        | Observed-Result |
| ---------- | ------------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------- | ---------------- | --------------- |
| S-002-AC-1 | `lint` fails on each structural rule (missing field, bad Status, dangling supersede, duplicate, unresolved context, removed term). | UT-G2, UT-G3, UT-G4, UT-G6, UT-G7, UT-G13, E2E-8, IT-8, RT-4 | UT-G5, UT-G8, UT-G14, UT-G15, UT-G19, EC-3..EC-8, EC-27..EC-29 | A-12, A-15, A-16 | |
| S-002-AC-2 | Reports without failing: no package map (exactly one), archived origin.               | UT-G9, UT-G10, IT-8 (staleness run) | UT-G11, EC-9, EC-11, EC-12, EC-34             | A-5, A-6         |                 |
| S-002-AC-3 | Zero terms passes; malformed frontmatter fails.                                       | UT-G1, EC-1                        | UT-G12, EC-35, RT-5                           | A-9              |                 |
| S-002-AC-4 | Runs under `pnpm run lint` via `tsx core/checks/run.ts`; exported from `index.ts`.    | CT-9, IT-7, E2E-7                   | E2E-8, IT-8 (exit codes), EC-33, EC-42        | A-5              |                 |
| S-002-AC-5 | No `yaml`/markdown-parser import.                                                     | CT-12                               | UT-G18, EC-7 (hand parser skips fences)       | —                |                 |

### S-003 — Propose vocabulary in PRDs and specs, enforce AC-07, append on approval (#231)

| AC-ID      | Description                                                                          | Positive Test Case(s)          | Negative/Edge Test Case(s)               | Ambiguity        | Observed-Result |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------------- | ---------------- | --------------- |
| S-003-AC-1 | `## Vocabulary` after `## Decisions` in both Output Structures, spec §5 table.        | PT-2, PT-3, CT-11               | EC-14 (extra column tolerated by the check, not by the template) | — |          |
| S-003-AC-2 | `vocabulary-missing` / `vocabulary-incomplete` (naming the row) semantics.            | UT-V1, UT-V3, UT-V4, UT-V5, UT-V6, UT-V8, CT-7 | UT-V2, UT-V7, UT-V9, UT-V10, UT-V11, UT-V12, EC-13, EC-15, RT-6 | A-7, A-14 | |
| S-003-AC-3 | Pre-review check call; `lint` walks `docs/requirements/` skipping pre-Phase-2 files.  | E2E-6, PT-2, UT-R2, IT-7        | UT-R1, UT-R3, E2E-7 (A-8 self-application) | A-8, A-18       |                 |
| S-003-AC-4 | Approval append: entry, Origin, Status, `+term` row, version bump, status flip; conflict marks superseded and keeps it. | E2E-4(f), FX-2, PT-2 | EC-22, EC-23, EC-24, EC-32, E2E-5 (supersede path) | A-4 |        |
| S-003-AC-5 | Append is `activity-refine`'s; `activity-grill` Write Authority unchanged.            | PT-1 (snapshot), PT-2           | FX-1 (no glossary write during grilling), E2E-10 | —          |                 |
| S-003-AC-6 | Three-tree parity for both skills.                                                    | PT-2, PT-3, CT-13               | N/A — binary presence check across trees  | —                |                 |

### S-004 — Surface vocabulary conflicts during grilling (#232)

| AC-ID      | Description                                                                          | Positive Test Case(s)  | Negative/Edge Test Case(s)                                  | Ambiguity | Observed-Result |
| ---------- | ------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------- | --------- | --------------- |
| S-004-AC-1 | WHAT phase asks which concepts the PRD introduces; checks (a) same term/different definition and (b) forbidden synonym; presents as a question with a recommendation. | E2E-5, FX-1, PT-1 | FX-1 setup rows: same term + same definition → reused, no question; a synonym forbidden by two terms → one question naming both | — | |
| S-004-AC-2 | Every "(once Phase 3 ships it)" / "moot until Phase 3" note removed; Issue Mode read-only rule stands. | PT-1 negatives, E2E-10 | E2E-10 (read-only rule binds with a real glossary present) | — |          |
| S-004-AC-3 | Write Authority unchanged.                                                            | PT-1 snapshot           | FX-1 (transcript shows no glossary write)                    | —         |                 |
| S-004-AC-4 | `vocabulary-conflict.md` fixture demonstrates a forbidden-synonym collision → FR-21 question → `D-NN`. | FX-1, FX-3   | E2E-5 conflict-resolution branch (supersede)                 | —         |                 |

### S-005 — Report forbidden synonyms in new exported identifiers (#233)

| AC-ID      | Description                                                                          | Positive Test Case(s)               | Negative/Edge Test Case(s)                        | Ambiguity              | Observed-Result |
| ---------- | ------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------- | ---------------------- | --------------- |
| S-005-AC-1 | Matches the nine declaration forms and `export { a, b as c }`; splits four casings; normalizes case and plural; hits on word or joined identifier. | UT-X1..UT-X5, UT-X13, RT-1, RT-2, CT-8 | UT-X10, UT-X11, UT-X12, EC-16..EC-20, RT-3 | A-3, A-10, A-11, A-13 | |
| S-005-AC-2 | Unmatched identifiers produce nothing.                                                | UT-X6, RT-3 (no-false-positive half)  | UT-X7, UT-X8, EC-36                                | —                      |                 |
| S-005-AC-3 | Every finding in `staleness`; `lint` exit code unaffected.                            | UT-X9, E2E-9                          | IT-8 (staleness-only run exits 0), UT-X15          | —                      |                 |
| S-005-AC-4 | `verifier` Audit Mode calls the function and narrates an advisory class, three trees. | PT-4, CT-13, E2E-9                    | EC-36 (empty diff narration)                        | —                      |                 |
| S-005-AC-5 | Over this phase's own diff with the populated glossary: nothing, or hits fixed in the same PR. | E2E-11                        | EC-21                                               | A-17                   |                 |

### S-006 — Populate this repository's glossary and retire the package-map placeholder (#234)

| AC-ID      | Description                                                                          | Positive Test Case(s)  | Negative/Edge Test Case(s)                          | Ambiguity | Observed-Result |
| ---------- | ------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------------------- | --------- | --------------- |
| S-006-AC-1 | Exactly eight terms under `AI-assisted development workflow`, five fields each, origins per spec, `Status: active`, frontmatter `active`, version bumped, one `+term` row. | UT-G17, E2E-11 | RT-4 (each single mutation of the real file fails exactly one rule) | A-4 | |
| S-006-AC-2 | `lint` passes on the populated file; self-scan of the phase diff reports nothing.     | IT-7, E2E-7, E2E-11     | EC-21 (predicted `package` hit)                      | A-17, A-8 |                 |
| S-006-AC-3 | `docs/tech.md` D-45 sentence replaced by a glossary pointer; column value unchanged.  | PT-6, IT-9              | UT-G17 (heading equals the unchanged cell exactly)   | A-15      |                 |
| S-006-AC-4 | `activity-init` gains one pointer sentence, three trees; no new step.                 | PT-5, CT-13             | PT-5 step-count assertion                            | —         |                 |
| S-006-AC-5 | No invented vocabulary; every term traces to a PRD FR or decision ID.                 | UT-G17 (Origin regex)   | UT-G10 (an unresolvable decision origin would report) | —        |                 |

## Decision Constraints (D-57..D-69)

| ID   | Constraint                                                                                          | Positive Test Case(s)          | Negative/Edge Test Case(s)                | Ambiguity   | Observed-Result |
| ---- | --------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------- | ----------- | --------------- |
| D-57 | One `ROOT_PROFILE_TAG` registry entry; template + manifest paths; no new mechanism.                  | CT-1, CT-2, IT-1               | IT-2, IT-3                                | —           |                 |
| D-58 | `docs/README.md` `domain/` row; no sub-index; `INDEXES` unchanged.                                   | PT-7, IT-7                     | E2E-7                                     | —           |                 |
| D-59 | Separate `glossary.ts`; `index.ts` export; `tsx` invocation; one implementation, two callers.        | CT-9, CT-12, IT-7, PT-4        | E2E-8, IT-8                               | —           |                 |
| D-60 | Regex over added `export` lines; no compiler API.                                                    | UT-X1, UT-X2, CT-8, CT-12      | UT-X11, UT-X12 (documented misses)         | A-10, A-11  |                 |
| D-61 | `## Vocabulary` after `## Decisions`; `activity-refine` appends; `activity-grill` only surfaces.      | PT-2, PT-3, FX-2               | PT-1 snapshot, FX-1, E2E-10               | —           |                 |
| D-62 | `activity-init`: one sentence, no new step.                                                          | PT-5                           | PT-5 step-count assertion                 | —           |                 |
| D-63 | FR-23 findings always `staleness`; never block; `lint` exit unaffected.                              | UT-X9, E2E-9, PT-4             | IT-8, UT-X15, EC-36                        | —           |                 |
| D-64 | Forbidden-synonym hits only; unmatched and canonical-term identifiers are never findings.             | UT-X1..UT-X5, RT-3             | UT-X6, UT-X7, UT-X8, EC-21                 | A-2, A-17   |                 |
| D-65 | Structural `## Vocabulary` check; no prose scanning.                                                 | UT-V1, UT-V5, CT-7             | UT-V11, UT-V12, EC-7                       | A-1         |                 |
| D-66 | Fail/report split; absent map → exactly one finding; zero terms valid.                                | UT-G2..UT-G7, UT-G13, RT-4     | UT-G9, UT-G10, UT-G1, EC-1, EC-9, EC-34    | A-5, A-6, A-7, A-12 |         |
| D-67 | `doctor` warns on absence only; empty-but-present silent; never fails.                               | UT-D1, E2E-3                   | UT-D2, UT-D3, UT-D4, EC-1, EC-33           | A-5         |                 |
| D-68 | Five-key frontmatter; `owner: product-engineer`; `status: unfilled` on the template.                 | CT-3, UT-G1                    | UT-G12, EC-22 (flip on first append), EC-40 | A-9        |                 |
| D-69 | Eight seed terms under the package-map's single context; D-45 placeholder replaced.                  | UT-G17, PT-6, E2E-11           | RT-4, EC-21, UT-G19                        | A-15, A-17  |                 |

## Coverage Summary

| Set                            | Count | Uncovered |
| ------------------------------ | ----- | --------- |
| PRD-level ACs                  | 4     | 0         |
| PRD FRs + non-goals            | 10    | 0         |
| Story-level ACs                | 31    | 0         |
| Decision constraints           | 13    | 0         |
| Ambiguities flagged (A-1..A-18) | 18   | — for Audit Mode |

Every row has at least one positive and one negative/edge case. Two PRD-level criteria (AC-07, AC-15) are covered only in their decision-narrowed form (A-1, A-2); the matrix records this so Audit Mode classifies it as Intended drift rather than a gap.
