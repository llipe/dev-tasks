# Agent Guidelines

General guidelines for GitHub Copilot agents and AI coding assistants working in this repository.

## Branching Strategy

### Branch Creation (Mandatory)

**Always create a new branch before making any code changes.**

- **Never commit directly to the default branch** (e.g., `main`, `master`)
- Create a descriptive branch name using kebab-case
- Branch from the latest version of the default branch

#### Branch Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| **Feature** | `feature/<description>` or `<description>` | `feature/user-authentication`, `add-payment-gateway` |
| **Bug Fix** | `fix/<description>` or `bugfix/<description>` | `fix/login-error`, `bugfix/null-pointer` |
| **Chore/Maintenance** | `chore/<description>` | `chore/update-dependencies`, `chore/cleanup-logs` |
| **Documentation** | `docs/<description>` | `docs/api-documentation`, `docs/readme-update` |
| **Refactor** | `refactor/<description>` | `refactor/auth-service`, `refactor/database-queries` |
| **GitHub Issue** | `issue-<issue-number>-<description>` | `issue-123-add-user-profile`, `issue-456-fix-memory-leak` |

### Workflow

```bash
# 1. Ensure you're on the default branch and it's up to date
git checkout main
git pull origin main

# 2. Create and switch to a new branch
git checkout -b feature/my-new-feature

# 3. Make your changes and commit (see commit message guidelines below)
git add .
git commit -m "feat: add user authentication flow"

# 4. Push the branch to remote
git push origin feature/my-new-feature

# 5. Create a Pull Request (PR) for review
# Use GitHub UI or CLI to create PR from your branch into the default branch
```

---

## Commit Message Guidelines

Use **Conventional Commits** format for clear, structured commit messages.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| **feat** | New feature or functionality | `feat: add user registration endpoint` |
| **fix** | Bug fix | `fix: resolve authentication token expiration` |
| **docs** | Documentation changes only | `docs: update API usage examples` |
| **style** | Code style/formatting changes (no logic change) | `style: format code with prettier` |
| **refactor** | Code refactoring (no feature change or bug fix) | `refactor: simplify user validation logic` |
| **perf** | Performance improvements | `perf: optimize database queries` |
| **test** | Adding or updating tests | `test: add unit tests for auth service` |
| **chore** | Maintenance, dependencies, config | `chore: upgrade dependencies to latest versions` |
| **ci** | CI/CD configuration changes | `ci: add deploy workflow for staging` |
| **build** | Build system or external dependencies | `build: update webpack configuration` |
| **revert** | Revert a previous commit | `revert: revert "feat: add user registration"` |

### Examples

**Simple commit:**
```bash
git commit -m "feat: add password reset functionality"
```

**With scope:**
```bash
git commit -m "fix(auth): correct token validation logic"
```

**With body and footer:**
```bash
git commit -m "feat: add user profile page

- Create profile component
- Add avatar upload functionality
- Implement bio editing

Closes issue #123"
```

**Referencing GitHub Issues:**
```bash
git commit -m "issue 456: resolve memory leak in data processor

Fixes issue #456"
```

---

## Pull Request (PR) Guidelines

### Creating a PR

1. **Push your branch** to the remote repository
2. **Open a PR** from your branch into the default branch
3. **Never merge your own PR** - always wait for human review and approval

### PR Description Template

A good PR description should include:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- List of specific changes made
- What files were modified and why

## Testing
- How these changes were tested
- Test cases covered

## Related Issues
Closes issue #123
Fixes issue #456

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or breaking changes documented)
```

### PR Title

Use the same convention as commit messages:

- `feat: add user authentication`
- `fix: resolve login redirect issue`
- `docs: update installation guide`

---

## Code Quality Standards

Before creating a PR, ensure:

- [ ] **Code builds successfully** - no compilation errors
- [ ] **Tests pass** - all existing tests continue to pass
- [ ] **Linting passes** - code follows style guidelines
- [ ] **Type checking passes** - no TypeScript/type errors (if applicable)
- [ ] **No console logs or debug code** - clean up temporary debugging code
- [ ] **Documentation updated** - if APIs or features changed
- [ ] **Commits are atomic** - each commit represents a logical unit of change

---

## Code Style

### General Principles

- **Consistency over preference** - Follow existing patterns in the codebase
- **Readability first** - Write code that is easy to understand and maintain
- **Self-documenting code** - Use clear variable/function names; minimize need for comments
- **DRY (Don't Repeat Yourself)** - Extract reusable logic into functions/modules

### Language-Specific Guidelines

_Customize based on your project's stack._

**JavaScript/TypeScript:**
- Use TypeScript strict mode when applicable
- Prefer `const` over `let`; avoid `var`
- Use arrow functions for callbacks and short functions
- Destructure objects and arrays when it improves readability
- Use async/await over raw promises for better readability
- Follow project's ESLint and Prettier configurations

**Python:**
- Follow PEP 8 style guide
- Use type hints for function signatures
- Prefer list/dict comprehensions for simple transformations
- Use context managers (`with` statements) for resource management
- Follow project's ruff/black/isort configurations

### Naming Conventions

- **Files/Modules:** kebab-case (JS/TS) or snake_case (Python)
- **Classes:** PascalCase
- **Functions/Methods:** camelCase (JS/TS) or snake_case (Python)
- **Constants:** UPPER_SNAKE_CASE
- **Private members:** Prefix with `_` (Python) or use TypeScript `private`
- **Boolean variables:** Start with `is`, `has`, `should`, `can`

### Comments and Documentation

- Write comments for **why**, not **what** (code should explain what)
- Document complex algorithms or business logic
- Keep comments up-to-date with code changes
- Use JSDoc/TSDoc (JS/TS) or docstrings (Python) for public APIs
- Remove commented-out code (use git history instead)

### Error Handling

- Use specific exception types, not generic ones
- Handle errors at appropriate levels (don't swallow silently)
- Provide meaningful error messages
- Log errors with context for debugging
- Validate inputs at boundaries (API endpoints, function params)

---

## Git Best Practices

### Do's ✅

- Create descriptive branch names
- Write clear, concise commit messages
- Commit frequently with logical boundaries
- Keep commits atomic (one logical change per commit)
- Pull latest changes from default branch regularly
- Test your changes before committing
- Reference issue numbers in commits and PRs when applicable

### Don'ts ❌

- Don't commit directly to the default branch
- Don't create overly large commits with unrelated changes
- Don't use vague commit messages like "fix bug" or "update code"
- Don't commit sensitive information (keys, passwords, tokens)
- Don't commit commented-out code or TODO comments without context
- Don't merge your own PRs without review
- Don't force push (`git push -f`) to shared branches

---

## Working with GitHub Issues

When a GitHub issue is provided:

1. **Include issue number in branch name:** `issue-123-add-feature`
2. **Reference issue in commits:** `issue 123: implement user authentication`
3. **Reference issue in commit body:** Include `Closes issue #123` or `Fixes issue #123`
4. **Link PR to issue:** Include `Closes issue #123` or `Fixes issue #123` in PR description
5. **Update issue with progress:** Comment on the issue with blockers or questions

