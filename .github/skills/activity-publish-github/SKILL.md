# Activity: Publish to GitHub

Publish user stories as GitHub Issues so GitHub becomes the source of truth for execution tracking. Use this skill after stories are approved. Invoked by the `product-engineer` agent in Feature Mode.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Take a list of user stories and publish them as GitHub Issues using the `gh` CLI, under one PRD tracking issue and one wave tracking issue, so GitHub becomes the source of truth for execution tracking and a GitHub Project can show the hierarchy and per-wave progress with no extra work.

## Context

This activity assumes the following documents exist:

- `user-stories-[prd-name].md` — The comprehensive list of user stories (produced by the **generate-stories** activity)
- `docs/roadmap.md` — The roadmap row for this PRD; its `Phase/Wave` cell is the wave `<id>` used in the wave tracking issue title (github-ops § Title Format)

## Process

1. **Receive Input:** User provides the reference to the user stories file and the GitHub repository target.
2. **Clarify Publishing Rules:** You **MUST** ask for labeling, milestones, assignees, and any issue template constraints, and you **MUST** align them with `github-ops` conventions.
3. **Find or Create the Tracking Issues:** Before any story is created, you **MUST** find or create the PRD tracking issue, then the wave tracking issue. Each is found by its `level:` label plus its title prefix (the title forms are defined by github-ops § Title Format); nothing is stored in a workstream file.
   - PRD: `gh issue list --label "level: prd" --search "[PRD-<name>] in:title" --state open --json number,title --jq 'map(select(.title | startswith("[PRD-<name>]")))'`
   - Wave: `gh issue list --label "level: wave" --search "[PRD-<name>] Wave <id>: in:title" --state open --json number,title --jq 'map(select(.title | startswith("[PRD-<name>] Wave <id>:")))'`
   - The `--jq` filter is applied client-side before counting, because GitHub's `in:title` search tokenises brackets and hyphens leniently and can return siblings such as `[PRD-<name>-v2]`.
   - Exactly one match: reuse that issue number. Zero matches: create the issue with `gh issue create --title ... --label "level: prd" --body-file <path>` (or `level: wave`); tracking issues carry their `level:` label only, never `type:` or `priority:`. More than one match: stop, list the matching issue numbers, and ask the user which one to keep; never pick one silently.
   - The PRD issue body follows the PRD tracking issue template and the wave issue body the wave tracking issue template, both under Issue Formatting Rules.
4. **Map Stories to Issues:** You **MUST** create one GitHub Issue per user story, labeled `level: story` plus its `type:` and `priority:` labels.
5. **Publish to GitHub:** You **MUST** delegate issue creation and metadata application to `github-ops` whenever possible. After each story issue is created, you **MUST** attach it as a sub-issue of the wave issue (see Sub-issue Hierarchy).
6. **Attach and Verify the Hierarchy:** After all stories are created, attach the wave under the PRD issue if not already attached, read both `sub_issues` lists back, and record the `hierarchy:` result in the publication report.
7. **Save Output.**

Execution method rules:

- The `gh` CLI is the primary execution path for every call in this activity.
- A GitHub MCP server is optional; if one is configured in this session, it **MAY** be used instead.
- The selected method (`gh-cli` or `github-mcp`) **MUST** be recorded in the publication report.

If `github-ops` delegation is unavailable in the current runtime, you **MUST** apply `github-ops` issue, label, milestone, and comment conventions directly and explicitly note that fallback in your status output.

Attribution rules:

- Any PR creation or issue closure performed during this workflow **MUST** include `Assisted-by: <assistant name and version>` in the corresponding PR body or closing comment.

## Clarifying Questions

- "Which GitHub repository should I publish to? (`owner/repo`)"
- "Do you want labels, milestones, or assignees added?"
- "Should I use a specific issue template or format?"
- "Should I skip stories below a certain priority or size?"

The tracking-issue hierarchy is not optional, so no question asks for it.

## Issue Formatting Rules

### Story issues

Each story GitHub Issue **MUST** be created using:

- **Title:** the `PRD story` row of github-ops § Title Format
- **Body:**
  - User Story (role, goal, benefit)
  - Context
  - Acceptance Criteria (checklist)
  - Acceptance-Criteria-to-Test Mapping
  - Business Rules
  - Technical Notes
  - Testing Requirements
  - Quality Gate Commands (`lint`, `format:check`, `typecheck`, `test`, `audit`, optionally `validate`)
  - Implementation Steps
  - Migration Plan (when schema/data-model changes apply): artifact, rollback notes, confirmation gate before apply, verification step
  - Files to Create/Modify
  - Definition of Done Checklist
  - Open Questions

