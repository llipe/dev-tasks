# dev-tasks

A set of agents, skills, and instructions for GitHub Copilot, Claude Code, Kiro, and other AI coding agents to run structured, PRD-driven development workflows.

## Core Idea

This system brings structure and clarity to AI-assisted development by:

- Defining scope with Product Requirements Documents (PRDs)
- Breaking requirements into actionable, implementation-ready tasks
- Guiding the AI to tackle one task at a time with checkpoints for review
- Providing specialized **agents** that orchestrate the workflow end-to-end
- Enforcing documentation, branch discipline, and GitHub-as-source-of-truth
- Standardizing visual design decisions through `/DESIGN.md` as the canonical UI contract
- **Test-first design as the default**: `verifier` (Design Mode) produces compliance test plans before implementation, and `developer` writes tests before code

## Design Standard Contract (DESIGN.md)

`/DESIGN.md` is the canonical design-system artifact for this repository.

- `ux-engineer` **MUST** use `/DESIGN.md` as the primary style source for mockups.
- `product-engineer` **MUST** reference `/DESIGN.md` for UI-impacting specs and stories.
- `developer` **MUST** validate UI changes against `/DESIGN.md` and update it when the visual contract changes.
- `planner` **MUST** require DESIGN.md compliance in UI-impacting delegated runs.

If `/DESIGN.md` is missing and the requested scope includes UI work, agents **MUST** create a baseline DESIGN.md before finalizing design-dependent outputs.

---

## Taxonomy: Agent vs Skill vs Instruction

| Concept         | Purpose                                                     | Loaded When                  |
| --------------- | ----------------------------------------------------------- | ---------------------------- |
| **Agent**       | Autonomous role with decision-making and handoff discipline | Invoked by name (`@agent`)   |
| **Skill**       | Reusable on-demand capability (procedures/activities)       | On demand (invoked by agent) |
| **Instruction** | Scoped rule enforced automatically for matching context     | Auto-applied by runtime      |

---

## Agents

| Agent                | File                        | Purpose                                                                                                                                                                                                                                          |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **product-engineer** | `product-engineer.agent.md` | Preparation agent — owns the full pre-coding chain: PRD, spec, stories, plan. Owns drift-reconciliation (`activity-drift-reconciliation`) for findings handed off by `developer`/`planner`. Hands off to `developer` or `planner` for execution. |
| **developer**        | `developer.agent.md`        | Execution agent — implements code from an existing task list. Runs `implement`, including a mandatory, non-skippable `verifier` audit before every PR is marked ready.                                                                           |
| **planner**          | `planner.agent.md`          | Multi-story orchestration — dependency-ordered sequential execution with checkpoint/resume, a mandatory per-story and PRD-level rollup `verifier` audit gate, and one consolidated integration PR.                                               |
| **technical-writer** | `technical-writer.agent.md` | Autonomous documentation maintenance                                                                                                                                                                                                             |
| **housekeeping**     | `housekeeping.agent.md`     | Lint, type, and test-wiring fixes                                                                                                                                                                                                                |
| **github-ops**       | `github-ops.agent.md`       | GitHub consistency — standardizes issues, PRs, branches, labels, milestones, comments, and enforces merge authority policy                                                                                                                       |
| **ux-engineer**      | `ux-engineer.agent.md`      | UX prototyping and gap analysis — turns PRD/SPEC into testable mockups and feeds refinements back to `product-engineer`                                                                                                                          |
| **verifier**         | `verifier.agent.md`         | Verification agent — owns compliance test-plan design (`design` mode) and post-implementation grey-box fidelity auditing (`audit` mode) against codebase, `/workstream`, tests, and PRD/spec intent                                              |

## Skills

Skills are on-demand capabilities invoked by agents — **not** loaded unless explicitly referenced.

### Activity Skills

