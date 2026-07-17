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
                        ↓ (automatic, mandatory, non-skippable)
                    verifier (audit mode): grey-box fidelity audit → fidelity report
                        ↓ (drift findings, non-blocking)
                    product-engineer: activity-drift-reconciliation
```

## Project Initialization

```text
product-engineer (init mode): activity-init → product-context.md + technical-guidelines.md
```
