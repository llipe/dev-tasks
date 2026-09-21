# Fidelity Report — Issue #174 (Cost controls: subagent models and permission allowlist)

## 1. Header / Verdict

- **Fidelity: Medium**
- **Highest drift impact present: Major** (Unintended)
- **Scope:** Issue #174, PR #186 (draft), branch `issue/174-cost-controls` → `integration/claude-runtime-parity-plan`

`verifier_audit: run` — audit completed against live codebase evidence (diff, hook execution, full test suite run), not self-reported claims.

---

## 2. Human-readable summary

This change does two things: it tells Claude Code to use a cheaper AI model for four "mechanical" helper roles (the ones that just tidy up GitHub issues, fix lint errors, write docs, or do file research) while keeping the more expensive model for four roles that need real judgment (the ones that write code, design tests, audit work, and design UI). Separately, it gives Claude Code a pre-approved list of twelve safe, read-only commands (like "check git status" or "run the tests") so the AI doesn't have to stop and ask permission every time it wants to look something up.

Both pieces work as intended for their stated purpose, and a full run of the project's 2,075 automated tests passes. However, one entry on the "safe" list — `git branch` — is safe as a *listing* command but the same pre-approval pattern also silently covers `git branch -D <name>` (delete a branch) and `git branch -m <name>` (rename a branch). Neither of those is "read-only," and nothing else in the system stops them: there's no confirmation prompt (that's the point of the allowlist) and no separate guard blocks branch deletion/rename the way pushes and merges are blocked. This doesn't let the AI push, merge, commit, or overwrite files — the four things the ticket explicitly said must stay blocked — but it does let it silently delete or rename a local git branch, which the ticket's own stated goal ("read-only" commands only) did not intend. This is a real, if narrow, gap worth tightening before this list is trusted as "no write path."

The other flagged question — whether `model: haiku` and `model: inherit` are the right and current way to write this setting — checks out. Those are the documented values Claude Code itself expects for this field, so the team's own uncertainty here was reasonable given they had no prior in-repo example to copy, but it is not a defect.

---

## 3. Per-AC result table

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
|---|---|---|---|---|---|
| AC-1 | A delegated `github-ops`/`researcher` run executes on the smaller model | `.claude/agents/github-ops.md`, `housekeeping.md`, `technical-writer.md`, `researcher.md` all declare `model: haiku`; `developer.md`, `verifier.md`, `qa-engineer.md`, `ux-engineer.md` declare `model: inherit` | Task 6.6 explicitly left unchecked in `workstream/tasks-claude-runtime-parity-plan.md`, annotated "manual/observational... not assertable by a unit test per test-plan CP-06" | Not testable by a unit test (host-level runtime behavior, not a static artifact) | **Undetermined (correctly disclosed, non-blocking)** — frontmatter is present and structurally correct; actual runtime model selection cannot be confirmed by static audit and was honestly reported as unverified rather than falsely marked done |
| AC-2 | No allowlisted command can push, merge, commit, tag, or write a file | `permissions.allow` in both `.claude/settings.json` and `templates/claude/settings.json` contains exactly 12 entries; none contain `push`, `merge`, `commit`, `tag`, `rm`, `mv`, or a write-oriented `pnpm run` script | Task 6.7 checked; issue AC-2 text matches | `test/unit/model-tiers-permission-allowlist.test.ts` scans for write-capable regex patterns — all pass; **however, the scan does not check for `git branch -D`/`-m`** (branch delete/rename), which the literal AC-2 wording (push/merge/commit/tag/file-write) does not cover either | **Pass on literal AC-2 wording; Drift against the issue's broader stated intent** ("read-only... commands", "exclude every write path") — see Drift Catalog D-1 |
| AC-3 | Hook guards still block their four invariants with the allowlist active | `.claude/hooks/git-guard.sh` unchanged by this PR; still enforces the four invariants (no push/merge to default branch, Conventional Commits, no inline `gh --body`, no human-only tags) | Task 6.8 checked | `model-tiers-permission-allowlist.test.ts` confirms `git push origin main` still exits 2 with allowlist populated, and `git status` (allowlisted) passes through unblocked; independently re-verified live in this audit (same result) | **Pass** — the four named invariants are unaffected by the allowlist, which is a host-side prompt-suppression mechanism only, not a hook bypass |
| AC-4 | `pnpm run test:unit` and `pnpm run validate` pass | — | Task 6.9 checked | Independently re-run in this audit: `pnpm run test:unit` → 96 files / 2075 tests, all green | **Pass** |

---

## 4. Drift catalog

### D-1 — `Bash(git branch:*)` permission entry also silently pre-approves branch delete/rename

- **Description:** The allowlist pattern `Bash(git branch:*)` matches on command prefix, so it does not distinguish `git branch` (list — read-only) from `git branch -D <name>` (delete) or `git branch -m <old> <new>` (rename). All three were empirically confirmed to match the same allow rule; Claude Code's permission-matching is prefix-based, not subcommand-aware. Independently verified by feeding all three commands through `git-guard.sh` directly (bypassing the permission layer, which is host-side and cannot be invoked standalone): none of the three is blocked by the hook either — `git-guard.sh` has no rule addressing branch delete/rename at all, so there is no second line of defense once the allowlist suppresses the confirmation prompt.
- **Impact class:** Major — this does not enable push, merge, commit, tag, or file writes (AC-2's literal four verbs are unaffected), but it does let an agent silently destroy or rename a local branch (including, notably, a branch holding unpushed/unmerged work) with no human confirmation and no hook backstop. Local data loss from a mis-issued `git branch -D` is a plausible, non-trivial cost-control-adjacent regression, even if usually recoverable via reflog.
- **Intent class:** Unintended — the issue body's own framing calls this "read-only and quality-gate commands" and instructs to "exclude every write path so the guards still bind." `git branch -D`/`-m` are not read-only and are not a quality gate; they slipped in because the allowlist entry was written at the subcommand level (`git branch`) rather than scoped to the read-only invocation (e.g., a listing-only pattern), and the test suite's `WRITE_CAPABLE_PATTERNS` regex list (`test/unit/model-tiers-permission-allowlist.test.ts:121-136`) does not include a `git\s+branch\s+-[Dd]` or `-m` pattern, so nothing caught it.
- **Evidence source(s):** `.claude/settings.json`, `templates/claude/settings.json`, `.claude/hooks/git-guard.sh` (no branch-delete/rename rule present), live reproduction against a scratch repo (`git branch -D feature-x`, `git branch -m feature-x renamed` both exit 0 through the hook).
- **Non-blocking note:** Per the verifier operating rules, this drift does **not** block PR #186 or issue #174 from completion; it is reported for routing to `product-engineer`'s `activity-drift-reconciliation` skill.
- **Resolution (2026-09-17):** `developer` applied recommendation option (a) directly on `issue/174-cost-controls` at `planner`'s direction: `git branch` was dropped from `permissions.allow` in both `.claude/settings.json` and `templates/claude/settings.json` (no narrower Claude Code pattern exists within a single prefix rule). `test/unit/model-tiers-permission-allowlist.test.ts` gained an `allowlistEntryMatches` helper and regression assertions, written first against the unfixed allowlist and confirmed failing (`git branch -D`/`-m` both matched `Bash(git branch:*)`), then passing after the fix. Full suite re-run: `pnpm run test:unit` (2079/2079), `pnpm run validate` (2290/2290, typecheck/lint/format:check/test all green), `pnpm run audit` (no known vulnerabilities).

### D-3 — `Bash(pnpm run lint:*)` permission entry also silently pre-approves the mutating `lint:fix` script, and the round-2 regression test's matching model had a false-negative bug

- **Description:** A second independent re-audit found the same class of bug as D-1 in a different entry. `package.json` defines both `"lint": "eslint . --max-warnings 0"` (read-only) and `"lint:fix": "eslint . --fix"` (mutates files in place). Claude Code's `Bash(<prefix>:*)` rule is a true raw string-prefix match with no colon/word-boundary awareness, and the literal string `pnpm run lint:fix` starts with the literal string `pnpm run lint`, so `Bash(pnpm run lint:*)` silently pre-approved the mutating variant too. `.claude/hooks/git-guard.sh` has zero rules for pnpm/npm commands, so there was no backstop of any kind. Separately, the round-2 regression helper `allowlistEntryMatches()` in `test/unit/model-tiers-permission-allowlist.test.ts` required a literal space right after the prefix before treating a longer command as a valid continuation (`command === prefix || command.startsWith(prefix + " ")`). That extra boundary requirement is exactly why it caught the space-separated `git branch -D`/`-m` case in D-1 but missed the colon-glued `pnpm run lint:fix` case entirely — a modeling bug producing false confidence that the class of defect had been fully closed.
- **Impact class:** Major — same class as D-1: this does not enable push, merge, commit, tag, or arbitrary file writes, but it does let an agent silently run an auto-fixing lint pass (rewriting source files) with no human confirmation and no hook backstop, alongside a false-negative in the very regression test meant to guard against this class of bug.
- **Intent class:** Unintended — the issue's framing calls for "read-only and quality-gate commands" only; `lint:fix` mutates files and is not a quality gate. It slipped in because the allowlist entry was written at the script-family level (`pnpm run lint`) rather than the exact read-only invocation, and because no test existed at the time that modeled Claude Code's true prefix-match semantics against `package.json`'s actual script names.
- **Evidence source(s):** `.claude/settings.json`, `templates/claude/settings.json`, `package.json` `scripts` block, `.claude/hooks/git-guard.sh` (no pnpm/npm rules present at all), live reproduction of the prefix match against the literal strings.
- **Non-blocking note:** Per the verifier operating rules, this drift does **not** block PR #186 or issue #174 from completion; it is reported for routing to `product-engineer`'s `activity-drift-reconciliation` skill.
- **Resolution (2026-09-17, round 3):** `developer` dropped `Bash(pnpm run lint:*)` from `permissions.allow` in both `.claude/settings.json` and `templates/claude/settings.json`, same removal approach as `git branch` (no narrower Claude Code pattern distinguishes `lint` from `lint:fix` within one prefix rule). `allowlistEntryMatches()` was corrected to a true raw string-prefix match (`command.startsWith(prefix)`, no boundary requirement). A full manual sweep of every remaining allowlist entry against `package.json`'s scripts and `gh pr view --help`/`gh issue view --help` output found no further collision (`format:check` is already the longer/safer prefix relative to `format`'s `--write`; `test:*` collides only with the read-only `test:unit`/`test:integration`; `gh pr view`/`gh issue view` have no mutating flags). A new generic, forward-looking sweep test (`isWriteCapableScript()` classifying each `package.json` script by command text, checked against every `pnpm run <x>:*` allowlist prefix) now catches this whole class of bug mechanically, not just the two hand-found instances. Full suite re-run: `pnpm run test:unit` (2085/2085), `pnpm run validate` (2296/2296, typecheck/lint/format:check/test all green), `pnpm run audit` (no known vulnerabilities).

### D-2 (informational, not a defect) — `model: haiku` / `model: inherit` frontmatter uncertainty

- **Description:** The developer explicitly flagged (in `test/unit/model-tiers-permission-allowlist.test.ts:39-45` and in the PR/task notes) that `model: haiku`/`model: inherit` might not be valid, current Claude Code subagent frontmatter values, since no prior example existed anywhere in this repo.
- **Verdict:** These **are** valid, current values for Claude Code's `model:` subagent frontmatter key. Claude Code's documented subagent schema accepts a `model` field with the named tier aliases (`sonnet`, `opus`, `haiku`) or the literal string `inherit` (run on the invoking conversation's model) — this is distinct from, and does not require, a full dated model-ID string (e.g., `claude-haiku-4-5-20251001`), which is a separate, also-valid form for pinning an exact snapshot. The values chosen in this PR (`haiku` for the four mechanical agents, `inherit` for the four judgment-heavy agents) match this convention correctly.
- **Impact class:** None (no defect).
- **Intent class:** N/A.
- **Note:** The team's decision to flag this for human confirmation rather than silently assert correctness was the right call given the lack of in-repo precedent; it is being resolved here, not penalized.

---

## 5. Edge-case and randomized test outcomes

No prior Design Mode test plan run specifically for this PR exists beyond CP-06 in `workstream/test-plan-claude-runtime-parity.md`, which this audit cross-checked directly (see AC table above). No randomized/fuzz tactics apply to this scope (static frontmatter + JSON allowlist content); none were designed or expected.

---

## 6. Recommendations

1. **D-1 (Major, Unintended) — `developer` fix recommended.** Either (a) tighten the `permissions.allow` entry so it only pre-approves the read-only listing form (Claude Code permission syntax does not support sub-flag exclusion within a single prefix rule, so the practical fix is likely to leave `git branch:*` off the allowlist entirely, since `git branch` alone is rarely on the hot path this feature targets — `git status`/`git log`/`git diff` cover most of the "look before you act" need), or (b) add a `git-guard.sh` rule blocking `git branch -D`/`-m` (and `git branch -D -r`/force variants) so a second line of defense exists regardless of the allowlist's shape, and extend `WRITE_CAPABLE_PATTERNS` in `test/unit/model-tiers-permission-allowlist.test.ts` to catch this pattern going forward. Recommend (b) as the more robust fix, since it also protects any future contributor who broadens the allowlist without re-deriving the same reasoning from scratch.
2. **AC-1 — no action needed.** The manual/observational nature of this AC was correctly and honestly disclosed rather than falsely marked as verified; no remediation required. Consider recording an actual observed-model-selection note (e.g., a transcript excerpt showing a `github-ops` delegation running on haiku) the next time such a delegation happens naturally, to convert this from permanently-manual to spot-checked.
3. **D-2 — no action needed.** `model:` frontmatter values are confirmed correct; the flagged uncertainty is resolved with no code change required.
4. **D-3 (Major, Unintended, found in round-3 re-audit) — resolved.** `Bash(pnpm run lint:*)` silently pre-approved `pnpm run lint:fix` (mutates files) for the same string-prefix reason as D-1's `git branch`, and the round-2 regression helper had a boundary-requirement bug that produced a false negative for this exact case. Both fixed: the entry was dropped from `permissions.allow` in both settings files, the helper was corrected to a true prefix match, and a generic write-capable-sibling sweep test was added so this class of bug is now caught mechanically rather than one hand-found instance at a time. See D-3 above for full detail.

---

## Output Contract

- **Mode / Phase:** Audit Mode, Phase 4 (Reporting & Publication)
- **Source artifact used:** Issue #174 body, `workstream/tasks-claude-runtime-parity-plan.md` (task 6.0), `workstream/test-plan-claude-runtime-parity.md` (CP-06)
- **Output file paths:** `/Users/felipemallea/Documents/Documentos - M-FMALLEAS/Dev/dev-tasks/workstream/fidelity-report-174.md`
- **GitHub issue link:** to be posted as a comment/summary on issue #174 and/or PR #186 by the invoking agent (`verifier` does not post GitHub content itself beyond what this report enables — publication step should attach this file's header/verdict section)
- **AC coverage status:** AC-1 undetermined (manual, correctly disclosed), AC-2 pass (literal) with Major/Unintended drift against issue intent, AC-3 pass, AC-4 pass
- **Overall fidelity verdict:** Medium
- **Highest drift impact:** Major (Unintended) — D-1, `git branch:*` allowlist entry
- **Blocking gaps:** None — drift is non-blocking per operating rules; PR #186 may proceed to review with D-1 routed to `product-engineer`'s `activity-drift-reconciliation` skill
