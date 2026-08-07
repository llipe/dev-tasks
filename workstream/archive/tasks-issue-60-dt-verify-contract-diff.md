# Tasks — Issue #60: dt verify contract-diff (OpenAPI + AsyncAPI breaking-change detection)

## Story

**S-024:** As CI, I want `dt verify contract-diff` to detect breaking changes in OpenAPI and AsyncAPI specs without an LLM, so that boundary breakage is caught deterministically before merge.

## Acceptance Criteria

- [x] OpenAPI diffs use custom comparator; AsyncAPI diffs use custom comparator (removed channel, new required field, changed type, narrowed enum).
- [x] No LLM is used in any case (RF-50).
- [x] Contracts with `payload_confidence: low` are excluded from breaking-change evaluation.
- [x] A detected breaking change exits 8.
- [x] Runs on component-repo PRs when `contracts/` changed (CLI wired via `dt verify contract-diff`).

## Tasks

- [x] 1. Define shared types for contract-diff results (`core/verify/types.ts`)
- [x] 2. Implement OpenAPI breaking-change comparator (`core/verify/openapi-diff.ts`)
- [x] 3. Implement AsyncAPI breaking-change comparator with low-confidence skip (`core/verify/asyncapi-diff.ts`)
- [x] 4. Implement contract-diff orchestrator (`core/verify/contract-diff.ts`)
- [x] 5. Wire CLI adapter (`adapters/cli/verify-contract-diff.ts`)
- [x] 6. Wire `dt verify contract-diff` subcommand in `bin/dt.ts`
- [x] 7. Add exit code `BreakingChange: 8` to `core/exit-codes.ts`
- [x] 8. Create test fixtures (OpenAPI + AsyncAPI base/breaking/non-breaking YAML)
- [x] 9. Write unit tests for OpenAPI comparator
- [x] 10. Write unit tests for AsyncAPI comparator
- [x] 11. Write integration tests for contract-diff orchestrator
- [x] 12. Run quality gates and verify all pass

## Relevant Files

- `core/verify/types.ts` — shared types
- `core/verify/openapi-diff.ts` — OpenAPI comparator
- `core/verify/asyncapi-diff.ts` — AsyncAPI comparator
- `core/verify/contract-diff.ts` — orchestrator
- `core/verify/index.ts` — module barrel export
- `adapters/cli/verify-contract-diff.ts` — CLI adapter
- `bin/dt.ts` — CLI entry (verify command routing)
- `core/exit-codes.ts` — exit code definitions
- `test/unit/verify-openapi-diff.test.ts` — OpenAPI unit tests
- `test/unit/verify-asyncapi-diff.test.ts` — AsyncAPI unit tests
- `test/unit/verify-contract-diff.test.ts` — orchestrator integration tests
- `test/fixtures/verify/` — YAML fixtures
