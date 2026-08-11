# User Stories: Evidence-Driven Development Loop

## Changelog

| Version | Date       | Summary         | Author           |
| ------- | ---------- | --------------- | ---------------- |
| 1.0     | 2026-07-20 | Initial version | product-engineer |

## Source Documents

- PRD: `docs/requirements/prd-evidence-driven-development-loop.md`
- Specification: `workstream/specification-evidence-driven-development-loop.md` (v1.1)

## Sequencing Rationale

Stories are ordered so that every dependency lands before the story that consumes it. The evidence schema and reporting skill (S-001) is the foundation every capability skill and the developer loop write through. The parity script (S-002) ships early, in warn-only mode per spec §8.4, so it can observe (without blocking) every subsequent cross-platform edit in this feature. The three capability skills (S-003, S-004, S-005) are independent of each other and can be built in any order or in parallel. The verifier blocking policy (S-006) and plan capability tagging (S-007) must land before the developer loop (S-008) consumes them. The planner story (S-009) depends on the developer loop existing. Documentation/registry (S-010) and issue supersession (S-011) close out the release.

```text
S-001 (foundation)
  ├── S-002 (parity, warn-only — observes all others)
  ├── S-003, S-004, S-005 (capability skills — parallelizable)
  ├── S-006 (verifier blocking policy) ──┐
  └── S-007 (plan capability tagging) ───┼── S-008 (developer + implement loop) ── S-009 (planner)
                                                                                          │
                                                                        S-010 (docs/registry, breaking-change note)
                                                                        S-011 (supersede #12, #15)
```

---

### Story S-001: Evidence Schema and Evidence-Reporting Skill

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** None (foundation story)

#### User Story

As a `developer` agent implementing a behavioral task,
I want a single, versioned schema and skill for recording validation evidence,
So that every capability (browser, database, mutation) reports results in a consistent, sanitized, traceable format that reviewers and `verifier` can rely on.

#### Context

Every other capability skill in this feature (S-003, S-004, S-005) and the bounded loop (S-008) write evidence through this contract. Building it first prevents each capability skill from inventing its own ad hoc result format. This story also introduces the mutation-baseline schema convention consumed later by S-005.

#### Acceptance Criteria

- [ ] `docs/validation/evidence.schema.json` exists, is valid JSON Schema, and defines exactly the fields in spec §5.2 (`schema_version`, `acceptance_id`, `check_id`, `capability`, `implementation`, `environment`, `result`, `run_id` required; `evidence_uri`, `limitations`, `approval_reference` optional).
- [ ] The `result` field enum is exactly `pass | fail | blocked | unavailable | incomplete | approved-exception` (spec §13).
- [ ] `docs/validation/evidence-schema.md` documents each field, the six result states, and one worked example per state.
- [ ] `docs/validation/mutation-baseline.schema.json` exists per spec §5.3, with `schema_version`, `tool`, `scope`, `mutation_score`, `killed`, `survived`, `timeout`, `no_coverage`, `commit`, `date`, `excluded_paths`.
- [ ] `activity-evidence-reporting` skill exists in all three trees (`.github/skills/`, `.claude/skills/`, `.kiro/skills/`) and documents: how to validate a record against the schema, the sanitization step (strip secret-shaped strings, flag suspected personal data for human review — never silent auto-redaction), the CI-artifact-first / PR-comment-fallback publication rule, and that it is the _only_ skill permitted to write/validate this schema (spec §5.2).
- [ ] The skill explicitly states: a `pass` result MUST NOT be reported when a fallback degraded required coverage — that case is `incomplete` (spec §13, PRD FR-39 through FR-42).
- [ ] The skill states `docs/validation/` and mutation baselines are consumer-owned, created on first use, and are NOT added to `bundle-manifest.json`'s `managed_paths` (spec §4.3 note, §15).
- [ ] `bundle-manifest.json` is **not** modified to add `docs/validation/` as a managed path (negative check — confirms the exclusion).

#### Business Rules

- Evidence quality determines completeness, not tool invocation alone (PRD Business Rules).
- No skill may claim `pass` when required evidence is missing or degraded.
- Secrets, credentials, and production payloads must never appear in a published evidence record.

#### Technical Notes

- Follow `docs/technical-guidelines.md` §"API Design Standards" for schema versioning and error-state distinctions.
- Reference spec §5.2, §5.3, §12 ("Security Implementation"), §13 ("Error Handling & Logging").
- Keep the schema tool-neutral — no Playwright/Supabase/Stryker-specific fields at this layer; tool-specific detail belongs in `implementation`/`limitations` free-text fields.

#### Testing Requirements

- **Unit Tests:** Not applicable (no application runtime); use schema validation instead.
- **Integration Tests:** Validate at least 3 example evidence records (one per result state category: pass, incomplete, blocked) against `evidence.schema.json` using a JSON Schema validator (e.g., `ajv` via `npx`), and validate 1 example mutation-baseline record against `mutation-baseline.schema.json`.
- **Manual/UI Testing:** Not applicable — no UI.
- **Edge-Case Matrix:** missing required field (must fail validation); unknown `result` value (must fail validation); record with only optional fields absent (must pass).
- **Acceptance-Criteria Mapping:** AC1–AC4 → schema file review + `ajv` validation run; AC5–AC7 → skill content review (×3 trees); AC8–AC9 → `bundle-manifest.json` diff review.
- **Execution Commands:** `npx --yes ajv-cli validate -s docs/validation/evidence.schema.json -d <fixture>.json`; `./scripts/format.sh --check`.

#### Migration Requirements

Not applicable — no schema/data-model change to application data; this story only adds a JSON Schema _artifact convention_, not a database migration.

#### Implementation Steps

