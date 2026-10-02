#!/usr/bin/env bash
# dev-tasks PreToolUse guard for Kiro shell/runCommand tools.
#
# Best-effort port of .claude/hooks/git-guard.sh, enforcing the same three
# repository invariants:
#   1. No agent may merge or push into the default branch `main`.
#   2. `git commit` messages must follow Conventional Commits.
#   3. `gh issue|pr create|edit|comment|review` must not pass a multi-line body
#      inline via `--body`; `--body-file` (or stdin `--body-file -`) is required.
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

# Split the raw command into simple-command segments, one per output line,
# at `&&`, `||`, `;`, `|`, `&`, and newlines outside single or double quotes
# (backslash escapes honored). Every rule that reads a command's arguments
# reads them from its own segment, never from the rest of the string. Before
# this, `git push -u origin feat && gh pr create --base main` read `main` as
# a push destination, `--tags` anywhere in the string read as a tag push, and
# a greedy `.*git push` match checked only the LAST push in a chained
# command, so `git push origin main && git push origin feat` was allowed
# (issue #256). Portable awk only: macOS ships BSD awk, not gawk.
command_segments() {
  printf '%s\n' "$cmd" | awk '
    { s = s (NR > 1 ? "\n" : "") $0 }
    END {
      out = ""; q = ""; n = length(s)
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (q != "") {
          out = out c
          if (c == q) q = ""
          else if (c == "\\" && q == "\"" && i < n) { i++; out = out substr(s, i, 1) }
          continue
        }
        if (c == "\\" && i < n) { out = out c substr(s, i + 1, 1); i++; continue }
        if (c == "\"" || c == "\047") { q = c; out = out c; continue }
        if (c == ";" || c == "|" || c == "&" || c == "\n") { out = out "\n"; continue }
        out = out c
      }
      print out
    }'
}

# Segments matching the extended regex $1, whitespace-normalized, one per line.
segments_matching() {
  command_segments | tr -s ' \t' '  ' | grep -E -- "$1"
}

# Argument tokens following EACH `git push` in segment $1, one per line.
# Quotes, backticks, parentheses, and separators are stripped from tokens so
# `$(git push origin main)` and `bash -c "git push origin main"` still yield
# `main`. Every occurrence in the segment is read, not just the last one.
push_tokens() {
  printf '%s\n' "$1" | awk '{ n = split($0, parts, /git[ \t]+push/); for (i = 2; i <= n; i++) print parts[i] }' \
    | tr -s ' \t' '\n\n' | tr -d "\"'\`();|&" | grep -v '^$'
}

# A segment runs `git push` when the words appear at its start, after
# whitespace, or after an opening quote, backtick, or parenthesis.
_push_segment_re="(^|[[:space:](\`\"'])git +push([[:space:]]|$)"

# Does any `git push` destination in the command equal branch $1? Reads each
# push segment's own tokens only; checks bare tokens and the right-hand side
# of `src:dst` refspecs, stripping a leading `+` and a `refs/heads/` prefix.
push_targets_ref() {
  local target="$1" seg tok dst
  while IFS= read -r seg; do
    while IFS= read -r tok; do
      case "$tok" in
        -*) continue ;;
      esac
      tok="${tok#+}"
      dst="${tok##*:}"
      tok="${tok#refs/heads/}"
      dst="${dst#refs/heads/}"
      if [ "$tok" = "$target" ] || [ "$dst" = "$target" ]; then
        return 0
      fi
    done < <(push_tokens "$seg")
  done < <(segments_matching "$_push_segment_re")
  return 1
}

# --- Rule 1: never merge/push into main ---------------------------------------
# Block a push whose destination is main, and any merge/PR-merge that targets
# main. Branch-creation and normal feature pushes are unaffected, including a
# feature push chained with `gh pr create --base main` (issue #256).
if push_targets_ref main; then
  block "pushing to 'main' is not allowed. Open a PR; only the user may merge into main."
fi

# `git merge` while the checked-out branch is main (i.e. merging INTO main).
if printf '%s' "$norm" | grep -Eq '(^|[;&|[:space:]])git +merge([[:space:]]|$)'; then
  current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  if [ "$current_branch" = "main" ]; then
    block "merging into 'main' is not allowed. Only the user may approve and merge PRs into main."
  fi
fi

# `gh pr merge` targeting main (either via --base main or merging a PR onto main).
# Checked per segment, so a later `gh pr create --base main` in the same
# command is not read as this merge's base (issue #256).
while IFS= read -r _seg; do
  if printf '%s' "$_seg" | grep -Eq -- '--base[ =]main([[:space:]]|$)|-B[ =]main([[:space:]]|$)'; then
    block "merging a PR into 'main' is not allowed. Only the user may merge into main."
  fi
  # No explicit base given: gh defaults to the PR's base. Warn-block to be safe
  # for the common case where PRs target main. Story PRs targeting integration
  # branches should pass --base <integration-branch> explicitly.
  if ! printf '%s' "$_seg" | grep -Eq -- '--base[ =]|-B[ =]'; then
    block "refusing 'gh pr merge' without an explicit --base. PRs to main require user approval; for integration branches pass --base <integration-branch>."
  fi
done < <(segments_matching 'gh +pr +merge')

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

exit 0
