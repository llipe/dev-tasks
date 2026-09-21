# CLAUDE.md

Project memory for Claude Code. This file is always loaded. It defines the cross-cutting rules every agent in this repository **MUST** follow, and points to the dev-tasks workflow (subagents, skills, and commands under `.claude/`).

> The canonical project/agent registry lives in `AGENTS.md` and is imported below. `/DESIGN.md` is the canonical UI/design contract.

@AGENTS.md

---

## General Agent Guidelines (Always Enforced)

All work in this repository **MUST**:

- Always create feature branches — never commit directly to the default branch (`main`).
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`).
- Open PRs for review — **never self-merge into `main`**. PRs targeting `main` require **user** approval and the **user** merges them. No agent may merge into `main`.
- Follow testing, linting, and documentation standards from `docs/tech.md`.
- Prefer `pnpm` over `npm` for JavaScript/TypeScript workflows (fallback to `npm` only when `pnpm` is unavailable or explicitly disallowed).
- Use canonical `package.json` script names for JS/TS projects: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `audit`, `validate`.
- Before developer/planner completion, enforce and record quality gates: `test`, `lint`, `format:check`, `typecheck`, `audit`.
- `qa-engineer` runs at the completion gate, before the `verifier` audit, and records `coverage_gate: PASS | FAIL | SKIPPED(<reason>)`. Skipping requires a non-empty reason; omitting the field is treated as incomplete.
- `/TESTING.md` is the canonical testing contract — owned by `qa-engineer`, kept current by `developer`, and treated as "no standard established" while unfilled.
- Reference GitHub Issues in branch names and commits; follow the `github-ops` conventions for all GitHub artifacts (issues, PRs, branches, labels, milestones, comments).
- Treat `/DESIGN.md` as the source of truth for visual tokens, components, and design guidance; update it whenever UI contracts change.
- Maintain document changelogs when updating generated artifacts (PRDs, specs, stories, refinements).
- Produce English-only output for docs, comments, and generated content.
- The `verifier` audit (`audit` mode) is a mandatory, non-skippable step triggered automatically by `developer` (per issue, pre-PR-ready) and `planner` (per story and PRD-level rollup). Drift findings are non-blocking to PR/issue completion and route to `product-engineer`'s `activity-drift-reconciliation` skill for write-back into task lists, GitHub issues, or PRD/spec changelogs.
- **Test-first design is the default:** `product-engineer` recommends `verifier` Design Mode after planning to produce a compliance test plan; `developer` writes tests before implementation code for each behavioral sub-task; `planner` checks for test plans and enforces test-first in developer handoffs.
- **Foundation documents: resolve the new name, fall back to the old one.** The canonical names are `docs/product.md` and `docs/tech.md`. A repository installed before the rename still carries `docs/product-context.md` and `docs/technical-guidelines.md`, and `dev-tasks update` never renames a consumer-owned file on its own. When **reading** a foundation document, resolve the new name first and fall back to the old one only when the new name is absent; when **writing**, always write the new name, and propose `dev-tasks migrate docs`. This binds every agent and skill that reads these documents, for one release cycle (FR-45). Stating it here rather than repeating it in all 32 prompt files that name these documents is deliberate: this file is always loaded, and 32 copies would drift.
- **Documentation ownership is explicit.** `technical-writer` owns documentation structure and content — `/docs`, its indexes, and `docs/runbooks/`. `housekeeping` does **not** organize documentation, and a docs-structure failure in `validate` (from `core/checks/docs-structure.ts`) routes to `technical-writer` (FR-51).
- **A runbook ships in the same PR as the procedure it documents.** Any new or materially changed script under `templates/scripts/`, workflow under `templates/workflows/` or `.github/workflows/`, or `infra-engineer` change kind **MUST** arrive with a runbook in the same draft PR, not a follow-up issue (FR-49a). Updating an existing runbook satisfies this. The `verifier` reports a runbook-coverage finding when it does not; that finding is advisory and never blocks PR readiness.
- **A blocked guard is a decision, not an obstacle.** When a hook (e.g. `git-guard.sh`) blocks a tool call, the agent **MUST** surface the block verbatim and stop that line of work. It **MUST NOT** attempt an alternative command, tool surface, or sequence that achieves the same effect the block just prevented — that includes retrying the same operation via a different CLI flag, a different tool (e.g. an MCP tool instead of `Bash`, or vice versa), or a workaround that produces the same end state through a different mechanism. A legitimate alternate mechanism used for an unrelated, non-triggering purpose (e.g. the `Read` tool instead of `grep`, or the `Write` tool instead of a shell heredoc) is not a route-around and remains allowed. If blocked, report the block message to the user and ask how to proceed.

These mirror the General Agent Guidelines in `AGENTS.md`. The "no merge to `main`" and Conventional Commits rules are additionally enforced deterministically by hooks in `.claude/settings.json`.

## GitHub Operations

GitHub operations run through the **`gh` CLI** (over Bash). The `github-ops` subagent owns all conventions. A GitHub MCP server is optional; if one is configured, agents may use it instead, but no MCP server is required.

## memo-cli (Optional)

If `memo-cli` is installed and `memo setup validate` passes: `product-engineer` reads context at session start; `developer` writes intent/outcome entries per story; `technical-writer` writes one entry per ADR and significant doc change. If installed but not configured, ask the user to run `memo setup init` first. If not installed, skip silently. See the `memo-cli-usage` skill.

---

## How to Run the Workflow

This toolkit is exposed as **commands** (entry points you invoke with `/`), **subagents** (isolated workers Claude delegates to), and **skills** (on-demand procedures, auto-loaded when relevant or invoked by name).

### Commands (entry points)

| Command             | Purpose                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/product-engineer` | **Orchestrator (main thread).** Init / Feature / Issue mode: refine → spec → stories → publish → plan. Hands off to `/developer` or `/planner`.                                                 |
| `/planner`          | **Orchestrator (main thread).** Multi-story execution with dependency ordering, per-story delegation to the `developer` subagent, checkpoint/resume (auto-detected), and one consolidated PR.   |
| `/developer`        | **Interactive (main thread).** Step-gated implementation of a task list, pausing for approval after each sub-task.                                                                              |
| `/github-ops`       | Audit/standardize GitHub artifacts.                                                                                                                                                             |
| `/technical-writer` | Sync `/docs` with the codebase. Owns docs structure and content, including `docs/runbooks/`.                                                                                                    |
| `/housekeeping`     | Fix lint/type/test-wiring issues. Does not organize documentation.                                                                                                                              |
| `/qa-engineer`      | Establish `/TESTING.md`, author missing Layer 1-2 tests, and report `coverage_gate` plus risk-ranked gaps.                                                                                      |
| `/researcher`       | Bounded codebase investigation producing a structured research artifact at `/workstream/research-*.md`.                                                                                         |
| `/infra-engineer`   | **Interactive (main thread).** Plan and apply infrastructure changes one approved, reversible, recorded step at a time (AWS, fly.io, Supabase, Cloudflare); hands off a draft PR. Never merges. |
| `/ux-engineer`      | PRD/SPEC → React mockups + refinement handoff.                                                                                                                                                  |
| `/verifier-design`  | Generate a compliance test plan + traceability matrix from a spec/story (Design Mode).                                                                                                          |
| `/verifier-audit`   | Grey-box fidelity audit of delivered work against requirements and PRD/spec intent (Audit Mode).                                                                                                |

