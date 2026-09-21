# Test Plan: Shared Understanding — Phase 2 (Grilling, Decision Log, Refine/Spec/Plan Integration)

## Changelog

| Version | Date       | Summary                                    | Author   |
| ------- | ---------- | ------------------------------------------- | -------- |
| 1.0     | 2026-09-21 | Initial compliance test plan, Design Mode. | verifier |

## Source Input Summary

| Artifact             | Path                                                                     | Version |
| --------------------- | ------------------------------------------------------------------------- | ------- |
| PRD (scope)            | `docs/requirements/prd-shared-understanding-refinement.md`, FR-1..FR-16, AC-01..05, AC-09, AC-16 | v1.13   |
| Specification          | `workstream/specification-shared-understanding-phase-2.md`               | v1.0    |
| User Stories            | `workstream/user-stories-shared-understanding-phase-2.md` (S-001..S-007) | v1.0    |
| Decision log            | `workstream/decisions-shared-understanding.md` (D-53..D-56 own this phase) | current |
| Implementation plan     | `workstream/tasks-shared-understanding-phase-2-plan.md`                  | current |
| GitHub Issues           | #213 (S-001), #214 (S-002), #215 (S-003), #216 (S-004), #217 (S-005), #218 (S-006), #219 (S-007), repo `llipe/dev-tasks` | — |

## A Note on This Feature's Testable Surface

This plan states plainly what previous phases' plans could take for granted: **most of Phase 2 has no unit-testable runtime surface.** S-001 through S-006 change or add Markdown prompt files across `.claude/`, `.github/`, `.kiro/` — skills, agent files, and instructions consumed by an LLM agent at read time, not by a compiler or interpreter. There is no function to call, no input/output pair a unit test can assert on. Inventing unit tests for prompt content (e.g., asserting a string appears at a byte offset) would produce false compliance signal without testing the actual behavioral contract — whether the *agent*, reading that prompt, behaves as specified.

The specification's own Testing Strategy (§14) already resolves this the right way, and this plan adopts it rather than re-deriving something weaker:

- **Skill content** compliance is a content review — this Design Mode document, followed by `verifier` Audit Mode's grey-box fidelity check against FR-1 to FR-16 once the prompt files exist.
- **Scenario transcripts** (`test/fixtures/grilling/`) are the actual behavioral contract for S-001/S-002/S-003: seeded conversational fixtures that assert what the *agent* does when it reads the skill (no user prompt on a codebase-answerable question, the cap-reached continue/stop prompt, the exit-gate re-ask on a premature "sounds good", Issue Mode citation reuse). These are read and walked manually during review — grilling sessions are conversational, not scripted, and no new automated transcript runner is introduced (§14, D-49/D-48 precedent against adding machinery `SIMPLICITY.md` A4 would flag).
- **Parity tests** (`test/unit/skill-parity-grilling.test.ts`, extended `planner-merge-gate-parity.test.ts`) are real, automated, and are the one place this phase gets deterministic pass/fail signal for prompt content: they assert a required string/field/section is present and consistent across all three platform trees.
- **S-007 alone is real TypeScript** (`core/checks/decision-log-format.ts` + `.test.ts`): the only story in this set with conventional unit-testable code, and it gets a conventional unit test plan below.

Only S-007 gets "did the assertion pass/fail" unit coverage. S-001 through S-006 get scenario-fixture walkthroughs, parity-test coverage, and manual review — reported honestly as such, not dressed up as unit tests they are not.

## Acceptance Criteria Extraction

Numbered per source. PRD-level ACs (`AC-01`..`AC-40`) are distinguished from story-level ACs (`S-00N-AC-n`) since both exist in the source material and share overlapping numbering (e.g., PRD `AC-01` and story `S-001 AC-1` are different criteria).

### PRD-level (Phase 2 scope only: AC-01..AC-05, AC-09, AC-16)

| ID     | Criterion                                                                                                                                          | FR(s)        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| AC-01  | Feature Mode: `activity-refine` does not draft a PRD until explicit shared-understanding confirmation and an empty open-questions list.               | FR-8, FR-12  |
| AC-02  | Feature Mode: `activity-generate-spec` does not draft a spec until the HOW-phase exit gate is satisfied.                                              | FR-8, FR-13  |
| AC-03  | Every grilling session produces/appends `decisions-<feature>.md` with one row per resolved question, unique IDs, qualified cross-file citation form.  | FR-4, FR-5   |
| AC-04  | A codebase-answerable question is resolved via direct read or `researcher` delegation, never asked to the user.                                       | FR-3         |
| AC-05  | PRD, spec, and task list cite decision IDs inline and list them in a "Decisions" section.                                                              | FR-14, FR-16 |
| AC-09  | Issue Mode: grilling stops at 8 questions by default, glossary unmodified, prior decisions reused.                                                     | FR-10        |
| AC-16  | `planner` passes the decision log path to every `developer` delegation; the delegated task list cites decision IDs.                                    | FR-16        |

