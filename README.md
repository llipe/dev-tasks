# dev-tasks

A set of instructions for GitHub Copilot and other AI coding agents to emulate a PRD and task-based development workflow, inspired by [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks).

## ✨ The Core Idea

This workflow brings structure and clarity to AI-assisted development by:

- Defining scope with a Product Requirement Document (PRD)
- Breaking down the PRD into actionable tasks
- Guiding the AI to tackle one task at a time, with checkpoints for review and approval

## 📋 Workflow Overview

### Primary Workflow: Task-Based Development

1. **Create a PRD**: Use `instructions/primary-workflow/1-create-prd.instructions.md` to guide the AI in generating a detailed PRD for your feature.
2. **Generate Tasks**: Use `instructions/primary-workflow/2-generate-tasks.instructions.md` to break the PRD into a step-by-step implementation plan.
3. **Process Task List**: Use `instructions/primary-workflow/3-process-task-list.instructions.md` to instruct the AI to work through tasks one at a time, marking completion and waiting for user approval before proceeding.

### Secondary Workflow: PRD-Spec Driven Development

A comprehensive AI-assisted workflow that establishes foundational context and technical specifications before breaking down implementation into granular user stories.

1. **Define Product Context**: Use `instructions/prd-tech-spec/1-product-context.instructions.md` to document the macro view of the product or project.
2. **Define Technical Guidelines**: Use `instructions/prd-tech-spec/2-technical-guidelines.instructions.md` to establish technical foundations, architecture patterns, stack, and standards.
3. **Create Base PRD**: Use `instructions/prd-tech-spec/3-base-prd.instructions.md` to define specific features with clear scope (ideally ≤10 features).
4. **Generate Specification**: Use `instructions/prd-tech-spec/4-generate-specification.instructions.md` to synthesize PRD + Technical Guidelines into actionable technical design.
5. **Generate User Stories**: Use `instructions/prd-tech-spec/5-generate-user-stories.instructions.md` to break the specification into implementation-ready user stories (each providing independent value and fitting in a PR).
6. **Validate Coverage**: Use `instructions/prd-tech-spec/6-validate-coverage.instructions.md` to ensure all PRD requirements are covered by the user stories.
7. **Publish User Stories to GitHub**: Use `instructions/prd-tech-spec/7-publish-user-stories-github.instructions.md` to create GitHub Issues via MCP so GitHub becomes the execution source of truth.
8. **Create Implementation Plan**: Use `instructions/prd-tech-spec/8-create-implementation-plan.instructions.md` to select specific stories and convert them into a task list ready for execution.
9. **Execute Task List**: Use `instructions/prd-tech-spec/9-execute-task-list.instructions.md` to instruct the AI to work through tasks step-by-step, marking completion and waiting for user approval.

## 🗂️ Files

### Primary Workflow
- `instructions/primary-workflow/1-create-prd.instructions.md`: PRD generation instructions
- `instructions/primary-workflow/2-generate-tasks.instructions.md`: Task list generation instructions
- `instructions/primary-workflow/3-process-task-list.instructions.md`: Task processing and completion protocol

### Secondary Workflow: PRD-Spec Driven Development
- `instructions/prd-tech-spec/1-product-context.instructions.md`: Document product and project context
- `instructions/prd-tech-spec/2-technical-guidelines.instructions.md`: Define technical foundations and standards
- `instructions/prd-tech-spec/3-base-prd.instructions.md`: Create base product requirements document
- `instructions/prd-tech-spec/4-generate-specification.instructions.md`: Generate technical specification from PRD + guidelines
- `instructions/prd-tech-spec/5-generate-user-stories.instructions.md`: Break specification into user stories
- `instructions/prd-tech-spec/6-validate-coverage.instructions.md`: Validate requirement coverage across stories
- `instructions/prd-tech-spec/7-publish-user-stories-github.instructions.md`: Publish user stories as GitHub Issues via MCP
- `instructions/prd-tech-spec/8-create-implementation-plan.instructions.md`: Convert selected stories into an actionable task list
- `instructions/prd-tech-spec/9-execute-task-list.instructions.md`: Task execution and completion protocol

## 🤖 GitHub Agents

### TechDebtUpgradeCopilot

A specialized GitHub Copilot agent for dependency upgrades, framework migrations, and technical debt remediation.

