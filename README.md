# dev-tasks

A set of instructions and agents for GitHub Copilot and other AI coding agents to emulate a PRD and task-based development workflow, inspired by [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks).

## ✨ The Core Idea

This workflow brings structure and clarity to AI-assisted development by:

- Defining scope with a Product Requirement Document (PRD)
- Breaking down the PRD into actionable tasks
- Guiding the AI to tackle one task at a time, with checkpoints for review and approval
- Providing specialized **agents** that orchestrate the workflow end-to-end
- Enforcing documentation, branch discipline, and GitHub-as-source-of-truth

## 📋 Workflow Overview

### Workflow: PRD-Spec Driven Development

A comprehensive AI-assisted workflow that establishes foundational context and technical specifications before breaking down implementation into granular user stories. Orchestrated by the **`workflow-feature-implementation`** agent.

1. **Define Product Context**: Use `.github/instructions/workflow-1-product-context.instructions.md` to document the macro view of the product or project.
2. **Define Technical Guidelines**: Use `.github/instructions/workflow-2-technical-guidelines.instructions.md` to establish technical foundations, architecture patterns, stack, and standards.
3. **Create Base PRD**: Use `.github/instructions/workflow-3-create-prd.instructions.md` to define specific features with clear scope (ideally ≤10 features).
4. **Generate Specification**: Use `.github/instructions/workflow-4-generate-specification.instructions.md` to synthesize PRD + Technical Guidelines into actionable technical design.
5. **Generate User Stories**: Use `.github/instructions/workflow-5-generate-user-stories.instructions.md` to break the specification into implementation-ready user stories (each providing independent value and fitting in a PR).
6. **Validate Coverage**: Use `.github/instructions/workflow-6-validate-coverage.instructions.md` to ensure all PRD requirements are covered by the user stories.
7. **Publish User Stories to GitHub**: Use `.github/instructions/workflow-7-publish-user-stories-github.instructions.md` to create GitHub Issues via MCP so GitHub becomes the execution source of truth.
8. **Create Implementation Plan**: Use `.github/instructions/workflow-8-create-implementation-plan.instructions.md` to select specific stories and convert them into a task list ready for execution.
9. **Execute Task List**: Use `.github/instructions/workflow-9-execute-task-list.instructions.md` to instruct the AI to work through tasks step-by-step, marking completion and waiting for user approval.

### Single Story GitHub Issue

Lightweight flow for implementing a single GitHub Issue end-to-end while keeping GitHub as the source of truth. Orchestrated by the **`github-issue-implementation`** agent.

1. **Refine Issue**: Use `.github/instructions/ssw-1-refine-github-issue.instructions.md` to clarify scope and acceptance criteria.
2. **Generate Task List**: Use `.github/instructions/ssw-2-generate-task-list.instructions.md` to convert the refined issue into a step-by-step checklist.
3. **Execute Task List**: Use `.github/instructions/ssw-3-execute-task-list.instructions.md` to implement one sub-task at a time with branch and PR discipline.

## 🤖 Agents

Agents are autonomous personas that orchestrate workflows. They live in `.github/agents/` and are invoked by name.

### `workflow-feature-implementation`

End-to-end feature delivery agent. Runs the full PRD-Spec Driven Development lifecycle — from PRD creation through specification, user stories, coverage validation, GitHub publication, and step-gated implementation. Enforces branch/PR discipline, checklist synchronization (local `/workstream` ↔ GitHub Issues), and mandatory documentation consolidation via `technical-writer` before closing any story.

**When to use:** Complex features, new projects, multi-story epics.

### `github-issue-implementation`

Single-issue implementation agent. Follows the `ssw-*` instruction sequence (`refine → task list → execute`) for one GitHub Issue at a time. Creates a feature branch, opens a Draft PR, executes sub-tasks sequentially with step-gated approval, and invokes `technical-writer` before finalization.

**When to use:** Implementing a single GitHub Issue quickly with strong execution hygiene.

### `technical-writer`

Autonomous documentation maintenance agent. Keeps `/docs` artifacts (`system-overview.md`, `data-model.md`, `product-context/`, `technical-guidelines/`, `api/openapi.yaml`, `api/endpoints.md`) aligned with the current state of the codebase. Creates ADRs in `/docs/adr/` whenever technical guidelines change. Never modifies application code — only documentation.

**When to use:** Invoked automatically by `workflow-feature-implementation` and `github-issue-implementation` before completing any story/issue. Can also be run standalone to audit documentation drift.

