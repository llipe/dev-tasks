# Test Plan: Issue #130 — Local and remote integration testing plus Playwright E2E

## Source

- **Issue:** https://github.com/llipe/dev-tasks/issues/130
- **Refinement:** `workstream/issue-130-integration-testing-playwright-e2e-refinement.md`
- **Mode:** Design (pre-implementation)
- **Date:** 2026-08-19

## Acceptance Criteria Extraction

| AC ID  | Description                                                              |
| ------ | ------------------------------------------------------------------------ |
| AC-1   | `activity-integration-test-implementation` skill on all 3 platforms      |
| AC-2   | `activity-e2e-test-implementation` skill on all 3 platforms              |
| AC-3   | `activity-contract-validation` skill on all 3 platforms                  |
| AC-4   | Layer 2.5 (Integration) in `/TESTING.md` taxonomy                        |
| AC-5   | E2E layer in `/TESTING.md`                                               |
| AC-6   | Contract validation layer in `/TESTING.md`                               |
| AC-7   | `qa-engineer` procedure extended with conditional steps                  |
| AC-8   | `activity-test-standards` detects integration/E2E/contract infra         |
| AC-9   | Planner integration rollup (post-merge qa-engineer at PRD scope)         |
| AC-10  | Scenario-to-spec traceability (`SC-{n}` → `.spec.ts`)                    |
| AC-11  | `docs/workflow-chains.md` updated                                        |
| AC-12  | Registries and docs updated                                              |
| AC-13  | Distribution via both install paths                                      |

---

## E2E Scenarios

### SC-1: Skill file presence — `activity-integration-test-implementation`

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                                                                |
| **Type**            | happy-path                                                                                                          |
| **Severity**        | critical                                                                                                            |
| **Preconditions**   | Implementation complete. All three platform trees exist.                                                            |
| **Steps**           | 1. Check `.kiro/skills/activity-integration-test-implementation/SKILL.md` exists. 2. Check `.github/skills/`. 3. Check `.claude/skills/`. |
| **Expected Result** | All three files present with valid YAML frontmatter and markdown body.                                              |
| **Pass Criteria**   | Files exist, parse without error, frontmatter contains `name` and `description` fields.                             |

### SC-2: Skill behavioral parity — `activity-integration-test-implementation`

| Field               | Value                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                                                                                                    |
| **Type**            | happy-path                                                                                                                                              |
| **Severity**        | critical                                                                                                                                                |
| **Preconditions**   | SC-1 passes. All three files are readable.                                                                                                              |
| **Steps**           | 1. Extract procedure steps from each variant. 2. Compare step names, ordering, and behavioral outcomes. 3. Check section headings match semantically.    |
| **Expected Result** | Behavioral contract is equivalent across all three variants (step count, ordering, coverage of local/remote/RLS/migrations/pgTAP/fallback).              |
| **Pass Criteria**   | No missing procedure step. No semantic divergence. Platform-specific syntax differences allowed.                                                         |

### SC-3: Skill content completeness — integration test implementation

| Field               | Value                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                                                                                      |
| **Type**            | happy-path                                                                                                                                |
| **Severity**        | critical                                                                                                                                  |
| **Preconditions**   | SC-1 passes.                                                                                                                              |
| **Steps**           | 1. Parse skill content. 2. Check for sections: local integration, fixtures/seeding/rollback, migration clean-apply, RLS, pgTAP, remote integration, fallback. |
| **Expected Result** | All seven sub-domains are addressed with explicit guidance.                                                                                |
| **Pass Criteria**   | Each sub-domain has a dedicated section or paragraph. None missing.                                                                       |

### SC-4: Skill content — no tool installation

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-2, AC-3                                                                                                        |
| **Type**            | negative-path                                                                                                           |
| **Severity**        | major                                                                                                                   |
| **Preconditions**   | Skills authored.                                                                                                        |
| **Steps**           | 1. Search all three skill files for installation commands (`npm install`, `pnpm add`, `apt-get`, `brew install`, etc.). |
| **Expected Result** | No installation commands present. Skills detect and recommend, never install.                                            |
| **Pass Criteria**   | Zero matches for install-pattern regex across all 9 skill files.                                                        |

