---
version: alpha
name: Testing Standard
description: Canonical testing contract for this repository — declares what to test at which layer, which commands to run, and how coverage is judged.
status: placeholder
---

<!--
PLACEHOLDER. This file ships with dev-tasks as a section contract only — it
deliberately asserts no project-specific values.

Run `qa-engineer` to inspect this repository and fill it in. The agent detects
the test framework, runner, script inventory, test locations, coverage tooling,
and mocking approach per package, then replaces the `<!-- unfilled -->` markers

below. Content you write here is preserved: this file is listed in
`consumer_owned_paths`, so `dev-tasks update` will never overwrite it.

Owned by `qa-engineer`. `developer` keeps it current when the testing contract
changes. Agents that read it MUST treat an unfilled placeholder as "no standard
established" rather than as permission.
-->

## Test Layers

The layer taxonomy below is fixed. What belongs in each layer is project-specific.

| Layer    | Name                      | Scope                                                                                 | Status            |
| -------- | ------------------------- | ------------------------------------------------------------------------------------- | ----------------- |
| 1        | Deterministic foundations | Unit tests, schema validation. No I/O, no network, no real database.                  | <!-- unfilled --> |
| 2        | Constrained model/tool    | Backend component tests, mocked APIs, fixtures and gold datasets.                     | <!-- unfilled --> |
| 2.5      | Integration               | Real database, real migrations, RLS policies, schema contracts. No mocked data layer. | <!-- unfilled --> |
| E2E      | End-to-end                | Playwright CLI — committed browser automation, full-stack, scenario-driven.           | <!-- unfilled --> |
| Contract | Contract validation       | API spec drift, breaking-change detection, consumer impact. `dt verify` family.       | <!-- unfilled --> |
| 3        | Product evaluation        | Semantic, tone, groundedness, hallucination evals. Only for LLM features.             | <!-- unfilled --> |
| 4        | Human evaluation          | Review gates, safeguards, risk alerts.                                                | <!-- unfilled --> |

Integration, end-to-end, and contract validation layers are declared per project
in the table below when they exist.

### Layer boundaries

State explicitly what must **not** be tested at each layer, so the boundary is
enforceable rather than aspirational.

- **Layer 1 must not:** <!-- unfilled -->
- **Layer 2 must not:** <!-- unfilled -->
- **Layer 2.5 must not:** mock the data layer. If the database is mocked, the test belongs at Layer 2. If the test hits a live external service over the network, it may belong at E2E or remote integration.
- **E2E must not:** assert on internal state or implementation details. Assertions are on observable user-facing behavior only.
- **Contract validation must not:** test internal business logic. It checks the boundary/interface only.
- **Escalation rule** — when a Layer 1 test needs a real dependency, it moves up
  a layer rather than growing a test double that reimplements the dependency.
  When a Layer 2 test needs a real database, it moves to Layer 2.5.

## Packages

One row per package. In a single-package repository this table has one row.
A package's language determines its runner and commands — a non-JS package is
described in its own terms, not forced into JavaScript script names.

| Package           | Language          | Runner            | Test command      | Test environment  | Coverage tooling  |
| ----------------- | ----------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| <!-- unfilled --> | <!-- unfilled --> | <!-- unfilled --> | <!-- unfilled --> | <!-- unfilled --> | <!-- unfilled --> |

### Test environment

Each package declares the environment its tests run under, and why. A package
rendering DOM components under a bare `node` environment is a defect, not a
preference.

<!-- unfilled -->

### Runtime parity

Record the runtime version used locally, in CI, and in production for each
package. Divergence is a finding: tests that pass on one runtime prove nothing
about another.

<!-- unfilled -->

## Commands

### JavaScript / TypeScript default

Canonical script names for JS/TS packages. Prefer `pnpm`.

| Script             | Purpose                                   | Required            |
| ------------------ | ----------------------------------------- | ------------------- |
| `lint`             | Static analysis                           | yes                 |
| `lint:fix`         | Auto-fix lint findings                    | no                  |
| `format`           | Write formatting                          | no                  |
| `format:check`     | Verify formatting                         | yes                 |
| `typecheck`        | Type analysis                             | yes                 |
| `test`             | Aggregate — MUST reach every test package | yes                 |
| `test:unit`        | Layer 1                                   | yes                 |
| `test:integration` | Layer 2.5 — real database integration     | when present        |
| `test:e2e`         | E2E layer — Playwright browser automation | when present        |
| `test:contract`    | Contract validation — `dt verify` family  | when present        |
| `test:coverage`    | Coverage measurement                      | when tooling exists |
| `audit`            | Dependency vulnerability scan             | yes                 |
| `validate`         | Aggregate quality gate                    | yes                 |

### Non-JS packages

Declare each non-JS package's equivalent commands here. The canonical names
above are a JS/TS convention, not a cross-language requirement — what matters is
that every package has a discoverable command per purpose and that the aggregate
test command reaches it.

| Package           | Purpose           | Command           |
| ----------------- | ----------------- | ----------------- |
| <!-- unfilled --> | <!-- unfilled --> | <!-- unfilled --> |

### Gate reachability

The aggregate test command MUST reach every package that contains tests, and the
CI and deploy quality gates MUST invoke that aggregate. A correctly named script
that silently omits a package is the failure this section exists to prevent.

- Aggregate test command: <!-- unfilled -->
- Packages reached: <!-- unfilled -->
- CI gate: <!-- unfilled -->
- Deploy gate: <!-- unfilled -->

## Coverage

### Thresholds and baseline policy

Coverage percentages alone do not establish confidence — a suite can cover every
line while asserting nothing meaningful. Thresholds are a floor, not a goal.

- Measurement tool per package: <!-- unfilled -->
- Threshold policy: <!-- unfilled -->
- Baseline: <!-- unfilled -->
- Regression policy: <!-- unfilled -->

### When coverage cannot be measured

If no coverage provider is configured, the gate reports
`SKIPPED(<reason>)` — never a pass — and structural gap analysis runs instead:
untested files and exported symbols are enumerated, source-to-test size ratios
are reported per package, and gaps are ranked by size and risk. Absence of
tooling is never reported as absence of gaps.

Existing coverage artifacts are validated before being trusted. A stale report,
or one whose measured scope is narrower than the package it claims to describe,
is reported as misleading rather than used as evidence.

## Fixtures and Mocking

### Strategy

<!-- unfilled -->

### Rules

- Shared fixtures and helpers live in one place per package. Duplicating a token
  builder or a client mock across test files is a defect.
- A test double must not reimplement the logic it stands in for. When a mock
  grows a copy of production behavior, the test validates the mock.
- Stubbed globals are restored after each test. Rely on explicit restoration
  rather than on worker isolation.
- Placeholder assertions such as `expect(true)` are prohibited. They report
  health without exercising anything.

### Gold datasets

Record where recorded responses and golden files live, how they were captured,
and how to regenerate them.

<!-- unfilled -->

## Security-Negative Tests

Required for every authentication and authorization code path. A suite that
only asserts the behavior the implementation happens to have provides no
security evidence.

| Case                        | Required |
| --------------------------- | -------- |
| Invalid signature rejected  | yes      |
| Expired credential rejected | yes      |
| Wrong issuer or audience    | yes      |
| Tampered claims rejected    | yes      |
| Cross-tenant access denied  | yes      |

Where isolation is asserted against test doubles rather than the real policy
layer, record that limitation here — fake-based isolation is not evidence that
the production policy holds.

<!-- unfilled -->
