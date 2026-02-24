---
applyTo: "**"
---
# Rule: Refine Single GitHub Issue

## Goal

To guide an AI assistant in refining a single GitHub Issue into a clear, implementation-ready scope with explicit acceptance criteria, risks, and testing expectations. This is optimized for implementing one issue at a time (e.g., "implement issue 37").

## Context

This workflow assumes the issue already exists in GitHub and is the source of truth. The refinement step produces a short, structured document and updates the GitHub Issue so execution can begin with minimal ambiguity.

## Process

1. **Receive Issue Reference:** The user provides the GitHub Issue number and repo.
2. **Read Issue:** Use MCP to fetch the issue body, comments, labels, and status.
3. **Ask Clarifying Questions:** Focus on missing scope, acceptance criteria, and constraints.
4. **Refine Scope:** Summarize scope, non-goals, risks, and dependencies.
5. **Update GitHub Issue:** Add or update a "Refined Scope" section in the issue body.
6. **Save Output:** Save a refinement doc in `/docs` and update issue in GitHub.

## Clarifying Questions

Ask only what is missing from the issue:

- "What is the exact user-visible behavior change?"
- "What is explicitly out of scope?"
- "What are the acceptance criteria? (3-7 testable statements)"
- "Are there performance, security, or compatibility constraints?"
- "What is the definition of done for this issue?"
- "Are there related issues or dependencies?"

## Output Structure

Create a refinement doc with the following structure:

```markdown
# Issue Refinement: [Issue Number] - [Issue Title]

## Summary
- Goal:
- Primary user impact:
- Non-goals:

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Constraints
- [Performance/compatibility/security constraints]

## Risks and Edge Cases
- [Risk 1]
- [Edge case 1]

## Dependencies
- [Related issues, services, or teams]

## Testing Notes
- Unit tests:
- Integration tests:
- Manual checks:

## Open Questions
- [Remaining unknowns]
```

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/workstream/`
- **Filename:** `issue-[issue-number]-[issue-name]-refinement.md`

## Final Instructions

1. Do NOT start implementation.
2. Ask clarifying questions if acceptance criteria or scope is unclear.
3. Update the GitHub Issue with a "Refined Scope" section and the agreed acceptance criteria.
4. Save the refinement doc in `/workstream/` and present it for review.
