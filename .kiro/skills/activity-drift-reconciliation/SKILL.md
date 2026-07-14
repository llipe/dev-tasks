---
name: activity-drift-reconciliation
description: "Routes verifier drift findings into task-list/GitHub-checklist expansion, new-issue creation, or PRD/spec changelog write-back with a human-confirmation gate. Use when a verifier fidelity report (Design or Audit Mode) surfaces drift that needs to be acted on."
---

# Activity: Drift Reconciliation

Take a `verifier` fidelity report (Audit Mode) or PRD-level rollup audit and route each drift finding to the correct destination — an expanded task list, a new GitHub issue, a PRD/spec changelog update, or a new follow-up issue for a closed scope — without ever blocking the PR/issue completion that triggered the audit. Invoked by the `product-engineer` agent whenever `developer` or `planner` hands off drift findings from a mandatory `verifier` audit.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Given a `verifier` drift catalog (per-item impact class, intent class, and evidence), decide and execute the correct reconciliation path for each item, so drift is never silently dropped and never silently blocks completion.

## Context

This activity assumes:

- A `/workstream/fidelity-report-{issue-or-story-id}.md` produced by `verifier` in Audit Mode exists, or a rollup report from a `planner` Phase 5 run.
- The drift catalog in that report classifies every item by **impact** (`Critical`/`Major`/`Minor`) and **intent** (`Intended`/`Unintended`/`Undetermined`).
- The originating task list (`/workstream/tasks-*.md`) and GitHub Issue for the current scope are known.
- `developer` or `planner` has already reached (or passed) its own completion gate — this activity runs **after** that gating decision, never before it, and its outcome never reopens or blocks that gate.

## Non-Negotiable Operating Rules

1. **Non-blocking, always:** Reconciliation **MUST NOT** be used to block, reopen, or gate PR/issue completion. It is a post-hoc write-back activity only.
2. **Route by intent first, then scope:** Every drift item **MUST** be classified by intent (`Intended`/`Unintended`/`Undetermined`) before deciding a destination. `Undetermined` items **MUST** be escalated to a human as a clarifying question before routing — do not guess.
3. **Human confirmation gate for Intended drift:** You **MUST NOT** update a PRD or spec for Intended drift without an explicit human confirmation step. No new task is created for Intended drift.
4. **Active task list expansion:** For Unintended drift against a task list that is still open/active, you **MUST** expand `/workstream/tasks-*.md` with new sub-task(s) and update the GitHub Issue checklist to match — the GitHub Issue and local file **MUST** stay in sync.
5. **New issue for out-of-scope drift:** For Unintended drift that warrants tracking beyond the current task's scope, you **MUST** delegate to `github-ops` to create a new GitHub issue/sub-task, cross-referenced to the originating issue.
6. **Closed-scope drift never reopens:** For drift found against an already-closed/merged task list or issue (including a PRD-level rollup after a consolidated PR), you **MUST** open a new follow-up issue/task list rather than reopening the closed one.
7. **Changelog discipline:** Any PRD/spec update resulting from Intended drift **MUST** include an incremented changelog entry (version, date, summary, author) in that document.
8. **Traceability:** Every routed drift item **MUST** be traceable back to its source fidelity report and AC (or `N/A` for out-of-scope/rollup-only findings).
9. **English-only outputs:** All new tasks, issue bodies, comments, and changelog entries **MUST** be in English.

## Process

### Step 1 — Intake

Read the fidelity report (or rollup report). For each drift catalog item, extract:

- `drift_id`, `AC(s)` affected (or `N/A`)
- Impact class (`Critical`/`Major`/`Minor`)
- Intent class (`Intended`/`Unintended`/`Undetermined`)
- Evidence source(s) cited by `verifier`
- Originating scope: issue/story task list path + GitHub issue number, and whether that scope is still open or already closed/merged

### Step 2 — Classify Undetermined Items

For any item classified `Undetermined` by `verifier`, ask the user one focused clarifying question per item (or a batched question if several share context) to resolve intent before proceeding. Do not route an `Undetermined` item until it is resolved to `Intended` or `Unintended`.

### Step 3 — Route Each Item

Apply this decision table in order:

