---
name: activity-generate-spec
description: "Transform an approved PRD into a technical specification. Use in product-engineer Feature Mode after refine."
---

# Activity: Generate Technical Specification

Transform refined requirements (PRD) into an actionable technical design by synthesizing them with the project's Technical Guidelines. Use this skill when a PRD is approved and ready for technical breakdown. Invoked by the `product-engineer` agent in Feature Mode.

Before asking any technical design question, this activity invokes the `activity-grill` sub-skill (HOW phase) to walk the design tree to shared understanding, and writes every resolved question to `workstream/decisions-<feature>.md` — see Process below. `product-engineer`'s own conditional pre-step `researcher` call (ADR-004) runs before this activity starts, not after; when its `/workstream/research-*.md` artifact exists, `activity-grill`'s resolve-before-ask step consults it before making its own bounded call (D-56).

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Transform refined requirements (PRD) into an actionable technical design by synthesizing them with the project's Technical Guidelines. The specification bridges "what to build" (PRD) and "how to build it" (implementation).

## Context

This activity assumes the following documents already exist:

- `product.md` — Product understanding
- `tech.md` — Technical standards and patterns
- `prd-[feature-name].md` — Feature requirements (produced by the **refine** activity)

## Document Changelog Convention

Every specification produced by this activity **MUST** include a **Changelog** table as the **first section** after the document title. The changelog tracks the version history of the document.

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

## Process

1. **Receive References:** User points to the existing PRD and confirms Technical Guidelines are available. If a pre-step `researcher` artifact (`/workstream/research-*.md`) exists from `product-engineer`'s conditional pre-step call (ADR-004), treat it as already available evidence.
2. **Analyze Documents:** You **MUST** read and analyze both the PRD and Technical Guidelines to identify integration points.
3. **Invoke `activity-grill`:** Before asking any technical design question, invoke `activity-grill(phase="HOW", cap=cap.how)` (`cap.how` defaults to 25; read from `docs/tech.md` § Grilling if that subsection exists, else the hardcoded default) (FR-13, AC-02). The candidate questions below seed the interview's question pool — `activity-grill` owns the one-question-at-a-time, resolve-before-ask mechanics, including reuse of any pre-step `researcher` artifact and, only when that artifact does not cover a question, its own bounded `researcher` call sharing the phase's budget (D-56). You **MUST NOT** produce any specification section, draft, or outline until `activity-grill` returns the exit gate satisfied.
4. **Generate Specification:** You **MUST** create a comprehensive technical specification using the structure below, citing inline (`… (D-NN)`) every technical decision a `D-NN` shaped.
5. **Save Output.**

## Candidate Specification Questions (seed the `activity-grill` interview)

Focus on technical decisions and implementation approach:

- **Affected Repositories:** "Which repositories are affected? What role does each play (backend, frontend, shared lib, infra)?"
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

0. **Changelog** — Version history table (see Document Changelog Convention above)
1. **Executive Summary** — How the PRD will be technically implemented (2-3 sentences)
2. **Reference Documents** — Links to the PRD and relevant Technical Guidelines sections
3. **Affected Repositories** — Table of repositories impacted by this specification. For each repo, describe the role it plays (e.g., API backend, web frontend, shared library) and the scope of changes expected. Format: `| Repository | Role | Scope of Changes |`
4. **System Architecture** — Data flow, component interactions, external integrations, how this fits the broader system
5. **Data Model & Database Design** — Entity relationships, schema overview, naming conventions, migration strategy
6. **API Design** — Endpoint specifications, request/response schemas, auth per endpoint, rate limiting, versioning
7. **Authentication & Authorization Design** — Auth implementation, permission matrix, session/token management
8. **Business Logic Implementation** — Key algorithms, business rule enforcement locations, validation rules, state machines
9. **Integration Details** — Third-party integrations, methods, retry/failure handling, credentials
10. **User Interface & Client Behavior** — Page/screen flow, UI components, client-side validation, responsive design
11. **Performance & Scalability Approach** — Caching, query optimization, pagination, expected metrics
12. **Security Implementation** — Encryption, input sanitization, OWASP considerations, PII handling, audit logging
13. **Error Handling & Logging** — Error formats, logging strategy, recovery behavior, monitoring
14. **Testing Strategy** — Unit/integration/E2E scope, mock strategy, coverage targets
15. **Deployment & Rollout** — Feature flags, migration steps, backward compatibility, rollback plan
16. **Dependencies & Risks** — Technology dependencies, known risks, mitigation strategies
17. **Open Questions** — Remaining technical decisions
18. **Decisions (HOW phase)** — Table (`ID | Decision (short form)`) listing every `activity-grill` decision ID consumed by this specification (FR-14, S-003-AC-3), in qualified `<feature>#D-NN` form when reusing a decision from another feature's log; may legitimately be empty for a trivial specification that needed no decisions, but the `activity-grill` interview and exit-gate confirmation still ran
19. **Vocabulary** — `## Vocabulary` table listing every domain term the specification uses and where each one stands against the glossary: `existing`, `proposed`, or settled by a decision (FR-20, D-61). See "Vocabulary Section" below

