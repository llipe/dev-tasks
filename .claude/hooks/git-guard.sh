#!/usr/bin/env bash
# dev-tasks PreToolUse guard for Bash commands AND the mutating GitHub MCP
# tool surface (see Rule 5 below).
#
# Enforces five repository invariants deterministically (not left to the model):
#   1. No agent may merge or push into the repository's default branch (resolved
#      dynamically — see resolve_default_branch() below; falls back to `main`).
#      This covers `git push`, `git merge` while HEAD is the default branch,
#      `gh pr merge` (base resolved via `gh pr view`, not a `--base` text check),
#      `gh pr merge --admin` (blocked outright), `gh pr merge --auto` when the
#      resolved base is the default branch, and the raw-git escape of merging a
#      `story/*`/`issue/*` branch directly into an `integration/*` branch (the
#      reviewable path is `gh pr merge <n> --merge --delete-branch`).
#   2. `git commit` messages must follow Conventional Commits.
#   3. `gh issue|pr create|edit|comment|review` must not pass a multi-line body
#      inline via `--body`; `--body-file` (or stdin `--body-file -`) is required.
#   4. Tags are human-only: no agent may create, move, delete, or push a tag,
#      or cut a GitHub release. Reading tags (`git tag -l`, `git describe`) is
#      allowed. The tag-push detector matches an exact `vX.Y.Z` ref position
#      (bare token or refspec destination), not any substring, so a branch
#      named e.g. `issue/42-bump-v1.2.3` is not misdetected as a tag push.
#
# Rules 1 and 4 read each command's arguments from its own simple-command
# segment (split at `&&`, `||`, `;`, `|`, `&`, and newlines outside quotes —
# see executed_view()), never from the rest of the command string. A
# chained `gh pr create --base main` is not a push to `main`, a `--tags` in a
# commit message is not a tag push, and every push or merge in a chain is
# checked, not only the last one (issue #256).
#
# Executed view (issue #339). Rules 1 and 4 judge only text that bash runs:
#   - Quoted heredocs (`<<'ID'`, `<<"ID"`, `<<-'ID'`, ID a plain identifier)
#     are read as heredocs. Their body lines are never parsed for quotes or
#     separators, so an apostrophe in a body cannot glue later commands
#     together. An unquoted delimiter (`<<EOF`) and a `<<<` here-string are
#     expanded by bash and are never relaxed.
#   - A command is relaxed only when every segment's first word is on the
#     allow-list `git`, `gh`, `echo`, `printf`, `cat`. Then heredoc bodies and
#     `echo`/`printf`/`cat` arguments are ignored; `git` and `gh` arguments
#     are always kept.
#   - Anything that could run code keeps the whole command strict (the
#     pre-#339 reading, where heredoc body lines are read as commands, so
#     `bash <<'EOF'` stays blocked): `$(`, a backtick, `$[`, `${`, `<(`, `>(`,
#     an assignment prefix (`X=1 cmd`), or a runner or interpreter word
#     anywhere (`bash`, `sh`, `eval`, `source`, `.`, `env`, `command`, `exec`,
#     `xargs`, `sudo`, `nohup`, `time`, `python*`, `node`, `fish`, ...).
#     Triggers inside a quoted heredoc body are ignored, since bash never
#     expands it; single-quoted text elsewhere still counts.
#   - Also strict, failing toward the old reading on any doubt: `$'`, `!`,
#     a comment (`#` at a word start), any other `<<`, an open quote, an
#     unterminated heredoc, two heredocs on one line, `printf -v`, `git -c`,
#     `--config-env` or `--exec-path`, a path naming `.git/`, `hook` or
#     `.husky`, and text fed by a pipe or heredoc to anything but `git commit`,
#     `gh issue` or `gh pr` (an alias or extension cannot shadow a built-in).
# Rules 2 (Conventional Commits) and 3 (inline `--body`) deliberately read
# argument text and do not use the executed view. `--body-file <path>`
# remains the recommended way to pass an issue or PR body.
#
#   5. (Issue #178) The same "no write to the default branch" invariant as
#      rule 1, enforced on the mutating GitHub MCP tool surface, not just
#      `Bash`. Before this rule, `.claude/settings.json` matched `"Bash"`
#      only, so any consumer with the GitHub MCP server enabled had NO
#      enforcement whatsoever on `mcp__github__merge_pull_request`,
#      `enable_pr_auto_merge`, `push_files`, `create_or_update_file`,
#      `delete_file`, or `create_branch` — a total bypass of rules 1-4 on
#      that tool surface. This rule is dispatched on the PreToolUse payload's
#      structured `tool_name` field (an exact match against the six names
#      above) and reads the matching structured `tool_input` fields directly
#      (`pullNumber`, `owner`, `repo`, `branch`) — never a regex over a
#      stringified `tool_input` blob, since MCP calls arrive as real JSON,
#      not a shell command string that needs tokenizing.
#
# Contract: receives the PreToolUse hook payload as JSON on stdin. Exit code 2
# blocks the tool call and returns stderr to Claude as feedback; exit 0 allows.
# Any unexpected error exits 0 (fail-open) so the guard never wedges a session.
#
# Fail-open exception (rules 1 and 5 only): resolving a `gh pr merge` (or
# `mcp__github__merge_pull_request` / `enable_pr_auto_merge`) PR's base
# branch requires calling `gh pr view`. If that lookup fails for any reason —
# `gh` missing, unauthenticated, network error, or (rule 5 only) the MCP
# payload not carrying enough information to identify the PR at all — this
# rule fails CLOSED (blocks the call) instead of open, because failing open
# here would let an unreviewed PR merge into the default branch go through
# undetected. Every other rule in this script keeps the global fail-open
# contract. Rule 5's jq dependency is a further, narrower fail-open
# exception: MCP `tool_input` is structured JSON with fields that can
# legitimately contain arbitrary text (commit messages, file contents), so
# unlike rule 1-4's flat command-string parsing, correctly reading them
# requires a real JSON parser — if `jq` is unavailable, rule 5 fails open
# (skips its checks) rather than falling back to a regex over stringified
# JSON, which was rejected as unsafe for exactly this task's fields.
#
# Scope and limits: this is a best-effort, defense-in-depth LOCAL check over
# shell command TEXT (rules 1-4) and structured tool_input JSON (rule 5) — a
# flag-aware tokenizer plus pattern matching for the former, direct field
# access for the latter — not a real shell parser and not a completeness
# guarantee against every possible flag/argument/payload construction an
# agent (or a determined adversary) could produce. Rounds of independent
# audit against this file have repeatedly found and closed specific bypasses
# (ref-qualified merge targets, value-consuming flags whose value was
# mistaken for the real argument, the MCP bypass rule 5 now closes, etc.) —
# that pattern is expected to continue: text-based command parsing can
# always be evaded by a sufficiently creative future command form, in this
# script or any script like it, and a new mutating tool surface (a different
# MCP server, a future first-party tool) can always reopen the same class of
# gap rule 5 closes today. Server-side branch protection on the remote
# (tracked separately, outside this file) is the actual durable control;
# this hook narrows the window and catches the common cases, it does not
# replace that control.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# --- Rule 5 dispatch: mutating GitHub MCP tool surface -----------------------
# Extract tool_name. Prefer jq; fall back to a permissive grep (tool_name is
# always a flat top-level string, so the grep fallback is safe here — unlike
# the richer tool_input fields rule 5 needs below, which require jq).
if command -v jq >/dev/null 2>&1; then
  tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty' 2>/dev/null || true)"
