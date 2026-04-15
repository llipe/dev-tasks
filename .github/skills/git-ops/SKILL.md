# Git Operations

Reusable procedures for git branch management, merge, rebase, and conflict resolution. This skill describes *procedures* — merge authority policies remain in `github-ops.agent.md`. Any agent can invoke this skill when encountering git operations.

---

## When to Use

- Creating feature or story branches
- Rebasing a branch onto a target
- Merging PRs or branches
- Resolving merge conflicts
- Recovering from failed git operations

---

## Procedures

### 1. Create Branch from Latest Default

```bash
# Fetch latest remote state
git fetch origin

# Switch to the default branch and pull
git checkout main
git pull origin main

# Create and switch to the new branch
git checkout -b <branch-name>
```

**Naming conventions** (defer to `github-ops` for policy):
- Story branches: `story/<story-id>-<short-description>`
- Issue branches: `issue/<issue-number>-<short-description>`
- Integration branches: `integrate/<milestone-or-prd-name>`

### 2. Create Branch from Integration Branch

When working under a `planner` orchestration with an integration branch:

```bash
git fetch origin
git checkout <integration-branch>
git pull origin <integration-branch>
git checkout -b <story-branch>
```

### 3. Update Branch (Rebase onto Target)

Preferred method to keep a branch up-to-date with its target:

```bash
git fetch origin
git rebase origin/<target-branch>
```

**If conflicts occur** → jump to [Resolve Merge Conflicts](#6-resolve-merge-conflicts).

**If rebase is too complex** (many commits, repeated conflicts), fall back to merge:

```bash
git fetch origin
git merge origin/<target-branch>
```

### 4. Pre-Merge Checks

Before merging any PR or branch, verify:

1. **Branch is up-to-date** with the target:
   ```bash
   git fetch origin
   git log --oneline origin/<target-branch>..HEAD  # should show only your commits
   ```
2. **No merge conflicts**:
   ```bash
   git merge-tree $(git merge-base HEAD origin/<target-branch>) HEAD origin/<target-branch>
   ```
3. **Tests pass locally** (if applicable):
   ```bash
   # Run project-specific test command
   ```
4. **CI status is green** (check via GitHub API or `gh` CLI):
   ```bash
   gh pr checks <pr-number>
   ```

### 5. Merge Strategies

Choose the appropriate strategy based on context:

| Strategy | When to Use | Command |
|----------|------------|---------|
| **Squash merge** | Story/issue PRs → integration or main branch. Produces clean single-commit history. | `gh pr merge <pr> --squash` |
| **Merge commit** | Integration branch → main. Preserves the full story history. | `gh pr merge <pr> --merge` |
| **Rebase merge** | Small PRs with clean linear history. Avoid for multi-commit stories. | `gh pr merge <pr> --rebase` |

**Default**: Squash merge for story PRs, merge commit for integration PRs to main.

### 6. Resolve Merge Conflicts

When a rebase or merge produces conflicts:

#### Step 1: Identify conflicting files

```bash
git diff --name-only --diff-filter=U
```

#### Step 2: For each conflicting file

1. Open the file and locate conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
2. Determine ownership:
   - If the file was primarily modified by the current branch → prefer current branch changes
   - If the file was primarily modified by the target → prefer target changes
   - If both branches made meaningful changes → manual merge required
3. Resolve the conflict by editing the file to the correct final state
4. Remove all conflict markers

#### Step 3: Mark resolved and continue

```bash
# After resolving each file
git add <resolved-file>

# Continue the rebase or complete the merge
git rebase --continue   # if rebasing
git commit              # if merging
```

#### Step 4: Verify

```bash
# Ensure no remaining conflict markers in the codebase
grep -rn '<<<<<<<\|=======\|>>>>>>>' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.md' .

# Run tests to verify the resolution is correct
```

### 7. Recovery from Failed Rebase

If a rebase goes wrong or produces unexpected results:

```bash
# Abort the in-progress rebase
git rebase --abort

# Verify you're back to the pre-rebase state
git log --oneline -5
git status
```

If you already completed a bad rebase:

```bash
# Find the pre-rebase commit using reflog
git reflog

# Reset to the state before the rebase
git reset --hard <pre-rebase-sha>
```

**Always report** what happened to the user before and after recovery.

### 8. Recovery from Failed Merge

```bash
# Abort an in-progress merge
git merge --abort

# Verify clean state
git status
```

If a merge was already committed but is wrong:

```bash
# Revert the merge commit (keeps history clean)
git revert -m 1 <merge-commit-sha>
```

### 9. Force Push Safety

Force pushing **MUST** only be used on branches owned exclusively by the current agent/developer. Never force push shared branches.

```bash
# Safe force push (fails if someone else pushed)
git push --force-with-lease origin <branch-name>
```

**Never use** `git push --force` without `--with-lease`.

---

## Conflict Resolution Heuristics

When resolving conflicts automatically, apply these heuristics in order:

1. **Non-overlapping changes**: Accept both sides (most common — different parts of the file changed)
2. **Import/dependency additions**: Accept both sides (both branches added different imports)
3. **Configuration file conflicts**: Merge both entries, ensure no duplicates
4. **Schema/migration conflicts**: **Stop and ask the user** — schema conflicts require human judgment
5. **Test file conflicts**: Accept both sides if tests are additive; flag if test logic conflicts
6. **Business logic conflicts**: **Stop and ask the user** — business logic requires human judgment

---

## Integration with Agents

| Agent | Typical Usage |
|-------|--------------|
| `developer` | Branch creation, rebase before PR, conflict resolution during implementation |
| `planner` | Integration branch management, merging story PRs, rebasing integration onto main |
| `github-ops` | PR merge execution (policy enforcement stays with github-ops, procedures come from this skill) |
