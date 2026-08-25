# Implementation Plan - Issue #130: Local and remote integration testing plus Playwright E2E

## Relevant Files

- `.kiro/skills/activity-integration-test-implementation/SKILL.md` - New skill: integration testing (Layer 2.5)
- `.github/skills/activity-integration-test-implementation/SKILL.md` - Platform variant
- `.claude/skills/activity-integration-test-implementation/SKILL.md` - Platform variant
- `.kiro/skills/activity-e2e-test-implementation/SKILL.md` - New skill: Playwright E2E
- `.github/skills/activity-e2e-test-implementation/SKILL.md` - Platform variant
- `.claude/skills/activity-e2e-test-implementation/SKILL.md` - Platform variant
- `.kiro/skills/activity-contract-validation/SKILL.md` - New skill: contract validation via dt verify
- `.github/skills/activity-contract-validation/SKILL.md` - Platform variant
- `.claude/skills/activity-contract-validation/SKILL.md` - Platform variant
- `TESTING.md` - Add Layer 2.5, E2E, and Contract Validation rows
- `.kiro/agents/qa-engineer.md` - Extend procedure with conditional steps
- `.github/agents/qa-engineer.agent.md` - Platform variant
- `.claude/agents/qa-engineer.md` - Platform variant
- `.kiro/skills/activity-test-standards/SKILL.md` - Add integration/E2E/contract detection
- `.github/skills/activity-test-standards/SKILL.md` - Platform variant
- `.claude/skills/activity-test-standards/SKILL.md` - Platform variant
- `.github/agents/planner.agent.md` - Add post-merge rollup step
- `.kiro/agents/planner.md` - Platform variant (if exists)
- `.claude/agents/planner.md` - Platform variant (if exists)
- `AGENTS.md` - Register new skills
- `AGENTS.md.template` - Register new skills in template
- `docs/workflow-chains.md` - Update QA chain and add integration decision path
- `docs/technical-guidelines.md` - Reference Layer 2.5
- `docs/system-overview.md` - Reference new skills
- `bundle-manifest.json` - Add new skill paths
- `scripts/build-bundle.sh` - Add new skill paths to MANAGED_FILES
- `test/unit/` - Parity and presence tests for new skills

## Tasks

- [x] 1.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: `activity-integration-test-implementation` skill (AC-1)

  - [x] 1.1 Author `.kiro/skills/activity-integration-test-implementation/SKILL.md` with YAML frontmatter and full procedure covering: local integration (testcontainers/docker-compose/Supabase local detection and recommendation), fixtures/seeding/rollback/teardown, migration clean-apply tests, RLS policy tests, pgTAP schema contracts, remote integration (read-only default, testing-env writes with approval), and honest fallback when no environment exists
  - [x] 1.2 Copy to `.github/skills/activity-integration-test-implementation/SKILL.md` with equivalent behavioral contract
  - [x] 1.3 Copy to `.claude/skills/activity-integration-test-implementation/SKILL.md` with equivalent behavioral contract
  - [x] 1.4 Verify AC-1: all three files exist and behavioral contract is equivalent
  - [x] 1.5 Run `pnpm run test` to verify no regressions

- [x] 2.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: `activity-e2e-test-implementation` skill (AC-2)

  - [x] 2.1 Author `.kiro/skills/activity-e2e-test-implementation/SKILL.md` with YAML frontmatter and full procedure covering: Playwright prerequisite contract (auth strategy with storageState default, seeded test users, base URL resolution, DB state reset, trace/screenshot/video retention, browser install/sharding, scenario-to-spec mapping via `@scenario SC-{n}` annotation), and conversion of `activity-e2e-test-design` scenario tables into executable specs
  - [x] 2.2 Copy to `.github/skills/activity-e2e-test-implementation/SKILL.md` with equivalent behavioral contract
  - [x] 2.3 Copy to `.claude/skills/activity-e2e-test-implementation/SKILL.md` with equivalent behavioral contract
  - [x] 2.4 Verify AC-2: all three files exist and behavioral contract is equivalent
  - [x] 2.5 Verify AC-10: scenario-to-spec traceability convention is documented (`SC-{n}` → `.spec.ts` file/test block)
  - [x] 2.6 Run `pnpm run test` to verify no regressions

- [x] 3.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: `activity-contract-validation` skill (AC-3)

  - [x] 3.1 Author `.kiro/skills/activity-contract-validation/SKILL.md` with YAML frontmatter and full procedure covering: OpenAPI/AsyncAPI spec detection, `dt verify contract-diff` execution, `dt verify impact` execution, `dt verify drift` execution, risk-ranked finding format, integration with `coverage_gate` reporting, and graceful fallback when `dt` is not installed
  - [x] 3.2 Copy to `.github/skills/activity-contract-validation/SKILL.md` with equivalent behavioral contract
  - [x] 3.3 Copy to `.claude/skills/activity-contract-validation/SKILL.md` with equivalent behavioral contract
  - [x] 3.4 Verify AC-3: all three files exist and behavioral contract is equivalent
  - [x] 3.5 Run `pnpm run test` to verify no regressions