else
  tool_name="$(printf '%s' "$payload" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//; s/"$//')"
fi

mcp_block() {
  printf 'BLOCKED by dev-tasks git-guard (rule 5, MCP): %s\n' "$1" >&2
  exit 2
}

# Resolve the repository's default branch. Cached in $__default_branch_cache
# so repeated calls in one invocation only do the work once. Order: local
# symbolic-ref (no network) -> `gh repo view` (network, only if needed) ->
# literal fallback "main". Defined here (ahead of the rule 5 dispatch below,
# which needs it) rather than down near rule 1 — both rules share it.
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

case "$tool_name" in
  mcp__github__merge_pull_request | mcp__github__enable_pr_auto_merge)
    if ! command -v jq >/dev/null 2>&1; then
      exit 0 # fail-open: cannot safely read structured tool_input without jq.
    fi
    pr_number="$(printf '%s' "$payload" | jq -r '.tool_input.pullNumber // .tool_input.pull_number // empty' 2>/dev/null || true)"
    owner="$(printf '%s' "$payload" | jq -r '.tool_input.owner // empty' 2>/dev/null || true)"
    repo_name="$(printf '%s' "$payload" | jq -r '.tool_input.repo // empty' 2>/dev/null || true)"

    if [ -z "$pr_number" ]; then
      mcp_block "could not identify the pull request (missing 'pullNumber' in tool_input). Refusing (fail-closed): an unidentified PR could target the default branch. Do not retry with a different tool or command to work around this — stop and ask the user to supply the PR number, or merge it themselves."
    fi

    base=""
    lookup_ok=0
    if command -v gh >/dev/null 2>&1; then
      if [ -n "$owner" ] && [ -n "$repo_name" ]; then
        base="$(gh pr view "$pr_number" --repo "$owner/$repo_name" --json baseRefName -q .baseRefName 2>/dev/null)" && lookup_ok=1
      else
        base="$(gh pr view "$pr_number" --json baseRefName -q .baseRefName 2>/dev/null)" && lookup_ok=1
      fi
    fi

    if [ "$lookup_ok" -ne 1 ] || [ -z "$base" ]; then
      mcp_block "could not verify PR #$pr_number's base branch via 'gh pr view' (gh missing, unauthenticated, or a network error). Refusing to proceed (fail-closed): an unverified base could be the default branch. Do not fall back to an unverified merge path — stop and ask the user to check 'gh auth status'/network access, or merge it themselves."
    fi

    default_branch="$(resolve_default_branch)"
    if [ "$base" = "$default_branch" ]; then
      if [ "$tool_name" = "mcp__github__enable_pr_auto_merge" ]; then
        mcp_block "enabling auto-merge on a PR targeting '$default_branch' is not allowed. Only the user may merge into $default_branch."
      fi
      mcp_block "merging a PR into '$default_branch' via the MCP tool is not allowed. Only the user may merge into $default_branch."
    fi
    exit 0
    ;;
  mcp__github__push_files | mcp__github__create_or_update_file | mcp__github__delete_file)
    if ! command -v jq >/dev/null 2>&1; then
      exit 0 # fail-open: cannot safely read structured tool_input without jq.
    fi
    target_branch="$(printf '%s' "$payload" | jq -r '.tool_input.branch // empty' 2>/dev/null || true)"
    default_branch="$(resolve_default_branch)"
    # A missing/empty `branch` is not a safe "not the default branch" case:
    # the GitHub Contents/push-files API commits directly to the repository's
    # default branch when `branch` is omitted, so an absent value is exactly
    # as unsafe as an explicit match and must be blocked identically.
    if [ -z "$target_branch" ] || [ "$target_branch" = "$default_branch" ]; then
      display="${target_branch:-$default_branch (implicit — no 'branch' given)}"
      mcp_block "$tool_name would write to '$default_branch' (target: '$display'). Only the user may commit directly to $default_branch; write to a feature branch and open a PR."
    fi
    exit 0
    ;;
  mcp__github__create_branch)
    if ! command -v jq >/dev/null 2>&1; then
      exit 0 # fail-open: cannot safely read structured tool_input without jq.
    fi
    new_branch="$(printf '%s' "$payload" | jq -r '.tool_input.branch // empty' 2>/dev/null || true)"
    default_branch="$(resolve_default_branch)"
    # Case-fold both sides: a branch named e.g. 'Main' or 'MAIN' is just as
    # unsafe as an exact 'main' match on case-insensitive-aware remotes/tools
    # and must be blocked identically.
    new_branch_lc="$(printf '%s' "$new_branch" | tr '[:upper:]' '[:lower:]')"
    default_branch_lc="$(printf '%s' "$default_branch" | tr '[:upper:]' '[:lower:]')"
    if [ -n "$new_branch" ] && [ "$new_branch_lc" = "$default_branch_lc" ]; then
      mcp_block "creating a branch named '$default_branch' (the default branch) via the MCP tool is not allowed. Create a feature branch instead (e.g. 'issue/<n>-short-description' or 'story/<id>-short-description')."
    fi
    exit 0
    ;;
