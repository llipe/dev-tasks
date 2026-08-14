# ADR-002: Spec-aligned exit-code contract with deprecated aliases

## Status

Accepted

Recorded retroactively. The decision was taken and implemented on 2026-07-31; this ADR captures it in the required format because `docs/adr/` did not exist at the time.

## Context

`dev-tasks` and `dt` are consumed by CI pipelines and by AI agents that must branch on the outcome of a command. The exit code is the only stable machine-readable signal both binaries emit before their output is parsed, so it functions as the toolkit's public API.

The initial exit-code table was written before the multi-repo context specification settled. It contained generic HTTP-flavoured names (`NetworkError`, `AuthError`, `NotFound`, `Conflict`, `Timeout`, `RateLimit`, `ValidationError`, `ConfigurationError`, `DependencyError`, `PermissionDenied`, `MissingRequiredField`) that did not correspond to the failure classes the pipeline actually produces. `RateLimit: 8` in particular had no basis in the specification. Meanwhile the specification (§6.7) defined failure classes the code had no name for: stale index, invalid scoping, no candidates, unknown component, incomplete extraction, and reconciliation conflict.

Renaming the constants was a breaking change for any caller importing them by name.

## Decision

Align `core/exit-codes.ts` with specification §6.7 while keeping the numeric values stable, and retain the old names as deprecated aliases pointing at the same numbers.

- Codes `0`–`2` unchanged: `Success`, `GeneralError`, `InvalidUsage`.
- Codes `3`–`7` renamed to the pipeline's actual failure classes: `PartialCatalogBuild`, `CatalogValidationErrors`, `FetchFailure`, `InsufficientBudget`, `GateAborted`.
- `RateLimit: 8` replaced with `BreakingChange: 8`.
- Codes `9`–`14` added: `StaleIndex`, `InvalidScoping`, `NoCandidates`, `UnknownComponent`, `IncompleteExtraction`, `ReconciliationConflict`.
- Every superseded name remains exported with a `@deprecated` tag and its original numeric value, for one release cycle.
- The canonical table is a `const` object in `core/exit-codes.ts`, imported by both binaries.

## Alternatives Considered

- **Keep the generic names** — no migration cost. Rejected: the names actively misled callers, and six specification-defined failure classes had no representation, forcing them to collapse into `GeneralError`.
- **Hard rename with no aliases** — cleanest table. Rejected: silently breaks any consumer importing the old identifiers, with no deprecation window.
- **A separate error-code taxonomy alongside exit codes** — richer semantics. Rejected: adds a second contract to keep in sync when the exit code is already the signal CI and agents read.

## Consequences

Positive:

- Each failure class has a distinct, named code, so callers can branch precisely — for example treating `3` (partial build) differently from `4` (validation errors), or `7` (gate aborted) differently from `10` (invalid scoping).
- Numeric values did not change, so existing scripts comparing numbers were unaffected.
- Satisfies the "fail explicit" principle in `docs/technical-guidelines.md`: a missing capability or blocked state has its own code rather than collapsing into a generic error.

Negative:

- Eleven deprecated aliases share numbers with current names, so the exported object has two identifiers per value in that range. `test/unit/exit-codes.test.ts` pins the values.
- The aliases must actually be removed at the next major version, or the deprecation window becomes permanent.
- `core/context/exit-codes.ts` still declares its own `EXIT_*` constants for the `dt init` pipeline (`6`, `7`, `9`, `10`, `11`, `12`) rather than importing `ExitCode`. The values agree today but are not mechanically tied together.

Follow-up:

- Remove all `@deprecated` aliases in the next major release.
- Collapse `core/context/exit-codes.ts` into re-exports of `ExitCode` so the numbers cannot diverge.
- Keep the table in `docs/data-model.md` synchronized with `core/exit-codes.ts`.

## Related

- Workstream: `workstream/specification-multi-repo-context.md` §6.7
- Docs updated: `docs/data-model.md`, `docs/dt-user-manual.md`, `docs/dev-tasks-user-manual.md`, `README.md`
- Code: `core/exit-codes.ts`, `core/context/exit-codes.ts`, `bin/dt.ts`, `bin/dev-tasks.ts`
- Tests: `test/unit/exit-codes.test.ts`
