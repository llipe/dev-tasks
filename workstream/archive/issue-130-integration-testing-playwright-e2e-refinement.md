# Issue Refinement: 130 - Local and remote integration testing plus Playwright E2E

## Changelog

| Version | Date       | Summary            | Author           |
| ------- | ---------- | ------------------ | ---------------- |
| 1.0     | 2026-08-19 | Initial refinement | product-engineer |

## Summary

- **Goal:** Give `dev-tasks` the skills and contracts to guide consumer projects through real-database integration testing (local and remote), Playwright-based end-to-end testing, contract-validation wiring, and a planner-level coverage rollup — closing the layer gap between the foundation delivered by #123 (Layers 1-2) and the complete testing stack described in `docs/technical-guidelines.md`.
- **Primary user impact:** Consumer projects get three new skills that teach agents how to write and operate integration tests against real databases, author and run Playwright E2E specs, and validate API contracts against implementation. `/TESTING.md` gains a formal Layer 2.5 (Integration) and Layer E2E with per-package commands. The `verifier` scenario-to-spec traceability gap is closed.
- **Non-goals:** See [Non-Goals](#non-goals).

## Accepted Design Decisions

These answers were confirmed during refinement:

1. **Single issue** — all five sub-domains stay in one issue rather than being split.
2. **New skill for contract validation** — `activity-contract-validation` (not an extension of `activity-test-standards`).
3. **New skill for E2E implementation** — `activity-e2e-test-implementation` (execution counterpart to the existing `activity-e2e-test-design`).
4. **Layer 2.5** — integration testing becomes a formal named layer in the `/TESTING.md` taxonomy, between Layer 2 (constrained model/tool) and Layer 3 (product evals).
5. **Planner rollup: start simple** — a post-merge `qa-engineer` run at PRD scope (coverage + gap analysis across all merged stories); no cross-story contract validation initially.
6. **Local integration: capability contract, prefer easy local options** — testcontainers, docker-compose, or Supabase local CLI are all valid; the skill describes the capability (real database in tests), recommends the lowest-friction option that works, and does not mandate a specific tool.
7. **Remote integration: aim for a testing environment** — read-only by default against production, writes only against a dedicated testing environment with explicit per-operation approval.
8. **Runs after #118 (TS 7.x) in priority order** — #118 is higher urgency but does not block this work.

## Acceptance Criteria

### New Skills

- [ ] **AC-1 — `activity-integration-test-implementation` skill exists on all three platforms.** A skill is present at `.kiro/skills/activity-integration-test-implementation/SKILL.md`, `.github/skills/activity-integration-test-implementation/SKILL.md`, and `.claude/skills/activity-integration-test-implementation/SKILL.md`. Given the three files, when compared, then the behavioral contract is equivalent.

  - The skill covers:
    - Local integration: real database in tests via testcontainers, docker-compose, or Supabase local CLI — detect the easiest applicable option and recommend it.
    - Fixtures, seeding, transactional rollback between tests, deterministic teardown.
    - Migration clean-apply tests (from empty, verifying apply order and idempotency).
    - Row-level security (RLS) policy tests — assert cross-tenant isolation against the real policy layer, not JavaScript fakes.
    - pgTAP or equivalent for schema contracts, constraints, functions, triggers, and permissions.
    - Remote integration: read-only inspection by default; writes only against a testing environment with per-operation approval and post-operation verification.
    - Honest fallback: when no testing environment exists and production is read-only, record the limitation explicitly — never silently omit.

- [ ] **AC-2 — `activity-e2e-test-implementation` skill exists on all three platforms.** A skill is present at `.kiro/skills/activity-e2e-test-implementation/SKILL.md`, `.github/skills/activity-e2e-test-implementation/SKILL.md`, and `.claude/skills/activity-e2e-test-implementation/SKILL.md`. Given the three files, when compared, then the behavioral contract is equivalent.

  - The skill covers the Playwright prerequisite contract:
    - Authentication strategy: `storageState` via setup project as default; per-test programmatic login and API-token seeding as alternatives with guidance on when each applies.
    - Seeded test users and how credentials reach CI without landing in the repository (env vars or secrets).
    - Base URL and environment resolution (env-driven, not hardcoded).
    - Database state reset between runs (migration + seed, or transaction rollback, or snapshot restore).
    - Trace, screenshot, and video retention policy (on-failure by default, CI artifact retention).
    - Browser install in CI vs. locally; sharding strategy for large suites.
    - **Scenario-to-spec mapping:** a `verifier` Design Mode scenario ID (`SC-{n}`) resolves to a concrete `.spec.ts` file and test block via a naming convention or a `@scenario` tag. Traceability from AC → scenario → spec is closed.
  - The skill describes how to convert `activity-e2e-test-design` scenario tables into executable Playwright specs.

- [ ] **AC-3 — `activity-contract-validation` skill exists on all three platforms.** A skill is present at `.kiro/skills/activity-contract-validation/SKILL.md`, `.github/skills/activity-contract-validation/SKILL.md`, and `.claude/skills/activity-contract-validation/SKILL.md`. Given the three files, when compared, then the behavioral contract is equivalent.
  - The skill wires the existing `dt verify` family (`contract-diff`, `impact`, `drift`) into the QA path:
    - Detect OpenAPI/AsyncAPI specs in the repository.
    - Run `dt verify contract-diff` to detect breaking changes.
    - Run `dt verify impact` to list affected consumers.
    - Run `dt verify drift` to detect spec-to-implementation staleness.
    - Report findings in the same risk-ranked format used by `activity-coverage-gap-analysis`.
    - Integrate with the `coverage_gate` reporting path — contract-validation findings are reported alongside coverage, not silently omitted.

### `/TESTING.md` Updates

- [ ] **AC-4 — Layer 2.5 (Integration) is a formal named layer in the taxonomy.** The `/TESTING.md` placeholder gains a Layer 2.5 row:

  - Layer 2.5: Integration — real database, real migrations, RLS policies, schema contracts. No mocked data layer.
  - The layer boundary is explicit: Layer 2.5 **MUST NOT** mock the data layer. If the database is mocked, the test belongs at Layer 2. If the test hits a live external service over the network, it may belong at E2E or remote integration.
  - The escalation rule is updated: "When a Layer 2 test needs a real database, it moves to Layer 2.5."

- [ ] **AC-5 — E2E layer is declared in `/TESTING.md`.** The placeholder gains an E2E row below Layer 2.5:

  - E2E: Playwright CLI — committed browser automation, full-stack, scenario-driven.
  - Boundary: E2E tests **MUST NOT** assert on internal state or implementation. Assertions are on observable user-facing behavior only.
  - Per-package commands: `test:integration` for Layer 2.5, `test:e2e` for the E2E layer.

- [ ] **AC-6 — Contract validation layer is declared in `/TESTING.md`.** A "Contract Validation" row is added:
  - Scope: API spec drift, breaking-change detection, consumer impact.
  - Command: `test:contract` or `dt verify` family.
  - Boundary: contract validation checks the boundary/interface — it does not test internal behavior.

### Workflow Integration

- [ ] **AC-7 — `qa-engineer` procedure is extended.** The `qa-engineer` agent prompt gains steps for the new layers:

  - Step 1: `activity-test-standards` (existing — now also detects integration and E2E config)
  - Step 2: `activity-test-implementation` (existing — Layers 1-2)
  - Step 2.5: `activity-integration-test-implementation` (new — Layer 2.5)
  - Step 3: `activity-e2e-test-implementation` (new — E2E layer)
  - Step 4: `activity-contract-validation` (new — contract drift)
  - Step 5: `activity-coverage-gap-analysis` (existing — now includes integration + E2E in scope)
  - The agent **MUST** run steps in order. Steps 2.5, 3, and 4 are **conditional**: they run only when the project has the corresponding layer configured in `/TESTING.md`. If a layer is not configured, the step emits `SKIPPED(<layer not configured>)`.

- [ ] **AC-8 — `activity-test-standards` detects integration and E2E harness state.** The existing skill gains detection for:

  - Testcontainers, docker-compose, or Supabase local CLI presence/configuration.
  - Playwright config file presence and correctness (base URL, auth setup project, browser install).
  - `test:integration` and `test:e2e` script presence and reachability from the aggregate.
  - OpenAPI/AsyncAPI spec files presence.
  - Reports missing integration/E2E infrastructure as findings (not defects that block — informational for the gap analysis).

- [ ] **AC-9 — Planner integration rollup.** `planner` gains one post-merge step after all stories merge to the integration branch:

  - Invoke `qa-engineer` at PRD scope (all packages, all layers).
  - Report a PRD-level `coverage_gate` that aggregates per-story gates.
  - This runs before the PRD-level `verifier` audit.
  - Simple implementation: the planner calls `qa-engineer` with the full codebase as scope after the last story PR merges.

- [ ] **AC-10 — Scenario-to-spec traceability is closed.** Given a `verifier` Design Mode test plan with scenario IDs (`SC-1`, `SC-2`, ...), when `activity-e2e-test-implementation` authors specs, then each spec file or test block carries a `@scenario SC-{n}` annotation (comment or test title prefix). Given a fidelity audit, when `verifier` checks E2E coverage, then it can resolve scenario IDs to actual spec files and report uncovered scenarios.

- [ ] **AC-11 — `docs/workflow-chains.md` updated.** The "Testing Standard (QA)" chain is updated to show the expanded flow including the new steps and the planner rollup. A new "Integration & E2E Testing" section is added showing the local/remote decision path.

- [ ] **AC-12 — Registries and docs updated.** `AGENTS.md`, `AGENTS.md.template`, `README.md`, `docs/workflow-chains.md`, `docs/system-overview.md`, and `bundle-manifest.json` reflect the three new skills. The `verifier` agent's E2E section references `activity-e2e-test-implementation` as the execution counterpart. `docs/technical-guidelines.md` § Testing Strategy is updated to reference Layer 2.5 explicitly.

### Distribution

- [ ] **AC-13 — New skills are distributed via both install paths.** The three new skills reach consumer repositories through the shell bundle (`scripts/build-bundle.sh`) and the npm installer (`dev-tasks install`). Given a fresh install with any profile, when it completes, then the three skill directories are present. Given a `dev-tasks update`, then managed skill files are updated.

## Constraints

- **Simplicity budget.** Each new skill **SHOULD** be ≤200 lines. The skill describes the capability contract and the procedure; it does not embed framework-specific boilerplate.
- **No tool installation.** Skills detect and recommend tools but **MUST NOT** install testcontainers, Playwright, pgTAP, or any other dependency. Installation remains an approved-task decision.
- **No application code.** Skills guide test authoring; they **MUST NOT** write application source or configuration beyond test-only files.
- **Conditional execution.** New qa-engineer steps are opt-in per project: if a layer is not declared in `/TESTING.md`, the step is skipped with a reason, not failed.
- **Cross-platform parity.** All three platform trees must carry equivalent skill content. Byte-for-byte parity is not required; behavioral parity is.
- **Existing skill stability.** `activity-test-implementation` and `activity-test-standards` are extended, not rewritten. Extensions are additive.
- **`dt verify` availability.** The `activity-contract-validation` skill assumes `dt` is installed. When it is not, it reports `SKIPPED(dt not installed)` and provides manual instructions.

## Risks and Edge Cases

- **Consumer projects without Docker.** Testcontainers requires Docker. The skill must detect Docker availability and fall back to Supabase local CLI or a connect-to-remote strategy, not fail silently.
- **Playwright in CI without display.** The skill must specify headless mode and handle the browser download step explicitly (or `npx playwright install --with-deps`).
- **Flaky E2E tests.** The skill must address retry strategy, test isolation, and deterministic state reset. A flaky E2E test that occasionally passes is worse than no test.
- **RLS test complexity.** Testing RLS requires multiple database roles/sessions. The skill must describe how to establish multiple authenticated connections in a test.
- **Large migration stacks.** A project with 50+ migrations may have slow clean-apply tests. The skill should recommend running full clean-apply on CI/scheduled, and incremental (latest N) on PR.
- **Scenario-to-spec drift.** If a spec is renamed or deleted, the scenario mapping breaks. The traceability check in `verifier` must detect orphaned scenario references.
- **Planner rollup scope explosion.** Running full qa-engineer at PRD scope on a large monorepo could be expensive. The rollup should scope to packages affected by the merged stories, not the entire workspace.

## Dependencies

- **#123 (CLOSED)** — delivered the foundation this extends (qa-engineer, TESTING.md, Layers 1-2 skills, coverage gap analysis). No longer blocking.
- `core/verify/` — existing `dt verify` module that `activity-contract-validation` wires into the QA path.
- `activity-e2e-test-design` — existing verifier skill that produces scenario tables; the new `activity-e2e-test-implementation` consumes its output.
- `planner.agent.md` — gains the rollup step.
- `qa-engineer` agent prompt — gains the expanded procedure.
- `activity-test-standards` — gains integration/E2E detection.
- `docs/technical-guidelines.md` — gains Layer 2.5 reference.
- `docs/workflow-chains.md` — gains updated QA chain.

## Testing Notes

- **Unit tests:** Parity assertions across the three variants of each new skill; presence of the three skill directories in all platform trees; `/TESTING.md` placeholder includes Layer 2.5, E2E, and Contract Validation rows; `qa-engineer` prompt references new steps; `planner` prompt references rollup step; `docs/workflow-chains.md` includes updated chain; `bundle-manifest.json` includes new skills.
- **Integration tests:** install/update flow places new skills per profile; `dev-tasks update` preserves consumer `/TESTING.md` content; `activity-test-standards` detects testcontainers/playwright/openapi config in a fixture project.
- **Manual checks:**
  - Run `activity-integration-test-implementation` against a project with a Supabase local stack and RLS policies; confirm it produces working integration tests with real-database assertions.
  - Run `activity-e2e-test-implementation` against a project with Playwright configured; confirm scenario-to-spec mapping works (`SC-1` → `login.spec.ts`).
  - Run `activity-contract-validation` against a project with an OpenAPI spec; confirm `dt verify` findings are reported in the gap-analysis format.
  - Run `qa-engineer` full procedure; confirm new steps execute conditionally (skip when layer not configured, run when configured).
  - Run planner rollup after merging two story PRs; confirm PRD-level coverage_gate is emitted.
- **Edge-case checks:**
  - No Docker available → skill falls back to remote or reports limitation.
  - No Playwright config → step skipped with reason.
  - No `dt` installed → contract validation skipped with reason.
  - No OpenAPI/AsyncAPI spec → contract validation skipped with reason.
  - Consumer `/TESTING.md` already has custom Layer 2.5 content → preserved, not overwritten.
  - Scenario ID in test plan has no corresponding spec file → `verifier` reports orphaned scenario.
- **Acceptance-criteria-to-test mapping:**
  - AC-1 → skill presence + parity unit tests + manual real-database check
  - AC-2 → skill presence + parity unit tests + manual Playwright check
  - AC-3 → skill presence + parity unit tests + manual dt-verify check
  - AC-4/AC-5/AC-6 → `/TESTING.md` section-contract unit tests
  - AC-7 → qa-engineer prompt unit test (step count, ordering, conditional logic)
  - AC-8 → activity-test-standards content unit test + manual detection check
  - AC-9 → planner prompt unit test + manual rollup check
  - AC-10 → scenario-to-spec mapping unit test + manual traceability check
  - AC-11/AC-12 → registry/doc reference unit tests
  - AC-13 → distribution unit tests + install/update integration test

## Workflow Documentation

### Updated QA Chain (after this issue)

```text
qa-engineer:
  Step 1: activity-test-standards         → /TESTING.md filled, harness defects, gate reachability
                                            (now also detects integration/E2E/contract infra)
      ↓
  Step 2: activity-test-implementation    → Layer 1-2 tests, security-negative cases
      ↓
  Step 2.5: activity-integration-test-implementation → Layer 2.5 tests (conditional)
                                                       - local: real DB via testcontainers/docker/supabase-local
                                                       - remote: read-only default, testing-env writes with approval
                                                       - RLS, migrations, pgTAP
      ↓
  Step 3: activity-e2e-test-implementation → E2E layer (conditional)
                                             - Playwright specs from scenario tables
                                             - SC-{n} → .spec.ts traceability
                                             - Auth, state reset, CI config
      ↓
  Step 4: activity-contract-validation     → Contract layer (conditional)
                                             - dt verify contract-diff / impact / drift
                                             - OpenAPI/AsyncAPI drift detection
      ↓
  Step 5: activity-coverage-gap-analysis   → coverage_gate + risk-ranked gap inventory
                                             (scope includes integration + E2E + contract layers)
```

### Planner Rollup (after this issue)

```text
planner: orchestrate stories → developer: implement (per story)
              ↓ (all stories merged to integration branch)
         qa-engineer (PRD scope): full procedure on affected packages
              ↓
         coverage_gate (PRD-level, aggregated)
              ↓
         verifier (audit mode): PRD-level fidelity audit
              ↓
         PR: integration → main (user approval required)
```

### Local vs. Remote Integration Decision Path

```text
Does the project have Docker available?
    ├── YES → Use testcontainers or docker-compose (prefer testcontainers for isolation)
    │         Real Postgres, real migrations, real RLS
    │
    └── NO → Is Supabase CLI installed?
                 ├── YES → Use `supabase start` for local stack
                 │         Real Postgres, real migrations, real RLS
                 │
                 └── NO → Is a dedicated testing environment configured?
                              ├── YES → Connect to testing env (explicit approval for writes)
                              │         Read-only validation by default
                              │
                              └── NO → Record limitation. Use Layer 2 mocked tests.
                                        Report "integration layer unavailable" in gap analysis.
                                        Recommend environment setup as a follow-up.
```

## Non-Goals

- Mutation testing and mock-reimplementation detection — tracked separately in #132.
- Layer 3 product evals — tracked separately in #133.
- Frontend component tests, accessibility assertions, and DESIGN.md token enforcement — tracked separately in #131.
- Load and performance testing; visual regression testing.
- Installing test dependencies on behalf of the consumer project.
- Making integration or E2E layers mandatory — they remain opt-in per project.
- Cross-story contract validation in the planner rollup (future enhancement if needed).
- Bringing this repo's own test suite to integration/E2E coverage.

## Open Questions

None remaining. All design decisions resolved during refinement.
