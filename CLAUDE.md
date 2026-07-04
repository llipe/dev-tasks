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
- Follow testing, linting, and documentation standards from `docs/technical-guidelines.md`.
- Prefer `pnpm` over `npm` for JavaScript/TypeScript workflows (fallback to `npm` only when `pnpm` is unavailable or explicitly disallowed).
- Use canonical `package.json` script names for JS/TS projects: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `audit`, `validate`.
- Before developer/planner completion, enforce and record quality gates: `test`, `lint`, `format:check`, `typecheck`, `audit`.
- Reference GitHub Issues in branch names and commits; follow the `github-ops` conventions for all GitHub artifacts (issues, PRs, branches, labels, milestones, comments).
- Treat `/DESIGN.md` as the source of truth for visual tokens, components, and design guidance; update it whenever UI contracts change.
- Maintain document changelogs when updating generated artifacts (PRDs, specs, stories, refinements).
- Produce English-only output for docs, comments, and generated content.

These mirror the General Agent Guidelines in `AGENTS.md`. The "no merge to `main`" and Conventional Commits rules are additionally enforced deterministically by hooks in `.claude/settings.json`.

## GitHub Operations

GitHub operations run through the **`gh` CLI** (over Bash). The `github-ops` subagent owns all conventions. A GitHub MCP server is optional; if one is configured, agents may use it instead, but no MCP server is required.

## memo-cli (Optional)

If `memo-cli` is installed and `memo setup validate` passes: `product-engineer` reads context at session start; `developer` writes intent/outcome entries per story; `technical-writer` writes one entry per ADR and significant doc change. If installed but not configured, ask the user to run `memo setup init` first. If not installed, skip silently. See the `memo-cli-usage` skill.

---

## How to Run the Workflow

This toolkit is exposed as **commands** (entry points you invoke with `/`), **subagents** (isolated workers Claude delegates to), and **skills** (on-demand procedures, auto-loaded when relevant or invoked by name).

### Commands (entry points)

| Command                      | Purpose                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/product-engineer`          | **Orchestrator (main thread).** Init / Feature / Issue mode: refine → spec → stories → publish → plan. Hands off to `/developer` or `/planner`.                                               |
| `/planner`                   | **Orchestrator (main thread).** Multi-story execution with dependency ordering, per-story delegation to the `developer` subagent, checkpoint/resume (auto-detected), and one consolidated PR. |
| `/developer`                 | **Interactive (main thread).** Step-gated implementation of a task list, pausing for approval after each sub-task.                                                                            |
| `/github-ops`                | Audit/standardize GitHub artifacts.                                                                                                                                                           |
| `/technical-writer`          | Sync `/docs` with the codebase.                                                                                                                                                               |
| `/housekeeping`              | Fix lint/type/test-wiring issues.                                                                                                                                                             |
| `/ux-engineer`               | PRD/SPEC → React mockups + refinement handoff.                                                                                                                                                |
| `/black-box-tester-design`   | Generate a compliance test plan + traceability matrix from a spec/story.                                                                                                                      |
| `/black-box-tester-validate` | Validate delivered behavior against requirements + test plan.                                                                                                                                 |

### Subagents (`.claude/agents/`)

`developer`, `github-ops`, `technical-writer`, `housekeeping`, `ux-engineer`, `black-box-tester` — isolated, scoped-tool workers. Claude delegates to these automatically when a task matches their description, and the orchestrator commands (`/planner`, `/product-engineer`) drive them via the Task tool.

### Orchestration model (important)

Claude Code subagents **cannot spawn other subagents** — the hierarchy is flat (main session → workers). dev-tasks is delegation-heavy, so:

- **Orchestrators run in the main thread as commands** (`/product-engineer`, `/planner`), not as subagents, so they can delegate to leaf subagents _and_ pause for the required user-approval gates.
- **Step-gated approval requires the main thread.** A subagent runs to completion and only returns a summary; it cannot pause mid-run for a "yes". Use `/developer` (main thread) for interactive step-gated work; the `developer` _subagent_ is for `/planner`'s autonomous per-story delegation, which gates at the **story** boundary, not per sub-task.

### Skills (`.claude/skills/`)

Activity skills: `activity-init`, `activity-refine`, `activity-generate-spec`, `activity-generate-stories`, `activity-publish-github`, `activity-e2e-test-design`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics`. Process skills: `plan`, `implement` (the single source of truth for task-list execution rules). Operational: `git-ops`, `webapp-mockup`, `memo-cli-usage`.

`plan` and `implement` were the always-loaded Copilot instructions; as skills they load on demand instead of consuming context every turn.

---

## Domain-Specific Conventions

Copilot's `applyTo`-scoped instructions have no direct Claude Code equivalent (there is no glob-scoped auto-load). The Next.js/React conventions (scoped to `**/*.tsx`) are preserved as a nested `CLAUDE.md` inside each React app's root directory when that app exists, so they load only while working in that subtree. When generating UI, follow those conventions and `/DESIGN.md`.

---

## File Organization

| Directory             | Contents                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `/docs/`              | Foundation docs — product-context, technical-guidelines, ADRs         |
| `/docs/requirements/` | PRDs                                                                  |
| `/workstream/`        | Active feature work — specs, stories, task lists, planner state files |
| `.claude/agents/`     | Subagent definitions                                                  |
| `.claude/skills/`     | On-demand skills                                                      |
| `.claude/commands/`   | Command entry points                                                  |
| `/mockups/`           | UX mockups                                                            |
