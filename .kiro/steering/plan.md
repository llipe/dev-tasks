---
inclusion: fileMatch
fileMatchPattern: "workstream/**"
---

# Activity: Plan Implementation

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Convert selected User Stories or a refined GitHub Issue into a structured, execution-ready task list. The task list drives the **implement** activity and keeps the GitHub Issue checklist in sync.

This activity adapts to the input — it works with a user stories file (from the PRD workflow) or a refined issue (from the single-issue workflow).

## Mode Detection

| Input                               | Mode             | Source                                                           |
| ----------------------------------- | ---------------- | ---------------------------------------------------------------- |
| User stories file + story selection | **Stories Mode** | `user-stories-[prd-name].md`                                     |
| Refined GitHub Issue                | **Issue Mode**   | `issue-[number]-[name]-refinement.md` or the GitHub Issue itself |

## Process

1. **Receive Context:** User provides the reference to the source document.
2. **Review Available Work:** You **MUST** read the source and list available stories or the issue scope.
3. **Select Scope:** In Stories Mode, you **MUST** ask which stories to include. In Issue Mode, the scope is the single issue.
4. **Generate Task List:** You **MUST** produce a `tasks-*.md` file in the required format.
5. **Publish to GitHub:** You **MUST** update the corresponding GitHub Issue(s) with the task checklist by delegating to `github-ops` whenever possible.
6. **Save Output.**

## Package Manager and Command Standards

- For JavaScript/TypeScript repositories, you **MUST** prefer `pnpm` over `npm` for install and script execution.
- You **MAY** fall back to `npm` only when `pnpm` is unavailable or the project is explicitly npm-locked.
- Generated tasks for JS/TS projects **MUST** use canonical `package.json` script names when available:
  - `lint`, `lint:fix`
  - `format`, `format:check`
  - `typecheck`
  - `test`, `test:unit`, `test:integration`, `test:e2e`
  - `audit`
  - `validate` (aggregate gate script)

## Clarifying Questions

- In Stories Mode: "Which stories would you like to include? (Recommended: 1-3 stories)"
- "Should I update the GitHub Issues with the task checklist now (delegating to github-ops)?"
- "Is this a greenfield/new project, or an existing codebase?"
- "Are there specific implementation details or dependencies I should consider?"
- "Do any selected stories involve data model creation? What sample/seed data should be included?"

## Output Format

The task list **MUST** follow this structure:

```markdown
# Implementation Plan - [Name]

## Relevant Files

- `path/to/file1.ts` - [Description]
- `path/to/file2.ts` - [Description]

## Tasks

- [ ] 1.0 Implement Story [ID]: [Story Title] (or: Implement Issue [#] - [Github_Issue_URL]: [Title])
  - [ ] 1.1 [First implementation step]
  - [ ] 1.2 [Second implementation step]
  - [ ] 1.x Verify Acceptance Criterion: [Criterion 1]
  - [ ] 1.y Verify Acceptance Criterion: [Criterion 2]
  - [ ] 1.z Run Tests: [Test Requirements]

- [ ] 2.0 Implement Story [ID]: [Story Title] (or: Implement Issue [#] - [Github_Issue_URL]: [Title])
  - [ ] 2.1 [First implementation step]
  - ...
```

## Conversion Guidelines

When converting a **User Story** or **Refined Issue** to a **Parent Task**:

1. **Title:** You **MUST** use the format `Implement Story [ID]: [Title]` or `Implement Issue [#]: [Title]`.
2. **Sub-tasks:**
   - You **MUST** convert every item in the **Implementation Steps** section into a sub-task.
   - You **MUST** add explicit sub-tasks for each **Acceptance Criterion** verification.

- You **MUST** add explicit sub-tasks for each **Testing** requirement (unit/integration/manual/edge cases).
- You **MUST** include explicit validation means for each major behavior:
  - Automated verification (test command or script).
  - Manual/UI verification path when user-visible behavior is affected.
- You **MUST** include an acceptance-criteria-to-tests mapping step so each AC is explicitly covered.
- For JS/TS repositories, testing and quality tasks **MUST** reference canonical script names (`pnpm run <script>` preferred).
- If schema or data-model changes are involved, migration tasks are **required by default**; omission is allowed only with an explicit documented opt-out rationale.
- Migration flows **MUST** include: create migration artifact, document rollback/impact, request user confirmation before apply, apply migration after confirmation, and verify applied state.
- If the story involves data models, you **SHOULD** include a sub-task to generate seed data.

3. **Context:** You **MAY** add a `> Note:` block under the parent task for quick reference (User Story text or Business Rules), but the checkbox structure **MUST** remain clean.
4. **Relevant Files:** You **MUST** aggregate all "Files to Create/Modify" from selected stories into the top-level `Relevant Files` section.

## Greenfield Project — Task 0

If this is a **greenfield project** or a **new component**, you **MUST** include a **Task 0: Project Setup** as the first parent task:

```markdown
- [ ] 0.0 Project Setup
  - [ ] 0.1 Initialize project structure and package management
  - [ ] 0.2 Set up version control and repository structure
  - [ ] 0.3 Configure environment variables (.env, .env.example)
  - [ ] 0.4 Set up development environment (dependencies, build tools, linting, formatting)
  - [ ] 0.5 Create initial documentation (README, CONTRIBUTING, setup instructions)
  - [ ] 0.6 Create seed data generation script (if using database)
  - [ ] 0.7 Verify local development environment works (test build, tests pass, seed data loads)
  - [ ] 0.8 Publish initial project to GitHub (if not already done)
```

**When to include Task 0:**

- ✅ First time setting up a new repository
- ✅ Starting a new microservice or component
- ✅ Setting up isolated development environment for greenfield features
- ✅ Database setup with initial schema
- ❌ Extensions to existing projects (skip if dependencies already installed)

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/workstream/`
- **Filename:**
  - Stories Mode: `tasks-[prd-name]-plan.md`
  - Issue Mode: `tasks-issue-[issue-number]-[issue-name].md`

## Final Instructions

1. You **MUST NOT** start implementing.
2. You **MUST** read the source document (user stories or refined issue).
3. In Stories Mode, you **MUST** list available stories and ask the user for their selection.
4. You **MUST** convert the selection into the strict task list format.
5. You **MUST** ensure all Implementation Steps, Acceptance Criteria, and Testing requirements are preserved as sub-tasks.
6. For JS/TS repositories, you **MUST** prefer `pnpm` commands and canonical script names in generated tasks.
7. You **MUST** ensure each task includes both implementation and test/validation steps, including edge-case validation.
8. For schema/data-model changes, you **MUST** include migration lifecycle tasks and an explicit user-confirmation gate before applying migrations unless an opt-out rationale is documented.
9. You **MUST** update the corresponding GitHub Issue(s) with the task checklist by delegating to `github-ops` whenever possible. If no issue exists, you **MUST** ask the user whether to create one first.
10. You **MUST** save the task list file.
11. You **MUST** inform the user they can now use the **implement** activity to start coding.
