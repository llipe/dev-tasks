---
applyTo: "**"
---
# Rule: Generate Task List for Single Issue

## Goal

To guide an AI assistant in translating a refined GitHub Issue into an execution-ready task list that aligns with the existing task list management protocol and keeps the GitHub Issue as the source of truth.

## Context

This step assumes:
- The GitHub Issue has been refined.
- The refinement document exists in `/docs/issue-[issue-number]-[issue-name]-refinement.md`.

## Process

1. **Receive Issue Reference:** User provides issue number and repo.
2. **Read Issue + Refinement:** Use MCP to read the issue and the refinement doc.
3. **Ask Targeted Questions:** Only ask if tasks, files, or test scope remain unclear.
4. **Generate Task List:** Produce a single-issue task list in the required format.
5. **Update GitHub Issue:** Add the task list checklist to the issue body.
6. **Save Output:** Save the task list to `/docs`.

## Output Structure

The task list MUST follow the `process-task-list` format:

```markdown
# Implementation Plan - Issue [Issue Number]

## Relevant Files

- `path/to/file1.ts` - [Description]
- `path/to/file2.ts` - [Description]

## Tasks

- [ ] 1.0 Implement Issue [Issue Number]: [Issue Title]
  - [ ] 1.1 [Task step 1]
  - [ ] 1.2 [Task step 2]
  - [ ] 1.3 [Task step 3]
  - [ ] 1.x Verify Acceptance Criterion: [Criterion 1]
  - [ ] 1.y Verify Acceptance Criterion: [Criterion 2]
  - [ ] 1.z Run Tests: [Test Requirements]
```

## Conversion Guidelines

- Convert each acceptance criterion into an explicit verification sub-task.
- Convert each testing requirement into a sub-task.
- Include data model or seed data tasks when applicable.
- Keep the list small and sequential; avoid parallel tasks.

## Clarifying Questions

- "Which files do you expect to be modified?"
- "Do we need new tests or only update existing ones?"
- "Any setup or migration steps required?"
- "Should I add a Task 0 for setup? (Only if this is a new project or component)"

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/`
- **Filename:** `tasks-issue-[issue-number]-[issue-name].md`

## Final Instructions

1. Do NOT start implementation.
2. Ensure the task list mirrors the refined issue scope.
3. Update the GitHub Issue body to include the checklist.
4. Save the task list in `/docs/` and present it for review.
