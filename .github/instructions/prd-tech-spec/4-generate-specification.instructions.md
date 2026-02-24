---
applyTo: "**"
---
# Rule: Generate Technical Specification

## Goal

To guide an AI assistant in creating a comprehensive Technical Specification document by synthesizing the Base PRD with the Technical Guidelines. The specification transforms feature requirements into actionable technical design decisions and implementation details.

## Context

This step assumes the following documents already exist:
- `product-context.md` - Product understanding
- `technical-guidelines.md` - Technical standards and patterns
- `prd-[feature-name].md` - Feature requirements

The specification bridges the gap between "what to build" (PRD) and "how to build it" (implementation tasks).

## Process

1. **Receive References:** User points to the existing PRD and confirms Technical Guidelines are available.
2. **Analyze Documents:** AI reads and analyzes both the PRD and Technical Guidelines to identify integration points.
3. **Ask Specification Questions:** Ask targeted questions about specific technical decisions and implementation approach.
4. **Generate Specification:** Create a comprehensive technical specification using the structure below.
5. **Save Output:** Save as `specification-[prd-name].md` in the `/docs` directory.

## Clarifying Questions

Focus on technical decisions and implementation approach:

- **System Design:** "Based on the feature requirements and our technical guidelines, what is the proposed system architecture for this feature?"
- **Data Model:** "What data entities and relationships are needed? How do they map to our database design?"
- **API Endpoints:** "What API endpoints will be needed? How do they fit our API design standards?"
- **Integration Points:** "Which existing systems or services will we integrate with? What integration method?"
- **Authentication/Authorization:** "How will this feature enforce authentication and authorization per our guidelines?"
- **Performance Approach:** "How will we ensure performance targets are met? Any caching or optimization strategies?"
- **Error Handling:** "How should errors be handled and reported to users?"
- **Validation Logic:** "What validation rules need to be enforced? Client-side and/or server-side?"
- **External Dependencies:** "Are there new third-party services or tools to integrate?"
- **Feature Flags or Toggles:** "Will feature flags or toggles be used for rollout?"
- **Backward Compatibility:** "Are there backward compatibility concerns with existing APIs or data?"

## Output Structure

The generated Specification document should include:

1. **Executive Summary:** Brief overview of how the PRD will be technically implemented (2-3 sentences).
2. **Reference Documents:**
   - Links or references to the PRD
   - Links or references to Technical Guidelines sections used
3. **System Architecture:**
   - Data flow diagram (described in text or with ASCII art)
   - Component interactions
   - External service integrations
   - How this feature fits into the broader system
4. **Data Model & Database Design:**
   - Entity relationships and diagrams (text-based or referenced)
   - Database schema overview
   - Naming conventions used
   - Any data normalization or de-normalization decisions
   - Migration strategy if modifying existing data structures
5. **API Design:**
   - Endpoint specifications (if applicable)
   - Request/response schema examples
   - Authentication and authorization requirements per endpoint
   - Rate limiting or quota considerations
   - Versioning strategy
6. **Authentication & Authorization Design:**
   - How authentication is implemented for this feature
   - Authorization model (role-based, attribute-based, etc.)
   - Permission matrix or access control rules
   - Session or token management
7. **Business Logic Implementation:**
   - Key algorithms or calculations
   - Business rule enforcement locations (backend, frontend, database)
   - Validation rules and where they are enforced
   - State machine or workflow diagrams (if applicable)
8. **Integration Details:**
   - Third-party service integrations
   - Integration method (REST, webhook, event-driven, etc.)
   - Retry logic and failure handling
   - API credentials or configuration
9. **User Interface & Client Behavior:**
   - Page/screen flow or user journey through the feature
   - UI components involved
   - Client-side validation and error handling
   - Responsive design considerations
10. **Performance & Scalability Approach:**
    - Caching strategy
    - Database query optimization approach
    - Pagination or lazy-loading strategy
    - Expected performance metrics
    - Scalability considerations
11. **Security Implementation:**
    - Data encryption approach (in-transit and at-rest)
    - Input validation and sanitization strategy
    - OWASP considerations (CSRF, XSS, SQL injection, etc.)
    - PII or sensitive data handling
    - Audit logging approach
12. **Error Handling & Logging:**
    - Error response formats
    - Logging strategy and levels
    - Error recovery or fallback behavior
    - Monitoring and alerting approach
13. **Testing Strategy for This Feature:**
    - Unit tests scope and approach
    - Integration tests scope and approach
    - End-to-end test scenarios
    - Mock or stub strategy
    - Coverage targets
14. **Deployment & Rollout:**
    - Feature flags or rollout strategy
    - Database migration steps
    - Backward compatibility strategy
    - Rollback plan
    - Monitoring during rollout
15. **Dependencies & Risks:**
    - Technology or framework dependencies
    - External service dependencies
    - Known risks and mitigation strategies
    - Breaking changes or compatibility issues
16. **Implementation Phases (if applicable):**
    - If this feature has multiple phases, describe sequencing
    - Prioritized components for initial vs. future releases
17. **Open Questions & Decisions Pending:**
    - Remaining technical decisions to be made
    - Areas requiring further clarification

## Key Synthesis Points

The specification should clearly show how:
- Each PRD requirement is addressed technically
- Technical Guidelines are applied to this specific feature
- System integrates with existing architecture
- Technology stack choices support the requirements

## Target Audience

The primary audience is the **development team**. Specification should be detailed enough for a developer to begin implementation with minimal additional clarification.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/` (in the working repository)
- **Filename:** `specification-[prd-name].md` (e.g., `specification-user-profiles.md`)

## Final Instructions

1. Do NOT start implementing
2. Read the referenced PRD and Technical Guidelines documents
3. Ask clarifying questions about technical implementation approach
4. Use answers to create a comprehensive Technical Specification
5. Ensure the specification clearly maps PRD requirements to technical solutions
6. Present for user review
7. Save the finalized version