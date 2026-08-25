---
name: activity-integration-test-implementation
description: "Author integration tests (Layer 2.5) against real databases — local via testcontainers/docker-compose/Supabase CLI, remote via testing environments. Covers migrations, RLS, pgTAP, fixtures, and fallback paths. Use when writing or backfilling integration tests."
---

# Activity: Integration Test Implementation (Layer 2.5)

Author integration tests that exercise code against a real database. Layer 2.5 exists because mocking the data layer makes SQL errors, type mismatches, NULL handling, malformed joins, and RLS policies structurally invisible.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Produce integration tests that fail when the data layer is wrong. If the database is mocked, the test belongs at Layer 2, not here.

Consult `/TESTING.md` first. Its Layer 2.5 boundary governs; this skill supplies the method.

## Layer 2.5 Boundary

- **MUST** use a real database (Postgres, SQLite, etc.) — not a mock or in-memory fake.
- **MUST NOT** mock the data layer. If you mock `sql`, `prisma`, `drizzle`, or the ORM client, the test is Layer 2.
- **MUST NOT** assert on SQL text or internal query shape. Assert on persisted state or returned data.
- **MAY** mock third-party external services (payment gateways, email providers) at the HTTP boundary.

## Part 1 — Local Integration Environment Detection

Detect the easiest applicable local option. Prefer in this order:

### 1. Testcontainers (preferred for isolation)

- Look for `@testcontainers/postgresql` or equivalent in `package.json`/`pom.xml`/`Cargo.toml`.
- Requires Docker. Check: `docker info` succeeds.
- Each test suite gets an ephemeral container — full isolation, no cleanup conflicts.

### 2. Docker Compose

- Look for `docker-compose.yml` or `compose.yml` with a database service.
- Requires Docker. Shared instance across tests — needs explicit state reset.

### 3. Supabase Local CLI

- Look for `supabase/config.toml` or `.supabase/` directory.
- Check: `supabase status` succeeds.
- Provides real Postgres with auth, storage, and edge functions locally.

### 4. Fallback — No Local Environment

- If Docker is unavailable and Supabase CLI is not installed, report the limitation.
- Emit: `SKIPPED(no local database environment — Docker unavailable, Supabase CLI not installed)`.
- Recommend environment setup as a follow-up. Do not silently omit.

## Part 2 — Fixtures, Seeding, and Lifecycle

### Test isolation

- Each test **SHOULD** run in a transaction that rolls back on completion (preferred).
- Alternative: truncate affected tables in `beforeEach`/`afterEach`.
- Alternative for testcontainers: fresh container per suite (slower but fully isolated).

### Seeding

- Shared seed data lives in one location per package (e.g., `test/fixtures/seed.sql` or `test/helpers/seed.ts`).
- Seeds **MUST** be idempotent — running twice produces the same state.
- Seeds **MUST NOT** depend on auto-increment IDs. Use deterministic UUIDs or named references.

### Deterministic teardown

- Every integration test file **MUST** clean up after itself or use rollback isolation.
- Tests **MUST NOT** depend on execution order.
- Tests **MUST NOT** leave residual data that affects other test files.

## Part 3 — Migration Clean-Apply Tests

- **MUST** test that all migrations apply cleanly from an empty database.
- **MUST** verify apply order (no duplicate prefixes, no gaps).
- **MUST** verify idempotency: running migrations twice does not error.
- For large stacks (50+ migrations): run full clean-apply on CI/scheduled; run latest N on PR.
- Report duplicate migration prefixes as a finding.

## Part 4 — Row-Level Security (RLS) Policy Tests

RLS tests **MUST** exercise the real database policy, not application-level tenant checks in JavaScript.

### Multi-session setup

- Create at least two database roles or authenticated sessions (Tenant A, Tenant B).
- Use `SET ROLE` or separate connections per tenant.
- For Supabase: use `supabase.auth.admin.createUser()` for test users, then authenticate with their JWTs.

### Required assertions

| Case                         | Assertion                           |
| ---------------------------- | ----------------------------------- |
| Tenant A reads own data      | Returns expected rows               |
| Tenant A reads Tenant B data | Returns empty set or error          |
| Tenant A writes to Tenant B  | Insert/update fails or is invisible |
| Unauthenticated access       | Denied by policy                    |
| Service role bypasses RLS    | Returns all rows (when expected)    |

### Record limitations

If isolation is asserted against application-level checks rather than the real RLS policy, you **MUST** record: "Production RLS policy unverified — tested against application-layer tenant filtering only."

## Part 5 — pgTAP / Schema Contract Tests

Use pgTAP (or equivalent: `pg_prove`, raw SQL assertions) for:

- Table and column existence.
- Constraint verification (NOT NULL, UNIQUE, CHECK, FK).
- Function and trigger existence and signatures.
- Permission grants per role.
- Index existence for query-critical paths.

When pgTAP is unavailable, use raw `SELECT` assertions against `information_schema` or `pg_catalog`.

## Part 6 — Remote Integration Testing

### Default: read-only

- Inspect schema, permissions, RLS policies, and data shape without mutation.
- Use `EXPLAIN` for query plan verification without executing writes.
- No approval required for read-only operations.

### Testing environment writes

- **REQUIRE** explicit user approval before any write or migration apply.
- Connect only to a dedicated testing environment — never to production for writes.
- After writes: verify applied state, then clean up test data.
- Record: environment name, operation performed, approval evidence.

### No testing environment available

- Report: "Remote integration limited to read-only inspection. No testing environment configured."
- Recommend environment setup. Do not fabricate a pass.

## Output

- Tests written or updated, by path and layer
- Local environment detection result (which option selected, or fallback triggered)
- Migration clean-apply result
- RLS policy test coverage per table with RLS enabled
- Schema contract coverage (tables, constraints, functions)
- Remote integration status (read-only / testing-env / unavailable)
- Stated limitations where real-policy testing was not possible

## Final Instructions

1. You **MUST** consult `/TESTING.md` and respect its Layer 2.5 boundary.
2. You **MUST NOT** mock the data layer. If the database is mocked, the test is Layer 2.
3. You **MUST** detect the local environment and recommend the easiest applicable option.
4. You **MUST** report a limitation when no local or remote environment is available.
5. You **MUST** test RLS against the real policy layer, not application-level checks.
6. You **MUST** require explicit approval before any remote write operation.
7. You **MUST NOT** install dependencies — detect and recommend only.
