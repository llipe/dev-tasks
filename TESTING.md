---
version: 1.0
name: Testing Standard
description: Canonical testing contract for dev-tasks — declares test layers, runners, commands, fixtures, and coverage policy.
status: filled
owner: qa-engineer
---

## Test Layers

| Layer    | Name                      | Scope                                                                                                                             | Status                                 |
| -------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1        | Deterministic foundations | Unit tests and schema/contract assertions with no network, database, or wall-clock dependency.                                    | configured                             |
| 2        | Constrained model/tool    | CLI, filesystem, subprocess, distribution, and fixture tests with external providers replaced by deterministic fixtures or stubs. | configured                             |
| 2.5      | Integration               | Real database, migrations, RLS, and schema contracts without a mocked data layer.                                                 | not configured                         |
| E2E      | End-to-end                | Playwright full-stack browser scenarios.                                                                                          | not configured                         |
| Contract | Contract validation       | `dt verify` API-spec diff, impact, and drift checks.                                                                              | not configured; no repository API spec |
| 3        | Product evaluation        | Semantic or groundedness evaluation for LLM features.                                                                             | not applicable                         |
| 4        | Human evaluation          | Human review and safeguard gates.                                                                                                 | manual only                            |

### Layer boundaries

- **Layer 1 must not:** open sockets or database connections, invoke real external services, read the wall clock without injection, depend on test order, or assert internal call counts as a proxy for behavior.
- **Layer 2 must not:** replace the system under test at its own public entry point, reimplement production filtering or persistence in a fake, or claim provider behavior that was only tested against a double.
- **Layer 2.5 must not:** mock the data layer or use application-level filtering as evidence of database/RLS policy.
- **E2E must not:** assert on internal state or implementation details; it must assert observable user-facing behavior.
- **Contract validation must not:** test internal business logic; it checks the boundary/interface only.
- **Escalation:** when a Layer 1 test needs a real dependency, move it to Layer 2 instead of growing a behavior-reimplementing double; when a Layer 2 test needs a real database, move it to Layer 2.5.

## Packages

This is a single-package TypeScript repository; no workspace manifest or additional package was detected.

| Package                | Language       | Runner       | Test command    | Test environment             | Coverage tooling                                                                                         |
| ---------------------- | -------------- | ------------ | --------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `@llipe.com/dev-tasks` | TypeScript/ESM | Vitest 3.2.6 | `pnpm run test` | Node (`environment: "node"`) | V8 provider declared in `vitest.config.ts`, but no usable coverage command/provider package is installed |

Tests live in `test/unit/` and `test/integration/` and use `*.test.ts`. `test/fixtures/` contains inert QA fixtures and is excluded from collection by `vitest.config.ts`.

### Test environment

The package is a CLI and filesystem toolkit, so Node is the correct environment; no DOM/browser component package was detected. Tests use temporary directories, fixture repositories, and subprocesses where required. No real database integration harness is configured.

### Runtime parity

- Local validation observed Node `v26.7.0`.
- CI workflow `publish-npm.yml` uses Node `24`.
- The package declares production engine `>=24`.
- The local major version differs from the pinned CI major and is a harness defect until local and CI validation use the same supported major (or CI is changed to a tested range).

## Commands

| Script             | Purpose                                                                                               | Status                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `lint`             | ESLint static analysis                                                                                | present                                |
| `lint:fix`         | ESLint auto-fix                                                                                       | present                                |
| `format`           | Prettier write                                                                                        | present                                |
| `format:check`     | Prettier verification                                                                                 | present                                |
| `typecheck`        | TypeScript analysis                                                                                   | present                                |
| `test`             | Aggregate Vitest run; reaches this package's unit and integration tests                               | present                                |
| `test:unit`        | Unit tests                                                                                            | present                                |
| `test:integration` | Integration-directory tests; these are CLI/filesystem integration tests, not Layer 2.5 database tests | present                                |
| `test:e2e`         | Playwright tests                                                                                      | not configured; no Playwright setup    |
| `test:contract`    | `dt verify` family                                                                                    | not configured; no repository API spec |
| `test:coverage`    | Coverage measurement                                                                                  | missing; no usable provider configured |
| `audit`            | Production dependency audit                                                                           | present                                |
| `validate`         | `typecheck` → `lint` → `format:check` → aggregate `test`                                              | present                                |

### Gate reachability

- **Aggregate test command:** `pnpm run test` (`vitest run`), which includes `test/**/*.test.ts` and excludes `test/fixtures/**`; the single package is reached, including both `test/unit/` and `test/integration/`.
- **CI gate:** `publish-npm.yml` invokes `pnpm run validate`, which reaches the aggregate test command, but only on its tag-triggered publish workflow. No general CI test workflow/job was detected.
- **Deploy gate:** no deploy workflow was detected; deploy quality-gate status is not automatically enforced.
- `release-bundle.yml` does not invoke `validate` or the aggregate test command.

## Coverage

### Thresholds and baseline policy

- Measurement tool: V8 is declared in `vitest.config.ts`, but `test:coverage` is absent and the coverage provider is not available as a project dependency.
- Threshold policy: no numeric threshold has been established.
- Baseline: none recorded.
- Regression policy: coverage must not be reported as measured until a provider and command are configured; structural gap analysis is mandatory meanwhile.

When coverage cannot be measured, report `coverage_gate: SKIPPED(<non-empty reason>)` and enumerate untested or weakly tested surfaces, source-to-test ratios, exclusions, and limitations. Never infer zero coverage or a pass.

## Fixtures and Mocking

Tests primarily use deterministic fixture repositories under `test/fixtures/`, temporary directories rooted in the OS temp directory, and subprocess execution for CLI entry points. Fixture projects that intentionally model harness defects are excluded from Vitest collection. No duplicated token builders or client mocks were detected, and no global `fetch`/timer stubs were detected. Any future global stub must be restored explicitly.

Gold or generated fixture files must record their source and regeneration path where applicable. Generated catalog outputs are test artifacts, not coverage evidence, and must not be used as durable validation without freshness and scope checks.

## Security-Negative Tests

This package has no authentication or authorization implementation path in the analyzed scope. If one is added, tests are mandatory for invalid signature, expired credential, wrong issuer/audience, tampered claims, missing credential, insufficient permission, and cross-tenant access where applicable. Tests against a fake policy layer must state that production policy remains unverified.

## Harness defects to track

1. `vitest.config.ts`: `restoreMocks` is not enabled. Expected state: enable explicit mock restoration if mocks/stubs are introduced, and retain per-test cleanup for any global stubs.
2. `package.json` and `vitest.config.ts`: V8 coverage is declared but no usable `test:coverage` command/provider is configured. Expected state: add the approved provider and canonical command in a separate approved change, then record thresholds and baseline; until then coverage is skipped.
3. CI/deploy wiring: no general CI test job and no deploy workflow invoke the aggregate test command. Expected state: every CI test job and deploy quality gate must run `pnpm run test` or `pnpm run validate`.
4. `publish-npm.yml` versus `package.json`: local Node 26 and CI Node 24 are not the same runtime major. Expected state: align the validation runtime or explicitly test the supported range.
