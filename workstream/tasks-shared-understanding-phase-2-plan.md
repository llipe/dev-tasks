# Implementation Plan - Shared Understanding Phase 2 (Grilling, Decision Log, Refine/Spec/Plan Integration)

Source: `workstream/user-stories-shared-understanding-phase-2.md` v1.0 — all 7 stories selected.
Spec: `workstream/specification-shared-understanding-phase-2.md` v1.0
Decisions: `workstream/decisions-shared-understanding.md` (D-01…D-56)
Repository shape: single-package — package brackets omitted per `docs/tech.md`.

## Relevant Files

- `.claude/skills/activity-grill/SKILL.md` - New grilling skill (core engine)
- `.github/skills/activity-grill/SKILL.md` - Copilot equivalent
- `.kiro/skills/activity-grill/SKILL.md` - Kiro equivalent
- `test/fixtures/grilling/codebase-answerable.md` - Scenario fixture (a)
- `test/fixtures/grilling/cap-reached.md` - Scenario fixture (b)
- `test/fixtures/grilling/premature-confirmation.md` - Scenario fixture (c)
- `test/fixtures/grilling/issue-mode-reuse.md` - Scenario fixture (d), plus a small prior-decisions fixture log
- `test/fixtures/grilling/prd-creation-gate.md` - Scenario fixture (e): `activity-refine` PRD Creation mode blocks drafting until the exit gate is satisfied (S-002)
- `test/unit/skill-parity-grilling.test.ts` - New parity test, extended across S-001 through S-003 and S-006
- `AGENTS.md` - Register `activity-grill` in the Skills table
- `CLAUDE.md` - Activity Skills listing
- `.claude/skills/activity-refine/SKILL.md` - Add WHAT-phase and Issue Mode grilling invocations
- `.github/skills/activity-refine/SKILL.md` - Mirror
- `.kiro/skills/activity-refine/SKILL.md` - Mirror
- `.claude/skills/activity-generate-spec/SKILL.md` - Add HOW-phase grilling invocation
- `.github/skills/activity-generate-spec/SKILL.md` - Mirror
- `.kiro/skills/activity-generate-spec/SKILL.md` - Mirror
- `.claude/skills/plan/SKILL.md` - Add decision-citation contract and "Decisions Consumed" section
- `.github/instructions/plan.instructions.md` - Mirror
- `.kiro/steering/plan.md` - Mirror
- `.claude/commands/planner.md` - Add `decision_log_path` to Phase 4 handoff
- `.github/agents/planner.agent.md` - Mirror
- `.kiro/agents/planner.md` - Mirror
- `test/unit/planner-merge-gate-parity.test.ts` - Extend with `decision_log_path` field assertion
- `.claude/skills/implement/SKILL.md` - Add decision-log read step (before branch-gate) and citation instruction
- `.github/instructions/implement.instructions.md` - Mirror
- `.kiro/steering/implement.md` - Mirror
- `docs/adr/ADR-008-grilling-exit-gate-and-install-if-absent-category.md` - New ADR (exit-gate semantics + install-if-absent category)
- `docs/adr/README.md` - List ADR-008
- `docs/tech.md` - Add § Grilling config subsection
- `core/checks/decision-log-format.ts` - New decision-log format validator (focused new module, per `SIMPLICITY.md` A4)
- `core/checks/index.ts` - Export the new check
- `core/checks/run.ts` - Wire in the new check
- `test/unit/checks-decision-log-format.test.ts` - Unit tests for the validator (colocated under `test/unit/`, matching `checks-docs-structure.test.ts` and the `vitest.config.ts` `include` glob, rather than `core/checks/decision-log-format.test.ts` — that path is outside `test/**/*.test.ts` and would not run under `pnpm test`)

## Tasks

