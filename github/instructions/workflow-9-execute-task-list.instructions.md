---
applyTo: "**"
---
# Task List Management
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


Guidelines for managing task lists in markdown files to track progress on completing a PRD

## Task Implementation
- **One sub-task at a time:** You **MUST NOT** start the next sub‑task until you ask the user for permission and they say "yes" or "y"
- **Completion protocol:**  
  1. When you finish a **sub‑task**, immediately mark it as completed by changing `[ ]` to `[x]`.  
  2. If **all** subtasks underneath a parent task are now `[x]`, also mark the **parent task** as completed.  
- Stop after each sub‑task and wait for the user's go‑ahead.

## GitHub Execution Rules

When user stories are tracked in GitHub Issues, treat GitHub as the source of truth for execution status.

1. **Before starting a parent task (story):**
   - You **MUST** confirm the GitHub Issue exists and is open.
   - You **MUST** create a working branch linked to the issue (e.g., `story-<id>-short-title`).
   - You **MUST** open a draft Pull Request against the default branch and link the issue in the PR description.

2. **During implementation:**
   - You **MUST** use the task checklist in the GitHub Issue as the execution list.
   - You **MUST** keep the issue open while work is in progress.
   - As each sub-task is completed, you **MUST** update the checklist in the GitHub Issue to keep it in sync.
   - Add status updates to the issue or PR when meaningful progress is made (e.g., after completing a key sub-task).

3. **Before closing a story:**
   - You **MUST** ensure all acceptance criteria and tests are completed.
   - You **MUST** ensure the PR exists and is ready for review (convert draft to ready for review if needed).
   - The PR **MUST** be approved by at least one reviewer.
   - The PR **MUST** be merged into the default branch.
   - You **MUST NOT** close the GitHub Issue until the PR is approved AND merged. You **MUST NOT** close the issue while the PR is still in draft or pending review.

4. **If no issue exists:**
   - You **MUST** ask the user whether to create one (using MCP) before starting the work.
   - If a task list exists locally, publish it to the new issue before starting.

## Task List Maintenance

1. **Update the task list as you work:**
   - Mark tasks and subtasks as completed (`[x]`) per the protocol above.
   - Add new tasks as they emerge.

2. **Maintain the "Relevant Files" section:**
   - List every file created or modified.
   - Give each file a one‑line description of its purpose.

## AI Instructions

When working with task lists, the AI must:

1. You **MUST** regularly update the task list file after finishing any significant work.
2. Follow the completion protocol:
   - Mark each finished **sub‑task** `[x]`.
   - Mark the **parent task** `[x]` once **all** its subtasks are `[x]`.
3. Add newly discovered tasks.
4. Keep "Relevant Files" accurate and up to date.
5. You **MUST** check which sub‑task is next before starting work.
6. After implementing a sub‑task, you **MUST** update the file and then pause for user approval.
7. If a parent task maps to a GitHub Issue, follow the GitHub Execution Rules.
8. You **MUST** keep the local task list and the GitHub Issue checklist aligned when changes occur.
9. You **MUST NEVER** close a GitHub Issue without confirming: The PR has been reviewed and approved by at least one reviewer, and the PR has been successfully merged into the default branch.
10. You **MUST** notify the user when ready for PR review: once all tasks are complete and the PR is ready, explicitly inform the user so they can review and merge.
