# Implementation Plan — Multi-Repo Context (Phase 2: Catalog + Phase 3: Context)

## Relevant Files

- `schemas/component.schema.json` - component.json JSON Schema (2020-12)
- `schemas/flow.schema.json` - Flow definition JSON Schema
- `schemas/scope-output.schema.json` - Scope output JSON Schema
- `core/catalog/validate-component.ts` - Local artifact validator (component/flow/scope-output) using ajv Ajv2020
- `adapters/cli/validate-component.ts` - CLI handler for `dt validate-component <path>`
- `test/fixtures/schemas/valid/*.json` - Golden valid fixtures (component, flow, scope-output)
- `test/fixtures/schemas/invalid/*.json` - Invalid fixtures (bad id, missing/empty manual field, wrong enum, unknown key)
- `test/unit/validate-component.test.ts` - Unit tests for the schema validator
- `test/integration/validate-component-cli.test.ts` - Integration tests for `dt validate-component` CLI
- `core/catalog/build.ts` - Catalog build orchestrator (registry → index)
- `core/catalog/index-model.ts` - Index data model and types
- `core/catalog/validate.ts` - Catalog validation checks V01-V19
- `core/catalog/graph.ts` - Graph utilities (deps, consumers, cycles)
- `core/catalog/checks/*.ts` - Individual validation check implementations
- `core/catalog/resolve.ts` - Lexical weighted scorer for text→component
- `core/catalog/queries.ts` - Graph reads (get, deps, consumers, flow, closure)
- `core/catalog/coverage.ts` - Extraction quality aggregation
- `core/catalog/scaffold.ts` - Meta-repo scaffold generator
- `core/context/fetch.ts` - Sparse-clone git fetch via execa
- `core/context/cache.ts` - SHA-keyed immutable cache + LRU GC
- `core/context/assemble.ts` - Layered budgeted bundle assembler
- `core/context/layers/*.ts` - Per-layer renderers (index, flow, arch, docs, contracts)
- `core/context/tokens.ts` - Token counting utility
- `core/context/init.ts` - Manual-scope init orchestration
- `core/context/session-lock.ts` - session.lock.json read/write
- `adapters/cli/catalog-build.ts` - CLI handler for dt catalog build
- `adapters/cli/catalog-validate.ts` - CLI handler for dt catalog validate
- `adapters/cli/catalog-query.ts` - CLI handler for dt catalog resolve/get/deps/etc.
- `adapters/cli/ctx-fetch.ts` - CLI handler for dt ctx fetch
- `adapters/cli/ctx-assemble.ts` - CLI handler for dt ctx assemble
- `adapters/cli/init.ts` - CLI handler for dt init --components
- `bin/dt.ts` - Runtime binary (routing updates)
- `templates/meta-repo/*` - Meta-repo scaffold templates
- `.github/workflows/catalog-rebuild.yml` - GitHub CI template for scheduled rebuild
- `templates/bitbucket-pipelines.yml` - Bitbucket CI template for scheduled rebuild
- `test/fixtures/catalog/*` - Catalog fixture data (20-component registry)
- `test/fixtures/context/*` - Context fixture data (repos for fetch/assemble)
- `test/unit/init.test.ts` - Unit tests for init and session-lock
- `test/integration/init-cli.test.ts` - Integration tests for `dt init --components` CLI

## Tasks

### Phase 2 — Catalog