esac

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

# resolve_default_branch() is defined above, ahead of the rule 5 MCP
# dispatch block, since both rule 1 (below) and rule 5 share it.

# Quote-aware token splitter: splits $1 into tokens honoring shell quoting so
# a flag value containing an embedded space (e.g. `-m "merge note"` or
# `--body "some text"`) becomes a single token instead of splitting on that
# space — one token per output line. Built on `xargs -n1`, which only ever
# passes each token through to `printf '%s\n'`; it never evaluates or
# executes any part of the input, so untrusted command text cannot trigger
# code execution through this path (unlike e.g. `eval`).
tokenize() {
  printf '%s' "$1" | xargs -n1 -- printf '%s\n' 2>/dev/null
}

# Build the executed view of the raw command (issue #339). Prints the mode,
# `relaxed` or `strict`, on line one, then one simple-command segment per
# line. Segments split at `&&`, `||`, `;`, `|`, `&`, and newlines outside
# single or double quotes (backslash escapes honored; `>&`, `<&` and `&>` are
# redirections, not separators), so every rule that reads a command's
# arguments reads them from its own segment, never from the rest of the
# string (issue #256).
#
# Quoted heredocs (`<<'ID'`, `<<"ID"`, `<<-'ID'`, ID a plain identifier) are
# read as heredocs: their body lines are never parsed for quotes or
# separators, so an apostrophe in a body (`don't`) cannot open a phantom quote
# that glues later commands together.
#
# relaxed: every segment's first word is `git`, `gh`, `echo`, `printf` or
#   `cat`, and nothing in the command can run code (see the header for the
#   triggers). Heredoc bodies are dropped and `echo`/`printf`/`cat` segments
#   are cut to their first word, since bash never runs that text. `git` and
#   `gh` segments are kept whole.
# strict: anything else, or any doubt. Every segment is kept, and each heredoc
#   body line is a segment of its own (backslash-newline joined), so
#   `bash <<'EOF'` with a push in the body stays blocked. This is the
#   pre-#339 view except for the heredoc body handling.
#
# Portable awk only: macOS ships BSD awk, not gawk.
executed_view() {
  printf '%s\n' "$cmd" | awk '
    function flush() {
      k++; seg[k] = cur; body[k] = 0; fed[k] = cur_fed
      cur = ""; cur_fed = 0; started = 0
    }
    function emit(ch) {
      if (!started && ch != " " && ch != "\t") {
        started = 1; cur_fed = pipe_pending; pipe_pending = 0
      }
      cur = cur ch
    }
    function add_body(line) { k++; seg[k] = line; body[k] = 1 }
    # Read the pending heredoc bodies that start after the newline at i.
    function read_bodies(   p, m, e, line, cmp, closed, acc) {
      p = i + 1
      for (m = 1; m <= npend; m++) {
        closed = 0; acc = ""
        while (p <= n) {
          e = index(substr(s, p), "\n")
          if (e == 0) { line = substr(s, p); p = n + 1 }
          else { line = substr(s, p, e - 1); p = p + e }
          cmp = line
          if (pdash[m]) sub(/^\t+/, "", cmp)
          if (cmp == pid[m]) { closed = 1; break }
          if (line ~ /\\$/) { acc = acc substr(line, 1, length(line) - 1); continue }
          add_body(acc line); acc = ""
        }
        if (acc != "") add_body(acc)
        if (!closed) { strict = 1; break }
      }
      npend = 0
      i = p - 1
    }
    { s = s (NR > 1 ? "\n" : "") $0 }
    END {
      n = length(s); q = ""; prev = ""; k = 0; cur = ""; started = 0
      cur_fed = 0; pipe_pending = 0; npend = 0; line_openers = 0; strict = 0
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1); c2 = substr(s, i, 2)
        # Strictness triggers, anywhere outside a quoted heredoc body
        # (bodies are consumed by read_bodies and never reach this loop).
        if (c2 == "$(" || c2 == "$[" || c2 == "${" || c2 == "$\047" ||
            c2 == "<(" || c2 == ">(" || c2 == "<<" || c == "`" || c == "!") {
          if (!(q == "" && c2 == "<<")) strict = 1
        }
        if (q != "") {
          # Inside quotes a newline is part of the argument, never a
          # separator: map it to a space so the segment stays whole.
          if (c == "\n") { if (npend) strict = 1; emit(" "); continue }
          if (c == q) { q = ""; emit(c); prev = c; continue }
          if (c == "\\" && q == "\"" && i < n) {
            d = substr(s, i + 1, 1); i++
            if (d != "\n") { emit(c); emit(d) }   # backslash-newline is a continuation
            continue
          }
          emit(c)
          continue
        }
        if (c == "\\" && i < n) {
          d = substr(s, i + 1, 1); i++
          if (d != "\n") { emit(c); emit(d); prev = d }   # backslash-newline is a continuation
          continue
        }
        # A word-start `#` opens a comment: keep the pre-#339 reading.
        if (c == "#" && (prev == "" || prev ~ /[ \t\n;&|()]/)) strict = 1
        if (c == "\"" || c == "\047") { q = c; emit(c); prev = c; continue }
        if (c2 == "<<") {
          if (substr(s, i + 2, 1) == "<") {   # a here-string
            strict = 1; emit("<"); emit("<"); emit("<"); i += 2; prev = "<"; continue
          }
          j = i + 2; dash = 0; ok = 0
          if (substr(s, j, 1) == "-") { dash = 1; j++ }
          while (substr(s, j, 1) == " " || substr(s, j, 1) == "\t") j++
          oq = substr(s, j, 1)
          if (oq == "\047" || oq == "\"") {
            e = index(substr(s, j + 1), oq)
            if (e > 0) {
              id = substr(s, j + 1, e - 1); after = substr(s, j + e + 1, 1)
              if (id ~ /^[A-Za-z_][A-Za-z0-9_]*$/ && (after == "" || after ~ /[ \t\n;&|<>)]/)) ok = 1
            }
          }
          if (!ok) { strict = 1; emit(c); prev = c; continue }   # unquoted, arithmetic, ...
          if (++line_openers > 1) strict = 1   # two heredocs on one line
          npend++; pid[npend] = id; pdash[npend] = dash
          for (m = i; m <= j + e; m++) emit(substr(s, m, 1))
          cur_fed = 1   # the heredoc feeds this segment
          i = j + e; prev = oq
          continue
        }
        if (c == "&" && (prev == ">" || prev == "<" || substr(s, i + 1, 1) == ">")) {
          emit(c); prev = c; continue
        }
        if (c == "|" && substr(s, i + 1, 1) == "|") {   # `||` is not a pipe
          flush(); i++; prev = c; continue
        }
        if (c == ";" || c == "|" || c == "&" || c == "\n") {
          flush(); prev = c
          if (c == "|") pipe_pending = 1
          if (c == "\n") { line_openers = 0; if (npend) read_bodies() }
          continue
        }
        emit(c); prev = c
      }
      if (q != "" || npend) strict = 1   # an open quote or an unread heredoc
      flush()

      split("git gh echo printf cat", a, " ")
      for (m in a) allow[a[m]] = 1
      split("bash sh zsh ksh dash ash mksh fish csh tcsh busybox eval source . exec env command builtin xargs sudo doas su nohup time nice ionice timeout setsid stdbuf unbuffer watch parallel script chroot ssh trap node nodejs deno bun perl ruby php lua luajit osascript awk gawk mawk nawk sed tclsh wish expect", a, " ")
      for (m in a) runner[a[m]] = 1
      text = ""
      for (m = 1; m <= k; m++) {
        if (body[m]) continue
        t = seg[m]; sub(/^[ \t]+/, "", t)
        if (t == "") continue
        text = text " " t
        nw = split(t, w, /[ \t]+/)
        if (!(w[1] in allow)) strict = 1
        # Text fed to git or gh is data only for these built-ins; an alias
        # or extension cannot shadow a built-in.
        if (fed[m] && w[1] == "git" && w[2] != "commit") strict = 1
        if (fed[m] && w[1] == "gh" && w[2] != "issue" && w[2] != "pr") strict = 1
        if (w[1] == "printf" && w[2] == "-v") strict = 1
        if (w[1] == "git") {
          for (x = 2; x <= nw; x++) if (w[x] == "-c" || w[x] ~ /^--(config-env|exec-path)/) strict = 1
        }
      }
      low = tolower(text)
      if (index(low, ".git/") || index(low, "hook") || index(low, ".husky")) strict = 1
      nt = split(text, tok, /[^A-Za-z0-9_.+-]+/)
      for (x = 1; x <= nt; x++) {
        if ((tok[x] in runner) || tok[x] ~ /^(python|pypy)[0-9.]*$/) strict = 1
      }

      if (strict) {
        print "strict"
        for (m = 1; m <= k; m++) print seg[m]
        exit
      }
      print "relaxed"
      for (m = 1; m <= k; m++) {
        if (body[m]) continue
        t = seg[m]; sub(/^[ \t]+/, "", t)
        split(t, w, /[ \t]+/)
        if (w[1] == "echo" || w[1] == "printf" || w[1] == "cat") print w[1]
        else print seg[m]
      }
    }'
}

