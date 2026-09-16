#!/usr/bin/env bash
# dev-tasks PreToolUse guard for Bash commands.
#
# Enforces four repository invariants deterministically (not left to the model):
#   1. No agent may merge or push into the repository's default branch (resolved
#      dynamically — see resolve_default_branch() below; falls back to `main`).
#      This covers `git push`, `git merge` while HEAD is the default branch,
#      `gh pr merge` (base resolved via `gh pr view`, not a `--base` text check),
#      `gh pr merge --admin` (blocked outright), `gh pr merge --auto` when the
#      resolved base is the default branch, and the raw-git escape of merging a
#      `story/*`/`issue/*` branch directly into an `integration/*` branch (the
#      reviewable path is `gh pr merge <n> --squash --delete-branch`).
#   2. `git commit` messages must follow Conventional Commits.
#   3. `gh issue|pr create|edit|comment|review` must not pass a multi-line body
#      inline via `--body`; `--body-file` (or stdin `--body-file -`) is required.
#   4. Tags are human-only: no agent may create, move, delete, or push a tag,
#      or cut a GitHub release. Reading tags (`git tag -l`, `git describe`) is
#      allowed. The tag-push detector matches an exact `vX.Y.Z` ref position
#      (bare token or refspec destination), not any substring, so a branch
#      named e.g. `issue/42-bump-v1.2.3` is not misdetected as a tag push.
#
# Contract: receives the PreToolUse hook payload as JSON on stdin. Exit code 2
# blocks the tool call and returns stderr to Claude as feedback; exit 0 allows.
# Any unexpected error exits 0 (fail-open) so the guard never wedges a session.
#
# Fail-open exception (rule 1 only): resolving a `gh pr merge`'s base branch
# requires calling `gh pr view`. If that lookup fails for any reason — `gh`
# missing, unauthenticated, network error — this rule fails CLOSED (blocks the
# merge) instead of open, because failing open here would let an unreviewed PR
# merge into the default branch go through undetected. Every other rule in
# this script keeps the global fail-open contract.

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

# Resolve the repository's default branch. Cached in $__default_branch_cache
# so repeated calls in one invocation only do the work once. Order: local
# symbolic-ref (no network) -> `gh repo view` (network, only if needed) ->
# literal fallback "main".
__default_branch_cache=""
resolve_default_branch() {
  if [ -n "$__default_branch_cache" ]; then
    printf '%s' "$__default_branch_cache"
    return 0
  fi
  local ref branch
  ref="$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || true)"
  branch="${ref##*/}"
  if [ -z "$branch" ] && command -v gh >/dev/null 2>&1; then
    branch="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || true)"
  fi
  [ -z "$branch" ] && branch="main"
  __default_branch_cache="$branch"
  printf '%s' "$branch"
}

# Does any `git push` destination token in $norm equal $1? Checks bare tokens
# and the destination (right-hand) side of `src:dst` refspecs; strips a
# leading `+` (force-push shorthand) before comparing. Flags are skipped.
push_targets_ref() {
  local target="$1" rest tok dst
  rest="$(printf '%s' "$norm" | sed -n 's/.*git[[:space:]][[:space:]]*push[[:space:]][[:space:]]*//p')"
  for tok in $rest; do
    case "$tok" in
      -*) continue ;;
    esac
    tok="${tok#+}"
    dst="${tok##*:}"
    if [ "$tok" = "$target" ] || [ "$dst" = "$target" ]; then
      return 0
    fi
  done
  return 1
}

# First non-flag token after `git merge` (the ref being merged).
git_merge_arg() {
  local rest tok
  rest="$(printf '%s' "$norm" | sed -n 's/.*git[[:space:]][[:space:]]*merge[[:space:]][[:space:]]*//p')"
  for tok in $rest; do
    case "$tok" in
      -*) continue ;;
    esac
    printf '%s' "$tok"
    return 0
  done
  printf ''
}

