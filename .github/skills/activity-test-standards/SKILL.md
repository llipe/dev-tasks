---
name: activity-test-standards
description: "Establish and maintain a project's /TESTING.md contract, detect test-harness defects, and verify that every test package is reachable from the aggregate test command and the CI and deploy gates. Use when bootstrapping or refreshing the testing standard."
---

# Activity: Test Standards

Establish or refresh `/TESTING.md` for a project, detect harness defects, and verify gate reachability. Invoked by the `qa-engineer` agent as step 1 of its procedure.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Produce a filled, accurate `/TESTING.md` for this project, plus a defect report. The contract is per-package: a repository mixing languages **MUST** be describable without forcing every package into one language's conventions.

## Part 1 — Establish the standard for an existing project

Run every detection step. Report `not detected` explicitly rather than guessing.

### 1. Inventory packages

Read the workspace definition (`pnpm-workspace.yaml`, `workspaces` in `package.json`, `pyproject.toml`, Cargo workspace, etc.). List every package. A single-package repository yields one entry.

### 2. Detect framework and runner per package

Look for `vitest`, `jest`, `mocha`, `pytest`, `go test`, `cargo test`, and their config files. Record the runner per package, not per repository.

### 3. Inventory scripts

Record the existing test, lint, format, typecheck, coverage, and audit commands per package, using whatever names the project actually uses. Compare against the canonical set in Part 3.

### 4. Locate tests and naming patterns

Record test directory locations and file-naming conventions (`*.test.ts`, `test_*.py`, `*_test.go`). Note packages with source but no tests.

### 5. Detect coverage tooling

Look for a coverage provider per package (`@vitest/coverage-v8`, `nyc`, `coverage.py`, `pytest-cov`). Record its absence explicitly — absence changes how the gap analysis runs, and it **MUST NOT** be silently inferred as zero coverage or as adequate coverage.

### 6. Detect mocking and fixture approach

Record how test doubles are built, where fixtures live, and whether shared helpers exist. Flag duplicated helpers (the same token builder or client mock rewritten across files) as a defect.

### 7. Fill `/TESTING.md`

Write detected values into the per-package table and the narrative slots.

- If `/TESTING.md` is absent, create it from the shipped placeholder.
- If it is present and filled, additions **MUST** be additive. You **MUST NOT** rewrite or delete consumer-authored content.
- If it is present but every slot is still an unfilled marker, report status `unfilled`. You **MUST** distinguish `unfilled` from `filled`: an empty contract is not an established standard, and downstream agents **MUST NOT** read it as permission.

## Part 2 — Harness-defect detection

Evaluate every check. Report each finding with **file path and expected state** — never as a generic warning.

| Check                        | Defect condition                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Test environment**         | A package rendering DOM or browser components runs under a bare `node` environment with no `jsdom`/`happy-dom`.                       |
| **Test config presence**     | A package has tests but no test config file, so it runs on defaults with no `setupFiles` and no global cleanup.                       |
| **Path-alias parity**        | An alias is defined in `tsconfig.json` but absent from the test config. The first aliased import passes `tsc` and fails at test time. |
| **Global cleanup policy**    | `restoreMocks` is not enabled, or a stubbed global (`fetch`, timers) is never restored. Fragile against pool changes.                 |
| **Runtime version parity**   | Local, CI, and production runtimes differ. Record all three per package; divergence is a finding.                                     |
| **Locale/timezone fixtures** | No locale or timezone fixture policy while the code formats dates, currency, or numbers.                                              |
| **False-green placeholders** | Assertions such as `expect(true).toBe(true)` that report health without exercising anything.                                          |

## Part 3 — Script contract and gate reachability

A correct script **name** is not a working gate. Verify both.

### Canonical names (JS/TS)

`lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `audit`, `validate`. Report missing or misnamed scripts with the expected name.

Non-JS packages are **not** held to these names. Record their equivalent command per purpose instead.

### Reachability checklist

- [ ] Every workspace package containing tests is reachable from the aggregate test command.
- [ ] No test package is silently omitted from the aggregate — an omission is a defect **even when every script name is canonically correct**.
- [ ] The CI workflow's test job invokes the aggregate command.
- [ ] The deploy workflow's quality gate invokes the aggregate command.
- [ ] A gate that is conditional, manually dispatched, or defaulted off is reported as **not automatically enforced**.
- [ ] No CI workflow present at all is reported as `no CI gate found` — an explicit finding, never an implicit pass.

Report per package: reached, or missed with the gate that fails to reach it.

### Worked example

A monorepo defines `test:node` as `app && scraper && db` while the `api` package holds the largest suite. Every script name is canonical. The CI job and the deploy quality gate both run the aggregate.

Correct output: **defect** — `api` is unreachable from the aggregate; the CI gate and the deploy gate both let untested backend code through. Reporting "all script names conform" here is a false pass.

## Part 4 — Integration, E2E, and Contract Infrastructure Detection

Detect the presence and configuration state of higher-layer test infrastructure. Report findings as **informational** — missing infrastructure is not a defect, but it informs the gap analysis.

### Integration testing infrastructure

| Check                   | What to look for                                              |
| ----------------------- | ------------------------------------------------------------- |
| **Testcontainers**      | `@testcontainers/postgresql` or similar in dependencies       |
| **Docker Compose**      | `docker-compose.yml` or `compose.yml` with a database service |
| **Supabase local CLI**  | `supabase/config.toml` or `.supabase/` directory              |
| **Docker availability** | `docker info` succeeds (report if unavailable)                |

### E2E testing infrastructure

| Check                     | What to look for                                                                 |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Playwright config**     | `playwright.config.ts` or `playwright.config.js` present                         |
| **Base URL configured**   | Config references `process.env.BASE_URL` or equivalent (not hardcoded localhost) |
| **Auth setup project**    | A `global-setup` or setup project defined in Playwright config                   |
| **Browser install in CI** | CI workflow includes `playwright install` step                                   |
| **`test:e2e` script**     | Present in `package.json` and reachable from aggregate                           |

### Contract validation infrastructure

| Check                      | What to look for                                       |
| -------------------------- | ------------------------------------------------------ |
| **OpenAPI spec**           | `openapi.yaml`, `openapi.json`, `swagger.*` in repo    |
| **AsyncAPI spec**          | `asyncapi.yaml`, `asyncapi.json` in repo               |
| **`dt` CLI**               | `which dt` succeeds                                    |
| **`test:contract` script** | Present in `package.json` and reachable from aggregate |

### Reporting

Report each finding as:

- `[INFO] <infrastructure> detected: <path or status>`
- `[INFO] <infrastructure> not found — Layer {X} tests require this`

These are informational findings for the gap analysis. They do **NOT** block or fail the standards check.

## Failure Modes

| Condition                     | Required behavior                                                           |
| ----------------------------- | --------------------------------------------------------------------------- |
| No `package.json` or manifest | Report `not applicable` with reason. Do not crash, do not pass.             |
| Malformed manifest            | Report the parse failure with file and line. Do not report zero packages.   |
| No CI workflow files          | Report `no CI gate found`.                                                  |
| Very large workspace          | Complete, or return a bounded partial result stating what was not analyzed. |
| Re-run with no changes        | Produce no duplicate sections and no already-fixed defects.                 |

## Output

- `/TESTING.md` status: `created` | `filled` | `unfilled` | `present`
- Per-package detection table
- Harness defects: each with file path and expected state
- Script contract: missing or misnamed scripts with expected names
- Reachability: packages reached, packages missed, CI gate status, deploy gate status
- What was not analyzed, and why

## Final Instructions

1. You **MUST** run every detection step and every harness check.
2. You **MUST** report each defect with a file path and the expected state.
3. You **MUST** verify reachability, not just script naming.
4. You **MUST** preserve consumer-authored `/TESTING.md` content.
5. You **MUST** distinguish an unfilled placeholder from a filled contract.
6. You **MUST NOT** install dependencies or edit application source.
7. You **MUST NOT** report a pass for anything you could not inspect.
