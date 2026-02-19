---
applyTo: "**"
---
# Rule: Validate Coverage of Requirements

## Goal

To guide an AI assistant in performing a comprehensive validation that all requirements from the Base PRD are adequately covered by the sum of all User Stories and implementation tasks. This ensures nothing is missed and provides confidence that the work is complete and thorough.

## Context

This step assumes the following documents already exist:
- `prd-[feature-name].md` - Base requirements document
- `specification-[prd-name].md` - Technical specification
- `user-stories-[prd-name].md` - Detailed user stories

Coverage validation is a critical quality gate to ensure comprehensive implementation planning.

## Process

1. **Receive References:** User provides or confirms references to PRD and User Stories documents.
2. **Extract Requirements:** AI systematically extracts all requirements from PRD.
3. **Map to Stories:** AI maps each requirement to the corresponding User Story(ies).
4. **Identify Gaps:** Identify any requirements not covered by current stories.
5. **Generate Coverage Report:** Create a validation report with the structure outlined below.
6. **Identify Missing Stories:** If gaps exist, suggest new stories or story modifications.
7. **Save Output:** Save as `coverage-validation-[prd-name].md` in the `/docs` directory.

## Validation Approach

### Step 1: Requirement Extraction

Extract ALL requirements from the PRD into a comprehensive list:

- User stories from PRD
- Functional requirements
- Non-functional requirements (performance, scalability, security, etc.)
- Business rules
- Acceptance criteria
- Data requirements
- UI/UX requirements
- Technical constraints
- Success metrics
- Out-of-scope items (to confirm they are NOT covered)

### Step 2: Story Mapping

For each requirement, map to:
- Which User Story addresses this requirement
- Which acceptance criteria in that story cover this requirement
- Which implementation steps address this requirement

Format: `[Requirement] → [Story ID] (Acceptance Criteria: [AC#], Steps: [Step#])`

### Step 3: Gap Analysis

Identify:
- Requirements NOT covered by any story
- Partial coverage requiring clarification
- Cross-cutting concerns (security, logging, testing) addressed appropriately
- Out-of-scope items that are confirmed out of scope

### Step 4: Cross-Checks

Verify:
- All Functional Requirements are covered
- All Non-Goals are NOT covered (validation that scope is respected)
- All Acceptance Criteria are addressed
- All Business Rules are enforced in stories
- All Data Requirements are accounted for
- Performance and scalability requirements have corresponding technical approaches
- Security requirements are properly addressed

## Output Structure

The Coverage Validation report should include:

