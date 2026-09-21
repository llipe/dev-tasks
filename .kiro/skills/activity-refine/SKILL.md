---
name: activity-refine
description: "Clarify scope: produce a lightweight issue refinement or a full PRD. Use in product-engineer Feature or Issue Mode."
---

# Activity: Refine Scope

Clarify the scope, acceptance criteria, and constraints of a feature or issue before implementation begins. Produces a lightweight refinement for a GitHub Issue, or a full PRD for a new feature description. Invoked by the `product-engineer` agent in Issue Mode or Feature Mode.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Clarify the scope, acceptance criteria, and constraints of a feature or issue before implementation begins. This activity adapts to the input — it produces a **lightweight refinement** for a single GitHub Issue, or a **full PRD** for a new feature description.

## Context

This step assumes foundation documents exist:

- `product.md` — Understanding the overall product
- `tech.md` — Understanding technical constraints and patterns

If the user provides a **GitHub Issue number**, you **MUST** produce a lightweight refinement.
If the user provides a **feature description**, you **MUST** produce a full PRD.

Before drafting either output, this activity invokes the `activity-grill` sub-skill (WHAT phase for PRD Creation mode, Issue Mode for Issue Refinement mode) to walk the design tree to shared understanding, and writes every resolved question to `workstream/decisions-<feature>.md` — see Mode A and Mode B Process below.

---

## Document Changelog Convention

Every document produced by this activity **MUST** include a **Changelog** table as the **first section** after the document title. The changelog tracks the version history of the document.

- The initial version **MUST** be `1.0`.
- Every subsequent update **MUST** increment the minor version (e.g., `1.1`, `1.2`, …).
- Major structural rewrites **SHOULD** increment the major version (e.g., `2.0`).
- The **Author** column **MUST** include the name of the person or agent responsible for the change (e.g., `@username`, `developer-agent`, `planner-agent`).

```markdown
## Changelog

| Version | Date       | Summary         | Author             |
| ------- | ---------- | --------------- | ------------------ |
| 1.0     | YYYY-MM-DD | Initial version | @user / agent-name |
```

---

## Mode Detection

| Input                       | Mode                 | Output                             |
| --------------------------- | -------------------- | ---------------------------------- |
| GitHub Issue number + repo  | **Issue Refinement** | Lightweight refinement doc         |
| Feature description or idea | **PRD Creation**     | Full product requirements document |

---

## Mode A — Issue Refinement

### Process

1. **Receive Issue Reference:** User provides GitHub Issue number and repo.
2. **Read Issue:** Delegate to `github-ops` to fetch issue body, comments, labels, and status whenever possible.
3. **Invoke `activity-grill`:** Before asking any clarifying question, invoke `activity-grill(mode="issue", cap=cap.issue)` (`cap.issue` defaults to 8; read from `docs/tech.md` § Grilling if that subsection exists, else the hardcoded default) (FR-15, AC-09). The candidate questions below seed the interview's question pool — `activity-grill` owns the one-question-at-a-time, resolve-before-ask mechanics, including mandatory reuse of a matching answer from any prior `decisions-<other-feature>.md` (cited in qualified `<other-feature>#D-NN` form, not re-asked) and read-only glossary treatment (no new term proposals) for the duration of this invocation. You **MUST NOT** proceed to scope refinement until `activity-grill` returns the exit gate satisfied.
4. **Refine Scope:** Summarize scope, non-goals, risks, and dependencies, citing inline (`… (D-NN)`) every statement a decision shaped.
5. **Update GitHub Issue:** Delegate to `github-ops` to add or update a "Refined Scope" section in the issue body.
6. **Save Output.**

If `github-ops` delegation is unavailable in the current runtime, you **MUST** apply `github-ops` conventions directly and explicitly note that fallback in your status output.

### Candidate Clarifying Questions (seed the `activity-grill` interview; ask only what is missing)

- "What is the exact user-visible behavior change?"
- "What is explicitly out of scope?"
- "What are the acceptance criteria? (3-7 testable statements)"
- "Are there performance, security, or compatibility constraints?"
- "What is the definition of done?"
- "Are there related issues or dependencies?"

### Acceptance Criteria Quality Standard

Acceptance criteria in refinement outputs **MUST** be:

- specific and observable (user-visible behavior or measurable system behavior)
- testable with clear pass/fail outcomes
- mapped to at least one validation method (automated test or manual/UI check)
- inclusive of relevant edge-case behavior (error, boundary, and empty-state handling)

For each criterion, you **SHOULD** use a concise "Given / When / Then" style when it improves clarity.

### Output Structure

```markdown
# Issue Refinement: [Issue Number] - [Issue Title]

## Changelog

| Version | Date       | Summary            | Author             |
| ------- | ---------- | ------------------ | ------------------ |
| 1.0     | YYYY-MM-DD | Initial refinement | @user / agent-name |

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
- Edge-case checks:
- Acceptance-criteria-to-test mapping:

## Decisions

| ID   | Decision (short form) |
| ---- | ---------------------- |
| D-NN | …                       |

## Open Questions

- [Remaining unknowns]
```

The `## Decisions` table lists every decision ID `activity-grill` produced or reused that shaped this document (FR-14, AC-05) — the same shape this repository's own PRDs and specs already use. A refinement with zero decisions needed still runs the `activity-grill` interview and still requires the explicit exit-gate confirmation; the table may legitimately be empty in that case.