### `housekeeping`

Code-quality specialist for TypeScript, JavaScript, and Node.js projects. Fixes auto-fixable lint errors, type errors, broken test wiring (imports, mock paths, stale snapshots). Never changes test logic, business logic, or dependency versions without explicit confirmation. Escalates anything out of scope.

**When to use:** Cleaning up lint/type/test issues after a feature lands, or as a periodic hygiene pass.

## 🗂️ Files

### Instructions (`.github/instructions/`)

#### Workflow: PRD-Spec Driven Development
| File | Purpose |
|------|---------|
| `workflow-1-product-context.instructions.md` | Document product and project context |
| `workflow-2-technical-guidelines.instructions.md` | Define technical foundations and standards |
| `workflow-3-create-prd.instructions.md` | Create base product requirements document |
| `workflow-4-generate-specification.instructions.md` | Generate technical specification from PRD + guidelines |
| `workflow-5-generate-user-stories.instructions.md` | Break specification into user stories |
| `workflow-6-validate-coverage.instructions.md` | Validate requirement coverage across stories |
| `workflow-7-publish-user-stories-github.instructions.md` | Publish user stories as GitHub Issues via MCP |
| `workflow-8-create-implementation-plan.instructions.md` | Convert selected stories into an actionable task list |
| `workflow-9-execute-task-list.instructions.md` | Task execution and completion protocol |

#### Single Story GitHub Issue
| File | Purpose |
|------|---------|
| `ssw-1-refine-github-issue.instructions.md` | Refine a single GitHub issue with clear scope and acceptance criteria |
| `ssw-2-generate-task-list.instructions.md` | Convert refined issue into a task list and update the issue checklist |
| `ssw-3-execute-task-list.instructions.md` | Execute tasks step-by-step with branch and PR workflow |

#### Domain-Specific Instructions
| File | Purpose |
|------|---------|
| `nextjs-pages-components.instructions.md` | Next.js + React component and page conventions (scoped to `apps/management-hub/src/**/*.tsx`) |

### Agents (`.github/agents/`)

| File | Agent Name | Description |
|------|------------|-------------|
| `workflow-feature-implementation.agent.md` | `workflow-feature-implementation` | End-to-end feature delivery using `workflow-*` instructions |
| `github-issue-implementation.agent.md` | `github-issue-implementation` | Single-issue implementation using `ssw-*` instructions |
| `technical-writer.agent.md` | `technical-writer` | Autonomous documentation maintenance |
| `housekeeping.agent.md` | `housekeeping` | Lint, type, and test-wiring fixes |

## 🌟 Benefits

### Workflow: PRD-Spec Driven Development
- Establishes strong foundational context and technical decisions upfront
- Ensures PRD and technical guidelines work together to drive consistent decisions
- Breaks large features into appropriately-sized, value-delivering user stories
- Each user story is independently deployable and fits in a single PR
- Comprehensive coverage validation ensures nothing is missed
- Reduces rework and technical debt from discovering gaps during development
- Clear traceability from product requirements through technical design to implementation

### Single Story GitHub Issue
- Fast path for executing one issue at a time
- Keeps GitHub as the source of truth for scope and progress
- Enforces branching and PR discipline for every issue
- Minimizes ambiguity with explicit acceptance criteria and task checklists

### Agents
- **Autonomous execution**: Agents orchestrate multi-step workflows without manual instruction chaining
- **Mandatory documentation**: `technical-writer` ensures docs stay current after every feature/issue
- **Quality gates**: `housekeeping` catches lint/type/test regressions systematically
- **Step-gated safety**: Default stop-and-approve mode prevents runaway changes

## 🛠️ How to Use

### Setup

1. Create a `.github` folder in your repository.
2. Add the `instructions` folder (containing the instruction `.md` files) inside `.github`.
3. Add the `agents` folder (containing the agent `.md` files) inside `.github`.
4. (Optional) Add a `copilot-instructions.md` file in `.github` for additional or custom instructions for GitHub Copilot.
5. (Optional) Add domain-specific instruction files (like `nextjs-pages-components.instructions.md`) scoped to specific paths via the `applyTo` frontmatter.

### Using the Agents

#### `workflow-feature-implementation` (Full Feature Lifecycle)

**Recommended for:** Complex features, new projects, or when establishing strong technical foundations is important.