| Skill                             | Directory                               | Purpose                                                                                                                           | Primary Consumer   |
| --------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **activity-init**                 | `skills/activity-init/`                 | Establish product context and technical guidelines                                                                                | `product-engineer` |
| **activity-refine**               | `skills/activity-refine/`               | Clarify scope — issue refinement or full PRD creation                                                                             | `product-engineer` |
| **activity-generate-spec**        | `skills/activity-generate-spec/`        | Transform PRD into technical specification                                                                                        | `product-engineer` |
| **activity-generate-stories**     | `skills/activity-generate-stories/`     | Break spec into user stories with coverage validation                                                                             | `product-engineer` |
| **activity-publish-github**       | `skills/activity-publish-github/`       | Publish stories as GitHub Issues via MCP                                                                                          | `product-engineer` |
| **activity-e2e-test-design**      | `skills/activity-e2e-test-design/`      | End-to-end black-box test scenario generation from spec/stories                                                                   | `verifier`         |
| **activity-contract-test-design** | `skills/activity-contract-test-design/` | Consumer/provider contract and schema compatibility test strategy                                                                 | `verifier`         |
| **activity-edge-case-refinement** | `skills/activity-edge-case-refinement/` | Systematic edge-case discovery by category with concrete examples                                                                 | `verifier`         |
| **activity-random-test-tactics**  | `skills/activity-random-test-tactics/`  | Randomized, fuzz, and property-inspired test generation with reproducibility                                                      | `verifier`         |
| **activity-drift-reconciliation** | `skills/activity-drift-reconciliation/` | Routes verifier drift findings into task-list/checklist expansion, new issues, or PRD/spec changelog write-back (human-confirmed) | `product-engineer` |

### Operational Skills

| Skill              | Directory                | Purpose                                                                                                                                   | Primary Consumer                |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **git-ops**        | `skills/git-ops/`        | Branch management, rebase, merge, conflict resolution, recovery                                                                           | `developer`, `planner`          |
| **webapp-mockup**  | `skills/webapp-mockup/`  | Scaffold and generate React mockup apps for UX testing                                                                                    | `ux-engineer`                   |
| **memo-cli-usage** | `skills/memo-cli-usage/` | Read and write architectural decisions to a shared Qdrant knowledge base for multi-session, multi-agent, and team-wide context continuity | `technical-writer`, `developer` |

### Third-Party Skills

| Skill                           | Directory                             | Purpose                               | Primary Consumer           |
| ------------------------------- | ------------------------------------- | ------------------------------------- | -------------------------- |
| **vercel-composition-patterns** | `skills/vercel-composition-patterns/` | Vercel component composition patterns | `developer`, `ux-engineer` |
| **vercel-react-best-practices** | `skills/vercel-react-best-practices/` | Vercel React best practices           | `developer`, `ux-engineer` |

## Instructions (Scoped)

Instructions are scoped via `applyTo`/`fileMatchPattern` and auto-applied to matching files.

| Instruction                 | File                                             | Scope                      | Purpose                                                                  |
| --------------------------- | ------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------ |
| **plan**                    | `plan.instructions.md`                           | `workstream/**`            | Convert stories or refined issues into execution-ready task lists        |
| **implement**               | `implement.instructions.md`                      | `workstream/**/tasks-*.md` | Execute task list with step-gated approval, branching, and PR discipline |
| **nextjs-pages-components** | `domain/nextjs-pages-components.instructions.md` | `**/app/**/*.tsx`          | Next.js + React conventions                                              |

## Prompts

See individual agent files for invocation modes and entry points. Reference: Copilot (`.github/prompts/`), Claude Code (`.claude/commands/`), Kiro (embedded in `.kiro/agents/`).

---

## General Agent Guidelines

All AI coding agents working in this repository **MUST**:

- Always create feature branches — never commit to the default branch
- Use Conventional Commits (`feat`, `fix`, `chore`, `docs`, etc.)
- Create PRs for review — never self-merge into `main`
- **PRs targeting `main` require user approval** — no agent may merge into the default branch
- Follow testing, linting, and documentation standards from `technical-guidelines.md`
- Reference GitHub Issues in branch names and commits
- Treat `/DESIGN.md` as the source of truth for visual tokens, components, and design guidance
- Prefer `pnpm` over `npm` for JS/TS workflows
- Use canonical script names: `lint`, `format:check`, `typecheck`, `test`, `audit`, `validate`
- Enforce quality gates before completion: `test`, `lint`, `format:check`, `typecheck`, `audit`
- Use the `git-ops` skill for branch management, rebase, and conflict resolution
- The `verifier` audit is mandatory and non-skippable before every PR is marked ready. Drift findings are non-blocking and route to `product-engineer`'s `activity-drift-reconciliation`.
- **Test-first design is the default:** `product-engineer` recommends `verifier` Design Mode after planning; `developer` writes tests before implementation code; `planner` checks for test plans and enforces test-first in developer handoffs
- If `memo-cli` is installed and configured: agents **MUST** read/write entries per their role (see agent files for details)

For workflow chains and sequencing diagrams, see [`docs/workflow-chains.md`](docs/workflow-chains.md).
