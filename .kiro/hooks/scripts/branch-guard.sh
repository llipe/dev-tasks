#!/usr/bin/env bash
# dev-tasks PreToolUse guard for write tools (fs_write, str_replace, fs_append).
#
# Blocks file writes when the current branch is the default branch (`main`).
# This is a best-effort safety net — the primary enforcement is the agent
# prompt's branch gate language. This hook catches cases where the prompt
# gate was bypassed or ignored.
#
# Contract: receives the PreToolUse hook payload as JSON on stdin. Exit code 2
# blocks the tool call; exit 0 allows. Any unexpected error exits 0 (fail-open)
# so the guard never wedges a session.
#
# KNOWN LIMITATION (tracked upstream: kirodotdev/Kiro#7375): Kiro IDE's
# PreToolUse hooks may receive an empty toolArgs object. This script does not
# depend on toolArgs — it only checks the current git branch. However, if the
# hook system itself fails to trigger (matcher not firing), this guard is inert.
# PR review remains the enforcement backstop.

set -uo pipefail

# Determine the current branch. If git is unavailable or we're not in a repo,
# fail open (allow the write).
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

if [ -z "$current_branch" ]; then
  # Not in a git repo or git unavailable — fail open.
  exit 0
fi

if [ "$current_branch" = "main" ]; then
  printf 'BLOCKED by dev-tasks branch-guard: write operation attempted while on the default branch (main). You MUST create a feature branch (issue/* or story/*) before writing implementation code.\n' >&2
  exit 2
fi

# On a feature branch — allow the write.
exit 0
