# Activity: Contract Test Design

Generate consumer/provider contract test strategies and schema compatibility checks from a specification or user story. Produces contract validation scenarios that ensure API boundaries, data schemas, and inter-service agreements are honored. Invoked by the `black-box-tester` agent in Design Mode.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Derive contract-level test scenarios that validate API boundaries, data schemas, and inter-service agreements from the outside. Contract tests verify that providers deliver what consumers expect, without coupling to internal implementation.

## Context

This activity assumes:
- A numbered list of acceptance criteria is available (produced by Phase 2 of `black-box-tester`).
- API endpoints, data entities, and integration points have been identified from the source artifact.
- The output feeds into the contract section of the test plan assembled by `black-box-tester`.

## Process

1. **Identify contracts.** Extract every API endpoint, event/message schema, and inter-service boundary from the source artifact.
2. **Classify contract type:**
   - **Consumer-driven:** Consumer defines expected request/response shape; provider must satisfy it.
   - **Provider-driven:** Provider publishes a schema; consumers must conform.
   - **Schema compatibility:** Data models shared across boundaries must remain backward-compatible.
3. **Generate scenarios.** For each contract:
   - ≥1 valid contract scenario (expected shape → accepted).
   - ≥1 missing required field scenario.
   - ≥1 extra/unknown field scenario (test tolerance or strict rejection).
   - ≥1 type mismatch scenario (e.g., string where number expected).
   - ≥1 version compatibility scenario (if versioning applies).
4. **Map to ACs.** Link each contract scenario to the relevant acceptance criteria.
5. **Return structured output** for inclusion in the test plan.

## Scenario Template

```markdown
### CT-{id}: {Contract Scenario Title}

| Field | Value |
|-------|-------|
| **AC(s)** | AC-{n} |
| **Contract type** | consumer-driven / provider-driven / schema-compat |
| **Boundary** | {e.g., `POST /api/orders` or `OrderCreated event`} |
| **Direction** | request / response / event-payload |
| **Input** | {Exact payload or schema excerpt} |
| **Expected Result** | {Accepted / Rejected with specific error} |
| **Pass Criteria** | {HTTP status, error code, or schema validation result} |
```

## Example

Given a spec defining:
> *`POST /api/orders` accepts `{ "items": [...], "customerId": "string" }` and returns `{ "orderId": "string", "status": "pending" }`.*

### CT-1: Valid order creation request

| Field | Value |
|-------|-------|
| **AC(s)** | AC-1 |
| **Contract type** | consumer-driven |
| **Boundary** | `POST /api/orders` |
| **Direction** | request |
| **Input** | `{ "items": [{"sku": "A1", "qty": 2}], "customerId": "cust-123" }` |
| **Expected Result** | HTTP 201, response contains `orderId` (string) and `status: "pending"`. |
| **Pass Criteria** | Status 201. Response JSON matches schema. `orderId` is non-empty string. |

### CT-2: Missing required field — customerId

| Field | Value |
|-------|-------|
| **AC(s)** | AC-1 |
| **Contract type** | consumer-driven |
| **Boundary** | `POST /api/orders` |
| **Direction** | request |
| **Input** | `{ "items": [{"sku": "A1", "qty": 2}] }` |
| **Expected Result** | HTTP 400, error message references missing `customerId`. |
| **Pass Criteria** | Status 400. Error body includes field name `customerId`. |

### CT-3: Extra unknown field tolerance

| Field | Value |
|-------|-------|
| **AC(s)** | AC-1 |
| **Contract type** | schema-compat |
| **Boundary** | `POST /api/orders` |
| **Direction** | request |
| **Input** | `{ "items": [...], "customerId": "cust-123", "unknownField": true }` |
| **Expected Result** | Either accepted (ignoring extra field) or rejected with a clear error — behavior matches documented schema policy. |
| **Pass Criteria** | Response is consistent with the spec's stated policy on additional properties. |

### CT-4: Type mismatch — customerId as number

| Field | Value |
|-------|-------|
| **AC(s)** | AC-1 |
| **Contract type** | consumer-driven |
| **Boundary** | `POST /api/orders` |
| **Direction** | request |
| **Input** | `{ "items": [...], "customerId": 12345 }` |
| **Expected Result** | HTTP 400, type validation error for `customerId`. |
| **Pass Criteria** | Status 400. Error references type mismatch. |

## Output

This skill returns a list of contract scenarios in the template format above. The calling agent (`black-box-tester`) assembles them into the contract section of the test plan.

## Final Instructions

1. You **MUST** produce contract scenarios for every API endpoint and inter-service boundary identified in the source artifact.
2. You **MUST** include at least one valid, one missing-field, one type-mismatch, and one extra-field scenario per contract.
3. You **MUST** include version compatibility scenarios when the spec mentions API versioning or schema evolution.
4. You **MUST NOT** reference internal code — all assertions are based on the documented contract (API spec, schema, event definition).
5. You **MUST** flag any boundary that lacks a clear contract definition and recommend clarification.
