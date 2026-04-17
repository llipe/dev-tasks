# Activity: Randomized Test Tactics

Generate randomized, fuzz, and property-inspired test strategies with reproducibility controls. Produces test tactics that detect behavior drift and hidden defects through non-deterministic inputs while maintaining deterministic replay. Invoked by the `black-box-tester` agent in Design Mode.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Design randomized and property-based testing tactics that complement structured E2E and edge-case tests. Every tactic **MUST** include seed capture and deterministic replay instructions so that failures can be reproduced and triaged.

## Context

This activity assumes:
- A numbered list of acceptance criteria is available (produced by Phase 2 of `black-box-tester`).
- E2E scenarios and edge cases have been drafted.
- The output feeds into the randomized-tactics section of the test plan assembled by `black-box-tester`.

## Tactic Types

### 1. Fuzz Testing

Generate malformed, unexpected, or random inputs to discover crashes, unhandled exceptions, or security vulnerabilities.

**When to apply:** Any endpoint or function that accepts user input — forms, API bodies, file uploads, query parameters.

**Approach:**
1. Identify input surfaces from the spec (fields, parameters, headers).
2. Define a fuzz corpus: valid base inputs + mutations (truncation, injection payloads, binary data, oversized values).
3. Define the oracle: what constitutes a failure (5xx status, stack trace in response, timeout, data corruption).
4. Set iteration count and seed.

### 2. Property-Based Testing

Define invariants (properties) that must hold for all valid inputs, then generate many random valid inputs to verify.

**When to apply:** Business rules that express universal constraints (e.g., "total is always ≥ 0", "output list is always sorted", "idempotent endpoint returns same result on retry").

**Approach:**
1. Extract properties from ACs and business rules.
2. Define input generators that produce valid inputs within the domain.
3. Run N iterations with random seeds.
4. On failure, shrink the input to the minimal failing case.

### 3. Stateful Random Walks

Execute random sequences of valid API calls to discover state-dependent bugs.

**When to apply:** Systems with stateful resources (CRUD workflows, multi-step processes, session-based interactions).

**Approach:**
1. Model valid actions and their preconditions as a state machine.
2. Generate random action sequences that respect preconditions.
3. After each sequence, verify invariants hold (e.g., resource counts match, no orphaned records).
4. Capture the full action sequence and seed for replay.

## Reproducibility Requirements

Every randomized tactic **MUST** satisfy these controls:

| Requirement | Description |
|-------------|------------|
| **Seed capture** | Record the PRNG seed used for each run. |
| **Seed replay** | Provide a command or instruction to re-run the exact same sequence using the captured seed. |
| **Iteration count** | Document the number of iterations per tactic. |
| **Deterministic oracle** | The pass/fail oracle **MUST** be deterministic for a given input — no "sometimes fails" verdicts. |
| **Environment snapshot** | Record runtime environment details (OS, runtime version, relevant config) alongside results. |

### Seed Policy

```
Seed format: <tactic-type>-<AC-id>-<unix-timestamp>-<random-4-hex>
Example:     fuzz-AC3-1719849600-a3f1

Replay command template:
  <test-runner> --seed=<captured-seed> --tactic=<tactic-id> --iterations=1
```

Seeds **MUST** be included in the test plan and in any failure reports.

## Tactic Template

```markdown
### RT-{id}: {Tactic Title}

| Field | Value |
|-------|-------|
| **AC(s)** | AC-{n} |
| **Tactic type** | fuzz / property-based / stateful-random-walk |
| **Input surface** | {What is being fuzzed or randomized} |
| **Property / Oracle** | {Invariant that must hold, or failure condition} |
| **Iterations** | {Number of random iterations} |
| **Seed** | {To be captured at execution time} |
| **Replay instruction** | {Command to reproduce with captured seed} |
| **Shrink strategy** | {How to minimize failing input — binary search, delta debugging, etc.} |
```

## Example

Given AC-2: "API returns paginated results with at most 50 items per page."

### RT-1: Fuzz pagination parameters

| Field | Value |
|-------|-------|
| **AC(s)** | AC-2 |
| **Tactic type** | fuzz |
| **Input surface** | Query parameters `page` and `pageSize` on `GET /api/items` |
| **Property / Oracle** | Response always returns ≤50 items. Status is never 5xx. Response time <2s. |
| **Iterations** | 500 |
| **Seed** | `fuzz-AC2-{timestamp}-{hex}` |
| **Replay instruction** | `test-runner --seed=<seed> --tactic=RT-1 --iterations=1` |
| **Shrink strategy** | Binary search on `pageSize` value to find minimum trigger. |

**Mutation corpus for `page`/`pageSize`:**
- Valid range: `page=1..1000`, `pageSize=1..50`
- Mutations: `page=-1`, `page=0`, `page=999999`, `pageSize=0`, `pageSize=51`, `pageSize=-1`, `pageSize=NaN`, `pageSize=""`, `pageSize=1.5`, omit parameter entirely

### RT-2: Property — response length never exceeds pageSize

| Field | Value |
|-------|-------|
| **AC(s)** | AC-2 |
| **Tactic type** | property-based |
| **Input surface** | Random valid `pageSize` values (1–50) with random `page` values |
| **Property / Oracle** | `len(response.items) <= pageSize` for all inputs. |
| **Iterations** | 200 |
| **Seed** | `prop-AC2-{timestamp}-{hex}` |
| **Replay instruction** | `test-runner --seed=<seed> --tactic=RT-2 --iterations=1` |
| **Shrink strategy** | Reduce `pageSize` to find smallest value where property fails. |

## Failure Triage Workflow

When a randomized test fails, the `black-box-tester` agent follows this workflow:

1. **Capture** — Record seed, full input, observed output, and expected oracle result.
2. **Replay** — Re-run with captured seed to confirm deterministic reproduction.
3. **Minimize** — Apply shrink strategy to find the smallest failing input.
4. **Classify:**
   - **Spec gap:** Behavior is undefined → escalate to `product-engineer`.
   - **Implementation defect:** Behavior contradicts an AC → file for `developer`.
   - **Flaky/environmental:** Cannot reproduce → log with environment details, mark `inconclusive`.
5. **Report** — Add triaged failure to validation report with classification and minimized input.
6. **Retry limit** — At most 3 reproduction attempts for non-reproducing failures.

## Execution Checklist

Use this checklist to verify completeness before returning results:

- [ ] At least one randomized tactic defined per input surface identified in the spec.
- [ ] Every tactic has a seed policy and replay instruction.
- [ ] Every tactic maps to ≥1 AC.
- [ ] Iteration counts are documented and justified.
- [ ] Shrink strategy defined for every tactic.
- [ ] Failure triage workflow referenced for handling failures.
- [ ] No tactic relies on internal implementation details.

## Output

This skill returns a list of randomized tactics in the template format above. The calling agent (`black-box-tester`) assembles them into the randomized-tactics section of the test plan.

## Final Instructions

1. You **MUST** produce at least one randomized tactic per significant input surface.
2. You **MUST** include seed capture and replay instructions for every tactic.
3. You **MUST** define a shrink strategy for every tactic.
4. You **MUST** specify the oracle/property that determines pass or fail.
5. You **MUST NOT** reference internal implementation details — all assertions are based on observable behavior.
6. You **MUST** reference the failure triage workflow for handling randomized test failures.
7. You **SHOULD** prefer property-based tactics for business rules expressing universal constraints.
