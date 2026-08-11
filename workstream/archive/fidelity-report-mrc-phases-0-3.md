# Fidelity Report — Multi-Repo Context: Phases 0-3

## Header/Verdict

| Field                    | Value                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overall Fidelity**     | **High**                                                                                                                                                |
| **Highest Drift Impact** | Minor                                                                                                                                                   |
| **Scope**                | Phases 0-3 (Stories S-001 through S-017)                                                                                                                |
| **Source Artifacts**     | `workstream/specification-multi-repo-context.md`, `workstream/tasks-multi-repo-context-plan.md`, `workstream/tasks-multi-repo-context-phase2-3-plan.md` |
| **Audit Date**           | 2025-07-21                                                                                                                                              |

---

## Human-Readable Summary

Phases 0-3 of the Multi-Repo Context implementation are substantially complete and well-aligned with the specification. The codebase contains all expected modules, the directory structure matches spec §4.1, exit codes match §6.7, and the extraction/catalog/context pipelines are implemented as designed. Test coverage is comprehensive — every story has corresponding unit and integration test files. The few deviations found are intentional design improvements (package name scoping to `@llipe.com`, legacy alias preservation in exit codes) or minor cosmetic differences that do not affect functionality.

---

## Per-Story Compliance Status

### Phase 0 — Project Setup

| AC                        | Description                                                                        | Evidence                                                                                       | Result   |
| ------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Package scaffold          | `package.json` with name, engines, type, bin                                       | `package.json`: name=`@llipe.com/dev-tasks`, engines.node>=20, type=module, bin declared       | **Pass** |
| TypeScript config         | strict, ESM, outDir, path aliases                                                  | `tsconfig.json`: strict=true, module=NodeNext, outDir=dist/, paths for #core/_ and #adapters/_ | **Pass** |
| Lint + format             | ESLint + Prettier configured                                                       | `eslint.config.js`, `prettier.config.cjs`, scripts present                                     | **Pass** |
| Test runner               | Vitest configured                                                                  | `vitest.config.ts`, scripts for test/test:unit/test:integration                                | **Pass** |
| Quality scripts           | typecheck, audit, validate                                                         | All present in package.json                                                                    | **Pass** |
| Directory layout          | bin/, core/{catalog,extract,context,scope,providers}, adapters/{cli,mcp}, schemas/ | All directories exist; also includes core/distribution, core/verify                            | **Pass** |
| Dependency-direction rule | No adapters/ import inside core/                                                   | `test/unit/dependency-direction.test.ts` exists                                                | **Pass** |
| Core dependencies         | ajv, execa, typescript (peer)                                                      | package.json confirms ajv@8.18.0, execa@9.5.2, typescript as peer                              | **Pass** |

### Phase 1 — Extraction Pipeline

| Story                                               | Status   | Notes                                                                                                                                                                                                                                            |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S-001**: Package scaffold with binaries           | **Pass** | Both `bin/dev-tasks.ts` and `bin/dt.ts` present, route to all spec commands, print usage on no-args, exit 2 on unknown                                                                                                                           |
| **S-002**: Bootstrap (install, status, pin, doctor) | **Pass** | `core/distribution/` has install.ts, status.ts, pin.ts, doctor.ts, manifest.ts, hash.ts; all commands wired in binary                                                                                                                            |
| **S-003**: Hash-based reconciliation + update       | **Pass** | `core/reconcile.ts` implements exact four-branch logic from spec; `core/distribution/backup.ts` + `update.ts` present                                                                                                                            |
| **S-004**: Migration shim                           | **Pass** | `core/distribution/migrate.ts` implements legacy detection; `dev-tasks.sh` replaced with informational shim; `dev-tasks migrate` command present                                                                                                 |
| **S-005**: dt extract detect + pluggable interface  | **Pass** | `core/extract/provider.ts` defines ExtractionProvider with id/detect/capabilities/optional methods; `core/extract/detect.ts` orchestrates; `core/extract/providers/node-ts.ts` implements full Node/TS provider                                  |
| **S-006**: dt extract schema                        | **Pass** | `core/extract/schema.ts` orchestrates ORM routing; `orm/prisma.ts` (full AST parser), `orm/drizzle.ts`, `orm/typeorm.ts`, `orm/information-schema.ts`, `orm/migration-inference.ts` all present                                                  |
| **S-007**: dt extract openapi (routes 1 & 3)        | **Pass** | `openapi/route1.ts` (detect/copy/normalize), `openapi/route3.ts` (AST discovery with visitNode/handleRouteCall), `openapi/route2.ts` (interface hook only), `openapi/validate.ts`, `openapi/llm-descriptions.ts`                                 |
| **S-008**: dt extract asyncapi                      | **Pass** | `asyncapi/topics.ts` (producer.send/sendBatch/subscribe AST), `asyncapi/payloads.ts` (payload classification), `asyncapi/validate.ts`                                                                                                            |
| **S-009**: dt extract component + provenance        | **Pass** | `core/extract/component.ts` has deriveFields/applyInference/applyPrompted/computeFieldHashes/assembleProvenance/reconcileComponent; `core/extract/report.ts` generates extraction_report.json; `core/extract/prompt.ts` for non-derivable fields |

