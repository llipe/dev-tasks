# Architecture Decision Records

Durable records of architectural decisions for `dev-tasks`. One file per decision, numbered sequentially and never rewritten — a decision that changes is superseded by a new ADR, not edited in place.

## When an ADR Is Required

- Any change to `docs/technical-guidelines.md`.
- Any meta-repo pull request under the `architecture-change` task type (see `AGENTS.md`).
- Any decision that constrains future implementation choices across modules, artifacts, or platform trees.

## Index

| ADR                                                  | Title                                                     | Status   |
| ---------------------------------------------------- | --------------------------------------------------------- | -------- |
| [ADR-001](ADR-001-component-json-manifest-format.md) | `component.json` as the sole manifest format              | Accepted |
| [ADR-002](ADR-002-exit-code-contract.md)             | Spec-aligned exit-code contract with deprecated aliases   | Accepted |
| [ADR-003](ADR-003-qa-engineer-coverage-gate.md)      | `qa-engineer` coverage gate in the documented golden path | Accepted |

## Naming

`ADR-###-<kebab-case-title>.md`, with `###` zero-padded and sequential.

## Format

```markdown
# ADR-###: <Title>

## Status

Proposed | Accepted | Superseded | Deprecated

## Context

Problem and constraints.

## Decision

Precise decision taken.

## Alternatives Considered

Options evaluated and rejected.

## Consequences

Positive, negative, follow-up actions.

## Related

- Requirements: (paths)
- Workstream: (paths)
- Docs updated: (paths)
```
