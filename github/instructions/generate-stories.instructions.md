---
applyTo: "**"
---
# Activity: Generate User Stories
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

Create structured, implementation-ready User Stories from a Technical Specification, then validate that all PRD requirements are covered. Each user story **MUST** provide value independently, fit into a single Pull Request, and contain the detail needed for implementation.

This activity combines story generation and coverage validation into a single pass.

## Context

This activity assumes the following documents already exist:
- `prd-[feature-name].md` — Feature requirements
- `specification-[prd-name].md` — Technical specification

## Document Changelog Convention

The user stories document **MUST** include a **Changelog** table as the **first section** after the document title. The changelog tracks the version history of the document.

- The initial version **MUST** be `1.0`.
- Every subsequent update **MUST** increment the minor version (e.g., `1.1`, `1.2`, …).
- Major structural rewrites **SHOULD** increment the major version (e.g., `2.0`).
- The **Author** column **MUST** include the name of the person or agent responsible for the change (e.g., `@username`, `developer-agent`, `planner-agent`).

```markdown
## Changelog

| Version | Date       | Summary                  | Author              |
|---------|------------|--------------------------|----------------------|
| 1.0     | YYYY-MM-DD | Initial version          | @user / agent-name   |
```

## Process

1. **Receive Specification:** User provides reference to the Technical Specification document.
2. **Analyze Specification:** You **MUST** read and analyze the specification to identify story boundaries.
3. **Ask Story-Specific Questions:** You **SHOULD** ask about prioritization, sequencing, and story preferences.
4. **Generate User Stories:** You **MUST** create detailed stories using the structure below.
5. **Validate Coverage:** You **MUST** run a coverage check (see Coverage Validation section below) before presenting stories.
6. **Save Output.**

## Clarifying Questions

- **Story Priority & Sequencing:** "In what order should these stories be prioritized? Are there dependencies?"
- **MVP vs. Future:** "Which stories are essential for MVP? Which are nice-to-have?"
- **Story Scope:** "Should we break this into more granular stories, or combine some? (Target: 1-3 days per story)"
- **Definition of Done:** "What definition of done applies?"
- **User Acceptance:** "Who will validate that stories meet acceptance criteria?"

## User Story Structure

Each User Story **MUST** include:

```markdown
### Story [ID]: [Title]

**Priority:** [Critical/High/Medium/Low]
**Estimated Size:** [XS/S/M/L]
**Dependencies:** [List any dependent stories or systems]

#### User Story

As a [user role],
I want [goal/capability],
So that [business value/benefit].

#### Context

[Why this story matters, how it fits the larger feature.]

#### Acceptance Criteria

- [ ] [Criterion 1: Specific, testable condition]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

#### Business Rules

- [Business rule 1]
- [Business rule 2]

#### Technical Notes

- [Key technical decisions or patterns to follow]
- [Reference to Technical Guidelines sections]
- [Integration points]

#### Testing Requirements

- **Unit Tests:** [Specific scenarios]
- **Integration Tests:** [Scenarios, if applicable]
- **Manual Testing:** [Manual test cases]
- **Edge Cases:** [Edge cases to test]

#### Implementation Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]

#### Files to Create/Modify

- `path/to/file1.ts` - Brief description
- `path/to/file1.test.ts` - Unit tests

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit tests written and passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Pull Request created and merged
```

## Story Quality Criteria

**Good User Stories:**
- Provide clear business value that can be demonstrated
- Are independent and avoid blocking other stories
- **SHOULD** be completable in 1-3 days by a capable developer
- **MUST** fit into a single Pull Request
- **MUST** have clear acceptance criteria
- **MUST** include sufficient technical guidance for implementation

**Poor User Stories:**
- Too large or vague (epic-sized)
- Have circular dependencies
- Mix multiple concerns or features
- Lack clear acceptance criteria

## Story Sequencing

You **SHOULD** consider these factors when sequencing:

1. **Dependencies:** Stories with fewer dependencies first
2. **Value:** High-value core stories early
3. **Risk:** Risky or uncertain stories prioritized to de-risk
4. **Infrastructure:** Setup stories first
5. **Team Skills:** Consider capabilities and learning curve

---

## Coverage Validation (Built-in Quality Gate)

Before finalizing stories, you **MUST** validate coverage against the PRD.

### Validation Steps

1. **Extract ALL requirements** from the PRD: user stories, functional requirements, non-functional requirements, business rules, acceptance criteria, data requirements.
2. **Map each requirement** to the User Story(ies) that address it.
3. **Identify gaps** — requirements NOT covered by any story.
4. **Verify non-goals** — confirm out-of-scope items are NOT covered (scope is respected).

### Coverage Report

You **MUST** include a summary coverage report at the end of the stories document:

```markdown
## Coverage Validation

### Summary
- **Total PRD Requirements:** [#]
- **Total User Stories:** [#]
- **Coverage:** [X%]
- **Status:** [Complete / Gaps Identified]

### Requirement Mapping

| PRD Requirement | Story ID(s) | Status |
|----------------|-------------|--------|
| [Req 1] | S-001 | ✅ Covered |
| [Req 2] | S-002, S-003 | ✅ Covered |
| [Uncovered Req] | — | ❌ GAP |

### Gaps (if any)

- **Gap [#]:** [Requirement not covered] — **Recommendation:** [Create new story / Modify existing story]

### Non-Goals Validation

- [ ] [Out-of-scope item 1] — Confirmed NOT in any story
- [ ] [Out-of-scope item 2] — Confirmed NOT in any story
```

If gaps are found, you **MUST** propose additional stories or modifications to close them before presenting for review.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/workstream/`
- **Filename:** `user-stories-[prd-name].md`

## Final Instructions

1. You **MUST NOT** start implementing.
2. You **MUST** read the referenced Technical Specification and PRD.
3. You **MUST** identify logical story boundaries that provide independent value.
4. You **SHOULD** ask clarifying questions about prioritization and sequencing.
5. You **MUST** generate detailed User Stories with all required sections.
6. You **MUST** ensure stories are appropriately sized (1-3 days of work).
7. You **MUST** run the coverage validation and include the report.
8. You **MUST** close any gaps before presenting stories for review.
9. You **MUST** present stories for user review and save the finalized version.
10. You **MUST** provide a summary of total stories and a high-level execution plan.
11. When updating an existing user stories document, you **MUST** add a new row to the Changelog table with an incremented version, the current date, a summary of changes, and the responsible author/agent.
