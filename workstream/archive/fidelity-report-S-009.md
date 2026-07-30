# Fidelity Report — Story S-009 (Issue #40)

## Header/Verdict

| Attribute | Value |
|-----------|-------|
| **Overall Fidelity** | **High** |
| **Highest Drift Impact** | **None** |
| **Scope** | Story S-009 — `dt extract component` — provenance, human gate, idempotency, report |
| **PR** | [#73](https://github.com/llipe/dev-tasks/pull/73) |
| **Branch** | `story/S-009-extract-component` → `integration/mrc-phase1-extraction` |
| **Issue** | [#40](https://github.com/llipe/dev-tasks/issues/40) |

---

## Human-Readable Summary

The `dt extract component` feature was delivered as specified. The component extraction pipeline correctly derives fields from detection/extraction outputs, gates inferable fields behind human confirmation, prompts for non-derivable fields interactively, records full provenance with per-field source/confidence/hashes, implements hash-based idempotent reconciliation, generates a comprehensive `extraction_report.json`, and exits with the correct error codes (13 for missing required fields, 14 for reconciliation conflicts). The `dt extract all` command orchestrates the full pipeline end-to-end. All 73 story-specific tests and 446 total tests pass. No drift from the specification was found.

---

## Per-AC Result Table

| AC-ID | Description | Codebase Evidence | Workstream Evidence | Test Evidence | Result |
|-------|-------------|-------------------|---------------------|---------------|--------|
| AC 9.12 | Derivable fields come from detection/extraction | `component.ts:deriveFields()` — stack, type, provides, datastores, paths, docs, consumes all derived from `ExtractionInputs` (detection + schema/openapi/asyncapi results) | Task 9.1.1 ✓ | `extract-component.test.ts`: 9 tests verify derivation (stack from detection, type from type_hint, provides from OpenAPI, datastores from schema tables, docs from file paths, consumes from asyncapi) | **Pass** |
| AC 9.13 | Inferable fields require human confirmation; aliases not persisted without confirmation | `component.ts:applyInference()` — only applies when `confirmed.*` is `true`; `prompt.ts:confirmInference()` returns `false` in non-interactive mode | Task 9.1.2 ✓ | `extract-component.test.ts`: 4 tests (confirmed/unconfirmed description, aliases, subdomain); `extract-component-edge-cases.test.ts`: 2 tests (alias unconfirmed → empty, not in provenance) | **Pass** |
| AC 9.14 | Non-derivable fields prompted; unanswered → empty → invalid manifest | `prompt.ts:promptNonDerivableFields()` — TTY detection, returns empty when non-interactive; `component.ts:getMissingRequiredFields()` checks owner/domain/criticality/lifecycle | Task 9.1.3 + 9.2 ✓ | `extract-prompt.test.ts`: 6 tests; `extract-component-edge-cases.test.ts`: 3 tests (empty values, missing fields reported, exit 13) | **Pass** |
| AC 9.15 | Every field/artifact carries source + confidence + _provenance | `component.ts:assembleProvenance()` — builds `ProvenanceBlock` with `extracted_at`, `extractor`, `repo_sha`, `detector`, per-field `source`/`confidence`/`confirmed_by`, `field_hashes` | Task 9.3 ✓ | `extract-component.test.ts`: 5 tests in `assembleProvenance()` section (detected→high, inferred→medium+confirmed_by, prompted→high, field_hashes present, empty excluded) | **Pass** |
| AC 9.16 | Idempotent re-run; edited fields → conflict + diff; no overwrite without --force | `component.ts:reconcileComponent()` using `core/reconcile.ts`; `extract-component.ts` and `extract-all.ts` both check reconciliation before writing | Task 9.4 ✓ | `extract-component.test.ts`: 4 reconcile tests; `extract-component-edge-cases.test.ts`: 1 force test; `integration/extract-component.test.ts`: 2 tests (idempotent re-run = skip, edited field = conflict) | **Pass** |
| AC 9.17 | extraction_report.json with strategies, coverage, confidence, unresolved, requires_human | `report.ts:buildExtractionReport()` — assembles all fields; `extract-all.ts` writes the file | Task 9.5 ✓ | `extract-report.test.ts`: 11 tests (timestamp, strategies, coverage metrics, confidence counts, unresolved, requires_human, zero/empty/all-low edge cases, serialization); `integration/extract-component.test.ts`: 1 test | **Pass** |
| AC 9.18 | Exit 13 on missing required fields; exit 14 on conflict | `exit-codes.ts`: `MissingRequiredField: 13`, `ReconciliationConflict: 14`; both `extract-component.ts` and `extract-all.ts` return these codes in the correct conditions | Task 9.6 + 9.7 ✓ | `extract-component-edge-cases.test.ts`: 2 tests (exit code values); CLI handlers return correct codes on missing/conflict conditions | **Pass** |

---

## Drift Catalog

No drift items detected. All acceptance criteria are fully satisfied by the delivered implementation.

---

## Edge-Case and Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Unanswered prompts → empty + exit 13 | 3 unit tests | Pass |
| --force overwrite bypasses reconciliation | 1 unit test + CLI behavior | Pass |
| Alias unconfirmed → not persisted | 2 unit tests | Pass |
| All-low-confidence repo | 1 unit test | Pass |
| Partial prompted values | 1 unit test | Pass |
| Null detection/extraction inputs | 2 unit tests | Pass |
| First extraction (null existing hashes) | 1 unit test | Pass |
| Idempotent re-run | 1 integration test | Pass |
| Manual field edit → conflict | 1 integration test | Pass |

---

## Recommendations

No remediation actions required. The implementation is complete, well-tested, and faithfully matches the specification.

---

## Output Contract

| Field | Value |
|-------|-------|
| Mode | Audit |
| Phase | 4 — Reporting & Publication |
| Source artifact | `workstream/tasks-multi-repo-context-plan.md` (tasks 9.0–9.19) |
| Output file | `workstream/fidelity-report-S-009.md` |
| GitHub issue | [#40](https://github.com/llipe/dev-tasks/issues/40) |
| AC coverage | 7/7 covered (100%) |
| Overall fidelity | High |
| Highest drift impact | None |
| Blocking gaps | None |
