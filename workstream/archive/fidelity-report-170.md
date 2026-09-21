# Fidelity Report — Issue #170 (PR #182)

## 1. Header / Verdict

- **Fidelity verdict:** `High`
- **Highest drift impact present:** `Minor`
- **Scope:** Issue #170 · PR #182 (draft) · branch `issue/170-restore-claude-enforcement` → base `integration/claude-runtime-parity-plan`

`verifier_audit: PASS` (non-blocking drift noted below; all three ACs independently reproduced against the live hook script, not just read from the diff or trusted from the test file's own assertions).

## 2. Human-Readable Summary (What Changed and Why)

Before this change, Claude Code could write files (create or edit them) even while sitting on the `main` branch, because the safety check that was supposed to stop that (`git-guard.sh`) only watches terminal/shell commands, and Claude Code writes files through a different, non-shell mechanism that the check never saw. The only thing stopping an accidental write to `main` was wording in the agent's instructions — not an automatic block. This PR copies a second safety check (`branch-guard.sh`) that already existed for a different AI tool (Kiro) over to Claude Code, and switches it on for exactly the actions that create or edit files. I independently rebuilt the change in an isolated test repository and ran the actual script by hand: a file-write attempt while on `main` is blocked with a clear message, and the identical attempt on a feature branch goes through, exactly as promised. The copy is faithful — the safety logic itself did not change, only an outdated comment specific to the other AI tool was removed. The automated test suite, linter, and type checker all pass. The one caveat, explained below, is that the check identifies "am I on `main`" by name only, so a rare git state called "detached HEAD" (where you're sitting on `main`'s content but git doesn't call it "main") would not be caught. This limitation already existed in the older tool's version and isn't new here.

## 3. Per-AC Result Table

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
|---|---|---|---|---|---|
| AC-1 | An `Edit`/`Write` attempted while on `main` is blocked with the branch-guard message; the same call on an `issue/*` branch passes | `.claude/hooks/branch-guard.sh` (new) is a byte-for-byte behavioral port of `.kiro/hooks/scripts/branch-guard.sh` — same `git rev-parse --abbrev-ref HEAD` check, same `exit 2` on literal `"main"`, same `exit 0` otherwise; wired on `Edit\|Write\|NotebookEdit` in both `.claude/settings.json` and `templates/claude/settings.json` | Task 2.4 in `workstream/tasks-claude-runtime-parity-plan.md` marked `[x]`; CP-02 in `workstream/test-plan-claude-runtime-parity.md` and its row in `workstream/traceability-matrix-claude-runtime-parity.md` cover this scenario | I executed the shipped script directly (not the test file) in an isolated git repo: `main` → exit 2 with the branch-guard message; `issue/170-test` → exit 0. `test/unit/claude-hooks-wiring.test.ts` (13 tests) passes and asserts real matcher-to-command JSON wiring plus the executable bit, not mere file presence | **Pass** |
| AC-2 | `AGENTS.md` and `README.md` hook tables describe the shipped Claude state accurately | Diff of both files: both now state Kiro and Claude Code ship both `PreToolUse` hooks, name the Claude Code matchers (`Bash` for git-guard, `Edit\|Write\|NotebookEdit` for branch-guard), and describe fail-open/fail-closed nuance correctly for `git-guard`'s PR-base-lookup exception | Task 2.5 marked `[x]` | No dedicated test (docs are not executable); manually diffed against actual `.claude/settings.json` and `templates/claude/settings.json` content — matches | **Pass** |
| AC-3 | `pnpm run test:unit` and `pnpm run validate` pass | N/A | Task 2.6 marked `[x]`; PR body claims 93 files / 1768 tests and full `validate` pass | I independently re-ran in a fresh worktree at the PR commit: `pnpm run test:unit` → 93 files / 1768 tests pass; `pnpm run lint` and `pnpm run typecheck` → clean | **Pass** |

## 4. Drift Catalog

All items below are **non-blocking** to PR/issue completion per the mandatory-audit contract; they are reported, not remediated, here.