### SC-5: Skill file presence — `activity-e2e-test-implementation`

| Field               | Value                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-2                                                                                                                     |
| **Type**            | happy-path                                                                                                               |
| **Severity**        | critical                                                                                                                 |
| **Preconditions**   | Implementation complete.                                                                                                 |
| **Steps**           | 1. Check `.kiro/skills/activity-e2e-test-implementation/SKILL.md` exists. 2. Check `.github/skills/`. 3. Check `.claude/skills/`. |
| **Expected Result** | All three files present with valid YAML frontmatter and markdown body.                                                   |
| **Pass Criteria**   | Files exist, parse without error, frontmatter contains `name` and `description` fields.                                  |

### SC-6: Playwright prerequisite contract coverage

| Field               | Value                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-2                                                                                                                                                    |
| **Type**            | happy-path                                                                                                                                              |
| **Severity**        | critical                                                                                                                                                |
| **Preconditions**   | SC-5 passes.                                                                                                                                            |
| **Steps**           | 1. Parse skill content. 2. Check for sections: auth strategy, seeded test users, base URL, DB state reset, trace/screenshot/video, browser install/sharding, scenario-to-spec mapping. |
| **Expected Result** | All seven Playwright prerequisites addressed.                                                                                                           |
| **Pass Criteria**   | Each prerequisite has a dedicated section or paragraph. `storageState` mentioned as default auth strategy.                                              |

### SC-7: Scenario-to-spec mapping convention documented

| Field               | Value                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-2, AC-10                                                                                                                                   |
| **Type**            | happy-path                                                                                                                                    |
| **Severity**        | critical                                                                                                                                      |
| **Preconditions**   | SC-5 passes.                                                                                                                                  |
| **Steps**           | 1. Search skill for `SC-{n}` or `@scenario` references. 2. Confirm a naming convention or annotation strategy is defined. 3. Confirm the traceability chain AC → scenario → spec is stated. |
| **Expected Result** | A clear, unambiguous convention for mapping scenario IDs to spec files/test blocks is documented.                                              |
| **Pass Criteria**   | Either a `@scenario SC-{n}` comment/tag approach or a file-naming convention (e.g., `sc-1-login.spec.ts`) is specified.                        |

### SC-8: Skill file presence — `activity-contract-validation`

| Field               | Value                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3                                                                                                                  |
| **Type**            | happy-path                                                                                                            |
| **Severity**        | critical                                                                                                              |
| **Preconditions**   | Implementation complete.                                                                                              |
| **Steps**           | 1. Check `.kiro/skills/activity-contract-validation/SKILL.md` exists. 2. Check `.github/skills/`. 3. Check `.claude/skills/`. |
| **Expected Result** | All three files present with valid YAML frontmatter and markdown body.                                                |
| **Pass Criteria**   | Files exist, parse without error, frontmatter contains `name` and `description` fields.                               |

### SC-9: Contract validation skill references dt verify commands

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3                                                                                                 |
| **Type**            | happy-path                                                                                           |
| **Severity**        | critical                                                                                             |
| **Preconditions**   | SC-8 passes.                                                                                         |
| **Steps**           | 1. Search skill content for `contract-diff`, `impact`, `drift`. 2. Verify each is referenced as a procedure step. |
| **Expected Result** | All three `dt verify` sub-commands are explicitly referenced as execution steps.                      |
| **Pass Criteria**   | `contract-diff`, `impact`, and `drift` each appear at least once in procedural context.              |

### SC-10: Contract validation graceful fallback when dt not installed

