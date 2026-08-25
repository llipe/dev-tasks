Create a specialized agent and skills for QA:

- unit tests
- component tests
- analyze coverage and gaps
- integration testing specialist
- use playwright cli

---

## Refined Scope

**Goal:** give the framework a dedicated owner for producing tests, standardizing test levels and commands across consumer projects, and reporting coverage. Testing is currently split between `verifier` (black-box design docs), `developer` (test-first authoring plus gate execution), and `housekeeping` (wiring repairs only), with no owner for unit/component test design, mocked-API and fixture strategy, or coverage and gap analysis.

**Impact:** a consumer project gets a canonical `/TESTING.md` contract declaring what to test at which level and which `package.json` scripts to use, plus a `qa-engineer` agent that establishes the standard for an existing codebase, builds missing test harnesses, and reports coverage gaps at the completion gate.

### Testing layer model

| Layer | Name                                           | Status after this issue              |
| ----- | ---------------------------------------------- | ------------------------------------ |
| 1     | Deterministic foundations (unit, schema)       | In scope                             |
| 2     | Constrained model/tool tests (mocks, fixtures) | In scope                             |
| 3     | Product evals (semantic, tone, hallucination)  | Out of scope — backlog issue         |
| 4     | Human evaluation (safeguards, risk alerts)     | Already covered by PR approval gates |

`verifier` sits on a different axis and is **not** Layer 3. It evaluates development-artifact fidelity (spec vs. delivered code), not product output quality. `verifier` is not extended here beyond a one-line pointer to `qa-engineer` in its Out of Scope section.

### Key design decisions

- **New agent, not a `verifier` mode.** `qa-engineer` writes tests; `verifier` grades them. Audit independence requires they stay separate.
- **`developer` rule 19 unchanged.** `developer` keeps authoring tests before implementation code. `qa-engineer` owns standards, harnesses for levels the project lacks, and coverage/gap analysis. Per-sub-task delegation was rejected — it would break the step-gated loop for no fidelity gain.
- **Minimal wiring.** `developer` gains one rule, one execution-flow line, one integration row, one completion-gate item, and one payload field. `planner` gains one line. No procedural detail is duplicated into either agent.
- **Skippable, never silent.** The coverage gate accepts `SKIPPED(<reason>)`; an omitted field is treated as incomplete by `planner`.
- **`/TESTING.md` is a placeholder** shipped as a consumer-owned file, filled per project by `activity-test-standards`, and distributed by `dev-tasks` on both install paths (AC-10).

## Acceptance Criteria

