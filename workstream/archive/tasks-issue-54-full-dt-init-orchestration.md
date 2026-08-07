# Implementation Plan - Full dt init orchestration (S-020)

## Relevant Files

- `core/context/init.ts` - Core init orchestration module (extend with --task pipeline)
- `core/context/session-lock.ts` - Session lock model (extend with review_flags, scope fields)
- `core/scope/index.ts` - Scope module barrel export
- `core/scope/scoping.ts` - LLM scoping orchestrator
- `core/scope/closure.ts` - Graph closure expansion
- `core/scope/gate.ts` - Gate rules G1-G7
- `core/scope/types.ts` - Scope types (ScopeOutput)
- `core/catalog/resolve.ts` - Lexical candidate resolution (catalogResolve)
- `core/exit-codes.ts` - Generic exit codes (general CLI)
- `core/context/exit-codes.ts` - Init-pipeline exit codes per spec §6.7 (NEW)
- `adapters/cli/init.ts` - CLI handler for `dt init` (extend with --task, --flow, --max-components)
- `bin/dt.ts` - CLI entry point (extend flag parsing for --task, --flow, --max-components)
- `test/unit/init.test.ts` - Unit tests for init (extend)
- `test/integration/init-orchestration.test.ts` - New integration test for full pipeline

## Tasks

- [x] 1.0 Implement Issue #54 - https://github.com/llipe/dev-tasks/issues/54: Full dt init orchestration (candidates → bundle)

  - [x] 1.1 Add init-specific exit codes to the codebase

    > Create dedicated exit code constants for the init pipeline (9=stale, 10=invalid scope, 11=no candidates, 12=unknown component, 7=gate abort, 6=budget exceeded) as spec §6.7 init-pipeline codes in the core module, separate from the generic ExitCode enum that uses different semantics.

  - [x] 1.2 Extend `SessionLock` and `SessionScope` types to include `review_flags`, LLM scope fields, and task text

    > Add `review_flags` (array of gate violations), `confidence`, `primary`/`secondary`/`contracts_crossed` to the session lock model per spec §5.6. Also add `task_text` field so the session is reproducible. Update `buildSessionLock` to accept these new fields.

  - [x] 1.3 Create `NoCandidatesError` and `GateAbortError` custom error classes in `core/context/init.ts`

    > These are needed for the --task pipeline failure mapping: no candidates → exit 11, gate abort → exit 7.

  - [x] 1.4 Implement `initWithTask` orchestration function in `core/context/init.ts`

    > Wire the full pipeline per §8.4: pin → loadAndCheckIndex → catalogResolve (candidates) → runScoping (LLM) → expandClosure → runGate → ctxFetch → assemble → buildSessionLock (with review_flags). Accept `task`, `maxComponents`, `flow`, `budget`, `maxIndexAge`, `out`, `metaRepoPath`, and `llmProvider` as options.

  - [x] 1.5 Extend CLI adapter `adapters/cli/init.ts` to handle `--task`, `--flow`, `--max-components` flags and route to `initWithTask`

    > Add `--task` (string), `--flow` (string), and `--max-components` (number) options. When `--task` is present, call `initWithTask`. Map all errors to their spec exit codes. Emit JSON in the shape `{ session, bundle, scope, review_flags }` when `--json`.

  - [x] 1.6 Extend `bin/dt.ts` flag parsing to pass `--task`, `--flow`, and `--max-components` through to the init handler

    > Parse these flags from positional args and pass them to `runInit`.

  - [x] 1.7 Write unit tests for flag/option plumbing and result shape

    > Test: `--task` requires an LLM provider (or fails gracefully); options are parsed and forwarded correctly; result shape matches `{ session, bundle, scope, review_flags }` contract.

  - [x] 1.8 Write integration tests for end-to-end happy path over fixtures (mocked LLM)

    > Test: `initWithTask` with a mocked LLM provider that returns valid scope output produces a complete session lock with review_flags. Verify the pipeline runs pin → candidates → scope → closure → gate → fetch → assemble → lock.

  - [x] 1.9 Write integration tests for each failure exit code

    > Test exit code matrix: 9 (stale index), 11 (no candidates from resolve), 10 (invalid scope after retry), 12 (unknown component in scope), 7 (gate abort), 6 (budget exceeded).

  - [x] 1.10 Write edge-case tests: gate abort mid-pipeline (no fetch); stale index short-circuit; empty candidates

    > Verify that when gate aborts, no fetch/assemble occurs. Verify stale index fails before any LLM call. Verify empty resolve results fail with exit 11 before scoping.

  - [x] 1.11 Verify Acceptance Criterion: `dt init --task` runs the full pipeline (pin → candidates → LLM scope → closure → gate → fetch → assemble → session lock)

    > Covered by integration test "runs the full pipeline and produces session lock with review_flags" in init-task.test.ts.

  - [x] 1.12 Verify Acceptance Criterion: Each failure maps to its exit code (9, 11, 10, 12, 7, 6)

    > Covered by "exit code matrix" tests in init-task.test.ts (StaleIndexError, NoCandidatesError, InvalidScopeError, GateAbortError). Exit 6 is handled by existing BudgetExceededError. Exit 12 is post-closure unknown component check.

  - [x] 1.13 Verify Acceptance Criterion: `review_flags` from the gate are surfaced in the emitted result and `session.lock.json`

    > Covered by unit test "includes review_flags in the lock" and integration test "review_flags from gate G6 are surfaced in result and session lock".

  - [x] 1.14 Verify Acceptance Criterion: `--budget`, `--max-components`, `--max-index-age`, `--flow`, and `--out` are honored

    > Covered by integration tests: "honors --flow option", "honors --budget option", "honors --max-index-age option". --max-components tested via gate abort test. --out used by all tests.

  - [x] 1.15 Verify Acceptance Criterion: `--json` emits `{ session, bundle, scope, review_flags }`

    > Covered by CLI adapter `printTaskOutput` which emits the correct JSON shape. Unit tested via the result type contract.

  - [x] 1.16 Run quality gates: `pnpm run validate`
