
# dev-tasks

A set of agents, skills, and instructions for GitHub Copilot and other AI coding agents to run structured, PRD-driven development workflows.

## Core Idea

This system brings structure and clarity to AI-assisted development by:

- Defining scope with Product Requirements Documents (PRDs)
- Breaking requirements into actionable, implementation-ready tasks
- Guiding the AI to tackle one task at a time with checkpoints for review
- Providing specialized **agents** that orchestrate the workflow end-to-end
- Enforcing documentation, branch discipline, and GitHub-as-source-of-truth

---

## Taxonomy: Agent vs Skill vs Instruction

| Concept | Purpose | Loaded When | Decision Rule |
|---------|---------|-------------|---------------|
| **Agent** | Autonomous role with decision-making, phases, and handoff discipline. Owns a workflow end-to-end. | Invoked by name (`@agent`) | "Does it make decisions, own a multi-phase workflow, and hand off to other agents?" → Agent |
| **Skill** | Reusable on-demand capability. Describes *procedures* or *activities* that any agent can invoke when needed. Not loaded unless referenced. | On demand (invoked by agent or prompt) | "Is this capability needed only sometimes, by one or more agents?" → Skill |
| **Instruction** | Always-loaded rule scoped via `applyTo` frontmatter. Enforced automatically for every matching context. | Always (auto-applied by runtime) | "Must this rule be enforced every time, for every matching file or context?" → Instruction |

**Key distinctions:**
- Skills save context window space — they are loaded only when invoked, unlike instructions which are always present.
- Agent files define *who* (identity, phases, handoff rules). Skill files define *how* (procedures, templates, steps).
- Instructions are for cross-cutting rules that must never be forgotten (e.g., implementation discipline, planning format).

---

## Agents

| Agent | File | Purpose |
|---|---|---|
| **product-engineer** | `product-engineer.agent.md` | Preparation agent — owns the full pre-coding chain: PRD, spec, stories, plan. Hands off to `developer` or `planner` for execution. |
| **developer** | `developer.agent.md` | Execution agent — implements code from an existing task list. Runs `implement` only. |
| **planner** | `planner.agent.md` | Multi-story orchestration — dependency-ordered sequential execution with checkpoint/resume and one consolidated integration PR. |
| **technical-writer** | `technical-writer.agent.md` | Autonomous documentation maintenance |
| **housekeeping** | `housekeeping.agent.md` | Lint, type, and test-wiring fixes |
| **github-ops** | `github-ops.agent.md` | GitHub consistency — standardizes issues, PRs, branches, labels, milestones, comments, and enforces merge authority policy |
| **ux-engineer** | `ux-engineer.agent.md` | UX prototyping and gap analysis — turns PRD/SPEC into testable mockups and feeds refinements back to `product-engineer` |
| **black-box-tester** | `black-box-tester.agent.md` | Deep black-box testing — derives compliance test plans and edge cases from specs/stories, validates "requested vs delivered" behavior |

## Skills

Skills are on-demand capabilities invoked by agents. They are **not** loaded into context unless explicitly referenced.

### Activity Skills

These are the composable activities from the development workflow, converted to skills so they only consume context when needed:

| Skill | Directory | Purpose | Primary Consumer |
|---|---|---|---|
| **activity-init** | `skills/activity-init/` | Establish product context and technical guidelines | `product-engineer` |
| **activity-refine** | `skills/activity-refine/` | Clarify scope — issue refinement or full PRD creation | `product-engineer` |
| **activity-generate-spec** | `skills/activity-generate-spec/` | Transform PRD into technical specification | `product-engineer` |
| **activity-generate-stories** | `skills/activity-generate-stories/` | Break spec into user stories with coverage validation | `product-engineer` |
| **activity-publish-github** | `skills/activity-publish-github/` | Publish stories as GitHub Issues via MCP | `product-engineer` |
| **activity-e2e-test-design** | `skills/activity-e2e-test-design/` | End-to-end black-box test scenario generation from spec/stories | `black-box-tester` |
| **activity-contract-test-design** | `skills/activity-contract-test-design/` | Consumer/provider contract and schema compatibility test strategy | `black-box-tester` |
| **activity-edge-case-refinement** | `skills/activity-edge-case-refinement/` | Systematic edge-case discovery by category with concrete examples | `black-box-tester` |
| **activity-random-test-tactics** | `skills/activity-random-test-tactics/` | Randomized, fuzz, and property-inspired test generation with reproducibility | `black-box-tester` |

