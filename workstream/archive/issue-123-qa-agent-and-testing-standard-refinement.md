# Issue Refinement: 123 - Create a specialized agent and skills for QA

## Changelog

| Version | Date       | Summary                                                                                                                                                                                                                                                                                                       | Author           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1.0     | 2026-08-17 | Initial refinement                                                                                                                                                                                                                                                                                            | product-engineer |
| 1.1     | 2026-08-17 | Added AC-10: `/TESTING.md` must be distributed by `dev-tasks` through both the shell bundle and the npm install path                                                                                                                                                                                          | product-engineer |
| 1.2     | 2026-08-17 | Folded in five findings from the home-ledger test audit: CI-aware script check (AC-6), expanded standards detection (AC-5), structural gap analysis without a coverage provider (new AC-11), mandatory security-negative test category (AC-3), per-package `/TESTING.md` (AC-4). Refined AC-8 skip semantics. | product-engineer |

## Summary

- **Goal:** Give this framework a dedicated owner for producing tests, standardizing test levels and commands across consumer projects, and reporting coverage. Today testing is split between `verifier` (black-box design docs), `developer` (test-first authoring plus gate execution), and `housekeeping` (wiring repairs only), with no owner for unit/component test design, mocked-API and fixture strategy, or coverage and gap analysis.
- **Primary user impact:** A consumer project gets a canonical `/TESTING.md` contract declaring what to test at which level and which `package.json` scripts to use, plus a `qa-engineer` agent that establishes the standard for an existing codebase, builds missing test harnesses, and reports coverage gaps at the completion gate.
- **Non-goals:** see [Non-Goals](#non-goals).

### Testing layer model

This issue adopts a four-layer model as the shared vocabulary for `/TESTING.md`:

| Layer | Name                                           | Status after this issue              |
| ----- | ---------------------------------------------- | ------------------------------------ |
| 1     | Deterministic foundations (unit, schema)       | In scope                             |
| 2     | Constrained model/tool tests (mocks, fixtures) | In scope                             |
| 3     | Product evals (semantic, tone, hallucination)  | Out of scope — backlog issue         |
| 4     | Human evaluation (safeguards, risk alerts)     | Already covered by PR approval gates |

`verifier` sits on a different axis and is **not** Layer 3. It evaluates development-artifact fidelity (spec vs. delivered code), not product output quality. `verifier` is not extended by this issue beyond a one-line pointer to `qa-engineer` in its Out of Scope section.

### Integration/E2E and Playwright

Local integration testing, remote integration testing, and Playwright CLI E2E (including authentication, environment, and state-reset prerequisites) are deferred to a **follow-up issue**. This issue delivers the agent, the standard, and Layers 1-2 so the follow-up has a foundation to extend.

## Acceptance Criteria

- [ ] **AC-1 — `qa-engineer` agent exists on all three platforms.** A `qa-engineer` agent is present at `.kiro/agents/qa-engineer.md`, `.github/agents/qa-engineer.agent.md`, and `.claude/agents/qa-engineer.md` (subagent, since it is delegated and has no user-approval gate), with a single fixed procedure and no invocation modes. Given the three files, when compared, then the behavioral contract is equivalent and a parity test in `test/unit/` asserts it.
- [ ] **AC-2 — Agent prompt stays short.** The `qa-engineer` prompt is no longer than 150 lines in the Kiro variant and defines exactly one procedure: standards check → author or fill missing tests for the requested scope → coverage and gap report.
- [ ] **AC-3 — Three skills, mirrored.** `activity-test-standards`, `activity-test-implementation`, and `activity-coverage-gap-analysis` exist under `.kiro/skills/`, `.github/skills/`, and `.claude/skills/`. `activity-test-implementation` covers Layers 1-2 (unit, schema validation, backend component, mocked APIs, fixtures/gold datasets) with explicit per-level boundary rules for what belongs where, and includes a **mandatory security-negative test category** — for any authentication or authorization code path, tests asserting rejection of an invalid signature, an expired token, a wrong issuer or audience, and tampered claims are required. The skill **MUST** name the "tests faithful to insecure code" trap explicitly: a suite that only asserts the behavior the implementation happens to have provides no security evidence, and passing tests over a permissive implementation are a finding, not a pass.
- [ ] **AC-4 — `/TESTING.md` is a per-package placeholder contract.** A placeholder `/TESTING.md` exists at repo root, following the `/DESIGN.md` precedent. It declares the section contract — layer taxonomy and what belongs at each layer, coverage thresholds and baseline policy, fixture/mocking strategy — plus a **per-package section** carrying that package's language, runner, test commands, test environment, and coverage tooling. The canonical script mapping is expressed as a JS/TS default with an explicit slot for non-JS packages, so a repo mixing vitest and pytest is describable. No project-specific values are asserted in the placeholder. `AGENTS.md` names `qa-engineer` as its owner and `developer` as required to keep it current. Distribution is covered separately by AC-10.
- [ ] **AC-5 — `activity-test-standards` can establish the standard for an existing project, and detects harness defects.** The skill contains a procedure for inspecting an existing codebase and filling the placeholder, covering at minimum: test framework and runner per package; existing script inventory; test directory locations and naming patterns; coverage tooling; mocking and fixture approach; **test environment correctness** (for example `node` where a DOM environment is required); **test config presence** per package; **path-alias parity** between the test config and `tsconfig`; **global cleanup policy** (`restoreMocks`, stubbed globals restored); **runtime version parity** across local, CI, and production; **locale and timezone fixture policy**; and **false-green placeholder detection** (assertions such as `expect(true)` that report health without exercising anything). Given a project with an existing `/TESTING.md`, when the skill runs, then consumer-owned content and config are preserved, not overwritten. Each detected defect is reported with the file and the expected state.
- [ ] **AC-6 — Script-contract check is monorepo- and CI-aware.** `activity-test-standards` includes a checklist that validates the project's scripts against the canonical set **and** verifies reachability: every workspace package that contains tests is reachable from the aggregate test script, and the CI and deploy quality gates invoke that aggregate script. Given a monorepo where an aggregate `test` script omits a package that has tests, when the check runs, then the omission is reported as a defect even though every script name is canonically correct. Given a deploy workflow whose quality gate runs a script that does not reach all test packages, when the check runs, then that gate is reported as incomplete.
- [ ] **AC-7 — `developer` wiring is minimal and cannot be skipped by omission.** `developer` gains exactly one new operating rule (invoke `qa-engineer` at the completion gate, before the `verifier` audit), one row in the Integration table, one Execution Flow line, one Completion Gate item, and one closeout payload field `coverage_gate: PASS | FAIL | SKIPPED(<reason>)`. Rule 19 (test-first authoring by `developer`) is **unchanged**. No procedural detail is duplicated into `developer` — the procedure lives in the `qa-engineer` prompt and its skills. `planner` gains one line verifying `coverage_gate` is present with a recorded reason when skipped.
- [ ] **AC-8 — Coverage gate is explicitly skippable, never silently, and skipping measurement does not skip analysis.** Given a run where coverage tooling is unavailable or the user declines, when `developer` reaches the completion gate, then `coverage_gate` is emitted as `SKIPPED(<reason>)` and the reason appears in the PR. Omitting the field is treated as incomplete by `planner`. A `SKIPPED` coverage measurement **MUST NOT** suppress the structural gap analysis required by AC-11 — the gate reports no measured percentage, but it still reports gaps.
- [ ] **AC-9 — Registries and docs updated.** `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `README.md`, `docs/workflow-chains.md`, `docs/system-overview.md`, `bundle-manifest.json`, and `scripts/build-bundle.sh` reflect the new agent, skills, and `/TESTING.md`. `verifier`'s Out of Scope entry for coverage and mutation testing points to `qa-engineer` as the owner.
- [ ] **AC-10 — `/TESTING.md` is distributed by `dev-tasks` on both install paths.** `/TESTING.md` reaches consumer repositories through the shell bundle (`scripts/build-bundle.sh` `MANAGED_FILES`) **and** the npm installer (`dev-tasks install`, via `core/distribution/install.ts`). Given a fresh install with any profile, when it completes, then `TESTING.md` is present in the target repo and recorded in the install manifest with a `sha256`. Given a consumer repo whose `TESTING.md` has been filled in, when `dev-tasks update` runs, then the filled file is preserved, not overwritten — it is listed in `consumer_owned_paths` in `bundle-manifest.json`. Given repeated installs, then the operation is idempotent.
- [ ] **AC-11 — Gap analysis works without a coverage provider, and weights by risk.** `activity-coverage-gap-analysis` defines a structural analysis path that runs when no coverage provider is installed: enumerate source files and exported symbols with no corresponding test, report a source-to-test size ratio per package, and flag surfaces whose test count is disproportionate to their size. Gaps are ranked by size and risk rather than listed flat, so a large untested service outranks a small helper. Given a repository with no coverage tooling in any package, when the analysis runs, then it still produces a ranked gap inventory naming the largest untested surfaces — it does not return "unknown". Existing coverage artifacts are validated before being trusted: a stale report, or one whose measured scope is narrower than the package it claims to describe, is reported as misleading rather than used as evidence.

## Validation source

The five additions in v1.2 come from a real test audit of the `home-ledger` repository, used here as the reference case for what this issue must be able to detect:

| Audit finding                                                                        | Addressed by |
| ------------------------------------------------------------------------------------ | ------------ |
| 56% of tests absent from the CI gate; deploy quality gate never runs backend tests   | AC-6         |
| Coverage unmeasured, no provider installed, stale artifact measuring 1 of 8 modules  | AC-11        |
| Large untested surfaces invisible without a coverage provider                        | AC-11        |
| Test environment, config, alias, cleanup, runtime-parity and placeholder defects     | AC-5         |
| Auth tests faithful to an implementation that never verifies JWT signature or expiry | AC-3         |
| Mixed-language monorepo (vitest + pytest) not describable by a JS-only contract      | AC-4         |

Findings from the same audit that remain **out of scope** and route to follow-up issues: frontend component tests, accessibility assertions, and DESIGN.md token enforcement; detection of mock-reimplementation anti-patterns in existing suites (mutation testing is the eventual mechanism); RLS policy tests, migration clean-apply tests, real-Postgres integration, and OpenAPI spec-to-implementation validation.

## Constraints

- **Simplicity budget.** Shorter agent prompts work better. `qa-engineer` has no modes; `developer` gains one rule, not a checkpoint list; `planner` gains one line. Simplification must not create a path where a step is silently skipped — hence the explicit `SKIPPED(<reason>)` value rather than an omittable field.
- **Rule 19 preserved.** `developer` continues to author tests before implementation code. `qa-engineer` owns standards, harnesses for levels the project lacks, and coverage/gap analysis. Per-sub-task test-authoring delegation was rejected: it would break the step-gated loop and is slower for no fidelity gain.
- **Audit independence.** `qa-engineer` writes tests; `verifier` grades them. The two must stay separate agents.
- **Config authority.** `qa-engineer` may edit test-only config (`vitest.config.ts`, coverage thresholds, and later `playwright.config.*`). All such edits land under PR review. No other agent gains this authority; `housekeeping`'s prohibition stands.
- **Framework-repo exception.** This repo is the framework, not a consumer app. Its own `package.json` is **not** brought up to the canonical script set as part of this issue.
- **Kiro frontmatter.** No `permissions` block — per `AGENTS.md` it is unsupported by the Kiro runtime and causes agents to fail to load. `tools: [read, write, shell]`.
- Cross-platform behavioral parity is required; byte-for-byte parity is not.

## Risks and Edge Cases

- **Scope creep into the follow-up.** Integration and Playwright work is adjacent and tempting. The task list must not pull it forward.
- **Prompt bloat.** Three skills plus an agent plus a contract doc is already a large surface. If `activity-test-implementation` grows past a readable length, split by layer rather than adding sections.
- **Late standards discovery.** Because the standards check runs inside `qa-engineer` rather than as a separate early `developer` checkpoint, a missing or unfilled `/TESTING.md` surfaces at the completion gate. Accepted tradeoff: `qa-engineer` fills it and reports, and PR review covers the rest. Revisit only if it proves disruptive in practice.
- **Coverage tooling absent.** Many consumer projects have no coverage tool configured. The gate must report `SKIPPED(no coverage tooling configured)` rather than fail the run or fake a pass.
- **Ordering matters.** Coverage runs before the `verifier` audit so the audit can consume the gap report as test evidence for its per-AC table. Reversing the order loses that.
- **Eight-place duplication.** The canonical script list currently appears in `AGENTS.md`, `CLAUDE.md`, `plan` steering (×2), `activity-init` (×3), and `activity-generate-stories` (×3). Consolidating into `/TESTING.md` risks leaving stale copies behind.
- **Placeholder left unfilled.** A placeholder `/TESTING.md` that nobody fills is worse than none, because agents would read empty guidance as permission. `activity-test-standards` must distinguish "placeholder, unfilled" from "filled for this project" and report the former.
- **Root-file distribution is a new concept.** `core/distribution/install.ts` iterates `PROFILE_PATHS` per platform, and every installed file carries a `profile` tag. `/TESTING.md` is platform-agnostic and lives at the repo root, so it fits neither shape. Implementation must decide how a root file is tagged in the manifest and must not install it three times under `--profile all`. `/DESIGN.md` sidesteps this by not being distributed at all, so there is no existing precedent to copy.

## Non-Goals

- Layer 3 product evals — semantic similarity, tone, hallucination, groundedness, eval/gold dataset management, judge rubrics, score regression tracking. **Backlog issue to be created.**
- Local and remote integration testing, and Playwright CLI E2E with auth/env/state prerequisites. **Follow-up issue to be created**, and it must explicitly include RLS policy tests, migration clean-apply tests, real-Postgres integration, and OpenAPI spec-to-implementation validation (wiring the existing `dt verify` family rather than designing something new).
- Frontend component tests, accessibility assertions, and DESIGN.md token enforcement via lint rule plus tests. **Follow-up issue to be created.** Component-test scope in this issue is backend only.
- Detection of mock-reimplementation anti-patterns in existing suites — test doubles that reimplement the logic they should verify, which coverage cannot see. **Follow-up issue to be created**; mutation testing is the eventual mechanism.
- Mutation testing. Named in `docs/technical-guidelines.md` and the roadmap, but deferred — it is the expensive piece and depends on a coverage baseline existing first.
- Installing coverage providers or other test dependencies. `qa-engineer` reports that a provider is absent and falls back to structural analysis (AC-11); adding the dependency remains an approved-task decision per `docs/technical-guidelines.md`.
- Load and performance testing, visual regression testing.
- Extending `verifier` with a third mode, or moving its four design skills.
- Making the coverage gate hard-blocking.
- Changing `developer` rule 19, or introducing per-sub-task test-authoring delegation.
- Bringing this repo's own `package.json` scripts up to the canonical set.
- A `dt` subcommand for the script check — it ships as a checklist inside `activity-test-standards`.
- An integration-wide coverage rollup in `planner` — deferred to the follow-up issue.

## Dependencies

- Follow-up issue: integration + Playwright E2E (to be created; blocked by this issue)
- Backlog issue: Layer 3 product evals (to be created; independent)
- `/DESIGN.md` — the precedent `/TESTING.md` follows for a per-project canonical contract
- `docs/technical-guidelines.md` § Testing Strategy — the validation-layer language `/TESTING.md` must stay consistent with
- `.kiro/agents/verifier.md`, `.kiro/agents/developer.md`, `.kiro/agents/planner.md` — touched, minimally
- `test/unit/*-parity.test.ts` — existing pattern the new parity test follows

## Testing Notes

- **Unit tests:** parity assertions across the three `qa-engineer` variants; presence and shape of the three skills in all three trees; `/TESTING.md` registered in `bundle-manifest.json` `consumer_owned_paths` and in `scripts/build-bundle.sh` `MANAGED_FILES`; `developer` closeout payload includes `coverage_gate`; `verifier` Out of Scope points to `qa-engineer`; `qa-engineer` prompt length ≤ 150 lines. Extend `test/unit/distribution-install.test.ts` and `test/unit/distribution-profiles.test.ts` for root-file distribution.
- **Integration tests:** install/update flow places the new agent and skills per profile, ships `TESTING.md` exactly once under `--profile all`, records it in the manifest, and preserves a consumer-filled `TESTING.md` on update.
- **Manual checks:** run `activity-test-standards` against a monorepo whose aggregate test script omits a package with tests, and confirm the omission and the affected CI/deploy gate are both reported; run it against a project with a `node` test environment where a DOM is required, a missing test config, an alias mismatch, and an `expect(true)` placeholder, and confirm each is reported; run `activity-coverage-gap-analysis` against a repo with no coverage provider and confirm a ranked gap inventory is still produced; run a `developer` completion gate end to end and confirm ordering (coverage → verifier → technical-writer → PR ready).
- **Edge-case checks:** no coverage tooling → `coverage_gate: SKIPPED(<reason>)` **and** a structural gap report still produced; a stale or narrower-than-claimed coverage artifact → reported as misleading, not used as evidence; consumer `/TESTING.md` already present → preserved; placeholder present but unfilled → reported as unfilled; mixed-language monorepo → each package described with its own runner; repeated `dev-tasks install` → idempotent.
- **Acceptance-criteria-to-test mapping:** AC-1/AC-3 → parity + presence unit tests. AC-2 → prompt-length unit test. AC-4 → `/TESTING.md` section-contract unit test including the per-package slot. AC-5 → skill-content unit test + manual existing-project check. AC-6 → checklist unit test + manual monorepo/CI check. AC-7/AC-8 → payload-field unit test + manual gate run. AC-9 → registry/doc reference unit tests. AC-10 → distribution unit tests + install/update integration test. AC-11 → skill-content unit test + manual no-provider run.

## Open Questions

None. All refinement questions are resolved:

- `/TESTING.md` ships as a **placeholder**, with `activity-test-standards` providing the procedure to establish project-specific values for an existing codebase.
- Skill names confirmed: `activity-test-standards`, `activity-test-implementation`, `activity-coverage-gap-analysis`.
- `developer` references `qa-engineer` in five places (rule, execution flow, integration table, completion gate, closeout payload) with no duplicated procedure.
