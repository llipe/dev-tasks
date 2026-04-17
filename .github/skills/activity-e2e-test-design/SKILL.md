# Activity: E2E Black-Box Test Design

Generate end-to-end black-box test scenarios from a complete specification or a single user story. Produces executable scenario descriptions tied to acceptance criteria, covering happy paths, negative paths, and abuse cases. Invoked by the `black-box-tester` agent in Design Mode.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Derive a comprehensive set of end-to-end black-box test scenarios from requirements. Every acceptance criterion (AC) **MUST** be covered by at least one positive (happy-path) scenario and at least one negative or edge-case scenario.

## Context

This activity assumes:
- A numbered list of acceptance criteria is available (produced by Phase 2 of `black-box-tester`).
- The source artifact (spec or user story) has been read and parsed.
- The output feeds into the test plan assembled by `black-box-tester`.

## Process

1. **Receive AC list and source artifact.**
2. **Identify user-facing workflows.** Map each AC to the observable behavior it describes.
3. **Generate scenarios.** For each AC, produce:
   - ≥1 happy-path scenario (expected inputs → expected outputs).
   - ≥1 negative-path scenario (invalid/missing inputs → expected error behavior).
   - ≥1 abuse-case scenario where applicable (malicious input, privilege escalation, injection).
4. **Assign severity.** Mark each scenario as `critical`, `major`, or `minor` based on business impact.
5. **Cross-reference.** Ensure every AC has at least one scenario; flag uncovered ACs.
6. **Return structured output** for inclusion in the test plan.

## Scenario Template

Each scenario **MUST** follow this structure:

```markdown
### SC-{id}: {Scenario Title}

| Field | Value |
|-------|-------|
| **AC(s)** | AC-{n}, AC-{m} |
| **Type** | happy-path / negative-path / abuse-case |
| **Severity** | critical / major / minor |
| **Preconditions** | {State required before execution} |
| **Steps** | 1. {Step} 2. {Step} … |
| **Expected Result** | {Observable outcome from the outside} |
| **Pass Criteria** | {Unambiguous condition for pass} |
```

## Example

Given a user story:
> *As a user, I want to log in with my email and password so that I can access my dashboard.*

**AC-1:** User with valid credentials is redirected to the dashboard.
**AC-2:** User with invalid credentials sees an error message.
**AC-3:** Account is locked after 5 consecutive failed attempts.

### SC-1: Successful login with valid credentials

| Field | Value |
|-------|-------|
| **AC(s)** | AC-1 |
| **Type** | happy-path |
| **Severity** | critical |
| **Preconditions** | User account exists and is active. |
| **Steps** | 1. Navigate to `/login`. 2. Enter valid email and password. 3. Submit the form. |
| **Expected Result** | User is redirected to `/dashboard`. Session is established. |
| **Pass Criteria** | HTTP 302 redirect to `/dashboard`. Auth cookie present. |

### SC-2: Login with wrong password

| Field | Value |
|-------|-------|
| **AC(s)** | AC-2 |
| **Type** | negative-path |
| **Severity** | critical |
| **Preconditions** | User account exists and is active. |
| **Steps** | 1. Navigate to `/login`. 2. Enter valid email and wrong password. 3. Submit the form. |
| **Expected Result** | Login page displays "Invalid email or password" error. |
| **Pass Criteria** | HTTP 401. Error message displayed. No session created. |

### SC-3: Account lockout after 5 failures

| Field | Value |
|-------|-------|
| **AC(s)** | AC-3 |
| **Type** | negative-path |
| **Severity** | major |
| **Preconditions** | User account exists. Failed attempt counter is at 0. |
| **Steps** | 1. Submit login with wrong password 5 times consecutively. 2. Attempt login with correct password. |
| **Expected Result** | After 5th failure, account is locked. 6th attempt (even with correct password) returns "Account locked" message. |
| **Pass Criteria** | HTTP 423 on 6th attempt. Lock message displayed. |

### SC-4: SQL injection in email field

| Field | Value |
|-------|-------|
| **AC(s)** | AC-1, AC-2 |
| **Type** | abuse-case |
| **Severity** | critical |
| **Preconditions** | Login page accessible. |
| **Steps** | 1. Enter `' OR 1=1 --` as email. 2. Enter any password. 3. Submit. |
| **Expected Result** | Login fails with "Invalid email or password". No data leak. |
| **Pass Criteria** | HTTP 401. No SQL error exposed. No authentication bypass. |

## Output

This skill returns a list of scenarios in the template format above. The calling agent (`black-box-tester`) assembles them into the E2E section of the test plan.

## Final Instructions

1. You **MUST** produce at least one happy-path and one negative-path scenario per AC.
2. You **MUST** include abuse-case scenarios for ACs involving authentication, authorization, or user input.
3. You **MUST** assign severity to every scenario.
4. You **MUST NOT** reference internal implementation details — all assertions are based on observable behavior.
5. You **MUST** flag any AC that cannot be covered by an E2E scenario and explain why.
