---
inclusion: always
---

# Kiro Guard Hook — Enforcement Gap Disclosure

This repository ships `.kiro/hooks/git-guard.json` + `.kiro/hooks/scripts/git-guard.sh` as a best-effort port of Claude Code's `.claude/hooks/git-guard.sh`, enforcing two invariants:

1. No agent may push or merge into the default branch `main`.
2. `git commit` messages must follow Conventional Commits.

**This hook is not guaranteed to be equivalent to Claude Code's `git-guard.sh`.** Kiro's `PreToolUse` hook trigger uses the same exit-code-2 blocking contract as Claude Code's, so blocking is architecturally possible — but a tracked upstream defect (kirodotdev/Kiro#7375) has been reported where Kiro IDE's `PreToolUse` hooks receive an empty `toolArgs` object, unlike the Kiro CLI which passes full context. If that defect affects this environment, the hook cannot see the actual command text and therefore cannot reliably block anything, even though it fires on the right event.

When the hook cannot see command context, it **fails loud, not silent**: it prints a warning to stderr rather than allowing the command through without a trace. Watch Kiro's hook run history for these warnings — they mean the guard could not evaluate the command.

**Until this is verified fixed on a live Kiro install, treat human PR review as the actual enforcement backstop for the `main`-merge and commit-convention rules on Kiro** — do not rely on this hook alone the way you can rely on `.claude/hooks/git-guard.sh` in Claude Code.