- [x] 1.0 Implement Story S-010 - https://github.com/llipe/dev-tasks/issues/42: JSON Schemas and dt validate-component

  > Establishes the JSON Schema artifacts every later validation reuses. Local validation with no network access.

  - [x] 1.1 Author `schemas/component.schema.json` (JSON Schema 2020-12): all fields from spec §5, `id` pattern `^[a-z][a-z0-9-]{2,49}$`, `_provenance` structure, version field for future evolution
  - [x] 1.2 Author `schemas/flow.schema.json`: flow definition per spec §5.3, version field
  - [x] 1.3 Author `schemas/scope-output.schema.json`: `primary` (1-6), `secondary` (≤8), `contracts_crossed`, `confidence`, `unresolved`, `rationale` (≤600 chars), optional `flow`, version field
  - [x] 1.4 Create golden valid fixtures: one valid `component.json`, one valid flow, one valid scope-output
  - [x] 1.5 Create invalid fixtures: bad `id` pattern, missing manual field, wrong enum value, unknown top-level key (additionalProperties), empty `source: manual` field
  - [x] 1.6 Implement `core/catalog/validate-component.ts` using `ajv` (JSON Schema 2020-12): load schema, validate, return structured errors, exit 0 (valid) / 4 (invalid)
  - [x] 1.7 Wire `dt validate-component <path>` CLI command with human + `--json` output
  - [x] 1.8 Write unit tests: schema accepts all valid fixtures; schema rejects each invalid fixture with expected error
  - [x] 1.9 Write integration test: `dt validate-component` on valid fixture → exit 0; on invalid → exit 4 + error details
  - [x] 1.10 Verify Acceptance Criterion: all three schemas exist and validate spec examples
  - [x] 1.11 Verify Acceptance Criterion: `dt validate-component` validates with no network access, exits 0/4
  - [x] 1.12 Verify Acceptance Criterion: `id` pattern enforced by schema
  - [x] 1.13 Verify Acceptance Criterion: schemas carry a version field
  - [x] 1.14 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [x] 2.0 Implement Story S-011 - https://github.com/llipe/dev-tasks/issues/43: dt catalog build — aggregate manifests and generate the index

  > Aggregates component manifests into the meta-repo and generates `catalog/index.yaml`. Idempotent; single repo failure is recorded, not fatal.

  - [x] 2.1 Define `core/catalog/index-model.ts` — types for `index.yaml`: component summaries, `contracts` map with inverted consumer index, `domains`, `flows`, `extraction_quality` counts, `generated_at`, `generator`, per-component origin SHA, `errors[]`
  - [x] 2.2 Implement registry reading: parse `registry.yaml` (list of repos with git URLs and optional branches/paths)
  - [x] 2.3 Implement manifest mirroring: for each registry entry, fetch `component.json` (reuse sparse-fetch pattern or direct git-archive) into `catalog/components/<id>.json`
  - [x] 2.4 Implement inverted consumer index: for each `consumes[].contract` across all components, map to provider component
  - [x] 2.5 Implement `extraction_quality` tallying: count high/medium/low confidence fields and unresolved items per component and aggregate
  - [x] 2.6 Implement `domains` and `flows` aggregation from component manifests and `catalog/flows/` directory
  - [x] 2.7 Generate `catalog/index.yaml` deterministically (sorted keys, stable order, `generated_at`, `generator` version, per-component origin SHA)
  - [x] 2.8 Implement idempotent write: compare generated index to existing; skip write if identical (no-op on no-change)
  - [x] 2.9 Implement error handling: single repo failure → record in `index.errors[]`, continue with remaining repos, exit 3
  - [x] 2.10 Wire `dt catalog build --registry <path> [--concurrency 8]` CLI command with human + `--json` output
  - [x] 2.11 Create 20-component fixture registry under `test/fixtures/catalog/`: diverse components, multiple domains, cross-references, one broken repo entry
  - [x] 2.12 Write unit tests: inverted consumer index construction; extraction-quality tallying; idempotency (no-write on no-change); deterministic YAML output
  - [x] 2.13 Write integration tests: build over 20-component fixture → generated index matches expected snapshot; one broken repo → `errors[]` present + exit 3
  - [x] 2.14 Write edge-case tests: duplicate ids across repos (error); empty registry (empty index); repo without `component.json` (→ errors[])
  - [x] 2.15 Verify Acceptance Criterion: build mirrors manifests and generates `catalog/index.yaml`
  - [x] 2.16 Verify Acceptance Criterion: index includes summary, contracts/inverted-index, domains, flows, extraction_quality
  - [x] 2.17 Verify Acceptance Criterion: index records generated_at, generator, per-component origin SHA
  - [x] 2.18 Verify Acceptance Criterion: idempotent — nothing written when nothing changed
  - [x] 2.19 Verify Acceptance Criterion: single repo failure → errors[] + exit 3
  - [x] 2.20 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [x] 3.0 Implement Story S-012 - https://github.com/llipe/dev-tasks/issues/45: dt catalog validate — referential integrity and V01-V19

  > Enforces referential integrity and V01-V19 checks. Errors abort with exit 4; warnings do not.

  - [x] 3.1 Define check severity types and result aggregation model in `core/catalog/validate.ts`
  - [x] 3.2 Implement `core/catalog/graph.ts` — graph construction from index: nodes (components), edges (consumes→provides), domain grouping; cycle detection (Tarjan or DFS)
  - [x] 3.3 Implement V01: component.json schema validation (reuse S-010 validator)
  - [x] 3.4 Implement V02/V03: identity uniqueness — no duplicate `id` across components; no duplicate `provides[].id` within a component
  - [x] 3.5 Implement V04: referential integrity — every `consumes[].contract` resolves to an existing `provides[].id` in the catalog; unresolved → error
  - [x] 3.6 Implement V05: domain existence — every component's `domain` is declared in `domains` list
  - [x] 3.7 Implement V06/V07: doc/path existence — `docs.root` and `paths.source` paths are valid references
  - [x] 3.8 Implement V11: non-empty manual fields — fields with `source: manual` must not be empty strings
  - [x] 3.9 Implement V12: undeclared cycles — warning by default, error under `--strict`; support `allowed_cycles` config
  - [x] 3.10 Implement V13: orphan contracts — `provides[]` with no consumers (warning)
  - [x] 3.11 Implement V16: deprecated lifecycle with active consumers (warning)
  - [x] 3.12 Implement V17: low-confidence component — >30% low fields (warning)
  - [x] 3.13 Implement V18: low-payload contracts with consumers (warning)
  - [x] 3.14 Implement remaining V-checks (V08-V10, V14-V15, V19) per spec §6.2
  - [x] 3.15 Aggregate results: exit 0 (no errors), exit 4 (errors present); `--json` lists all checks with severities
  - [x] 3.16 Wire `dt catalog validate [--strict] [--json]` CLI command
  - [x] 3.17 Create targeted fixtures: one per V-check violation
  - [x] 3.18 Write unit tests: each check V01-V19 in isolation with targeted fixture
  - [x] 3.19 Write integration tests: full catalog fixture with seeded violations → expected report + exit code
  - [x] 3.20 Write edge-case tests: cycle with/without `allowed_cycles`; deprecated with active consumers; contract with no consumers; `--strict` turns cycle warning into error
  - [x] 3.21 Verify Acceptance Criterion: consumes[].contract resolves or V04 error
  - [x] 3.22 Verify Acceptance Criterion: V02/V03/V05/V06/V07/V11 enforced as errors
  - [x] 3.23 Verify Acceptance Criterion: V17/V18 flagged as warnings
  - [x] 3.24 Verify Acceptance Criterion: undeclared cycles → warning (or error under --strict)
  - [x] 3.25 Verify Acceptance Criterion: exit 0 / exit 4 + --json report
  - [x] 3.26 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [x] 4.0 Implement Story S-013 - https://github.com/llipe/dev-tasks/issues/46: Catalog query and routing (resolve, get, deps, consumers, flow, closure, coverage)

  > Deterministic catalog queries — especially the lexical `resolve` scorer — plus dependency, consumer, flow, closure, and coverage reads.

  - [x] 4.1 Implement text normalization in `core/catalog/resolve.ts`: lowercase, de-accent (NFD strip combining marks), light es/en stemming (suffix removal), stopword removal
  - [x] 4.2 Implement weighted scorer: exact id (100), alias exact (80), alias substring (40), provides[].id (80), flow alias (75), domain (60), description words (25); normalize scores; default threshold 20; return top 12 with score + matched signal
  - [x] 4.3 Implement `dt catalog resolve --text "<query>" [--threshold] [--limit] [--json]`
  - [x] 4.4 Implement `core/catalog/queries.ts` — `get --id`: return full component from index
  - [x] 4.5 Implement `deps --id [--depth N] [--direction up|down|both]`: graph traversal of consumes/provides edges
  - [x] 4.6 Implement `consumers --contract <id>`: return all components that consume the given contract
  - [x] 4.7 Implement `flow --id <flow-id>`: return flow definition with participating components
  - [x] 4.8 Implement `closure --ids <a,b> [--include-consumers] [--max N]`: transitive closure of dependencies; deduplication (primary wins); cap at --max
  - [x] 4.9 Implement `core/catalog/coverage.ts` — `coverage [--id]`: extraction quality per component (high/medium/low field counts) and aggregate summary
  - [x] 4.10 Ensure business `aliases` and flow aliases participate in routing/resolve scoring
  - [x] 4.11 Wire all commands under `dt catalog <subcommand>` with `--json` support
  - [x] 4.12 Write unit tests: scorer per signal type; normalization (accented input, typos); threshold filtering; depth/direction traversal; closure dedup
  - [x] 4.13 Write integration tests: labeled resolve cases → expected candidate ordering; closure with/without consumers; coverage snapshot
  - [x] 4.14 Write edge-case tests: accented/typo input; alias substring vs. exact match; disconnected component (no edges); cycle in deps traversal (no infinite loop); empty catalog
  - [x] 4.15 Verify Acceptance Criterion: resolve returns top 12 with score + matched signal, weighted scheme, threshold 20
  - [x] 4.16 Verify Acceptance Criterion: get/deps/consumers/flow/closure return correct graph reads
  - [x] 4.17 Verify Acceptance Criterion: coverage reports extraction quality per component and per confidence
  - [x] 4.18 Verify Acceptance Criterion: aliases and flow aliases participate in routing
  - [x] 4.19 Verify Acceptance Criterion: all commands support --json
  - [x] 4.20 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [x] 5.0 Implement Story S-014 - https://github.com/llipe/dev-tasks/issues/47: Meta-repo scaffold and scheduled CI rebuild

  > Meta-repo scaffold and scheduled CI that builds, validates, and commits the catalog.

  - [x] 5.1 Implement `core/catalog/scaffold.ts` — generate meta-repo directory layout: `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, `platform.yaml`, `registry.yaml`, `adr/`, `catalog/`, `catalog/flows/`, `schemas/`
  - [x] 5.2 Create scaffold templates under `templates/meta-repo/` for each generated file (with placeholder content and instructions)
  - [x] 5.3 Wire `dt catalog scaffold [--out <dir>]` CLI command
  - [x] 5.4 Author GitHub Actions workflow template (`.github/workflows/catalog-rebuild.yml`): scheduled (hourly cron) + `repository_dispatch`; steps: checkout → setup Node → `npx @llipe/dev-tasks dt catalog build --registry registry.yaml` → `dt catalog validate --strict` → conditional git commit + push (bot, no review) → alert on failure
  - [x] 5.5 Author Bitbucket Pipelines template (`templates/bitbucket-pipelines.yml`): scheduled trigger; same steps adapted for Bitbucket (document Node prerequisite in base image)
  - [x] 5.6 Implement conditional commit logic: if `catalog/` changed → commit with bot identity; if no changes → skip commit
  - [x] 5.7 Implement alert mechanism: on build failure → emit a non-zero exit so CI reports failure (platform-native alerts handle notification)
  - [x] 5.8 Write unit tests: scaffold file generation produces expected directory structure and file list
  - [x] 5.9 Write integration test: run build+validate sequence against fixture registry in a CI-like harness (scripts only, not actual CI)
  - [x] 5.10 Write edge-case tests: no changes → no commit; validation error → job fails; scaffold into existing directory (no overwrite without --force)
  - [x] 5.11 Verify Acceptance Criterion: scaffold generates complete meta-repo layout
  - [x] 5.12 Verify Acceptance Criterion: CI job runs build → validate → conditional commit
  - [x] 5.13 Verify Acceptance Criterion: both GitHub and Bitbucket pipeline files present and linted
  - [x] 5.14 Verify Acceptance Criterion: build failure raises alert (non-zero exit)
  - [x] 5.15 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

### Phase 3 — Context

- [x] 6.0 Implement Story S-015 - https://github.com/llipe/dev-tasks/issues/48: dt ctx fetch — sparse clone and SHA cache

  > Sparse-clone only `component.json`, `docs/`, and `contracts/` and cache by SHA. Fast, immutable, never pulls whole repos.

  - [x] 6.1 Implement `core/context/fetch.ts` — sparse-clone git sequence via `execa`: `git clone --filter=blob:none --no-checkout --depth 1 <url> <tmp>` → `git -C <tmp> sparse-checkout set docs contracts component.json` → `git -C <tmp> checkout <sha>`
  - [x] 6.2 Implement `core/context/cache.ts` — SHA-keyed cache directory structure: `~/.dev-tasks/cache/<host>/<org>/<repo>/<sha>/`; treat as immutable once written
  - [x] 6.3 Implement cache hit logic: if `<sha>/` dir exists and is complete → return cached path without git operations
  - [x] 6.4 Implement `--refresh` flag: bypass cache hit, re-fetch even if SHA dir exists
  - [x] 6.5 Implement LRU GC: evict entries by last-access time when total cache exceeds 5 GB or entries exceed 30 days; expose `dt ctx gc [--max-size] [--max-age]`
  - [x] 6.6 Implement concurrency control: fetch up to 8 repos in parallel (configurable `--concurrency`); 60s timeout per repo
  - [x] 6.7 Implement failure handling: timeout or unreachable repo → exit 5 with per-repo error details
  - [x] 6.8 Wire `dt ctx fetch --repos <ids> --meta-repo <path> [--refresh] [--concurrency 8] [--json]` CLI command; `--json` reports cache hits/misses per repo
  - [x] 6.9 Write unit tests: cache path derivation; LRU eviction logic (size-based, age-based); timeout handling mock
  - [x] 6.10 Write integration tests: fetch a local fixture repo (bare git); cache hit on re-fetch (no git calls second time); `--refresh` bypass
  - [x] 6.11 Write edge-case tests: unreachable repo → exit 5; partial clone interrupted (cleanup); cache over budget → GC evicts oldest; SHA not found in remote
  - [x] 6.12 Verify Acceptance Criterion: fetch uses filter+sparse-checkout+depth 1 + pinned SHA
  - [x] 6.13 Verify Acceptance Criterion: cache at ~/.dev-tasks/cache/<host>/<org>/<repo>/<sha>/ is immutable
  - [x] 6.14 Verify Acceptance Criterion: GC evicts by LRU over 5 GB or 30 days
  - [x] 6.15 Verify Acceptance Criterion: concurrency 8, 60s timeout, failure → exit 5
  - [x] 6.16 Verify Acceptance Criterion: --refresh re-fetches; --json reports hits/misses
  - [x] 6.17 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [x] 7.0 Implement Story S-016 - https://github.com/llipe/dev-tasks/issues/49: dt ctx assemble — layered, budgeted, deterministic bundle

  > Build a fixed-order, budget-capped context bundle with recorded truncation. Deterministic and reproducible.

  - [x] 7.1 Implement `core/context/tokens.ts` — token counting utility: estimate token count from text (cl100k_base approximation or tiktoken if available); expose `countTokens(text): number`
  - [x] 7.2 Define layer model: layer id, priority (numeric, lower = higher priority), truncable (boolean), per-layer token cap, render function
  - [x] 7.3 Implement `core/context/layers/` — per-layer renderers in fixed order per spec §6.3:
    - [x] 7.3.1 `00-index.md` — catalog index summary (non-truncable)
    - [x] 7.3.2 `01-flow.md` — flow definition for the scope (non-truncable if in scope)
    - [x] 7.3.3 `02-conventions-delta.md` — conventions relevant to scope (non-truncable)
    - [x] 7.3.4 `03-architecture.md` — architecture doc (truncable)
    - [x] 7.3.5 `04-primary-*.md` — primary component docs (full; truncable in reverse priority)
    - [x] 7.3.6 `05-secondary-*.md` — secondary component summaries only (truncable)
    - [x] 7.3.7 `06-contracts.md` — boundary contracts with visible confidence (truncable)
  - [x] 7.4 Implement budget enforcement: total default ≤60k tokens; truncation in reverse priority order; record each truncation in `bundle.truncated[]` with layer id, original tokens, truncated-to tokens
  - [x] 7.5 Implement non-truncable guard: if non-truncable layers alone exceed budget → exit 6 with clear message
  - [x] 7.6 Implement deterministic output: fixed file order, no in-file timestamps, emit SHA-256 per file in the bundle manifest
  - [x] 7.7 Implement secondary component rendering: summary only (id, description, provides/consumes list, no full docs)
  - [x] 7.8 Implement boundary contract rendering: include confidence badge (high/medium/low) visibly in the rendered output
  - [x] 7.9 Wire `dt ctx assemble --scope <scope.json> --out <dir> [--budget 60000] [--json]` CLI command
  - [x] 7.10 Write unit tests: per-layer token cap enforcement; truncation order (reverse priority); determinism (repeated assemble → identical SHA-256 per file); non-truncable guard
  - [x] 7.11 Write integration tests: assemble from a scope + fixtures → expected file set + `truncated[]`; verify SHA-256 reproducibility on re-run
  - [x] 7.12 Write edge-case tests: oversized architecture doc → truncation recorded; minimum doesn't fit (non-truncable exceeds budget) → exit 6; empty secondary list; single primary with huge docs
  - [x] 7.13 Verify Acceptance Criterion: layers written in fixed order and priority per spec §6.3; secondary = summary only
  - [x] 7.14 Verify Acceptance Criterion: total ≤60k tokens; truncation in reverse priority; recorded in bundle.truncated[]
  - [x] 7.15 Verify Acceptance Criterion: non-truncable layers never cut; exit 6 if minimum doesn't fit
  - [x] 7.16 Verify Acceptance Criterion: bundle is deterministic — fixed order, no timestamps, SHA-256 per file
  - [x] 7.17 Verify Acceptance Criterion: boundary contracts render with visible confidence
  - [x] 7.18 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [x] 8.0 Implement Story S-017 - https://github.com/llipe/dev-tasks/issues/51: dt init --components — manual scope, pin, freshness, session lock

  > Pin meta-repo, check freshness, assemble bundle, emit session.lock.json. Deterministic init path (no LLM).

  - [x] 8.1 Implement meta-repo pin resolution in `core/context/init.ts`: resolve meta-repo path to a git SHA; pin for the session
  - [x] 8.2 Implement sparse fetch of meta-repo content: `*.md`, `catalog/`, `schemas/`, `adr/` via the fetch module (S-015)
  - [x] 8.3 Implement index freshness check: read `generated_at` from `catalog/index.yaml`; compare to `--max-index-age` (default 240 minutes); exit 9 if stale
  - [x] 8.4 Implement manual scope path: `--components a,b,c` sets scope directly (no LLM); validate each id exists in the index; unknown → exit 12
  - [x] 8.5 Implement `--no-llm` guard: `--no-llm` without `--components` → exit 2 (must provide explicit scope)
  - [x] 8.6 Orchestrate: pin → freshness check → resolve components → fetch per-component repos → assemble bundle (S-016) → emit session lock
  - [x] 8.7 Implement `core/context/session-lock.ts` — `session.lock.json` structure: `task_hash` (SHA-256 of task text or component list), `meta_repo_sha`, `index_age_minutes`, `scope` (component ids + source: "manual"), per-repo SHAs, `bundle` (file paths + per-file SHA-256 + token count)
  - [x] 8.8 Implement reproducibility guarantee: same lock inputs → same bundle output (verified by SHA comparison)
  - [x] 8.9 Wire `dt init --components <ids> [--meta-repo <path>] [--max-index-age 240] [--no-llm] [--out <dir>] [--json]` CLI command
  - [x] 8.10 Write unit tests: pin resolution; freshness check logic (stale/fresh boundary); session-lock assembly; unknown component detection
  - [x] 8.11 Write integration tests: end-to-end `init --components` over local fixture repos → lock + bundle emitted; re-run with same inputs → byte-for-byte identical bundle (SHA match)
  - [x] 8.12 Write edge-case tests: stale index → exit 9; unknown component → exit 12; `--no-llm` without components → exit 2; meta-repo path not a git repo → clear error
  - [x] 8.13 Verify Acceptance Criterion: init resolves meta-repo to SHA and pins for session
  - [x] 8.14 Verify Acceptance Criterion: exit 9 if index exceeds --max-index-age
  - [x] 8.15 Verify Acceptance Criterion: --components sets scope directly; --no-llm without components → exit 2
  - [x] 8.16 Verify Acceptance Criterion: unknown component → exit 12
  - [x] 8.17 Verify Acceptance Criterion: session.lock.json emitted with task_hash, meta_repo_sha, index_age, scope, per-repo SHAs, bundle hashes/tokens; same lock reproduces same bundle
  - [x] 8.18 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`
