---
name: activity-init
description: "Establish product.md and tech.md foundation docs. Use in product-engineer Init Mode."
---

# Activity: Initialize Project Foundation

Establish the foundational documents for a project: Product Context and Technical Guidelines. Use this skill when starting a new project, performing a strategic pivot, or refreshing stale foundation documents. Invoked by the `product-engineer` agent in Init Mode.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Guide an AI assistant in establishing the foundational documents for a project: **Product Context** and **Technical Guidelines**. These documents serve as the "constitution" for all future development — every PRD, specification, user story, and implementation decision **SHOULD** be informed by them.

Run this activity **once per project** (or when a major strategic or technical pivot occurs).

## Foundation Document Names

The canonical names are **`docs/product.md`** and **`docs/tech.md`**. Create and reference those names only.

**Fallback, one release cycle (FR-45, `shared-understanding#D-42`).** These documents were renamed from `docs/product-context.md` and `docs/technical-guidelines.md`. A consumer repository installed before the rename still carries the old names, and `dev-tasks update` never renames a consumer-owned file on its own. So when reading a foundation document: resolve `docs/product.md` first and fall back to `docs/product-context.md` only if the new name is absent; likewise `docs/tech.md`, then `docs/technical-guidelines.md`. When writing, always write the new name.

On encountering the old names, propose `dev-tasks migrate docs`, which performs the rename with content unchanged. Do not rename a consumer's files without being asked. The fallback is removed one release cycle after the rename ships (tracked in issue #201); after that the proposal is the only path.

## Repository Setup — Branch Protection (Required)

Before or alongside establishing the foundation documents, verify the repository's default branch has GitHub branch protection configured. This is not optional hardening — it is the actual gate for "no agent merges into the default branch." Every hook shipped with dev-tasks (`git-guard.sh`, `branch-guard.sh`, and their Kiro equivalents) is a best-effort, advisory, local check that can be evaded by a sufficiently creative command or tool-input shape, and Copilot has no hook system at all; only a server-side branch protection rule is unbypassable by any tool surface.

Check with `gh api repos/<owner>/<repo>/branches/<default-branch>/protection` (a 404 means it is not configured). If missing, tell the user and offer to configure it:

- Require a pull request before merging
- Require at least 1 approving review
- Require status checks to pass before merging
- Disable force-pushes and branch deletion on the default branch

See the README "Configure branch protection" step for the exact `gh api` invocation. You **MUST NOT** proceed to treat the project as fully initialized while branch protection remains unconfigured without the user's explicit acknowledgment.

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

## Mode Detection

Before starting the interview, the skill **MUST** detect the repository mode and route accordingly. The detection logic is:

1. **Documented-repository mode:** `/docs` directory exists → interview + direct docs generation.
   This mode is about whether documentation exists, not about how many packages the repository has. Repository *shape* (single-package or monorepo) is detected separately — see Repository Shape Detection below. The mode was called "Mono-Repo" until `shared-understanding#D-44` renamed it to free the term.
2. **Undocumented / greenfield mode:** no `/docs` → investigation-first flow to bootstrap documentation from the codebase, then interview.

---

## Mode A — Documented Repository (Current Flow)

When `/docs` exists, the skill follows the **existing single-repo flow** unchanged.

### Process

1. **Receive Initial Brief:** The user describes the product, project, or technology stack.
2. **Ask Clarifying Questions:** Gather information for both product context and technical guidelines in a single interview. Group questions by domain.
3. **Generate Product Document:** Create `docs/product.md` using the structure below.
4. **Generate Technical Document:** Create `docs/tech.md` using the structure below.
5. **Save Output:** Save both documents in `/docs/` and present them for user review.

---

## Mode B — Undocumented / Greenfield

When `/docs` does not exist, the repository has no established documentation. The skill investigates the codebase directly before conducting the interview.

### Process

1. **Investigate the codebase:** Read manifest files (`package.json`, `pyproject.toml`, `go.mod`, or equivalent), the directory structure, the README, and any existing configuration to identify the technology stack, frameworks, and conventions in use.
2. **Present a findings summary:** Show the user what was found — stack, frameworks, notable directories, confidence per finding — before the interview.
3. **Conduct the interview:** Proceed with the standard clarifying questions for product and technical context (same as documented-repository mode).
4. **Generate documents:** Create `docs/product.md` and `docs/tech.md` using the investigation findings as pre-filled context combined with interview answers.
5. **Save Output:** Save both documents in `/docs/` and present them for user review.