### Story-level acceptance criteria (S-001 to S-007)

See the Traceability Matrix for the full `S-00N-AC-n` list (34 story-level ACs total). Summarized by story:

- **S-001** (activity-grill core skill): 9 ACs — one-question-per-turn, resolve-before-ask, append-per-resolution, tree-summary cadence, cap behavior, hard exit gate, Issue Mode constraints, assumption-testing reminder, three-tree presence.
- **S-002** (activity-refine wiring): 4 ACs — WHAT-phase gate, Issue Mode gate + reuse, inline citations, three-tree parity.
- **S-003** (activity-generate-spec wiring): 4 ACs — HOW-phase gate, pre-step researcher sequencing, inline citations, three-tree parity.
- **S-004** (`plan` citations): 3 ACs — inline task citation, no-fabrication rule, three-tree parity.
- **S-005** (`planner` handoff): 3 ACs — `decision_log_path` field present/unconditional, identical across trees, parity test.
- **S-006** (`implement` reads log first): 4 ACs — pre-branch-gate read, commit/PR citation, graceful absence handling, three-tree parity.
- **S-007** (ADR-008, tech.md config, format check): 4 ACs — ADR content, tech.md subsection, `core/checks` validator, ADR index update.

## E2E Scenarios (`activity-e2e-test-design`)

Grilling-session black-box scenarios. Each is a conversational transcript walked against the finished skill text — "E2E" here means the full agent-observable interview flow, not an HTTP/browser E2E in the conventional sense (there is no such surface in this phase).

| ID    | Scenario                                                                                                                  | Preconditions                                                              | Steps                                                                                                                                  | Expected Observable Result                                                                                                     | Maps to               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| E2E-1 | Full WHAT-phase session ending in a clean exit                                                                              | `activity-refine` PRD Creation mode invoked on a trivial feature request      | Grill session runs; user answers a small number of genuine questions; open list empties; user replies "I confirm, proceed."            | PRD is drafted only after the explicit confirmation; `decisions-<feature>.md` created with one row per resolved question; PRD's `## Decisions` section lists every ID; each shaped requirement cites its ID inline. | AC-01, AC-03, AC-05, S-001-AC-2/3/6, S-002-AC-1/3 |
| E2E-2 | Full HOW-phase session immediately following WHAT, same feature                                                             | E2E-1 completed; feature approved for spec                                    | `activity-generate-spec` invoked; pre-step conditional researcher call runs first; HOW-phase grilling runs; user confirms explicitly.   | Spec not drafted before HOW exit gate; ID sequence continues from WHAT phase (no restart); spec's `## Decisions (HOW phase)` lists consumed IDs. | AC-02, AC-05, S-003-AC-1/2/3 |
| E2E-3 | Codebase-answerable question resolved silently                                                                             | A question whose answer is directly readable from `docs/tech.md`              | Grill session reaches a branch resolvable from `docs/tech.md`                                                                         | No question surfaces to the user; a row is appended with `Accepted rec.` = `n/a` and `Answer` stating what was found and where.  | AC-04, S-001-AC-1/3   |
| E2E-4 | Cap-reached sequence, Feature Mode WHAT phase                                                                               | `docs/tech.md` § Grilling absent (hardcoded default 25 applies)               | 25 questions resolved without reaching an empty open list                                                                              | Skill presents the open list and asks "continue or stop?" — does not auto-continue or auto-stop.                                 | S-001-AC-4/5           |
| E2E-5 | Premature "sounds good" after the open list empties                                                                        | Open-questions list is empty                                                  | Skill asks "do you confirm shared understanding?"; user replies "sounds good 👍"                                                        | Exit gate is NOT satisfied; skill re-asks the direct confirmation question rather than proceeding.                                | AC-01/AC-02, S-001-AC-6 |
| E2E-6 | Issue Mode session reusing a prior decision                                                                                 | A fixture prior `decisions-<other-feature>.md` contains a matching term/branch | `activity-refine` Issue Refinement mode invoked; grilling reaches a branch matching the prior log's term                              | Prior decision cited in qualified form `<other-feature>#D-NN`, not re-asked; glossary untouched; cap enforced at 8.               | AC-09, S-001-AC-7, S-002-AC-2 |
| E2E-7 | `planner` multi-story orchestration handoff                                                                                 | A small multi-story fixture with an existing `decisions-<feature>.md`         | `planner` delegates each story to `developer`                                                                                          | Every delegation context includes `decision_log_path`, unconditionally, even for a story whose spec section cited no decision.   | AC-16, S-005-AC-1      |
| E2E-8 | `implement` starting work on a feature with a decision log                                                                  | `decisions-<feature>.md` exists and is non-empty                              | `implement`'s "Before Starting Work" step runs                                                                                        | Log is read in full before branch creation, alongside (not replacing) the GitHub-issue-open check; a shaped commit cites the decision ID. | S-006-AC-1/2            |
| E2E-9 | `implement` starting work on a feature with no decision log (pre-Phase-2 feature)                                           | No `decisions-<feature>.md` file exists                                       | `implement`'s "Before Starting Work" step runs                                                                                        | Proceeds without the read, noting its absence; does not fail or dead-end.                                                        | S-006-AC-3              |