- **Purpose**: Modernize projects by updating packages, frameworks, and runtimes without changing scope or features
- **Location**: `github/agents/tech-debt-fixer.md`
- **Supported stacks**: JavaScript/TypeScript (Node.js, Next.js, React, etc.) and Python (Django, FastAPI, pytest, etc.)
- **Key features**:
  - Structured 6-phase operating procedure (Identify → Assess → Research → Plan → Implement → Verify)
  - Mandatory documentation in `/docs/<issue-name>.md`
  - GitHub issue integration (branch naming, commit messages, PR linking)
  - Atomic commits with rollback strategies
  - Behavior preservation with comprehensive verification

**Use when**: Upgrading dependencies, migrating frameworks, or addressing technical debt systematically.

## 🌟 Benefits

### Primary Workflow
- Structured, step-by-step development
- Review and approve each change
- Manages complexity and improves reliability
- Clear progress tracking

### Secondary Workflow: PRD-Spec Driven Development
- Establishes strong foundational context and technical decisions upfront
- Ensures PRD and technical guidelines work together to drive consistent decisions
- Breaks large features into appropriately-sized, value-delivering user stories
- Each user story is independently deployable and fits in a single PR
- Comprehensive coverage validation ensures nothing is missed
- Reduces rework and technical debt from discovering gaps during development
- Clear traceability from product requirements through technical design to implementation

## 🛠️ How to Use

### Setup

1. Create a `.github` folder in your repository.
2. Add the `instructions` folder (containing the instruction `.md` files) inside `.github`.
3. (Optional) Add a `copilot-instructions.md` file in `.github` for additional or custom instructions for GitHub Copilot.

### Using the Primary Workflow

1. Reference the primary workflow instruction files in the `instructions/primary-workflow/` folder.
2. Follow the workflow: PRD → Tasks → Process.
3. All generated documents are stored in the `/docs` directory of your working repository.

### Using the Secondary Workflow: PRD-Spec Driven Development

**Recommended for:** Complex features, new projects, or when establishing strong technical foundations is important.

#### Phase 1: Foundation (Done Once)
Establish these documents at the start of the project. They serve as the "constitution" for all future development.

1. **Define Product Context:** Use `instructions/prd-tech-spec/1-product-context.instructions.md` to document what the product is and its strategic goals.
2. **Define Technical Guidelines:** Use `instructions/prd-tech-spec/2-technical-guidelines.instructions.md` to establish the technical stack, patterns, and standards.

#### Phase 2: Feature Cycle (Repeated for each Feature/Epic)
Run this cycle for every new feature set or release.

3. **Create Base PRD:** Use `instructions/prd-tech-spec/3-base-prd.instructions.md` to define specific features (keeping scope ≤50 stories).
4. **Generate Specification:** Use `instructions/prd-tech-spec/4-generate-specification.instructions.md` to design the technical solution.
5. **Generate User Stories:** Use `instructions/prd-tech-spec/5-generate-user-stories.instructions.md` to create granular implementation stories.
6. **Validate Coverage:** Use `instructions/prd-tech-spec/6-validate-coverage.instructions.md` to verify all requirements are covered.
7. **Publish User Stories to GitHub:** Use `instructions/prd-tech-spec/7-publish-user-stories-github.instructions.md` to create GitHub Issues via MCP.
8. **Create Implementation Plan:** Use `instructions/prd-tech-spec/8-create-implementation-plan.instructions.md` to pick stories for the current sprint and generate a task list.
9. **Execute Tasks:** Use `instructions/prd-tech-spec/9-execute-task-list.instructions.md` to iteratively build and verify the code.

10. **Store Artifacts:** All generated documents are stored in the `/docs` directory.

### Workflow Integration

- The output of **Step 8** creates an Implementation Plan file.
- The instructions in **Step 9** (`9-execute-task-list.instructions.md`) allow you to execute that plan entirely within the Secondary Workflow context, without needing to reference the Primary Workflow instructions.
- The output of **Step 7** makes GitHub the source of truth for story tracking.
- All artifacts are stored in the `/docs` directory for centralized documentation.

## 💡 Tips

- Be specific in your feature descriptions
- Use capable AI models for best results
- Iterate and guide the AI as needed

## Attribution

Based on [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)