| Condition                                                                                | Route                                                                                             | AC Reference |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------ |
| Intended drift                                                                           | Human-confirmation gate → PRD/spec changelog update (Step 4). No new task.                        | AC-5         |
| Unintended drift, originating task list/issue still open                                 | Expand `/workstream/tasks-*.md` with new sub-task(s); sync GitHub Issue checklist (Step 5)        | AC-3         |
| Unintended drift, warrants tracking beyond current task scope                            | Create new GitHub issue/sub-task via `github-ops`, cross-referenced to originating issue (Step 6) | AC-4         |
| Drift found against an already-closed/merged task list or issue (e.g., PRD-level rollup) | Open a new follow-up issue/task list; do not reopen the closed one (Step 7)                       | AC-6         |

A single audit run may produce items routed to more than one path — process each item independently through this table.

### Step 4 — Intended Drift → Human-Confirmed PRD/Spec Update

1. Present the drift item (what changed, why it appears intentional, evidence) to the human and ask for explicit confirmation: _"Confirm this is an intentional deviation from the PRD/spec — update the document? (y/n)"_
2. If declined, re-classify as `Unintended` and re-route via Step 3.
3. If confirmed:
   - Update the relevant PRD and/or spec section to reflect the confirmed behavior.
   - Add a changelog row: `| <version+1> | <date> | <summary of what changed and why> | product-engineer |`.
   - **MUST NOT** create a new task for this item.
   - Record the confirmation (who/when) in the changelog summary or a linked comment.

### Step 5 — Unintended Drift, Active Task List

1. Add new sub-task(s) to the correct parent task in `/workstream/tasks-*.md`, following the existing numbering convention (e.g., `N.x`).
2. Update the corresponding GitHub Issue checklist with the same new sub-task(s), keeping wording identical between the two.
3. Note the originating drift item ID in the new sub-task text so the fix is traceable back to the fidelity report.
4. Hand off the new sub-task(s) to `developer` for execution through the normal `implement` flow — this activity does not implement the fix itself.

### Step 6 — Unintended Drift, Beyond Current Task Scope

1. Delegate to `github-ops` to create a new GitHub issue using standard issue conventions (title format, Summary, Acceptance Criteria).
2. The new issue body **MUST** cross-reference the originating issue (`Refs #<originating-issue-number>`) and cite the drift item and AC from the fidelity report.
3. If the new issue is large enough to need its own task list, hand off to the `plan` activity to generate one — this activity only creates the issue, it does not itself plan the fix.

### Step 7 — Drift Against a Closed/Merged Scope

1. Confirm the originating task list/issue state is closed or merged (do not proceed on an assumption — check GitHub issue state and/or task-list completion markers).
2. Create a new GitHub issue and a new `/workstream/tasks-*.md` follow-up task list scoped to the drift item(s) only.
3. Cross-reference the closed issue/PR in the new issue body (`Follow-up to #<closed-issue-number>`, `Refs PR #<merged-pr-number>`).
4. **MUST NOT** reopen the closed issue or reopen/merge into the closed task list.

## Output

Reconciliation summary returned to the caller (`developer`, `planner`, or the user):

```markdown
# Drift Reconciliation Summary — [scope]

Source fidelity report: /workstream/fidelity-report-{id}.md

## Routed Items

| Drift ID | Impact   | Intent     | Route                      | Destination                                 |
| -------- | -------- | ---------- | -------------------------- | ------------------------------------------- |
| D-1      | Minor    | Unintended | Active task list expansion | tasks-issue-42.md #3.5, Issue #42 checklist |
| D-2      | Major    | Intended   | PRD/spec changelog update  | spec-checkout.md v1.3                       |
| D-3      | Critical | Unintended | New issue                  | Issue #58 (Refs #42)                        |
| D-4      | Minor    | Unintended | Follow-up (closed scope)   | Issue #59 + tasks-issue-59.md               |

## Escalations

- Undetermined items resolved: <list, or none>

## Non-Blocking Confirmation

This reconciliation pass ran after [developer/planner]'s completion gate and did not block or reopen it.
```

## Final Instructions

1. You **MUST** classify every drift item by intent before routing it — resolve `Undetermined` first.
2. You **MUST NOT** create a new task for Intended drift, and you **MUST NOT** update the PRD/spec for Intended drift without explicit human confirmation.
3. You **MUST** keep the local task file and the GitHub Issue checklist in sync whenever you expand an active task list.
4. You **MUST** delegate new-issue creation to `github-ops` and follow its conventions (title format, labels, cross-referencing).
5. You **MUST NOT** reopen a closed/merged issue or task list — open a new follow-up instead.
6. You **MUST** confirm and state that this activity never blocks or reopens the completion gate that triggered it.
7. You **MUST** return the reconciliation summary in the format above.
