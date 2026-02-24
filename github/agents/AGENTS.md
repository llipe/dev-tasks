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
| **GitHub Issue** | `<issue-number>-<description>` | `123-add-user-profile`, `456-fix-memory-leak` |

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

Closes #123"
```

**Referencing GitHub Issues:**
```bash
git commit -m "fix: resolve memory leak in data processor

Fixes #456"
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
Closes #123
Fixes #456

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

1. **Include issue number in branch name:** `123-add-feature`
2. **Reference issue in commits:** `#123: implement user authentication`
3. **Link PR to issue:** Include `Closes #123` or `Fixes #123` in PR description
4. **Update issue with progress:** Comment on the issue with blockers or questions

---

## Specialized Agent Guidelines

For specific types of work, refer to specialized agent instructions:

- **Tech Debt & Upgrades:** See [`tech-debt-fixer.md`](./tech-debt-fixer.md) for dependency upgrades and technical debt remediation

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

## Questions?

When in doubt:
- Ask for clarification before proceeding
- Review existing PRs in the repository for examples
- Check with a human reviewer if you're unsure about the approach

---

**Version:** 1.0  
**Last Updated:** 2026-02-24