Invoke the `workflow-feature-implementation` agent and provide:
- Feature name and scope
- Target repository (`owner/repo`)
- Execution mode: `step-gated` (default, pauses after each sub-task) or `pre-approved autonomous batch`

The agent runs the full sequence:

**Phase 1: Foundation (Done Once)**

Establish these documents at the start of the project. They serve as the "constitution" for all future development.

1. **Define Product Context:** Uses `workflow-1-product-context.instructions.md` to document what the product is and its strategic goals. **Stored in `/docs`.**
2. **Define Technical Guidelines:** Uses `workflow-2-technical-guidelines.instructions.md` to establish the technical stack, patterns, and standards. **Stored in `/docs`.**

**Phase 2: Feature Cycle (Repeated for each Feature/Epic)**

3. **Create Base PRD** → defines specific features (scope ≤50 stories)
4. **Generate Specification** → designs the technical solution
5. **Generate User Stories** → creates granular implementation stories
6. **Validate Coverage** → verifies all requirements are covered
7. **Publish User Stories to GitHub** → creates GitHub Issues via MCP
8. **Create Implementation Plan** → picks stories and generates a task list
9. **Execute Tasks** → iteratively builds, tests, and invokes `technical-writer` before completion

**Store Artifacts:** Feature-specific documents (PRDs, specifications, user stories, task lists) are stored in the `/workstream` directory. Foundation documents (product-context.md, technical-guidelines.md) remain in `/docs`.

#### `github-issue-implementation` (Single Issue)

**Recommended for:** Implementing a single GitHub Issue quickly with strong execution hygiene.

Invoke the `github-issue-implementation` agent and provide:
- Repository (`owner/repo`)
- Issue number
- Whether to run full flow or start from an existing task list
- Execution mode: `step-gated` (default) or `pre-approved autonomous batch`

The agent runs:

1. **Refine the Issue** → clarifies scope and acceptance criteria
2. **Generate Tasks** → creates a task checklist and updates the GitHub Issue
3. **Execute Tasks** → implements one sub-task at a time, keeps GitHub updated, and invokes `technical-writer` before finalization

**Store Artifacts:** Refinement and task list documents are stored in `/workstream` using:
  - `issue-[issue-number]-[issue-name]-refinement.md`
  - `tasks-issue-[issue-number]-[issue-name].md`

#### `technical-writer` (Documentation Maintenance)

**Recommended for:** Auditing documentation drift or running a standalone docs update.

Usually invoked automatically by the implementation agents. Can also be run directly to scan `/workstream` and `/docs/requirements/` for changes and update canonical documentation files.

#### `housekeeping` (Code Quality)

**Recommended for:** Cleaning up lint, type, and test-wiring issues.

Invoke the `housekeeping` agent. It will:
1. Read project docs and detect tooling
2. Run lint, type-check, and test commands
3. Triage each failure as `IN_SCOPE`, `NEEDS_CONFIRMATION`, or `ESCALATE`
4. Fix all in-scope issues (lint → types → tests)
5. Produce a structured report with fixed, pending, and escalated items

### Using Instructions Directly (Without Agents)

You can also reference individual instruction files directly in your prompts without invoking an agent. This gives you manual control over each step:

1. Reference the instruction file in your prompt (e.g., "Follow `.github/instructions/workflow-3-create-prd.instructions.md`")
2. The AI will follow the rules in that instruction to produce the expected output
3. Chain instructions manually in sequence for the desired workflow

### Workflow Integration

- The output of **Step 8** creates an Implementation Plan file.
- The instructions in **Step 9** (`workflow-9-execute-task-list.instructions.md`) allow you to execute that plan entirely within the Workflow context.
- The output of **Step 7** makes GitHub the source of truth for story tracking.
- **Document Organization:** `/workstream` contains active feature work (PRDs, specs, stories, tasks), while `/docs` contains foundational documents (product-context.md, technical-guidelines.md).

## 💡 Tips

- Be specific in your feature descriptions
- Use capable AI models for best results
- Iterate and guide the AI as needed
- Use `step-gated` mode (the default) when you want to review each sub-task before proceeding
- Use `pre-approved autonomous batch` mode when you trust the agent to run through all sub-tasks without pausing
- Run `housekeeping` after major feature branches to catch regressions early
- Domain-specific instructions (like `nextjs-pages-components.instructions.md`) are auto-applied based on `applyTo` patterns — no manual invocation needed

## Attribution

Based on [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)