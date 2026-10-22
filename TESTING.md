---
version: 1.6
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

| Package                | Language       | Runner       | Test command    | Test environment             | Coverage tooling                                                                |
| ---------------------- | -------------- | ------------ | --------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `@llipe.com/dev-tasks` | TypeScript/ESM | Vitest 3.2.6 | `pnpm run test` | Node (`environment: "node"`) | V8 via `@vitest/coverage-v8` 3.2.6 (exact pin), run by `pnpm run test:coverage` |

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

- CI workflows `validate.yml` and `publish-npm.yml` use Node `24`.
- The package declares production engine `>=24`.
- Local validation has been observed on Node `v26.7.0`, which is above the declared engine floor.
- The full test suite passes on both runtimes, locally on Node 26 and on Node 24 in the `validate.yml` pull request check, apart from the known HEAD-dependent test listed under [Harness defects to track](#harness-defects-to-track). That test depends on the git state of the checkout, not on the Node version.
- A deployment of CI against Node 24 while the development environment uses Node 26 represents a minor runtime mismatch but carries no known risk to the harness itself; no runtime-specific failure has been observed on either version.

## Commands

| Script             | Purpose                                                                                               | Status                              |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `lint`             | ESLint **and** `tsx core/checks/run.ts` (docs-structure, decision-log, glossary, vocabulary checks)   | present                             |
| `lint:fix`         | ESLint auto-fix                                                                                       | present                             |
| `format`           | Prettier write                                                                                        | present                             |
| `format:check`     | Prettier verification                                                                                 | present                             |
| `typecheck`        | TypeScript analysis                                                                                   | present                             |
| `test`             | Aggregate Vitest run; reaches this package's unit and integration tests                               | present                             |
| `test:unit`        | Unit tests                                                                                            | present                             |
| `test:integration` | Integration-directory tests; these are CLI/filesystem integration tests, not Layer 2.5 database tests | present                             |
| `test:e2e`         | Playwright tests                                                                                      | not configured; no Playwright setup |
| `test:coverage`    | Coverage measurement (`vitest run --coverage`); separate from `validate`, which does not run coverage | present                             |
| `audit`            | Production dependency audit                                                                           | present                             |
| `validate`         | `typecheck` → `lint` → `format:check` → aggregate `test`                                              | present                             |

### Gate reachability

- **Aggregate test command:** `pnpm run test` (`vitest run`), which includes `test/**/*.test.ts` and excludes `test/fixtures/**`; the single package is reached, including both `test/unit/` and `test/integration/`.
- **CI gate:** `validate.yml` runs `pnpm run validate`, which reaches the aggregate test command, on every pull request into any base branch (#248; runbook `docs/runbooks/runbook-diagnose-pr-validate.md`). `publish-npm.yml` runs it again on the tag-triggered publish. The PR check is not yet _required_ by branch protection: that is a manual repository setting (`docs/runbooks/runbook-configure-branch-protection.md`). Coverage (`test:coverage`) is not part of either gate.
- **Deploy gate:** no deploy workflow was detected; deploy quality-gate status is not automatically enforced.
- `release-bundle.yml` does not invoke `validate` or the aggregate test command.

## Coverage

### Thresholds and baseline policy

- Measurement tool: V8, through `@vitest/coverage-v8` 3.2.6, pinned exactly to the installed `vitest` version. `vitest.config.ts` scopes measurement to `core/**/*.ts` and `bin/**/*.ts`. Run it with `pnpm run test:coverage`; reports are written to `coverage/` (text summary on stdout, plus HTML, `clover.xml`, and `coverage-final.json`), which is ignored by git, Prettier, and ESLint.
- Gate placement: coverage is **not** part of `validate`. `validate` runs the plain aggregate `test` command, so its runtime is unaffected by coverage instrumentation.
- Threshold policy: no numeric threshold has been established. The baseline below is **recorded, not enforced** this pass: `vitest.config.ts` declares no `thresholds`, and a coverage drop does not fail any script or gate.
- Regression policy: compare a new `pnpm run test:coverage` run against the baseline and report the delta in the `qa-engineer` coverage gate. Whether to enforce a floor is a later, separate decision.

### Baseline

Measured 2026-10-02 at commit `463638d` (branch `story/S-247-coverage-baseline`, off `integration/quality-gate-hardening` at `1224aee`), 69 test files / 2271 tests, all passing. Covered / total in parentheses.

| Tree      | Files | Statements           | Branches           | Functions        | Lines                |
| --------- | ----- | -------------------- | ------------------ | ---------------- | -------------------- |
| `core/**` | 23    | 91.12% (2063 / 2264) | 91.47% (644 / 704) | 91.75% (89 / 97) | 91.12% (2063 / 2264) |
| `bin/**`  | 2     | 0.00% (0 / 500)      | 0.00% (0 / 2)      | 0.00% (0 / 2)    | 0.00% (0 / 500)      |
| All files | 25    | 74.63% (2063 / 2764) | 91.21% (644 / 706) | 89.89% (89 / 99) | 74.63% (2063 / 2764) |

How to read these numbers:

- The 0% for `bin/**` is mostly a measurement artifact. `test/unit/cli-binaries.test.ts` and the integration suite run `bin/dev-tasks.ts` by spawning it in a `tsx` child process. V8 coverage instruments only the Vitest worker process, so child-process execution is not recorded.
- `bin/parse-args.ts` is a real gap as well as an artifact: no test imports it directly, so it is exercised only end to end through the CLI child process.
- The same artifact affects `core/**`. `core/checks/run.ts` reads 0% (57 statements) because it runs only through `tsx`, from the `lint` script or a child process. The `core/**` baseline is therefore slightly understated, but it is still the meaningful baseline; the `All files` row is pulled down mainly by `bin/**`.
- Statements and lines are identical because the V8 provider maps coverage per line.

When coverage cannot be measured, report `coverage_gate: SKIPPED(<non-empty reason>)` and enumerate untested or weakly tested surfaces, source-to-test ratios, exclusions, and limitations. Never infer zero coverage or a pass.

## Fixtures and Mocking

Tests primarily use deterministic fixture repositories under `test/fixtures/`, temporary directories rooted in the OS temp directory, and subprocess execution for CLI entry points. Fixture projects that intentionally model harness defects are excluded from Vitest collection. No duplicated token builders or client mocks were detected, and no global `fetch`/timer stubs were detected. Any future global stub must be restored explicitly.

Gold or generated fixture files must record their source and regeneration path where applicable. Generated catalog outputs are test artifacts, not coverage evidence, and must not be used as durable validation without freshness and scope checks.

## Security-Negative Tests

This package has no authentication or authorization implementation path in the analyzed scope. If one is added, tests are mandatory for invalid signature, expired credential, wrong issuer/audience, tampered claims, missing credential, insufficient permission, and cross-tenant access where applicable. Tests against a fake policy layer must state that production policy remains unverified.

## Harness defects to track

### Environment-fragility patterns

The test suite runs to completion, and its only known intermittent failure is the HEAD-dependent test in item 5 below. Some patterns in test design carry environment-fragility risk if new tests adopt them. Avoid these patterns:

- **Root-permission assumptions.** A test that `chmod`s a path unwritable and expects a failure passes only as a non-root user. Root ignores the bits. `test/unit/migrate-docs.test.ts` shows the correct pattern: probe whether writes are actually blocked, and `ctx.skip()` when they are not. `checkCacheDir` and `runUpdate --force` should adopt it if they are written.
- **PATH assumptions.** A test that sets `PATH=/usr/bin:/bin` to simulate a missing binary depends on that binary being absent from those directories. `yq` is present at `/usr/bin/yq` in some containers. A purpose-built empty directory is the reliable form.

1. `vitest.config.ts`: `restoreMocks` is not enabled. Expected state: enable explicit mock restoration if mocks/stubs are introduced, and retain per-test cleanup for any global stubs.
2. Coverage of `bin/**`: resolved for `core/**` by #247 (provider, `test:coverage`, and a recorded baseline). `bin/**` still measures 0% because it is exercised only through child processes, which in-process V8 coverage does not capture. Expected state: either measure child processes (for example via `NODE_V8_COVERAGE`) or record `bin/**` as out of measured scope.
3. CI/deploy wiring: the pull request half is resolved by #248 — `validate.yml` runs `pnpm run validate` on every pull request. Still open: no deploy workflow invokes the aggregate test command, and the pull request check is not yet a _required_ status check in branch protection (a manual repository setting, see `docs/runbooks/runbook-configure-branch-protection.md`). Expected state: every CI test job and deploy quality gate runs `pnpm run test` or `pnpm run validate`, and the pull request check is required.
4. Runtime alignment: `validate.yml` and `publish-npm.yml` use Node 24 while local development uses Node 26. Both runtimes pass the full test suite (the HEAD-dependent test in item 5 aside, which is not runtime-related), so there is no blocker to release. Future work may align these to a single supported range or explicitly document the tested range in the engine constraint.
5. HEAD-dependent test: `test/unit/infra-script-contract.test.ts`, case `deploy.sh prod — ref rules (AC-4) > refuses when the ref is not an annotated tag on main`, expects a refusal and fails when `HEAD` is the tagged release commit. It was observed failing intermittently during the quality-gate-hardening batch (#245–#248). The pull request runbook (`docs/runbooks/runbook-diagnose-pr-validate.md`) tells a reader to re-run the job once when it is the only failure. Expected state: the test's result does not depend on which commit is checked out.

## Known limitations

**Regex parity tests prove presence, not meaning.** The prompt parity suites (for example `test/unit/projects-tracking-parity.test.ts`) prove that each required sentence is present, appears in the required order, and is identical across the `.claude`, `.github` and `.kiro` trees. They cannot prove that nearby text does not contradict, qualify or weaken those sentences: an added "unless", a synonym, or a conflicting rule elsewhere in the same prompt passes every assertion. Wave 2 of projects-tracking closed with 8 such synonym and qualifier probes still surviving after hardening; chasing them with more patterns has diminishing returns. Meaning-level fidelity therefore rests on the `verifier` audit (Audit Mode fidelity reports) and on the dogfood reads in the Dogfood checks table, not on the test suite. A green parity suite is evidence of presence only.

## Dogfood checks

Behavioural acceptance criteria of the projects-tracking PRD cannot run inside Vitest: a mocked `gh` would test the mock, not the agent (D-39). Each is verified by reading GitHub after a real event, using the `DF-*` rows of `workstream/test-plan-projects-tracking-phase-1.md`, and recorded here with the satisfying issue number. `pending` means the event has not happened yet; `n/a (pre-rule)` marks the two wave 1 stories that ran before S-003's status-comment rule existed in the loaded prompt (D-42).

| Criterion                                                                           | Event                                                                                                                                                       | Issue                                 | Status                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD AC-1 — publish creates the PRD/wave/story hierarchy                             | Wave 2 publish by `product-engineer` (DF-1, zero-match path)                                                                                                | #289, #290, #291 to #296              | observed 2026-10-21: wave 2 publish created the PRD and wave tracking issues and attached six stories, hierarchy verified(7 of 7)                                                         |
| PRD AC-2 (live half) — tracking issues carry `level:` only                          | Wave 2 publish (DF-1)                                                                                                                                       | #289, #290                            | observed 2026-10-21: both tracking issues carry their `level:` label only                                                                                                                 |
| PRD AC-3 (b) — story status comment, S-001                                          | `/developer` on #270 (DF-2)                                                                                                                                 | #270                                  | n/a (pre-rule)                                                                                                                                                                            |
| PRD AC-3 (b) — story status comment, S-002                                          | `/developer` on #271 (DF-2)                                                                                                                                 | #271                                  | n/a (pre-rule)                                                                                                                                                                            |
| PRD AC-3 (b) — story status comment, S-003                                          | `/developer` on #272 (DF-2)                                                                                                                                 | #272                                  | observed 2026-10-20: one marked comment (id 6302983274), edited in place; comment created at sub-task 3.2a, after the draft PR, because the rule did not exist before 3.2 (S-003 DR-2)    |
| PRD AC-3 (b) — story status comment, S-004                                          | `/developer` on #273 (DF-2)                                                                                                                                 | #273                                  | observed 2026-10-20: one marked comment (id 6303270800), edited in place                                                                                                                  |
| PRD AC-3 (b) — story status comment, S-005                                          | `/developer` on #274 (DF-2)                                                                                                                                 | #274                                  | observed 2026-10-20: one marked comment (id 6303586826), edited in place                                                                                                                  |
| PRD AC-3 (b) — story status comment, S-006                                          | `/developer` on #275 (DF-2)                                                                                                                                 | #275                                  | observed 2026-10-21: one marked comment (id 6305768927), edited in place                                                                                                                  |
| PRD AC-3 (a, live half) — Project Status written only by automations                | Consolidated PR to main opens with `Closes #N` (Status → In progress) and merges (→ Done); story PRs into the integration branch move nothing (D-50) (DF-5) | #270 to #275; #285, #290 to #296      | observed: wave 1 Done after PR #282 merged; wave 2 In progress for all eight issues at 20:39Z 2026-10-22 after consolidated PR #312 opened, read with `projectItems`, no agent write      |
| FR-24 — wave update, no-parent path (404)                                           | Any wave 1 story's `/developer` run (DF-3)                                                                                                                  | #272, #273, #274, #275                | observed: `gh api …/parent` returns 404; closeout carries `wave_status: skipped(no parent)`                                                                                               |
| FR-24 — wave update, success path (200)                                             | First main-thread `/developer` run on a wave 2 story: parent found, wave comment edited (DF-3)                                                              | pending                               | pending                                                                                                                                                                                   |
| D-36 — second publish reuses the PRD issue (one-match path)                         | Wave 3 publish (DF-1b)                                                                                                                                      | pending                               | pending                                                                                                                                                                                   |
| PRD AC-5 (live half) — runbook exercise (DF-4)                                      | Owner follows `docs/runbooks/runbook-configure-github-project.md` on `llipe/dev-tasks`                                                                      | #274 (Project 5)                      | observed 2026-10-21: Project 5 created from the Team planning template; seven shipped workflows enabled; auto-add `is:issue`; fields kept by decision D-48                                |
| Wave 2 DF-6 — checkpoint committed after every merge                                | `/planner` wave 2 run (S-008 rule)                                                                                                                          | integration/projects-tracking-phase-2 | observed 2026-10-22, hand-applied (rule merged at S-008): six `chore(planner): checkpoint after S-0xx merge` commits, each after its merge                                                |
| Wave 2 DF-7 — state file carries `Wave issue` and `PRD issue`                       | `/planner` wave 2 run (S-008, S-018 rules)                                                                                                                  | #290, #289                            | observed 2026-10-22, hand-applied                                                                                                                                                         |
| Wave 2 DF-8 — one wave status comment, edited in place                              | `/planner` wave 2 run (S-009 rule)                                                                                                                          | #290                                  | partly observed 2026-10-22, hand-applied: one marker comment edited at run start and every merge; never edited at a story's PR-ready closeout, so no story showed `PR open` (rollup RD-1) |
| Wave 2 DF-9 — no per-merge table comments                                           | `/planner` wave 2 run (S-009 rule)                                                                                                                          | #290 to #296                          | observed 2026-10-22                                                                                                                                                                       |
| Wave 2 DF-11 — consolidated PR carries `Closes` for every merged story and the wave | Consolidated PR open (S-010 rule)                                                                                                                           | #312                                  | observed 2026-10-22: `Closes` for #291 to #296, #290 and #285 under `## Why`; GitHub links all eight                                                                                      |
| Wave 2 DF-15 — close-out runs from the merged prompt                                | Phase 6 in a fresh session on `main` (S-011 rule)                                                                                                           | close-out PR                          | pending                                                                                                                                                                                   |
| Wave 2 DF-16 — PRD status comment at run start, PR open and close-out               | `/planner` wave 2 run (S-018 rule)                                                                                                                          | #289                                  | run start observed 2026-10-22, hand-applied; PR open and close-out pending                                                                                                                |

## Changelog

| Version | Date       | Change                                                                                                                                                                                        | Author             |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1.6     | 2026-10-22 | DF-5 (PRD AC-3 a) and wave 2 DF-11 observed on consolidated PR #312: GitHub moved all eight linked issues to In progress (#285).                                                              | planner            |
| 1.5     | 2026-10-22 | Known limitations section: regex parity tests prove presence, not meaning (wave 2 decision). PRD AC-1 row observed; wave 2 dogfood rows DF-6 to DF-16 added (hand-applied, Design Mode A-25). | planner            |
| 1.4     | 2026-10-22 | Changelog rows 1.2 and 1.3 moved out of the Test Layers table into this section (A-38); no content change.                                                                                    | developer          |
| 1.3     | 2026-10-21 | DF-1 rows observed on the wave 2 publish (#289, #290, #291 to #296); DF-1b reuse path still pending.                                                                                          | product-engineer   |
| 1.2     | 2026-10-21 | DF-5 row observed: Project Status reached Done for #270 to #275 through GitHub's own automation when PR #282 merged (D-50); the row's Criterion cell, overwritten on 2026-10-21, restored.    | planner            |
| 1.1     | 2026-10-21 | Dogfood checks table added for the projects-tracking wave 1 behavioural criteria (D-39, D-42): PRD AC-1 pending wave 2's publish, PRD AC-3 rows per story, FR-24 and D-36 paths, DF-4.        | @llipe / developer |
| 1.0     | 2026-08-18 | Initial testing standard.                                                                                                                                                                     | qa-engineer        |