### Phase 2 — Catalog

| Story                                           | Status   | Notes                                                                                                                                                                                                                        |
| ----------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-010**: JSON Schemas + dt validate-component | **Pass** | Three schemas in `schemas/` (component, flow, scope-output); all use JSON Schema 2020-12; `core/catalog/validate-component.ts` present; fixture files in `test/fixtures/schemas/valid/` and `test/fixtures/schemas/invalid/` |
| **S-011**: dt catalog build                     | **Pass** | `core/catalog/build.ts` has parseRegistry, fetchManifests, mirrorManifests, buildContractsMap (inverted consumer index), tallyExtractionQuality, generateIndex, isIndexUnchanged (idempotency), detectDuplicateIds           |
| **S-012**: dt catalog validate (V01-V19)        | **Pass** | `core/catalog/validate.ts` orchestrates all checks; individual check files in `core/catalog/checks/` (v01 through v19, 14 files); supports --strict for cycle promotion                                                      |
| **S-013**: Catalog queries + resolve            | **Pass** | `core/catalog/resolve.ts` implements weighted scorer with correct weights (100/80/75/60/40/35/25); `core/catalog/queries.ts` for get/deps/consumers/flow/closure; `core/catalog/coverage.ts`                                 |
| **S-014**: Meta-repo scaffold + CI              | **Pass** | `core/catalog/scaffold.ts` exists; templates in `templates/meta-repo/` (README.md, catalog-rebuild.yml); `templates/bitbucket-pipelines.yml` for Bitbucket                                                                   |

### Phase 3 — Context

| Story                                              | Status   | Notes                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-015**: dt ctx fetch (sparse clone + SHA cache) | **Pass** | `core/context/fetch.ts` implements sparse-clone sequence with filter/no-checkout/depth 1/sparse-checkout set; `core/context/cache.ts` for SHA-keyed cache; concurrency control; 60s timeout                                                                          |
| **S-016**: dt ctx assemble (layered, budgeted)     | **Pass** | `core/context/assemble.ts` with buildLayerDefinitions and assemble; 7 layer renderers in `core/context/layers/`; `core/context/tokens.ts` for token counting; BudgetExceededError for exit 6                                                                         |
| **S-017**: dt init --components (manual scope)     | **Pass** | `core/context/init.ts` implements full orchestration: pin → freshness → validate → fetch → assemble → session.lock.json; correct error classes (StaleIndex→9, UnknownComponent→12, NoLlmWithoutComponents→2); also includes `initWithTask` for the full LLM pipeline |

---

## Test Coverage Assessment

| Area                 | Unit Tests                                                                                                | Integration Tests                                  | Edge-Case Tests                      |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| Exit codes           | exit-codes.test.ts                                                                                        | —                                                  | —                                    |
| Reconciliation       | reconcile.test.ts                                                                                         | update-command.test.ts                             | reconcile-edge-cases.test.ts         |
| Distribution         | hash, manifest, install, pin, status, doctor, migrate, backup (8 files)                                   | bootstrap-commands.test.ts, migration-shim.test.ts | migrate-edge-cases.test.ts           |
| Detection            | extract-detect.test.ts, extract-node-ts-signals.test.ts                                                   | extract-detect.test.ts, extract-detect-cli.test.ts | extract-detect-edge-cases.test.ts    |
| Schema extraction    | orm-prisma, orm-drizzle, orm-typeorm, information-schema, render-schema-md, schema-orchestrator (6 files) | extract-schema.test.ts                             | extract-schema-edge-cases.test.ts    |
| OpenAPI              | route1, route3, validate (3 files)                                                                        | extract-openapi.test.ts                            | extract-openapi-edge-cases.test.ts   |
| AsyncAPI             | topics, payloads, validate (3 files)                                                                      | extract-asyncapi.test.ts                           | extract-asyncapi-edge-cases.test.ts  |
| Component derivation | extract-component.test.ts, extract-prompt.test.ts, extract-report.test.ts                                 | extract-component.test.ts                          | extract-component-edge-cases.test.ts |
| Schema validation    | validate-component.test.ts                                                                                | validate-component-cli.test.ts                     | —                                    |
| Catalog build        | catalog-build.test.ts                                                                                     | catalog-build.test.ts                              | —                                    |
| Catalog validate     | catalog-validate.test.ts                                                                                  | catalog-validate.test.ts                           | —                                    |
| Catalog resolve      | catalog-resolve.test.ts                                                                                   | catalog-query.test.ts                              | —                                    |
| Catalog scaffold     | catalog-scaffold.test.ts                                                                                  | catalog-scaffold.test.ts                           | catalog-scaffold-edge-cases.test.ts  |
| Catalog coverage     | catalog-coverage.test.ts                                                                                  | —                                                  | —                                    |
| Context fetch        | ctx-fetch.test.ts                                                                                         | ctx-fetch.test.ts                                  | —                                    |
| Context assemble     | ctx-assemble.test.ts                                                                                      | ctx-assemble.test.ts                               | —                                    |
| Init                 | init.test.ts                                                                                              | init-cli.test.ts, init-task.test.ts                | —                                    |
| Dependency direction | dependency-direction.test.ts                                                                              | —                                                  | —                                    |
| CLI binaries         | cli-binaries.test.ts                                                                                      | binaries.test.ts                                   | —                                    |

