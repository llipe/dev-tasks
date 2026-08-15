# Implementation Plan - Extraction Ladder Inversion (declared → observed → inferred)

> **GitHub Issue:** https://github.com/llipe/dev-tasks/issues/127
> **Branch:** `claude/dev-tasks-codebase-analysis-oxda22`
> **PR:** https://github.com/llipe/dev-tasks/pull/125

> **Note — context for the implementer:**
> `dt extract` currently leads with *inference* (AST route discovery, hand-written ORM parsers, kafkajs pattern matching ≈ 2,750 LOC) while the *observation* paths are stubs or unrunnable (`route2.ts` is 56 lines of interface, `information-schema.ts` depends on `pg` which is not declared anywhere). Detection also assumes a single root `package.json`, so monorepos detect as "nothing". This plan implements three changes:
>
> 1. **Invert the strategy ladder.** Every extractor runs rungs in order **declared → observed → inferred**, stopping at the first rung that produces a usable result. Inference becomes a last-resort fallback that always emits `confidence: low` and populates `unresolved[]`.
> 2. **Make the component (not the repo) the unit of extraction.** Discover workspace packages and run detection/extraction per package, emitting N components. This dissolves the mono-repo vs multi-repo branch.
> 3. **Split determinism from judgment.** `dt` owns only what is checkable (parse declared specs, query `information_schema`, introspect a booted app, validate, diff). All naming/description/relevance judgment moves to the agent layer via an explicit skeleton + `unresolved[]` handoff. The stubbed in-CLI `LlmProvider` is removed.
>
> **Prerequisite before implementation starts:** create a GitHub Issue for this plan (delegate to `github-ops`) and sync this checklist into it — the `implement` skill requires an open issue with a matching checklist. Branch suggestion: `issue/<n>-extraction-ladder-inversion`.
>
> **Sequencing rationale:** Task 1 (spike) is a deliberate go/no-go gate — it validates the core bet (boot-and-introspect beats AST inference) in ~1 day before committing to the rest. Task 2 (workspace discovery) comes before the ladder work because later tasks operate per component. Tasks 3–6 invert one extractor each. Tasks 7–8 implement the judgment handoff. Task 9 is docs/closure.

## Relevant Files

### Core — extraction

- `core/extract/provider.ts` - Provider interface, `RepoContext`, `DetectionResult` (extend with component/workspace context)
- `core/extract/detect.ts` - Detection orchestrator, first-match-wins loop (extend to per-component detection)
- `core/extract/providers/node-ts.ts` - Node/TS provider; single-root `package.json` assumption lives here (line ~40)
- `core/extract/component.ts` - `component.json` derivation (becomes per-component, N outputs)
- `core/extract/schema.ts` - Schema extraction orchestrator; `LlmProvider` interface to remove; dynamic import of information-schema
- `core/extract/openapi/index.ts` - OpenAPI orchestrator (re-order rungs)
- `core/extract/openapi/route1.ts` - Declared rung (on-disk spec) — keep as-is, becomes rung 1
- `core/extract/openapi/route2.ts` - Observed rung (boot + introspect) — currently a stub, gets implemented
- `core/extract/openapi/route3.ts` - Inferred rung (AST) — demoted to fallback, always `confidence: low`
- `core/extract/openapi/llm-descriptions.ts` - To remove (judgment moves to agent layer)
- `core/extract/orm/information-schema.ts` - Observed rung for DB schema — becomes runnable (`pg` declared)
- `core/extract/orm/prisma.ts`, `core/extract/orm/drizzle.ts`, `core/extract/orm/typeorm.ts` - Declared-artifact parsers — re-classified as declared rung (they parse committed schema files), kept
- `core/extract/orm/llm-descriptions.ts`, `core/extract/orm/migration-inference.ts` - LLM stubs to remove/strip
- `core/extract/asyncapi/index.ts`, `core/extract/asyncapi/topics.ts`, `core/extract/asyncapi/payloads.ts` - Add declared rung (on-disk asyncapi.yaml) ahead of kafkajs inference; demote inference
- `core/extract/report.ts` - Extraction report — add per-field rung provenance (`declared`/`observed`/`inferred`)

### Adapters / CLI

