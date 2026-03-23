---
applyTo: "**"
---
# Rule: Create Implementation Plan
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

To guide an AI assistant in selecting specific User Stories from the backlog, converting them into a structured Implementation Plan (Task List), and publishing that task list into the corresponding GitHub Issues. This step bridges planning and execution while keeping GitHub as the source of truth.

## Context

This step assumes the following documents already exist:
- `user-stories-[prd-name].md` - The comprehensive list of user stories

## Process

1. **Receive Context:** The user provides the reference to the `user-stories-[prd-name].md` file.
2. **Review Backlog:** The AI reads the file and lists the available User Stories.
3. **Select Stories:** The AI asks the user which specific stories they want to implement in this session or sprint.
4. **Generate Task List:** Based on the selection, the AI generates a `tasks-[name].md` file formatted specifically for the `process-task-list` workflow.
5. **Publish Tasks to GitHub Issues:** For each selected story, update the corresponding GitHub Issue body to include the task list as a checklist (using MCP). If no issue exists, ask the user whether to create it first.
5. **Save Output:** Save as `tasks-[prd-name]-plan.md` in the `/workstream/` directory.

## Output Structure

The output **MUST** follow the format required by the Primary Workflow's `process-task-list` instruction:

```markdown
# Implementation Plan - [PRD Name]

## Relevant Files

- `path/to/file1.ts` - [Description]
- `path/to/file2.ts` - [Description]
[...list all files mentioned in the selected user stories...]

## Tasks

- [ ] 1.0 Implement Story [ID]: [Story Title]
  - [ ] 1.1 [First Implementation Step from Story]
  - [ ] 1.2 [Second Implementation Step from Story]
  - [ ] ...
  - [ ] 1.x Verify Acceptance Criterion: [Criterion 1]
  - [ ] 1.y Verify Acceptance Criterion: [Criterion 2]
  - [ ] 1.z Run Tests: [Test Requirements]

- [ ] 2.0 Implement Story [ID]: [Story Title]
  - [ ] 2.1 [First Implementation Step from Story]
  - ...
```

## Conversion Guidelines

When converting a **User Story** to a **Parent Task**:

1. **Title:** You **MUST** use the format `Implement Story [ID]: [Title]`.
2. **Sub-tasks:**
   - You **MUST** convert every item in the **Implementation Steps** section of the story into a sub-task.
   - You **MUST** add specific sub-tasks for **Acceptance Criteria** verification.
   - You **MUST** add specific sub-tasks for **Testing** (Unit/Integration).
   - **Data Models & Seed Data:** If the story involves creating or modifying data models/entities, include a specific sub-task to generate seed data for development. Format: `[X].Y Create seed data for [Entity Name]` with details about sample records needed for testing and development.
3. **Context:** You can add a `> Note:` bock under the parent task to include the User Story text or Business Rules for easy reference, but keep the checkbox structure clean.
4. **Relevant Files:** Aggregate all "Files to Create/Modify" from the selected stories into the top-level `Relevant Files` section.

## Clarifying Questions

- "Which stories would you like to include in this implementation plan? (Recommended: 1-3 stories)"
- "Should I update the GitHub Issues with the task checklist now (using MCP)?"
- "Is this a greenfield/new project, or an existing codebase? (This affects whether we need a Task 0 for setup)"
- "Are there any specific implementation details or dependencies I should look out for before generating the tasks?"
- "Do any of the selected stories involve data model creation? If so, what sample/seed data should be included for development and testing?"

## Greenfield Project Considerations

If this is a **greenfield project** or implementing a **new base component**, include a **Task 0: Project Setup** as the first parent task:
**Check if greenfield:** Ask whether this is a new project or existing codebase. If greenfield, include Task 0 before story tasks.

```
- [ ] 0.0 Project Setup
  - [ ] 0.1 Initialize project structure and package management
  - [ ] 0.2 Set up version control and repository structure
  - [ ] 0.3 Configure environment variables (.env, .env.example)
  - [ ] 0.4 Set up development environment (dependencies, build tools, linting, formatting)
  - [ ] 0.5 Create initial documentation (README, CONTRIBUTING, setup instructions)
  - [ ] 0.6 **Create seed data generation script** (if using database): Include sample records for all initial entities
  - [ ] 0.7 Verify local development environment works (test build, tests pass, seed data loads)
  - [ ] 0.8 Publish initial project to GitHub (if not already done)
```

**When to include Task 0:**
- ✅ First time setting up a new repository
- ✅ Starting a new microservice or component
- ✅ Setting up isolated development environment for greenfield features
- ✅ Database setup with initial schema (include seed data generation sub-task)
- ❌ Extensions to existing projects (skip if dependencies already installed)

## Final Instructions

1. You **MUST** read the `user-stories` file.
2. You **MUST** list available stories and ask the user for their selection.
3. You **MUST** convert the selected stories into the strict `tasks.md` format.
4. You **MUST** ensure all "Files to Create/Modify", "Implementation Steps", and "Acceptance Criteria" are preserved in the translation.
5. For each selected story, you **MUST** update the corresponding GitHub Issue with the task checklist (using MCP). If no issue exists, you **MUST** ask the user whether to create it first.
6. You **MUST** save the file as `tasks-[prd-name]-plan.md` (or a custom name if the user prefers).
7. You **MUST** inform the user they can now use the execution instruction to start coding, following the GitHub issue task checklist.
