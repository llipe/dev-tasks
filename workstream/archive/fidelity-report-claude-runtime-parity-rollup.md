# Fidelity Report — PRD-Level Rollup: Claude Runtime Parity and Enforcement Delivery

## 1. Header / Verdict

- **Fidelity: High**
- **Highest drift impact present: Minor** (all findings Minor, none Major/Critical; all previously logged as intentional out-of-scope follow-ups during per-story review, none newly introduced)
- **Scope:** Milestone `v0.13 — Claude runtime parity and enforcement delivery`, issues #169–#179, all 11 merged into `integration/claude-runtime-parity-plan` (HEAD `5e2f037`). Rollup audit before the consolidated PR to `main`.

`verifier_audit: run`
`fidelity_verdict: High`
`highest_drift_impact: Minor`

## 2. Human-Readable Summary

The milestone set out to fix one root cause: Claude Code's enforcement (branch protection, commit-message rules, PR-review discipline) lived only in files a consumer owns, so a fresh installation of the Claude profile shipped inert scripts and no working guardrails, while the Kiro profile shipped working ones. After combining all 11 pieces, this is now fixed for real, not just on paper:

- A fresh Claude install now delivers a settings file that actually wires both guard scripts, a starter permission allowlist that avoids re-prompting for routine read-only/quality-gate commands, and root project-memory files (`CLAUDE.md`, `AGENTS.md`) — all without ever overwriting a consumer's own edits to those files later.
- The two guard scripts (git-guard, branch-guard) are real, tested, and now cover the git command surface, the GitHub CLI surface, and the GitHub MCP tool surface, so a consumer using the MCP server instead of the CLI is not left unprotected.
- The specific real-world bug that triggered tasks 9–11 — the guard blocking the correct "open a PR and merge it" path while quietly allowing an unreviewed raw-git merge — is fixed, verified against live `git`/`gh` help text, and covered by dedicated regression tests.
- A genuine end-to-end test now installs each platform profile into a real temporary directory and compares what actually got installed, not just what exists in this repository's source tree — closing the exact blind spot that let the original gaps go unnoticed.
- The two things this milestone deliberately did not try to fix — restructuring which agent "owns" running quality-gate agents under autonomous delegation, and wiring a context-assembly command into agent prompts — remain untouched, exactly as planned, with no silent scope creep into either.

Everything found in this rollup is small and already known: a couple of previously-logged, non-blocking loose ends (a legacy build script that still ships this repo's own settings file through an older channel, and one guard script that hasn't yet been updated to resolve the default branch dynamically like its sibling was). Nothing here blocks the consolidated PR.

## 3. End-to-End Claim Verification (Question 1)

**Claim under test:** a fresh `dev-tasks install --profile claude` produces a genuinely working, enforced installation, equivalent in enforcement surface to `--profile kiro`.

Evidence, not self-report:

- `test/integration/install-parity.test.ts` performs a **real install** via the built CLI (`dist/bin/dev-tasks.js`) into fresh temp directories per profile (`claude`, `kiro`, `copilot`, `both`, `all`) and asserts on the *installed output*, not source-tree presence:
  - `claude profile: hooks wired, always-on context present, scoped rules reachable` — passed.
  - `kiro profile: hooks wired, always-on steering present, scoped rules reachable` — passed.
  - Regression guards fail the suite if `.claude/settings.json` is dropped from install, or if a hook script ships with no matching trigger registration (Claude or Kiro) — both present and passing, so this is a real, falsifiable check, not a tautology.
  - Documented asymmetries (command-vs-agent shape for `infra-engineer`/`planner`/`product-engineer`, `verifier` as two commands, merged `planner-resume`) are asserted to hold and a regression guard fails if an *undocumented* asymmetry widens.
