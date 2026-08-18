# Artifact Formats and Authorship

Reference for every durable artifact in the multi-repo context (MRC) system: its serialization format and who writes it.

Sources: `workstream/specification-multi-repo-context.md` §4.4, §4.5, §5.1–5.6 and `docs/requirements/prd-multi-repo-context.md` (RF-20 – RF-25).

## The Rule

Format follows **who writes the file**, not what it contains:

| Author                        | Format   |
| ----------------------------- | -------- |
| Machine-written, machine-read | JSON     |
| Human-written config          | YAML     |
| Prose                         | Markdown |

Two artifacts deliberately break this rule and one is a hybrid. All three are covered in [Exceptions](#exceptions).

## Meta-repo

| File                                                                                                                   | Format | Author               | Notes                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------ | -------------------- | -------------------------------------------- |
| `README.md`, `product-context.md`, `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, `environments.md` | MD     | Human (LLM-assisted) | Narrative; extraction pipeline step 7        |
| `platform.yaml`                                                                                                        | YAML   | Human                | Provider config (SCM, tracker)               |
| `registry.yaml`                                                                                                        | YAML   | Human                | The repos `dt catalog build` aggregates      |
| `adr/*.md`                                                                                                             | MD     | Human                | Architecture decision records                |
| `catalog/index.yaml`                                                                                                   | YAML   | **Generated**        | `dt catalog build`; see exception 1          |
| `catalog/components/*.json`                                                                                            | JSON   | **Generated**        | Mirror of each repo's `component.json`       |
| `catalog/flows/*.yaml`                                                                                                 | YAML   | Human                | Spec §5.3: the only hand-edited catalog file |
| `schemas/*.schema.json`                                                                                                | JSON   | Vendored             | Shipped by the `@llipe/dev-tasks` package    |

Everything under `catalog/` except `flows/` is generated. Per the PRD, generated artifacts "are never hand-edited."

## Component repo

| File                        | Format | Author                           | Notes                                                       |
| --------------------------- | ------ | -------------------------------- | ----------------------------------------------------------- |
| `component.json`            | JSON   | **Generated + human-gated**      | See exception 3; format is load-bearing                     |
| `AGENTS.md`                 | MD     | Human / vendored                 |                                                             |
| `TESTING.md`                | MD     | Vendored placeholder, then human | Shipped as an unfilled contract; consumer-owned once filled |
| `.dev-tasks/manifest.json`  | JSON   | **Generated**                    | Install manifest, skill hashes                              |
| `.dev-tasks/config.yaml`    | YAML   | Human                            | Per-repo configuration                                      |
| `.dev-tasks/version`        | text   | **Generated**                    | Version pin                                                 |
| `contracts/openapi/*.yaml`  | YAML   | **Generated** or copied          | See exception 2                                             |
| `contracts/asyncapi/*.yaml` | YAML   | **Generated** or copied          | See exception 2                                             |
| `docs/schema.md`            | MD     | **Generated**                    | From ORM AST or database introspection                      |
| `docs/architecture.md`      | MD     | Human                            |                                                             |
| `docs/conventions.md`       | MD     | Human                            | Deltas from meta-repo conventions only                      |
| `extraction_report.json`    | JSON   | **Generated**                    | Coverage, confidence, unresolved items                      |

## Per-session

| File                | Format | Author                   | Notes                                                                |
| ------------------- | ------ | ------------------------ | -------------------------------------------------------------------- |
| `session.lock.json` | JSON   | **Generated**            | `dt init`; same lock reproduces the same bundle byte-for-byte        |
| scope output        | JSON   | **Generated by the LLM** | Validated against `scope-output.schema.json`                         |
| calibration records | JSON   | **Generated**            | `.dev-tasks/calibration/<ts>-<hash>.json`; precision/recall analysis |

## Exceptions

### 1. `catalog/index.yaml` is generated but YAML

Deliberate. It is the routing index humans grep to understand the product map, so readability wins. Unlike `component.json`, its bytes are not hashed for edit detection, so nothing depends on byte-exact serialization.

### 2. `contracts/**/*.yaml` are generated but YAML

The OpenAPI and AsyncAPI ecosystems expect YAML. The consumers are external tools (`oasdiff` and the AsyncAPI comparator), not this codebase.

### 3. `component.json` is a hybrid, not purely generated

Extraction pipeline step 5 derives it deterministically from steps 1–4. Step 6 is a **human gate** for `owner`, `domain`, `criticality`, and confirming `aliases`.

This is why `_provenance.fields[]` records a per-field `source` and `confidence`: within one file you must be able to tell a machine-derived field from a human-asserted one.

Spec §5.2 assigns enforcement of "fields with `source: manual` are non-empty" to `dt catalog validate` as check V11. That check is planned in S-012 and is not yet implemented.

## Why the manifest must stay JSON

`component.json` is the one artifact where format is load-bearing rather than stylistic:

- Its field values are SHA-256 hashed into `_provenance.field_hashes` to detect manual edits.
- `dt extract component` refuses to overwrite a locally-edited field without `--force` (exit 14, `ReconciliationConflict`).

YAML permits multiple valid serializations of the same document and coerces unquoted scalars (`no` → boolean, `1.0` → float). Either behaviour produces spurious hash mismatches, which surface as false "manually edited" conflicts and block extraction.

`component.json` is normative, not a preference:

| Source         | Statement                                                            |
| -------------- | -------------------------------------------------------------------- |
| PRD RF-20      | "Each repo **MUST** declare its metadata in a root `component.json`" |
| Spec §4.5      | Component repo layout lists `component.json`                         |
| Spec §4.6      | Schemas: JSON Schema 2020-12 via `ajv`                               |
| S-009 (merged) | `dt extract component` writes `component.json` via `JSON.stringify`  |
| S-010 (merged) | `dt validate-component` validates `component.json`                   |

### Known drift

Issue bodies [#42](https://github.com/llipe/dev-tasks/issues/42) and [#43](https://github.com/llipe/dev-tasks/issues/43) refer to `component.yaml` in their acceptance criteria. This is a copy/paste artifact from an abandoned YAML draft, catalogued as Drift-1 in the S-010 verifier audit, which concluded no implementation change was warranted.

A regression test in `test/unit/catalog-build.test.ts` asserts that a repo carrying only `component.yaml` is reported in `index.errors[]` rather than silently accepted, so the drift cannot return unnoticed.
