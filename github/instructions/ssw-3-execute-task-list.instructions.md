---
applyTo: "**"
---
# Rule: Execute Single-Issue Task List
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

To guide an AI assistant in implementing a single GitHub Issue using the task list checklist, with strict step-by-step execution, proper branching, PR workflow, and issue updates.

## Context

This step assumes:
- The GitHub Issue exists and includes a checklist.
- The task list file exists at `/workstream/tasks-issue-[issue-number]-[issue-name].md`.
- GitHub is the source of truth for execution status.

## Execution Rules

### Before Starting Work

1. You **MUST** confirm the GitHub Issue is open.
2. You **MUST** create a new branch from the latest default branch.
   - Branch format: `issue-[issue-number]-<short-description>`
3. You **MUST** open a **draft PR** against the default branch.
   - PR title should follow Conventional Commits, e.g., `fix: implement issue 37`.
   - Link the GitHub Issue in the PR description using `Closes #<issue-number>`.
4. You **MUST** ensure the task list in the GitHub Issue matches the local `/workstream/tasks-issue-[issue-number]-[issue-name].md` file.

### During Implementation

- You **MUST** execute **one sub-task at a time**.
- After each sub-task, you **MUST** mark it `[x]` in both the local task file and the GitHub Issue checklist.
- You **SHOULD** add brief issue comments for major milestones or changes.
- You **MUST** update the "Relevant Files" section if files change.

### Before Closing the Issue

1. All acceptance criteria **MUST** be verified.
2. All tests listed in the checklist **MUST** be completed.
3. The PR **MUST** be converted from draft to ready for review.
4. The PR **MUST** be approved by at least one reviewer.
5. The PR **MUST** be merged into the default branch.
6. You **MUST NOT** close the issue until all steps above are complete.

## Task List Discipline

- You **MUST NOT** start the next sub-task until the user says "yes".
- When all sub-tasks are `[x]`, you **MUST** mark the parent task as `[x]`.
- You **MUST** keep GitHub Issue and local task list aligned at all times.

## Output

- Keep changes and status updates in GitHub and `/workstream/tasks-issue-[issue-number]-[issue-name].md`.

## Final Instructions

1. You **MUST** always respect the task list execution order.
2. You **MUST** keep GitHub Issue updated with checklist and progress comments.
3. You **MUST** ensure branch, PR, and issue naming follow the repository guidelines.
4. You **MUST** stop after each sub-task and request user approval.