- I independently inspected the resulting `.claude/settings.json` (both `templates/claude/settings.json` and this repo's own copy, byte-identical): `PreToolUse` registers `git-guard.sh` on `Bash` and on the six mutating MCP tool names, and `branch-guard.sh` on `Edit|Write|NotebookEdit`; `permissions.allow` contains only read-only/quality-gate command prefixes, verified below to contain no write-capable collisions.
- Full `pnpm run validate` (typecheck, lint, format:check, unit+integration tests) and `pnpm run audit` both ran clean on the integration branch HEAD (see §6).

**Conclusion:** the claim holds. This is verified end-to-end via a real install + real comparison, not merely 11 independently-passing isolated checks.

## 4. Excluded-Findings Re-Verification (Question 2)

- **Developer-subagent gate ownership.** Confirmed partially addressed, not silently expanded: `.claude/agents/developer.md` (rules 18/22 and the Main-Thread Mode Addendum) now honestly emits `verifier_audit: not-run(no-delegation)` / `coverage_gate: SKIPPED(no-delegation)` when running as a subagent with no `Task` tool, and `.claude/commands/planner.md` (merge gates 5/6, lines 412–413) now invokes `qa-engineer` and `verifier` directly per story rather than trusting the self-report. `developer` still declares no `Task` tool and the full gate-ownership redesign is still explicitly not done — the "no-delegation" default is a documented, permanent state, not a transitional one. This matches the plan's own framing exactly (a scoped fix "in place of" the full redesign, not the redesign itself).
- **Wiring `dt ctx assemble` into the agents.** Confirmed untouched: no reference to `ctx assemble` anywhere under `.claude/`, `CLAUDE.md`, or `AGENTS.md`. Correctly still out of scope.

## 5. Cross-Round File Coherence (Question 3)

Read `.claude/hooks/git-guard.sh` in full (touched by T9.0 across 3 rounds, T10.0's rule 5, and T11.0's message-quality pass):

- Rule 5 (MCP, T10.0) shares `resolve_default_branch()` with rule 1 (T9.0) rather than duplicating branch-resolution logic — no divergence between the two paths' notion of "the default branch."
- T11.0's message-quality requirement (every `block()`/`mcp_block()` names a permitted alternative or states human-only) holds across **all** call sites I read, including the MCP-specific ones added after T11.0's own audit rounds (e.g. `enable_pr_auto_merge`'s message, the `create_branch` case-folded message) — consistent style, not just the original four T9.0 sites.
- The `--admin` message fix (11.3 round 2, the one that only accidentally passed its own check before) is present and correctly worded ("Only the user may merge with --admin...").
- `test/unit/git-guard-mcp.test.ts`, `git-guard-merge.test.ts`, `git-guard-messages.test.ts`, and `git-guard-tags.test.ts` all exist and passed in the full suite run (§6) — dedicated coverage per round, not just the original rule-4 test the plan noted as the sole pre-existing coverage.
- No regression: rule 1's `gh pr merge` fail-closed path and rule 5's MCP fail-closed path use the same message shape and the same "do not retry with a different tool or command" language, so an agent blocked on one surface gets consistent guidance to not hop to the other surface — exactly the failure mode T9's original incident (the security-classifier-flagged bypass attempt logged in the Decisions Log) demonstrated was real.

**Conclusion:** the three rounds of changes to this file coexist correctly. No regression found.

## 6. Test Suite (Question 4)

Ran fresh on `integration/claude-runtime-parity-plan` (HEAD `5e2f037`), after discarding an unrelated regenerated-timestamp fixture diff (`test/fixtures/catalog/catalog/index.yaml` — a known, previously-logged test-run side effect, not part of any story's diff):

- `pnpm run validate` (typecheck → lint → format:check → `vitest run`): **124 test files, 2392 tests, all passed.** Exit code 0.
- `pnpm run audit` (`pnpm audit --prod`): **no known vulnerabilities.**

This is a self-obtained result, not a re-statement of any story's own CI claim.

## 7. Per-Task Result Table

| Task | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
|---|---|---|---|---|---|
| T1.0 (#169) | `.claude/settings.json` deliverable, install-if-absent | `core/distribution/install.ts`, `profiles.ts`, ADR-006 present; settings template exists and is wired | Decisions Log: coverage_gate PASS, verifier_audit High/Minor | `distribution-profiles.test.ts`, `distribution-install.test.ts` pass | Pass |
| T2.0 (#170) | Restore deterministic enforcement | `.claude/hooks/branch-guard.sh` ported, registered in settings | Decisions Log: clean pass, coverage_gate PASS, verifier PASS/Minor | `claude-hooks-wiring.test.ts` passes | Pass |
| T3.0 (#171) | Deliver Claude root context | `CLAUDE.md.template`/`AGENTS.md.template` shipped, install-if-absent verified | — | `install-parity.test.ts` §1 passes | Pass |
| T4.0 (#172) | Withdraw Next.js claim | `CLAUDE.md` §"Domain-Specific Conventions" states no automatic delivery | Decision recorded 2026-09-16 | `nextjs-claude-parity-claim.test.ts` (283 tests) passes | Pass |
| T5.0 (#173) | Collapse developer command | `.claude/commands/developer.md` is 14 lines, thin wrapper; no restatement | Decisions Log: clean pass | `developer-command-collapse.test.ts` passes | Pass |
| T6.0 (#174) | Cost controls: model tiers + allowlist | `model:` frontmatter present on 4 mechanical agents; allowlist has no write-capable collisions (`git branch`, `pnpm run lint:fix` correctly excluded) | Decisions Log: 3 rounds, final High/no drift; 6.6/7.9 correctly left unchecked as manual-only | `model-tiers-permission-allowlist.test.ts` passes | Pass (with 2 documented manual-only sub-ACs, non-blocking) |
| T7.0 (#175) | Tool-declaration parity + gate honesty | Rules 18/22 + Addendum in `developer.md`; planner gates 5/6 rewritten | Decisions Log: self-referential fix confirmed by both reviewers | `claude-tool-declaration-parity.test.ts` passes | Pass |
| T8.0 (#176) | Installed-state parity test | `install-parity.test.ts` full suite present and passing | — | passes (§3 above) | Pass |
| T9.0 (#177) | Fix planner merge path | `git-guard.sh` rule 1/3/4 rewritten, 3 rounds, cross-checked against live `gh`/`git` help | Decisions Log: 3-round saga fully documented, final High/Minor | `git-guard-merge.test.ts`, `git-guard-tags.test.ts` pass | Pass |
| T10.0 (#178) | Close MCP bypass | `git-guard.sh` rule 5, settings matcher extended, branch-protection doc added | — | `git-guard-mcp.test.ts` passes | Pass |
| T11.0 (#179) | Never route around a blocked guard | `CLAUDE.md`/`AGENTS.md` rule added, all `block()`/`mcp_block()` sites audited | Decisions Log confirms 2 route-around incidents correctly handled (blocked, not bypassed) mid-run | `git-guard-messages.test.ts`, `blocked-guard-is-terminal.test.ts` pass | Pass |

## 8. Drift Catalog

All items below were already identified and logged during per-story review (per the Decisions Log); this rollup confirms none were silently fixed, expanded, or contradicted, and adds no new items of consequence.

1. **Legacy shell-bundle channel still ships this repo's own `.claude/settings.json`.** `scripts/build-bundle.sh`'s `MANAGED_FILES` array includes `.claude/settings.json` as an unconditional (overwrite) managed file, alongside `CLAUDE.md`/`AGENTS.md`/`DESIGN.md`/`TESTING.md` — a different, older distribution path than `core/distribution/install.ts`'s install-if-absent semantics decided in ADR-006. The script is not wired into any `package.json` script or the current install/update CLI path (confirmed: no references from `bin/`, `core/`, or `package.json`), so it does not affect the `dev-tasks install --profile claude` claim verified in §3. It is a separate, apparently legacy/manual artifact-build path that was never brought in line with the new ownership model.
   - Impact: **Minor** (no consumer-facing effect via the primary install path)
   - Intent: **Unintended** (pre-existing oversight, not a decision anyone recorded)
   - Evidence: `scripts/build-bundle.sh:37-46`; first flagged in Decisions Log under T1.0
   - Non-blocking to this PR/consolidated handoff.

2. **`branch-guard.sh` still hardcodes `"main"` while `git-guard.sh` resolves the default branch dynamically.** T9.0 added `resolve_default_branch()` to `git-guard.sh` for exactly this reason (a repo on `master`/`trunk` needs identical protection), but `branch-guard.sh` (T2.0, earlier in the sequence) was not revisited to match. A consumer repo whose default branch isn't `main` gets no branch-guard protection at all, though git-guard's four rules still apply.
   - Impact: **Minor** (git-guard's broader rule set still protects such a repo; branch-guard is a narrower backstop)
   - Intent: **Unintended**, already logged as a follow-up in the Decisions Log (T2.0) rather than fixed in-scope
   - Evidence: `.claude/hooks/branch-guard.sh:20` (`if [ "$current_branch" = "main" ]`)
   - Non-blocking.

3. **This repo's own root `CLAUDE.md` has drifted slightly from `CLAUDE.md.template`** beyond the expected "consumer fills it in" divergence — it dropped the `--body-file` bullet and its "enforced deterministically by hooks" note no longer mentions `--body-file` enforcement (rule 3 of git-guard), while the template still does. Cosmetic; both files correctly carry the T11.0 "blocked guard is a decision" rule.
   - Impact: **Minor**
   - Intent: **Undetermined** (not traceable to any specific story in this milestone; may predate it)
   - Evidence: `diff CLAUDE.md.template CLAUDE.md`
   - Non-blocking.

No Major or Critical drift found.

## 9. Edge-Case / Randomized Test Outcomes

No prior Design Mode test plan exists scoped to this PRD-level rollup (`workstream/test-plan-claude-runtime-parity.md` and `traceability-matrix-claude-runtime-parity.md` exist for the milestone's original scoping, not this rollup); no randomized/fuzz tests are part of this suite. N/A.

## 10. Recommendations

- Item 1 (legacy bundle script): **`developer`/`housekeeping`** — either delete `scripts/build-bundle.sh` if genuinely dead, or bring its `MANAGED_FILES` handling of `.claude/settings.json` in line with ADR-006's install-if-absent decision. Low priority, file as a follow-up issue.
- Item 2 (`branch-guard.sh` hardcoded `main`): **`developer`** — port `resolve_default_branch()` from `git-guard.sh` into `branch-guard.sh`. Already logged as a follow-up in the Decisions Log; recommend actually filing the GitHub issue now that the milestone is closing.
- Item 3 (root `CLAUDE.md`/template drift): **`no action needed`** for this PR — cosmetic, but worth a `technical-writer` pass whenever `CLAUDE.md` is next touched.
- Both known manual-only sub-ACs (6.6, 7.9) are already correctly documented as requiring a live human/main-thread session and are not re-flagged here as gaps — no action needed.

Route items 1 and 2 through `product-engineer`'s `activity-drift-reconciliation` skill for task-list/issue write-back, per contract. All findings are non-blocking to the consolidated PR.