- [x] 4.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: `/TESTING.md` taxonomy updates (AC-4, AC-5, AC-6)

  - [x] 4.1 Add Layer 2.5 (Integration) row to the Test Layers table with scope description and boundary rules
  - [x] 4.2 Add E2E layer row below Layer 2.5 with Playwright CLI scope and boundary rules
  - [x] 4.3 Add Contract Validation row with scope (`dt verify` family) and boundary rules
  - [x] 4.4 Update the escalation rule to include Layer 2 → Layer 2.5 escalation
  - [x] 4.5 Add `test:integration`, `test:e2e`, and `test:contract` to the Commands table
  - [x] 4.6 Verify AC-4: Layer 2.5 boundary explicitly states "MUST NOT mock the data layer"
  - [x] 4.7 Verify AC-5: E2E boundary explicitly states "MUST NOT assert on internal state"
  - [x] 4.8 Verify AC-6: Contract validation boundary states "checks boundary/interface only"
  - [x] 4.9 Run `pnpm run test` to verify no regressions

- [x] 5.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: `qa-engineer` procedure extension (AC-7)

  - [x] 5.1 Extend `qa-engineer` procedure in `.kiro/agents/qa-engineer.md` with new steps 2.5, 3, 4 (conditional: run only when layer is configured in `/TESTING.md`, emit `SKIPPED(<layer not configured>)` otherwise)
  - [x] 5.2 Mirror changes to `.github/agents/qa-engineer.agent.md`
  - [x] 5.3 Mirror changes to `.claude/agents/qa-engineer.md`
  - [x] 5.4 Verify AC-7: steps are ordered, conditional logic is explicit, skip reasons are documented
  - [x] 5.5 Run `pnpm run test` to verify no regressions

- [x] 6.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: `activity-test-standards` extension (AC-8)

  - [x] 6.1 Add integration/E2E/contract infrastructure detection to `.kiro/skills/activity-test-standards/SKILL.md`: testcontainers/docker-compose/Supabase CLI presence, Playwright config correctness, `test:integration`/`test:e2e` script reachability, OpenAPI/AsyncAPI spec presence
  - [x] 6.2 Mirror changes to `.github/skills/activity-test-standards/SKILL.md`
  - [x] 6.3 Mirror changes to `.claude/skills/activity-test-standards/SKILL.md`
  - [x] 6.4 Verify AC-8: missing infra reported as informational findings, not blocking defects
  - [x] 6.5 Run `pnpm run test` to verify no regressions

- [x] 7.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: Planner integration rollup (AC-9)

  - [x] 7.1 Add post-merge rollup step to `.github/agents/planner.agent.md`: after all stories merge, invoke `qa-engineer` at PRD scope on affected packages, report PRD-level `coverage_gate`, runs before PRD-level verifier audit
  - [x] 7.2 Mirror changes to `.kiro/agents/planner.md` (if exists)
  - [x] 7.3 Mirror changes to `.claude/agents/planner.md` (if exists)
  - [x] 7.4 Verify AC-9: rollup scopes to affected packages, not entire workspace
  - [x] 7.5 Run `pnpm run test` to verify no regressions

- [x] 8.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: Documentation and registry updates (AC-11, AC-12)

  - [x] 8.1 Update `docs/workflow-chains.md`: expand "Testing Standard (QA)" chain with new steps, add "Integration & E2E Testing" section with local/remote decision path, add "Planner Rollup" section
  - [x] 8.2 Update `docs/technical-guidelines.md` § Testing Strategy: add Layer 2.5 reference, update validation layers list
  - [x] 8.3 Update `AGENTS.md`: add three new skills to the Activity Skills table with descriptions and primary consumers
  - [x] 8.4 Update `AGENTS.md.template` to match `AGENTS.md` changes
  - [x] 8.5 Update `docs/system-overview.md` if it references skill inventory
  - [x] 8.6 Update `README.md` if it references skill inventory
  - [x] 8.7 Update `verifier` agent E2E section to reference `activity-e2e-test-implementation` as the execution counterpart
  - [x] 8.8 Verify AC-11: workflow-chains.md has the expanded QA chain and decision path
  - [x] 8.9 Verify AC-12: all registries and docs reference the three new skills
  - [x] 8.10 Run `pnpm run test` to verify no regressions

- [x] 9.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: Distribution (AC-13)

  - [x] 9.1 Add new skill paths to `bundle-manifest.json`
  - [x] 9.2 Add new skill paths to `scripts/build-bundle.sh` MANAGED_FILES
  - [x] 9.3 Verify `dev-tasks install` places the three new skill directories
  - [x] 9.4 Verify `dev-tasks update` updates managed skill files without overwriting consumer content
  - [x] 9.5 Run `pnpm run test` to verify distribution tests pass

- [x] 10.0 Implement Issue #130 - https://github.com/llipe/dev-tasks/issues/130: Unit tests and validation

  - [x] 10.1 Add parity assertions for the three new skills (behavioral equivalence across platforms)
  - [x] 10.2 Add presence tests for new skill directories in all platform trees
  - [x] 10.3 Add `/TESTING.md` section-contract tests for Layer 2.5, E2E, and Contract Validation rows
  - [x] 10.4 Add `qa-engineer` prompt test verifying step count, ordering, and conditional logic
  - [x] 10.5 Add `planner` prompt test verifying rollup step presence
  - [x] 10.6 Add `docs/workflow-chains.md` content test verifying updated chain sections
  - [x] 10.7 Add `bundle-manifest.json` test verifying new skill entries
  - [x] 10.8 Run full test suite: `pnpm run test`
  - [x] 10.9 Run quality gates: `pnpm run lint && pnpm run format:check && pnpm run typecheck`
  - [x] 10.10 Verify all 13 acceptance criteria are satisfied
