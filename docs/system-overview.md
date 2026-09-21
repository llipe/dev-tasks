# System Overview: dev-tasks

Current-state description of what this repository builds, how it is structured, and how its parts interact.

Sources: `package.json`, `bin/`, `core/`, `.github/`, `.claude/`, `.kiro/`, `scripts/`, `.github/workflows/`, `bundle-manifest.json`, `docs/requirements/`.

## Purpose

`dev-tasks` ships an AI agent workflow harness: versioned Markdown agents, skills, instructions/steering, prompts, and git hooks installed into a consumer repository so AI coding agents run a PRD-driven workflow with explicit roles, gates, and human authority boundaries. One Node binary (`dev-tasks`) bootstraps and maintains that harness — installing, updating, pinning, and reconciling the managed files across platform profiles.

The repository is not a hosted service and does not replace a consumer project's application stack, test runner, or CI provider.

`dev-tasks` previously also shipped a multi-repo context CLI (`dt`): extraction, catalog aggregation, context assembly, and contract verification across service boundaries. That layer was unused and was retired in full (ADR-007); its restore path is the last release tag that shipped it.

## High-Level Architecture

```text
┌──────────────────────── dev-tasks repository ─────────────────┐
│                                                                │
│  Harness content (Markdown/JSON, per platform)                 │
│    .github/{agents,skills,instructions,prompts}   → Copilot    │
│    .claude/{agents,skills,commands,hooks}         → Claude Code│
│    .kiro/{agents,skills,steering,hooks}           → Kiro       │
│                                                                │
│  CLI toolkit (TypeScript, Node >= 24, ESM)                     │
│    bin/dev-tasks.ts ─► bin/parse-args.ts                       │
│                    └─► core/distribution/* ─► core/reconcile.ts│
└──────────────────────┴─────────────────────────────────────────┘
             │
             ▼ install / update / status / pin / doctor / migrate
   ┌──────────────────┐
   │ consumer repo    │
   │ .dev-tasks/      │
   │ platform trees   │
   └──────────────────┘
```

Layering is one-directional: `bin/` → `core/`.

## Core Components

### Binary

| Binary      | Entry point        | Responsibility                                                                             | Stability |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------ | --------- |
| `dev-tasks` | `bin/dev-tasks.ts` | Bootstrap/distribution: `install`, `update`, `status`, `pin`, `unpin`, `doctor`, `migrate` | Stable    |

`bin/parse-args.ts` is the argument parser, and `core/exit-codes.ts` is the exit-code contract; both are dedicated to this one binary.

### `core/` modules

