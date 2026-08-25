---
name: activity-e2e-test-implementation
description: "Author Playwright end-to-end tests from verifier scenario tables. Covers auth, state reset, CI config, and scenario-to-spec traceability. Use when writing or backfilling E2E tests."
---

# Activity: E2E Test Implementation (Playwright)

Convert `verifier` Design Mode scenario tables into executable Playwright specs. This skill is the execution counterpart to `activity-e2e-test-design`, which produces the scenario tables.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Produce Playwright E2E specs that fail when user-facing behavior is wrong. E2E tests assert on observable outcomes — never on internal state, database rows, or implementation details.

Consult `/TESTING.md` first. Its E2E layer boundary governs; this skill supplies the method.

## E2E Layer Boundary

- **MUST** assert on user-visible behavior (page content, navigation, HTTP responses).
- **MUST NOT** assert on internal state, database contents, or implementation details.
- **MUST NOT** mock the application under test. The full stack runs.
- **MAY** seed test data via API or database before the test begins.

## Part 1 — Playwright Prerequisite Contract

Before authoring specs, verify or establish these prerequisites:

### Authentication strategy

| Strategy                                       | When to Use                                   | How                                                                                                         |
| ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **`storageState` via setup project** (default) | Multi-test suites sharing a logged-in session | A `global-setup.ts` or setup project authenticates once, saves `storageState.json`, and all specs reuse it. |
| **Per-test programmatic login**                | Tests that need different users or roles      | Each spec calls login API directly in `beforeEach`. Slower but flexible.                                    |
| **API-token seeding**                          | API-only E2E, no browser UI                   | Set auth headers directly via `request.newContext()`. No browser needed.                                    |

Default to `storageState` unless the test requires a different user or role per test.

### Seeded test users

- Create dedicated test users (not production accounts).
- Credentials reach CI via environment variables or secrets — never hardcoded in the repository.
- Use a deterministic naming convention: `e2e-user-admin@test.local`, `e2e-user-member@test.local`.
- Document how to create/reset test users in the project's test setup README.

### Base URL and environment resolution

- Use `baseURL` in `playwright.config.ts`, resolved from `process.env.BASE_URL` or `process.env.PLAYWRIGHT_BASE_URL`.
- Never hardcode `localhost:3000` — CI and staging use different URLs.
- Provide a `.env.test.example` showing required variables.

### Database state reset between runs

Choose one:

- **Migration + seed** (preferred): drop, migrate, seed before the test suite.
- **Transaction rollback**: wrap each test in a transaction (complex for E2E).
- **Snapshot restore**: restore a known-good database snapshot before runs.

State reset **MUST** run in `globalSetup` or a setup project, not inside individual specs.

### Trace, screenshot, and video retention

- **Default:** `on-first-retry` for traces, `only-on-failure` for screenshots, `off` for video.
- **CI:** retain artifacts as test attachments. Configure `outputDir` and artifact upload in CI workflow.
- Keep retention bounded — do not retain video for every passing test.

### Browser install in CI

- CI **MUST** install browsers explicitly: `npx playwright install --with-deps chromium`.
- Locally: `npx playwright install` on first run.
- Pin Playwright version in `package.json` — do not use `latest`.

### Sharding (large suites)

- For suites >50 specs: shard across CI workers using `--shard=1/4`, `--shard=2/4`, etc.
- Configure in CI matrix, not in `playwright.config.ts`.

## Part 2 — Scenario-to-Spec Mapping

### Traceability convention

Every Playwright spec **MUST** be traceable to a `verifier` Design Mode scenario.

**Annotation format:** Include `@scenario SC-{n}` in the test title or as a comment:

```typescript
// @scenario SC-1
test("SC-1: Successful login with valid credentials", async ({ page }) => {
  // ...
});
```

Or in the test title directly:

```typescript
test("[SC-1] User logs in with valid credentials", async ({ page }) => {
  // ...
});
```

### Traceability chain

```
AC-{n} → SC-{n} (test plan) → .spec.ts file / test block (@scenario SC-{n}) → Pass/Fail
```

The `verifier` audit resolves scenario IDs to spec files by searching for `@scenario SC-{n}` or `SC-{n}:` patterns. Orphaned scenarios (in the plan but not in specs) are reported as uncovered.

### File naming

- One spec file per feature or user journey: `login.spec.ts`, `checkout.spec.ts`.
- Group related scenarios in one file. Do not create one file per scenario unless they are independent flows.

## Part 3 — Converting Scenario Tables to Specs

Given a scenario table from `activity-e2e-test-design`:

1. **Read the scenario.** Extract: preconditions, steps, expected result, pass criteria.
2. **Write the spec.** Map steps to Playwright actions. Map pass criteria to assertions.
3. **Annotate.** Add `@scenario SC-{n}` to the test.
4. **Handle preconditions.** Seed required state in `beforeAll`/`beforeEach` or a fixture.
5. **Assert observable outcomes.** Use `expect(page)` or `expect(response)` — never internal state.

### Retry and flakiness

- Use Playwright's built-in retry (`retries: 2` in config) for CI.
- Prefer explicit `await expect(locator).toBeVisible()` over arbitrary `waitForTimeout`.
- If a test is flaky, fix the root cause (race condition, state leak) rather than increasing retries.
- A flaky test that occasionally passes is worse than no test.

### Test isolation

- Each spec **MUST** be independent — runnable in any order, in parallel.
- Never rely on state from a previous test. Use fixtures or setup projects.
- Use `test.describe.configure({ mode: 'serial' })` only when tests represent a true sequential flow.

## Output

- Specs written or updated, by path
- Scenario-to-spec mapping table: `SC-{n}` → file path and test name
- Uncovered scenarios (in the plan but not yet implemented)
- Prerequisites missing (base URL, auth setup, browser install, etc.)
- Stated limitations (e.g., "no staging environment — E2E limited to localhost")

## Final Instructions

1. You **MUST** consult `/TESTING.md` and respect its E2E layer boundary.
2. You **MUST** annotate every spec with its scenario ID (`@scenario SC-{n}`).
3. You **MUST NOT** assert on internal state or implementation details.
4. You **MUST** verify Playwright prerequisites before authoring specs.
5. You **MUST** report uncovered scenarios from the test plan.
6. You **MUST** address flakiness causes, not mask them with retries.
7. You **MUST NOT** install dependencies — detect and recommend only.
