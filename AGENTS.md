
# dev-tasks

A set of activity-based instructions and agents for GitHub Copilot and other AI coding agents to run structured, PRD-driven development workflows.

## Core Idea

This system brings structure and clarity to AI-assisted development by:

- Defining scope with Product Requirements Documents (PRDs)
- Breaking requirements into actionable, implementation-ready tasks
- Guiding the AI to tackle one task at a time with checkpoints for review
- Providing specialized **agents** that orchestrate the workflow end-to-end
- Enforcing documentation, branch discipline, and GitHub-as-source-of-truth

## Activity-Based Instructions

Instructions are organized as **composable activities** rather than rigid pipeline steps. Each activity can be invoked independently or chained by an agent.

| Activity | File | Purpose |
|----------|------|---------|
| **init** | `init.instructions.md` | Establish product context and technical guidelines (run once per project) |
| **refine** | `refine.instructions.md` | Clarify scope — lightweight issue refinement or full PRD creation |
| **generate-spec** | `generate-spec.instructions.md` | Transform PRD into a technical specification |
| **generate-stories** | `generate-stories.instructions.md` | Break specification into user stories with built-in coverage validation |
| **publish-github** | `publish-github.instructions.md` | Publish user stories as GitHub Issues via MCP |
| **plan** | `plan.instructions.md` | Convert stories or refined issues into execution-ready task lists |
| **implement** | `implement.instructions.md` | Execute task list with step-gated approval, branching, and PR discipline |

### Domain-Specific Instructions

Technology-specific rules are scoped via `applyTo` frontmatter and auto-applied when editing matching files:

| File | Scope | Purpose |
|------|-------|---------|
| `domain/nextjs-pages-components.instructions.md` | `apps/management-hub/src/**/*.tsx` | Next.js + React conventions |

## Agents

| Agent | File | Purpose |
|-------|------|---------|
| **developer** | `developer.agent.md` | Unified implementation agent — single issues and full PRD features |
| **technical-writer** | `technical-writer.agent.md` | Autonomous documentation maintenance |
| **housekeeping** | `housekeeping.agent.md` | Lint, type, and test-wiring fixes |
| **github-ops** | `github-ops.agent.md` | GitHub consistency — standardizes issues, PRs, branches, labels, milestones, and comments |

## Workflow Chains

### Full Feature (PRD-Driven)
`init` → `refine` → `generate-spec` → `generate-stories` → `publish-github` → `plan` → `implement`

### Single GitHub Issue
`refine` → `plan` → `implement`

### Quick Fix (Clear Issue)
`plan` → `implement`

## General Agent Guidelines

All AI coding agents working in this repository **MUST**:

- Always create feature branches — never commit to the default branch
- Use Conventional Commits (`feat`, `fix`, `chore`, `docs`, etc.)
- Create PRs for review — never self-merge
- Follow testing, linting, and documentation standards from `technical-guidelines.md`
- Reference GitHub Issues in branch names and commits

## Attribution

Based on [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)
