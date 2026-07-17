---
inclusion: always
---

# Git Guard — Two Invariants

1. No agent may push or merge into the default branch `main`.
2. `git commit` messages must follow Conventional Commits.

**Enforcement backstop:** Treat human PR review as the actual gate for these rules on Kiro. The hook (`.kiro/hooks/git-guard.json`) is best-effort due to a known upstream limitation.
