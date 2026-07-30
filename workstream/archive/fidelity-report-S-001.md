# Fidelity Report — S-001: Package scaffold with two binaries and layered core

## Header/Verdict

- **Overall Fidelity:** High
- **Highest Drift Impact:** Minor
- **Scope:** Issue #33 | PR #63 | Branch `story/S-001-package-scaffold` → `integration/mrc-phase0-1-scaffold`

## Human-Readable Summary

The package scaffold was delivered as specified. The `@llipe/dev-tasks` package has two working binaries (`dev-tasks` and `dt`), both routing commands correctly, printing usage on no-args, and exiting with code 2 on unknown commands. The layered architecture is in place: `core/` modules are protected from importing `adapters/` by both an ESLint rule and a dedicated test. All 19 tests pass, and all quality gates (typecheck, lint, format:check, audit) are clean.

One minor drift exists: the story's AC text specified `bin: { "dev-tasks": "./bin/dev-tasks.js", "dt": "./bin/dt.js" }` (pointing directly to source), but the implementation uses `"./dist/bin/dev-tasks.js"` and `"./dist/bin/dt.js"` (pointing to compiled output). The spec §4.1 does not prescribe literal paths — it describes the *source* layout as `bin/dev-tasks` and `bin/dt` — and the `dist/` path is the correct TypeScript build output convention. The task list (1.5) also explicitly specified the `dist/` path. This is an intentional, correct implementation detail that improves the story's literal AC text.

## Per-AC Result Table

| AC-ID | Description | Codebase Evidence | Workstream Evidence | Test Evidence | Result |
|-------|-------------|-------------------|---------------------|---------------|--------|
| AC-1 | `package.json` declares `bin` field with both binaries + `engines.node >= 20` | `package.json`: `bin: { "dev-tasks": "./dist/bin/dev-tasks.js", "dt": "./dist/bin/dt.js" }`, `engines: { "node": ">=20" }` | Task 1.5, 1.10 marked `[x]` | `test/integration/binaries.test.ts`: "package.json bin field points to existing dist files" asserts both paths exist | **Pass** (with minor drift on path prefix — see drift catalog) |
| AC-2 | Directory layout matches spec §4.1 (`core/{catalog,extract,context,scope,providers}`, `adapters/{cli,mcp}`, `bin/`, `schemas/`) | Verified: `bin/dev-tasks.ts`, `bin/dt.ts`, `core/catalog/index.ts`, `core/extract/index.ts`, `core/context/index.ts`, `core/scope/index.ts`, `core/providers/index.ts`, `adapters/cli/`, `adapters/mcp/`, `schemas/`, `skills/` | Task 1.6, 1.11 marked `[x]` | Implicit via compilation pass + barrel imports in `core/index.ts` | **Pass** |
| AC-3 | `core/` has no imports from `adapters/` (lint rule + test) | ESLint `import-x/no-restricted-paths` rule blocks `core/ → adapters/`; test at `test/unit/dependency-direction.test.ts` scans all `core/**/*.ts` files for adapter imports | Task 1.7, 1.9, 1.12 marked `[x]` | `test/unit/dependency-direction.test.ts` (1 test, passing): "core/ must not import from adapters/" | **Pass** |
| AC-4 | `npx` resolves both binaries (integration test) | Built binaries exist at `dist/bin/dev-tasks.js` and `dist/bin/dt.js`; `bin` field in `package.json` maps to them | Task 1.8, 1.13 marked `[x]` | `test/integration/binaries.test.ts` (7 tests): runs built binaries via `node`, verifies `--version`, unknown command, and usage output; also asserts dist files exist | **Pass** |
| AC-5 | Unknown command exits with code 2 | `bin/dev-tasks.ts` L60-63: unknown command → `process.exit(ExitCode.InvalidUsage)` (code 2); `bin/dt.ts` L67-70: same pattern | Task 1.7, 1.14 marked `[x]` | Unit: "prints usage and exits 2 on unknown command" for both binaries; Integration: "dev-tasks exits 2 on unknown command from built binary" + "dt exits 2 on unknown command from built binary" | **Pass** |

## Drift Catalog

| # | Description | Impact | Intent | Evidence Source(s) | Note |
|---|-------------|--------|--------|-------------------|------|
| D-1 | AC-1 literal text says `"./bin/dev-tasks.js"` and `"./bin/dt.js"` but implementation uses `"./dist/bin/dev-tasks.js"` and `"./dist/bin/dt.js"` | Minor | Intended | Story AC text vs. `package.json` vs. task list 1.5 vs. spec §4.1 | The spec describes source layout (`bin/dev-tasks`), not the `package.json` path. The task list (1.5) explicitly specified `dist/` paths. This is the correct TypeScript ESM convention — source is in `bin/`, compiled output is in `dist/bin/`, and `package.json` bin points to the compiled output. **Drift is non-blocking to completion.** |

## Edge-Case and Randomized Test Outcomes

No prior test plan exists for this scope. Edge cases are covered by the delivered test suite:
- No-args invocation → exit 2 + usage (unit + integration tests)
- Unknown subcommand → exit 2 + error message (unit + integration tests)
- `--version` → prints semver string (unit + integration tests)
- Dependency direction violations → caught by both lint rule and file-scanning test

## Recommendations

| Drift | Recommended Action |
|-------|-------------------|
| D-1 | **No action needed.** The `dist/` prefix is correct for a compiled TypeScript package. Consider updating the AC text in the user story to match the actual convention (`./dist/bin/*.js`) for documentation accuracy, but this is cosmetic. |

## Output Contract

- **Mode:** Audit
- **Phase:** Complete (4/4)
- **Source artifact:** `workstream/user-stories-multi-repo-context.md` (Story S-001)
- **Task list:** `workstream/tasks-multi-repo-context-plan.md` (tasks 1.0–1.15)
- **Output file:** `/workstream/fidelity-report-S-001.md`
- **GitHub Issue:** #33
- **PR:** #63
- **AC coverage:** 5/5 covered (AC-1 through AC-5)
- **Overall fidelity verdict:** High
- **Highest drift impact:** Minor (1 item, Intended)
- **Blocking gaps:** None