# The executed view, computed once: its segments (the mode line dropped), and
# the segments joined into one whitespace-normalized line for whole-command
# checks.
_exec_out="$(executed_view)"
exec_segments="$(printf '%s\n' "$_exec_out" | tail -n +2)"
exec_norm="$(printf '%s' "$exec_segments" | tr '\n' ' ' | tr -s ' ')"

# Executed-view segments matching the extended regex $1, whitespace-normalized,
# one per line.
segments_matching() {
  printf '%s\n' "$exec_segments" | tr -s ' \t' '  ' | grep -E -- "$1"
}

# Argument tokens following EACH `git push` in segment $1, one per line.
# Quotes, backticks, parentheses, and separators are stripped from tokens so
# `$(git push origin main)` and `bash -c "git push origin main"` still yield
# `main`. Every occurrence in the segment is read, not just the last one.
push_tokens() {
  printf '%s\n' "$1" | awk '{ n = split($0, parts, /git[ \t]+push/); for (i = 2; i <= n; i++) print parts[i] }' \
    | tr -s ' \t' '\n\n' | tr -d "\"'\`();|&" | sed 's/[<>].*//' | grep -v '^$'
}

# A command word counts when it appears at a segment's start, after
# whitespace, after an opening quote, backtick, or parenthesis, or after a
# path (`/usr/bin/git`).
_cmd_prefix="(^|[[:space:](\`\"'/])"
_push_segment_re="${_cmd_prefix}git +push([[:space:]]|$)"

