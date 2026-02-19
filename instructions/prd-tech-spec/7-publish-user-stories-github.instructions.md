---
applyTo: "**"
---
# Rule: Publish User Stories to GitHub (MCP)

## Goal

To guide an AI assistant in taking a list of user stories and publishing them as GitHub Issues using MCP, so GitHub becomes the source of truth for execution tracking.

## Context

This step assumes the following documents already exist:
- `user-stories-[prd-name].md` - The comprehensive list of user stories

This step can be run after user stories are generated and before or during implementation planning.

## Process

1. **Receive Input:** The user provides the reference to the `user-stories-[prd-name].md` file and the GitHub repository target.
2. **Clarify Publishing Rules:** Ask for labeling, milestones, assignees, and any issue template constraints.
3. **Map Stories to Issues:** Create one GitHub Issue per user story.
4. **Publish via MCP:** Use MCP GitHub tooling to create the issues in the specified repo.
5. **Save Output:** Store a publication report with links to the created issues.

## Clarifying Questions

- "Which GitHub repository should I publish to? (owner/repo)"
- "Do you want labels, milestones, or assignees added?"
- "Should I use a specific issue template or format?"
- "Do you want a parent epic issue or project board association?"
- "Should I skip stories below a certain priority or size?"

## Issue Formatting Rules

Each GitHub Issue should be created using:

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

Create a publication report:

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
- **Location:** `/docs/`
- **Filename:** `github-user-stories-[prd-name].md`

## Final Instructions

1. Read the `user-stories` file.
2. Ask clarifying questions and confirm target repo.
3. Publish each story as a GitHub Issue using MCP.
4. Save the publication report with issue links.
5. Inform the user that GitHub is now the source of truth for execution tracking.
