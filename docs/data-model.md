# Data Model: dev-tasks

`dev-tasks` has no database. Its data model is a set of file-based artifacts exchanged between component repositories, a meta-repository, and a per-session working directory. This document defines those entities, their relationships, invariants, ownership, and lifecycle.

Sources: `schemas/*.schema.json`, `core/catalog/index-model.ts`, `core/context/session-lock.ts`, `core/distribution/manifest.ts`, `core/extract/report.ts`, `core/scope/`, `core/reconcile.ts`, `workstream/specification-multi-repo-context.md`.

For serialization format and authorship rules per artifact, see `docs/artifact-formats.md`.

## Entity Map

```text
registry.yaml (meta-repo, human)
  │ entries[].repo
  ▼
component.json (component repo, generated + human-gated) ──┐
  │ provides[] / consumes[].contract                       │ mirrored
  ▼                                                        ▼
contracts/openapi/*.yaml                        catalog/components/*.json (generated)
contracts/asyncapi/*.yaml                                  │
docs/schema.md                                             ▼
                                                catalog/index.yaml (generated)
catalog/flows/*.yaml (human) ──────────────────────────────┤
                                                           │
                                          ┌────────────────┴───────────────┐
                                          ▼                                ▼
                                  scope output (LLM)              impact / drift reports
                                          │
                                          ▼
                                  session.lock.json + context bundle layers
```

## Entities

### RegistryEntry — `registry.yaml`

The list of component repositories the catalog aggregates.

| Field    | Required | Notes                                    |
| -------- | -------- | ---------------------------------------- |
| `id`     | Yes      | Component identifier                     |
| `repo`   | Yes      | Repository location (path or remote URL) |
| `branch` | No       | Branch to read                           |
| `path`   | No       | Subdirectory holding `component.json`    |

Owner: human, in the meta-repo. Lifecycle: edited when a repository joins or leaves the product.

### ComponentManifest — `component.json`

The per-repository identity and contract declaration. Required fields: `schemaVersion`, `id`, `name`, `description`, `repo`, `type`, `domain`, `owner`, `criticality`, `lifecycle`, `stack`, `aliases`, `provides`, `consumes`, `datastores`, `docs`, `paths`, `_provenance`. Optional: `subdomain`, `runtime`.

- `provides[]` — `{ id, kind, source }` required; `kind` ∈ `openapi | asyncapi | grpc | graphql | undocumented`; optional `path`, `confidence`, and for `asyncapi` the pair `topic_confidence` / `payload_confidence`.
- `consumes[]` — `{ contract }` required, plus optional `criticality` ∈ `hard | soft` and `source`.
- `_provenance` — `{ extracted_at, extractor, repo_sha, fields, field_hashes }` plus optional `detector`. `fields` records per-field `source` and `confidence`; `field_hashes` records a SHA-256 per field value.

Ownership is split within one file: `owner`, `domain`, `criticality`, and confirmation of `aliases` are human-asserted; everything else is derived by extraction.

Invariants:

- `component.json` is the only accepted manifest format. A repository carrying only `component.yaml` is reported in `index.errors[]`, never silently accepted. A regression test in `test/unit/catalog-build.test.ts` pins this.
- JSON serialization is load-bearing, not stylistic: field values are SHA-256 hashed into `_provenance.field_hashes` to detect manual edits. See `docs/adr/ADR-001-component-json-manifest-format.md`.
- `consumes[].contract` must resolve to an existing `provides[].id` somewhere in the catalog. Enforced by `dt catalog validate`, not by the schema.
- Fields whose provenance `source` is `manual` must be non-empty (check `V11`).

Lifecycle: derived by `dt extract component` → human gate for non-derivable fields → committed to the component repo → mirrored into the catalog on the next build. Re-extraction over a locally edited field is a `ReconciliationConflict` (exit `14`) unless `--force`.

### Contract — `contracts/openapi/*.yaml`, `contracts/asyncapi/*.yaml`

The interface a component exposes or depends on, identified by the `provides[].id` referenced from `consumes[].contract`. Contracts are the acceptance boundary for cross-repo work.

Invariant: a boundary contract with `payload_confidence: low` must be raised to at least `medium` — by re-extraction with better hints or human confirmation — before it can serve as an acceptance boundary. Gate `G7` flags this for review; the cross-repo partitioning rule blocks the dependent sub-task.

### ExtractionReport — `extraction_report.json`