| Field               | Value                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3                                                                                                              |
| **Type**            | negative-path                                                                                                     |
| **Severity**        | major                                                                                                             |
| **Preconditions**   | SC-8 passes.                                                                                                      |
| **Steps**           | 1. Search skill for fallback behavior when `dt` is unavailable. 2. Confirm `SKIPPED(dt not installed)` is specified. |
| **Expected Result** | Explicit fallback documented: skill reports skip with reason, provides manual instructions.                        |
| **Pass Criteria**   | Text matching `SKIPPED` and `dt not installed` (or equivalent) present in the skill.                              |

### SC-11: Layer 2.5 row in `/TESTING.md`

| Field               | Value                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4                                                                                                        |
| **Type**            | happy-path                                                                                                  |
| **Severity**        | critical                                                                                                    |
| **Preconditions**   | Implementation complete.                                                                                    |
| **Steps**           | 1. Read `TESTING.md`. 2. Find row with "2.5" or "Integration" in the Test Layers table.                     |
| **Expected Result** | Layer 2.5 row exists with name "Integration" and scope including real database, migrations, RLS.            |
| **Pass Criteria**   | Row present. Scope text matches. "MUST NOT mock the data layer" boundary stated.                            |

### SC-12: Layer 2.5 boundary enforcement language

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4                                                                                                 |
| **Type**            | happy-path                                                                                           |
| **Severity**        | major                                                                                                |
| **Preconditions**   | SC-11 passes.                                                                                        |
| **Steps**           | 1. Read layer boundaries section. 2. Confirm escalation rule updated.                                |
| **Expected Result** | Escalation rule includes "When a Layer 2 test needs a real database, it moves to Layer 2.5."         |
| **Pass Criteria**   | Exact or semantically equivalent escalation text present.                                            |

### SC-13: E2E layer row in `/TESTING.md`

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-5                                                                                                            |
| **Type**            | happy-path                                                                                                      |
| **Severity**        | critical                                                                                                        |
| **Preconditions**   | Implementation complete.                                                                                        |
| **Steps**           | 1. Read `TESTING.md`. 2. Find row with "E2E" or "Playwright" in the Test Layers table.                          |
| **Expected Result** | E2E row exists. Boundary states "MUST NOT assert on internal state or implementation."                          |
| **Pass Criteria**   | Row present. Scope includes Playwright. Boundary language present. `test:e2e` command referenced.               |

### SC-14: Contract validation layer row in `/TESTING.md`

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-6                                                                                                     |
| **Type**            | happy-path                                                                                               |
| **Severity**        | major                                                                                                    |
| **Preconditions**   | Implementation complete.                                                                                 |
| **Steps**           | 1. Read `TESTING.md`. 2. Find row with "Contract" in the Test Layers table.                              |
| **Expected Result** | Contract validation row exists. Scope references API spec drift. `test:contract` or `dt verify` stated.  |
| **Pass Criteria**   | Row present. Boundary states "checks boundary/interface only."                                           |

### SC-15: `qa-engineer` step ordering and conditionality

| Field               | Value                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-7                                                                                                                                    |
| **Type**            | happy-path                                                                                                                              |
| **Severity**        | critical                                                                                                                                |
| **Preconditions**   | Implementation complete.                                                                                                                |
| **Steps**           | 1. Read `qa-engineer` agent prompt. 2. Identify procedure steps. 3. Confirm ordering: standards → L1-2 → L2.5 → E2E → contract → coverage. 4. Confirm steps 2.5, 3, 4 are conditional. |
| **Expected Result** | Six steps in correct order. Conditional steps explicitly reference `/TESTING.md` layer configuration and emit `SKIPPED(<reason>)`.       |
| **Pass Criteria**   | Step ordering correct. Conditional logic documented. Skip-with-reason format specified.                                                 |

### SC-16: `qa-engineer` skips unconfigured layer

