# Fixture: unreachable monorepo (AC-6 / SC-17 / SC-18)

Reproduces the home-ledger Gap 1 false pass.

Every script name is canonically correct. The aggregate `test:node` reaches
`app` and `db` but **omits `api`**, which holds the largest suite. Both the CI
test job and the deploy quality gate run that incomplete aggregate.

Expected `activity-test-standards` output:

- defect: `packages/api` is unreachable from the aggregate test command
- defect: `.github/workflows/ci.yml` test job lets untested `api` code through
- defect: `.github/workflows/deploy.yml` quality gate lets untested `api` code through
- NOT a pass on the strength of correct script naming
