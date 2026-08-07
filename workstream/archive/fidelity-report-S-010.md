# Fidelity Report — S-010 (Issue #42): JSON Schemas and dt validate-component

**Fidelity: High**
**Highest drift impact: Minor**
**Scope: Story S-010 / Issue #42 — PR #96 (branch `issue/42-json-schemas-validate-component`)**

## Human-Readable Summary

This change adds the three JSON blueprint files (schemas) that every future validation
step in the multi-repo context feature will reuse: one for a repo's own manifest
(`component.json`), one for hand-written business-flow definitions, and one for the
output of the AI scoping step. It also ships a command, `dt validate-component`, that
checks a repo's `component.json` against its blueprint completely offline — no
internet connection or external service call is involved. Invalid files fail with a
clear list of what's wrong; valid files pass silently (or print a machine-readable
report with `--json`). This is foundational, low-risk plumbing: it doesn't change any
existing behavior, it only adds a new, currently-unused-by-other-code capability that
later stories (cataloging, scoping) will build on.

## Per-AC Result Table

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
|---|---|---|---|---|---|
| AC-1 | `component.schema.json`, `flow.schema.json`, and `scope-output.schema.json` exist and validate the spec's example artifacts | `schemas/component.schema.json`, `schemas/flow.schema.json`, `schemas/scope-output.schema.json` — all three present, draft 2020-12, model spec §5.2/§5.3/§8.2 fields | Task 1.1-1.3, 1.10 marked complete in `workstream/tasks-multi-repo-context-phase2-3-plan.md` | `test/unit/validate-component.test.ts` — 3 tests accept golden fixtures (`valid/component.json`, `valid/flow.json`, `valid/scope-output.json`) | **Pass** |
| AC-2 | `dt validate-component component.yaml` validates against the schema with no network access and exits 0/4 | `adapters/cli/validate-component.ts:runValidateComponent()` wired in `bin/dt.ts`; `core/catalog/validate-component.ts` uses only internal `#/$defs/...` refs (no `$schema`/remote refs, confirmed by direct read of all three schema files) | Task 1.6, 1.7, 1.9, 1.11 marked complete | `test/integration/validate-component-cli.test.ts` — subprocess run of the actual binary; exit 0 valid, exit 4 invalid, both human and `--json` output asserted | **Pass** (see Drift-1 below — filename in the AC text is `.yaml`, implementation and everywhere else in spec is `.json`) |
| AC-3 | `id` pattern `^[a-z][a-z0-9-]{2,49}$` is enforced by the schema | `component.schema.json` and `flow.schema.json` both declare `"pattern": "^[a-z][a-z0-9-]{2,49}$"` on their `id` property | Task 1.12 marked complete | `component-bad-id.json` / `flow-bad-id.json` fixtures + corresponding unit tests assert `keyword === "pattern"` on `/id` | **Pass** |
| AC-4 | Schemas carry a version field for future evolution | All three schemas require `schemaVersion` (semver-pattern string) as a top-level required field | Task 1.13 marked complete | Golden fixtures all include `"schemaVersion": "1.0.0"`; schema `required` array includes it, so any fixture omitting it would fail (implicitly covered by `additionalProperties`/`required` tests) | **Pass** |

## Drift Catalog

### Drift-1 — AC-2 references `component.yaml`, implementation and spec use `component.json`

- **Impact:** Minor
- **Intent:** Undetermined
- **Evidence:** Issue #42 body AC-2 reads `dt validate-component component.yaml validates...`, but the PRD/spec (`specification-multi-repo-context.md` §4.5, §5.2, §8.1) and every other reference to this artifact — including the story's own "Files to Create/Modify" section and Technical Notes — consistently name it `component.json`. The delivered CLI and schema validate `component.json` (JSON), not YAML.
- **Recommendation:** No action needed on the implementation — `component.json` is correct per spec and is the only form referenced anywhere else. The issue body's AC-2 wording appears to be a copy/paste artifact from an earlier YAML-based draft. Recommend `product-engineer` correct the AC-2 wording in the issue for future readers (via `activity-drift-reconciliation`), but this does not block completion.

### Drift-2 — `ExitCode.AuthError` reused for catalog validation errors

- **Impact:** Minor
- **Intent:** Intended
- **Evidence:** `core/exit-codes.ts` names exit code 4 `AuthError`, but spec §6.7 defines code 4 as "Catalog validation errors." The repo's existing convention (see `test/unit/exit-codes.test.ts`, which asserts numeric values only) is that `ExitCode` member *names* are generic labels and the *numeric values* are the spec contract. `adapters/cli/validate-component.ts` follows this existing convention and documents the mapping explicitly in a code comment (`ExitCode.AuthError (4) if invalid ... per spec section 6.7`).
- **Recommendation:** No action needed — this is consistent with how `ExitCode.ReconciliationConflict`/`ExitCode.MissingRequiredField` are already reused for spec-code semantics elsewhere in the codebase (e.g. `extract-component.ts`). Documented inline; no functional risk.

## Edge-Case and Randomized Test Outcomes

No prior Design Mode test plan exists for this scope (`/workstream/test-plan-*.md` not found for S-010). Edge cases were derived directly from the issue's Testing Requirements / Edge-Case Matrix section:

| Edge case (from issue) | Covered by |
|---|---|
| unknown top-level key (`additionalProperties`) | `component-unknown-key.json`, `flow-unknown-key.json`, `scope-output-unknown-key.json` fixtures + tests |
| wrong enum value | `component-wrong-enum.json` fixture + test; `scope-output-bad-confidence.json` fixture + test |
| empty `source: manual` field | `component-empty-manual-field.json` fixture + test (`owner: ""`) |
| malformed JSON (not in issue's matrix, added proactively) | `validateArtifactFile` malformed-JSON test — confirms structured error instead of throwing |
| missing path / usage errors (not in issue's matrix, added proactively) | integration tests for exit 2 (no path) and exit 5 (file not found) |

No randomized/fuzz tests were designed for this scope — appropriate given the artifact is a fixed-shape JSON Schema validator, not a parser or state machine.

## Recommendations

1. Drift-1: route to `product-engineer` / `activity-drift-reconciliation` to correct the AC-2 wording in issue #42 (`component.yaml` → `component.json`). Non-blocking.
2. Drift-2: no action needed.
3. Forward note for S-012 (`dt catalog validate` V01): this story's `validateArtifact("component", ...)` and `resolveSchemaPath` are already designed for reuse — S-012 should import `core/catalog/validate-component.ts` directly rather than re-implementing schema loading.
