# System Overview: dev-tasks

Current-state description of what this repository builds, how it is structured, and how its parts interact.

Sources: `package.json`, `bin/`, `core/`, `adapters/`, `schemas/`, `.github/`, `.claude/`, `.kiro/`, `scripts/`, `.github/workflows/`, `bundle-manifest.json`, `workstream/specification-multi-repo-context.md`, `docs/requirements/`.

## Purpose

`dev-tasks` ships two coupled deliverables from one repository:

1. **An AI agent workflow harness** — versioned Markdown agents, skills, instructions/steering, prompts, and git hooks installed into a consumer repository so AI coding agents run a PRD-driven workflow with explicit roles, gates, and human authority boundaries.
2. **A CLI toolkit** — two Node binaries that install/update the harness and build multi-repo semantic context for agents working across service boundaries.

The repository is not a hosted service and does not replace a consumer project's application stack, test runner, or CI provider.

## High-Level Architecture

```text
┌──────────────────────── dev-tasks repository ────────────────────────┐
│                                                                      │
│  Harness content (Markdown/JSON, per platform)                       │
│    .github/{agents,skills,instructions,prompts}   → Copilot          │
│    .claude/{agents,skills,commands,hooks}         → Claude Code      │
│    .kiro/{agents,skills,steering,hooks}           → Kiro             │
│                                                                      │
│  CLI toolkit (TypeScript, Node >= 20, ESM)                           │
│    bin/dev-tasks.ts ─┐                                               │
│    bin/dt.ts ────────┼─► adapters/cli/* ─► core/* ─► schemas/*.json  │
│                      │   (argv parsing,     (business logic,          │
│                      │    stdout/JSON)       filesystem, git)         │
└──────────────────────┴───────────────────────────────────────────────┘
             │                              │
             ▼ install/update               ▼ extract / catalog / ctx / scope / verify
   ┌──────────────────┐          ┌────────────────────┐     ┌──────────────────┐
   │ consumer repo    │          │ component repos    │────►│ meta-repo        │
   │ .dev-tasks/      │          │ component.json     │     │ registry.yaml    │
   │ platform trees   │          │ contracts/, docs/  │     │ catalog/ (built) │
   └──────────────────┘          └────────────────────┘     └──────────────────┘
```

Layering is one-directional: `bin/` → `adapters/` → `core/`. `core/` must not import from `adapters/` or `bin/`. This is enforced by `test/unit/dependency-direction.test.ts`.

## Core Components

### Binaries

| Binary      | Entry point        | Responsibility                                                                                   | Stability          |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------ | ------------------ |
| `dev-tasks` | `bin/dev-tasks.ts` | Bootstrap/distribution: `install`, `update`, `status`, `pin`, `unpin`, `doctor`, `migrate`       | Stable             |
| `dt`        | `bin/dt.ts`        | Multi-repo context: `extract`, `catalog`, `ctx`, `scope`, `init`, `verify`, `validate-component` | Unstable (testing) |

Both binaries share `adapters/cli/parse-args.ts` and the exit-code contract in `core/exit-codes.ts`.

### `core/` modules

