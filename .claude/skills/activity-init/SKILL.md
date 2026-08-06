---
name: activity-init
description: "Establish product-context.md and technical-guidelines.md foundation docs. Use in product-engineer Init Mode."
---

# Activity: Initialize Project Foundation

Establish the foundational documents for a project: Product Context and Technical Guidelines. Use this skill when starting a new project, performing a strategic pivot, or refreshing stale foundation documents. Invoked by the `product-engineer` agent in Init Mode.

---

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

| Version | Date       | Summary         | Author             |
| ------- | ---------- | --------------- | ------------------ |
| 1.0     | YYYY-MM-DD | Initial version | @user / agent-name |
```

---

## Mode Detection (RF-60)

Before starting the interview, the skill **MUST** detect the repository mode and route accordingly. The detection logic is:

1. **Multi-repo mode:** `component.json` exists at the repository root → the repository is a component in a multi-repo product. Context resolution passes exclusively through `dt`.
2. **Mono-repo mode:** no `component.json` at root, but `/docs` directory exists → current single-repo flow (interview + direct docs generation).
3. **Undocumented / greenfield mode:** neither `component.json` nor `/docs` → extraction-first flow to bootstrap documentation from code, then interview.

> **Precedence:** If both `component.json` AND `/docs` exist, multi-repo mode wins — `component.json` is the authoritative signal.

---

## Mode A — Multi-Repo (RF-61)

When `component.json` is present at the repo root, the skill **MUST** delegate all context resolution to `dt` and **MUST NOT** read `/docs` or walk the repository directly.

### Process

1. **Invoke `dt init --task "<user's task/product description>" --json`**.
2. **Handle exit codes:**

   | Exit Code | Meaning                         | Action                                                                                                                                                                                                           |
   | --------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `0`       | Success — bundle emitted        | Load bundle files in numeric order. Present `review_flags` (if any) to the user before proceeding to planning. Continue to the interview for product context and technical guidelines using the bundle as input. |
   | `7`       | Gate abort — partition proposal | Present the partition proposal to the user. Explain that the scope is too broad and needs to be split. **Stop** — do not proceed to planning.                                                                    |
   | `9`       | Stale catalog index             | Inform the user that the catalog index is stale and needs to be rebuilt (e.g., `dt catalog build`). **Stop** — do not proceed.                                                                                   |
   | `10`      | Invalid scope after LLM retry   | Inform the user that automatic scoping failed. Suggest running with `--components` for manual scope. **Stop.**                                                                                                   |
   | `11`      | No candidates found             | Inform the user that no components matched the task description. Suggest refining the task text or using `--components`. **Stop.**                                                                               |
   | `6`       | Budget overflow                 | Inform the user that the scoped context exceeds the token budget. Suggest narrowing scope with `--max-components` or `--budget`. **Stop.**                                                                       |

3. **On success (exit 0):**
   - Load the assembled bundle files in numeric order (they form the context).
   - If `review_flags` are present in the JSON output, present them as warnings to the user (e.g., "scope spans >2 domains", "low-payload boundary contract") and ask whether to proceed.
   - Use the bundle content as the basis for the product-context and technical-guidelines interview — the bundle replaces direct `/docs` reading.

### Constraints

- The skill **MUST NOT** read `/docs`, walk the repository tree, or inspect source files directly in multi-repo mode.
- All context comes from the `dt init` bundle output.
- The skill **MAY** ask follow-up questions to fill gaps not covered by the bundle (e.g., strategic goals, success metrics).

---

## Mode B — Mono-Repo (Current Flow)

When no `component.json` is present but `/docs` exists, the skill follows the **existing single-repo flow** unchanged.

### Process

1. **Receive Initial Brief:** The user describes the product, project, or technology stack.
2. **Ask Clarifying Questions:** Gather information for both product context and technical guidelines in a single interview. Group questions by domain.
3. **Generate Product Context Document:** Create `product-context.md` using the structure below.
4. **Generate Technical Guidelines Document:** Create `technical-guidelines.md` using the structure below.
5. **Save Output:** Save both documents in `/docs/` and present them for user review.

---

## Mode C — Undocumented / Greenfield

When neither `component.json` nor `/docs` exists, the repository has no established documentation. The skill bootstraps documentation from code extraction before conducting the interview.

### Process

1. **Run detection:** Invoke `dt extract detect` to identify the repository's technology stack, frameworks, and extractable artifacts.
2. **Run extraction:** Invoke `dt extract all --interactive` to extract schema, OpenAPI, AsyncAPI, and component manifest from the codebase.
   - The `--interactive` flag allows the user to confirm or skip ambiguous extractions.
   - If interrupted, the skill **SHOULD** inform the user how to resume (`dt extract all --interactive` picks up where it left off).
3. **Present extraction report:** Show the user the results of extraction — what was found, confidence levels, any `unresolved` items.
4. **Conduct the interview:** Proceed with the standard clarifying questions for product context and technical guidelines (same as Mono-Repo mode).
5. **Generate documents:** Create `product-context.md` and `technical-guidelines.md` using the extraction results as pre-filled context combined with interview answers.
6. **Save Output:** Save both documents in `/docs/` and present them for user review.

### Constraints

- The extraction results inform but do not replace the interview — the user confirms and supplements.
- If `dt extract detect` reports that no extractable content was found (empty project), skip extraction and proceed directly to the interview (pure greenfield).

---

## Part 1 — Product Context

### Clarifying Questions

Adapt questions based on context provided (and based on mode — in multi-repo mode, the bundle already provides some answers):

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
- **Package Manager Standard:** "Can we standardize on `pnpm` for JS/TS projects?"
- **Script Naming Standard:** "Should canonical `package.json` scripts (`lint`, `format:check`, `typecheck`, `test`, `audit`, `validate`) be enforced?"

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

### JS/TS Package Manager and Script Defaults

When the project includes JavaScript/TypeScript:

- `pnpm` **MUST** be the default package manager.
- `npm` **MAY** be used only when `pnpm` is unavailable or explicitly disallowed by project constraints.
- `package.json` scripts **SHOULD** include canonical names:
  - `lint`, `lint:fix`
  - `format`, `format:check`
  - `typecheck`
  - `test`, `test:unit`, `test:integration`, `test:e2e`
  - `audit`
  - `validate` (aggregate quality gate script)

---

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/`
- **Filenames:** `product-context.md`, `technical-guidelines.md`

## AGENTS.md Sizing

When generating or updating `AGENTS.md` during project initialization, you **MUST** follow the sizing guidelines in `docs/agents-md-guidelines.md`:

- Target ~1,000 words (~1,350 tokens)
- Include only operational per-turn guidance (agent roster, skill roster, instructions table, general rules)
- Move reference content (workflow chains, prompt tables, verbose explanations) to `docs/`

## Final Instructions

1. You **MUST** detect the repository mode before starting (see Mode Detection above).
2. You **MUST NOT** start implementing anything.
3. You **MUST** ask clarifying questions to fill gaps — cover both product and technical domains.
4. You **SHOULD** use answers to create both documents in a single pass.
5. You **MUST** save both files and present them for user review.
6. You **SHOULD** iterate based on user feedback before finalizing.
7. When updating an existing document, you **MUST** add a new row to the Changelog table with an incremented version, the current date, a summary of changes, and the responsible author/agent.
8. In multi-repo mode, you **MUST NOT** read `/docs` or walk the repository directly — all context passes through `dt init`.
