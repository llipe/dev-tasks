# QA standards fixtures

Fixture projects for the behavioral verification steps of issue #123. Each one
reproduces a specific defect from the `home-ledger` test audit that drove
refinement v1.2, so the delivered skills are verified against real failure
shapes rather than against prose.

| Fixture                | Verifies              | Reproduces                                                                 |
| ---------------------- | --------------------- | -------------------------------------------------------------------------- |
| `unreachable-monorepo` | AC-6 (SC-17, SC-18)   | Aggregate script omits a test-bearing package; CI and deploy gates let it through |
| `harness-defects`      | AC-5 (SC-14)          | All seven harness-defect classes                                            |
| `no-coverage-provider` | AC-11 (SC-30 – SC-32) | No provider anywhere, plus a stale scope-narrowed coverage artifact         |

These are **inert fixtures**, not executable packages. They are never installed
and their `devDependencies` are never resolved; the version strings are shape,
not intent. Excluded from lint, typecheck, and the test suite.

A skill that reports "pass" against any of these is defective. That is the point
of the fixtures: presence of a heading is not evidence, and the plan records that
a scenario passing while its target defect is present is a plan defect.