- [ ] **AC-1** `qa-engineer` exists at `.kiro/agents/qa-engineer.md`, `.github/agents/qa-engineer.agent.md`, and `.claude/agents/qa-engineer.md` (subagent), with both entry points, an equivalent behavioral contract, and a parity test asserting it.
- [ ] **AC-2** The Kiro `qa-engineer` prompt is ≤150 lines and defines exactly one procedure: standards check → author or fill missing tests → coverage and gap report. No invocation modes.
- [ ] **AC-3** `activity-test-standards`, `activity-test-implementation`, and `activity-coverage-gap-analysis` exist in all three skill trees. `activity-test-implementation` covers Layers 1-2 with explicit per-level boundary rules **and a mandatory security-negative test category** — invalid signature, expired token, wrong issuer/audience, tampered claims — naming the "tests faithful to insecure code" trap explicitly.
- [ ] **AC-4** `/TESTING.md` exists as a placeholder declaring the section contract only — layer taxonomy, coverage thresholds and baseline policy, fixture/mocking strategy — plus a **per-package section** (language, runner, commands, environment, coverage tooling) so a mixed vitest + pytest monorepo is describable. `AGENTS.md` names its owner. Distribution is covered by AC-10.
- [ ] **AC-5** `activity-test-standards` can establish the standard for an existing project **and detects harness defects**: wrong test environment, missing test config, path-alias mismatch with `tsconfig`, unrestored global stubs, runtime version mismatch across local/CI/production, locale and timezone fixture policy, and false-green placeholders (`expect(true)`). Existing consumer content is preserved. Each defect is reported with file and expected state.
- [ ] **AC-6** The script check is **monorepo- and CI-aware**: canonical names plus reachability. Every workspace package with tests must be reachable from the aggregate test script, and the CI and deploy quality gates must invoke that aggregate. An aggregate script that omits a test-bearing package is a defect even when every script name is correct.
- [ ] **AC-7** `developer` wiring is exactly five touchpoints with no duplicated procedure; rule 19 is unchanged; `planner` gains one verification line.
- [ ] **AC-8** Coverage gate is explicitly skippable via `SKIPPED(<reason>)` with the reason surfaced in the PR; omitting the field is treated as incomplete. A skipped **measurement** never suppresses the structural gap **analysis** required by AC-11.
- [ ] **AC-9** `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `CLAUDE.md.template`, `README.md`, `docs/workflow-chains.md`, `docs/system-overview.md`, `bundle-manifest.json`, and `scripts/build-bundle.sh` are updated. `verifier`'s Out of Scope entry names `qa-engineer`.
- [ ] **AC-10** `/TESTING.md` is distributed by `dev-tasks` on **both** install paths — the shell bundle (`scripts/build-bundle.sh` `MANAGED_FILES`) and the npm installer (`dev-tasks install`, via `core/distribution/install.ts`). A fresh install places it and records it in the manifest with a `sha256`; `--profile all` installs it exactly once; repeated installs are idempotent; `dev-tasks update` preserves a consumer-filled `TESTING.md` via `consumer_owned_paths`.
- [ ] **AC-11** Gap analysis works **without a coverage provider** and weights by risk: enumerate source files and exported symbols with no test, report a source-to-test size ratio per package, flag surfaces whose test count is disproportionate to their size, and rank gaps by size and risk. A repo with no coverage tooling still gets a ranked gap inventory, not "unknown". Existing coverage artifacts are validated before being trusted — a stale report, or one whose measured scope is narrower than the package it claims to describe, is reported as misleading.

## Validation source

The AC-3 through AC-6 and AC-11 requirements are derived from a real test audit of the `home-ledger` repository, which is the acceptance benchmark for this issue. The delivered skills must detect its findings:

| Audit finding                                                                        | Addressed by |
| ------------------------------------------------------------------------------------ | ------------ |
| 56% of tests absent from the CI gate; deploy quality gate never runs backend tests    | AC-6         |
| Coverage unmeasured, no provider installed, stale artifact measuring 1 of 8 modules   | AC-11        |
| Large untested surfaces invisible without a coverage provider                         | AC-11        |
| Test environment, config, alias, cleanup, runtime-parity and placeholder defects       | AC-5         |
| Auth tests faithful to an implementation that never verifies JWT signature or expiry  | AC-3         |
| Mixed-language monorepo (vitest + pytest) not describable by a JS-only contract        | AC-4         |

## Non-Goals

- Layer 3 product evals — semantic, tone, hallucination, groundedness, eval datasets, judge rubrics (backlog issue).
- Local and remote integration testing, and Playwright CLI E2E with auth/env/state prerequisites (follow-up issue, which must also cover RLS policy tests, migration clean-apply, real-Postgres integration, and OpenAPI spec-to-implementation validation via `dt verify`).
- Frontend component tests, accessibility assertions, and DESIGN.md token enforcement (follow-up issue). Component-test scope here is backend only.
- Detection of mock-reimplementation anti-patterns in existing suites — doubles that reimplement the logic they should verify, which coverage cannot see (follow-up issue; mutation testing is the eventual mechanism).
- Mutation testing — deferred; depends on a coverage baseline existing first.
- Installing coverage providers or other test dependencies. Absence is reported and the structural path (AC-11) takes over; adding a dependency stays an approved-task decision.
- Load and performance testing, visual regression testing.
- Extending `verifier` with a third mode. Making the coverage gate hard-blocking. Changing `developer` rule 19.
- Bringing this repo's own `package.json` up to the canonical script set (framework repo, not a consumer app).
- A `dt` subcommand for the script check — it ships as a checklist inside `activity-test-standards`.
- An integration-wide coverage rollup in `planner` — deferred to the follow-up issue.

## Artifacts

- Refinement: `workstream/issue-123-qa-agent-and-testing-standard-refinement.md`
- Task list: `workstream/tasks-issue-123-qa-agent-and-testing-standard.md`

## Task Checklist

- [ ] 1.0 Implement Issue #123: QA agent, testing skills, and /TESTING.md standard
  - [ ] 1.1 Confirm prerequisites (issue open, feature branch, draft PR)
  - [ ] 1.2 Test-first — author `test/unit/qa-engineer-parity.test.ts` (presence, parity, entry points, ≤150 lines); confirm it fails
  - [ ] 1.3 Test-first — author `test/unit/qa-testing-standard.test.ts` (skills, TESTING.md sections incl. per-package slot, harness-defect list, CI reachability check, security-negative category, structural gap path, payload field, planner gate, verifier pointer, registry refs, distribution registration); confirm it fails
  - [ ] 1.4 Test-first — extend `test/unit/distribution-install.test.ts` and `distribution-profiles.test.ts` for root-file distribution (placed, manifest-recorded, once under `--profile all`, idempotent, preserved on update); confirm it fails
  - [ ] 1.5 Create the `/TESTING.md` placeholder: section contract plus per-package slot, JS/TS script default with a non-JS slot
  - [ ] 1.6 Author `.kiro/agents/qa-engineer.md` (single procedure, no modes, ≤150 lines)
  - [ ] 1.7 Mirror to `.github/agents/qa-engineer.agent.md` and `.claude/agents/qa-engineer.md`
  - [ ] 1.8 Create entry points `.github/prompts/qa-engineer.prompt.md` and `.claude/commands/qa-engineer.md`
  - [ ] 1.9 Author `activity-test-standards` (per-package project inspection, harness-defect detection, monorepo/CI-aware script reachability check, consumer-content preservation, unfilled-placeholder detection)
  - [ ] 1.10 Mirror `activity-test-standards` to `.github/skills` and `.claude/skills`
  - [ ] 1.11 Author `activity-test-implementation` (Layers 1-2 boundary rules + mandatory security-negative category)
  - [ ] 1.12 Mirror `activity-test-implementation` to `.github/skills` and `.claude/skills`
  - [ ] 1.13 Author `activity-coverage-gap-analysis` (measured path with baseline diff and `SKIPPED(<reason>)`; structural path with risk-ranked gaps and misleading-artifact validation, which always runs)
  - [ ] 1.14 Mirror `activity-coverage-gap-analysis` to `.github/skills` and `.claude/skills`
  - [ ] 1.15 Wire `qa-engineer` into `.kiro/agents/developer.md` (five touchpoints; rule 19 unchanged)
  - [ ] 1.16 Mirror developer wiring to the three other developer files
  - [ ] 1.17 Add the `coverage_gate` verification line to `planner` and its two mirrors
  - [ ] 1.18 Add the coverage gate to `implement` steering and its two mirrors
  - [ ] 1.19 Point `verifier`'s Out of Scope entry at `qa-engineer` (three files)
  - [ ] 1.20 Wire `/TESTING.md` distribution on both paths: `bundle-manifest.json` `consumer_owned_paths`, `build-bundle.sh` `MANAGED_FILES`, root-file concept in `profiles.ts`, root-file install + manifest recording in `install.ts`, update-preserves-consumer-file
  - [ ] 1.21 Update `AGENTS.md` (agent row, three skill rows, TESTING.md contract section, guidelines bullet)
  - [ ] 1.22 Apply the same update to `AGENTS.md.template`
  - [ ] 1.23 Update `CLAUDE.md` and `CLAUDE.md.template` (roster, guideline, six → seven subagents)
  - [ ] 1.24 Update `README.md` (Agents table, Skills table, workflow chain)
  - [ ] 1.25 Update `docs/workflow-chains.md` and `docs/system-overview.md`
  - [ ] 1.26 Delegate to `technical-writer` for AGENTS.md parity confirmation
  - [ ] 1.27 Verify Acceptance Criterion AC-1
  - [ ] 1.28 Verify Acceptance Criterion AC-2
  - [ ] 1.29 Verify Acceptance Criterion AC-3
  - [ ] 1.30 Verify Acceptance Criterion AC-4
  - [ ] 1.31 Verify Acceptance Criterion AC-5 (fixture project with wrong environment, missing config, alias mismatch, unrestored stub, runtime mismatch, `expect(true)` placeholder)
  - [ ] 1.32 Verify Acceptance Criterion AC-6 (monorepo whose aggregate script omits a test-bearing package; deploy gate reported incomplete)
  - [ ] 1.33 Verify Acceptance Criterion AC-7 (five touchpoints, rule 19 intact, gate ordering)
  - [ ] 1.34 Verify Acceptance Criterion AC-8 (skip path emits a recorded reason and still produces the structural report)
  - [ ] 1.35 Verify Acceptance Criterion AC-9 (registries, docs, manifest, build script)
  - [ ] 1.36 Verify Acceptance Criterion AC-10 (build bundle, fresh install per profile into a scratch target, manifest entry, once under `--profile all`, modification survives `dev-tasks update`)
  - [ ] 1.37 Verify Acceptance Criterion AC-11 (no-provider repo still yields a ranked gap inventory; stale narrower-than-claimed artifact reported as misleading)
  - [ ] 1.38 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate` plus `./scripts/format.sh --check`
  - [ ] 1.39 Confirm follow-up issues exist and are cross-referenced: integration + Playwright (incl. RLS, migrations, real Postgres, OpenAPI via `dt verify`); frontend component + a11y + DESIGN.md enforcement; mock-reimplementation detection and mutation testing; Layer 3 evals