# Does any `git push` destination in the command equal branch $1? Reads each
# push segment's own tokens only. Checks bare tokens and the destination
# (right-hand) side of `src:dst` refspecs, strips a leading `+` (force-push
# shorthand) and a `refs/heads/` prefix before comparing. Flags are skipped.
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

# Does any push segment push tags? `--tags`, `--follow-tags`, and `--mirror`
# (which pushes every ref, tags included) as flags of the push itself; a
# `refs/tags/` refspec; or a destination that is exactly `vX.Y.Z` — anchored,
# so a branch named e.g. `issue/42-bump-v1.2.3` is not a tag push. The words
# appearing elsewhere in the command (a commit message, an echo) do not count.
push_is_tag_push() {
  local seg tok dst
  while IFS= read -r seg; do
    while IFS= read -r tok; do
      case "$tok" in
        --tags | --follow-tags | --mirror) return 0 ;;
        *refs/tags/*) return 0 ;;
        -*) continue ;;
      esac
      tok="${tok#+}"
      dst="${tok##*:}"
      if printf '%s' "$dst" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
        return 0
      fi
    done < <(push_tokens "$seg")
  done < <(segments_matching "$_push_segment_re")
  return 1
}

# `git merge` flags (long or short) that consume a FOLLOWING token as their
# value, per `git merge -h`: -s/--strategy, -X/--strategy-option, -m/--message,
# -F/--file, --into-name, --cleanup. `--flag=value` joined forms need no
# special handling here since they already arrive as a single token.
_git_merge_value_flags="-s --strategy -X --strategy-option -m --message -F --file --into-name --cleanup"

# First non-flag, non-flag-value token after `git merge` (the ref being
# merged). Flag-aware: skips both a value-consuming flag and the token that
# supplies its value, so e.g. `-m "merge note"` or `--strategy-option theirs`
# don't cause the flag's VALUE to be misread as the merge target.
git_merge_arg() {
  local rest tok flag skip_next=0 is_value_flag
  rest="$(printf '%s' "$norm" | sed -n 's/.*git[[:space:]][[:space:]]*merge[[:space:]][[:space:]]*//p')"
  while IFS= read -r tok; do
    if [ "$skip_next" -eq 1 ]; then
      skip_next=0
      continue
    fi
    case "$tok" in
      -*)
        is_value_flag=0
        for flag in $_git_merge_value_flags; do
          if [ "$tok" = "$flag" ]; then
            is_value_flag=1
            break
          fi
        done
        [ "$is_value_flag" -eq 1 ] && skip_next=1
        continue
        ;;
    esac
    printf '%s' "$tok"
    return 0
  done < <(tokenize "$rest")
  printf ''
}

