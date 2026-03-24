---
applyTo: "**"
---
# Activity: Publish to GitHub
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

Take a list of user stories and publish them as GitHub Issues using MCP, so GitHub becomes the source of truth for execution tracking.

## Context

This activity assumes the following document exists:
- `user-stories-[prd-name].md` — The comprehensive list of user stories (produced by the **generate-stories** activity)

## Process

1. **Receive Input:** User provides the reference to the user stories file and the GitHub repository target.
2. **Clarify Publishing Rules:** You **MUST** ask for labeling, milestones, assignees, and any issue template constraints.
3. **Map Stories to Issues:** You **MUST** create one GitHub Issue per user story.
4. **Publish via MCP:** You **MUST** use MCP GitHub tooling to create the issues in the specified repo.
5. **Save Output.**

## Clarifying Questions

- "Which GitHub repository should I publish to? (`owner/repo`)"
- "Do you want labels, milestones, or assignees added?"
- "Should I use a specific issue template or format?"
- "Do you want a parent epic issue or project board association?"
- "Should I skip stories below a certain priority or size?"

## Issue Formatting Rules

Each GitHub Issue **MUST** be created using:

- **Title:** `Story [ID]: [Title]`
- **Body:**
  - User Story (role, goal, benefit)
  - Context
  - Acceptance Criteria (checklist)
  - Business Rules
  - Technical Notes
  - Testing Requirements
  - Implementation Steps
  - Files to Create/Modify
  - Definition of Done Checklist
  - Open Questions

## Output Structure

You **MUST** create a publication report:

```markdown
# GitHub Publication Report: [PRD Name]

## Target Repository
- Repo: owner/repo
- Date: YYYY-MM-DD

## Created Issues

| Story ID | Story Title | Issue URL | Labels | Milestone | Assignee |
|----------|-------------|----------|--------|-----------|----------|
| S-001 | [Title] | https://github.com/owner/repo/issues/123 | backend, auth | v1 | @user |
| ... | ... | ... | ... | ... | ... |

## Notes
- Any skipped stories and why
- Any template or permission limitations
- Any manual follow-up needed
```

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/workstream/`
- **Filename:** `github-publication-[prd-name].md`

## Final Instructions

1. You **MUST** read the user stories file.
2. You **MUST** ask clarifying questions and confirm the target repo.
3. You **MUST** publish each story as a GitHub Issue using MCP.
4. You **MUST** save the publication report with issue links.
5. You **MUST** inform the user that GitHub is now the source of truth for execution tracking.
