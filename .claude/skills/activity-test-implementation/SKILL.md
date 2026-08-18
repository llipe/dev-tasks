---
name: activity-test-implementation
description: "Author tests for Layer 1 and Layer 2 — unit, schema validation, backend component, mocked APIs, fixtures and gold datasets — with enforceable per-layer boundaries and a mandatory security-negative category. Use when writing or backfilling tests."
---

# Activity: Test Implementation

Author tests for Layer 1 (deterministic foundations) and Layer 2 (constrained model and tool tests), with explicit boundaries for what belongs where. Invoked by the `qa-engineer` agent as step 2 of its procedure.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Produce tests that fail when behavior is wrong. Coverage is a by-product, not the objective: a suite can execute every line while asserting nothing that would catch a defect.

Consult `/TESTING.md` first. Its per-layer boundaries govern; this skill supplies the method.

## Layer 1 — Deterministic Foundations

### Unit tests

- **Scope:** one module's observable behavior. No I/O, no network, no real database, no clock dependence.
- **Isolation boundary:** stub at the module's own dependency edge, not three layers down. If a test needs four mocks to construct, the unit is too large or the boundary is wrong.
- **Test doubles:** a double stands in for a dependency. It **MUST NOT** reimplement the logic it replaces. A mock that grows a copy of production behavior means the test validates the mock.
- **Table-driven cases:** prefer one parameterized case list over many near-identical tests for input-domain variation.
- **Naming:** state the behavior and the condition — `rejects a negative page size`, not `test pagination 2`.
- **Assertions:** assert observable outcomes. Asserting the text of a generated query, or how many times an internal helper was called, couples the test to implementation without proving the behavior.

**Layer 1 MUST NOT:** open sockets or database connections, read the wall clock without injection, depend on test execution order, or assert on internal call counts as a proxy for behavior.

### Schema validation

- Validate every externally-shaped payload against its schema: API request and response bodies, config files, event payloads, persisted documents.
- Required cases per schema: valid instance; missing required field; wrong type; unknown extra field (assert the documented policy, tolerate or reject); boundary values.
- Where a schema and a hand-written type can drift, assert they agree.

## Layer 2 — Constrained Model and Tool Tests

### Backend component tests

- **Scope:** a route handler, job, or service exercised through its real entry point, with the real in-process application wiring and a real datastore where feasible; only third-party externals are doubled.
- This layer exists because Layer 1 cannot see query syntax errors, wrong column types, `NULL` handling, or malformed joins. If the data layer is mocked everywhere, those defects are structurally invisible.
- Assert on the response or persisted state, not on the statement sent to the driver.

**Layer 2 MUST NOT:** reimplement in the test what the datastore does in production. Filtering, sorting, and pagination performed by a fake in the test language proves nothing about the query that ships.

### Mocked APIs

- Double at the transport boundary (HTTP interception), not by replacing your own client module. Replacing the client skips serialization, headers, status handling, and error mapping.
- Required cases per external dependency: success; 4xx; 5xx; timeout; malformed body; empty body.
- Record which behaviors are asserted against a double rather than the real service, and treat that as a stated limitation.

### Fixtures and gold datasets

- Shared fixtures and helpers live in one place per package. A token builder or client mock duplicated across files is a defect — consolidate it.
- Golden files: record how each was captured and how to regenerate it. State the source and date.
- Prefer asserting invariants and identities over long exact-value snapshots. Asserting `len(rows) == 84` against a real sample means replacing the sample breaks many tests at once for no behavioral reason.
- Derive fixture paths from a package-rooted anchor. Deriving them by walking up a fixed number of parent directories turns a moved package into a misleading "file not found".

## Mandatory Security-Negative Category

**REQUIRED** for every authentication and authorization code path. Positive-path tests alone provide no security evidence.

| Case                         | Assertion                                                       |
| ---------------------------- | --------------------------------------------------------------- |
| **Invalid signature**        | A token signed with the wrong key, or unsigned, is rejected.    |
| **Expired credential**       | A token past its expiry is rejected.                            |
| **Wrong issuer or audience** | A token issued for another party is rejected.                   |
| **Tampered claims**          | A payload modified after signing is rejected.                   |
| **Cross-tenant access**      | A caller cannot read or write another tenant's data.            |
| **Missing credential**       | An unauthenticated request is rejected.                         |
| **Insufficient permission**  | An authenticated caller lacking the right is denied, not 404'd. |

### The "tests faithful to insecure code" trap

A suite that asserts only the behavior the implementation happens to have will pass over a vulnerability. If the code merely decodes a token without verifying its signature, and the tests construct unsigned tokens, every test passes and nothing is verified.

You **MUST** treat this as a **finding**, not a pass. Report it as a security finding naming the module, the missing verification, and the tests that encode the permissive behavior. A green suite is not evidence.

Where isolation is asserted against test doubles rather than the real policy layer — application-level tenant checks standing in for database row-level security — you **MUST** record that the production policy is unverified.

## Edge-Case Coverage per Behavior

For each behavior under test, cover: empty and missing input; boundary values on both sides; the maximum-size case; malformed encoding; and the documented failure mode. Where the code parses external documents, include corrupt, truncated, and access-protected inputs, and encoding variants beyond ASCII.

## Effort Allocation

Weight test effort by risk and complexity, not by ease of writing. Thirty tests on pure helpers alongside four on the module handling multi-currency, multi-section parsing is an inversion. Report the imbalance when you find it.

## Output

- Tests written or updated, by path and layer
- Layer-boundary violations found in existing tests
- Security-negative gaps, per auth path
- Behaviors asserted only against doubles, as stated limitations
- Duplicated fixtures or helpers recommended for consolidation
- Effort-allocation imbalances

## Final Instructions

1. You **MUST** consult `/TESTING.md` and respect its layer boundaries.
2. You **MUST** write the security-negative cases for every auth path in scope.
3. You **MUST** report a green suite over a permissive implementation as a finding.
4. You **MUST NOT** author a double that reimplements the logic it replaces.
5. You **MUST NOT** write placeholder assertions such as `expect(true)`.
6. You **MUST** record which behaviors are verified only against doubles.
7. You **MUST NOT** edit application source to make a test pass — report the needed change instead.