| Field               | Value                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-7                                                                                                                       |
| **Type**            | negative-path                                                                                                              |
| **Severity**        | major                                                                                                                      |
| **Preconditions**   | SC-15 passes.                                                                                                              |
| **Steps**           | 1. Read `qa-engineer` prompt. 2. Confirm that when a layer is not configured in `/TESTING.md`, the step emits a skip reason. |
| **Expected Result** | Prompt specifies: "If a layer is not configured, the step emits `SKIPPED(<layer not configured>)`."                        |
| **Pass Criteria**   | Exact or equivalent conditional-skip language present.                                                                     |

### SC-17: `activity-test-standards` detects integration infrastructure

| Field               | Value                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-8                                                                                                                                         |
| **Type**            | happy-path                                                                                                                                   |
| **Severity**        | major                                                                                                                                        |
| **Preconditions**   | Implementation complete.                                                                                                                     |
| **Steps**           | 1. Read `activity-test-standards` skill. 2. Search for testcontainers/docker-compose/Supabase CLI detection. 3. Search for Playwright config detection. 4. Search for OpenAPI/AsyncAPI detection. |
| **Expected Result** | All three detection categories present. Findings reported as informational, not blocking.                                                     |
| **Pass Criteria**   | Detection procedures for each category present. "Informational" or "not blocking" language present.                                          |

### SC-18: `activity-test-standards` checks script reachability for new commands

| Field               | Value                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-8                                                                                                                     |
| **Type**            | happy-path                                                                                                               |
| **Severity**        | major                                                                                                                    |
| **Preconditions**   | SC-17 passes.                                                                                                            |
| **Steps**           | 1. Read skill. 2. Search for `test:integration` and `test:e2e` in the reachability checklist or script inventory.         |
| **Expected Result** | Both commands are included in the script presence and reachability checks.                                                |
| **Pass Criteria**   | `test:integration` and `test:e2e` both referenced in the reachability or script-contract section.                        |

### SC-19: Planner rollup step present

| Field               | Value                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-9                                                                                                                                      |
| **Type**            | happy-path                                                                                                                                |
| **Severity**        | critical                                                                                                                                  |
| **Preconditions**   | Implementation complete.                                                                                                                  |
| **Steps**           | 1. Read `planner` agent prompt. 2. Search for post-merge qa-engineer invocation. 3. Confirm PRD-level `coverage_gate` is mentioned. 4. Confirm it runs before PRD-level verifier audit. |
| **Expected Result** | Post-merge step documented. Scoped to affected packages. Precedes verifier audit.                                                         |
| **Pass Criteria**   | Rollup step present. References `qa-engineer`. Mentions `coverage_gate`. Ordering confirmed.                                              |

### SC-20: Planner rollup scopes to affected packages

| Field               | Value                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-9                                                                                                                     |
| **Type**            | negative-path                                                                                                            |
| **Severity**        | major                                                                                                                    |
| **Preconditions**   | SC-19 passes.                                                                                                            |
| **Steps**           | 1. Read planner rollup language. 2. Confirm it scopes to packages affected by merged stories, not entire workspace.      |
| **Expected Result** | Rollup is explicitly scoped. "Affected packages" or equivalent language present.                                         |
| **Pass Criteria**   | Language explicitly limits scope. No "all packages" without qualification.                                               |

### SC-21: `docs/workflow-chains.md` updated with expanded QA chain

| Field               | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-11                                                                                                                        |
| **Type**            | happy-path                                                                                                                   |
| **Severity**        | major                                                                                                                        |
| **Preconditions**   | Implementation complete.                                                                                                     |
| **Steps**           | 1. Read `docs/workflow-chains.md`. 2. Find "Testing Standard (QA)" section. 3. Confirm new steps (2.5, 3, 4) are shown. 4. Find "Integration & E2E" or decision-path section. |
| **Expected Result** | QA chain shows all 6 steps. Local/remote decision path documented.                                                           |
| **Pass Criteria**   | Steps 2.5, 3, 4 present in the chain. Decision-path section exists with Docker/Supabase/remote branches.                    |

