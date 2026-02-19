---
applyTo: "**"
---
# Task List Management

Guidelines for managing task lists in markdown files to track progress on completing a PRD

## Task Implementation
- **One sub-task at a time:** Do **NOT** start the next sub‑task until you ask the user for permission and they say "yes" or "y"
- **Completion protocol:**  
  1. When you finish a **sub‑task**, immediately mark it as completed by changing `[ ]` to `[x]`.  
  2. If **all** subtasks underneath a parent task are now `[x]`, also mark the **parent task** as completed.  
- Stop after each sub‑task and wait for the user's go‑ahead.

## GitHub Execution Rules

When user stories are tracked in GitHub Issues, treat GitHub as the source of truth for execution status.

1. **Before starting a parent task (story):**
   - Confirm the GitHub Issue exists and is open.
   - Create a working branch linked to the issue (e.g., `story-<id>-short-title`).
   - Open a draft Pull Request against the default branch and link the issue in the PR description.

2. **During implementation:**
   - Use the task checklist in the GitHub Issue as the execution list.
   - Keep the issue open while work is in progress.
   - As each sub-task is completed, update the checklist in the GitHub Issue to keep it in sync.
   - Add status updates to the issue or PR when meaningful progress is made (e.g., after completing a key sub-task).

3. **Before closing a story:**
   - Ensure all acceptance criteria and tests are completed.
   - Ensure the PR exists and is ready for review (draft may be converted to ready).
   - Only close the GitHub Issue after the PR is opened and the story is fully complete.

4. **If no issue exists:**
   - Ask the user whether to create one (using MCP) before starting the work.
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

1. Regularly update the task list file after finishing any significant work.
2. Follow the completion protocol:
   - Mark each finished **sub‑task** `[x]`.
   - Mark the **parent task** `[x]` once **all** its subtasks are `[x]`.
3. Add newly discovered tasks.
4. Keep "Relevant Files" accurate and up to date.
5. Before starting work, check which sub‑task is next.
6. After implementing a sub‑task, update the file and then pause for user approval.
7. If a parent task maps to a GitHub Issue, follow the GitHub Execution Rules.
8. Keep the local task list and the GitHub Issue checklist aligned when changes occur.