### D-1 — `branch-guard.sh` does not detect "on `main`'s commit" in detached-HEAD state
- **Description:** `current_branch="$(git rev-parse --abbrev-ref HEAD ...)"` returns the literal string `HEAD` (not `main`) whenever the working tree is in detached-HEAD state, including when detached exactly at `main`'s tip commit — reproduced directly (both in the primary worktree and in a secondary `git worktree add --detach <main-sha>`). Because the comparison is `[ "$current_branch" = "main" ]`, this state falls through to `exit 0` (allowed), so a write that is effectively on `main`'s content is not blocked.
- **Impact class:** Minor — detached HEAD is not the normal working mode for an agent session (agents work on named branches per `AGENTS.md`'s branching discipline), and PR review remains the documented backstop for any hook gap.
- **Intent class:** Undetermined — this is not a regression introduced by this PR. It is present identically, unchanged, in the Kiro source (`.kiro/hooks/scripts/branch-guard.sh`) that this PR faithfully ports. Issue #170's AC and the test plan's CP-02 scenario only specify the named-branch case (`main` vs. `issue/*`); detached HEAD was never in scope for this port and is not addressed one way or the other by spec language.
- **Evidence source(s):** Direct script execution (isolated test repo + isolated detached worktree), `.kiro/hooks/scripts/branch-guard.sh` diff comparison.
- **Non-blocking note:** Does not gate PR #182 completion.

### D-2 — `branch-guard.sh` hardcodes `"main"` while its sibling `git-guard.sh` resolves the default branch dynamically
- **Description:** PR #181 (merged prior to this PR, same integration line) generalized `git-guard.sh` to resolve the actual default branch (`main`/`master`/`trunk`) rather than hardcoding `main`, specifically because dev-tasks is a portable toolkit installed into arbitrary consumer repos. `branch-guard.sh`, ported in this PR, still hardcodes the literal string `"main"`. In a consumer repo whose default branch is `master` or `trunk`, `branch-guard` would never block a write on that repo's actual default branch.
- **Impact class:** Major in the abstract (a real enforcement gap for non-`main`-default installs of this toolkit), but Minor in the concrete scope of issue #170, whose AC explicitly scopes the fix to matching Kiro's existing `branch-guard` behavior (hardcoded `main`), not to extending it with dynamic resolution.
- **Intent class:** Undetermined — plausibly an intentional scope boundary (issue #170 says "port," not "generalize"), or an unnoticed parity gap between the two sibling hooks now that one was upgraded and the other wasn't. AGENTS.md's updated hook table does not claim `branch-guard` resolves the default branch dynamically (it only makes that claim for `git-guard`), so there is no doc-accuracy violation — but the two hooks are now inconsistent in a way a reader could miss.
- **Evidence source(s):** `.claude/hooks/branch-guard.sh` source read directly; `AGENTS.md`/`README.md` diff; `.claude/hooks/git-guard.sh` dynamic-resolution logic (from prior PR #181/#177/#179 work) read for comparison.
- **Non-blocking note:** Does not gate PR #182 completion.

## 5. Edge-Case and Randomized Test Outcomes

No prior Design Mode test plan existed narrowly for issue #170 alone, but `workstream/test-plan-claude-runtime-parity.md` (CP-02) covers this scope as part of the broader parity plan. I independently re-executed its stated positive and negative assertions directly against the shipped script (bypassing the test file entirely) rather than trusting its self-reported pass:

| Case | Setup | Expected | Observed | Result |
|---|---|---|---|---|
| Named branch `main` | Isolated repo, `git checkout main` | exit 2, blocked message | exit 2, blocked message | Pass |
| Named branch `issue/170-test` | Isolated repo, feature branch | exit 0 | exit 0 | Pass |
| Worktree checked out to named branch `main` | Second worktree on `main` | exit 2 | exit 2 | Pass |
| Worktree checked out to named feature branch | Second worktree on `issue/*` | exit 0 | exit 0 | Pass |
| Detached HEAD at `main`'s commit (primary worktree) | `git checkout <main-sha>` | Not specified by AC; test plan groups this informally under "falls open" | exit 0 (allowed) | See D-1 |
| Detached HEAD at `main`'s commit (secondary worktree, `--detach`) | `git worktree add --detach <main-sha>` | Same as above | exit 0 (allowed) | See D-1 |
| No `.git` repository present | Directory with no VCS | exit 0, fail-open per documented contract | exit 0 | Pass (matches documented fail-open design) |
| `git` binary unavailable (`PATH` stripped) | `env -i PATH=/nonexistent /bin/bash branch-guard.sh` | exit 0, fail-open | exit 0 | Pass (matches documented fail-open design) |
| Submodule working tree, HEAD detached at a commit that happens to be reachable from a branch named `main` in the submodule's own ref namespace | Superproject with `git submodule add` | N/A (script only ever inspects the immediate repo's `HEAD`) | Behaves per whichever repo context the shell is in — no submodule-specific gap found; the script has no submodule-aware logic to exploit or fail | Pass (no gap found) |

No fuzz/randomized tactics apply to this scope (deterministic string-comparison logic, no numeric/date/enum-domain inputs); this table constitutes the exhaustive edge-case sweep for this audit.

## 6. Recommendations

| Item | Recommended next step | Owner |
|---|---|---|
| AC-1, AC-2, AC-3 | No action needed — delivered fully as specified, independently reproduced | — |
| D-1 (detached-HEAD gap) | Spec clarification: confirm with `product-engineer`/issue owner whether detached-HEAD write-blocking is in scope for `branch-guard`'s contract at all (it is currently out of scope for both Kiro's and Claude's implementations, so this is a design question, not a regression) | `product-engineer` (spec-gap escalation) |
| D-2 (hardcoded `main` vs. dynamic default-branch resolution) | Consider a follow-up task to bring `branch-guard.sh` to parity with `git-guard.sh`'s dynamic default-branch resolution (shared helper would prevent future drift between the two sibling hooks) | `product-engineer` (backlog item) / `developer` (implementation once scoped) |

---

*Generated by `verifier` (Audit Mode). All evidence in this report was independently reproduced by direct execution against the delivered script and delivered settings files — not solely inferred from the diff, the test file's own assertions, or the PR description's claims.*