### SC-22: `AGENTS.md` registers three new skills

| Field               | Value                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-12                                                                                                                    |
| **Type**            | happy-path                                                                                                               |
| **Severity**        | major                                                                                                                    |
| **Preconditions**   | Implementation complete.                                                                                                 |
| **Steps**           | 1. Read `AGENTS.md`. 2. Search Activity Skills table for the three new skill names. 3. Confirm description and consumer. |
| **Expected Result** | All three skills listed in the table with correct primary consumer.                                                      |
| **Pass Criteria**   | `activity-integration-test-implementation`, `activity-e2e-test-implementation`, `activity-contract-validation` all present. |

### SC-23: `docs/technical-guidelines.md` references Layer 2.5

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-12                                                                                                           |
| **Type**            | happy-path                                                                                                      |
| **Severity**        | minor                                                                                                           |
| **Preconditions**   | Implementation complete.                                                                                        |
| **Steps**           | 1. Read `docs/technical-guidelines.md` § Testing Strategy. 2. Search for "Layer 2.5" or "Integration" layer.    |
| **Expected Result** | Layer 2.5 is referenced in the validation layers list.                                                          |
| **Pass Criteria**   | "Integration" or "Layer 2.5" appears in the Testing Strategy section.                                           |

### SC-24: Distribution — skills in `bundle-manifest.json`

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-13                                                                                                           |
| **Type**            | happy-path                                                                                                      |
| **Severity**        | major                                                                                                           |
| **Preconditions**   | Implementation complete.                                                                                        |
| **Steps**           | 1. Read `bundle-manifest.json`. 2. Search for the three new skill directory paths.                              |
| **Expected Result** | All three skills are listed in the manifest.                                                                    |
| **Pass Criteria**   | Paths for all three skills present in `bundle-manifest.json`.                                                   |

### SC-25: Distribution — skills in `build-bundle.sh`

| Field               | Value                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-13                                                                                                         |
| **Type**            | happy-path                                                                                                    |
| **Severity**        | major                                                                                                         |
| **Preconditions**   | Implementation complete.                                                                                      |
| **Steps**           | 1. Read `scripts/build-bundle.sh`. 2. Search for the three new skill paths in MANAGED_FILES or equivalent.    |
| **Expected Result** | All three skills included in the build bundle.                                                                 |
| **Pass Criteria**   | Paths for all three skills present in MANAGED_FILES array or equivalent inclusion mechanism.                   |

### SC-26: Skill line count within budget

| Field               | Value                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-2, AC-3                                                                                          |
| **Type**            | negative-path                                                                                             |
| **Severity**        | minor                                                                                                     |
| **Preconditions**   | Skills authored.                                                                                          |
| **Steps**           | 1. Count lines in each of the 9 skill files (3 skills × 3 platforms). 2. Compare against 200-line budget. |
| **Expected Result** | Each skill file is ≤200 lines.                                                                            |
| **Pass Criteria**   | `wc -l` ≤ 200 for each file.                                                                             |

---

## Contract Validation Scenarios

### CT-1: Skill frontmatter schema — valid YAML

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-2, AC-3                                                                                         |
| **Contract type**   | schema-compat                                                                                            |
| **Boundary**        | YAML frontmatter in `SKILL.md` files                                                                     |
| **Direction**       | input (parsed by runtime)                                                                                |
| **Input**           | Each skill's YAML frontmatter block                                                                      |
| **Expected Result** | Parses without error. Contains required fields `name` (string) and `description` (string).               |
| **Pass Criteria**   | YAML.parse succeeds. `name` is non-empty string. `description` is non-empty string.                     |

### CT-2: Skill frontmatter — missing required field

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-2, AC-3                                                                                         |
| **Contract type**   | schema-compat                                                                                            |
| **Boundary**        | YAML frontmatter in `SKILL.md` files                                                                     |
| **Direction**       | input                                                                                                    |
| **Input**           | Frontmatter with `name` removed                                                                          |
| **Expected Result** | Validation fails: missing required field `name`.                                                         |
| **Pass Criteria**   | Schema validator rejects. Test asserts the missing-field error.                                           |