```markdown
# Coverage Validation Report: [Feature Name]

## Executive Summary

- **Total PRD Requirements:** [#]
- **Total User Stories:** [#]
- **Coverage Completeness:** [X%]
- **Status:** [Complete / Incomplete with gaps / Needs revision]
- **Gaps Identified:** [# of gaps]

## Requirement-to-Story Mapping

### Functional Requirements Coverage

| Requirement | User Story | Acceptance Criteria | Implementation Steps | Status |
|-------------|-----------|-------------------|-------------------|--------|
| [Req 1] | Story ID | AC #'s | Step #'s | ✅ Covered |
| [Req 2] | Story ID | AC #'s | Step #'s | ✅ Covered |
| [Req 3] | Multiple Stories | AC #'s | Step #'s | ✅ Covered |
| [Uncovered Req] | — | — | — | ❌ GAP |

### Non-Functional Requirements Coverage

| Requirement | Addressed In | Notes | Status |
|-------------|------------|-------|--------|
| Performance (< 2s load time) | Specification + Story XYZ | Caching strategy in place | ✅ Covered |
| Security (data encryption) | Technical Guidelines + Story ABC | HTTPS + DB encryption | ✅ Covered |
| [Uncovered Req] | — | — | ❌ GAP |

### Business Rules Coverage

| Business Rule | Enforced In | User Story | Status |
|---------------|-----------|-----------|--------|
| [Rule 1] | Backend validation | Story ID | ✅ Covered |
| [Rule 2] | Authorization layer | Story ID | ✅ Covered |
| [Uncovered Rule] | — | — | ❌ GAP |

### User Stories Coverage of PRD

For each User Story, indicate which PRD requirements it addresses:

**Story 1: [Title]**
- Covers: PRD Req #'s
- Addresses: Business Rules #'s
- Related to: Success Metric #'s

**Story 2: [Title]**
- Covers: PRD Req #'s
- Addresses: Business Rules #'s
- Related to: Success Metric #'s

[Continue for all stories...]

## Gaps & Missing Coverage

### Identified Gaps

#### Gap [#1]: [Requirement Not Covered]

- **PRD Reference:** [Section and quote]
- **Impact:** [Why this matters]
- **Recommendation:** 
  - [ ] Create new User Story
  - [ ] Modify existing Story (which one?)
  - [ ] Add to existing Story (which one?)
- **Proposed Story (if needed):** [Brief description]

#### Gap [#2]: [Another uncovered requirement]
- [Same structure...]

[Continue for all gaps...]

### Missing Acceptance Criteria in Stories

[Note any PRD acceptance criteria that should be explicitly called out in User Stories]

### Out-of-Scope Validation

Confirm that the following PRD items are intentionally NOT covered (per "Non-Goals"):

- [ ] Out-of-scope item 1 — Confirmed not in any story
- [ ] Out-of-scope item 2 — Confirmed not in any story
- [...]

## Cross-Functional Concerns

### Security Requirements

| Requirement | Addressed In | Notes |
|-------------|------------|-------|
| [Security Req] | Story/Specification | [How it's handled] |

### Performance & Scalability

| Requirement | Addressed In | Notes |
|-------------|------------|-------|
| [Performance Target] | Story/Specification | [Approach taken] |

### Testing Coverage

- All User Stories have Testing Requirements sections: ✅
- Unit test coverage expectations defined: ✅
- Integration test scenarios identified: ✅
- E2E test scenarios identified: ✅

### Documentation Requirements

- API documentation needed: [Stories addressing this]
- User documentation needed: [Stories addressing this]
- Developer documentation needed: [Stories addressing this]

## Summary & Recommendations

### Coverage Assessment

- **Completeness:** [X% of requirements covered]
- **Confidence Level:** [High/Medium/Low]

### Recommended Actions

1. [Action 1: Create Story XYZ to address Gap #1]
2. [Action 2: Modify Story ABC to include additional AC]
3. ...

### Next Steps

If gaps are identified:
- [ ] Create new User Stories for missing requirements
- [ ] Update existing Stories to add missing coverage
- [ ] Rerun this validation to confirm complete coverage
- [ ] Get stakeholder approval on any changes

If coverage is complete:
- [ ] User Stories are ready for implementation
- [ ] Team can proceed with development
- [ ] Use this report as ongoing reference during implementation

## Appendices

### A. Requirements Dictionary

[Reference table of all PRD requirements with direct quotes and locations]

### B. Story Summary

[List of all User Stories with brief description for easy reference]

### C. Assumptions & Notes

[Any assumptions made during validation, interactions that affected mapping, etc.]

```

## Validation Criteria

Coverage is considered **Complete** when:
- ✅ 100% of Functional Requirements are mapped to stories
- ✅ All Non-Functional Requirements have explicit strategies in specification/stories
- ✅ All Business Rules are enforced in at least one story
- ✅ All Acceptance Criteria from PRD are represented in story AC's
- ✅ Out-of-Scope items are confirmed NOT included
- ✅ No story introduces unspecified functionality (scope creep)
- ✅ Cross-functional concerns (security, performance) are explicitly addressed

Coverage is considered **Incomplete** when:
- ❌ PRD requirements are unaddressed
- ❌ Business rules are missing implementation
- ❌ Non-Goals appear in stories
- ❌ Technical strategies lack corresponding stories
- ❌ Test requirements are not specified in stories

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/` (in the working repository)
- **Filename:** `coverage-validation-[prd-name].md`

## Final Instructions

1. Read the PRD document completely
2. Read all User Stories
3. Extract and list all PRD requirements systematically
4. Map each requirement to corresponding User Story(ies)
5. Identify any gaps or uncovered requirements
6. Create a comprehensive Coverage Validation report
7. If gaps exist:
   - Recommend new stories or modifications
   - Provide summary of findings
8. If coverage is complete:
   - Confirm ready for implementation
   - Provide the validation report as reference
9. Present findings to user for review
10. Save the final validation report