## Vocabulary Section (FR-20, D-61, D-75)

The specification carries a `## Vocabulary` section immediately after `## Decisions (HOW phase)`, in the same shape `activity-refine` uses for PRDs:

```markdown
## Vocabulary

| Term | Status in glossary                      | Bounded context | Definition (proposals only) | Forbidden synonyms (proposals only) |
| ---- | --------------------------------------- | --------------- | --------------------------- | ----------------------------------- |
| …    | existing \| proposed \| conflict → D-NN | …               | …                           | …                                   |
```

A row is complete when `existing` names a term `docs/domain/ubiquitous-language.md` already defines (case-insensitively), when `proposed` carries a bounded context, a definition, and forbidden synonyms (`none` is an answer), or when `conflict → D-NN` cites the decision that settled a clash — `->` and `→` are both accepted. A specification that introduces no domain concept of its own carries the section with exactly one line, and that line **MUST** be the section's only content — the sentinel is accepted only when nothing else stands beside it (a `None — …` sentence above a table does not make the table complete): `None — this specification introduces no domain concepts.`

A specification introduces implementation vocabulary as readily as a PRD introduces product vocabulary, and the term that enters the codebase through a module name is the one nobody ever agreed on. Terms are identified during HOW-phase grilling, never by scanning the drafted prose (D-65).

The glossary append itself is `activity-refine`'s write at PRD approval, not this skill's (D-61). A term a specification proposes is carried back to the PRD's `## Vocabulary` section for approval.

## Diagram Guidelines

The specification **MUST** include embedded Mermaid diagrams to visually communicate architecture, data models, and key flows. Use fenced code blocks with the `mermaid` language tag.

Required and recommended diagrams:

| Diagram Type                     | Requirement                                                        | Target Section                              |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| **Component / C4-style diagram** | **MUST** include — shows services, repos, and their interactions   | System Architecture                         |
| **Entity-Relationship diagram**  | **MUST** include when new or modified data entities exist          | Data Model & Database Design                |
| **Sequence diagram**             | **SHOULD** include for key API flows or multi-service interactions | API Design or Business Logic Implementation |
| **State diagram**                | **SHOULD** include when entities have meaningful state transitions | Business Logic Implementation               |
| **Deployment diagram**           | **MAY** include for complex multi-environment rollouts             | Deployment & Rollout                        |

Rules:

- Diagrams **MUST** be embedded inline in the relevant section, not collected at the end.
- Each diagram **MUST** have a brief introductory sentence explaining what it shows.
- Keep diagrams focused — one concern per diagram.
- Use consistent naming across diagrams and prose.
- ER diagrams **SHOULD** include cardinality and key attributes.
- Sequence diagrams **SHOULD** include error/alternate paths when relevant.

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
3. You **MUST** ask clarifying questions about the technical implementation approach, conducted through `activity-grill(phase="HOW")` — you **MUST NOT** draft any part of the specification until `activity-grill`'s exit gate returns satisfied (FR-13).
4. You **MUST** ensure the specification clearly maps PRD requirements to technical solutions.
5. Before presenting the specification for review, you **MUST** run `checkVocabularySection()` from `core/checks/glossary.ts` over the draft and the repository's glossary, and **MUST** report every finding by its rule name — `vocabulary-missing` or `vocabulary-incomplete` naming the row (D-75).
6. You **MUST** present the specification for user review.
7. You **MUST** save the finalized version.
8. When updating an existing specification, you **MUST** add a new row to the Changelog table with an incremented version, the current date, a summary of changes, and the responsible author/agent.
9. You **MUST** cite every decision that shaped a technical design choice inline (`… (D-NN)`), and **MUST** populate the document's `## Decisions (HOW phase)` section with every ID consumed from the `activity-grill` session, in qualified `<feature>#D-NN` form when reusing a decision from another feature's log (FR-14).