# Strip known ref-qualifying prefixes (`refs/heads/`, fully-qualified
# `refs/remotes/<remote>/`, bare `remotes/<remote>/`, or a bare `<remote>/`
# shorthand as in `origin/story/1-x`) from a merge argument so the story/issue
# check recognizes the ref-qualified forms documented as canonical merge
# syntax in .claude/skills/git-ops/SKILL.md (e.g. `git merge origin/story/1-x`)
# identically to the bare `story/1-x` form. Without this, `git merge
# origin/story/1-x`, `git merge remotes/origin/story/1-x`, `git merge
# refs/heads/story/1-x`, and `git merge refs/remotes/origin/story/1-x` all
# bypassed the rule 1b block entirely.
strip_merge_ref_prefix() {
  local ref="$1" candidate
  ref="${ref#refs/heads/}"
  ref="${ref#refs/remotes/}"
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

# `gh pr merge` flags (long or short) that consume a FOLLOWING token as their
# value, per `gh help pr merge`: -A/--author-email, -b/--body, -F/--body-file,
# --match-head-commit, -t/--subject, -R/--repo. `--flag=value` joined forms
# need no special handling here since they already arrive as a single token.
_gh_pr_merge_value_flags="-A --author-email -b --body -F --body-file --match-head-commit -t --subject -R --repo"

# True (0) if $1 is one of the gh-pr-merge value-consuming flags above.
_gh_pr_merge_is_value_flag() {
  local tok="$1" flag
  for flag in $_gh_pr_merge_value_flags; do
    [ "$tok" = "$flag" ] && return 0
  done
  return 1
}

# Extract a `gh pr merge` PR number: a digit-only token right after `merge`
# (skipping flags and their values), or a `#123` reference anywhere in the
# command. Empty if none given (the command then targets the current
# branch's PR). Flag-aware: skips both a value-consuming flag and the token
# that supplies its value, so e.g. `--subject 99 42` doesn't misread the
# `--subject` value `99` as the PR number instead of the real target `42`.
gh_pr_merge_number() {
  local rest tok skip_next=0
  rest="$(printf '%s' "$norm" | sed -n 's/.*gh[[:space:]][[:space:]]*pr[[:space:]][[:space:]]*merge[[:space:]][[:space:]]*//p')"
  while IFS= read -r tok; do
    if [ "$skip_next" -eq 1 ]; then
      skip_next=0
      continue
    fi
    case "$tok" in
      [0-9]*)
        printf '%s' "${tok%%[!0-9]*}"
        return 0
        ;;
      '#'[0-9]*)
        printf '%s' "${tok#\#}"
        return 0
        ;;
      -*)
        _gh_pr_merge_is_value_flag "$tok" && skip_next=1
        continue
        ;;
      *) break ;;
    esac
  done < <(tokenize "$rest")
  printf ''
}