1. Draft `docs/validation/evidence.schema.json` per spec §5.2.
2. Draft `docs/validation/mutation-baseline.schema.json` per spec §5.3.
3. Write `docs/validation/evidence-schema.md` with field documentation and worked examples.
4. Write `activity-evidence-reporting/SKILL.md` for `.kiro/skills/`, then port to `.github/skills/` and `.claude/skills/` preserving platform frontmatter conventions.
5. Create 3 fixture evidence records and 1 fixture mutation-baseline record; validate all with `ajv-cli`.
6. Confirm `bundle-manifest.json` is unchanged for `docs/validation/` (only the skill directories are added, per S-010's registry story — do not add managed paths here).
7. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `docs/validation/evidence.schema.json` - Evidence record JSON Schema
- `docs/validation/mutation-baseline.schema.json` - Mutation baseline JSON Schema
- `docs/validation/evidence-schema.md` - Field documentation and examples
- `.kiro/skills/activity-evidence-reporting/SKILL.md` - New skill
- `.github/skills/activity-evidence-reporting/SKILL.md` - New skill
- `.claude/skills/activity-evidence-reporting/SKILL.md` - New skill

#### Definition of Done Checklist

- [ ] Code/content implemented per technical guidelines
- [ ] Fixture-based schema validation tests written and passing
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three platform trees
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable (documented above)
- [ ] Pull Request created and merged

---

### Story S-002: Cross-Platform Parity Check (Warn-Only)

**Priority:** Medium
**Estimated Size:** S
**Dependencies:** None

#### User Story

As a `dev-tasks` maintainer,
I want a script and CI job that detects when `.github/`, `.claude/`, and `.kiro/` drift out of behavioral parity,
So that later stories in this feature (and future changes) don't silently ship an inconsistent agent contract on one platform.

#### Context

Per spec §8.4, this ships as a **non-blocking warning** for its first release — the check itself is unproven, and a false-positive hard gate would block unrelated PRs. Building it early (before S-003–S-010 land) means it can observe every subsequent cross-platform edit in this feature, even though it cannot fail the PR yet.

#### Acceptance Criteria

- [ ] `scripts/check-platform-parity.sh` exists, is executable, and compares the file-set (not necessarily byte-identical content) of `.github/agents/`, `.claude/agents/` (+ `.claude/commands/`), `.kiro/agents/` for a maintainer-provided list of "should exist on all three" component names.
- [ ] The script performs the same check for skills (`*/SKILL.md` directories) across the three `skills/` trees.
- [ ] The script exits `0` even when it finds mismatches; mismatches are printed as `WARN:` lines to stdout/stderr, not as failures.
- [ ] `.github/workflows/parity-check.yml` exists, triggers on pull requests that modify paths under `.github/agents/**`, `.github/skills/**`, `.claude/agents/**`, `.claude/commands/**`, `.claude/skills/**`, `.kiro/agents/**`, `.kiro/skills/**`, and runs the script.
- [ ] The workflow job is configured so its outcome does not block PR merge (e.g., `continue-on-error: true` or equivalent), consistent with spec §8.4's warn-only decision.
- [ ] The script and workflow are **not** added to `bundle-manifest.json` `managed_paths` (maintainer-only tooling, not distributed to consumers, per spec §4.3 row 13).
- [ ] Running the script against the current (pre-feature) repository state produces output without erroring, establishing a working baseline before S-003–S-010 add new components.

#### Business Rules

- The parity check is advisory only for this release; promotion to a hard gate is an explicit future decision, not automatic (spec §8.4).
- The script must never be included in the distributed consumer bundle.

#### Technical Notes

- Follow the existing `dev-tasks.sh`/`scripts/format.sh` shell conventions (`set -euo pipefail`, stderr for diagnostics).
- Reference spec §4.3 row 13/14, §8.4, §14 ("Testing Strategy" item 2), §16 (risk: cross-platform drift).
- Keep the comparison logic simple (file/directory presence, not deep content diff) for this first version; deeper semantic parity is out of scope here.

#### Testing Requirements

- **Unit Tests:** Not applicable (shell script; use scenario dry-runs instead).
- **Integration Tests:** Run the script against a temporary fixture tree with an intentionally introduced mismatch (e.g., a skill present in `.kiro/skills/` but missing from `.claude/skills/`) and confirm it reports the mismatch with exit code `0`.
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** no mismatches (clean pass, exit 0, no WARN lines); one missing component; one extra component present only in one tree.
- **Acceptance-Criteria Mapping:** AC1–AC3 → fixture dry-run; AC4–AC5 → workflow YAML review + a test PR touching a watched path; AC6 → `bundle-manifest.json` diff review; AC7 → baseline run against current `main`.
- **Execution Commands:** `./scripts/check-platform-parity.sh`; `./scripts/format.sh --check`.

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Write `scripts/check-platform-parity.sh` with a maintained list of expected shared components (agents, skills).
2. Test it against the current repository state (should run clean or show only pre-existing, documented mismatches).
3. Add a synthetic fixture-based test scenario (temp directories) to confirm mismatch detection.
4. Write `.github/workflows/parity-check.yml` with path-scoped triggers and non-blocking configuration.
5. Open a throwaway test PR touching a watched path to confirm the workflow triggers and does not block merge.
6. Document the warn-only status and promotion criteria in the script's header comment.

#### Files to Create/Modify

- `scripts/check-platform-parity.sh` - New parity-check script
- `.github/workflows/parity-check.yml` - New CI job (non-blocking)

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Fixture-based scenario tests written and passing
- [ ] Quality gates passing (`format:check`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable
- [ ] Pull Request created and merged

---

### Story S-003: Web Runtime Verification Capability

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As a `developer` agent implementing a web-facing behavioral change,
I want a skill that runs the project's committed E2E tests as the source of truth and uses Chrome DevTools MCP (or an equivalent) only for supplementary diagnosis,
So that browser behavior is validated deterministically, with runtime evidence available when a check fails or needs deeper inspection.

#### Context

This is the first of three capability skills. It implements the "Browser runtime" row of the capability contract table (spec §6) and PRD FR-10 through FR-15.

#### Acceptance Criteria

- [ ] `activity-web-runtime-verification` skill exists in all three trees, documents required inputs (AC list, changed routes/components, project E2E command) and required outputs (evidence record(s) via `activity-evidence-reporting`, diagnostic artifacts) per spec §6.
- [ ] The skill states committed Playwright-style E2E tests are authoritative for repeatable browser behavior; live-browser tooling (e.g., Chrome DevTools MCP) is explicitly scoped to diagnosis, exploratory checks, console/network inspection, responsive/accessibility observation, and evidence capture — never a substitute for a feasible deterministic E2E test (PRD FR-10, FR-13).
- [ ] The skill defines the fallback path: if no live-browser MCP is configured, fall back to project-native E2E execution and trace/artifact capture only, and mark browser-runtime-diagnosis coverage `incomplete` in the evidence record's `limitations` field (PRD FR-15, spec §6, §9).
- [ ] The skill defines E2E confidence criteria beyond count/coverage: acceptance-criterion mapping, meaningful assertions on observable outcomes, positive/negative paths, state transitions, permissions, and relevant empty/error states (PRD FR-11).
- [ ] The skill states it MUST NOT run destructive or uncontrolled browser automation against production (`docs/technical-guidelines.md` Security Requirements).
- [ ] Every call documents the browser-evidence risk tiers from PRD open-question resolution: low risk → deterministic E2E result only; medium risk → E2E result + screenshot/console evidence on failure; high risk → trace + console/network summary + configured browser matrix.
- [ ] The skill records the tested route/workflow, environment, AC ids, deterministic test result, runtime observations, and artifact links in the evidence record (PRD FR-14).

#### Business Rules

- Deterministic committed tests outrank ephemeral runtime observations covering the same behavior.
- Live-browser evidence never substitutes for a feasible deterministic E2E test.

#### Technical Notes

- Reference spec §6 (capability contract), §9 (Chrome DevTools MCP integration/fallback), `docs/technical-guidelines.md` §"Testing Strategy" (E2E confidence criteria).
- The skill should be explicit that it calls `activity-evidence-reporting` for all evidence output — it does not define its own result schema.
- No installation or MCP configuration logic belongs in this skill (capability _detection_ only, per PRD FR-37/38).

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Dry-run walkthrough using a fixture AC list and a fixture Playwright config: confirm the skill's documented steps produce the correct evidence-record shape (schema from S-001) for a "pass," an "incomplete" (no MCP configured), and a risk-tiered evidence example.
- **Manual/UI Testing:** Not applicable (skill document, not application code).
- **Edge-Case Matrix:** MCP unavailable; project has no E2E suite configured at all (must report `unavailable`, not `pass`); high-risk change with full evidence tier.
- **Acceptance-Criteria Mapping:** AC1–AC3 → skill content review; AC4 → fixture dry-run producing `incomplete` evidence; AC5 → security-review checklist; AC6 → risk-tier fixture walkthrough; AC7 → evidence-record fixture validated against S-001's schema.
- **Execution Commands:** `npx --yes ajv-cli validate -s docs/validation/evidence.schema.json -d <fixture-evidence>.json`; `./scripts/format.sh --check`.

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Draft the skill for `.kiro/skills/activity-web-runtime-verification/SKILL.md`, covering inputs/outputs, authoritative-E2E rule, MCP diagnosis scope, fallback, risk tiers, and evidence recording.
2. Port to `.github/skills/` and `.claude/skills/` with platform-appropriate frontmatter.
3. Build 3 fixture dry-run scenarios (pass / incomplete-no-MCP / high-risk-full-evidence) and validate resulting evidence records against `evidence.schema.json`.
4. Cross-check content against spec §6 row 1 and PRD FR-10–FR-15 for completeness.
5. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `.kiro/skills/activity-web-runtime-verification/SKILL.md` - New skill
- `.github/skills/activity-web-runtime-verification/SKILL.md` - New skill
- `.claude/skills/activity-web-runtime-verification/SKILL.md` - New skill

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Fixture dry-run scenarios written and passing schema validation
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three trees
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable
- [ ] Pull Request created and merged

---

### Story S-004: Supabase Validation Capability

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As a `developer` agent implementing a Supabase-backed change,
I want a skill that defaults to scoped, read-only Cloud inspection and requires explicit per-operation approval for every write, migration, or destructive action,
So that Supabase Cloud (the primary case) and production-only projects can be validated safely, without risking uncontrolled writes.

#### Context

Implements the "Database/Supabase" row of the capability contract (spec §6) and PRD FR-23 through FR-31. This is the highest-risk capability skill because it can touch a real cloud environment, including production-only setups explicitly in scope per the approved PRD.

#### Acceptance Criteria

- [ ] `activity-supabase-validation` skill exists in all three trees, documents required inputs (environment classification, target project ref, migration artifact if any) and required outputs (evidence record(s), migration approval record, post-apply verification) per spec §6.
- [ ] The skill requires classifying the target project as **non-production cloud**, **production-only**, or **local/ephemeral** _before_ running any check (PRD FR-24).
- [ ] The skill defaults Supabase MCP (or equivalent cloud tooling) to project-scoped, least-privilege, **read-only** access (PRD FR-25, spec §7, §12).
- [ ] The skill implements the approval state machine from spec §7 (`Requested → Approved/Declined → Executed → Verified/Failed`) for every write, migration apply, destructive action, privilege change, or security-sensitive configuration change, and records `approval_reference` in the evidence record (PRD FR-26).
- [ ] The skill requires, for every migration-bearing change: a version-controlled migration artifact, impact/rollback notes, approval evidence, and post-apply verification (PRD FR-27).
- [ ] The skill documents database validation coverage guidance (schema contracts, constraints, functions, triggers, RLS, roles/permissions, migrations) using pgTAP or an equivalent project-native mechanism (PRD FR-28).
- [ ] The skill requires cloud validation data to be synthetic, minimized, isolated where possible, and cleaned up, and states sensitive production data MUST NOT be attached to evidence artifacts (PRD FR-29).
- [ ] For **production-only** classification, the skill keeps automated inspection read-only by default and explicitly redirects destructive, failure-mode, fuzz, or mutation-style checks to local, mocked, or isolated execution (PRD FR-30).
- [ ] The skill recommends (not requires) introducing a separate development/staging project as risk/maturity increases, without making it a prerequisite for use (PRD FR-31).
- [ ] The skill MUST refuse to execute destructive scenarios when environment classification resolves to `production` (spec §12; cross-references S-005 for the mutation-testing refusal rule using the same classification).
- [ ] Local/ephemeral mode documents Supabase CLI usage (migrations, pgTAP, Edge Function checks, optional local-stack validation) as the deterministic alternative when Docker/CLI are available.

#### Business Rules

- Production convenience never removes approval, least-privilege, migration, rollback, sanitization, or audit requirements.
- An agent cannot approve its own production operation.
- Approval for one operation is not standing approval for later operations.

#### Technical Notes

- Reference spec §6 row 2, §7 (approval state machine), §9 (Supabase MCP/CLI integration + fallback), §12 (security), `docs/technical-guidelines.md` §"Data and Database Guidelines."
- The skill only _documents_ CLI/MCP usage patterns and the approval gate — it must not embed real credentials, project refs, or perform installation.

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Dry-run walkthroughs for all three environment classifications (non-production cloud, production-only, local/ephemeral), each producing a correctly shaped evidence record; a dry-run of the approval state machine confirming a write cannot proceed to `Executed` without a recorded `approval_reference`.
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** production-only project + attempted destructive check (must refuse); migration with no rollback notes (must block per business rule); approval declined (must halt, no retry without new approval); local stack unavailable + cloud-only fallback.
- **Acceptance-Criteria Mapping:** AC1–AC2 → skill content + classification-step review; AC3–AC4 → approval state-machine fixture dry-run; AC5 → migration-lifecycle fixture; AC6 → pgTAP guidance review; AC7 → data-sanitization checklist review; AC8 → production-refusal fixture dry-run; AC9 → content review; AC10 → refusal-rule cross-check with S-005.
- **Execution Commands:** `npx --yes ajv-cli validate -s docs/validation/evidence.schema.json -d <fixture-evidence>.json`; `./scripts/format.sh --check`.

#### Migration Requirements

Not applicable to this story's own delivery (the story documents a migration-safety _procedure_ for consumers; it does not itself introduce a schema/data-model change to `dev-tasks`).

#### Implementation Steps

1. Draft the skill for `.kiro/skills/activity-supabase-validation/SKILL.md`: environment classification step, read-only default, approval state machine, migration lifecycle, pgTAP guidance, data sanitization, production refusal rule, local/CLI fallback.
2. Port to `.github/skills/` and `.claude/skills/`.
3. Build 3 fixture dry-runs (one per environment classification) and one approval-state-machine fixture (declined path + approved path).
4. Cross-check content against spec §6 row 2, §7, §12 and PRD FR-23–FR-31 for completeness.
5. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `.kiro/skills/activity-supabase-validation/SKILL.md` - New skill
- `.github/skills/activity-supabase-validation/SKILL.md` - New skill
- `.claude/skills/activity-supabase-validation/SKILL.md` - New skill

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Fixture dry-run scenarios (all 3 environment classifications + approval state machine) written and passing
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three trees
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable to this story's delivery (documented above)
- [ ] Pull Request created and merged

---

### Story S-005: Mutation Testing Capability

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As a `developer` agent responsible for test-suite quality,
I want a skill that establishes a mutation-testing baseline and then detects regressions in changed scope without inventing a numeric threshold the project hasn't approved,
So that weak tests are surfaced without making early adoption impractical or arbitrarily gating every pull request.

#### Context

Implements the "Mutation" row of the capability contract (spec §6), the mutation gate logic in spec §8.3 (including the resolved "any net decrease" regression rule), and PRD FR-16 through FR-22.

#### Acceptance Criteria

- [ ] `activity-mutation-testing` skill exists in all three trees, documents required inputs (test command, scope, existing baseline if any) and required outputs (mutation run result, updated/compared baseline, evidence record(s)) per spec §6.
- [ ] The skill's initial reference profile is JavaScript/TypeScript (Stryker-compatible), documented as adaptable to other frameworks that honor the same baseline schema (PRD FR-16).
- [ ] The skill's baseline-establishment step: on first run, execute mutation analysis, write `mutation-baseline.schema.json` per S-001, and report only — never blocking on first run (PRD FR-17, spec §8.3 step 1).
- [ ] The skill's regression rule, once a baseline exists, is exactly "any net decrease in mutation score within changed scope" with **no default epsilon/tolerance** — this is a detection rule, not a numeric pass/fail threshold (spec §8.3 step 3, resolved in spec v1.1). A regression is reported as `Minor` drift by default; the skill documents how a project MAY opt in to `Major` classification via its own configuration.
- [ ] The skill documents the preferred mature policy: incremental/changed-code mutation analysis on pull requests, with full-suite runs scheduled or risk-triggered (PRD FR-19).
- [ ] The skill states mutation thresholds are project-configurable and MUST NOT be invented by an agent when the project has not approved one (PRD FR-20).
- [ ] The skill documents that surviving mutants in project-tagged "critical business logic" require one of: a stronger test, a documented equivalent/unviable classification, or a reviewed exception (PRD FR-21).
- [ ] The skill states it MUST NOT target production data or run against production infrastructure, and MUST refuse when environment classification (shared with S-004) resolves to `production` (PRD FR-22, spec §12).
- [ ] The skill documents the default single-aggregated-baseline-file convention with a per-run `scope` value (spec §5.3, §17 Q3 resolution), and flags per-package monorepo baselines as an unresolved extension point requiring revisit before any monorepo consumer relies on it.

#### Business Rules

- No agent invents a numeric mutation threshold that has not been approved by the project.
- Mutation testing never targets production data or infrastructure.
- A regression is a detection signal (Minor drift by default), not an automatic hard failure, unless the project explicitly opts into stricter classification.

#### Technical Notes

- Reference spec §5.3, §6 row 3, §8.3, §11 (performance: changed-files scope default), §12, §17 Q1/Q3 resolutions.
- Keep the skill's baseline read/write logic aligned exactly with the schema from S-001 — do not redefine baseline fields locally.

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Dry-run walkthrough for (a) no-baseline-exists (must produce baseline + report-only, non-blocking), (b) baseline-exists-no-regression (pass), (c) baseline-exists-with-regression (Minor drift, non-blocking by default), (d) production-environment-classification (must refuse to run).
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** first run ever (no baseline file present); tied score (no net decrease — must not flag regression); project-configured `Major` opt-in present (must escalate classification); critical-business-logic path with a surviving mutant and no exception on file (must flag per FR-21).
- **Acceptance-Criteria Mapping:** AC1–AC2 → skill content review; AC3 → baseline-establishment fixture; AC4 → regression-detection fixture (tied score + one-mutant-decrease cases); AC5 → content review of scheduled/incremental policy; AC6 → content review confirming no invented threshold; AC7 → critical-path fixture; AC8 → production-refusal fixture; AC9 → baseline schema cross-check against S-001.
- **Execution Commands:** `npx --yes ajv-cli validate -s docs/validation/mutation-baseline.schema.json -d <fixture-baseline>.json`; `./scripts/format.sh --check`.

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Draft the skill for `.kiro/skills/activity-mutation-testing/SKILL.md`: JS/TS reference profile, baseline establishment, regression rule (any net decrease, no epsilon), incremental-vs-full policy, threshold non-invention rule, critical-path exception handling, production refusal, monorepo caveat.
2. Port to `.github/skills/` and `.claude/skills/`.
3. Build 4 fixture dry-runs per the edge-case matrix above; validate baseline fixtures against `mutation-baseline.schema.json`.
4. Cross-check content against spec §5.3, §8.3, §17 resolutions and PRD FR-16–FR-22.
5. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `.kiro/skills/activity-mutation-testing/SKILL.md` - New skill
- `.github/skills/activity-mutation-testing/SKILL.md` - New skill
- `.claude/skills/activity-mutation-testing/SKILL.md` - New skill

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Fixture dry-run scenarios (all 4 edge cases) written and passing schema validation
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three trees
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable
- [ ] Pull Request created and merged

---

### Story S-006: Verifier Blocking Drift Policy and Capability Requirements

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** S-001

#### User Story

As a reviewer relying on the `verifier` agent's fidelity audit,
I want critical or major unintended drift to block PR readiness, with an explicit resolution path, instead of being purely informational,
So that a pull request cannot be marked ready while known-incorrect delivered behavior remains unresolved.

#### Context

This is the specification's core policy change (spec §8.2) and the most consumer-visible breaking change in this feature (spec §15). It replaces the current unconditional "drift is always non-blocking" language in `verifier`'s agent contract (and the matching statements in `developer.md`/`AGENTS.md`, handled by S-008/S-010 respectively) with the classification-driven blocking policy. It also extends `activity-drift-reconciliation` to implement the `HumanGate` and `NonBlocking`-deferral states from the new drift state machine, and extends `verifier` Design Mode to specify per-AC capability requirements (browser/database/mutation) that feed S-007's plan tagging and S-008's loop.

#### Acceptance Criteria

- [ ] `verifier.agent.md` (and `.claude`/`.kiro` equivalents) state the blocking policy exactly as the state machine in spec §8.2: `Detected → Classified → {Blocking | NonBlocking | HumanGate} → Resolved`, with `Blocking` triggered when `impact ∈ {Critical, Major}` AND `intent ∈ {Unintended, Undetermined}` (PRD FR-43, FR-44, FR-47).
- [ ] The agent contract states `Minor` drift MAY be non-blocking only when impact, owner, rationale, and a linked follow-up issue are recorded (PRD FR-45).
- [ ] The agent contract states `Intended` drift MUST require explicit human confirmation and a corresponding requirement/specification changelog update before it can reach `Resolved` (PRD FR-46).
- [ ] The agent contract states `Undetermined` drift MUST NOT be treated as a pass and remains unresolved until classified, fixed, or explicitly routed to a human decision (PRD FR-47).
- [ ] The **prior unconditional** "drift is always non-blocking" language is fully removed (not left as a contradicting duplicate) from `verifier.agent.md` in all three trees (spec §14 item 4).
- [ ] The fidelity report's mandatory sections (spec Report Structure) are updated so the drift catalog states, per item, whether it is blocking and which resolution path applies (fix implementation / fix test / approved intent change / deferred minor / added evidence — PRD FR-48).
- [ ] Verifier **Design Mode** now specifies, per acceptance criterion, which capability categories (browser-runtime, database/Supabase, mutation, manual, or none) are required, consistent with the capability contract table in spec §6 (PRD FR-1–FR-4, spec component inventory row 7).
- [ ] `activity-drift-reconciliation` is extended to explicitly implement: (a) the `HumanGate` state for `Intended` drift, requiring an explicit human-confirmation gate before any PRD/spec changelog write-back (already partially true — must now be tied to the new state machine terminology); (b) the `NonBlocking` deferral state for eligible `Minor` drift, requiring a linked follow-up issue.
- [ ] The audit gate's existing non-blocking guarantee is scoped correctly: the audit _running_ and posting a summary remains mandatory and non-skippable regardless of drift (unchanged), but the _presence of blocking drift_ now prevents PR readiness until resolved (this distinction must be stated explicitly to avoid ambiguity with the pre-existing "audit is non-blocking to completion" language).

#### Business Rules

- A blocked state is preferable to a false pass.
- An agent cannot approve its own intentional requirement change.
- Undetermined drift can never be silently reclassified as success.

#### Technical Notes

- Reference spec §8.2, §4.1 (verifier's role in the policy/mechanism split), `docs/technical-guidelines.md` §"Blocking policy and drift resolution."
- This story only edits `verifier` and `activity-drift-reconciliation`. It intentionally does NOT edit `developer.md`/`implement` (that's S-008) — coordinate wording so both stories converge on identical state names (`Blocking`, `NonBlocking`, `HumanGate`, `Resolved`).

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Manual policy-behavior review (per spec §14 item 4) confirming no contradicting non-blocking statement remains; a fixture fidelity report walkthrough for one Critical/Unintended item (must show `Blocking`) and one Minor item with owner+issue link (must show `NonBlocking`).
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** Undetermined intent + Critical impact (must be `Blocking`, not silently passed); Intended + Critical impact (must route to `HumanGate`, not auto-block or auto-pass); Minor drift with no owner/issue link (must NOT qualify for `NonBlocking` — flag as a gap).
- **Acceptance-Criteria Mapping:** AC1–AC4 → agent-contract text review against spec §8.2 state machine; AC5 → grep-based review confirming old language removed in all 3 trees; AC6 → fidelity-report template review; AC7 → Design Mode capability-requirements review; AC8 → `activity-drift-reconciliation` content review; AC9 → side-by-side review of audit-mandatory vs. blocking-drift language.
- **Execution Commands:** `./scripts/format.sh --check`; `grep -rn "non-blocking" .github/agents/verifier.agent.md .claude/agents/verifier.md .kiro/agents/verifier.md` (manual review aid, not a pass/fail gate by itself).

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Update `.kiro/agents/verifier.md`: replace unconditional non-blocking language with the spec §8.2 state machine; add Design Mode capability-requirements step; update fidelity report structure and `activity-drift-reconciliation` cross-references.
2. Port the same edits to `.github/agents/verifier.agent.md` and `.claude/agents/verifier.md` (+ `.claude/commands/verifier-design.md`/`verifier-audit.md` where invocation inputs change).
3. Update `.kiro/skills/activity-drift-reconciliation/SKILL.md` (and `.github`/`.claude` equivalents) to implement `HumanGate` and `NonBlocking` deferral explicitly.
4. Run the grep-based review across all three trees to confirm the old unconditional language is fully removed, not duplicated.
5. Build the two fixture fidelity-report walkthroughs (Blocking, NonBlocking) described in Testing Requirements.
6. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `.kiro/agents/verifier.md` - Edit: blocking policy, capability requirements
- `.github/agents/verifier.agent.md` - Edit: same
- `.claude/agents/verifier.md` - Edit: same
- `.claude/commands/verifier-design.md` - Edit: capability requirements reference (if invocation inputs change)
- `.claude/commands/verifier-audit.md` - Edit: blocking policy reference (if invocation inputs change)
- `.kiro/skills/activity-drift-reconciliation/SKILL.md` - Edit: HumanGate/NonBlocking states
- `.github/skills/activity-drift-reconciliation/SKILL.md` - Edit: same
- `.claude/skills/activity-drift-reconciliation/SKILL.md` - Edit: same

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Fixture fidelity-report walkthroughs written and passing
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three trees, terminology consistent
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable
- [ ] Pull Request created and merged

---

### Story S-007: Plan Instruction Capability Tagging

**Priority:** High
**Estimated Size:** S
**Dependencies:** S-006

#### User Story

As a `developer` agent about to execute a task list,
I want each sub-task tagged with the capability categories it requires (browser, database, mutation, manual, none),
So that the bounded self-verification loop (S-008) knows which validation stages to run without re-deriving that from the acceptance criteria every time.

#### Context

Implements spec §4.1's row for the `plan` instruction/skill: capability tagging of tasks so `implement` knows which loop stages apply. Depends on S-006 because verifier Design Mode is the primary source of per-AC capability requirements when a test plan exists; `plan` must fall back to deriving tags from acceptance criteria directly when no test plan exists.

#### Acceptance Criteria

- [ ] `plan.instructions.md` (and `.claude`/`.kiro` equivalents) require each generated sub-task that verifies an acceptance criterion to carry a capability tag from the closed set `{browser, database, mutation, manual, none}` (one or more may apply).
- [ ] When a `verifier` Design Mode test plan exists (`/workstream/test-plan-*.md`), the tags MUST be sourced from its per-AC capability requirements (S-006); when no test plan exists, tags MUST be derived directly from the acceptance criteria text, with a documented conservative default of `manual` when the required capability is ambiguous.
- [ ] The task list output format example is updated to show a capability tag annotation per verification sub-task (e.g., `- [ ] 1.x Verify Acceptance Criterion: [Criterion] (capability: browser)`).
- [ ] The instruction states capability tags are advisory routing information for `implement`, not a new blocking gate by themselves — a missing/incorrect tag does not itself constitute drift.

#### Business Rules

- Capability tagging must never invent a required capability beyond what the AC or test plan states.
- Ambiguous capability requirements default to `manual`, never silently to `none`.

#### Technical Notes

- Reference spec §4.1 row 2, PRD FR-1–FR-4.
- Coordinate the tag vocabulary (`browser | database | mutation | manual | none`) exactly with S-006's Design Mode output and S-008's loop-stage selection so all three stories use identical terms.

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Dry-run: generate a fixture task list from a fixture story with a known test plan (tags sourced from plan) and one without a test plan (tags derived from AC text, ambiguous case defaults to `manual`).
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** AC with no clear capability signal (must default to `manual`, not `none`); AC covering both browser and database behavior (must carry both tags).
- **Acceptance-Criteria Mapping:** AC1–AC2 → fixture task-list dry-run (with and without test plan); AC3 → output-format example review; AC4 → instruction text review confirming tags are advisory only.
- **Execution Commands:** `./scripts/format.sh --check`.

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Update `.kiro/steering/plan.md` output format and conversion guidelines to add capability tagging per sub-task.
2. Port to `.github/instructions/plan.instructions.md` and `.claude/skills/plan/SKILL.md`.
3. Build the two fixture dry-runs (with/without test plan) described in Testing Requirements.
4. Confirm tag vocabulary matches S-006 and S-008 exactly.
5. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `.kiro/steering/plan.md` - Edit: capability tagging
- `.github/instructions/plan.instructions.md` - Edit: same
- `.claude/skills/plan/SKILL.md` - Edit: same

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Fixture dry-run scenarios written and passing
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three trees
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable
- [ ] Pull Request created and merged

---

### Story S-008: Bounded Self-Verification Loop (Developer + Implement)

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** S-001, S-003, S-004, S-005, S-006, S-007

#### User Story

As a `developer` agent implementing a behavioral sub-task,
I want a bounded, retry-limited inner loop that runs the smallest relevant deterministic and runtime checks, diagnoses failures, and escalates with evidence when the budget is exhausted,
So that defects are caught during implementation instead of only at the terminal audit, without agents retrying indefinitely or silently weakening tests to force a pass.

#### Context

This is the largest behavioral story in the feature: it wires together every capability skill built in S-003–S-005, consumes S-006's blocking terminology and S-007's capability tags, and changes both `developer.agent.md` and `implement.instructions.md` (and platform equivalents) together, per spec §15's sequencing note that these must land in the same release as the policy they depend on. It implements PRD FR-5 through FR-9 and spec §8.1.

#### Acceptance Criteria

- [ ] `implement.instructions.md` (and equivalents) define the bounded inner loop: for every sub-task that changes observable behavior, identify affected AC(s) (using S-007's capability tags), run the smallest relevant deterministic check, run relevant runtime/environment validation via the matching capability skill (S-003/S-004/S-005) when tagged, collect results, diagnose failures, apply an in-scope fix and rerun, or escalate (PRD FR-5, FR-6).
- [ ] The default retry budget is stated exactly as: no more than 3 failed iterations OR 15 minutes per acceptance criterion, whichever occurs first; consumer projects MAY configure a stricter budget (PRD FR-7).
- [ ] Retry-budget exhaustion produces a blocked report containing: the criterion, attempted validations, observed evidence, likely cause, and the exact decision/capability needed (PRD FR-8).
- [ ] The instructions explicitly state the loop MUST NOT weaken, delete, skip, or rewrite a valid test solely to force an apparent pass; suspected test defects must be reported and corrected with rationale traceable to approved intent (PRD FR-9).
- [ ] `developer.agent.md` (and equivalents) state that a failed required acceptance check blocks PR readiness, and that critical/major unintended drift (per S-006's state machine, using identical terminology: `Blocking`, `NonBlocking`, `HumanGate`, `Resolved`) blocks PR readiness (PRD FR-43, FR-44) — this replaces the current unconditional non-blocking framing in `developer.agent.md`'s existing rules (the ones adjacent to rule #18/#19 in the current file).
- [ ] `developer.agent.md` documents the five resolution paths from spec §8.2/PRD FR-48 (fix implementation, fix/strengthen test, approved intent change, deferred eligible minor drift, added evidence) and states that after resolution, affected deterministic checks and the relevant verifier audit scope MUST rerun (PRD FR-49).
- [ ] The "Completion Gate" section in `developer.agent.md` is updated so it no longer states drift findings never block completion; it now distinguishes blocking vs. non-blocking per S-006's classification.
- [ ] The closeout payload block gains fields for: retry-loop summary (attempts/escalations per AC, if any) and a `blocking_status` field distinct from the existing `fidelity_verdict`/`drift_findings` fields.
- [ ] The instructions state evidence attachment (via `activity-evidence-reporting`) happens at both the per-sub-task loop level and the terminal completion-gate level, matching spec §15's evidence requirement.

#### Business Rules

- The loop never fakes a pass by weakening a test.
- A blocked state with full evidence is always preferable to an unsubstantiated pass.
- Retry budgets are per-AC, not per-sub-task or per-story.

#### Technical Notes

- Reference spec §8.1 (sequence diagram), §8.2 (state machine — must use identical terms to S-006), §13 (error/result states), `docs/technical-guidelines.md` §"Bounded autonomy."
- This story explicitly must coordinate wording with S-006 (blocking terms) and S-007 (capability tags) — do not invent new terminology.
- Do not alter the existing quality-gate list (`test`, `lint`, `format:check`, `typecheck`, `audit`) — this loop is additive to those gates, not a replacement.

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Fixture walkthrough of a sub-task that (a) passes on first attempt, (b) fails twice then passes on the third attempt (within budget), (c) fails 3 times and produces a correctly structured blocked report, (d) hits the 15-minute budget before 3 attempts.
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** capability tagged `none` (loop must skip runtime/database/mutation stages, run only standard quality gates); capability tagged `browser` but no Playwright config exists (must produce `unavailable`, not silently skip); blocking drift discovered mid-loop from a prior sub-task (must halt progression to next sub-task per the escalation rule).
- **Acceptance-Criteria Mapping:** AC1–AC2 → fixture loop walkthrough (all 4 cases); AC3 → blocked-report fixture content review; AC4 → policy-text review confirming no test-weakening path exists; AC5–AC7 → agent-contract text review against S-006 terminology, cross-checked for exact term matches; AC8 → closeout payload template review; AC9 → evidence-attachment fixture at both loop and gate level.
- **Execution Commands:** `./scripts/format.sh --check`; manual cross-reference diff between `developer.agent.md` blocking language and `verifier.agent.md` (S-006) blocking language to confirm term parity.

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Update `.kiro/steering/implement.md`: add the bounded inner loop, retry budget, no-test-weakening rule, blocked-report format.
2. Update `.kiro/agents/developer.md`: blocking policy (replacing unconditional non-blocking framing), five resolution paths, updated Completion Gate section, closeout payload fields.
3. Port both edits to `.github/instructions/implement.instructions.md` + `.github/agents/developer.agent.md`, and `.claude/skills/implement/SKILL.md` + `.claude/agents/developer.md` + `.claude/commands/developer.md`.
4. Build the 4 fixture loop walkthroughs and 1 term-parity cross-check described in Testing Requirements.
5. Confirm capability-tag vocabulary and blocking terminology exactly match S-006 and S-007.
6. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `.kiro/steering/implement.md` - Edit: bounded loop, retry budget, blocked-report format
- `.kiro/agents/developer.md` - Edit: blocking policy, resolution paths, completion gate, closeout payload
- `.github/instructions/implement.instructions.md` - Edit: same
- `.github/agents/developer.agent.md` - Edit: same
- `.claude/skills/implement/SKILL.md` - Edit: same
- `.claude/agents/developer.md` - Edit: same
- `.claude/commands/developer.md` - Edit: same

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Fixture loop walkthroughs (all 4 cases) written and passing
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three trees, terminology consistent with S-006/S-007
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable
- [ ] Pull Request created and merged

---

### Story S-009: Planner Blocking Propagation and Evidence Rollup

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-006, S-008

#### User Story

As a `planner` agent orchestrating a multi-story run,
I want the same blocking-drift policy and evidence requirements propagated to every delegated `developer` call and rolled up at the PRD level,
So that a multi-story integration PR cannot reach `main` with unresolved blocking drift in any of its constituent stories.

#### Context

Implements spec §4.1's row for `planner`: propagate blocking policy and evidence aggregation across a multi-story run. Depends on S-006 (blocking terminology) and S-008 (the per-story developer loop this story rolls up).

#### Acceptance Criteria

- [ ] `planner.agent.md` (and equivalents) state that each per-story mandatory `verifier` audit now applies S-006's blocking classification, and a story with unresolved `Blocking` drift MUST NOT be merged into the integration branch until resolved (extends the existing "mandatory per-story verifier audit gate" language, does not replace the audit-runs-regardless-of-drift rule).
- [ ] The PRD-level rollup `verifier` audit (before the consolidated PR to `main`) is updated to state that unresolved `Blocking` drift at the rollup level halts the consolidated PR from being marked ready, consistent with S-006's policy.
- [ ] The developer handoff template used by `planner` is extended to pass through the capability-tag/test-plan reference (already added in the prior test-first commit) plus an explicit statement that the delegated `developer` MUST apply the blocking policy from S-006/S-008, not the old unconditional non-blocking rule.
- [ ] `planner` aggregates evidence records (via `activity-evidence-reporting`) across all delegated stories into a single rollup reference (link list, not a re-embedded copy) attached to the consolidated PR.
- [ ] `planner`'s resume/checkpoint state file format is updated (if needed) to record per-story blocking status so a resumed run can tell which stories are blocked vs. clear without re-running the audit.

#### Business Rules

- The rollup audit's blocking policy is the same as the per-story policy — no separate, looser rule for the PRD-level check.
- Evidence rollup links to per-story evidence; it does not duplicate raw artifacts into the rollup.

#### Technical Notes

- Reference spec §4.1, §15 (breaking-change sequencing), and the existing `planner.agent.md` Phase 4/5 structure (per-story audit gate, PRD-level rollup gate, consolidated PR to `main`).
- Note from investigation: `.claude/` has no dedicated `planner` subagent file today (only `commands/planner.md`) — this story edits that command file directly rather than introducing a new subagent split.

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Fixture walkthrough of a 2-story orchestration where story A has `Blocking` drift (must halt merge to integration branch) and story B is clear (must proceed); a rollup fixture where all per-story drift is resolved but a new PRD-level `Blocking` item appears at rollup (must halt the consolidated PR).
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** resumed run after a checkpoint where one story was previously blocked (must surface that status without re-running the full audit unnecessarily); evidence rollup with one story missing an evidence link (must flag as incomplete, not silently omit).
- **Acceptance-Criteria Mapping:** AC1–AC2 → fixture walkthrough (2-story + rollup); AC3 → handoff-template text review; AC4 → evidence-rollup fixture; AC5 → checkpoint-file format review + resume fixture.
- **Execution Commands:** `./scripts/format.sh --check`.

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Update `.kiro/agents/planner.md`: per-story blocking propagation, PRD-level rollup blocking rule, handoff template update, evidence rollup, checkpoint format.
2. Port to `.github/agents/planner.agent.md` and `.claude/commands/planner.md`.
3. Build the 2-story fixture walkthrough and rollup fixture described in Testing Requirements.
4. Confirm blocking terminology matches S-006/S-008 exactly.
5. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `.kiro/agents/planner.md` - Edit: blocking propagation, evidence rollup
- `.github/agents/planner.agent.md` - Edit: same
- `.claude/commands/planner.md` - Edit: same

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Fixture walkthroughs written and passing
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved across all three trees, terminology consistent with S-006/S-008
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable
- [ ] Pull Request created and merged

---

### Story S-010: Registry Docs, Prompts, and Breaking-Change Documentation

**Priority:** Medium
**Estimated Size:** M
**Dependencies:** S-001, S-002, S-003, S-004, S-005, S-006, S-007, S-008, S-009

#### User Story

As a `dev-tasks` consumer upgrading to this release,
I want the README, AGENTS.md, CLAUDE.md, and CHANGELOG to clearly document the 4 new skills, the breaking blocking-policy change, and a migration note,
So that I understand what changed and how to adapt before the new policy affects my next pull request.

#### Context

This story closes out the feature by updating all registry/documentation surfaces once every behavioral story (S-001–S-009) has landed, per spec §15's explicit breaking-change documentation requirement.

#### Acceptance Criteria

- [ ] `README.md`'s Skills table gains 4 new rows for `activity-web-runtime-verification`, `activity-supabase-validation`, `activity-mutation-testing`, `activity-evidence-reporting`, with consumer (`developer`, `verifier`) noted.
- [ ] `README.md`'s "Workflow Chains" / Test-First Design diagram is updated to show the bounded inner loop and blocking-drift resolution path (replacing the current "drift findings, non-blocking" arrow with the new conditional blocking language).
- [ ] `bundle-manifest.json`'s `managed_paths` gains entries for the 4 new skill directories across `.github/skills`, `.claude/skills`, `.kiro/skills` patterns (consistent with existing skill-path entries), and explicitly does NOT add `docs/validation/` or `scripts/check-platform-parity.sh` (confirms S-001/S-002's exclusion decisions).
- [ ] `AGENTS.md` and `AGENTS.md.template` gain a bullet documenting the blocking-drift policy change, replacing the current "drift findings are non-blocking" bullet with accurate conditional language.
- [ ] `CLAUDE.md` and `CLAUDE.md.template` receive the equivalent bullet update.
- [ ] `CHANGELOG.md` gains an entry for this release explicitly labeled as containing a **breaking change**, with the exact migration note from spec §15: _"Critical/Major unintended drift now blocks PR readiness; resolve via fix, approved intent change, or eligible minor deferral."_
- [ ] Prompt entry points affected by new invocation inputs (`.github/prompts/developer-execute.prompt.md`, `verifier-design.prompt.md`, `verifier-audit.prompt.md`, `planner.prompt.md` and `.claude/commands/` equivalents) are updated only where their documented inputs changed (e.g., referencing capability tags or blocking status) — no unrelated content is rewritten.
- [ ] A diff review confirms no other README/AGENTS.md/CLAUDE.md section contradicts the new blocking policy (e.g., no stale "always non-blocking" phrase survives elsewhere in these files).

#### Business Rules

- The breaking change must be impossible for a reader to miss — it appears in the CHANGELOG with the word "breaking" and a one-line migration note, not buried in a generic summary.
- Documentation changes must not silently expand or narrow the behavioral scope already implemented in S-001–S-009.

#### Technical Notes

- Reference spec §15 (Deployment & Rollout), §4.3 row 16 (registry docs, exact file list).
- This story is documentation-only; it must not introduce any new behavioral rule not already specified in an earlier story.

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Not applicable (documentation content).
- **Manual/UI Testing:** Not applicable.
- **Edge-Case Matrix:** Not applicable.
- **Acceptance-Criteria Mapping:** AC1–AC2 → README section review; AC3 → `bundle-manifest.json` diff review; AC4–AC5 → grep for stale "non-blocking" language across `AGENTS.md`/`CLAUDE.md`/templates; AC6 → `CHANGELOG.md` entry review; AC7 → prompt-file diff review (inputs only); AC8 → full grep sweep across all four registry files.
- **Execution Commands:** `./scripts/format.sh --check`; `grep -rn "non-blocking" README.md AGENTS.md AGENTS.md.template CLAUDE.md CLAUDE.md.template` (manual review aid).

#### Migration Requirements

Not applicable to `dev-tasks` itself; this story documents the migration note consumers need for the blocking-policy behavior change.

#### Implementation Steps

1. Update `README.md`: Skills table, Test-First Design workflow diagram.
2. Update `bundle-manifest.json`: add the 4 new skill `managed_paths` entries (×3 platform patterns each).
3. Update `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `CLAUDE.md.template`: replace the unconditional non-blocking bullet with the conditional blocking-policy bullet.
4. Add the breaking-change `CHANGELOG.md` entry with the exact migration note from spec §15.
5. Update only the affected prompt files (`.github/prompts/`, `.claude/commands/`) where invocation inputs changed.
6. Run the grep sweep for stale "non-blocking" language across all four registry files and fix any remaining contradictions.
7. Run `./scripts/format.sh --check`.

#### Files to Create/Modify

- `README.md` - Edit: skills table, workflow diagram
- `bundle-manifest.json` - Edit: add 4 skill managed-path entries
- `AGENTS.md` - Edit: blocking-policy bullet
- `AGENTS.md.template` - Edit: same
- `CLAUDE.md` - Edit: same
- `CLAUDE.md.template` - Edit: same
- `CHANGELOG.md` - Edit: breaking-change entry + migration note
- `.github/prompts/developer-execute.prompt.md` - Edit: inputs only, if changed
- `.github/prompts/verifier-design.prompt.md` - Edit: inputs only, if changed
- `.github/prompts/verifier-audit.prompt.md` - Edit: inputs only, if changed
- `.github/prompts/planner.prompt.md` - Edit: inputs only, if changed
- `.claude/commands/developer.md` - Edit: inputs only, if changed (may already be covered by S-008)
- `.claude/commands/verifier-design.md` - Edit: inputs only, if changed (may already be covered by S-006)
- `.claude/commands/verifier-audit.md` - Edit: inputs only, if changed (may already be covered by S-006)
- `.claude/commands/planner.md` - Edit: inputs only, if changed (may already be covered by S-009)

#### Definition of Done Checklist

- [ ] Content implemented per technical guidelines
- [ ] Grep sweep for stale non-blocking language passes clean
- [ ] Quality gates passing (`format:check`)
- [ ] Content reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle: not applicable to `dev-tasks` itself
- [ ] Pull Request created and merged

---

### Story S-011: Supersede Issues #12 and #15

**Priority:** Medium
**Estimated Size:** XS
**Dependencies:** S-010 (should land after implementation stories are published as issues, so links are meaningful)

#### User Story

As a `dev-tasks` maintainer,
I want issues #12 ("Add support for mutation testing") and #15 ("Add self verification loops for web development agains spect or issue") explicitly superseded by the newly published implementation stories,
So that the issue tracker doesn't retain two vague, unscoped issues alongside their properly-scoped replacements.

#### Context

Per PRD FR-53 and the github-ops audit performed during refinement: both issues are open, have empty or single-line bodies, no labels, and no milestone. This story closes them out cleanly once S-001–S-010 are published as GitHub Issues, preserving historical links per the PRD's supersession requirement.

#### Acceptance Criteria

- [ ] Issue #12 receives a comment cross-linking to the new mutation-testing story issue (S-005) and, if applicable, the umbrella tracking issue for this feature, then is closed as "not planned" or closed with a reference to the superseding issue per `github-ops` conventions.
- [ ] Issue #15 receives a comment cross-linking to the new web-runtime-verification story issue (S-003) and the bounded-loop story issue (S-008), then is closed the same way.
- [ ] Both closure comments explain, in plain language, where each original issue's concern moved (mutation testing → S-005; self-verification loops → S-003 + S-008), so a future reader is not left guessing.
- [ ] No historical reference to #12 or #15 elsewhere in the repository (e.g., prior commit messages, this PRD/spec/stories set) is altered — supersession is additive (new comments + closure), not a rewrite of history.
- [ ] This closure happens through `github-ops` conventions (delegated), consistent with the PRD's and AGENTS.md's GitHub hygiene requirements.

#### Business Rules

- Supersession preserves links both ways: the new issues should be discoverable from the old ones, and the closure rationale must be human-readable, not just a bot cross-reference.

#### Technical Notes

- Reference PRD FR-53, and the github-ops audit findings gathered during PRD refinement (both issues open, unlabeled, no milestone, no existing GitHub-native parent/sub-issue relationship).
- No application code or `dev-tasks` file changes — GitHub-only operation.

#### Testing Requirements

- **Unit Tests:** Not applicable.
- **Integration Tests:** Not applicable.
- **Manual/UI Testing:** `gh issue view 12` and `gh issue view 15` confirm `state: CLOSED` and the expected cross-linking comment text.
- **Edge-Case Matrix:** Not applicable.
- **Acceptance-Criteria Mapping:** AC1–AC2 → `gh issue view` state + comment check; AC3 → comment content review; AC4 → confirm no destructive edit to existing history; AC5 → confirm action was performed via `github-ops` delegation per the operation summary.
- **Execution Commands:** `gh issue view 12 --json state,comments`; `gh issue view 15 --json state,comments`.

#### Migration Requirements

Not applicable.

#### Implementation Steps

1. Confirm the GitHub issue numbers created for S-003, S-005, and S-008 (or the umbrella tracking issue, if one is created during publish).
2. Delegate to `github-ops`: post the cross-linking comment on #12 referencing S-005's issue.
3. Delegate to `github-ops`: post the cross-linking comment on #15 referencing S-003's and S-008's issues.
4. Delegate to `github-ops`: close both issues per `github-ops` closure conventions.
5. Verify via `gh issue view` that both are closed with the expected comment content.

#### Files to Create/Modify

- None (GitHub-only operation)

#### Definition of Done Checklist

- [ ] N/A — no code implemented
- [ ] Manual verification via `gh issue view` performed and passing
- [ ] Quality gates: not applicable
- [ ] Action reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to verification evidence
- [ ] Migration lifecycle: not applicable
- [ ] Both issues closed with cross-linking comments (no PR — GitHub-only change)

---

## Coverage Validation

### Summary

- **Total PRD Requirements (Functional Requirements):** 53
- **Total PRD User Stories:** 10
- **Total Generated Stories:** 11 (S-001–S-011)
- **Coverage:** 100%
- **Status:** Complete

### Functional Requirement Mapping

| PRD Functional Requirements                          | Story ID(s)                | Status     |
| ---------------------------------------------------- | -------------------------- | ---------- |
| FR-1 – FR-4 (intent, test design, traceability)      | S-006, S-007               | ✅ Covered |
| FR-5 – FR-9 (bounded self-verification loop)         | S-008                      | ✅ Covered |
| FR-10 – FR-15 (browser validation)                   | S-003, S-008               | ✅ Covered |
| FR-16 – FR-22 (mutation testing)                     | S-005, S-006, S-008        | ✅ Covered |
| FR-23 – FR-31 (Supabase validation)                  | S-004, S-008               | ✅ Covered |
| FR-32 – FR-38 (capability detection/flexibility)     | S-001, S-003, S-004, S-005 | ✅ Covered |
| FR-39 – FR-49 (evidence, blocking, drift resolution) | S-001, S-006, S-008, S-009 | ✅ Covered |
| FR-50 – FR-52 (platform parity/adoption)             | S-002, S-010               | ✅ Covered |
| FR-53 (supersede #12, #15)                           | S-011                      | ✅ Covered |

### PRD User Story Mapping

| PRD User Story                                           | Story ID(s)                              | Status     |
| -------------------------------------------------------- | ---------------------------------------- | ---------- |
| 1 (per-increment validation)                             | S-008                                    | ✅ Covered |
| 2 (E2E authoritative + live diagnosis)                   | S-003, S-008                             | ✅ Covered |
| 3 (evidence for reviewers)                               | S-001, S-008, S-009                      | ✅ Covered |
| 4 (mutation reveals weak tests, no arbitrary threshold)  | S-005                                    | ✅ Covered |
| 5 (safe Supabase Cloud inspection)                       | S-004                                    | ✅ Covered |
| 6 (production-only, read-only default + per-op approval) | S-004                                    | ✅ Covered |
| 7 (documented fallback / incomplete result)              | S-001, S-003, S-004, S-005               | ✅ Covered |
| 8 (critical drift blocks, explicit resolution path)      | S-006, S-008                             | ✅ Covered |
| 9 (capability-independent validation outcomes)           | S-001, S-006                             | ✅ Covered |
| 10 (platform parity)                                     | S-002, S-006, S-007, S-008, S-009, S-010 | ✅ Covered |

### Non-Goals Validation

- [x] Hosted orchestration/test/browser/database service — confirmed NOT in any story (all stories are agent/skill/instruction/script documentation, no service is deployed).
- [x] Replacing Playwright/Stryker/Supabase CLI/Chrome DevTools MCP/CI systems — confirmed NOT in any story (all capability skills document usage of existing tools, none reimplement them).
- [x] Mandating one framework or numeric coverage/mutation threshold for every consumer — confirmed NOT in any story (S-005 explicitly forbids inventing thresholds; S-004/S-003 leave environment/tool choice to the consumer).
- [x] Automatically installing dependencies or configuring credentials/MCP servers without an approved task — confirmed NOT in any story (S-003, S-004, S-005 explicitly scope to detection only; S-001 states the same).
- [x] Destructive/fuzz/mutation/failure-mode testing against production — confirmed NOT in any story (S-004 and S-005 both include explicit production-refusal acceptance criteria).
- [x] Guaranteeing defect-free software or treating any single score as proof of correctness — confirmed NOT in any story (S-005 explicitly frames mutation score as a detection signal, not a correctness proof).
- [x] Committing all raw validation artifacts to the repository — confirmed NOT in any story (S-001 and S-010 confirm `docs/validation/` exclusion from committed baselines beyond the schema/skill; CI/PR artifact attachment is the default per S-001, S-003, S-004, S-005).
- [x] Adding an end-user application UI — confirmed NOT in any story (no UI story exists; S-010's diagram update is documentation only).
- [x] Supporting every language and backend in the first implementation — confirmed NOT in any story (S-003/S-005 explicitly scope to the JS/TS + Playwright + Stryker reference profile; S-004 to Supabase).

## Execution Plan Summary

**Total stories:** 11
**Suggested execution order:** S-001 → S-002 → {S-003, S-004, S-005 in parallel} → S-006 → S-007 → S-008 → S-009 → S-010 → S-011

**Sizing distribution:** 1 XS, 2 S, 5 M, 3 L
**Critical-path stories (block the core value proposition):** S-001, S-006, S-008
**Parallelizable stories:** S-003, S-004, S-005 (independent capability skills, no cross-dependencies)
**Highest-risk story:** S-008 (largest surface area, must stay in exact terminology sync with S-006 and S-007 across all three platform trees)
**Documentation/hygiene-only stories:** S-010, S-011 (no application/agent behavior introduced beyond what S-001–S-009 already specify)
