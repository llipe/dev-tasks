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
ux-engineer: mockups → gap analysis → refinement handoff
                                          ↓
product-engineer: update spec/stories
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
qa-engineer: activity-test-standards      → /TESTING.md filled, harness defects, gate reachability
                 ↓
             activity-test-implementation  → Layer 1-2 tests, mandatory security-negative cases
                 ↓
             activity-coverage-gap-analysis → coverage_gate + risk-ranked gap inventory
                 ↓
             (no coverage provider? structural path still runs — never "unknown")
```

Invoked by `developer` at the completion gate before the `verifier` audit, or directly by a user for a standalone pass (bootstrap `/TESTING.md`, backfill legacy tests, audit coverage).
