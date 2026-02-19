---
applyTo: "**"
---
# Rule: Create Implementation Plan

## Goal

To guide an AI assistant in selecting specific User Stories from the backlog and converting them into a structured Implementation Plan (Task List) ready for execution. This step bridges the planning phase and the execution phase.

## Context

This step assumes the following documents already exist:
- `user-stories-[prd-name].md` - The comprehensive list of user stories

## Process

1. **Receive Context:** The user provides the reference to the `user-stories-[prd-name].md` file.
2. **Review Backlog:** The AI reads the file and lists the available User Stories.
3. **Select Stories:** The AI asks the user which specific stories they want to implement in this session or sprint.
4. **Generate Task List:** Based on the selection, the AI generates a `tasks-[name].md` file formatted specifically for the `process-task-list` workflow.
5. **Save Output:** Save as `tasks-[prd-name]-plan.md` in the `/docs/` directory.

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
- "Are there any specific implementation details or dependencies I should look out for before generating the tasks?"

## Final Instructions

1. Read the `user-stories` file.
2. List available stories and ask the user for their selection.
3. Convert the selected stories into the strict `tasks.md` format.
4. Ensure all "Files to Create/Modify", "Implementation Steps", and "Acceptance Criteria" are preserved in the translation.
5. Save the file as `tasks-[prd-name]-plan.md` (or a custom name if users prefers).
6. Inform the user they can now use the `process-task-list` instruction on this new file to start coding.
