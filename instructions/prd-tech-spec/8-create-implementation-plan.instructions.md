---
applyTo: "**"
---
# Rule: Create Implementation Plan

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
6. **Save Output:** Save as `tasks-[prd-name]-plan.md` in the `/docs/` directory.

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

1. **Title:** Use the format `Implement Story [ID]: [Title]`.
2. **Sub-tasks:**
   - Convert every item in the **Implementation Steps** section of the story into a sub-task.
   - Add specific sub-tasks for **Acceptance Criteria** verification.
   - Add specific sub-tasks for **Testing** (Unit/Integration).
3. **Context:** You can add a `> Note:` bock under the parent task to include the User Story text or Business Rules for easy reference, but keep the checkbox structure clean.
4. **Relevant Files:** Aggregate all "Files to Create/Modify" from the selected stories into the top-level `Relevant Files` section.

## Clarifying Questions

- "Which stories would you like to include in this implementation plan? (Recommended: 1-3 stories)"
- "Should I update the GitHub Issues with the task checklist now (using MCP)?"
- "Is this a greenfield/new project, or an existing codebase? (This affects whether we need a Task 0 for setup)"
- "Are there any specific implementation details or dependencies I should look out for before generating the tasks?"

## Greenfield Project Considerations

If this is a **greenfield project** or implementing a **new base component**, include a **Task 0: Project Setup** as the first parent task:
**Check if greenfield:** Ask whether this is a new project or existing codebase. If greenfield, include Task 0 before story tasks.
4. Convert the selected stories into the strict `tasks.md` format.
5. Ensure all "Files to Create/Modify", "Implementation Steps", and "Acceptance Criteria" are preserved in the translation.
6. For each selected story, update the corresponding GitHub Issue with the task checklist (using MCP). If no issue exists, ask the user whether to create it first.
7. Save the file as `tasks-[prd-name]-plan.md` (or a custom name if users prefers).
8 - [ ] 0.2 Set up version control and repository structure
  - [ ] 0.3 Configure environment variables (.env, .env.example)
  - [ ] 0.4 Set up development environment (dependencies, build tools, linting, formatting)
  - [ ] 0.5 Create initial documentation (README, CONTRIBUTING, setup instructions)
  - [ ] 0.6 Verify local development environment works (test build, tests pass)
  - [ ] 0.7 Publish initial project to GitHub (if not already done)
```

**When to include Task 0:**
- ✅ First time setting up a new repository
- ✅ Starting a new microservice or component
- ✅ Setting up isolated development environment for greenfield features
- ❌ Extensions to existing projects (skip if dependencies already installed)

## Final Instructions

1. Read the `user-stories` file.
2. List available stories and ask the user for their selection.
3. Convert the selected stories into the strict `tasks.md` format.
4. Ensure all "Files to Create/Modify", "Implementation Steps", and "Acceptance Criteria" are preserved in the translation.
5. For each selected story, update the corresponding GitHub Issue with the task checklist (using MCP). If no issue exists, ask the user whether to create it first.
6. Save the file as `tasks-[prd-name]-plan.md` (or a custom name if users prefers).
7. Inform the user they can now use the execution instruction to start coding, following the GitHub issue task checklist.