- `adapters/cli/extract-all.ts` - Full-pipeline orchestrator (per-component loop, ladder order)
- `adapters/cli/extract-detect.ts`, `adapters/cli/extract-openapi.ts`, `adapters/cli/extract-schema.ts`, `adapters/cli/extract-asyncapi.ts`, `adapters/cli/extract-component.ts` - Per-extractor CLI wrappers (component selection flag, ladder flags)
- `adapters/cli/init.ts` - `loadLlmProvider()` (line ~455) to remove; mode detection simplification

### Schemas / config

- `schemas/component.schema.json` - Add rung provenance to `_provenance`; add agent-judgment fields (`description`, etc.) marked as agent-owned
- `package.json` - Declare `pg` as optional peer dependency (`peerDependenciesMeta`)

### Prompt layer (all three platforms — keep in parity)

- `.claude/skills/activity-init/SKILL.md`, `.github/skills/activity-init/SKILL.md`, `.kiro/skills/activity-init/SKILL.md` - Mode detection + skeleton-fill handoff
- `.claude/commands/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.kiro/agents/product-engineer.md` - dt invocation guidance
- `README.md` - Known Limitations section rewrite
- `docs/dt-user-manual.md`, `docs/artifact-formats.md` - Ladder + handoff documentation

### Tests

- `test/unit/extract-openapi-route2.test.ts` - New
- `test/unit/extract-workspaces.test.ts` - New
- `test/unit/extract-ladder.test.ts` - New (rung-ordering contract)
- `test/fixtures/extract/monorepo-pnpm/`, `test/fixtures/extract/express-bootable/`, `test/fixtures/extract/fastify-bootable/` - New fixtures
- Existing `test/unit/extract-*.test.ts` and `test/integration/extract-*.test.ts` - Updated expectations (confidence downgrades, per-component output)

## Tasks

- [x] 1.0 Spike: Route 2 (boot + introspect) for Express — go/no-go gate

  > Note: The point of this task is to validate cheaply that runtime introspection beats AST inference before the rest of the plan is executed. Timebox: one session. If the spike fails its exit criteria, STOP and return to the user with findings — do not proceed to Task 4 unmodified.

  - [x] 1.1 Create fixture `test/fixtures/extract/express-bootable/`: a minimal Express app whose routes `route3` (AST) currently fails to fully resolve — include at least one dynamically-registered route (e.g., routes registered in a loop from a config array) and one router mounted with a variable prefix. `package.json` must have a resolvable entry point and no external service dependencies (no DB connection at import time).
  - [x] 1.2 Write failing test first (`test/unit/extract-openapi-route2.test.ts`): expect route2 to return all fixture endpoints with `source: "observed"`, `confidence: "high"`, including the dynamically-registered ones.
  - [x] 1.3 Implement a minimal runner: a child-process script that (a) resolves the app entry point from `package.json` (`main`, then common candidates `src/app.ts`, `src/index.ts`, `app.ts`, `index.ts`; overridable via `--entry`), (b) imports the module with `NODE_ENV=test` and a hard timeout (default 10s), (c) locates the Express app export (default export, named `app`, or `createApp()` factory), (d) walks `app._router.stack` recursively to enumerate method + composed path per route, (e) prints JSON to stdout. Parent process runs it via `execa` with the timeout and treats any failure (nonzero exit, timeout, unparseable output) as "rung unavailable" — never as a crash of `dt` itself.
  - [x] 1.4 Run the same fixture through `route3` and record the comparison in the spike notes: endpoints found, endpoints missed, LOC of the runner vs. route3's 856.
  - [x] 1.5 Verify Acceptance Criterion: route2 spike resolves ≥1 endpoint on the fixture that route3 reports in `unresolved[]`, in ≤ ~300 LOC of runner code.
  - [x] 1.6 Decision gate: record go/no-go and any design corrections (entry-point resolution strategy, timeout defaults, failure taxonomy) in a short note appended to this file under a `## Spike Findings` heading. Pause for user review before starting 2.0.