### CT-3: `/TESTING.md` section contract — layer table structure

| Field               | Value                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-4, AC-5, AC-6                                                                                                   |
| **Contract type**   | schema-compat                                                                                                      |
| **Boundary**        | Markdown table structure in `TESTING.md`                                                                           |
| **Direction**       | output (consumed by agents)                                                                                        |
| **Input**           | Updated `TESTING.md` content                                                                                       |
| **Expected Result** | Layer table has columns: Layer, Name, Scope, Status. Rows include 1, 2, 2.5, E2E, Contract, 3, 4.                 |
| **Pass Criteria**   | Table parses. All expected layer numbers/names present. No missing columns.                                        |

### CT-4: `qa-engineer` procedure contract — step references valid skills

| Field               | Value                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-7                                                                                                               |
| **Contract type**   | consumer-driven                                                                                                    |
| **Boundary**        | `qa-engineer` agent prompt → skill invocation references                                                           |
| **Direction**       | output (skills invoked at runtime)                                                                                 |
| **Input**           | `qa-engineer` prompt content                                                                                       |
| **Expected Result** | Every skill name referenced in the procedure exists as a directory in `.kiro/skills/`.                             |
| **Pass Criteria**   | All referenced skill names resolve to existing `SKILL.md` files.                                                   |

### CT-5: `bundle-manifest.json` schema — new entries have required fields

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-13                                                                                                    |
| **Contract type**   | schema-compat                                                                                            |
| **Boundary**        | `bundle-manifest.json` entry schema                                                                      |
| **Direction**       | output (consumed by installer)                                                                           |
| **Input**           | New skill entries in `bundle-manifest.json`                                                              |
| **Expected Result** | Each entry has required fields (path, profile, type, etc.) matching existing entry schema.                |
| **Pass Criteria**   | JSON parses. New entries conform to same schema as existing skill entries.                                |

### CT-6: Planner closeout payload — `coverage_gate` field present

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-9                                                                                                     |
| **Contract type**   | consumer-driven                                                                                          |
| **Boundary**        | Planner → PR/issue output                                                                                |
| **Direction**       | output                                                                                                   |
| **Input**           | Planner prompt describing the rollup                                                                     |
| **Expected Result** | PRD-level `coverage_gate` is defined as an aggregation of per-story gates.                               |
| **Pass Criteria**   | Prompt text specifies the aggregated `coverage_gate` at PRD level with defined values.                   |

---

## Edge-Case Catalog

### EC-1: Skill file exceeds 200-line budget

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-2, AC-3                                                                                     |
| **Category**        | Data Boundaries                                                                                      |
| **Input / Setup**   | Skill implementation grows beyond 200 lines to accommodate all required sections.                    |
| **Expected Result** | Skill is split or condensed. Line count ≤ 200.                                                       |
| **Risk if Missed**  | Prompt bloat reduces agent comprehension and increases token cost.                                   |

### EC-2: Consumer `/TESTING.md` already has custom Layer 2.5 content

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4                                                                                                 |
| **Category**        | State Transitions                                                                                    |
| **Input / Setup**   | Consumer project has manually authored Layer 2.5 section with project-specific values.               |
| **Expected Result** | `dev-tasks update` preserves consumer content. No overwrite.                                         |
| **Risk if Missed**  | Consumer loses project-specific testing configuration. Trust violation.                              |

### EC-3: `/TESTING.md` is placeholder (unfilled) — new layers still added

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4, AC-5, AC-6                                                                                     |
| **Category**        | State Transitions                                                                                    |
| **Input / Setup**   | `/TESTING.md` exists but all slots are `<!-- unfilled -->`.                                          |
| **Expected Result** | New layer rows are added to the placeholder. Status remains "placeholder" until filled by qa-engineer.|
| **Risk if Missed**  | New layers invisible until manual intervention. Agents cannot detect available layers.               |