Per-run extraction quality record: `strategies[]` (stage, strategy, source, confidence, rung), `coverage` (resolved/unresolved/total for endpoints, topics, tables), `unresolved[]` (stage, type, location, reason), `requires_human[]` (field, reason, category ∈ `non-derivable | unconfirmed-inference | missing-capability`), and confidence counts. The `rung` field in each strategy entry records which ladder rung (`declared`, `observed`, or `inferred`) produced the result.

Owner: generated. Lifecycle: rewritten on each extraction run; drives the human-gate prompts and catalog coverage tally.

### Flow — `catalog/flows/*.yaml`

A named cross-component journey. Required: `schemaVersion`, `id`, `domain`, `owner`, `criticality`, `steps`. Optional: `aliases`, `sla`.

Owner: human. It is the only hand-edited file under `catalog/`. Flows provide alias-based routing hints during scoping and participant lists in the built index.

### CatalogIndex — `catalog/index.yaml`

The generated routing index. Top-level: `generated_at`, `generator`, `components[]`, `contracts{}`, `domains[]`, `flows[]`, `extraction_quality`, `errors[]`.

- `components[]` — flattened component summary plus `origin_sha`, the SHA of the repo the manifest was read from.
- `contracts{}` — inverted index keyed by contract id → `{ provider, kind, consumers[] }`. This is what makes consumer-impact analysis a lookup rather than a graph walk.
- `extraction_quality` — `{ total: {high, medium, low}, per_component[] }` with per-component `unresolved` counts.
- `errors[]` — `{ repo, error, timestamp }` for repositories that failed during the build.

Invariants: fully generated and never hand-edited; deterministic output (sorted keys, stable ordering) so identical inputs produce identical bytes; writes are idempotent and skipped when nothing changed. Staleness beyond `--max-index-age` triggers exit `9` (`StaleIndex`).

### ScopeOutput

The LLM's answer to "which components does this task touch". Required: `schemaVersion`, `primary`, `secondary`, `contracts_crossed`, `confidence`, `unresolved`, `rationale`. Optional: `flow`.

Invariants enforced by `schemas/scope-output.schema.json`: `primary` has 1–6 unique items; `secondary` has at most 8; `confidence` ∈ `high | medium | low`. Schema violations trigger a repair retry.

Downstream rules:

- `primary` with more than one component means the feature is cross-repo and must be partitioned into one sub-task per repository, ordered producer-before-consumers.
- Abort gates: `G1` total components over the cap, `G2` `confidence: low`, `G3` non-empty `unresolved`, `G4` a scoped component missing from the catalog. Each exits `7` with a partition proposal where applicable.
- Review gates recorded as `review_flags` rather than aborting: `G5` an LLM-selected component absent from candidates and closure, `G6` scope spanning more than two domains, `G7` a boundary contract with `payload_confidence: low`.

### SessionLock — `session.lock.json`

The reproducibility record for one context session: `task_hash`, optional `task_text`, `meta_repo_sha`, `index_age_minutes`, `scope`, `repo_shas{}`, `bundle[]`, `total_tokens`, `created_at`, `review_flags[]`.

- `scope` — `{ components[], source: "manual" | "llm" }` plus, when `source` is `llm`, `primary`, `secondary`, `contracts_crossed`, `confidence`, and optional `flow`.
- `bundle[]` — `{ filename, sha256, tokens }` per emitted layer file.

Invariant: the same lock reproduces the same bundle byte-for-byte. `task_hash` is deterministic — for a manual scope it is the SHA-256 of the sorted, comma-joined component ids.

### ContextBundle layers

Ordered Markdown files emitted by `dt ctx assemble`, each with a fixed priority and a truncable flag:

| File                      | Priority        | Truncable |
| ------------------------- | --------------- | --------- |
| `00-index.md`             | 0               | No        |
| `01-flow.md`              | 1               | No        |
| `02-conventions-delta.md` | 2               | No        |
| `03-architecture.md`      | 3               | Yes       |
| `04-primary-<id>.md`      | 4+              | Yes       |
| `05-secondary-<id>.md`    | after primaries | Yes       |
| `06-contracts.md`         | last            | Yes       |

Invariant: when the rendered set exceeds the token budget, truncable layers are truncated in reverse priority order; non-truncable layers are never truncated. If the budget cannot accommodate the non-truncable set, the run exits `6` (`InsufficientBudget`).

### CalibrationRecord — `.dev-tasks/calibration/<ts>-<hash>.json`

