---
name: runbook-troubleshoot-hooks
trigger: A git-guard or branch-guard hook blocked a command that should have been allowed, or an operation that should have been blocked went through.
owner: developer
last_verified: 2026-09-19
related: [".claude/hooks/git-guard.sh", ".claude/hooks/branch-guard.sh", ".claude/settings.json"]
---

# Diagnose a blocked or missing hook

Two `PreToolUse` hooks ship with the Claude profile. `git-guard.sh` enforces
four repository invariants over `Bash` commands and the mutating GitHub MCP
tool surface: no push or merge into the default branch, Conventional Commit
messages, no inline multi-line `--body` on `gh`, and no agent-created tags.
`branch-guard.sh` blocks `Edit`/`Write`/`NotebookEdit` while HEAD is the
default branch.

A block is a decision, not an obstacle. Read the message, stop that line of
work, and do not reach for a different tool that achieves the same effect.
This runbook is for deciding whether the guard was right, not for getting
around it.

## Preconditions

- You have the exact command that was blocked and the verbatim block message.
  Both matter: the message names the rule.
- You can read `.claude/hooks/` and `.claude/settings.json` in the repository.

## Steps

1. Confirm the hook is wired at all:

   ```bash
   pnpm exec dev-tasks doctor --json | grep claude-hooks-wiring
   ```

   A failing `claude-hooks-wiring` check means a script exists in
   `.claude/hooks/` that no `PreToolUse` entry references — the guard is
   present but inert.

2. Decide which case you are in.

   **The guard was right.** Most blocks are correct. Report the message and
   change the approach — branch before writing, reword the commit, use
   `--body-file`, or hand the tag to a human.

   **The guard misfired.** It matches patterns over a command string, so
   prose can trigger it: a commit message body containing the words `git tag`
   matches the tag detector. Confirm by reading the matching rule in
   `.claude/hooks/git-guard.sh` and checking whether your text hits it
   incidentally.

3. Reproduce the decision directly, which is faster than guessing. The hook
   reads the `PreToolUse` payload as JSON on stdin and exits `2` to block:

   ```bash
   echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"chore: x\""}}' \
     | bash .claude/hooks/git-guard.sh; echo "exit=$?"
   ```

   Exit `0` allows, exit `2` blocks and prints the reason on stderr.

4. For a false positive, fix the trigger rather than the guard: reword the
   text that incidentally matched. Only widen the pattern when the same
   false positive will recur for other people — and then change the hook in
   all three platform trees, not just `.claude/`.

5. For a missing block — something got through that should not have — treat
   it as the serious case. The hooks are best-effort and fail open on
   unexpected errors. Verify branch protection is configured
   (`runbook-configure-branch-protection.md`); that is the control that
   actually holds.

## Verification

```bash
git rev-parse --abbrev-ref HEAD
pnpm exec dev-tasks doctor --json | grep claude-hooks-wiring
```

After rewiring, re-run the step-3 reproduction for both the case that should
block and the case that should pass. A guard verified in only one direction
is a guard that might be blocking everything.

## Rollback

Hook changes are ordinary file edits: `git checkout -- .claude/hooks/` and
`git checkout -- .claude/settings.json` restore them.

Never disable a hook to land a change. If a guard is genuinely wrong, fix the
pattern and keep it enabled; a repository with the guard removed is the state
these hooks exist to prevent, and `.claude/settings.json` is consumer-owned,
so nothing will put it back for you.

## Escalation

A hook that blocks a correct, common operation is a bug in dev-tasks — open
an issue with the payload you reproduced in step 3 and the block message. A
hook that fails to block a default-branch write is a security issue: confirm
branch protection first, then report it.
