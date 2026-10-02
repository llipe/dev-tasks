---
name: runbook-diagnose-pr-validate
trigger: The "Validate" check on a pull request failed, or a pull request shows no "Validate" check at all.
owner: developer
last_verified: 2026-10-02
related: [".github/workflows/validate.yml"]
---

# Diagnose the pull request `validate` check

`.github/workflows/validate.yml` runs `pnpm run validate` — the same quality
gate the npm publish job runs — on every pull request, whatever its base
branch. Before it existed, `validate` ran in CI only after a release tag, so a
broken gate surfaced at publish time instead of at review time.

This runbook covers reading a failure and reproducing it locally. It does not
make the check _required_: that is a repository-settings change a human makes
by hand, documented in
[runbook-configure-branch-protection.md](runbook-configure-branch-protection.md).
Until the check is required, a red run informs the reviewer; it does not stop
a merge.

The workflow is read-only (`permissions: contents: read`) and has no secrets,
so a failed or re-run job has no side effects.

## Preconditions

- `gh` installed and authenticated against the repository, to read run logs.
- For local reproduction: Node 24, `pnpm` (the version pinned by
  `packageManager` in `package.json`), and a clean `pnpm install
--frozen-lockfile`. A local `node_modules` that drifted from the lockfile
  can pass where CI fails, or the reverse.
- The pull request's head branch checked out locally, up to date with the
  remote.

## Steps

**What triggers it.** `on: pull_request` with no branch filter: opening,
reopening, or pushing to any pull request, into any base branch — the default
branch or an integration branch alike. A `concurrency` group keyed on the PR
number cancels a run that a newer push has superseded, so a "cancelled" run
next to a newer one is expected, not a failure.

**What each step does.**

1. `actions/checkout@v4` — checks out the PR's merge commit (head merged into
   base), shallow. A failure that does not reproduce on the head branch alone
   may come from the merge with the base: rebase or merge the base locally
   and retry.
2. `pnpm/action-setup@v4` — installs the `pnpm` version named by
   `packageManager` in `package.json`.
3. `actions/setup-node@v4` — Node `24`, with the `pnpm` store cached.
4. `pnpm install --frozen-lockfile` — fails if `pnpm-lock.yaml` disagrees with
   `package.json`. Fix by running `pnpm install` locally and committing the
   updated lockfile.
5. `pnpm run validate` — runs four sub-gates in order and stops at the first
   failure. The log's last `> pnpm run <gate>` line names the one that failed.

**Reading each sub-gate's failure.**

1. Open the failing run's log:

   ```bash
   gh pr checks <pr-number>
   gh run view <run-id> --log-failed
   ```

2. Match the failing sub-gate:

   - **`typecheck`** (`tsc --noEmit`) — `error TS<code>` lines with a
     `file:line:col`. Reproduce with `pnpm run typecheck`.
   - **`lint`** — two parts, in order. ESLint (`--max-warnings 0`, so a
     warning fails too) prints `file:line:col  error|warning  <rule>`. Then
     `tsx core/checks/run.ts` runs the repository's own checks — docs
     structure (runbook filenames, frontmatter, indexes), decision-log tables,
     and similar — and prints the failing rule with the file it names.
     Reproduce with `pnpm run lint`. A docs-structure failure belongs to
     `technical-writer`, not `housekeeping`.
   - **`format:check`** — Prettier lists each unformatted file with `[warn]`.
     It covers `bin/`, `core/`, `test/`, `.claude/`, `.github/`, `.kiro/`,
     and root `*.json`/`*.ts` files. Fix with `pnpm run format`, then commit.
     `.claude/settings.local.json` is ignored on purpose: it exists only on
     some machines, never on the runner.
   - **`test`** (`vitest run`) — a `FAIL <file> > <describe> > <test>` block
     with the assertion diff. Reproduce one file with
     `pnpm exec vitest run <file>`.

3. Reproduce the whole gate locally, exactly as CI runs it:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run validate
   ```

4. Fix, commit, and push. The push starts a new run and cancels any still in
   progress for the same PR.

**Known flaky test.** `test/unit/infra-script-contract.test.ts`, case
`deploy.sh prod — ref rules (AC-4) > refuses when the ref is not an annotated
tag on main`, depends on what `HEAD` is: it expects a refusal, and can fail
when `HEAD` is the tagged release commit. If that is the only failure, re-run
the failed job once before investigating:

```bash
gh run rerun <run-id> --failed
```

A second failure of the same case, or any other failing test, is a real
failure.

## Verification

```bash
gh pr checks <pr-number>
```

The `pnpm run validate` check reports `pass`. The run's log ends with the
`test` sub-gate's summary (`Tests  <n> passed`) and no `ELIFECYCLE` error.

## Rollback

Nothing to roll back: the workflow only reads the repository. To stop the
check from running — for example, while it is broken in a way that blocks
unrelated work — revert the commit that changed
`.github/workflows/validate.yml`, or disable the workflow with
`gh workflow disable validate.yml` and re-enable it with
`gh workflow enable validate.yml` once fixed. If the check is required by
branch protection, disabling it leaves PRs waiting on a check that never
reports; change branch protection first, per
[runbook-configure-branch-protection.md](runbook-configure-branch-protection.md).

## Escalation

When a failure passes locally with a clean `pnpm install --frozen-lockfile`
and the PR's merge commit, collect: the run URL, the output of
`gh run view <run-id> --log-failed`, your local `node --version` and
`pnpm --version`, and the output of local `pnpm run validate`. Open an issue
with that evidence and the `ci` context; environment differences between the
runner and a workstation (shallow checkout, no `.claude/settings.local.json`,
detached `HEAD`) are the usual cause.
