---
applyTo: "**"
---
# Rule: Execute Single-Issue Task List

## Goal

To guide an AI assistant in implementing a single GitHub Issue using the task list checklist, with strict step-by-step execution, proper branching, PR workflow, and issue updates.

## Context

This step assumes:
- The GitHub Issue exists and includes a checklist.
- The task list file exists at `/docs/tasks-issue-[issue-number]-[issue-name].md`.
- GitHub is the source of truth for execution status.

## Execution Rules

### Before Starting Work

1. Confirm the GitHub Issue is open.
2. Create a new branch from the latest default branch.
   - Branch format: `issue-[issue-number]-<short-description>`
3. Open a **draft PR** against the default branch.
   - PR title should follow Conventional Commits, e.g., `fix: implement issue 37`.
   - Link the GitHub Issue in the PR description using `Closes #<issue-number>`.
4. Ensure the task list in the GitHub Issue matches the local `/docs/tasks-issue-[issue-number]-[issue-name].md` file.

### During Implementation

- Execute **one sub-task at a time**.
- After each sub-task, mark it `[x]` in both the local task file and the GitHub Issue checklist.
- Add brief issue comments for major milestones or changes.
- Update the "Relevant Files" section if files change.

### Before Closing the Issue

1. All acceptance criteria are verified.
2. All tests listed in the checklist are completed.
3. The PR is converted from draft to ready for review.
4. The PR is approved by at least one reviewer.
5. The PR is merged into the default branch.
6. **Only then** close the issue.

## Task List Discipline

- Do not start the next sub-task until the user says "yes".
- When all sub-tasks are `[x]`, mark the parent task as `[x]`.
- Keep GitHub Issue and local task list aligned at all times.

## Output

- Keep changes and status updates in GitHub and `/docs/tasks-issue-[issue-number].md`.

## Final Instructions

1. Always respect the task list execution order.
2. Keep GitHub Issue updated with checklist and progress comments.
3. Ensure branch, PR, and issue naming follow the repository guidelines.
4. Stop after each sub-task and request user approval.