# First non-flag, non-flag-value token after `gh pr merge`, whatever its
# shape: a bare PR number, a `#123` reference, a branch name, or a PR URL.
# `gh pr merge` (and `gh pr view`) accept all four as a valid target. Empty if
# none given (the command then targets the current branch's PR). Used as a
# fail-closed fallback so a branch-name or URL target is verified directly
# via `gh pr view <target>` instead of silently falling back to checking the
# CURRENT branch's PR — which would let a crafted `gh pr merge
# <other-branch-or-url>` merge a different, unverified PR while the guard
# checks the wrong one. Flag-aware like gh_pr_merge_number(): skips both a
# value-consuming flag and the token supplying its value (e.g. `--repo
# owner/repo`), so the flag's value is never misread as the target.
gh_pr_merge_target() {
  local rest tok skip_next=0
  rest="$(printf '%s' "$norm" | sed -n 's/.*gh[[:space:]][[:space:]]*pr[[:space:]][[:space:]]*merge[[:space:]][[:space:]]*//p')"
  while IFS= read -r tok; do
    if [ "$skip_next" -eq 1 ]; then
      skip_next=0
      continue
    fi
    case "$tok" in
      -*)
        _gh_pr_merge_is_value_flag "$tok" && skip_next=1
        continue
        ;;
    esac
    printf '%s' "$tok"
    return 0
  done < <(tokenize "$rest")
  printf ''
}

# --- Rule 1: never merge/push into the default branch -------------------------

# `git push` targeting the default branch (resolved dynamically; not hardcoded
# to `main` so a repo on `master`/`trunk` is protected identically).
if printf '%s' "$exec_norm" | grep -Eq "$_push_segment_re|[;&|]git +push"; then
  default_branch="$(resolve_default_branch)"
  if push_targets_ref "$default_branch"; then
    block "pushing to '$default_branch' is not allowed. Open a PR; only the user may merge into $default_branch."
  fi
fi

