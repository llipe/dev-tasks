---
applyTo: "**"
---
# Rule: Generate User Stories from Specification

## Goal

To guide an AI assistant in creating structured, implementation-ready User Stories from the Technical Specification. Each user story should be able to provide value independently, fit into a single Pull Request, and contain the detailed information needed for implementation.

## Context

This step assumes the following documents already exist:
- `specification-[prd-name].md` - Technical specification synthesizing PRD and guidelines

User Stories are the bridge between specification and implementation. Each story should:
- Provide measurable business value
- Be completable in 1-3 days of work for a capable developer
- Fit into a single Pull Request
- Include detailed acceptance criteria and implementation guidance
- Include simple implementation tasks/steps

## Process

1. **Receive Specification:** User provides reference to the Technical Specification document.
2. **Analyze Specification:** AI reads and analyzes the specification to identify story boundaries.
3. **Ask Story-Specific Questions:** Ask about prioritization, sequencing, and any specific story preferences.
4. **Generate User Stories:** Create detailed stories using the structure outlined below.
5. **Save Output:** Save as `user-stories-[prd-name].md` in the `/docs` directory.

## Clarifying Questions

Focus on story creation and prioritization:

- **Story Priority & Sequencing:** "In what order should these stories be prioritized? Are there dependencies?"
- **MVP vs. Future:** "Which stories are essential for MVP? Which are nice-to-have for future iterations?"
- **Story Scope:** "Should we break this into more granular stories, or combine some? (Target: 1-3 days per story)"
- **Definition of Done:** "What definition of done applies? (e.g., code, tests, documentation, deployment)"
- **User Acceptance:** "Who will validate that stories meet acceptance criteria? How?"

## Output Structure

Each User Story should include the following elements:

```markdown
### Story [ID]: [Title]

**Priority:** [Critical/High/Medium/Low]  
**Estimated Size:** [XS/S/M/L] (in story points or days)  
**Dependencies:** [List any dependent stories or systems]

#### User Story

As a [user role],  
I want [goal/capability],  
So that [business value/benefit].

#### Context

[Additional context about why this story matters, how it fits into the larger feature, any background information for the developer.]

#### Acceptance Criteria

- [ ] [Criterion 1: Specific, testable condition]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [All relevant security, performance, or compliance requirements are met]

#### Business Rules

- [Business rule 1]
- [Business rule 2]
- [Any regulatory or policy constraints]

#### Technical Notes

- [Key technical decisions or patterns to follow]
- [Reference to Technical Guidelines sections]
- [Integration points with existing systems]
- [Performance or scalability considerations]

#### Testing Requirements

- **Unit Tests:** [Specific unit test scenarios to cover]
- **Integration Tests:** [Integration test scenarios, if applicable]
- **Manual Testing:** [Manual test cases or scenarios]
- **Edge Cases:** [Edge cases to test]

#### Implementation Steps

1. [Step 1: Description and what to do]
2. [Step 2: Description]
3. [Step 3: Description]
4. ...

#### Files to Create/Modify

- `path/to/file1.ts` - Brief description
- `path/to/file1.test.ts` - Unit tests
- [Other relevant files]

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit tests written and passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Documentation updated (if applicable)
- [ ] Performance benchmarked (if applicable)
- [ ] Security reviewed (if applicable)
- [ ] Pull Request created and merged
- [ ] Story marked complete in tracking system

#### Notes

[Any additional notes, gotchas, or considerations for the implementer.]

#### Open Questions

[Any questions or ambiguities that need clarification before starting.]
```

## Story Characteristics

**Good User Stories:**
- ✅ Provide clear business value that can be demonstrated
- ✅ Are independent and avoid blocking other stories
- ✅ Can be completed in 1-3 days by a capable developer
- ✅ Fit into a single Pull Request
- ✅ Have clear acceptance criteria
- ✅ Include sufficient technical guidance for implementation
- ✅ Are testable and measurable

**Poor User Stories:**
- ❌ Too large or vague (epic-sized)
- ❌ Have circular dependencies on other stories
- ❌ Mix multiple concerns or features
- ❌ Lack clear acceptance criteria
- ❌ Require extensive technical research to understand how to implement

## Story Sequencing

Consider these factors when sequencing stories:

1. **Dependencies:** Stories with fewer dependencies should be prioritized first
2. **Value:** High-value stories that demonstrate the core feature should come early
3. **Risk:** Risky or uncertain stories might be prioritized to de-risk the implementation
4. **Infrastructure:** Setup or infrastructure stories might need to come first
5. **Team Skills:** Consider team capabilities and learning curve

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/` (in the working repository)
- **Filename:** `user-stories-[prd-name].md` (e.g., `user-stories-user-profiles.md`)

## Final Instructions

1. Do NOT start implementing
2. Read the referenced Technical Specification
3. Identify logical story boundaries that provide independent value
4. Ask clarifying questions about prioritization and sequencing
5. Generate detailed User Stories with all required sections
6. Ensure stories are appropriately sized (1-3 days of work)
7. Verify stories are sequenced logically with dependency management
8. Present stories for user review
9. Save the finalized version
10. Provide a summary of the total number of stories and high-level execution plan