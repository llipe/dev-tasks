# Workflow Chains

Reference documentation for how agents chain together in different scenarios.

## Full Feature (PRD-Driven)

```text
product-engineer: refine → [researcher] → generate-spec → generate-stories → publish-github → plan
                                                                                                 ↓
developer: implement
```

> `[researcher]` is conditional — invoked when the feature touches existing implementation, spans multiple modules, or the area is unfamiliar. Skipped for greenfield features.
>
> `plan` captures the feature's `decision_log_path` (typically `workstream/decisions-<feature>.md`) and passes it unconditionally to `developer`, who reads the log before starting work.
>
> When the feature has infrastructure scope, `developer` routes the platform work conditionally to `infra-engineer` (see the Infrastructure Change chain below) rather than running any platform write itself. Skipped when the feature has no infra scope.

## Single GitHub Issue

```text
[researcher] → product-engineer: refine → plan
                                            ↓
developer: implement
```

> `[researcher]` is conditional — invoked when the issue is multi-module, diagnostic, or unfamiliar. Skipped for trivial single-file changes.
>
> `plan` captures the feature's `decision_log_path` (if a log exists, typically `workstream/decisions-<feature>.md`) and passes it to `developer`, who reads the log before starting work.
>
> When the issue has infrastructure scope, `developer` routes the platform work conditionally to `infra-engineer` (see the Infrastructure Change chain below) rather than running any platform write itself. Skipped when the issue has no infra scope.

## Infrastructure Change

```text
infra-engineer: discover → plan → per-step approval → apply → verify → record → draft PR
                    ↑ [researcher]                                          ↓
        (conditional, unfamiliar surface)                    github-ops: change-record draft PR
```

> Invoked conditionally by `developer`, `planner`, or `product-engineer` when a story, issue, or PRD carries a platform write — secrets, deploy, DNS, certificates, IAM policy, or a migration against a shared or cloud project. Never invoked when the scope has no infra work.
>
> Each step in the working loop is gated: `infra-engineer` presents one step, waits for per-step approval keyed to the `ChangeId`, backs up state when applicable, applies, verifies, and records (`plan.md`, append-only `commands.sh`, reverse-order `rollback.sh`, `result.md`). It runs no autonomous or batch mode. `[researcher]` is conditional — invoked only for an unfamiliar platform surface. When the loop completes, `infra-engineer` delegates a change-record draft PR to `github-ops` (title prefix `infra:`, body sections citing the `ChangeId`, `infra-change` label) and never self-merges it.

## Codebase Research (Standalone)

```text
researcher: intake → slice execution (S1-S8) → synthesis → budget enforcement → provenance
                                                                                                        ↓
                                                                        /workstream/research-*.md (250 lines, 30 files max)
```

Invoked by `product-engineer` (pre-refine, pre-spec), `developer` (troubleshooting), or `planner` (pre-orchestration). Conditional and non-mandatory.

## Multi-Story Orchestration

```text
product-engineer: refine → generate-spec → generate-stories → publish-github → plan
                                                                                  ↓
planner: orchestrate → developer: implement (per story, sequential)
```

> `plan` captures the feature's `decision_log_path` (typically `workstream/decisions-<feature>.md`). `planner` passes it unconditionally in every story's `developer` handoff; each developer reads the log before starting work on their story.

## Quick Fix (Clear Issue, Task List Exists)

```text
developer: implement
```

## UX Validation Loop

```text
product-engineer: refine → generate-spec
                               ↓
ux-engineer (lite): screen sketches → gap analysis → refinement handoff
                                          ↓
product-engineer: update spec/stories → generate-stories → plan
                                                               ↓
developer: implement
```

Lite mode (default) produces navigable HTML screens at zero install cost.
For interactive usability testing, invoke `ux-engineer` with `fidelity: full`
(shadcn + Vite + Radix prototype).

```text
Quick screen sketches (direct):
  ux-engineer (lite, source: PRD or spec path) → screen set + gap analysis
```

## Test-First Design (Verifier)

```text
product-engineer: refine → spec → stories → plan
                                                 ↓
verifier (design mode): generate test plan (from spec or stories)
                                                 ↓
developer/planner: implement (feature + tests from test plan)
                        ↓ (automatic, at the completion gate)
                    qa-engineer: standards check → missing tests → coverage/gap report
                        ↓ (automatic, mandatory, non-skippable)
                    verifier (audit mode): grey-box fidelity audit → fidelity report
                        ↓ (drift findings, non-blocking)
                    product-engineer: activity-drift-reconciliation
```

## Project Initialization

```text
product-engineer (init mode): activity-init
                                  ↓
                    detect mode:  /docs?   → documented
                                  absent?  → greenfield
                    detect shape: workspace signal? → monorepo, else single-package
                                  ↓
    documented:   interview → product.md + tech.md (incl. package map)
    greenfield:   investigate codebase directly → interview → product.md + tech.md
```

## Testing Standard (QA)

```text
qa-engineer:
  Step 1: activity-test-standards         → /TESTING.md filled, harness defects, gate reachability
                                            (detects integration/E2E/contract infra)
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
  Step 4: activity-coverage-gap-analysis   → coverage_gate + risk-ranked gap inventory
                                             (scope includes integration + E2E layers)
```

Invoked by `developer` at the completion gate before the `verifier` audit, or directly by a user for a standalone pass (bootstrap `/TESTING.md`, backfill legacy tests, audit coverage).

## Integration & E2E Testing Decision Path

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

## Planner Integration Rollup

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
