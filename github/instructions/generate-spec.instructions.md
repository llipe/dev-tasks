---
applyTo: "**"
---
# Activity: Generate Technical Specification
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

Transform refined requirements (PRD) into an actionable technical design by synthesizing them with the project's Technical Guidelines. The specification bridges "what to build" (PRD) and "how to build it" (implementation).

## Context

This activity assumes the following documents already exist:
- `product-context.md` — Product understanding
- `technical-guidelines.md` — Technical standards and patterns
- `prd-[feature-name].md` — Feature requirements (produced by the **refine** activity)

## Process

1. **Receive References:** User points to the existing PRD and confirms Technical Guidelines are available.
2. **Analyze Documents:** You **MUST** read and analyze both the PRD and Technical Guidelines to identify integration points.
3. **Ask Specification Questions:** You **SHOULD** ask targeted questions about specific technical decisions and implementation approach.
4. **Generate Specification:** You **MUST** create a comprehensive technical specification using the structure below.
5. **Save Output.**

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
- **Feature Flags:** "Will feature flags or toggles be used for rollout?"
- **Backward Compatibility:** "Are there backward compatibility concerns with existing APIs or data?"

## Output Structure

The generated Specification document **MUST** include:

1. **Executive Summary** — How the PRD will be technically implemented (2-3 sentences)
2. **Reference Documents** — Links to the PRD and relevant Technical Guidelines sections
3. **System Architecture** — Data flow, component interactions, external integrations, how this fits the broader system
4. **Data Model & Database Design** — Entity relationships, schema overview, naming conventions, migration strategy
5. **API Design** — Endpoint specifications, request/response schemas, auth per endpoint, rate limiting, versioning
6. **Authentication & Authorization Design** — Auth implementation, permission matrix, session/token management
7. **Business Logic Implementation** — Key algorithms, business rule enforcement locations, validation rules, state machines
8. **Integration Details** — Third-party integrations, methods, retry/failure handling, credentials
9. **User Interface & Client Behavior** — Page/screen flow, UI components, client-side validation, responsive design
10. **Performance & Scalability Approach** — Caching, query optimization, pagination, expected metrics
11. **Security Implementation** — Encryption, input sanitization, OWASP considerations, PII handling, audit logging
12. **Error Handling & Logging** — Error formats, logging strategy, recovery behavior, monitoring
13. **Testing Strategy** — Unit/integration/E2E scope, mock strategy, coverage targets
14. **Deployment & Rollout** — Feature flags, migration steps, backward compatibility, rollback plan
15. **Dependencies & Risks** — Technology dependencies, known risks, mitigation strategies
16. **Open Questions** — Remaining technical decisions

## Key Synthesis Points

The specification **MUST** clearly show how:
- Each PRD requirement is addressed technically
- Technical Guidelines are applied to this specific feature
- The system integrates with existing architecture
- Technology stack choices support the requirements

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/workstream/`
- **Filename:** `specification-[prd-name].md`

## Final Instructions

1. You **MUST NOT** start implementing.
2. You **MUST** read the referenced PRD and Technical Guidelines documents.
3. You **SHOULD** ask clarifying questions about the technical implementation approach.
4. You **MUST** ensure the specification clearly maps PRD requirements to technical solutions.
5. You **MUST** present the specification for user review.
6. You **MUST** save the finalized version.
