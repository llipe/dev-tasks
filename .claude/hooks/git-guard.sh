#!/usr/bin/env bash
# dev-tasks PreToolUse guard for Bash commands.
#
# Enforces two repository invariants deterministically (not left to the model):
#   1. No agent may merge or push into the default branch `main`.
#   2. `git commit` messages must follow Conventional Commits.
#
# Contract: receives the PreToolUse hook payload as JSON on stdin. Exit code 2
# blocks the tool call and returns stderr to Claude as feedback; exit 0 allows.
# Any unexpected error exits 0 (fail-open) so the guard never wedges a session.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# Extract the command string. Prefer jq; fall back to a permissive grep.
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
else
  cmd="$(printf '%s' "$payload" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//; s/"$//')"
fi

# Nothing to inspect -> allow.
[ -z "${cmd:-}" ] && exit 0

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