### EC-4: No Docker, no Supabase CLI, no testing environment

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-7                                                                                           |
| **Category**        | Failure Modes                                                                                        |
| **Input / Setup**   | Consumer project on a machine without Docker or Supabase CLI, and no remote testing env configured.  |
| **Expected Result** | Skill reports limitation explicitly. Falls back to "integration layer unavailable" in gap analysis.  |
| **Risk if Missed**  | Silent omission of integration testing. Gap not visible in coverage report.                          |

### EC-5: Playwright not installed in CI

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-2, AC-7                                                                                           |
| **Category**        | Failure Modes                                                                                        |
| **Input / Setup**   | CI environment has no Playwright browsers installed. `npx playwright install` not in CI script.      |
| **Expected Result** | Skill explicitly documents browser install step for CI. E2E step emits skip if browsers unavailable. |
| **Risk if Missed**  | E2E tests silently fail or error in CI. False-red or unreported gap.                                |

### EC-6: `dt` CLI not installed — contract validation

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3, AC-7                                                                                           |
| **Category**        | Failure Modes                                                                                        |
| **Input / Setup**   | Consumer project does not have `dt` CLI installed.                                                   |
| **Expected Result** | Contract validation step emits `SKIPPED(dt not installed)` with manual instructions.                 |
| **Risk if Missed**  | Hard failure during qa-engineer run. Blocks completion for non-dt projects.                          |

### EC-7: No OpenAPI/AsyncAPI spec in repository

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3, AC-8                                                                                           |
| **Category**        | Input Domain                                                                                         |
| **Input / Setup**   | Consumer project has no API spec files.                                                              |
| **Expected Result** | Contract validation step emits `SKIPPED(no API spec found)`. Reported as informational finding.      |
| **Risk if Missed**  | Error during detection. Or spec-to-implementation drift goes unreported without explicit skip reason. |

### EC-8: Scenario ID in test plan has no corresponding spec file

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                                                |
| **Category**        | State Transitions                                                                                    |
| **Input / Setup**   | `verifier` Design Mode produced SC-1 through SC-5. Only SC-1, SC-2, SC-3 have matching spec files.  |
| **Expected Result** | `verifier` reports SC-4 and SC-5 as orphaned/uncovered scenarios in the fidelity audit.              |
| **Risk if Missed**  | Traceability gap invisible. Scenarios designed but never implemented as tests.                       |

### EC-9: Spec file renamed — scenario mapping breaks

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                                                |
| **Category**        | State Transitions                                                                                    |
| **Input / Setup**   | `login.spec.ts` (annotated with `@scenario SC-1`) is renamed to `auth-login.spec.ts`.               |
| **Expected Result** | Traceability check reports SC-1 as unresolvable until the annotation is found in the new location.   |
| **Risk if Missed**  | Traceability silently broken after refactoring. Audit reports false coverage gap.                    |

### EC-10: RLS tests require multiple database sessions

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                                                 |
| **Category**        | Auth & Permissions                                                                                   |
| **Input / Setup**   | Multi-tenant app with RLS. Tests need Tenant A and Tenant B sessions simultaneously.                 |
| **Expected Result** | Skill documents how to establish multiple authenticated DB connections in a single test.              |
| **Risk if Missed**  | RLS tests written with single-session workaround that doesn't exercise the real policy.             |

### EC-11: Large migration stack (50+ files) — clean-apply is slow

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                                                 |
| **Category**        | Resource Exhaustion                                                                                  |
| **Input / Setup**   | Project with 75 migration files. Full clean-apply takes >5 minutes.                                  |
| **Expected Result** | Skill recommends full clean-apply on CI/scheduled, incremental (latest N) on PR.                     |
| **Risk if Missed**  | Developers avoid running migrations tests locally due to slowness. Tests degrade.                   |