# `git merge`: two independent checks.
if printf '%s' "$exec_norm" | grep -Eq "${_cmd_prefix}git +merge([[:space:]]|$)|[;&|]git +merge([[:space:]]|$)"; then
  current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  default_branch="$(resolve_default_branch)"

  # 1a. Merging INTO the default branch via raw git.
  if [ "$current_branch" = "$default_branch" ]; then
    block "merging into '$default_branch' is not allowed. Only the user may approve and merge PRs into $default_branch."
  fi

  # 1b. Raw-git escape: merging a story/issue branch directly into an
  # integration branch bypasses PR review entirely. This is the confirmed
  # live defect's unreviewable path — block it and name the reviewable one.
  # Checked per segment, so every merge in a chained command is read with
  # its own arguments (issue #256).
  _full_norm="$norm"
  while IFS= read -r norm; do
    merge_arg="$(strip_merge_ref_prefix "$(git_merge_arg)")"
    case "$current_branch" in
      integration/*)
        case "$merge_arg" in
          story/*|issue/*)
            block "raw 'git merge' of a story/issue branch into an integration branch is not allowed — it bypasses PR review. Use 'gh pr merge <n> --merge --delete-branch' instead."
            ;;
        esac
        ;;
    esac
  done < <(segments_matching "${_cmd_prefix}git +merge([[:space:]]|$)")
  norm="$_full_norm"
fi

# `gh pr merge`: resolve the PR's actual base via `gh pr view` (the `--base`
# flag does not exist on `gh pr merge` — it belongs to `gh pr create` — so a
# text check for it was always vacuous and blocked the tool's own canonical
# merge command). Fails CLOSED if the lookup itself fails; see header.
# Checked per segment, so every `gh pr merge` in a chained command is read
# with its own arguments and flags (issue #256). Commands inside the loop read
# stdin from /dev/null so they cannot consume the segment list.
_full_norm="$norm"
while IFS= read -r norm; do
  # `--admin` bypasses branch protection outright; never allowed for agents.
  if printf '%s' "$norm" | grep -Eq -- '(^|[[:space:]])--admin([[:space:]]|$)'; then
    block "'gh pr merge --admin' bypasses branch protection and is not allowed for agents. Only the user may merge with --admin, or via GitHub's UI/API directly."
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
      base="$(gh pr view "$view_arg" --json baseRefName -q .baseRefName 2>/dev/null </dev/null)" && lookup_ok=1
    else
      base="$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null </dev/null)" && lookup_ok=1
    fi
  fi

  if [ "$lookup_ok" -ne 1 ] || [ -z "$base" ]; then
    # Fail-closed exception to this script's default fail-open contract —
    # see header. An unverifiable base must not be treated as safe.
    block "could not verify the PR's base branch via '$verify_cmd' (gh missing, unauthenticated, or a network error). Refusing to merge (fail-closed): an unverified base could be the default branch. Do not fall back to an unverified merge path or a different tool surface — stop and ask the user to check 'gh auth status'/network access, or merge it themselves."
  fi

  default_branch="$(resolve_default_branch </dev/null)"
  if [ "$base" = "$default_branch" ]; then
    block "merging a PR into '$default_branch' is not allowed. Only the user may merge into $default_branch."
  fi

  # `--auto` on a PR whose base is the default branch defers an unapproved
  # merge rather than preventing one — same block, just scheduled.
  if printf '%s' "$norm" | grep -Eq -- '(^|[[:space:]])--auto([[:space:]]|$)' && [ "$base" = "$default_branch" ]; then
    block "'gh pr merge --auto' on a PR targeting '$default_branch' is not allowed. Only the user may merge into $default_branch."
  fi
done < <(segments_matching "${_cmd_prefix}gh +pr +merge([[:space:]]|$)")
norm="$_full_norm"

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
# Checked per segment (issue #256): one read form must not let another
# segment's tag creation through, e.g. `git tag --list; git tag v1.0.0`.
while IFS= read -r _seg; do
  # Allow pure list/read forms.
  if printf '%s' "$_seg" | grep -Eq "${_cmd_prefix}git +tag +(-l|--list|-n[0-9]*)([[:space:]\"'\`)]|$)"; then
    :
  elif printf '%s' "$_seg" | grep -Eq '(^|[[:space:]])git +tag[[:space:]]*$'; then
    : # `git tag` with no further arguments lists tags.
  else
    block "creating, moving, deleting, or forcing a git tag is not allowed. Tags are human-only, annotated, and point at a 'main' commit. See github-ops 'Tags'."
  fi
done < <(segments_matching "${_cmd_prefix}git +tag([[:space:]]|$)")

# Block tag pushes, read from each push segment's own arguments only: see
# push_is_tag_push.
if push_is_tag_push; then
  block "pushing a tag is not allowed. Tags are created and pushed by a human only. See github-ops 'Tags'."
fi

# Block `gh release create` (cutting a release implies creating a tag).
if printf '%s' "$exec_norm" | grep -Eq 'gh +release +create'; then
  block "cutting a GitHub release is human-only (it creates a tag). See github-ops 'Tags'."
fi

exit 0