- [ ] 2.0 Component discovery: workspace-aware, per-package detection (Recommendation 2)

  - [x] 2.1 Write failing tests first (`test/unit/extract-workspaces.test.ts`): given fixtures for (a) single-package repo, (b) pnpm workspace (`pnpm-workspace.yaml`), (c) npm/yarn `workspaces` field, expect a discovery function to return the correct list of component roots (package dir + parsed `package.json`), with the workspace root itself excluded when it declares no runtime deps.
  - [x] 2.2 Create fixture `test/fixtures/extract/monorepo-pnpm/` with a workspace root (`pnpm-workspace.yaml`, root `package.json` with only devDependencies) and two packages: `packages/api` (Express + Prisma) and `packages/worker` (kafkajs), each with its own `package.json`.
  - [x] 2.3 Implement `discoverComponents(repoRoot)` in a new `core/extract/workspaces.ts`: read `pnpm-workspace.yaml` globs and/or root `package.json` `workspaces` field, resolve package dirs (no recursion into `node_modules`), fall back to `[repoRoot]` when no workspace config exists. Deterministic ordering (alphabetical by path).
  - [x] 2.4 Extend `RepoContext` in `core/extract/provider.ts` with `componentRoot` (absolute path of the package being detected) and `repoRoot` (repo checkout root), and change `core/extract/providers/node-ts.ts` to read `package.json` from `componentRoot` instead of the repo root.
  - [ ] 2.5 Update `runDetection` / `adapters/cli/extract-detect.ts` and `adapters/cli/extract-all.ts` to loop over discovered components: run detection and extraction per component, emit `component.json` per component (at each component root; single-package repos keep today's root-level output path unchanged), and aggregate an `extraction_report.json` at repo root with a per-component section.
  - [ ] 2.6 Update `core/extract/component.ts` and `schemas/component.schema.json` so multi-component output validates (component id derives from package name; document the derivation rule in the schema description).
  - [ ] 2.7 Verify Acceptance Criterion: `dt extract all` on the monorepo fixture emits two `component.json` files with correct per-package framework/ORM/messaging detection, and unchanged output for the single-package fixtures.
  - [ ] 2.8 Verify Acceptance Criterion: root-only detection no longer reports "no framework" for the monorepo fixture (the current failure mode).
  - [ ] 2.9 Run Tests: `pnpm run test:unit` and `pnpm run test:integration` (extract suites) green; update any existing fixtures/tests broken by the `RepoContext` change.

- [x] 3.0 Ladder contract: rung ordering, provenance, and confidence policy (Recommendation 1, shared plumbing)

  - [x] 3.1 Write failing tests first (`test/unit/extract-ladder.test.ts`): a ladder runner given three fake rungs (declared/observed/inferred) must (a) stop at the first rung returning a usable result, (b) fall through on "rung unavailable", (c) stamp every emitted field with its rung, (d) force `confidence: low` on anything produced by an inferred rung.
  - [x] 3.2 Implement the ladder runner in a new `core/extract/ladder.ts`: `runLadder<T>(rungs: Rung<T>[]): LadderResult<T>` where each rung declares `kind: "declared" | "observed" | "inferred"`; result carries the winning rung, per-field provenance, and merged `unresolved[]` from skipped/failed rungs' diagnostics.
  - [x] 3.3 Define the confidence policy as code, not convention: `declared → high`, `observed → high`, `inferred → low` (capped — an inferred rung MUST NOT emit `medium` or `high`), and expose it from `ladder.ts` so extractors cannot set confidence directly.
  - [x] 3.4 Extend `core/extract/report.ts` and `schemas/component.schema.json` `_provenance` so every extracted section records `rung: declared|observed|inferred` alongside the existing `source`/`confidence` fields; keep backward compatibility for readers (additive fields only).
  - [x] 3.5 Verify Acceptance Criterion: ladder unit tests pass; schema validation (`dt validate-component`) accepts a manifest carrying the new provenance fields.
  - [x] 3.6 Run Tests: `pnpm run test:unit` green.

- [x] 4.0 OpenAPI ladder: route1 (declared) → route2 (observed) → route3 (inferred, demoted)

  - [x] 4.1 Write/extend failing tests first: (a) ladder order — when `openapi.yaml` exists on disk, route2/route3 are not attempted; (b) when no spec exists but the app boots, route2 wins with `rung: observed`; (c) when boot fails (fixture with an import-time crash), route3 output is used and every endpoint carries `confidence: low` + the boot failure reason appears in `unresolved[]`.
  - [x] 4.2 Productionize the spike runner from Task 1 into `core/extract/openapi/route2.ts` (replacing the stub): Express support per the spike design, plus structured failure taxonomy (`entry-not-found`, `import-failed`, `no-app-export`, `timeout`) surfaced as rung diagnostics.
  - [ ] 4.3 Add Fastify support to route2: prefer registering an `onRoute` hook via a wrapper import when the entry exports the Fastify instance or a factory; fall back to `app.printRoutes({ commonPrefix: false })` parsing. New fixture `test/fixtures/extract/fastify-bootable/` + tests. (Hono/NestJS: explicitly out of scope — record as follow-up in 9.5.)
  - [ ] 4.4 Add a route2 secondary probe: if the booted app exposes a spec endpoint (`GET /openapi.json`, `/docs/json`, `/swagger.json` against the in-process app, not a network port), capture the full spec — this upgrades the result from route-table-only to full request/response schemas. Best-effort; failure falls back to the route table.
  - [x] 4.5 Rewire `core/extract/openapi/index.ts` to run the three routes through the Task 3 ladder runner; demote route3: cap all its output at `confidence: low` (removing any current `medium`/`high` grants) and always emit its misses into `unresolved[]`.
  - [ ] 4.6 Add CLI flags in `adapters/cli/extract-openapi.ts`: `--entry <path>` (route2 entry override), `--no-boot` (skip observed rung for CI environments where booting is unsafe), `--boot-timeout <ms>` (default 10000).
  - [x] 4.7 Update existing route1/route3 tests and the `extract-all` integration test for the new ladder ordering and confidence caps.
  - [x] 4.8 Verify Acceptance Criterion: on `express-bootable`, `dt extract openapi` returns observed endpoints including the dynamic routes route3 misses; on `openapi-on-disk` fixture, route1 still wins untouched; on a non-bootable fixture, route3 fallback works and is visibly low-confidence.
  - [x] 4.9 Verify Acceptance Criterion: `dt extract openapi --no-boot` never spawns a child process.
  - [x] 4.10 Run Tests: `pnpm run test:unit` and `pnpm run test:integration` green.

- [ ] 5.0 Database schema ladder: declared parsers → information_schema (observed), runnable at last

  > Note: The ORM file parsers (prisma/drizzle/typeorm) parse *committed schema files* — under the ladder taxonomy they are **declared**-rung extractors and are kept, not deleted. What changes: `information_schema` becomes actually runnable and takes over whenever a live dev DB is available, and pattern-inference beyond the declared file (e.g., migration-inference) is demoted/removed.

  - [ ] 5.1 Declare `pg` in `package.json` as an optional peer dependency (`peerDependencies` + `peerDependenciesMeta: { pg: { optional: true } }`), and make `core/extract/schema.ts`'s dynamic import produce a clear, actionable `unresolved[]` entry ("--db-url provided but `pg` is not installed; run `pnpm add -D pg`") instead of a raw import error. Write the test first.
  - [ ] 5.2 Wire schema extraction through the Task 3 ladder in `core/extract/schema.ts`: rung 1 declared = existing ORM file parsers (schema.prisma / drizzle schema / typeorm entities); rung 2 observed = `information_schema` when `--db-url` is provided. When both succeed, observed wins for structure (tables/columns/constraints as they actually exist) and the report records a `declared-vs-observed` diff summary in `unresolved[]` if they disagree — that disagreement is exactly what the agent/human should see.
  - [ ] 5.3 Remove `core/extract/orm/migration-inference.ts` and its `LlmProvider` usage (inference-by-LLM inside the CLI is out per Recommendation 3); migrations directory presence remains a declared *signal* (path recorded in the manifest) without inferred table structures. Update/remove its tests.
  - [ ] 5.4 Add integration test for the observed rung using a mocked `PgClientFactory` (the seam already exists in `information-schema.ts`) — no Docker requirement in CI.
  - [ ] 5.5 Verify Acceptance Criterion: `dt extract schema --db-url <url>` with `pg` installed returns `rung: observed` results; without `pg` it degrades to declared parsers plus the actionable unresolved entry; without `--db-url` behavior is unchanged from today except for added rung provenance.
  - [ ] 5.6 Run Tests: `pnpm run test:unit` and `pnpm run test:integration` green.

- [ ] 6.0 AsyncAPI ladder: declared spec first, kafkajs inference demoted

  - [x] 6.1 Write failing test first: when `asyncapi.yaml`/`asyncapi.json` exists on disk (fixture `test/fixtures/extract/component-derivation/docs/asyncapi.yaml` already exists — add a root-level variant), the declared rung wins and kafkajs AST inference is not attempted.
  - [x] 6.2 Implement the declared rung in `core/extract/asyncapi/`: detect + copy + validate an on-disk AsyncAPI spec (mirroring route1's candidate-path approach), `rung: declared`, `confidence: high`.
  - [ ] 6.3 Route the existing kafkajs topic/payload inference through the ladder as the inferred rung: cap at `confidence: low`, always emit unresolved diagnostics for opaque payloads/string topics (the existing fixtures `kafkajs-opaque-payloads`, `kafkajs-string-topics` become the regression tests for the cap).
  - [ ] 6.4 Verify Acceptance Criterion: repo with a committed AsyncAPI spec gets it verbatim (declared); repo with only kafkajs code gets inference results that are uniformly `low` confidence.
  - [ ] 6.5 Run Tests: `pnpm run test:unit` green.

- [x] 7.0 Remove the in-CLI LLM; define the skeleton + unresolved[] agent handoff (Recommendation 3)

  - [x] 7.1 Delete `loadLlmProvider()` from `adapters/cli/init.ts` (~line 455) and every `DT_LLM_PROVIDER` reference; delete `core/extract/openapi/llm-descriptions.ts` and `core/extract/orm/llm-descriptions.ts`; remove the `llm?` parameter from `core/extract/schema.ts` and the `--no-llm` flag from the CLI (it becomes meaningless). Update all affected tests — write the updated expectations first.
  - [x] 7.2 Mark judgment fields explicitly in `schemas/component.schema.json`: fields that deterministic extraction cannot produce (`description`, endpoint summaries, table/topic descriptions) get a `_provenance.source: "agent"` allowed value and are omitted (not empty-stringed) by `dt`. `dt validate-component` MUST accept their absence.
  - [x] 7.3 Make the handoff explicit in the extraction report: `core/extract/report.ts` gains a `handoff` section listing (a) every judgment field left empty, with its JSON pointer, and (b) every `unresolved[]` item, so an agent can be pointed at one machine-readable list of "what needs a mind". Test first.
  - [x] 7.4 Verify Acceptance Criterion: `dt extract all` completes with zero LLM configuration, never throws `"configured but not yet implemented"`, and its report's `handoff` section enumerates exactly the fields an agent must fill.
  - [x] 7.5 Run Tests: `pnpm run test` fully green (unit + integration).

- [ ] 8.0 Prompt layer: teach the workflow the new division of labor (all three platforms in parity)

  - [ ] 8.1 Update `activity-init` SKILL.md (`.claude/`, `.github/`, `.kiro/` — identical wording except platform-required frontmatter): after `dt extract all`, the agent MUST read `extraction_report.json`'s `handoff` section, fill the enumerated judgment fields in `component.json` (descriptions, summaries), resolve what `unresolved[]` items it can from reading the code, and present the remainder to the human. Remove any implication that `dt` produces descriptions itself.
  - [ ] 8.2 Simplify mode detection in `activity-init` and the `product-engineer` entry points (`.claude/commands/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.github/prompts/product-engineer-init.prompt.md`, `.kiro/agents/product-engineer.md`): workspace-aware extraction removes the mono-vs-multi-repo branching — a repo yields N components either way. Keep meta-repo mode distinct.
  - [ ] 8.3 Verify Acceptance Criterion: `diff` of each updated skill across the three platform trees shows only frontmatter/path differences (use the same platform-parity discipline as issue #110's task 6.0).
  - [ ] 8.4 Verify Acceptance Criterion: no prompt-layer file still references removed capabilities (`DT_LLM_PROVIDER`, `--no-llm`, LLM descriptions inside dt) — `grep` returns nothing outside `workstream/archive/`.

- [ ] 9.0 Documentation, quality gates, and closure

  - [ ] 9.1 Rewrite README "Known Limitations": remove entries fixed by this plan (Route 2 interface-only, LLM stubbed, monorepo blindness), add honest current ones (route2 frameworks = Express + Fastify; observed DB rung = PostgreSQL only; kafkajs-only messaging inference remains, now low-confidence).
  - [ ] 9.2 Update `docs/dt-user-manual.md` (ladder semantics, new flags `--entry`/`--no-boot`/`--boot-timeout`, `pg` install note, per-component output layout) and `docs/artifact-formats.md` (rung provenance fields, `handoff` section, agent-owned fields). Add changelog entries to both docs per repo convention.
  - [ ] 9.3 Run full quality gates and record results: `pnpm run validate` (typecheck + lint + format:check + test) and `pnpm run audit`. Fix anything red.
  - [ ] 9.4 Invoke `verifier` in `audit` mode against the delivered implementation (mandatory, non-skippable per `implement` skill) and post the human-readable summary to the issue/PR; route any drift findings to `product-engineer`'s `activity-drift-reconciliation`.
  - [ ] 9.5 File follow-up issues via `github-ops` for explicitly deferred scope: route2 support for Hono and NestJS; observed DB rung for MySQL/SQLite; messaging clients beyond kafkajs; optional Docker-based ephemeral-DB flow for the observed schema rung.
  - [ ] 9.6 Invoke `technical-writer` for the docs drift/stale-doc check; resolve any findings.
  - [ ] 9.7 Verify Acceptance Criterion: all parent tasks 1.0–8.0 checked, quality gates green, verifier audit posted, PR converted from Draft to Ready for Review.



## Spike Findings

### Decision: GO ✓

Route 2 (boot + introspect) conclusively beats Route 3 (AST inference) on the express-bootable fixture.

### Comparison Results

| Metric | Route 3 (AST) | Route 2 (Boot) |
|--------|---------------|----------------|
| Total endpoints found | 6 | 10 |
| Correctly-pathed endpoints | 3 | 10 |
| Dynamic routes (loop-registered) | 0/4 | 4/4 |
| Variable-prefix router routes | 3 wrong-path | 3 correct |
| Confidence | low | high |
| LOC | 856 | 283 (runner) + 285 (parent) = 568 total |

### Key Findings

1. **Route2 resolves 7 endpoints that route3 gets wrong or misses entirely:**
   - 4 completely invisible to AST (registered via `app[route.method](route.path, handler)` in a loop)
   - 3 found by AST but with wrong paths (router mounted with variable prefix `\`/api/${apiVersion}\``)

2. **Express 5 changes:** The installed Express is v5.2.1 (not v4). Key differences:
   - Router accessed via `app.router` (not `app._router`)
   - Layers use `matchers[]` array instead of `regexp`
   - Layer.path is populated after calling `layer.match()`, not stored upfront
   - The introspection script handles both Express 4 and 5 transparently.

3. **Entry-point resolution:** `package.json` `main` field works. Fallback chain: `src/app.ts`, `src/index.ts`, `src/server.ts`, `app.ts`, `index.ts`, `server.ts`.

4. **Timeout and failure handling:** Tested with timeout=1ms — correctly returns null (rung unavailable). No-framework fixture correctly returns null.

5. **NODE_PATH for dependency resolution:** The child process needs `NODE_PATH` set to the nearest `node_modules` directory. In production projects this is the project's own `node_modules`; for test fixtures (which don't have their own deps installed) it finds the parent project's `node_modules` by traversing up.

### Design Corrections for Task 4 (Productionize)

- Support Express 4 (`app._router`) AND Express 5 (`app.router`) — already implemented
- The probe-based prefix discovery works but generates many test paths; consider capping iterations or using a more targeted strategy for deeply-nested mounts
- Default timeout of 10s is appropriate; apps that need DB connections at import time will timeout and gracefully fall back to route3
- Runner LOC at 283 is within the ~300 target
- `execFile` (not `execa`) was used since it's in Node stdlib — no new dependency needed