- [x] 1.0 Implement Story S-001: Build the `activity-grill` core skill (#213)

  > Note: One question per turn, depth-first, resolve-before-ask, append-per-resolution, configurable cap with a mandatory continue/stop prompt, hard exit gate (no inference from tone/silence). No `grill-me` attribution (D-53). Session state lives only in conversation context (D-54).

  - [x] 1.1 Write `.claude/skills/activity-grill/SKILL.md` per specification §8.1: one-question-per-turn (FR-1), depth-first traversal (FR-2), resolve-before-ask precedence — codebase/docs → prior decision logs → bounded `researcher` call (FR-3, D-56) → user
  - [x] 1.2 Add the append-per-resolution rule: every resolved question (asked or self-resolved) becomes one row in `decisions-<feature>.md` immediately (FR-4)
  - [x] 1.3 Add the qualified citation form (`<feature>#D-NN` outside the log, `D-NN` inside it) (FR-5)
  - [x] 1.4 Add the decision-tree summary cadence: every 10th resolved question, at the cap, and at exit-gate attempt (FR-6)
  - [x] 1.5 Add the two-phase mode (WHAT/HOW) with a continuing single ID space (FR-7)
  - [x] 1.6 Add the hard exit gate: empty open list AND an explicit confirmation statement, never inferred from tone/silence — write the direct confirmation question text (FR-8)
  - [x] 1.7 Add the configurable, enforced cap: default 25/25/8, read from `docs/tech.md` § Grilling if present else hardcoded default; on cap reached, ask continue-or-stop, never auto-decide (FR-9)
  - [x] 1.8 Add Issue Mode constraints: cap 8, glossary read-only, scope limited to what the issue changes, keyword-gated reuse of matching answers from any prior `decisions-*.md` (FR-10)
  - [x] 1.9 Add the once-per-phase assumption-testing reminder (FR-11)
  - [x] 1.10 Mirror the completed skill into `.github/skills/activity-grill/SKILL.md` and `.kiro/skills/activity-grill/SKILL.md`, adapting only platform-specific invocation syntax
  - [x] 1.11 Register `activity-grill` in `AGENTS.md` § Skills (Activity Skills table) and `CLAUDE.md`'s skill listing
  - [x] 1.12 Run Tests: write `test/fixtures/grilling/codebase-answerable.md`, `cap-reached.md`, `premature-confirmation.md`, `issue-mode-reuse.md` (plus its prior-decisions fixture log) and manually walk each scenario against the skill text
  - [x] 1.13 Run Tests: write `test/unit/skill-parity-grilling.test.ts` asserting the three `activity-grill` skill files exist with equivalent required-rule content — `pnpm run test -- skill-parity-grilling`
  - [x] 1.14 Verify Acceptance Criterion: AC-1 codebase-answerable question resolved without asking (scenario fixture a)
  - [x] 1.15 Verify Acceptance Criterion: AC-2 exactly one question per turn, each with a recommended answer (manual session)
  - [x] 1.16 Verify Acceptance Criterion: AC-3 every resolved question appended with a unique ID and full row (scenario fixtures a-d)
  - [x] 1.17 Verify Acceptance Criterion: AC-4 decision-tree summary at question 10, at cap, at exit (manual session)
  - [x] 1.18 Verify Acceptance Criterion: AC-5 cap-reached continue-or-stop prompt, never auto-decided (scenario fixture b)
  - [x] 1.19 Verify Acceptance Criterion: AC-6 exit gate rejects a non-explicit confirmation (scenario fixture c)
  - [x] 1.20 Verify Acceptance Criterion: AC-7 Issue Mode cap 8, glossary read-only, prior-decision reuse cited in qualified form (scenario fixture d)
  - [x] 1.21 Verify Acceptance Criterion: AC-8 once-per-phase assumption-testing reminder (manual session)
  - [x] 1.22 Verify Acceptance Criterion: AC-9 three-tree parity (`skill-parity-grilling` test)
  - [x] 1.23 Run Tests: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`

- [x] 2.0 Implement Story S-002: Invoke `activity-grill` from `activity-refine` (WHAT phase and Issue Mode) (#214)

  > Note: Depends on 1.0. Drafting is blocked until the exit gate is satisfied, in both PRD Creation and Issue Refinement modes.

  - [x] 2.1 Edit `.claude/skills/activity-refine/SKILL.md`: insert the `activity-grill(phase="WHAT")` invocation immediately before PRD Creation mode's drafting step (FR-12)
  - [x] 2.2 Insert the `activity-grill` Issue Mode invocation (cap 8, glossary read-only, prior-decision reuse) immediately before Issue Refinement mode's drafting step (FR-15)
  - [x] 2.3 Add the "cite decisions inline, list consumed IDs in `## Decisions`" instruction to both modes' output contract (FR-14)
  - [x] 2.4 Mirror both edits into `.github/skills/activity-refine/SKILL.md` and `.kiro/skills/activity-refine/SKILL.md`
  - [x] 2.5 Run Tests: extend `test/unit/skill-parity-grilling.test.ts` to assert both modes reference `activity-grill` in all three trees
  - [x] 2.6 Run Tests: build an integration fixture — a short mock feature request through `activity-refine` PRD Creation mode — asserting no draft is produced before a simulated exit-gate confirmation and at least one inline `D-NN` citation appears
  - [x] 2.7 Run Tests: manually run Issue Refinement mode against a fixture GitHub issue, confirming glossary read-only behavior and citation of a seeded prior decision
  - [x] 2.8 Verify Acceptance Criterion: AC-1 no PRD draft before WHAT exit gate (integration fixture)
  - [x] 2.9 Verify Acceptance Criterion: AC-2 Issue Mode cap 8, glossary read-only, prior-decision reuse (manual Issue Mode run)
  - [x] 2.10 Verify Acceptance Criterion: AC-3 inline citations and `## Decisions` section populated (both fixtures)
  - [x] 2.11 Verify Acceptance Criterion: AC-4 three-tree parity (extended parity test)
  - [x] 2.12 Run Tests: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run test -- skill-parity-grilling`

- [x] 3.0 Implement Story S-003: Invoke `activity-grill` from `activity-generate-spec` (HOW phase) (#215)

  > Note: Depends on 1.0. Runs in parallel with 2.0. The existing conditional pre-step `researcher` call (ADR-004) is sequenced before the HOW phase so its artifact is available to `activity-grill`'s resolve-before-ask step (D-56).

  - [x] 3.1 Edit `.claude/skills/activity-generate-spec/SKILL.md`: insert the `activity-grill(phase="HOW")` invocation immediately before the "ask targeted technical design questions" step (FR-13)
  - [x] 3.2 Confirm the existing pre-step `researcher` call is sequenced before the HOW-phase invocation, not after
  - [x] 3.3 Add the "cite decisions inline, list consumed IDs in `## Decisions (HOW phase)`" instruction to the output contract (FR-14)
  - [x] 3.4 Mirror into `.github/skills/activity-generate-spec/SKILL.md` and `.kiro/skills/activity-generate-spec/SKILL.md`
  - [x] 3.5 Run Tests: extend `test/unit/skill-parity-grilling.test.ts` to assert `activity-generate-spec`'s invocation across all three trees
  - [x] 3.6 Run Tests: build an integration fixture — a short mock spec generation — asserting drafting is gated on a simulated HOW-phase confirmation and at least one inline `D-NN` citation appears
  - [x] 3.7 Run Tests: manually re-derive this Phase 2 spec's own structure against the new skill text as a sanity check (it should match `workstream/specification-shared-understanding-phase-2.md`, produced by hand before this skill existed)
  - [x] 3.8 Verify Acceptance Criterion: AC-1 no spec draft before HOW exit gate (integration fixture)
  - [x] 3.9 Verify Acceptance Criterion: AC-2 pre-step researcher call sequenced before HOW phase (manual review)
  - [x] 3.10 Verify Acceptance Criterion: AC-3 inline citations and `## Decisions (HOW phase)` section populated (both fixtures)
  - [x] 3.11 Verify Acceptance Criterion: AC-4 three-tree parity (extended parity test)
  - [x] 3.12 Run Tests: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run test -- skill-parity-grilling`

- [ ] 4.0 Implement Story S-004: Cite decisions in `plan`'s task lists (#216)

  > Note: Depends on 2.0 and 3.0. Additive only — a task with no traceable decision cites none.

  - [ ] 4.1 Edit `.claude/skills/plan/SKILL.md`'s task-list output template: add inline citation guidance (`- [ ] 3.2 … (D-55)`) and a closing `## Decisions Consumed` section
  - [ ] 4.2 Mirror into `.github/instructions/plan.instructions.md` and `.kiro/steering/plan.md`
  - [ ] 4.3 Run Tests: extend `test/unit/skill-parity-grilling.test.ts` to cover the three `plan`-equivalent files
  - [ ] 4.4 Run Tests: generate a task list from `workstream/specification-shared-understanding-phase-2.md` as a fixture input and confirm the produced list cites D-53–D-56 where traceable and includes the `## Decisions Consumed` section
  - [ ] 4.5 Verify Acceptance Criterion: AC-1 inline citations plus `## Decisions Consumed` section present (fixture)
  - [ ] 4.6 Verify Acceptance Criterion: AC-2 a task with no traceable decision cites none — not fabricated (fixture review)
  - [ ] 4.7 Verify Acceptance Criterion: AC-3 three-tree parity (extended parity test)
  - [ ] 4.8 Run Tests: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run test -- skill-parity-grilling`

- [ ] 5.0 Implement Story S-005: Pass the decision-log path in every `planner` → `developer` handoff (#217)

  > Note: Depends on 4.0. Closes the three-tree parity risk the Phase 2 research pass flagged (research risk #6).

  - [ ] 5.1 Add `decision_log_path` (`workstream/decisions-<feature>.md`) to the Phase 4 handoff template in `.claude/commands/planner.md`, alongside the existing `task_file`/`test_plan_path`/integration-branch/test-first fields
  - [ ] 5.2 Mirror into `.github/agents/planner.agent.md` and `.kiro/agents/planner.md`, using the identical field name
  - [ ] 5.3 Run Tests: extend `test/unit/planner-merge-gate-parity.test.ts` (or add a sibling file) asserting `decision_log_path` appears, identically named, in all three handoff templates — `pnpm run test -- planner-merge-gate-parity`
  - [ ] 5.4 Run Tests: manually run a `planner` orchestration against a small multi-story fixture and confirm the field appears in the delegation context handed to `developer`
  - [ ] 5.5 Verify Acceptance Criterion: AC-1 field passed unconditionally for every story (fixture orchestration)
  - [ ] 5.6 Verify Acceptance Criterion: AC-2 field named identically and populated identically across all three trees (parity test)
  - [ ] 5.7 Verify Acceptance Criterion: AC-3 parity test fails if any tree omits the field (test itself is the evidence — confirm by temporarily removing the field in one tree and observing the test fail, then restoring it)
  - [ ] 5.8 Run Tests: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run test -- planner-merge-gate-parity`

- [ ] 6.0 Implement Story S-006: `implement` reads the decision log before starting work (#218)

  > Note: Depends on 5.0. The read happens before branch creation since it is non-mutating; a missing decision log is handled gracefully, never as a hard failure.

  - [ ] 6.1 Edit `.claude/skills/implement/SKILL.md`'s "Before Starting Work" checklist: add the `decisions-<feature>.md` read step, ordered before the branch-gate check, alongside (not replacing) the existing "confirm GitHub issue open" check
  - [ ] 6.2 Add the commit/PR citation instruction: an implementation commit whose approach was shaped by a decision cites it in the commit body; the PR body references consumed decision IDs
  - [ ] 6.3 Add the graceful-absence handling instruction: a missing `decisions-<feature>.md` does not block starting work — proceed, noting its absence
  - [ ] 6.4 Mirror into `.github/instructions/implement.instructions.md` and `.kiro/steering/implement.md`
  - [ ] 6.5 Run Tests: extend `test/unit/skill-parity-grilling.test.ts` (or add a dedicated assertion) to cover `implement`'s read step across all three trees
  - [ ] 6.6 Run Tests: build an integration fixture task run against a feature with an existing `decisions-<feature>.md` (this Phase 2 feature itself), confirming the read happens before any git operation is described and a sample commit-message template cites a decision ID
  - [ ] 6.7 Run Tests: manually walk `implement`'s instructions for a feature with no decision log and confirm the graceful-absence path reads correctly (no dead-end instruction)
  - [ ] 6.8 Verify Acceptance Criterion: AC-1 read step present, ordered before branch gate (fixture)
  - [ ] 6.9 Verify Acceptance Criterion: AC-2 commit/PR citation instruction present (manual template review)
  - [ ] 6.10 Verify Acceptance Criterion: AC-3 graceful handling of a missing decision log (manual walkthrough)
  - [ ] 6.11 Verify Acceptance Criterion: AC-4 three-tree parity (extended parity test)
  - [ ] 6.12 Run Tests: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run test -- skill-parity-grilling`

- [x] 7.0 Implement Story S-007: ADR-008, the `docs/tech.md` § Grilling config, and the decision-log format check (#219)

  > Note: Depends on 1.0 (sequenced last only so the ADR text describes shipped, not intended, exit-gate behavior). Adds real TypeScript code (`core/checks/`) — the only story in this set that does.

  - [x] 7.1 Confirm the next free ADR number is `ADR-008` (verify no in-flight work has already claimed it) and write `docs/adr/ADR-008-<slug>.md` per the ADR-004/ADR-007 format (Status, Context, Decision, Alternatives, Consequences, Related), recording (a) the `activity-grill` hard exit-gate semantics and (b) the platform-agnostic install-if-absent category (`ROOT_PROFILE_TAG` reuse, shipped in Phase 1, documented here retroactively per D-20)
  - [x] 7.2 Update `docs/adr/README.md` to list ADR-008
  - [x] 7.3 Add the "Grilling" subsection to `docs/tech.md` (placed after "Glossary and Simplicity Baseline Ownership", before "Overview") with the `cap.what`/`cap.how`/`cap.issue` table and documented defaults (25/25/8)
  - [x] 7.4 Write a failing test first: `core/checks/decision-log-format.test.ts` — duplicate ID, invalid `Phase` value, dangling `Supersedes` reference, and a clean-fixture pass case; run it and confirm it fails (no implementation yet)
  - [x] 7.5 Implement `core/checks/decision-log-format.ts` (or a section within `docs-structure.ts`, implementer's judgment per `SIMPLICITY.md` A4) — hand-parse the fixed table shape, no general Markdown parser dependency (D-49's precedent), and wire it into `core/checks/run.ts`
  - [x] 7.6 Run Tests: confirm `core/checks/decision-log-format.test.ts` now passes, and re-run against `workstream/decisions-shared-understanding.md` itself as the "known good, large, real" fixture
  - [x] 7.7 Run Tests: confirm the new check runs under `pnpm run lint` (via `tsx core/checks/run.ts`, never a `dist/`-compiled path, per D-48's precedent)
  - [x] 7.8 Verify Acceptance Criterion: AC-1 ADR-008 exists with both decisions recorded and the retroactive note for (b) (manual review)
  - [x] 7.9 Verify Acceptance Criterion: AC-2 `docs/tech.md` § Grilling subsection present with correct placement and defaults (manual review)
  - [x] 7.10 Verify Acceptance Criterion: AC-3 format check catches duplicate IDs, invalid `Phase`, dangling `Supersedes` (unit test)
  - [x] 7.11 Verify Acceptance Criterion: AC-4 `docs/adr/README.md` lists ADR-008 (manual review)
  - [x] 7.12 Run Tests: `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run test -- decision-log-format`, `pnpm run audit`

## Decisions Consumed

| ID   | Decision (short form)                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------- |
| D-53 | No `grill-me` attribution — supersedes D-13.                                                                     |
| D-54 | Grilling session state lives in conversation context only; the decision log is the sole persistent artifact.     |
| D-55 | Question caps configured in `docs/tech.md` § Grilling (defaults 25/25/8).                                        |
| D-56 | `activity-grill`'s researcher call shares one "at most once per phase" budget with the existing pre-step call.   |