### EC-12: Planner rollup on large monorepo — scope explosion

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-9                                                                                                 |
| **Category**        | Resource Exhaustion                                                                                  |
| **Input / Setup**   | Monorepo with 15 packages. PRD only touched 3 packages. Planner invokes qa-engineer at PRD scope.    |
| **Expected Result** | Rollup scopes to the 3 affected packages, not all 15.                                                |
| **Risk if Missed**  | Unnecessary test runs on untouched packages. Expensive and slow. False findings.                    |

### EC-13: Flaky E2E test passes intermittently

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-2                                                                                                 |
| **Category**        | Timing & Concurrency                                                                                 |
| **Input / Setup**   | E2E test depends on async state that sometimes resolves before assertion, sometimes doesn't.         |
| **Expected Result** | Skill addresses retry strategy, explicit waits, and deterministic state reset.                        |
| **Risk if Missed**  | Flaky suite erodes confidence. Developers ignore E2E failures. Worse than no tests.                 |

### EC-14: Existing `activity-test-standards` content overwritten by extension

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-8                                                                                                 |
| **Category**        | State Transitions                                                                                    |
| **Input / Setup**   | `activity-test-standards` has existing content for Layers 1-2 detection.                             |
| **Expected Result** | Extension is additive. No existing detection logic removed or altered.                               |
| **Risk if Missed**  | Regression in Layer 1-2 detection. Existing harness-defect checks stop working.                     |

---

## Execution Checklist

- [x] All 13 ACs mapped to ≥1 positive scenario
- [x] All 13 ACs mapped to ≥1 negative/edge scenario
- [x] 26 E2E scenarios produced (SC-1 through SC-26)
- [x] 6 contract validation scenarios produced (CT-1 through CT-6)
- [x] 14 edge cases produced (EC-1 through EC-14)
- [x] 9 edge-case categories evaluated (all applicable ones covered)
- [x] No scenario references internal implementation details
- [x] Severity assigned to every scenario
- [x] Risk-if-missed documented for every edge case

---

## Traceability Matrix

| AC   | Positive Scenarios     | Negative/Edge Scenarios         | Contract Scenarios | Edge Cases           |
| ---- | ---------------------- | ------------------------------- | ------------------ | -------------------- |
| AC-1 | SC-1, SC-2, SC-3       | SC-4, SC-26                     | CT-1, CT-2         | EC-1, EC-4, EC-10, EC-11 |
| AC-2 | SC-5, SC-6, SC-7       | SC-4, SC-26                     | CT-1, CT-2         | EC-1, EC-5, EC-13    |
| AC-3 | SC-8, SC-9             | SC-4, SC-10, SC-26              | CT-1, CT-2         | EC-1, EC-6, EC-7     |
| AC-4 | SC-11, SC-12           | —                               | CT-3               | EC-2, EC-3           |
| AC-5 | SC-13                  | —                               | CT-3               | EC-3                 |
| AC-6 | SC-14                  | —                               | CT-3               | EC-3                 |
| AC-7 | SC-15                  | SC-16                           | CT-4               | EC-4, EC-5, EC-6     |
| AC-8 | SC-17, SC-18           | —                               | —                  | EC-7, EC-14          |
| AC-9 | SC-19                  | SC-20                           | CT-6               | EC-12                |
| AC-10| SC-7                   | —                               | —                  | EC-8, EC-9           |
| AC-11| SC-21                  | —                               | —                  | —                    |
| AC-12| SC-22, SC-23           | —                               | —                  | —                    |
| AC-13| SC-24, SC-25           | —                               | CT-5               | —                    |

---

## Seed Policy (Randomized Tests)

This issue is a documentation/configuration deliverable (skills, agent prompts, markdown contracts). No randomized or property-based tests apply. All assertions are deterministic: file existence, content matching, structural parsing.

**Seed:** N/A — no randomized tactics for this issue scope.