Precision/recall analysis comparing LLM scope selections against closure and candidate sets. Owner: generated. Lifecycle: append-only per session; used to tune scoping, not consumed by the pipeline.

### SHA cache

`dt ctx fetch` sparse-clones component repos and caches content keyed by commit SHA. `dt ctx gc` evicts entries by `--max-size` and `--max-age` using an LRU policy based on file mtime.

### InstallManifest — `.dev-tasks/manifest.json`

The consumer-repo record of installed harness files: `version`, `pinned`, `installed_at`, `files[]`, `extraction`, and a deprecated legacy `skills[]` array read for backward compatibility.

`files[]` entries are `{ path, profile, sha256, origin_sha256 }`. The pair of hashes is what makes conflict detection possible: `sha256` is the file as it exists now, `origin_sha256` the file as shipped. Comparing local, origin, and package hashes classifies each file as up to date, updatable, or conflicted.

Companion artifacts: `.dev-tasks/version` holds the version pin; `.dev-tasks/config.yaml` is human-owned per-repo configuration; the backup directory holds pre-overwrite copies created by `--force`.

Legacy markers: a repository containing `.dev-tasks-version` is detected by `dev-tasks migrate`, which synthesizes a manifest with every discovered file marked as `modified: unknown` so the first `update` surfaces them as reviewable conflicts rather than overwriting them.

## Ownership Boundaries

| Owner                        | Artifacts                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generated, never hand-edited | `catalog/index.yaml`, `catalog/components/*.json`, `extraction_report.json`, `session.lock.json`, `.dev-tasks/manifest.json`, `.dev-tasks/version`, calibration records |
| Generated, human-gated       | `component.json` (`owner`, `domain`, `criticality`, `aliases` confirmation)                                                                                             |
| Human, meta-repo             | `registry.yaml`, `platform.yaml`, `catalog/flows/*.yaml`, `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, `adr/*.md`                                  |
| Human, component repo        | `.dev-tasks/config.yaml`, `docs/architecture.md`, `docs/conventions.md`                                                                                                 |
| Vendored by the package      | `schemas/*.schema.json`                                                                                                                                                 |

Meta-repo writes are permitted only under the `architecture-change` task type, and only for `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, and `catalog/flows/`. Generated catalog files are excluded from that write scope. See `AGENTS.md`.

## Cross-Entity Invariants

1. Every `consumes[].contract` resolves to a `provides[].id` present in the catalog.
2. Every component id in a flow's `steps` and in a scope output exists in the catalog index.
3. Component ids are unique across all registry entries; duplicates are a build error.
4. A component in scope without a mirrored manifest in the catalog aborts the session (`G4`).
5. `catalog/index.yaml` reflects only manifests successfully read during the last build; failures appear in `errors[]` and downgrade the build to exit `3`.
6. Manual provenance implies non-empty: a field marked `source: manual` must carry a value (`V11`).
7. A generated field whose current hash differs from `_provenance.field_hashes` is treated as manually edited and is not overwritten without `--force`.

## Exit-Code Contract

The interface between these artifacts and any caller is the process exit code, defined once in `core/exit-codes.ts`:

| Code | Name                      | Meaning                                                 |
| ---- | ------------------------- | ------------------------------------------------------- |
| 0    | `Success`                 | Completed                                               |
| 1    | `GeneralError`            | Unclassified failure                                    |
| 2    | `InvalidUsage`            | Bad arguments or unknown command                        |
| 3    | `PartialCatalogBuild`     | Index built with per-repo failures in `errors[]`        |
| 4    | `CatalogValidationErrors` | Schema or referential-integrity errors                  |
| 5    | `FetchFailure`            | Repository fetch failed                                 |
| 6    | `InsufficientBudget`      | Token budget too small for non-truncable layers         |
| 7    | `GateAborted`             | Abort gate `G1`–`G4` triggered                          |
| 8    | `BreakingChange`          | Breaking contract diff detected                         |
| 9    | `StaleIndex`              | Catalog index older than the allowed age                |
| 10   | `InvalidScoping`          | Scope output invalid or provider unconfigured           |
| 11   | `NoCandidates`            | No candidate components resolved                        |
| 12   | `UnknownComponent`        | Referenced component not in the catalog                 |
| 13   | `IncompleteExtraction`    | Extraction finished with required items unresolved      |
| 14   | `ReconciliationConflict`  | Local edits conflict with generated or packaged content |

Legacy aliases for codes 3–13 remain exported and deprecated for one release cycle. See `docs/adr/ADR-002-exit-code-contract.md`.
