# Implementation Plan - dt verify impact and dt verify drift

## Relevant Files

- `core/verify/impact.ts` - Impact analysis: consumer lookup from inverted index with criticality
- `core/verify/drift.ts` - Drift heuristic: docs/code recency via git log
- `core/providers/tracker.ts` - Tracker provider interface stub for --emit-tasks
- `core/verify/types.ts` - Shared types (extend with impact/drift types)
- `core/verify/index.ts` - Barrel exports (extend)
- `adapters/cli/verify-impact.ts` - CLI adapter for dt verify impact
- `adapters/cli/verify-drift.ts` - CLI adapter for dt verify drift
- `bin/dt.ts` - Wire impact/drift subcommands
- `test/unit/verify-impact.test.ts` - Unit tests for impact
- `test/unit/verify-drift.test.ts` - Unit tests for drift
- `test/integration/verify-impact.test.ts` - Integration tests for impact over fixture catalog

## Tasks

- [x] 1.0 Implement Issue #61 - https://github.com/llipe/dev-tasks/issues/61: dt verify impact and dt verify drift

  - [x] 1.1 Define tracker provider interface stub in `core/providers/tracker.ts`
  - [x] 1.2 Define impact/drift types in `core/verify/types.ts`
  - [x] 1.3 Implement `impact` core logic in `core/verify/impact.ts` (consumer lookup + criticality from inverted index)
  - [x] 1.4 Implement `--emit-tasks` logic with graceful degradation when provider unavailable
  - [x] 1.5 Implement `drift` heuristic in `core/verify/drift.ts` (git log recency over paths.source vs docs.root)
  - [x] 1.6 Update `core/verify/index.ts` barrel exports
  - [x] 1.7 Create CLI adapter `adapters/cli/verify-impact.ts` with --contract, --emit-tasks, --json
  - [x] 1.8 Create CLI adapter `adapters/cli/verify-drift.ts` with --id, --threshold, --json
  - [x] 1.9 Wire `impact` and `drift` subcommands in `bin/dt.ts`
  - [x] 1.10 Write unit tests for impact (consumer lookup + criticality)
  - [x] 1.11 Write unit tests for drift (heuristic computation)
  - [x] 1.12 Write integration tests for impact over fixture catalog
  - [x] 1.13 Write edge-case tests (no consumers, provider unavailable, threshold boundary)
  - [x] 1.14 Verify AC1: `impact --contract <id>` lists consumers with criticality
  - [x] 1.15 Verify AC2: `--emit-tasks` produces per-consumer derived tasks via tracker provider
  - [x] 1.16 Verify AC3: `drift` computes docs/code recency heuristic
  - [x] 1.17 Verify AC4: Both support `--json`
  - [x] 1.18 Verify AC5: `--emit-tasks` degrades gracefully when provider unavailable
  - [x] 1.19 Run quality gates: `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test`
