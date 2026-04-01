---
applyTo: "**"
---
# Activity: Initialize Project Foundation
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

Guide an AI assistant in establishing the foundational documents for a project: **Product Context** and **Technical Guidelines**. These documents serve as the "constitution" for all future development — every PRD, specification, user story, and implementation decision **SHOULD** be informed by them.

Run this activity **once per project** (or when a major strategic or technical pivot occurs).

## Document Changelog Convention

Every document produced by this activity **MUST** include a **Changelog** table as the **first section** after the document title. The changelog tracks the version history of the document.

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

1. **Receive Initial Brief:** The user describes the product, project, or technology stack.
2. **Ask Clarifying Questions:** Gather information for both product context and technical guidelines in a single interview. Group questions by domain.
3. **Generate Product Context Document:** Create `product-context.md` using the structure below.
4. **Generate Technical Guidelines Document:** Create `technical-guidelines.md` using the structure below.
5. **Save Output:** Save both documents in `/docs/` and present them for user review.

---

## Part 1 — Product Context

### Clarifying Questions

Adapt questions based on context provided:

- **Product Definition:** "What is this product/project, and what does it do?"
- **Problem Statement:** "What core problem does this product solve?"
- **Target Users/Market:** "Who are the primary users or target audience?"
- **Strategic Goals:** "What are the 3-5 key strategic objectives?"
- **Success Metrics:** "How do we measure success?"
- **Competitive Landscape:** "Are there competing solutions? What differentiates this product?"
- **Current State:** "Is this a new product, MVP, or mature? What stage?"
- **Vision/Roadmap:** "What is the long-term vision? Are there planned phases?"
- **Key Constraints:** "Budget, timeline, technology, or regulatory constraints?"
- **Stakeholders:** "Who are the key decision-makers?"

### Output Structure: `product-context.md`

0. **Changelog** — Version history table (see Document Changelog Convention above)
1. **Executive Summary** — 2-3 sentence overview
2. **Problem Statement** — What problem(s) does this product solve?
3. **Target Users/Market** — Primary and secondary users, market segments
4. **Strategic Goals** — 3-5 key objectives
5. **Current State** — New, MVP, or mature? Stage description.
6. **Vision & Roadmap** — Long-term vision and planned phases
7. **Success Metrics** — How success will be measured
8. **Competitive Landscape** — Competitors and differentiation
9. **Key Constraints** — Budget, timeline, technology, regulatory
10. **Key Stakeholders** — Decision-makers and their interests
11. **Assumptions** — Major assumptions underlying the strategy
12. **Open Questions** — Remaining areas needing clarification

---

## Part 2 — Technical Guidelines

### Clarifying Questions

- **Technology Stack:** "What languages, frameworks, and libraries? Any constraints?"
- **Architecture:** "Overall pattern (monolith, microservices, serverless, etc.)?"
- **Data & Database:** "What databases? Schema or data model guidelines?"
- **API Design:** "APIs exposed? Style (REST, GraphQL, gRPC)? Naming conventions?"
- **Authentication & Authorization:** "How are users authenticated? Authorization model?"
- **Security Requirements:** "Key security requirements (encryption, compliance)?"
- **Performance & Scalability:** "Performance targets? Scalability requirements?"
- **Testing Strategy:** "Testing approach and coverage expectations?"
- **Code Organization:** "Folder structure conventions? Module boundaries?"
- **External Integrations:** "Required third-party integrations?"
- **Deployment & DevOps:** "Deployment targets? CI/CD practices?"
- **Monitoring & Logging:** "Observability tools and standards?"
- **Design Patterns:** "Preferred patterns (MVC, Repository, etc.)?"
- **Code Quality Standards:** "Linting, formatting, review standards?"

### Output Structure: `technical-guidelines.md`

0. **Changelog** — Version history table (see Document Changelog Convention above)
1. **Overview** — Technical vision and guiding principles
2. **Technology Stack** — Backend/frontend languages, frameworks, databases, key dependencies
3. **Architecture Patterns** — System architecture, key decisions and rationale, component organization
4. **API Design Standards** — Style, naming, request/response formats, error handling
5. **Authentication & Authorization** — Mechanism, model, permission levels, session management
6. **Security Requirements** — Encryption, OWASP compliance, API key management, PII handling
7. **Data & Database Guidelines** — Schema patterns, naming conventions, query optimization, backup
8. **Integration Methods** — External integrations, patterns, retry/failure handling
9. **Code Organization & Structure** — Folder/file conventions, module boundaries, naming
10. **Design Patterns & Principles** — Preferred patterns, SOLID, DRY/KISS/YAGNI
11. **Testing Strategy** — Frameworks, testing pyramid, coverage, mock strategies
12. **Code Quality & Standards** — Linting, static analysis, reviews, documentation
13. **Deployment & DevOps** — Environments, CI/CD, infrastructure-as-code, containers
14. **Monitoring, Logging & Observability** — Levels, frameworks, alerting, error tracking
15. **Performance & Scalability** — Response targets, throughput, caching, optimization
16. **Dependency Management** — Management approach, version pinning, vulnerability scanning
17. **Development Workflow** — Branching strategy, commit conventions, PR process
18. **Known Constraints & Trade-offs** — Limitations and rationale

---

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/`
- **Filenames:** `product-context.md`, `technical-guidelines.md`

## Final Instructions

1. You **MUST NOT** start implementing anything.
2. You **MUST** ask clarifying questions to fill gaps — cover both product and technical domains.
3. You **SHOULD** use answers to create both documents in a single pass.
4. You **MUST** save both files and present them for user review.
5. You **SHOULD** iterate based on user feedback before finalizing.
6. When updating an existing document, you **MUST** add a new row to the Changelog table with an incremented version, the current date, a summary of changes, and the responsible author/agent.
