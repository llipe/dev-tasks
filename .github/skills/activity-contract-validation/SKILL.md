---
name: activity-contract-validation
description: "Validate API contracts against implementation using dt verify (contract-diff, impact, drift). Detects breaking changes, consumer impact, and spec-to-code staleness. Use when checking API boundary integrity."
---

# Activity: Contract Validation

Detect API spec drift, breaking changes, and consumer impact using the `dt verify` family. This skill wires existing extraction and verification tooling into the QA path.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Detect misalignment between API specifications and implementation before it reaches consumers. Contract validation checks the boundary — it does not test internal behavior.

Consult `/TESTING.md` first. Its Contract Validation layer boundary governs.

## Contract Validation Boundary

- **MUST** validate the API boundary (endpoints, schemas, events) against the specification.
- **MUST NOT** test internal business logic — that belongs at Layer 1 or 2.
- **MUST NOT** require a running server — operates on static specs and source analysis.
- **MAY** complement live testing but is not a substitute for E2E.

## Part 1 — Prerequisite Detection

### Check `dt` availability

```bash
which dt && dt --version
```

- If `dt` is not found: emit `SKIPPED(dt not installed)` and provide manual instructions.
- If `dt` is found but not configured for the repo: emit `SKIPPED(dt not configured — run dt init)`.

### Detect API specifications

Search the repository for:

- `openapi.yaml`, `openapi.json`, `swagger.yaml`, `swagger.json` (or under `docs/`, `api/`, `specs/`)
- `asyncapi.yaml`, `asyncapi.json`
- `component.json` (dt-managed extraction output)

If no specs found: emit `SKIPPED(no OpenAPI or AsyncAPI spec found in repository)`.

## Part 2 — Contract Diff (Breaking Change Detection)

Run against the base branch to detect breaking changes introduced by the current work:

```bash
dt verify contract-diff --base origin/main --head HEAD
```

### Findings classification

| Exit code | Meaning                   | Severity |
| --------- | ------------------------- | -------- |
| 0         | No breaking changes       | —        |
| 8         | Breaking changes detected | Critical |
| 1         | Execution error           | Blocked  |

### Report format

For each breaking change found:

```markdown
| Finding | Severity | Path                            | Description                                |
| ------- | -------- | ------------------------------- | ------------------------------------------ |
| BREAK-1 | critical | POST /api/orders → request body | Required field `customerId` removed        |
| BREAK-2 | major    | GET /api/users → response       | Field `email` type changed string → object |
```

## Part 3 — Impact Analysis (Consumer Enumeration)

When breaking changes are detected, identify affected consumers:

```bash
dt verify impact --contract <contract-id>
```

Report:

- List of consumers that depend on the changed contract.
- Per consumer: which endpoints/events they consume.
- Recommendation: notify consumers, or validate with consumer-driven tests.

## Part 4 — Drift Detection (Spec-to-Implementation Staleness)

Check whether the specification and implementation have diverged:

```bash
dt verify drift [--id <component-id>]
```

### Drift types

| Type            | Description                                     | Severity |
| --------------- | ----------------------------------------------- | -------- |
| Spec-ahead      | Spec documents endpoints not in code            | Major    |
| Code-ahead      | Code has endpoints not in spec                  | Major    |
| Stale           | Spec not updated in >90 days while code changed | Minor    |
| Schema-mismatch | Response shape differs from spec                | Critical |

### Report format

Same risk-ranked table format as `activity-coverage-gap-analysis`:

```markdown
| Finding | Severity | Component    | Description                                    | Days since spec update |
| ------- | -------- | ------------ | ---------------------------------------------- | ---------------------- |
| DRIFT-1 | critical | api-gateway  | Response schema mismatch: /api/orders          | —                      |
| DRIFT-2 | major    | api-gateway  | 12 endpoints in code, 8 in spec                | —                      |
| DRIFT-3 | minor    | auth-service | Spec unchanged 120 days, 14 code commits since | 120                    |
```

## Part 5 — Integration with Coverage Gate

Contract validation findings **MUST** be reported alongside coverage in the `coverage_gate` path:

- Breaking changes → block completion (critical findings).
- Drift findings → report but do not block (route to follow-up or drift-reconciliation).
- No spec found → skip with reason (does not count as a gap).

### Aggregated output

```markdown
## Contract Validation Summary

- **Spec detected:** OpenAPI 3.1 at `api/openapi.yaml`
- **Breaking changes:** 0 | **Drift findings:** 2 | **Impact:** N/A
- **Status:** PASS (no breaking changes)

### Drift Findings (non-blocking)

| ... |
```

## Fallback — Manual Validation

When `dt` is not installed, provide these manual steps:

1. **Diff specs manually:** compare `api/openapi.yaml` across branches.
2. **Check for undocumented endpoints:** search route handlers not in the spec.
3. **Schema validation:** run `npx @redocly/cli lint api/openapi.yaml` or equivalent.
4. **Consumer notification:** manually identify consumers from project documentation.

## Output

- `dt` availability status
- Spec detection result (type, path, version)
- Breaking changes (count, details, severity)
- Consumer impact (when applicable)
- Drift findings (count, details, severity, days since update)
- Aggregated status for `coverage_gate` integration
- Manual fallback instructions (when `dt` unavailable)

## Final Instructions

1. You **MUST** check `dt` availability before attempting verification.
2. You **MUST** emit `SKIPPED` with a reason when prerequisites are missing.
3. You **MUST** classify findings by severity using the tables above.
4. You **MUST** report breaking changes as critical findings that block completion.
5. You **MUST** report drift as non-blocking findings for follow-up.
6. You **MUST NOT** test internal business logic — contract validation is boundary-only.
7. You **MUST NOT** install `dt` or any dependency — detect and recommend only.
