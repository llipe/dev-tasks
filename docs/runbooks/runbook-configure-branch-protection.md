---
name: runbook-configure-branch-protection
trigger: dev-tasks was just installed in a repository, or an agent is about to be given write access to one whose default branch is unprotected.
owner: github-ops
last_verified: 2026-09-19
related: []
---

# Configure branch protection on the default branch

The `git-guard` and `branch-guard` hooks are advisory, best-effort, local
pattern checks over a command string or a tool-input shape. They narrow the
window; they are not the gate. Branch protection is the only control that is
server-side and unbypassable by any tool surface — `gh`, raw `git`, or an MCP
server. Configure it before an agent works in the repository.

## Preconditions

- `gh` is installed and authenticated: `gh auth status`.
- You have admin rights on the repository. Without them the API call returns
  403 and nothing is configured.
- You know the default branch name. Do not assume `main`:

  ```bash
  gh repo view --json defaultBranchRef -q .defaultBranchRef.name
  ```

## Steps

1. Set the branch protection rule, substituting owner, repo, and the default
   branch you just resolved:

   ```bash
   gh api repos/<owner>/<repo>/branches/<default-branch>/protection \
     --method PUT \
     -f required_pull_request_reviews.required_approving_review_count=1 \
     -F required_status_checks='{"strict":true,"contexts":[]}' \
     -F enforce_admins=true \
     -F restrictions=null \
     -F allow_force_pushes=false \
     -F allow_deletions=false
   ```

2. Equivalent UI path, if you prefer it: **Settings → Branches → Branch
   protection rules → Add rule**. Require a pull request, require 1 approving
   review, require status checks, disable force-pushes, disable deletions.

3. Once CI exists, add its check names to `contexts` so a red build blocks the
   merge. An empty `contexts` list requires _no_ checks — `strict: true` alone
   only requires the branch to be up to date.

## Verification

```bash
gh api repos/<owner>/<repo>/branches/<default-branch>/protection \
  -q '{reviews: .required_pull_request_reviews.required_approving_review_count,
       force_push: .allow_force_pushes.enabled,
       deletions: .allow_deletions.enabled,
       admins: .enforce_admins.enabled}'
```

Expect `reviews: 1`, `force_push: false`, `deletions: false`,
`admins: true`.

Then prove it from the other side, which is the check that actually matters:

```bash
git push --force origin <default-branch>
```

It must be rejected by the remote. If it succeeds, the rule is not in effect
and nothing above is true.

## Rollback

```bash
gh api repos/<owner>/<repo>/branches/<default-branch>/protection --method DELETE
```

Removing protection is instant and total. Do it only to replace the rule, not
to land a change — a change that needs protection removed is a change that
needs a pull request.

## Escalation

A 403 means you are not an admin: ask a repository or organization owner to
run it. A 404 on a repository you can see usually means the branch name is
wrong — re-resolve the default branch rather than guessing. For organization
policies that override repository rules, escalate to the org owner; a
repository rule cannot loosen an org-level ruleset.
