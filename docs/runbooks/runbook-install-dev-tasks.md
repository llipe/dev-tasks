---
name: runbook-install-dev-tasks
trigger: A repository needs the dev-tasks agent toolkit for the first time, or an existing install needs to be moved to a different platform profile.
owner: developer
last_verified: 2026-09-19
related: []
---

# Install dev-tasks into a repository

Installs agent definitions, skills, and hooks for one or more platforms, and
writes `.dev-tasks/manifest.json` so later updates can tell your edits from
ours. This is not the procedure for upgrading an existing install — that is
`dev-tasks update`.

## Preconditions

- Node >= 24 and git >= 2.37. `dev-tasks doctor` reports both.
- The repository is a git working tree with a clean status. Install writes
  many files; reviewing them against a dirty tree is miserable.
- You know which profile you want: `copilot`, `claude`, `kiro`, `both`
  (copilot + claude), or `all` (default).

## Steps

1. Install the CLI, or run it without installing:

   ```bash
   pnpm add -D @llipe.com/dev-tasks
   pnpm exec dev-tasks --version
   ```

2. Check the environment before writing anything:

   ```bash
   pnpm exec dev-tasks doctor
   ```

3. Install for your platform:

   ```bash
   pnpm exec dev-tasks install --profile all
   ```

   Add `--pin <version>` to lock the repository to a release.

4. Configure branch protection. The shipped hooks are advisory only — see
   `runbook-configure-branch-protection.md`. Do this before letting an agent
   work in the repository, not after.

5. Initialize project context: invoke `product-engineer` in Init Mode to
   create `docs/product.md` and `docs/tech.md`.

## Verification

```bash
pnpm exec dev-tasks status
git status --short
```

`status` reports an installed version. `git status` shows the platform
directories you asked for and nothing from a profile you did not.

`CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, and the `docs/runbooks/`
scaffold are delivered install-if-absent: present after a fresh install,
untouched if you already had them.

## Rollback

Install writes new files rather than mutating history, so `git checkout .`
and `git clean -fd` on a previously clean tree removes everything it wrote.
Delete `.dev-tasks/` to remove the manifest as well. Nothing outside the
repository is touched, and no package registry state changes.

## Escalation

Open an issue at https://github.com/llipe/dev-tasks with the output of
`dev-tasks doctor --json`, the exact `install` command, and the resulting
`git status --short`. A partial install is reproducible from those three.