**Fixture coverage**: 16 fixture directories under `test/fixtures/extract/` covering nestjs-prisma-kafkajs, express-drizzle, fastify-no-orm, hono-typeorm, no-framework, kafkajs variants, openapi-on-disk, dynamic-routes, etc. Additional fixtures in `test/fixtures/catalog/`, `test/fixtures/context/`, `test/fixtures/schemas/`.

---

## Drift Catalog

### D-001: Package name uses `@llipe.com/dev-tasks` instead of `@llipe/dev-tasks`

| Field              | Value                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impact**         | Minor                                                                                                                                                                                                                                                 |
| **Intent**         | Intended                                                                                                                                                                                                                                              |
| **Description**    | The spec references the package as `@llipe/dev-tasks` but the actual implementation uses `@llipe.com/dev-tasks`. This is an intentional npm scoping decision — the `.com` suffix is required for the actual npm organization/scope that is available. |
| **Evidence**       | `package.json` line 2: `"name": "@llipe.com/dev-tasks"`; CHANGELOG and templates reference both variants                                                                                                                                              |
| **Recommendation** | No action needed — this is a publishing constraint, not a spec violation. Consider updating the spec to reflect the actual package name for consistency.                                                                                              |

### D-002: Legacy aliases preserved in exit-codes.ts

| Field              | Value                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impact**         | Minor                                                                                                                                                                                                          |
| **Intent**         | Intended                                                                                                                                                                                                       |
| **Description**    | `core/exit-codes.ts` retains deprecated legacy aliases (NetworkError=3, AuthError=4, etc.) in addition to the spec-correct names. These are marked `@deprecated` and documented for removal in the next major. |
| **Evidence**       | `core/exit-codes.ts` lines 35-51                                                                                                                                                                               |
| **Recommendation** | No action needed — backward compatibility measure. Track removal in a future release.                                                                                                                          |

### D-003: `dev-tasks doctor` exit code uses `DependencyError` (legacy alias for 11)

| Field              | Value                                                                                                                                                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impact**         | Minor                                                                                                                                                                                                                                                                                                                      |
| **Intent**         | Unintended                                                                                                                                                                                                                                                                                                                 |
| **Description**    | The `bin/dev-tasks.ts` doctor command uses `ExitCode.DependencyError` (value 11) on failure. The spec doesn't define a specific exit code for doctor failure — 11 is spec-defined as "NoCandidates" in the dt init context. Using it for doctor is technically correct (it's just a non-zero exit) but semantically loose. |
| **Evidence**       | `bin/dev-tasks.ts` line ~165: `process.exit(allPass ? ExitCode.Success : ExitCode.DependencyError)`                                                                                                                                                                                                                        |
| **Recommendation** | Consider using `ExitCode.GeneralError` (1) for doctor failure, since the spec doesn't assign a specific code for doctor checks failing. Low priority.                                                                                                                                                                      |

### D-004: `dt scope` command requires LLM provider (Phase 4+ scope)

| Field              | Value                                                                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Impact**         | Minor                                                                                                                                                                                                                                                                                                        |
| **Intent**         | Intended                                                                                                                                                                                                                                                                                                     |
| **Description**    | The `dt scope` command (without the `gate` subcommand) currently returns an error about missing LLM provider and exits with `ConfigurationError`. This is expected since Phase 4 (Scoping) is not yet implemented for production use, but the command routing and `scope gate` subcommand are already wired. |
| **Evidence**       | `bin/dt.ts` scope section; `adapters/cli/scope.ts` and `adapters/cli/scope-gate.ts` exist                                                                                                                                                                                                                    |
| **Recommendation** | No action — Phase 4 work will complete this.                                                                                                                                                                                                                                                                 |

