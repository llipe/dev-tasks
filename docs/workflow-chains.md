# Workflow Chains

Reference documentation for how agents chain together in different scenarios.

## Full Feature (PRD-Driven)

```text
product-engineer: refine → generate-spec → generate-stories → publish-github → plan
                                                                                  ↓
developer: implement
```

## Single GitHub Issue

```text
product-engineer: refine → plan
                            ↓
developer: implement
```

## Multi-Story Orchestration

```text
product-engineer: refine → generate-spec → generate-stories → publish-github → plan
                                                                                  ↓
planner: orchestrate → developer: implement (per story, sequential)
```

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
                    detect mode: component.json? → multi-repo
                                /docs?           → mono-repo
                                neither?         → greenfield
                                  ↓
    multi-repo:   dt init --task --json → bundle → interview → product-context.md + technical-guidelines.md
    mono-repo:    interview → product-context.md + technical-guidelines.md
    greenfield:   dt extract detect → dt extract all --interactive → interview → product-context.md + technical-guidelines.md
```

## Contract Verification (Cross-Repo)

```text
dt verify contract-diff --base <old> --head <new>
    ↓ (exit 8 if breaking)
dt verify impact --contract <id>
    ↓ (lists affected consumers)
dt verify drift [--id <comp>]
    ↓ (staleness report)
developer/planner: address breaking changes or update consumers
```

## Extraction Ladder (Per Stage)

```text
dt extract all
    ↓
    For each stage (schema, openapi, asyncapi):
        declared rung → (success? stop) → observed rung → (success? stop) → inferred rung
        ↓
    component.json derivation + extraction_report.json
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
  Step 4: activity-contract-validation     → Contract layer (conditional)
                                             - dt verify contract-diff / impact / drift
                                             - OpenAPI/AsyncAPI drift detection
      ↓
  Step 5: activity-coverage-gap-analysis   → coverage_gate + risk-ranked gap inventory
                                             (scope includes integration + E2E + contract layers)
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