## Contract Validation Scenarios (`activity-contract-test-design`)

Two "contracts" exist in this phase: the **planner → developer handoff shape** (a structured field contract, not a network API) and the **decision-log schema** (a Markdown table shape multiple consumers parse/write against).

| ID    | Contract                                                                 | Producer                    | Consumer(s)                        | Assertion                                                                                                                                                       |
| ----- | --------------------------------------------------------------------------- | ------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CT-1  | Phase 4 handoff template field `decision_log_path`                          | `planner` (three trees)         | `developer` subagent                    | Field present, named identically, and populated identically (`workstream/decisions-<feature>.md`) across `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`. Parity test fails if any tree omits it (closes research risk #6). |
| CT-2  | `decisions-<feature>.md` row schema (producer side: `activity-grill`)       | `activity-grill`                | `plan`, `implement`, `planner`, downstream PRDs/specs | Every row carries: unique `ID`, `Phase` ∈ {WHAT, HOW}, `Branch`, `Question`, `Recommended`, `Answer`, `Accepted rec.`, `Supersedes` (optional, resolves in-file), `Author`, `Date`. |
| CT-3  | `decisions-<feature>.md` row schema (consumer side: `core/checks`)          | `core/checks/decision-log-format.ts` | `lint` / `validate`                | Validator enforces: unique `ID` within file (hard fail), `Phase` ∈ {WHAT, HOW} (hard fail), `Supersedes` (if present) resolves to an existing in-file `ID` (report, not hard fail — advisory per specification error-handling §13 and S-007 Business Rules). |
| CT-4  | Cross-file citation form                                                     | Any citer (PRD, spec, Issue Mode grilling) | Reader of the citing document          | Citation outside the log's own file uses `<feature>#D-NN`; inside the log itself, unqualified `D-NN`. A citation into a superseded row resolves to the current superseding row per the `Supersedes` invariant (specification §13). |
| CT-5  | `docs/tech.md` § Grilling config contract                                    | S-007 (`docs/tech.md`)          | `activity-grill` (all three trees)     | Table columns `cap.what` / `cap.how` / `cap.issue` present with numeric defaults 25/25/8; `activity-grill` reads this table if present, else falls back to hardcoded defaults — never fails when the subsection is absent. |
| CT-6  | Task-list decision-citation contract                                         | `plan` (three forms)            | `verifier`, `developer`, humans reading the task list | Inline citation format `(D-NN)` on a task line that derives from a decision; `## Decisions Consumed` section present (possibly empty) aggregating every ID cited anywhere in the list. |

## Edge-Case Catalog (`activity-edge-case-refinement`)

Categorized per the skill's standard taxonomy, scoped to this phase's actual risk surface (cap/exit-gate/empty-log/format edges called out explicitly by the assignment).

### Input domain

| ID   | Case                                                                                     | Expected                                                                                   |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EC-1 | Empty open-questions list at invocation (nothing to grill)                                  | Exit gate is trivially satisfied — still requires the explicit confirmation question/reply, per S-001's edge-case matrix; not silently skipped. |
| EC-2 | A question whose codebase answer is ambiguous (multiple conflicting sources)                | Skill still asks the user — does not guess (S-001 edge-case matrix).                          |
| EC-3 | `decisions-*.md` file with zero rows (brand-new feature, nothing resolved yet)              | S-007 format check passes trivially (CT-3); S-006 read step treats it the same as present-and-empty. |

### State transition / cap and exit-gate boundary

| ID   | Case                                                                                     | Expected                                                                                   |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EC-4 | Cap set to 0 or a non-positive value in `docs/tech.md` § Grilling                           | Treated as misconfiguration; falls back to the hardcoded default and notes it in the decision-tree summary (S-001 edge-case matrix). |
| EC-5 | Cap reached exactly at the same turn the open list also empties                              | Spec doesn't state precedence explicitly; the exit-gate rule (empty list AND explicit confirmation) still governs — cap-reached prompt fires per FR-9 rule text ("on reaching the cap"), then if user chooses "stop," gate proceeds to the explicit-confirmation ask, not an auto-satisfied gate. Flag as UNDETERMINED precedence for Audit Mode to confirm against shipped behavior. |
| EC-6 | User raises the cap after a cap-reached prompt, then reaches the new cap again               | Same continue/stop prompt fires again — cap enforcement is not "one-shot"; FR-9 has no exemption for a second reach. |
| EC-7 | Exit-gate reply is silence (no reply at all, conversation stalls)                             | Not satisfied — same as a non-explicit tone reply (FR-8). Gate re-asks on next turn; does not proceed. |
| EC-8 | Exit-gate reply changes topic entirely without confirming or declining                        | Not satisfied (FR-8, explicit "topic change" example named in specification §13). |

### Decision-log format / dangling references

| ID    | Case                                                                                     | Expected                                                                                   |
| ----- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EC-9  | Duplicate `ID` within one file                                                              | S-007 format check hard-fails (CT-3).                                                       |
| EC-10 | `Phase` value outside `{WHAT, HOW}`                                                          | S-007 format check hard-fails (CT-3).                                                       |
| EC-11 | `Supersedes` value pointing at an ID in a *different* feature's log                          | Invalid — column is intra-file only; reported as a failure, not silently accepted (S-007 edge-case matrix). |
| EC-12 | `Supersedes` value pointing at a nonexistent ID in the same file                             | Reported (advisory per specification §13's error-handling framing; S-007 Business Rules treats uniqueness/Phase-enum as hard fails and this as a report to avoid blocking legitimate work-in-progress logs — the plan flags this distinction as a scenario to explicitly confirm in Audit Mode since S-007 AC-3's own wording ("confirms ... resolves to an existing ID") reads as a stronger assertion than the Business Rules qualifier). |
| EC-13 | Stale citation: a cited `<feature>#D-NN` was later superseded                               | Skill surfaces the current (superseding) row instead of the stale one (specification §13). |

### Issue Mode / cross-log scope

| ID    | Case                                                                                     | Expected                                                                                   |
| ----- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EC-14 | Issue Mode session where no prior log has a relevant term                                   | Falls through to a normal question — not an error (S-002 edge-case matrix).                 |
| EC-15 | Issue Mode attempts a glossary proposal                                                      | Business rule: Issue Mode never proposes glossary terms — moot until Phase 3 ships the glossary, but the skill must not assume write access (S-002 Business Rules). |
| EC-16 | Planner-passed `decision_log_path` points at a feature with no file yet (grilling never ran) | Field is still passed as the expected path even though the file doesn't exist; `implement`/S-006 is responsible for the graceful-absence handling, not `planner` (S-005 edge-case matrix). |

### Researcher-budget boundary (D-56)

| ID    | Case                                                                                     | Expected                                                                                   |
| ----- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EC-17 | Pre-step research artifact exists and covers the branch in question                          | `activity-grill` does not make its own `researcher` call — reads the existing artifact (D-56, resolve-before-ask step (c)/(d)). |
| EC-18 | Pre-step research artifact absent or stale, and the branch needs multi-slice evidence         | `activity-grill`'s own bounded `researcher` call is unblocked, not silently skipped (S-003 edge-case matrix) — still at most once per phase total, shared budget. |

## Randomized Tactics (`activity-random-test-tactics`)

The assignment specifically raises "format-check fuzzing" for S-007 — this is the one place in this phase randomized/property tactics are warranted, since it is the one piece of real code. Grilling itself is not a fuzzing target: it is a conversational contract with no parseable grammar to mutate.

| ID    | Tactic                                                                                                    | Target                              | Seed Policy                                                                                     | Reproducibility                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| RT-1  | Property: for any well-formed table with N rows, unique-ID and Phase-enum checks never false-positive on a clean fixture. Generate N random valid rows (random ID within `D-01`..`D-999`, random Phase from the valid enum, random optional `Supersedes` referencing an earlier row or empty) and assert the check passes. | `core/checks/decision-log-format.ts`   | Fixed seed recorded in the test file (e.g., `SEED=20260921`); one `it.each` table of 20 generated fixtures committed as literal fixtures rather than generated at runtime, per this repo's stated preference for deterministic, non-flaky checks over runtime randomness (D-48/D-49 precedent of favoring small, deterministic, dependency-free checks). | Fixture rows are committed literally; re-running is byte-identical, no runtime RNG involved. |
| RT-2  | Mutation: take the clean fixture (`workstream/decisions-shared-understanding.md` itself, per S-007's own Testing Requirements) and apply one random corrupting mutation per run from a fixed mutation set (duplicate a random ID, replace a random Phase with an invalid string, point a random Supersedes at a nonexistent ID, point one at a cross-file ID) — assert the corresponding failure is reported. | `core/checks/decision-log-format.ts`   | Each mutation is its own deterministic unit test case (not run-time randomized) — matches RT-1's fixture-over-runtime-RNG posture; "randomized tactics" here means systematically covering the mutation space, not runtime nondeterminism. | Each mutation is a named, committed test case; deterministic by construction. |
| RT-3  | Fuzz malformed table shapes (missing column, extra column, empty `ID` cell, non-table content interleaved) against the hand-rolled parser (no general Markdown parser dependency per `SIMPLICITY.md` A4/D-49 precedent) to confirm it fails closed (reports a defect) rather than crashing or silently skipping rows. | `core/checks/decision-log-format.ts` parser | Small fixed corpus of malformed fixtures, committed under `test/fixtures/` alongside the grilling scenario fixtures. | Committed fixtures, deterministic. |

**Note on tactic choice:** this repository's established precedent (D-48, D-49, and `SIMPLICITY.md` A4) favors small, deterministic, dependency-free checks over adding fuzzing infrastructure (e.g., `fast-check`) for a single flat table parser. RT-1 through RT-3 are therefore specified as *committed deterministic fixture sets covering the randomized-tactic intent* (systematic edge coverage of the mutation/malformation space) rather than a runtime property-based fuzzer with a new dependency. If the implementer judges a property-based library is proportionate once the parser exists, seed and replay instructions **MUST** still be captured per this plan's non-negotiable operating rule 6 — but the default recommendation is the fixture-set approach, consistent with prior phases' dependency discipline.

## Execution Checklist

- [ ] S-001: mirror `activity-grill` SKILL.md across three trees; write and manually walk the four scenario transcripts (E2E-3, E2E-4, E2E-5, E2E-6); write and pass `test/unit/skill-parity-grilling.test.ts`.
- [ ] S-002: wire grilling into `activity-refine`; walk E2E-1 and E2E-6; extend parity test.
- [ ] S-003: wire grilling into `activity-generate-spec`; walk E2E-2; extend parity test; confirm pre-step researcher sequencing (EC-18).
- [ ] S-004: add decision citations to `plan`'s task-list template; confirm CT-6 on a fixture generated from this spec itself.
- [ ] S-005: add `decision_log_path` to the three `planner` handoff templates; extend `planner-merge-gate-parity.test.ts` (CT-1); walk E2E-7 and EC-16.
- [ ] S-006: add the pre-branch-gate decision-log read to `implement`; walk E2E-8 and E2E-9 (EC absence handling); confirm citation instruction present in commit/PR template.
- [ ] S-007: write ADR-008; add `docs/tech.md` § Grilling (CT-5); write `core/checks/decision-log-format.ts` + unit tests covering CT-2/CT-3 and EC-9 through EC-13, plus RT-1/RT-2/RT-3; wire into `core/checks/run.ts` and confirm it runs under `pnpm lint`; update `docs/adr/README.md`.
- [ ] Regression: re-run the Phase 0/1 baseline (D-40's five-name failure set) — no change expected, this phase touches no runtime code outside S-007.
- [ ] `verifier` Audit Mode run per story post-implementation (mandatory, non-blocking) — flag EC-5 and EC-12's precedence/strength ambiguities explicitly for confirmation against shipped behavior.

## Traceability Summary

See `workstream/traceability-matrix-shared-understanding-phase-2.md` for the full `AC-ID -> Test-Case-ID -> Observed-Result` mapping. Coverage: every PRD-level Phase 2 AC (AC-01..05, AC-09, AC-16) and every story-level AC (S-001-AC-1 through S-007-AC-4, 34 total) maps to at least one positive test case (E2E/CT/scenario fixture) and at least one negative/edge case (EC-series), consistent with this plan's non-negotiable AC-mapping rule. `Observed-Result` columns are blank pending implementation — this is a pre-implementation Design Mode artifact.