| Module               | Responsibility                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/distribution`  | Install, update with conflict detection, status, pin/unpin, doctor, legacy migration, backup, SHA-256 hashing, install manifest, profile→path mapping, pinned-version fetch from the npm registry |
| `core/reconcile.ts`  | Generic three-way hash reconciliation (local / origin / package) that decides install, skip, overwrite, or conflict for a single managed file. Used by `core/distribution/update.ts`.             |
| `core/exit-codes.ts` | Process exit-code contract for the `dev-tasks` binary                                                                                                                                             |

### Harness content

Eleven agents (`product-engineer`, `developer`, `planner`, `researcher`, `verifier`, `qa-engineer`, `ux-engineer`, `technical-writer`, `housekeeping`, `github-ops`, `infra-engineer`), twenty-six skills, and three scoped instruction/steering rules plus one always-loaded Kiro steering notice. Behavior is kept aligned across the three platform trees; file formats differ because platform schemas differ. See `AGENTS.md` for the authoritative registry and `docs/workflow-chains.md` for sequencing. The `infra-engineer` deploy surface is carried by the `deploy-ops` skill plus the `templates/scripts/` and `templates/workflows/` templates (the GitHub Actions `deploy-dev`, `deploy-prod`, and `rollback` workflows).

## Integrations

| Integration  | Used for                                                                  | Status                                               |
| ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Git          | Prerequisite check only: `dev-tasks doctor` requires git >= 2.37          | Active                                               |
| npm registry | Package distribution and pinned-version fetch during `dev-tasks update`   | Active (`@llipe.com/dev-tasks`)                      |
| GitHub       | Issues/PRs as execution state, Releases for bundle assets, Actions for CI | Active                                               |
| `memo-cli`   | Cross-session architectural memory for agents                             | Optional; skipped silently when absent               |
| MCP servers  | Consumer-owned agent tool extensions                                      | Consumer-configured; not provided by this repository |

## Key Runtime Flows

### 1. Harness install and update

`dev-tasks install --profile <copilot|claude|kiro|both|all>` copies the managed platform trees into the consumer repo and writes `.dev-tasks/manifest.json` with both the current and as-shipped SHA-256 per file. `dev-tasks update` re-hashes each managed file and compares three values — local, origin, and package — to classify a file as up to date, updatable, or conflicted (`core/reconcile.ts`). Conflicts are reported and skipped unless `--force`, which backs up first and exits `14` (`ReconciliationConflict`) when conflicts occurred.

### 2. Agent development workflow

Refine → spec → stories → plan → verifier design → test-first implementation → quality gates → qa-engineer coverage gate → verifier fidelity audit → documentation → human-approved PR. Agents never merge into `main`. See `docs/workflow-chains.md`.

## Distribution Channels

Two channels are active in parallel:

| Channel                | Produced by                                                          | Managed-path source of truth    |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------- |
| npm package            | `pnpm publish` via `.github/workflows/publish-npm.yml`               | `core/distribution/profiles.ts` |
| GitHub Release tarball | `scripts/build-bundle.sh` via `.github/workflows/release-bundle.yml` | `bundle-manifest.json`          |

`dev-tasks.sh` at the repository root is a deprecated notice shim that only prints migration instructions to the npm package.

## Non-Functional Posture

- **Explicit failure** — a distinct exit code per failure class (see `core/exit-codes.ts`); missing capabilities produce blocked or incomplete states rather than optimistic success.
- **Least privilege and consumer ownership** — credentials, MCP configuration, and project requirements remain consumer-owned; `dev-tasks update` never silently overwrites a locally modified managed file.
- **Human authority** — merges to the default branch require explicit human approval; no agent self-merges.
- **Quality gates** — `pnpm validate` runs `typecheck`, `lint`, `format:check`, and `test`; `pnpm audit --prod` covers dependency posture.

## Known Constraints in the Current Implementation

- The managed-path surface is defined twice — `core/distribution/profiles.ts` (npm) and `bundle-manifest.json` (tarball) — with no automated conformance check between them. `bundle-manifest.json` still lists `.agents/skills` and a top-level `skills-lock.json`, neither of which exists in the repository.
- Two committed release tarballs remain tracked under `dist/` (`v0.1.8-test`, `v0.2.1`) although `dist/` is git-ignored. Encountered repeatedly during the dt retirement (ADR-007): a clean `dist/` rebuild silently deletes them from the working tree, and they must be restored before committing.

Platform differences that are intentional, not drift:

- `.claude/agents/` holds eight agents; `planner`, `product-engineer`, and `infra-engineer` run as main-thread `.claude/commands/` entry points because a subagent cannot pause for a user-approval gate (per-phase for the orchestrators, per-step for `infra-engineer`).
- `plan` and `implement` are scoped instructions on Copilot, scoped steering on Kiro, and on-demand skills on Claude Code, which has no scoped-instruction mechanism.

## Related Documents

- `docs/dev-tasks-user-manual.md` — `dev-tasks` command reference
- `docs/tech.md` — enforceable engineering rules
- `docs/product.md` — product constitution
- `docs/adr/` — architecture decision records, including ADR-007 (dt retirement)

## Testing Standard Artifact

`/TESTING.md` is the canonical testing contract, shipped as a placeholder and listed in `consumer_owned_paths` so `dev-tasks update` never overwrites a filled version. It is distributed by both install paths: `MANAGED_FILES` in `scripts/build-bundle.sh` for the shell bundle, and `ROOT_FILES` in `core/distribution/profiles.ts` for `dev-tasks install`.

`/DESIGN.md` is the canonical visual and technical design contract, shipped identically to `TESTING.md` — placeholder status, `consumer_owned_paths`, and distributed via both `MANAGED_FILES` and `ROOT_FILES`. `ux-engineer` owns the contract and fills it via an interview-driven procedure that requires explicit human confirmation; `developer` keeps it current when the visual contract changes. An unfilled placeholder means "no standard established" and blocks mockup generation and theme-artifact output.

Root files belong to no platform. They are installed once per run regardless of how many platforms a profile resolves to, and recorded in the install manifest under the `root` profile tag — a dedicated tag is required because manifest merging replaces entries whose profile is in the installed set, so a platform tag would drop the file on one profile and duplicate it on another.

`qa-engineer` owns `/TESTING.md`; `ux-engineer` owns `/DESIGN.md`. `developer` keeps both current. An unfilled placeholder means "no standard established" and **MUST NOT** be read as permission.