# Strip known ref-qualifying prefixes (`refs/heads/`, `remotes/<remote>/`, or
# a bare `<remote>/` shorthand as in `origin/story/1-x`) from a merge argument
# so the story/issue check recognizes the ref-qualified forms documented as
# canonical merge syntax in .claude/skills/git-ops/SKILL.md (e.g. `git merge
# origin/story/1-x`) identically to the bare `story/1-x` form. Without this,
# `git merge origin/story/1-x`, `git merge remotes/origin/story/1-x`, and
# `git merge refs/heads/story/1-x` all bypassed the rule 1b block entirely.
strip_merge_ref_prefix() {
  local ref="$1" candidate
  ref="${ref#refs/heads/}"
  case "$ref" in
    remotes/*)
      ref="${ref#remotes/}"
      ref="${ref#*/}"
      ;;
  esac
  case "$ref" in
    story/*|issue/*) : ;;
    */*)
      candidate="${ref#*/}"
      case "$candidate" in
        story/*|issue/*) ref="$candidate" ;;
      esac
      ;;
  esac
  printf '%s' "$ref"
}

# Extract a `gh pr merge` PR number: a digit-only token right after `merge`,
# or a `#123` reference anywhere in the command. Empty if none given (the
# command then targets the current branch's PR).
gh_pr_merge_number() {
  local rest tok
  rest="$(printf '%s' "$norm" | sed -n 's/.*gh[[:space:]][[:space:]]*pr[[:space:]][[:space:]]*merge[[:space:]][[:space:]]*//p')"
  for tok in $rest; do
    case "$tok" in
      [0-9]*)
        printf '%s' "${tok%%[!0-9]*}"
        return 0
        ;;
      '#'[0-9]*)
        printf '%s' "${tok#\#}"
        return 0
        ;;
      -*) continue ;;
      *) break ;;
    esac
  done
  printf ''
}

# First non-flag token after `gh pr merge`, whatever its shape: a bare PR
# number, a `#123` reference, a branch name, or a PR URL. `gh pr merge` (and
# `gh pr view`) accept all four as a valid target. Empty if none given (the
# command then targets the current branch's PR). Used as a fail-closed
# fallback so a branch-name or URL target is verified directly via `gh pr
# view <target>` instead of silently falling back to checking the CURRENT
# branch's PR — which would let a crafted `gh pr merge <other-branch-or-url>`
# merge a different, unverified PR while the guard checks the wrong one.
gh_pr_merge_target() {
  local rest tok
  rest="$(printf '%s' "$norm" | sed -n 's/.*gh[[:space:]][[:space:]]*pr[[:space:]][[:space:]]*merge[[:space:]][[:space:]]*//p')"
  for tok in $rest; do
    case "$tok" in
      -*) continue ;;
    esac
    printf '%s' "$tok"
    return 0
  done
  printf ''
}

# --- Rule 1: never merge/push into the default branch -------------------------

# `git push` targeting the default branch (resolved dynamically; not hardcoded
# to `main` so a repo on `master`/`trunk` is protected identically).
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +push'; then
  default_branch="$(resolve_default_branch)"
  if push_targets_ref "$default_branch"; then
    block "pushing to '$default_branch' is not allowed. Open a PR; only the user may merge into $default_branch."
  fi
fi