### Constraints

- The investigation findings inform but do not replace the interview — the user confirms and supplements.
- If the repository has no identifiable stack (an empty project), skip investigation and proceed directly to the interview (pure greenfield).

---

---

## Repository Shape Detection

Before the interview, detect the repository's **shape**. This is independent of the mode above: a documented repository can be either shape, and so can a greenfield one.

Detect from these signals (FR-59):

| Signal | Read for |
| ------ | -------- |
| `pnpm-workspace.yaml` | Shape **and** the package list |
| `workspaces` in `package.json` | Shape **and** the package list |
| `turbo.json` | Shape only |
| `nx.json` | Shape only |
| `lerna.json` | Shape only |
| `[tool.uv.workspace]` in `pyproject.toml` | Shape only |

Any signal present → **monorepo**. No signal → **single-package**.

Only the first two are parsed for a package list. When a repository signals monorepo through one of the other four, ask the user which packages exist rather than guessing.

`core/distribution/workspace.ts` exports `detectWorkspace(repoRoot)`, which returns the shape, the signals found, and the packages. Use it rather than re-deriving the answer.

### Package Map

Record the result in `docs/tech.md` as a **Package Map** section, one row per package:

```markdown
## Package Map

| Package | Path | Purpose | Owner | Canonical scripts | Bounded context |
| ------- | ---- | ------- | ----- | ----------------- | --------------- |
| @acme/core | packages/core | Shared domain logic | platform | lint, typecheck, test | Ordering |
```

Rules:

- A **single-package repository records exactly one row**, for the root, with path `.`. The table has the same shape in both cases, so a reader never has to work out which kind of repository they are looking at.
- **Purpose** and **Owner** come from the interview. Do not invent an owner; ask.
- **Canonical scripts** lists the scripts the package actually defines, in the order `lint`, `format:check`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `audit`, `validate`. Absent scripts are omitted, not marked missing.
- **Bounded context** is filled **freeform at interview time** (`shared-understanding#D-45`). Ask: *"In one phrase, what part of the business or domain does this package own?"* A freeform guess beats an empty column. Phase 3's glossary supersedes these answers with canonical terms; until then this column is a working label, not a contract.
- A package whose `package.json` has no `name` is listed by its path. Do not invent a name — nothing would match it.

`dev-tasks doctor` warns when the map and the workspace disagree in either direction: a package on disk with no row, or a row for a package that no longer exists. It warns and never fails; structural failures belong to `lint`.

---

### Runbooks

Initialization also establishes `docs/runbooks/` (PRD AC-26, S-005 AC-7). Create:

- `docs/runbooks/README.md` — the index, with Runbook / Trigger / Owner / Last verified columns.
- `docs/runbooks/runbook-template.md` — the form to copy for a new procedure.

`dev-tasks install` delivers both install-if-absent, so in an installed repository they are already present and **MUST NOT** be overwritten. Create them only when absent, and confirm with the user which procedures are worth a runbook now rather than writing placeholder files.

## SIMPLICITY.md Confirmation

`SIMPLICITY.md` ships at the repository root and states the code-simplicity contract, including section D's tool-enforced thresholds. During initialization you **MUST** confirm two things with the user rather than assuming them:

1. **Owner** — who is accountable for the contract. The shipped default is `housekeeping`.
2. **Thresholds** — section D's defaults (function length ≤ 40 lines, cyclomatic complexity ≤ 10, cognitive complexity ≤ 15, nesting depth ≤ 3, parameters ≤ 4, file length ≤ 400 lines). A repository **MAY** tighten a default; it **MUST NOT** loosen one.

Ask: *"SIMPLICITY.md's owner is `housekeeping` and its thresholds are the shipped defaults. Keep both, or tighten anything?"* Record the answer in the file's frontmatter and in the section D table. Wiring the thresholds into a linter is a separate procedure — see `docs/runbooks/runbook-setup-simplicity-tooling.md`.

## Part 1 — Product Context

### Clarifying Questions

Adapt questions based on context already gathered (e.g., from codebase investigation in greenfield mode):

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

### Output Structure: `docs/product.md`

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

### Output Structure: `docs/tech.md`

0. **Changelog** — Version history table (see Document Changelog Convention above)
1. **Overview** — Technical vision and guiding principles
2. **Package Map** — Repository shape and one row per package (see Repository Shape Detection above)
3. **Technology Stack** — Backend/frontend languages, frameworks, databases, key dependencies
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
- **Filenames:** `product.md`, `tech.md`

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