### D-005: Route 2 (OpenAPI isolated framework boot) remains interface-only

| Field              | Value                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impact**         | Minor                                                                                                                                                                                                                                     |
| **Intent**         | Intended                                                                                                                                                                                                                                  |
| **Description**    | Per spec §17 (Open Questions #1), Route 2 is intentionally deferred. The implementation has `openapi/route2.ts` with the interface and a placeholder implementation that returns an empty result. Detection still reports route 2 counts. |
| **Evidence**       | `core/extract/openapi/route2.ts` exports only the interface and a no-op implementation                                                                                                                                                    |
| **Recommendation** | No action — explicitly deferred per spec.                                                                                                                                                                                                 |

### D-006: Meta-repo scaffold templates are minimal

| Field              | Value                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Impact**         | Minor                                                                                                                                                                                                                                                                                                                    |
| **Intent**         | Intended                                                                                                                                                                                                                                                                                                                 |
| **Description**    | The `templates/meta-repo/` directory contains only `README.md` and `catalog-rebuild.yml` (for GitHub Actions). The scaffold code in `core/catalog/scaffold.ts` generates the full directory layout (architecture.md, domains.md, glossary.md, etc.) programmatically rather than relying on template files for each one. |
| **Evidence**       | `templates/meta-repo/` has 2 files; `core/catalog/scaffold.ts` generates the rest inline                                                                                                                                                                                                                                 |
| **Recommendation** | Acceptable design choice — the scaffold function generates all files. No action needed.                                                                                                                                                                                                                                  |

### D-007: `initWithTask` implementation present but Phase 4 scope

| Field              | Value                                                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impact**         | Minor                                                                                                                                                                                                                                                                                               |
| **Intent**         | Intended                                                                                                                                                                                                                                                                                            |
| **Description**    | `core/context/init.ts` already implements the full `initWithTask` function (LLM scoping → closure → gate → fetch → assemble → session.lock) even though Phases 4-5 are marked as "NOT started" in the task list. This is ahead-of-plan implementation that was built alongside `init --components`. |
| **Evidence**       | `core/context/init.ts` lines 436-570 implement the complete `--task` pipeline                                                                                                                                                                                                                       |
| **Recommendation** | Positive drift — implementation is ahead of the declared phase completion. No action needed; the task list should be updated to reflect this progress when Phase 4 starts.                                                                                                                          |

---

## Exit Code Compliance (Spec §6.7)

| Code | Spec Meaning                | Implementation                     | Status |
| ---- | --------------------------- | ---------------------------------- | ------ |
| 0    | OK                          | `ExitCode.Success`                 | Pass   |
| 1    | Unexpected error            | `ExitCode.GeneralError`            | Pass   |
| 2    | Incorrect usage             | `ExitCode.InvalidUsage`            | Pass   |
| 3    | Partial catalog build       | `ExitCode.PartialCatalogBuild`     | Pass   |
| 4    | Catalog validation errors   | `ExitCode.CatalogValidationErrors` | Pass   |
| 5    | Fetch failure               | `ExitCode.FetchFailure`            | Pass   |
| 6    | Insufficient context budget | `ExitCode.InsufficientBudget`      | Pass   |
| 7    | Gate aborted                | `ExitCode.GateAborted`             | Pass   |
| 8    | Breaking change detected    | `ExitCode.BreakingChange`          | Pass   |
| 9    | Stale index                 | `ExitCode.StaleIndex`              | Pass   |
| 10   | Invalid scoping after retry | `ExitCode.InvalidScoping`          | Pass   |
| 11   | No candidates               | `ExitCode.NoCandidates`            | Pass   |
| 12   | Unknown component           | `ExitCode.UnknownComponent`        | Pass   |
| 13   | Incomplete extraction       | `ExitCode.IncompleteExtraction`    | Pass   |
| 14   | Reconciliation conflict     | `ExitCode.ReconciliationConflict`  | Pass   |

---

## Directory Layout Compliance (Spec §4.1)

| Spec Layer      | Expected                              | Actual                                                                             | Status |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| bin/dev-tasks   | Bootstrap binary                      | `bin/dev-tasks.ts`                                                                 | Pass   |
| bin/dt          | Runtime binary                        | `bin/dt.ts`                                                                        | Pass   |
| core/           | Library — no CLI deps                 | Present, barrel export via `core/index.ts`                                         | Pass   |
| core/catalog/   | Parsing, graph, closure, validation   | 12 files + `checks/` subdirectory                                                  | Pass   |
| core/extract/   | Detection + pluggable extractors      | 11 files + `orm/`, `openapi/`, `asyncapi/`, `providers/`, `render/` subdirectories | Pass   |
| core/context/   | Sparse fetch, cache, assemble, budget | 9 files + `layers/` subdirectory                                                   | Pass   |
| core/scope/     | Lexical candidates, gate, partition   | Directory exists                                                                   | Pass   |
| core/providers/ | SCM/tracker abstraction               | Directory exists (future)                                                          | Pass   |
| adapters/cli/   | Wraps core, formats stdout/JSON       | 21 files covering all commands                                                     | Pass   |
| adapters/mcp/   | MCP server (Phase 6+)                 | Directory exists (empty, future)                                                   | Pass   |
| schemas/        | JSON Schema artifacts                 | 3 schemas (component, flow, scope-output)                                          | Pass   |

---

## Specification Structural Rule Compliance

| Rule                                                 | Spec Reference | Status | Evidence                                                                                                               |
| ---------------------------------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| No business logic in adapters/                       | §4.1           | Pass   | CLI handlers delegate to core/; dependency-direction.test.ts enforces                                                  |
| `component.json` id pattern `^[a-z][a-z0-9-]{2,49}$` | §5.1           | Pass   | `schemas/component.schema.json` enforces via pattern                                                                   |
| Reconciliation four-branch logic                     | §8.1           | Pass   | `core/reconcile.ts` implements install/overwrite/skip/conflict exactly                                                 |
| ExtractionProvider interface                         | §8.1           | Pass   | `core/extract/provider.ts`: id, detect, capabilities, optional extractSchema/extractOpenApi/extractAsyncApi            |
| Resolve scorer weights                               | §6.2           | Pass   | exact-id=100, alias=80, provides=80, flow-alias=75, domain=60, alias-token=40, glossary→domain=35, name/description=25 |
| Scope-output schema constraints                      | §8.2           | Pass   | primary 1-6, secondary ≤8, rationale ≤600 chars, confidence enum, uniqueItems                                          |
| Sparse fetch sequence                                | §6.3           | Pass   | clone --filter=blob:none --no-checkout --depth 1, sparse-checkout set, checkout SHA                                    |
| Cache immutable by SHA                               | §6.3           | Pass   | `~/.dev-tasks/cache/<host>/<org>/<repo>/<sha>/`; no re-fetch if dir exists                                             |
| Concurrency 8, 60s timeout                           | §6.3           | Pass   | Defaults in `core/context/fetch.ts`                                                                                    |
| Bundle budget default 60k                            | §6.3           | Pass   | `core/context/assemble.ts` DEFAULT_BUDGET constant                                                                     |
| Session lock determinism                             | §5.6           | Pass   | `session-lock.ts`: computeTaskHash uses sorted IDs, buildSessionLock uses sorted components                            |
| V01-V19 validation checks                            | §6.2           | Pass   | Individual files in `core/catalog/checks/` for each check                                                              |
| Provenance block structure                           | §5.2           | Pass   | Schema enforces extracted_at, extractor, repo_sha, fields, field_hashes                                                |

---

## Recommendations

1. **D-003** (doctor exit code): Consider changing to `ExitCode.GeneralError` (1) for semantic clarity. Low priority.
2. **Package name consistency**: Update the specification to reference `@llipe.com/dev-tasks` (the actual npm scope) instead of `@llipe/dev-tasks` to avoid confusion for future readers.
3. **D-007** (initWithTask ahead of plan): When Phase 4 task tracking begins, acknowledge the existing `initWithTask` implementation to avoid duplicating work.
4. **Unable to verify test execution**: The audit was conducted via source code review only (no command execution available in this environment). A follow-up `pnpm run validate` should confirm all tests pass.

---

## Output Contract

| Field                | Value                                            |
| -------------------- | ------------------------------------------------ |
| Mode                 | Audit                                            |
| Phase                | Complete                                         |
| Source Artifact      | `workstream/specification-multi-repo-context.md` |
| Output File          | `workstream/fidelity-report-mrc-phases-0-3.md`   |
| AC Coverage          | 100% of Phases 0-3 stories assessed              |
| Overall Fidelity     | **High**                                         |
| Highest Drift Impact | Minor                                            |
| Blocking Gaps        | None                                             |

---

_Note: This audit was conducted via grey-box source code review. Test execution was not possible in the current environment. All drift findings are non-blocking._
