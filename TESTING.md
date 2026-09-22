---
version: 1.0
name: Testing Standard
description: Canonical testing contract for dev-tasks — declares test layers, runners, commands, fixtures, and coverage policy.
status: filled
owner: qa-engineer
---

## Test Layers

| Layer | Name                      | Scope                                                                                                                             | Status         |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1     | Deterministic foundations | Unit tests and schema/contract assertions with no network, database, or wall-clock dependency.                                    | configured     |
| 2     | Constrained model/tool    | CLI, filesystem, subprocess, distribution, and fixture tests with external providers replaced by deterministic fixtures or stubs. | configured     |
| 2.5   | Integration               | Real database, migrations, RLS, and schema contracts without a mocked data layer.                                                 | not configured |
| E2E   | End-to-end                | Playwright full-stack browser scenarios.                                                                                          | not configured |
| 3     | Product evaluation        | Semantic or groundedness evaluation for LLM features.                                                                             | not applicable |
| 4     | Human evaluation          | Human review and safeguard gates.                                                                                                 | manual only    |

### Layer boundaries

- **Layer 1 must not:** open sockets or database connections, invoke real external services, read the wall clock without injection, depend on test order, or assert internal call counts as a proxy for behavior.
- **Layer 2 must not:** replace the system under test at its own public entry point, reimplement production filtering or persistence in a fake, or claim provider behavior that was only tested against a double.
- **Layer 2.5 must not:** mock the data layer or use application-level filtering as evidence of database/RLS policy.
- **E2E must not:** assert on internal state or implementation details; it must assert observable user-facing behavior.
- **Escalation:** when a Layer 1 test needs a real dependency, move it to Layer 2 instead of growing a behavior-reimplementing double; when a Layer 2 test needs a real database, move it to Layer 2.5.

## Packages

This is a single-package TypeScript repository; no workspace manifest or additional package was detected.

| Package                | Language       | Runner       | Test command    | Test environment             | Coverage tooling                                                                                         |
| ---------------------- | -------------- | ------------ | --------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `@llipe.com/dev-tasks` | TypeScript/ESM | Vitest 3.2.6 | `pnpm run test` | Node (`environment: "node"`) | V8 provider declared in `vitest.config.ts`, but no usable coverage command/provider package is installed |

Tests live in `test/unit/` and `test/integration/` and use `*.test.ts`. `test/fixtures/` is excluded from `.test.ts` collection by `vitest.config.ts`. That exclusion is about collection only — it does not mean the tree is inert. `test/fixtures/docs-structure/*` and `test/fixtures/workspace-*` are live input fixtures read by passing tests, and editing one changes what those tests assert.

### Per-package runners (monorepo contract)

This repository has one package, so the table above has one row. The
contract for a repository that has many (FR-62):

- **Every package gets a row**, with the runner and test command it
  actually uses. A package that shares the root runner still gets a row
  saying so — a reader must not have to infer coverage from an absence.
- **Declare a runner where it differs.** A Vitest package beside a pytest
  package beside a `go test` package is normal; the table is where that
  is written down, and `activity-test-standards` reads it.
- **A package with no test script gets a row saying so.** `no test
script` is a finding, distinct from `unreachable`: one needs a script
  written, the other needs the aggregate wired to reach it.
- **The Packages table above is the per-package record.** In a repository with many packages it gains a row each, and the finding vocabulary below (`no test script`, `unreachable`) is what its notes carry. The single row here reflects this repository's shape, not a different schema.
- **Reachability is per package.** `activity-test-standards` verifies
  that the root `test` command reaches every package with tests, and
  reports one row per package. An omission is a defect even when every
  script name is canonically correct.

### Test environment

The package is a CLI and filesystem toolkit, so Node is the correct environment; no DOM/browser component package was detected. Tests use temporary directories, fixture repositories, and subprocesses where required. No real database integration harness is configured.

### Runtime parity

- CI workflow `publish-npm.yml` uses Node `24`.
- The package declares production engine `>=24`.
- Local validation has been observed on Node `v26.7.0`, which is above the declared engine floor.
- The test suite runs at 64 files / 2138 tests with zero failures on both runtimes.
- A deployment of CI against Node 24 while the development environment uses Node 26 represents a minor runtime mismatch but carries no known risk to the harness itself; the CLI and toolkit operate across both versions without defect.

## Commands

| Script             | Purpose                                                                                               | Status                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `lint`             | ESLint static analysis **and** `tsx core/checks/run.ts` (docs-structure gate)                         | present                                |
| `lint:fix`         | ESLint auto-fix                                                                                       | present                                |
| `format`           | Prettier write                                                                                        | present                                |
| `format:check`     | Prettier verification                                                                                 | present                                |
| `typecheck`        | TypeScript analysis                                                                                   | present                                |
| `test`             | Aggregate Vitest run; reaches this package's unit and integration tests                               | present                                |
| `test:unit`        | Unit tests                                                                                            | present                                |
| `test:integration` | Integration-directory tests; these are CLI/filesystem integration tests, not Layer 2.5 database tests | present                                |
| `test:e2e`         | Playwright tests                                                                                      | not configured; no Playwright setup    |
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

### Environment-fragility patterns

The test suite runs to completion with zero failures. However, some patterns in test design carry environment-fragility risk if new tests adopt them. Avoid these patterns:

- **Root-permission assumptions.** A test that `chmod`s a path unwritable and expects a failure passes only as a non-root user. Root ignores the bits. `test/unit/migrate-docs.test.ts` shows the correct pattern: probe whether writes are actually blocked, and `ctx.skip()` when they are not. `checkCacheDir` and `runUpdate --force` should adopt it if they are written.
- **PATH assumptions.** A test that sets `PATH=/usr/bin:/bin` to simulate a missing binary depends on that binary being absent from those directories. `yq` is present at `/usr/bin/yq` in some containers. A purpose-built empty directory is the reliable form.

1. `vitest.config.ts`: `restoreMocks` is not enabled. Expected state: enable explicit mock restoration if mocks/stubs are introduced, and retain per-test cleanup for any global stubs.
2. `package.json` and `vitest.config.ts`: V8 coverage is declared but no usable `test:coverage` command/provider is configured. Expected state: add the approved provider and canonical command in a separate approved change, then record thresholds and baseline; until then coverage is skipped.
3. CI/deploy wiring: no general CI test job and no deploy workflow invoke the aggregate test command. Expected state: every CI test job and deploy quality gate must run `pnpm run test` or `pnpm run validate`.
4. Runtime alignment: `publish-npm.yml` uses Node 24 while local development uses Node 26. Both runtimes pass the full test suite with zero failures, so there is no blocker to release. Future work may align these to a single supported range or explicitly document the tested range in the engine constraint.
