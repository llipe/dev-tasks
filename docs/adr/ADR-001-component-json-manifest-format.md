# ADR-001: `component.json` as the sole manifest format

## Status

Accepted

Recorded retroactively. The decision was taken and implemented during the v0.7.0 cycle; this ADR captures it in the required format because `docs/adr/` did not exist at the time.

## Context

Every component repository declares its identity and contracts in a root manifest that `dt catalog build` aggregates into `catalog/index.yaml`. The manifest is a hybrid artifact: extraction derives most fields deterministically, while `owner`, `domain`, `criticality`, and confirmation of `aliases` are human-asserted at a gate.

To keep re-extraction safe, `_provenance.field_hashes` stores a SHA-256 per field value so that `core/reconcile` can distinguish a machine-derived field from one a human has since edited, and refuse to overwrite the latter.

The specification text mentioned `component.yaml` in places, and an implementation landed during the v0.7.0 cycle that accepted `component.yaml` as a fallback when `component.json` was absent. Issue bodies [#42](https://github.com/llipe/dev-tasks/issues/42) and [#43](https://github.com/llipe/dev-tasks/issues/43) carried the same `component.yaml` wording in their acceptance criteria.

YAML is not safe for hash-based edit detection. It permits multiple valid serializations of the same document and coerces unquoted scalars — `no` becomes a boolean, `1.0` becomes a float. Either behavior changes the bytes that get hashed without any human having edited the field, which surfaces as a spurious "manually edited" conflict and blocks extraction with exit `14`.

## Decision

`component.json` is the only accepted component manifest format.

- `dt extract component` writes JSON via `JSON.stringify`.
- `dt catalog build` reads `component.json` only. A repository carrying `component.yaml` instead is recorded in `index.errors[]` rather than silently accepted.
- The `component.yaml` fallback added earlier in the v0.7.0 cycle was reverted before release (`7bebc79`, reverting `f697265`). The net behavior of v0.7.0 is JSON-only.
- The `component.yaml` wording in issues #42 and #43 is catalogued as drift from an abandoned YAML draft; the S-010 verifier audit concluded no implementation change was warranted.

## Alternatives Considered

- **YAML manifest** — better readability for a file humans partially author. Rejected: incompatible with byte-exact field hashing, which is the mechanism protecting human-asserted fields from being overwritten.
- **YAML with a canonical serializer** — would make hashing deterministic. Rejected: adds a normalization dependency and a new failure mode for a readability gain that only affects four human-owned fields.
- **Dual-format support with JSON preferred** — the implementation that was reverted. Rejected: two accepted formats mean two hashing paths and an ambiguous source of truth when both files exist.

## Consequences

Positive:

- Hash-based edit detection is reliable; `ReconciliationConflict` means an actual edit.
- One read path in `dt catalog build`; no format-precedence rules.
- Consistent with the general format rule in `docs/artifact-formats.md`: machine-written and machine-read artifacts are JSON.

Negative:

- The manifest is less pleasant to hand-edit at the human gate. Mitigated by `dt extract component --interactive`, which prompts for the non-derivable fields.
- `catalog/index.yaml` and `contracts/**/*.yaml` remain YAML for readability and ecosystem-tooling reasons, so the repository does not use a single serialization format throughout. The exceptions are documented in `docs/artifact-formats.md`.

Follow-up:

- A regression test in `test/unit/catalog-build.test.ts` asserts that a repository carrying only `component.yaml` is reported in `index.errors[]`, so the reverted behavior cannot return unnoticed.
- Check `V11` ("fields with `source: manual` are non-empty") is assigned to `dt catalog validate`.

## Related

- Requirements: `docs/requirements/prd-multi-repo-context.md` (RF-20)
- Workstream: `workstream/specification-multi-repo-context.md` §4.5, §4.6, §5.2
- Docs updated: `docs/artifact-formats.md`, `docs/data-model.md`, `CHANGELOG.md`
- Code: `core/catalog/build.ts`, `core/reconcile.ts`, `schemas/component.schema.json`
- Tests: `test/unit/catalog-build.test.ts`