| Module               | Responsibility                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/distribution`  | Install, update with conflict detection, status, pin/unpin, doctor, legacy migration, backup, SHA-256 hashing, install manifest, profile→path mapping                           |
| `core/extract`       | Stack detection; OpenAPI, AsyncAPI and database-schema extraction; ORM readers (Prisma, Drizzle, TypeORM, `information_schema`); `component.json` derivation; extraction report |
| `core/catalog`       | Registry aggregation and index build, validation checks `V01`–`V19`, component resolution, graph queries, coverage tally, meta-repo scaffold, offline manifest validation       |
| `core/context`       | Session init, sparse-clone fetch, SHA-keyed cache with LRU GC, layered budgeted bundle assembly, token accounting, session lock                                                 |
| `core/scope`         | LLM-assisted scoping, graph-closure expansion, gate rules `G1`–`G7`, cross-repo partition proposal, precision/recall calibration                                                |
| `core/verify`        | OpenAPI/AsyncAPI contract diffing and breaking-change detection, consumer impact analysis, docs/code drift heuristic                                                            |
| `core/reconcile`     | Field-level reconciliation between generated and hand-edited manifest fields, using provenance hashes                                                                           |
| `core/providers`     | Interface stubs for external providers (tracker emission). Interface only — no live implementation                                                                              |
| `core/exit-codes.ts` | Process exit-code contract shared by all binaries                                                                                                                               |

### `adapters/`

- `adapters/cli/` — one handler module per command/subcommand; wraps `core/`, formats human and `--json` output, returns an exit code.
- `adapters/mcp/` — placeholder. `adapters/mcp/index.ts` is an empty barrel export; no MCP server is implemented in this repository.

### `schemas/`

JSON Schema 2020-12 documents validated with `ajv`: `component.schema.json`, `flow.schema.json`, `scope-output.schema.json`. Shipped in the npm package and consumed by `dt validate-component`, `dt catalog validate`, and LLM scope-output validation.

### Harness content

Eight agents (`product-engineer`, `developer`, `planner`, `verifier`, `ux-engineer`, `technical-writer`, `housekeeping`, `github-ops`), thirteen skills, and three scoped instruction/steering rules plus one always-loaded Kiro steering notice. Behavior is kept aligned across the three platform trees; file formats differ because platform schemas differ. See `AGENTS.md` for the authoritative registry and `docs/workflow-chains.md` for sequencing.

## Integrations

| Integration      | Used for                                                                  | Status                                                                                                |
| ---------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Git              | Sparse clone and SHA pinning of component repos (`dt ctx fetch`)          | Active; `dev-tasks doctor` requires git >= 2.37 (the legacy tarball manifest declares 2.20)           |
| npm registry     | Package distribution and pinned-version fetch during `dev-tasks update`   | Active (`@llipe.com/dev-tasks`)                                                                       |
| GitHub           | Issues/PRs as execution state, Releases for bundle assets, Actions for CI | Active                                                                                                |
| LLM provider     | `dt scope` component scoping, optional description enrichment             | Interface only — `dt scope` exits with a configuration error until `DT_LLM_PROVIDER` support is wired |
| Tracker provider | Emitting derived tasks from `dt verify impact --emit-tasks`               | Interface stub with no-op fallback                                                                    |
| `memo-cli`       | Cross-session architectural memory for agents                             | Optional; skipped silently when absent                                                                |
| MCP servers      | Consumer-owned agent tool extensions                                      | Consumer-configured; not provided by this repository                                                  |

## Key Runtime Flows

### 1. Harness install and update

`dev-tasks install --profile <copilot|claude|kiro|both|all>` copies the managed platform trees into the consumer repo and writes `.dev-tasks/manifest.json` with both the current and as-shipped SHA-256 per file. `dev-tasks update` re-hashes each managed file and compares three values — local, origin, and package — to classify a file as up to date, updatable, or conflicted. Conflicts are reported and skipped unless `--force`, which backs up first and exits `14` (`ReconciliationConflict`) when conflicts occurred.

### 2. Component extraction

`dt extract all` runs the pipeline: `detect` (stack/framework signals) → `schema` (ORM AST or database introspection) → `openapi` → `asyncapi` → `component` (derive `component.json`) → `extraction_report.json`. Step 6 is a human gate for the non-derivable fields `owner`, `domain`, `criticality`, and `aliases` confirmation. Re-running will not silently overwrite a locally edited field: `core/reconcile` detects the hash mismatch and exits `14` unless `--force`.

### 3. Catalog build and validation

`dt catalog build --registry <path>` reads the meta-repo `registry.yaml`, fetches each repo's `component.json`, mirrors it into `catalog/components/`, and generates the deterministic `catalog/index.yaml` including the inverted consumer index. A single repo failure is recorded in `index.errors[]` and exits `3` (`PartialCatalogBuild`). `dt catalog validate` runs checks `V01`–`V19`; errors exit `4`, warnings do not, and `--strict` promotes cycle warnings to errors.

### 4. Context session initialization

`dt init` produces a reproducible context bundle. With `--components` the scope is deterministic; with `--task` it runs LLM scoping → closure expansion → gate rules → fetch → assemble. Abort gates `G1`–`G4` exit `7` (`GateAborted`); review gates `G5`–`G7` continue and record `review_flags`. The bundle is emitted as ordered layer files (`00-index`, `01-flow`, `02-conventions-delta`, `03-architecture`, `04-primary-<id>`, `05-secondary-<id>`, `06-contracts`) under a token budget, truncating truncable layers in reverse priority. `session.lock.json` pins the meta-repo SHA, per-repo SHAs, and per-file hashes so the same lock reproduces the same bundle.

### 5. Contract verification

`dt verify contract-diff --base --head` classifies OpenAPI/AsyncAPI changes and exits `8` (`BreakingChange`) on a breaking diff. `dt verify impact --contract <id>` lists affected consumers from the catalog's inverted index and can emit derived tasks. `dt verify drift` computes a docs/code drift heuristic per component.

### 6. Agent development workflow

Refine → spec → stories → plan → verifier design → test-first implementation → quality gates → verifier fidelity audit → documentation → human-approved PR. Agents never merge into `main`. See `docs/workflow-chains.md`.

## Distribution Channels

Two channels are active in parallel:

| Channel                | Produced by                                                          | Managed-path source of truth    |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------- |
| npm package            | `pnpm publish` via `.github/workflows/publish-npm.yml`               | `core/distribution/profiles.ts` |
| GitHub Release tarball | `scripts/build-bundle.sh` via `.github/workflows/release-bundle.yml` | `bundle-manifest.json`          |

`dev-tasks.sh` at the repository root is a deprecated notice shim that only prints migration instructions to the npm package.

## Non-Functional Posture

- **Determinism** — catalog index and context bundles are byte-stable for the same inputs; sorted keys and stable ordering are asserted in tests.
- **Reproducibility** — sessions are pinned by `session.lock.json`; scope randomness is avoided by recording SHAs and hashes rather than timestamps in comparable positions.
- **Explicit failure** — a distinct exit code per failure class (see `core/exit-codes.ts`); missing capabilities produce blocked or incomplete states rather than optimistic success.
- **Offline capability** — `dt validate-component` requires no network access.
- **Least privilege and consumer ownership** — credentials, MCP configuration, and project requirements remain consumer-owned; `dev-tasks update` never silently overwrites a locally modified managed file.
- **Human authority** — production writes, migration application, meta-repo `architecture-change` PRs, and merges to the default branch require explicit human approval.
- **Quality gates** — `pnpm validate` runs `typecheck`, `lint`, `format:check`, and `test`; `pnpm audit --prod` covers dependency posture.

## Known Constraints in the Current Implementation

- OpenAPI extraction route 2 (isolated framework boot) is interface-only; routes 1 and 3 are functional.
- No LLM provider is wired; `dt scope` without a provider exits with a configuration error.
- Only the Node/TypeScript extraction provider exists (`core/extract/providers/node-ts.ts`).
- Zod extraction handles basic `z.object` patterns; only `kafkajs` messaging patterns are detected.
- `adapters/mcp/` is an empty placeholder.
- The managed-path surface is defined twice — `core/distribution/profiles.ts` (npm) and `bundle-manifest.json` (tarball) — with no automated conformance check between them. `bundle-manifest.json` still lists `.agents/skills` and a top-level `skills-lock.json`, neither of which exists in the repository.
- Two committed release tarballs remain tracked under `dist/` (`v0.1.8-test`, `v0.2.1`) although `dist/` is git-ignored.

Platform differences that are intentional, not drift:

- `.claude/agents/` holds six agents; `planner` and `product-engineer` run as main-thread `.claude/commands/` entry points because a subagent cannot pause for a user-approval gate.
- `plan` and `implement` are scoped instructions on Copilot, scoped steering on Kiro, and on-demand skills on Claude Code, which has no scoped-instruction mechanism.

## Related Documents

- `docs/data-model.md` — artifacts, entities, invariants, and ownership
- `docs/artifact-formats.md` — serialization format and authorship per artifact
- `docs/dt-user-manual.md` — `dt` command reference
- `docs/dev-tasks-user-manual.md` — `dev-tasks` command reference
- `docs/technical-guidelines.md` — enforceable engineering rules
- `docs/product-context.md` — product constitution
- `docs/adr/` — architecture decision records
