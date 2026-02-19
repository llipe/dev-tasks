---
applyTo: "**"
---
# Rule: Define Technical Guidelines

## Goal

To guide an AI assistant in creating a comprehensive Technical Guidelines document that establishes the foundational technical decisions, architecture patterns, technology stack, integrations, security requirements, and other engineering standards for the project.

## Process

1. **Receive Input:** The user provides the product context or technical requirements overview.
2. **Ask Clarifying Questions:** Gather detailed information about technical stack, architecture, patterns, and constraints.
3. **Generate Technical Guidelines:** Create a document using the structure outlined below.
4. **Save Output:** Save the document as `technical-guidelines.md` in the `/docs` directory of the working repository.

## Clarifying Questions

Adapt questions based on the context, but explore these key technical areas:

- **Technology Stack:** "What programming languages, frameworks, and libraries will be used? Any constraints or requirements?"
- **Architecture:** "What is the overall architecture pattern (monolith, microservices, serverless, etc.)?"
- **Data & Database:** "What databases or data stores will be used? Any schema or data model guidelines?"
- **API Design:** "Will this product expose APIs? What style (REST, GraphQL, gRPC)? Any naming conventions?"
- **Authentication & Authorization:** "How will users be authenticated? What authorization model will be used?"
- **Security Requirements:** "What are the key security requirements (encryption, data protection, compliance)?"
- **Performance & Scalability:** "Are there performance targets or scalability requirements?"
- **Testing Strategy:** "What testing approach will be used (unit, integration, E2E)? Coverage expectations?"
- **Code Organization:** "How should code be organized? Any folder structure conventions?"
- **External Integrations:** "Are there required integrations with third-party services?"
- **Deployment & DevOps:** "How will the product be deployed? CI/CD practices?"
- **Monitoring & Logging:** "What monitoring, logging, or observability tools will be used?"
- **Design Patterns:** "Are there preferred design patterns (MVC, Repository, etc.)?"
- **Code Quality Standards:** "Any linting, formatting, or code review standards?"
- **Documentation Requirements:** "What documentation standards should be followed?"

## Output Structure

The generated Technical Guidelines document should include:

1. **Overview:** Brief introduction to the technical vision and principles.
2. **Technology Stack:** 
   - Backend/Runtime languages and frameworks
   - Frontend frameworks and libraries
   - Database(s) and data stores
   - Key dependencies and versions
3. **Architecture Patterns:** 
   - Overall system architecture (monolith, microservices, etc.)
   - Key architectural decisions and rationale
   - Component/module organization
4. **API Design Standards:** 
   - API style and conventions (REST, GraphQL, etc.)
   - Naming conventions for endpoints and parameters
   - Request/response format standards
   - Error handling patterns
5. **Authentication & Authorization:** 
   - Authentication mechanism (JWT, OAuth, etc.)
   - Authorization model and permission levels
   - Session management approach
6. **Security Requirements:** 
   - Data encryption standards (in-transit and at-rest)
   - OWASP compliance or security standards
   - API key management
   - PII/sensitive data handling
   - Audit and compliance considerations
7. **Data & Database Guidelines:** 
   - Database selection and schema patterns
   - Naming conventions for tables/collections
   - Query optimization expectations
   - Backup and recovery strategy
8. **Integration Methods:** 
   - External service integrations
   - Integration patterns (webhooks, polling, event-driven, etc.)
   - Retry logic and failure handling
9. **Code Organization & Structure:** 
   - Folder/file structure conventions
   - Module boundaries
   - Naming conventions
   - File organization patterns
10. **Design Patterns & Principles:** 
    - Preferred design patterns (Repository, Factory, Observer, etc.)
    - SOLID principles or other coding standards
    - DRY, KISS, YAGNI principles application
11. **Testing Strategy:** 
    - Testing framework and tools
    - Testing pyramid (unit, integration, E2E percentages)
    - Minimum coverage expectations
    - Mock and stub strategies
12. **Code Quality & Standards:** 
    - Linting and formatting tools
    - Static analysis tools
    - Code review standards
    - Documentation standards (comments, docstrings)
13. **Deployment & DevOps:** 
    - Deployment environments (dev, staging, production)
    - CI/CD pipeline approach
    - Infrastructure-as-Code practices
    - Container orchestration (if applicable)
14. **Monitoring, Logging & Observability:** 
    - Logging levels and standards
    - Logging framework and tools
    - Monitoring and alerting approach
    - Error tracking and reporting
15. **Performance & Scalability:** 
    - Response time targets
    - Throughput expectations
    - Caching strategies
    - Database optimization approaches
16. **Dependency Management:** 
    - How dependencies are managed and updated
    - Version pinning strategy
    - Security vulnerability scanning
17. **Development Workflow:** 
    - Git branching strategy (Git Flow, GitHub Flow, etc.)
    - Commit message conventions
    - PR/MR review process
18. **Known Constraints & Trade-offs:** 
    - Technical limitations
    - Trade-offs made in favor of other considerations
    - Reasons for specific framework or tool choices

## Target Audience

The primary audience is the **development team**. These guidelines should be clear and actionable for developers implementing features.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/` (in the working repository)
- **Filename:** `technical-guidelines.md`

## Final Instructions

1. Do NOT start implementing anything
2. Ask the user clarifying questions to define all major technical decisions
3. Use their answers to create a comprehensive Technical Guidelines document
4. Present the document for user review and iteration
5. Save the finalized version