### Subagents (`.claude/agents/`)

`developer`, `github-ops`, `technical-writer`, `housekeeping`, `ux-engineer`, `verifier`, `qa-engineer`, `researcher` — isolated, scoped-tool workers. Claude delegates to these automatically when a task matches their description, and the orchestrator commands (`/planner`, `/product-engineer`) drive them via the Task tool.

### Orchestration model (important)

Claude Code subagents **cannot spawn other subagents** — the hierarchy is flat (main session → workers). dev-tasks is delegation-heavy, so:

- **Orchestrators run in the main thread as commands** (`/product-engineer`, `/planner`), not as subagents, so they can delegate to leaf subagents _and_ pause for the required user-approval gates. `/infra-engineer` runs in the main thread for the same reason — it pauses for one human approval per infrastructure step.
- **Step-gated approval requires the main thread.** A subagent runs to completion and only returns a summary; it cannot pause mid-run for a "yes". Use `/developer` (main thread) for interactive step-gated work; the `developer` _subagent_ is for `/planner`'s autonomous per-story delegation, which gates at the **story** boundary, not per sub-task.

### Skills (`.claude/skills/`)

Activity skills: `activity-init`, `activity-refine`, `activity-codebase-research`, `activity-generate-spec`, `activity-generate-stories`, `activity-publish-github`, `activity-e2e-test-design`, `activity-e2e-test-implementation`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics`, `activity-test-standards`, `activity-test-implementation`, `activity-integration-test-implementation`, `activity-coverage-gap-analysis`, `activity-drift-reconciliation` (routes `verifier` drift findings into task-list/checklist expansion, new issues, or human-confirmed PRD/spec changelog updates — used by `product-engineer`). Process skills: `plan`, `implement` (the single source of truth for task-list execution rules, including the mandatory `verifier` audit gate). Operational: `git-ops`, `aws-ops`, `fly-ops`, `supabase-ops`, `deploy-ops`, `ux-scaffold`, `ux-theme-gen`, `memo-cli-usage`.

`plan` and `implement` are scoped instructions on Copilot (`applyTo`) and scoped steering on Kiro (`fileMatchPattern`); as Claude skills they load on demand instead of consuming context on every matching turn.

---

## Domain-Specific Conventions

Copilot's `applyTo`-scoped instructions have no direct Claude Code equivalent (there is no glob-scoped auto-load), and there is no automatic Claude delivery mechanism that scaffolds a nested `CLAUDE.md` for the Next.js/React conventions (scoped to `**/*.tsx`) — no code in this repository creates one. Consumers who want those conventions to load only while working inside a React app's subtree **MUST** do it manually: copying the conventions into their app's nested `CLAUDE.md`. When generating UI, follow those conventions (wherever placed) and `/DESIGN.md`.

---

## File Organization

| Directory             | Contents                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `/docs/`              | Foundation docs — product.md, tech.md, ADRs                           |
| `/docs/requirements/` | PRDs                                                                  |
| `/workstream/`        | Active feature work — specs, stories, task lists, planner state files |
| `.claude/agents/`     | Subagent definitions                                                  |
| `.claude/skills/`     | On-demand skills                                                      |
| `.claude/commands/`   | Command entry points                                                  |
| `/mockups/`           | UX mockups                                                            |
