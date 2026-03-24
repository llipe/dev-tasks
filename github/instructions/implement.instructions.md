---
applyTo: "**"
---
# Activity: Implement Task List
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

Execute a task list step-by-step with strict sequencing, proper branching, PR workflow, GitHub Issue synchronization, and user approval gates.

This is the **single source of truth** for execution rules. All agents and workflows that perform implementation **MUST** follow these rules.

## Context

This activity assumes:
- A task list file exists in `/workstream/tasks-*.md`.
- The corresponding GitHub Issue exists and includes a checklist.
- GitHub is the source of truth for execution status.

---

## Before Starting Work

1. You **MUST** confirm the GitHub Issue is open.
2. You **MUST** create a new branch from the latest default branch.
   - Branch format: `issue-[issue-number]-<short-description>` or `story-[id]-<short-description>`
3. You **MUST** open a **draft Pull Request** against the default branch.
   - PR title **MUST** follow Conventional Commits (e.g., `feat: implement issue 37`).
   - PR description **MUST** include `Closes #<issue-number>`.
4. You **MUST** ensure the task list in the GitHub Issue matches the local `/workstream/tasks-*.md` file.

---

## During Implementation

### Step-by-Step Execution

- You **MUST** execute **one sub-task at a time**.
- You **MUST NOT** start the next sub-task until the user grants permission (says "yes" or "y").
- After completing each sub-task, you **MUST** immediately:
  1. Mark it `[x]` in the local task file.
  2. Mark it `[x]` in the GitHub Issue checklist.
  3. Stop and wait for user approval before proceeding.

### Parent Task Completion

- When **all** sub-tasks under a parent task are `[x]`, you **MUST** also mark the **parent task** as `[x]`.

### Task List Maintenance

- You **MUST** regularly update the task list file after finishing significant work.
- You **MUST** add newly discovered tasks as they emerge.
- You **MUST** keep the "Relevant Files" section accurate and up to date with every file created or modified.
- You **MUST** keep the local task list and the GitHub Issue checklist aligned at all times.
- If drift is detected between local and GitHub, you **MUST** reconcile immediately and report the reconciliation.

### Progress Updates

- You **SHOULD** add brief issue or PR comments for major milestones or meaningful changes.

---

## Before Closing a Story/Issue

1. All acceptance criteria **MUST** be verified.
2. All tests listed in the checklist **MUST** be completed and passing.
3. The PR **MUST** be converted from draft to ready for review.
4. The PR **MUST** be approved by at least one reviewer.
5. The PR **MUST** be merged into the default branch.
6. You **MUST NOT** close the GitHub Issue until the PR is approved **AND** merged.
7. You **MUST NOT** close the issue while the PR is still in draft or pending review.
8. You **MUST** notify the user when the PR is ready for review — explicitly inform them so they can review and merge.

---

## GitHub Execution Rules Summary

| Phase | Rule |
|-------|------|
| **Before coding** | Confirm issue open → Create branch → Open draft PR → Sync checklists |
| **During coding** | One sub-task at a time → Mark `[x]` locally + GitHub → Wait for approval |
| **Before closing** | All ACs verified → Tests pass → PR ready → Approved → Merged → Then close issue |

---

## Output

- Keep all changes and status updates in GitHub and `/workstream/tasks-*.md`.
- You **MUST** check which sub-task is next before starting work.
- After implementing a sub-task, you **MUST** update the file and then pause for user approval.

## Final Instructions

1. You **MUST** always respect the task list execution order.
2. You **MUST** keep the GitHub Issue updated with checklist and progress comments.
3. You **MUST** ensure branch, PR, and issue naming follow repository guidelines.
4. You **MUST** stop after each sub-task and request user approval.
5. You **MUST NOT** close a GitHub Issue without confirming the PR has been reviewed, approved, and merged.