### Operational Skills

| Skill | Directory | Purpose | Primary Consumer |
|---|---|---|---|
| **git-ops** | `skills/git-ops/` | Branch management, rebase, merge, conflict resolution, recovery | `developer`, `planner` |
| **webapp-mockup** | `skills/webapp-mockup/` | Scaffold and generate React mockup apps for UX testing | `ux-engineer` |

### Third-Party Skills

| Skill | Directory | Purpose | Primary Consumer |
|---|---|---|---|
| **vercel-composition-patterns** | `skills/vercel-composition-patterns/` | Vercel component composition patterns | `developer`, `ux-engineer` |
| **vercel-react-best-practices** | `skills/vercel-react-best-practices/` | Vercel React best practices | `developer`, `ux-engineer` |

## Instructions (Always-Loaded)

Instructions are scoped via `applyTo` and auto-applied. Only cross-cutting rules that must always be enforced remain as instructions.

| Instruction | File | Scope | Purpose |
|---|---|---|---|
| **plan** | `plan.instructions.md` | `**` | Convert stories or refined issues into execution-ready task lists |
| **implement** | `implement.instructions.md` | `**` | Execute task list with step-gated approval, branching, and PR discipline |
| **nextjs-pages-components** | `domain/nextjs-pages-components.instructions.md` | `apps/management-hub/src/**/*.tsx` | Next.js + React conventions |

## Prompts

Prompts are entry points that configure an agent for a specific use case.

| Prompt | Agent | Purpose |
|---|---|---|
| `product-engineer-init` | product-engineer | Initialize project foundation documents |
| `product-engineer-feature` | product-engineer | Design and plan a new feature end-to-end |
| `product-engineer-issue` | product-engineer | Refine and plan a GitHub Issue |
| `developer-execute` | developer | Execute an existing task list |
| `planner` | planner | Orchestrate multi-story execution |
| `planner-resume` | planner | Resume interrupted multi-story run from checkpoint |
| `ux-engineer` | ux-engineer | Generate UX mockups from PRD/SPEC |
| `github-ops` | github-ops | GitHub consistency operations |
| `technical-writer` | technical-writer | Documentation maintenance |
| `housekeeping` | housekeeping | Lint, type, and test fixes |
| `black-box-tester-design` | black-box-tester | Generate compliance test plan from spec or stories |
| `black-box-tester-validate` | black-box-tester | Validate delivered behavior against spec or stories |

---

## Workflow Chains

### Full Feature (PRD-Driven)

```
product-engineer: refine → generate-spec → generate-stories → publish-github → plan
                                                                                  ↓
developer: implement
```

### Single GitHub Issue

```
product-engineer: refine → plan
                            ↓
developer: implement
```

### Multi-Story Orchestration

```
product-engineer: refine → generate-spec → generate-stories → publish-github → plan
                                                                                  ↓
planner: orchestrate → developer: implement (per story, sequential)
```

### Quick Fix (Clear Issue, Task List Exists)

```
developer: implement
```

### UX Validation Loop

```
product-engineer: refine → generate-spec
                               ↓
ux-engineer: mockups → gap analysis → refinement handoff
                                          ↓
product-engineer: update spec/stories
```

### Test-First Design (Black-Box)

```
product-engineer: refine → spec → stories → plan
                                                 ↓
black-box-tester: generate test plan (from spec or stories)
                                                 ↓
developer: implement (feature + tests from test plan)
                                                 ↓
black-box-tester: validate compliance → validation report
```

### Project Initialization

```
product-engineer (init mode): activity-init → product-context.md + technical-guidelines.md
```

---

## General Agent Guidelines

All AI coding agents working in this repository **MUST**:

- Always create feature branches — never commit to the default branch
- Use Conventional Commits (`feat`, `fix`, `chore`, `docs`, etc.)
- Create PRs for review — never self-merge into `main`
- **PRs targeting `main` require user approval** — no agent may merge into the default branch
- Follow testing, linting, and documentation standards from `technical-guidelines.md`
- Reference GitHub Issues in branch names and commits
- Maintain document changelogs when updating generated artifacts (PRDs, specs, user stories, etc.)
- Use the `git-ops` skill for branch management, rebase, and conflict resolution
