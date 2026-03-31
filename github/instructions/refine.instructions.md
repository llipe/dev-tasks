---
applyTo: "**"
---
# Activity: Refine Scope
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

Clarify the scope, acceptance criteria, and constraints of a feature or issue before implementation begins. This activity adapts to the input — it produces a **lightweight refinement** for a single GitHub Issue, or a **full PRD** for a new feature description.

## Context

This step assumes foundation documents exist:
- `product-context.md` — Understanding the overall product
- `technical-guidelines.md` — Understanding technical constraints and patterns

If the user provides a **GitHub Issue number**, you **MUST** produce a lightweight refinement.
If the user provides a **feature description**, you **MUST** produce a full PRD.

---

## Mode Detection

| Input | Mode | Output |
|-------|------|--------|
| GitHub Issue number + repo | **Issue Refinement** | Lightweight refinement doc |
| Feature description or idea | **PRD Creation** | Full product requirements document |

---

## Mode A — Issue Refinement

### Process

1. **Receive Issue Reference:** User provides GitHub Issue number and repo.
2. **Read Issue:** Delegate to `github-ops` to fetch issue body, comments, labels, and status whenever possible.
3. **Ask Clarifying Questions:** Focus on missing scope, acceptance criteria, and constraints.
4. **Refine Scope:** Summarize scope, non-goals, risks, and dependencies.
5. **Update GitHub Issue:** Delegate to `github-ops` to add or update a "Refined Scope" section in the issue body.
6. **Save Output.**

If `github-ops` delegation is unavailable in the current runtime, you **MUST** apply `github-ops` conventions directly and explicitly note that fallback in your status output.

### Clarifying Questions (ask only what is missing)

- "What is the exact user-visible behavior change?"
- "What is explicitly out of scope?"
- "What are the acceptance criteria? (3-7 testable statements)"
- "Are there performance, security, or compatibility constraints?"
- "What is the definition of done?"
- "Are there related issues or dependencies?"

### Output Structure

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

### Output
- **Location:** `/workstream/`
- **Filename:** `issue-[issue-number]-[issue-name]-refinement.md`

---

## Mode B — PRD Creation

### Process

1. **Receive Feature Scope:** User describes the features or feature set.
2. **Ask Clarifying Questions:** Gather detail about requirements, prioritization, and acceptance criteria.
3. **Reference Existing Documents:** Consider product context and technical guidelines.
4. **Generate PRD.**
5. **Save Output.**

### Clarifying Questions

- **Feature Title & Scope:** "What is the main feature? What is included?"
- **Problem/Goal:** "What problem does this feature solve? How does it align with product goals?"
- **Target User:** "Who is the primary user?"
- **User Stories:** "Main user stories? (As a [role], I want [goal] so that [benefit])"
- **Functional Requirements:** "What specific functions must this feature support?"
- **Acceptance Criteria:** "What are the success criteria?"
- **Priority & Scope:** "Priority? Explicitly excluded features?"
- **Data Requirements:** "What data is required?"
- **Business Rules:** "Specific business rules or constraints?"
- **UI/UX Expectations:** "Mockups, wireframes, or design direction?"
- **Edge Cases:** "Edge cases or error conditions?"

### Output Structure

1. **Executive Summary** — Feature overview and strategic importance (2-3 sentences)
2. **Feature Overview** — What the feature is and enables
3. **Goals & Objectives** — Specific, measurable goals
4. **Target Users** — Primary and secondary personas
5. **User Stories** — 3-10 stories in "As a [role]..." format
6. **Functional Requirements** — Numbered list, explicit and unambiguous
7. **Business Rules** — Logic and policy constraints
8. **Data Requirements** — Entities, data collected/stored, sensitivity
9. **Non-Goals (Out of Scope)** — What this does NOT include
10. **Design Considerations** — Mockups, UI/UX patterns, accessibility
11. **Technical Considerations** — Dependencies, integrations, performance, alignment with technical guidelines
12. **Acceptance Criteria** — Clear, testable criteria
13. **Success Metrics** — How success is measured
14. **Assumptions** — Key assumptions
15. **Constraints & Dependencies** — Timeline, resource, external dependencies
16. **Security & Compliance** — Security, privacy, auth requirements
17. **Open Questions** — Ambiguities needing clarification

### Scope Guidance

- A PRD **SHOULD** define a coherent feature set deliverable in 1-3 iterations.
- Total user stories **SHOULD NOT** exceed 50.
- If scope is too large, you **SHOULD** break it into multiple PRDs.

### Output
- **Location:** `/docs/requirements/`
- **Filename:** `prd-[feature-name].md`

---

## Final Instructions

1. You **MUST NOT** start implementing anything.
2. You **MUST** detect the mode based on user input (issue number vs. feature description).
3. You **MUST** ask clarifying questions to fill gaps.
4. You **MUST** present the document for user review.
5. You **SHOULD** iterate based on feedback.
6. You **MUST** save the finalized document.
7. In Issue Refinement mode, you **MUST** update the GitHub Issue with a "Refined Scope" section by delegating to `github-ops` whenever possible.
