# Activity: Edge-Case Refinement

Systematic edge-case discovery by category with concrete examples for each. Produces a categorized edge-case catalog mapped to acceptance criteria, ensuring no high-risk boundary goes untested. Invoked by the `black-box-tester` agent in Design Mode.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Discover and catalog edge cases across all relevant categories for the feature under test. Every edge case **MUST** be tied to at least one acceptance criterion and include a concrete, testable example.

## Context

This activity assumes:
- A numbered list of acceptance criteria is available (produced by Phase 2 of `black-box-tester`).
- E2E scenarios and contract scenarios have already been drafted (or will be composed alongside).
- The output feeds into the edge-case section of the test plan assembled by `black-box-tester`.

## Edge-Case Categories

You **MUST** evaluate every category below against the source artifact. For each category that applies, produce ≥1 concrete edge case. For categories that do not apply, explicitly note `N/A — {reason}`.

### 1. Input Domain

Boundary values, empty/null/missing inputs, maximum-length strings, special characters, Unicode, encoding mismatches.

**Example:** A name field accepts 1–100 characters. Edge cases: empty string, 1 character, 100 characters, 101 characters, string with only whitespace, string with emoji, string with null bytes.

### 2. State Transitions

Invalid state transitions, re-entrant operations, concurrent state changes, transitions from terminal states.

**Example:** An order can move `pending → confirmed → shipped → delivered`. Edge cases: attempt `pending → shipped` (skip confirmed), attempt `delivered → pending` (reverse), call confirm twice on the same order.

### 3. Timing & Concurrency

Race conditions, timeouts, out-of-order events, duplicate submissions, slow network responses.

**Example:** Two users submit the same promo code simultaneously. Edge case: both requests arrive before either is committed — does the system apply the code twice or correctly reject one?

### 4. Idempotency

Repeated identical requests, retry storms, duplicate webhook deliveries.

**Example:** `POST /api/payments` is called twice with the same idempotency key. Edge case: second call should return the same result without creating a duplicate payment.

### 5. Failure Modes

Network failures mid-operation, partial writes, downstream service unavailability, disk full, database connection loss.

**Example:** Payment gateway returns a timeout after charging the card. Edge case: system must not create a second charge on retry — check for charge-before-confirm pattern.

### 6. Auth & Permissions

Expired tokens, revoked permissions mid-session, privilege escalation, cross-tenant data access.

**Example:** User A has `read` access to project X. Edge case: User A attempts `DELETE /api/projects/X` — should receive 403, not 404 or 500.

### 7. Data Boundaries

Integer overflow, float precision, date boundaries (leap years, DST transitions, epoch limits), empty collections, maximum record counts.

**Example:** A date picker allows selecting a delivery date. Edge cases: Feb 29 in a leap year, Feb 29 in a non-leap year, Dec 31 23:59:59 UTC, Jan 1 00:00:00 UTC, dates in year 2038.

### 8. Resource Exhaustion

Memory pressure, connection pool depletion, rate limiting, disk space, file descriptor limits.

**Example:** API rate limit is 100 requests/minute. Edge cases: 100th request (should succeed), 101st request (should return 429), requests resume after the window resets.

### 9. API Versioning

Backward compatibility, deprecated field handling, schema migration, version header omission.

**Example:** API v2 renames `userName` to `username`. Edge cases: v1 client sends `userName` to v2 endpoint, v2 client sends `username` to v1 endpoint, request with no version header.

## Edge-Case Template

```markdown
### EC-{id}: {Edge-Case Title}

| Field | Value |
|-------|-------|
| **AC(s)** | AC-{n} |
| **Category** | {category name from list above} |
| **Input / Setup** | {Concrete input or precondition} |
| **Expected Result** | {Observable behavior} |
| **Risk if Missed** | {Consequence of not testing this — data loss, security breach, silent corruption, etc.} |
```

## Example Walkthrough: "Requested vs Delivered" Validation

Given a user story with AC-5: "Discount code can only be used once per user."

**Deriving the edge case:**

1. **Parse AC:** "used once per user" → requires per-user uniqueness check.
2. **Category:** Idempotency + Timing & Concurrency.
3. **Concrete edge case:**

### EC-7: Same discount code submitted twice simultaneously

| Field | Value |
|-------|-------|
| **AC(s)** | AC-5 |
| **Category** | Idempotency, Timing & Concurrency |
| **Input / Setup** | User sends two `POST /api/cart/discount` requests with the same code in parallel (within 50ms). |
| **Expected Result** | Exactly one application succeeds. The second returns an error indicating the code was already used. |
| **Risk if Missed** | User gets double discount — revenue loss, potential abuse vector. |

**Validating "requested vs delivered":**
- **Requested (AC-5):** Code used once per user.
- **Delivered:** Run the edge case; if both requests succeed → **DRIFT** detected. If exactly one succeeds → **PASS**.

## Output

This skill returns a categorized list of edge cases in the template format above. The calling agent (`black-box-tester`) assembles them into the edge-case section of the test plan.

## Execution Checklist

Use this checklist to verify completeness before returning results:

- [ ] All 9 categories evaluated against the source artifact.
- [ ] Each applicable category has ≥1 concrete edge case with filled template.
- [ ] Non-applicable categories marked `N/A` with reason.
- [ ] Every edge case maps to ≥1 AC.
- [ ] Risk-if-missed populated for every edge case.
- [ ] No edge case references internal implementation details.
- [ ] Edge cases are numbered sequentially (`EC-1`, `EC-2`, …).

## Final Instructions

1. You **MUST** evaluate all 9 categories — do not skip any.
2. You **MUST** produce at least one concrete edge case per applicable category.
3. You **MUST** include the "Risk if Missed" field for every edge case.
4. You **MUST NOT** reference internal implementation details — all edge cases describe observable behavior.
5. You **MUST** flag ACs that appear to have no meaningful edge cases and explain why.
6. You **SHOULD** prioritize edge cases by risk severity when the catalog is large.