---

## Specialized Agent Guidelines

For specific types of work, refer to specialized agent instructions.

---

## Workflow Instructions

For structured AI-assisted development workflows, refer to:

### Primary Workflow (Task-Based Development)
- **Location:** `.github/instructions/primary-workflow/`
- **Purpose:** Simple task-based development with PRD → Tasks → Process workflow
- **Best for:** Straightforward features, quick iterations

### Secondary Workflow (PRD-Spec Driven Development)
- **Location:** `.github/instructions/prd-tech-spec/`
- **Purpose:** Comprehensive workflow with product context, technical specs, and user stories
- **Best for:** Complex features, new projects, establishing technical foundations
- **Steps:**
  1. Define Product Context
  2. Define Technical Guidelines
  3. Create Base PRD
  4. Generate Specification
  5. Generate User Stories
  6. Validate Coverage
  7. Publish User Stories to GitHub
  8. Create Implementation Plan
  9. Execute Task List

Refer to the [README.md](README.md) for detailed workflow documentation.

---

## Emergency Procedures

### If You Accidentally Commit to Default Branch

```bash
# 1. Create a new branch from current state
git branch emergency-fix

# 2. Reset default branch to previous state
git checkout main
git reset --hard origin/main

# 3. Switch to your new branch and continue work
git checkout emergency-fix
```

### If You Need to Undo Last Commit (Not Pushed)

```bash
# Keep changes but undo commit
git reset --soft HEAD~1

# Discard changes and undo commit
git reset --hard HEAD~1
```

---

## Project-Specific Instructions

> **Note:** The following sections should be customized for your specific project's technology stack, tools, and workflows. Replace the placeholder examples with your project's actual commands and requirements.

### Dev Environment Tips

_Customize this section with project-specific setup and workflow tips._

**Example for a monorepo with pnpm + Turbo:**

- Use `pnpm dlx turbo run where <project_name>` to jump to a package instead of scanning with `ls`
- Run `pnpm install --filter <project_name>` to add the package to your workspace so Vite, ESLint, and TypeScript can see it
- Use `pnpm create vite@latest <project_name> -- --template react-ts` to spin up a new React + Vite package with TypeScript checks ready
- Check the name field inside each package's `package.json` to confirm the right name—skip the top-level one

**Template for your project:**

- [Add project-specific navigation commands]
- [Add environment setup instructions]
- [Add tool-specific tips]
- [Add common gotchas or troubleshooting]

---

### Testing Instructions

_Customize this section with project-specific testing workflows and requirements._

**Example for a monorepo with pnpm + Turbo + Vitest:**

- Find the CI plan in the `.github/workflows` folder
- Run `pnpm turbo run test --filter <project_name>` to run every check defined for that package
- From the package root you can just call `pnpm test`. The commit should pass all tests before you merge
- To focus on one step, add the Vitest pattern: `pnpm vitest run -t "<test name>"`
- Fix any test or type errors until the whole suite is green
- After moving files or changing imports, run `pnpm lint --filter <project_name>` to be sure ESLint and TypeScript rules still pass
- Add or update tests for the code you change, even if nobody asked

**Template for your project:**

- [Add commands to run tests locally]
- [Add commands to run specific test suites]
- [Add coverage requirements]
- [Add test file location conventions]
- [Add when to write/update tests]

---

### PR-Specific Instructions

_Customize this section with project-specific PR requirements and formatting._

**Example for a monorepo:**

- **Title format:** `[<project_name>] <Title>`
- Always run `pnpm lint` and `pnpm test` before committing
- Ensure CI passes before requesting review
- Tag relevant reviewers based on changed components

**Template for your project:**

- **Title format:** [Specify your PR title format]
- [Add required checks before committing]
- [Add reviewer assignment guidelines]
- [Add PR size guidelines]
- [Add labeling requirements]

---

## Questions?

When in doubt:
- Ask for clarification before proceeding
- Review existing PRs in the repository for examples
- Check with a human reviewer if you're unsure about the approach

---

**Version:** 1.0  
**Last Updated:** 2026-02-24