For JS/TS projects, command examples in issues **MUST** prefer `pnpm` and canonical scripts (`pnpm run <script>`).

### PRD tracking issue body

The PRD issue body is the entry point to the whole PRD: its title line, a link to the PRD file and to its `docs/roadmap.md` row, and the list of waves. It carries no checkboxes, because progress lives in the issue's status comment (github-ops § Status comment) and in the sub-issue progress GitHub derives from the hierarchy. Each wave line is added, or its issue number filled in, by the publish run that creates that wave's tracking issue.

```markdown
# <PRD title>

PRD: [docs/requirements/prd-<prd-name>.md](/docs/requirements/prd-<prd-name>.md)
Roadmap: [docs/roadmap.md](/docs/roadmap.md)

## Waves

- Wave <id>: #<wave-issue> — <wave title>
```

### Wave tracking issue body

The wave issue body carries the wave's scope and its artifacts; it carries no checkboxes, because progress lives in the issue's status comment (github-ops § Status comment) and in the sub-issue progress GitHub derives from the hierarchy. `Integration branch` stays `TBD` until the planner starts the run; `Task plan` stays `pending` until the task list exists.

```markdown
Scope: <the wave's scope line from the PRD's delivery table>
Integration branch: TBD

## Artifacts

- Specification: [workstream/specification-<prd-name>.md](/workstream/specification-<prd-name>.md)
- Stories: [workstream/user-stories-<prd-name>.md](/workstream/user-stories-<prd-name>.md)
- Task plan: pending

## Stories

- S-001: <title>
- S-002: <title>
```

### Sub-issue hierarchy

Stories are sub-issues of the wave issue, and the wave issue is a sub-issue of the PRD issue. Every call is REST through `gh api` with `repo` scope:

- Child numeric id: `gh api repos/{o}/{r}/issues/{n} --jq .id` (the sub-issue endpoint takes the numeric id, not the issue number).
- Attach a story under the wave, immediately after the story is created: `gh api -X POST repos/{o}/{r}/issues/{wave}/sub_issues -F sub_issue_id=<id>`.
- Attach the wave under the PRD with the same call against `issues/{prd}/sub_issues`, if not already listed there.
- Verify: `gh api repos/{o}/{r}/issues/{wave}/sub_issues --jq '.[].number'` lists every story created in this run, and the PRD's list contains the wave.
- Report `hierarchy: verified(<n> of <n>)` when every attach is confirmed, or `hierarchy: failed(<reason>)` naming the first failed attach. A failed attach is reported, never retried silently, and never stops the remaining stories from being created.

Every issue body goes through `--body-file <path>`; inline `--body` is blocked by git-guard.

All issue formatting and metadata **MUST** conform to `github-ops` conventions.

## Output Structure

You **MUST** create a publication report:

```markdown
# GitHub Publication Report: [PRD Name]

## Target Repository

- Repo: owner/repo
- Date: YYYY-MM-DD

## Tracking Issues

- PRD issue: #<number> (reused | created)
- Wave issue: #<number> (reused | created)
- Hierarchy: verified(<n> of <n>) | failed(<reason>)

## Created Issues

| Story ID | Story Title | Issue URL                                | Labels        | Milestone | Assignee |
| -------- | ----------- | ---------------------------------------- | ------------- | --------- | -------- |
| S-001    | [Title]     | https://github.com/owner/repo/issues/123 | backend, auth | v1        | @user    |
| ...      | ...         | ...                                      | ...           | ...       | ...      |

## Notes

- Any skipped stories and why
- Any template or permission limitations
- Any manual follow-up needed
- Execution method used: `gh-cli` or `github-mcp`
- Assisted-by value used for PR creation/issue closure (if applicable)
```

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/workstream/`
- **Filename:** `github-publication-[prd-name].md`

## Final Instructions

1. You **MUST** read the user stories file.
2. You **MUST** ask clarifying questions and confirm the target repo.
3. You **MUST** find or create the PRD and wave tracking issues before publishing any story; more than one match stops the run.
4. You **MUST** publish each story as a GitHub Issue by delegating to `github-ops` whenever possible, and attach it as a sub-issue of the wave issue.
5. You **MUST** attach the wave under the PRD issue, verify the hierarchy, and record the `hierarchy:` result.
6. You **MUST** save the publication report with the tracking issue numbers and issue links.
7. You **MUST** inform the user that GitHub is now the source of truth for execution tracking.
