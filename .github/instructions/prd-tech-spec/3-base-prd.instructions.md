---
applyTo: "**"
---
# Rule: Create Base PRD

## Goal

To guide an AI assistant in creating a Product Requirements Document (PRD) for a specific feature or set of features that aligns with the product context and strategic goals. This PRD should be focused and actionable, ideally containing no more than 50 stories or tasks.

## Context

This step assumes the following documents have already been created:
- `product-context.md` - Understanding the overall product
- `technical-guidelines.md` - Understanding technical constraints and patterns

The Base PRD should define the specific features to be implemented within a release or iteration, informed by the product context and strategic goals.

## Process

1. **Receive Feature Scope:** The user describes the features or feature set to be included in this PRD.
2. **Ask Clarifying Questions:** Gather sufficient detail about the requirements, prioritization, and acceptance criteria.
3. **Reference Existing Documents:** Consider the product context and technical guidelines when framing requirements.
4. **Generate PRD:** Create a detailed PRD using the structure outlined below.
5. **Save Output:** Save the document as `prd-[feature-name].md` in the `/docs` directory.

## Clarifying Questions

Adapt questions based on the feature scope, but explore these key areas:

- **Feature Title & Scope:** "What is the main feature or feature set being defined? What features are included?"
- **Problem/Goal:** "What problem does this feature solve? How does it align with the product goals?"
- **Target User:** "Who is the primary user of this feature? Are there secondary users?"
- **User Stories:** "Can you provide the main user stories? Format: As a [role], I want [goal] so that [benefit]."
- **Functional Requirements:** "What are the specific functions this feature must support?"
- **Acceptance Criteria:** "What are the success criteria for this feature?"
- **Priority & Scope:** "What is the priority? Are there features being explicitly excluded to manage scope?"
- **Data Requirements:** "What data or information is required for this feature?"
- **Business Rules:** "Are there specific business rules or constraints?"
- **UI/UX Expectations:** "Are there UI mockups, wireframes, or design direction?"
- **Reporting & Metrics:** "What metrics or reports are important for this feature?"
- **Edge Cases:** "What edge cases or error conditions need to be handled?"

## Output Structure

The generated Base PRD should include:

1. **Executive Summary:** Brief overview of the feature and its strategic importance (2-3 sentences).
2. **Feature Overview:** Detailed description of what the feature is and what it enables users to do.
3. **Goals & Objectives:** Specific, measurable goals for this feature. How it advances product strategy.
4. **Target Users:** Primary and secondary user personas or roles using this feature.
5. **User Stories:** 3-10 main user stories in the format: "As a [role], I want [goal] so that [benefit]."
6. **Functional Requirements:** Numbered list of specific functionality required:
   - Example: "The system must allow users to upload files up to 10MB."
   - Be explicit and unambiguous.
7. **Business Rules:** Any specific business logic or rules:
   - Example: "Users can only edit their own posts."
   - Example: "Approved items appear in the public feed within 24 hours."
8. **Data Requirements:** 
   - What data entities are involved?
   - What data will be collected or stored?
   - Any data sensitivity considerations?
9. **Non-Goals (Out of Scope):** Explicitly state what this feature will NOT include to manage scope.
10. **Design Considerations:** 
    - Link to any mockups or design files
    - UI/UX patterns or guidelines to follow
    - Accessibility requirements
11. **Technical Considerations:** 
    - Dependencies on other features or systems
    - Integration points with existing systems
    - Performance or scalability considerations
    - How this aligns with technical guidelines
12. **Acceptance Criteria:** 
    - Clear, testable criteria for feature completion
    - Example: "All functional requirements are implemented and tested."
    - Example: "Performance meets benchmarks (< 2s load time)."
13. **Success Metrics:** 
    - How will success of this feature be measured?
    - Example: "User adoption rate > 50%."
    - Example: "Support tickets reduced by 25%."
14. **Assumptions:** 
    - Key assumptions underlying this PRD
    - Example: "Assuming 1000 concurrent users."
15. **Constraints & Dependencies:** 
    - Timeline constraints
    - Resource constraints
    - Dependencies on external services or teams
16. **Security & Compliance:** 
    - Any security requirements
    - Privacy or compliance considerations
    - Authentication/authorization requirements
17. **Open Questions:** 
    - Remaining ambiguities or areas needing clarification

## Scope Guidance

- A PRD should define a coherent feature or feature set that can be delivered in a reasonable timeframe (typically 1-3 iterations/sprints).
- Total user stories should ideally not exceed 50.
- If the scope is too large, consider breaking it into multiple PRDs that will be sequenced over time.

## Target Audience

The primary audience is the **development team** and **product stakeholders**. The PRD should be clear enough for developers to understand requirements without extensive clarification.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/` (in the working repository)
- **Filename:** `prd-[feature-name].md` (e.g., `prd-user-profiles.md`)

## Final Instructions

1. Do NOT start implementing anything
2. Ask the user clarifying questions to fully understand the feature scope
3. Use their answers to create a comprehensive Base PRD
4. Present the PRD for user review
5. Iterate based on user feedback
6. Save the finalized version