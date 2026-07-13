#!/usr/bin/env bash
# dev-tasks PreToolUse guard for Kiro shell/runCommand tools.
#
# Best-effort port of .claude/hooks/git-guard.sh, enforcing the same two
# repository invariants:
#   1. No agent may merge or push into the default branch `main`.
#   2. `git commit` messages must follow Conventional Commits.
#
# Contract: receives the PreToolUse hook payload as JSON on stdin. Exit code 2
# blocks the tool call; exit 0 allows. Any unexpected error exits 0 (fail-open)
# so the guard never wedges a session.
#
# KNOWN LIMITATION (tracked upstream: kirodotdev/Kiro#7375): Kiro IDE's
# PreToolUse hooks have been reported to receive an empty toolArgs object,
# unlike the Kiro CLI which passes full context. If that affects this
# environment, this script cannot see the actual command being run and
# therefore cannot reliably block anything. Unlike git-guard.sh (which
# silently allows when it has nothing to inspect), this script fails LOUD in
# that case — it prints a warning so the gap is visible rather than creating
# a false sense of enforcement. See README.md and .kiro/steering/ for the
# full disclosure of this gap. Once/if the upstream defect is confirmed
# fixed, the warning branch below simply stops firing — no redesign needed.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# Extract the command string. Field name is not yet confirmed against a live
# Kiro install (spec open question) — try several plausible shapes.
extract_cmd() {
  local p="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r '.toolArgs.command // .tool_input.command // .input.command // .command // empty' <<<"$p" 2>/dev/null || true
  else
    printf '%s' "$p" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//; s/"$//'
  fi
}

cmd="$(extract_cmd "$payload")"

# Nothing to inspect -> cannot enforce. Fail loud, not silent (see header).
if [ -z "${cmd:-}" ]; then
  printf 'dev-tasks git-guard WARNING: no command text available in the PreToolUse payload — the guard cannot inspect this command. This may be the known Kiro toolArgs limitation (kirodotdev/Kiro#7375). PR review is the enforcement backstop until this is resolved.\n' >&2
  exit 0
fi

# Normalize whitespace for matching.
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

block() {
  printf 'BLOCKED by dev-tasks git-guard: %s\n' "$1" >&2
  exit 2
}

# --- Rule 1: never merge/push into main ---------------------------------------
# Block `git push ... main` (pushing to the main branch) and any merge/PR-merge
# that targets main. Branch-creation and normal feature pushes are unaffected.
case "$norm" in
  *"git push"*" main"*|*"git push"*":main"*|*"git push"*" origin main"*|*"git push"*" HEAD:main"*)
    block "pushing to 'main' is not allowed. Open a PR; only the user may merge into main." ;;
esac

# `git merge` while the checked-out branch is main (i.e. merging INTO main).
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +merge([[:space:]]|$)'; then
  current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  if [ "$current_branch" = "main" ]; then
    block "merging into 'main' is not allowed. Only the user may approve and merge PRs into main."
  fi
fi

# `gh pr merge` targeting main (either via --base main or merging a PR onto main).
if printf '%s' "$norm" | grep -Eq 'gh +pr +merge'; then
  if printf '%s' "$norm" | grep -Eq -- '--base[ =]main|-B[ =]main'; then
    block "merging a PR into 'main' is not allowed. Only the user may merge into main."
  fi
  # No explicit base given: gh defaults to the PR's base. Warn-block to be safe
  # for the common case where PRs target main. Story PRs targeting integration
  # branches should pass --base <integration-branch> explicitly.
  if ! printf '%s' "$norm" | grep -Eq -- '--base[ =]|-B[ =]'; then
    block "refusing 'gh pr merge' without an explicit --base. PRs to main require user approval; for integration branches pass --base <integration-branch>."
  fi
fi

# --- Rule 2: Conventional Commits for git commit ------------------------------
# Inspect inline -m / --message messages. Commits via editor or -F file are not
# inspected here (allowed through).
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +commit'; then
  # Pull the first -m / --message "..." or '...' value.
  msg="$(printf '%s' "$cmd" | sed -n "s/.*-m[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1)"
  [ -z "$msg" ] && msg="$(printf '%s' "$cmd" | sed -n "s/.*-m[[:space:]]*'\([^']*\)'.*/\1/p" | head -1)"
  [ -z "$msg" ] && msg="$(printf '%s' "$cmd" | sed -n "s/.*--message[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1)"
  if [ -n "$msg" ]; then
    # type(optional-scope)(optional !): description
    if ! printf '%s' "$msg" | grep -Eq '^(feat|fix|chore|docs|refactor|test|ci|perf|build|style|revert)(\([a-z0-9._-]+\))?!?: .+'; then
      block "commit message must follow Conventional Commits, e.g. 'feat(auth): add password reset'. Got: '$msg'"
    fi
  fi
fi

exit 0