# `git merge`: two independent checks.
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +merge([[:space:]]|$)'; then
  current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  default_branch="$(resolve_default_branch)"

  # 1a. Merging INTO the default branch via raw git.
  if [ "$current_branch" = "$default_branch" ]; then
    block "merging into '$default_branch' is not allowed. Only the user may approve and merge PRs into $default_branch."
  fi

  # 1b. Raw-git escape: merging a story/issue branch directly into an
  # integration branch bypasses PR review entirely. This is the confirmed
  # live defect's unreviewable path — block it and name the reviewable one.
  merge_arg="$(strip_merge_ref_prefix "$(git_merge_arg)")"
  case "$current_branch" in
    integration/*)
      case "$merge_arg" in
        story/*|issue/*)
          block "raw 'git merge' of a story/issue branch into an integration branch is not allowed — it bypasses PR review. Use 'gh pr merge <n> --squash --delete-branch' instead."
          ;;
      esac
      ;;
  esac
fi

# `gh pr merge`: resolve the PR's actual base via `gh pr view` (the `--base`
# flag does not exist on `gh pr merge` — it belongs to `gh pr create` — so a
# text check for it was always vacuous and blocked the tool's own canonical
# merge command). Fails CLOSED if the lookup itself fails; see header.
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])gh +pr +merge([[:space:]]|$)'; then
  # `--admin` bypasses branch protection outright; never allowed for agents.
  if printf '%s' "$norm" | grep -Eq -- '(^|[[:space:]])--admin([[:space:]]|$)'; then
    block "'gh pr merge --admin' bypasses branch protection and is not allowed for agents."
  fi

  pr_num="$(gh_pr_merge_number)"
  pr_target="$(gh_pr_merge_target)"
  if [ -n "$pr_num" ]; then
    # Bare number or `#123` reference.
    view_arg="$pr_num"
  elif [ -n "$pr_target" ]; then
    # Non-numeric token: a branch name or PR URL. Both are valid `gh pr view`
    # arguments — pass the target straight through rather than falling back
    # to the current branch's PR (see gh_pr_merge_target header).
    view_arg="$pr_target"
  else
    view_arg=""
  fi

  if [ -n "$view_arg" ]; then
    verify_cmd="gh pr view $view_arg --json baseRefName -q .baseRefName"
  else
    verify_cmd="gh pr view --json baseRefName -q .baseRefName"
  fi

  base=""
  lookup_ok=0
  if command -v gh >/dev/null 2>&1; then
    if [ -n "$view_arg" ]; then
      base="$(gh pr view "$view_arg" --json baseRefName -q .baseRefName 2>/dev/null)" && lookup_ok=1
    else
      base="$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null)" && lookup_ok=1
    fi
  fi

  if [ "$lookup_ok" -ne 1 ] || [ -z "$base" ]; then
    # Fail-closed exception to this script's default fail-open contract —
    # see header. An unverifiable base must not be treated as safe.
    block "could not verify the PR's base branch via '$verify_cmd' (gh missing, unauthenticated, or a network error). Refusing to merge (fail-closed): an unverified base could be the default branch."
  fi

  default_branch="$(resolve_default_branch)"
  if [ "$base" = "$default_branch" ]; then
    block "merging a PR into '$default_branch' is not allowed. Only the user may merge into $default_branch."
  fi

  # `--auto` on a PR whose base is the default branch defers an unapproved
  # merge rather than preventing one — same block, just scheduled.
  if printf '%s' "$norm" | grep -Eq -- '(^|[[:space:]])--auto([[:space:]]|$)' && [ "$base" = "$default_branch" ]; then
    block "'gh pr merge --auto' on a PR targeting '$default_branch' is not allowed. Only the user may merge into $default_branch."
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

# --- Rule 3: no inline --body on gh issue/PR create|edit|comment|review ------
# PR/issue bodies passed as an inline `--body "..."` argument are a recurring
# source of flattened markdown: multi-line strings get word-split or have
# their newlines stripped depending on how the shell assembled them upstream.
# `--body-file <path>` (including `--body-file -` fed from a real file) is the
# only path that reliably preserves headings/line-breaks. See github-ops docs
# ("Multi-Line Body Formatting") for the full rationale.
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])gh +(issue|pr) +(create|edit|comment|review)([[:space:]]|$)'; then
  if printf '%s' "$norm" | grep -Eq -- '(^|[[:space:]])--body([[:space:]=]|$)' \
     && ! printf '%s' "$norm" | grep -Eq -- '--body-file'; then
    block "gh issue/pr create|edit|comment|review must not pass '--body' inline. Write the body to a file and pass '--body-file <path>' (or pipe into '--body-file -'). See github-ops 'Multi-Line Body Formatting'."
  fi
fi

# --- Rule 4: tags are human-only ---------------------------------------------
# Agents may not create, move, delete, or force tags, push tags, or cut a
# GitHub release. Reading tags is allowed: `git tag -l`, `git tag --list`,
# `git tag -n`, `git tag` with no args, and `git describe --tags`.
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +tag([[:space:]]|$)'; then
  # Allow pure list/read forms.
  if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +tag +(-l|--list|-n[0-9]*)([[:space:]]|$)'; then
    :
  elif printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +tag[[:space:]]*$'; then
    : # `git tag` with no further arguments lists tags.
  else
    block "creating, moving, deleting, or forcing a git tag is not allowed. Tags are human-only, annotated, and point at a 'main' commit. See github-ops 'Tags'."
  fi
fi

# Block tag pushes: `--tags`, refs/tags/*, or a push whose destination token
# (bare, or the right-hand side of a `src:dst` refspec) is an exact `vX.Y.Z`
# ref — not merely a substring, so a branch like `issue/42-bump-v1.2.3` is not
# misdetected as a tag push.
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +push'; then
  is_tag_push=0
  if printf '%s' "$norm" | grep -Eq -- '--tags'; then
    is_tag_push=1
  elif printf '%s' "$norm" | grep -Eq 'refs/tags/'; then
    is_tag_push=1
  else
    rest="$(printf '%s' "$norm" | sed -n 's/.*git[[:space:]][[:space:]]*push[[:space:]][[:space:]]*//p')"
    for tok in $rest; do
      case "$tok" in
        -*) continue ;;
      esac
      tok="${tok#+}"
      dst="${tok##*:}"
      if printf '%s' "$dst" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
        is_tag_push=1
        break
      fi
    done
  fi
  if [ "$is_tag_push" -eq 1 ]; then
    block "pushing a tag is not allowed. Tags are created and pushed by a human only. See github-ops 'Tags'."
  fi
fi

# Block `gh release create` (cutting a release implies creating a tag).
if printf '%s' "$norm" | grep -Eq 'gh +release +create'; then
  block "cutting a GitHub release is human-only (it creates a tag). See github-ops 'Tags'."
fi

exit 0