### Output

- **Location:** `/workstream/`
- **Filename:** `issue-[issue-number]-[issue-name]-refinement.md`

---

## Mode B — PRD Creation

### Process

1. **Receive Feature Scope:** User describes the features or feature set.
2. **Invoke `activity-grill`:** Before asking any clarifying question, invoke `activity-grill(phase="WHAT", cap=cap.what)` (`cap.what` defaults to 25; read from `docs/tech.md` § Grilling if that subsection exists, else the hardcoded default) (FR-12, AC-01). The candidate questions below seed the interview's question pool — `activity-grill` owns the one-question-at-a-time, resolve-before-ask mechanics and the decision-tree summary/cap cadence. You **MUST NOT** produce any PRD section, draft, or outline until `activity-grill` returns the exit gate satisfied.
3. **Reference Existing Documents:** Consider product context and technical guidelines.
4. **Generate PRD:** Cite inline (`… (D-NN)`) every requirement, goal, or scope statement a decision shaped.
5. **Save Output.**

### Candidate Clarifying Questions (seed the `activity-grill` interview)

- **Feature Title & Scope:** "What is the main feature? What is included?"
- **Affected Repositories:** "Which repositories will be affected by this feature? (e.g., `owner/repo-frontend`, `owner/repo-backend`)"
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

0. **Changelog** — Version history table (see Document Changelog Convention above)
1. **Executive Summary** — Feature overview and strategic importance (2-3 sentences)
2. **Feature Overview** — What the feature is and enables
3. **Goals & Objectives** — Specific, measurable goals
4. **Affected Repositories** — List of repositories impacted by this feature, with a brief description of the expected changes per repo (table format: Repo | Role / Impact)
5. **Target Users** — Primary and secondary personas
6. **User Stories** — 3-10 stories in "As a [role]..." format
7. **Functional Requirements** — Numbered list, explicit and unambiguous
8. **Business Rules** — Logic and policy constraints
9. **Data Requirements** — Entities, data collected/stored, sensitivity
10. **Non-Goals (Out of Scope)** — What this does NOT include
11. **Design Considerations** — Mockups, UI/UX patterns, accessibility
12. **Technical Considerations** — Dependencies, integrations, performance, alignment with technical guidelines
13. **Acceptance Criteria** — Clear, testable criteria
14. **Success Metrics** — How success is measured
15. **Assumptions** — Key assumptions
16. **Constraints & Dependencies** — Timeline, resource, external dependencies
17. **Security & Compliance** — Security, privacy, auth requirements
18. **Open Questions** — Ambiguities needing clarification
19. **Decisions** — Table (`ID | Decision (short form)`) listing every `activity-grill` decision ID consumed by this PRD (FR-14, AC-05); may legitimately be empty for a trivial feature that needed no decisions, but the `activity-grill` interview and exit-gate confirmation still ran

### Diagram Guidelines

The PRD **SHOULD** include embedded Mermaid diagrams to visually clarify relationships and processes. Use fenced code blocks with the `mermaid` language tag.

Recommended diagrams (include whichever add clarity — skip those that don't apply):

| Diagram Type                    | When to Include                                    | Suggested Section                           |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| **Component diagram**           | Feature spans multiple services, repos, or modules | Technical Considerations                    |
| **Entity-Relationship diagram** | Feature introduces or modifies data entities       | Data Requirements                           |
| **Sequence / Flow diagram**     | Key user or system interactions need clarification | Feature Overview or Functional Requirements |
| **User journey / Flowchart**    | Complex multi-step user workflows                  | User Stories or Design Considerations       |

Rules:

- Diagrams **MUST** be embedded inline in the relevant section, not collected at the end.
- Each diagram **SHOULD** have a brief introductory sentence explaining what it shows.
- Keep diagrams focused — one concern per diagram.
- Use consistent naming across diagrams and prose.

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
3. You **MUST** ask clarifying questions to fill gaps, conducted through `activity-grill` (WHAT phase for PRD Creation mode, Issue Mode for Issue Refinement mode) — you **MUST NOT** draft any part of the document until `activity-grill`'s exit gate returns satisfied (FR-12, FR-15).
4. You **MUST** present the document for user review.
5. You **SHOULD** iterate based on feedback.
6. You **MUST** save the finalized document.
7. In Issue Refinement mode, you **MUST** update the GitHub Issue with a "Refined Scope" section by delegating to `github-ops` whenever possible.
8. When updating an existing document, you **MUST** add a new row to the Changelog table with an incremented version, the current date, a summary of changes, and the responsible author/agent.
9. After producing the document, if the feature includes UI/UX scope (detected by keywords: UI, screen, page, form, modal, dialog, navigation, layout, component, responsive, accessibility), you **SHOULD** add the following recommendation to the user: "This feature has UI scope. **Recommended:** use `ux-engineer` (lite mode) to generate screen sketches before proceeding to spec/stories."
10. You **MUST** cite every decision that shaped a requirement or scope statement inline (`… (D-NN)`), and **MUST** populate the document's `## Decisions` section with every ID consumed from the `activity-grill` session, in qualified `<feature>#D-NN` form when reusing a decision from another feature's log (FR-14, AC-05).
