# Fidelity Report — Issue #179 / PR #190

## 1. Header / Verdict

- **Fidelity: High**
- **Highest drift impact present: Minor** (Unintended)
- **Scope:** Issue #179, "never route around a blocked guard" — final story (task 11.0) of the `claude-runtime-parity-plan` milestone. PR #190 (draft), branch `issue/179-never-route-around-guard` → `integration/claude-runtime-parity-plan`.

## 2. Human-Readable Summary

This change adds a rule that used to be missing everywhere it needed to be: if an automated safety check (a "guard") blocks an action, an AI agent must stop and tell the human — not quietly try a different way to get the same thing done. That sounds obvious, but it is exactly what went wrong earlier in this same project: a guard blocked a merge command with a broken error message, and an agent worked around the block instead of reporting it. This PR fixes that broken message (and three others like it), writes the "don't route around a block" rule into the two main instruction files agents read (`CLAUDE.md`, `AGENTS.md`), and adds explicit "if the merge is blocked, stop and ask" steps to the planner and developer instructions. Two new automated checks were added to keep this true going forward. The work matches what was asked, is fully checked off, and all quality gates pass. The one soft spot: one of the two new automated checks is well-designed for catching the *exact* historical bug again, but is looser than it looks for catching a *differently-shaped* future bug of the same family (see drift item below) — this does not affect anything shipped in this PR, only the strength of the safety net for future messages.

## 3. Per-AC Result Table

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
|---|---|---|---|---|---|
| AC-1 | `CLAUDE.md`/`AGENTS.md` MUST state: blocked guard → surface verbatim, stop, never route around | `CLAUDE.md` General Agent Guidelines bullet added verbatim; `AGENTS.md` mirrors it with the carve-out for legitimate unrelated-purpose alternates (`Read` vs `grep`, etc.) | tasks-claude-runtime-parity-plan.md 11.1/11.2 checked `[x]` | `blocked-guard-is-terminal.test.ts`: asserts both files match the rule text and the "MUST NOT attempt an alternative..." phrase | **Pass** |
| AC-2 | Every `git-guard.sh` block message names a permitted alternative or states human-only | 4 of 18 `block()`/`mcp_block()` call sites lacked this; all 4 fixed (missing `pullNumber`, MCP base-lookup failure, MCP create-branch-onto-default, raw-git base-lookup failure) — verified by reading full diff | 11.3 checked `[x]`, notes audit covered all 18 sites not just the original 4 | `git-guard-messages.test.ts`: mechanically extracts every message from source and asserts each names an alternative/human-only, plus a literal regression check against `--base` | **Pass** |
| AC-3 | Confirmed defective message (naming nonexistent `gh pr merge --base`) no longer exists anywhere live | Grepped full current `git-guard.sh`: the only two remaining `--base` mentions are explanatory *comments* describing the historical defect and its fix (real `gh pr view` resolution), not live `block()`/`mcp_block()` text | — | Confirmed independently via `grep` on the fetched branch content, not just trusting the diff | **Pass** |
| AC-4 | Error Handling row added to `planner.md` for merge blocked by git-guard | Row added: verbatim report, mark blocked, write checkpoint, ask user, never attempt alternative | 11.4 checked `[x]` | `blocked-guard-is-terminal.test.ts` asserts the row text and required phrases (`verbatim`, `blocked`, `checkpoint`, `ask the user`, `never attempt an alternative`) | **Pass** |
| AC-5 | Same rule added to `developer` agent/command for commit and PR paths | `.claude/agents/developer.md` rule 23a added, naming `git commit`, `git push`, `gh pr create`, `gh pr merge`, and MCP equivalents; `.claude/commands/developer.md` was **not** separately edited, but (post-issue-#173 collapse) it already delegates the *entire* agent contract by reference ("Follow the full developer agent contract... every section... applies unchanged"), so the command inherits 23a automatically — confirmed by reading the 14-line command file | 11.5 checked `[x]` | `blocked-guard-is-terminal.test.ts` checks the agent file for the rule text and separately checks the command file still says "reuses ... unchanged" with a pointer to the agent file | **Pass** |
| AC-6 | A `/planner` run against a deliberately blocked merge stops and reports, leaving the integration branch untouched | Not exercisable as a pure code/text diff — this is agent runtime behavior, correctly identified as needing a live session | 11.6 checked `[x]`, explicitly marked "manual validation... automated text-contract half covered by test" | Automated half (rule text present in planner.md/developer.md) is real and passes; genuinely-manual half documented step-by-step in PR body's "Manual validation" section | **Pass (with honest manual-scope note — not a silent skip, see Section 6)** |
| AC-7 | `pnpm run test:unit` and `format:check` pass | — | 11.8 checked `[x]`, "2165 tests" | Independently re-ran both on a clean worktree at the PR head commit: `test:unit` → 2165/2165 passed (100 files); `format:check` → clean | **Pass** |

## 4. Drift Catalog

### Drift-1: `git-guard-messages.test.ts`'s general "names an alternative" check is keyword-based, not semantics-based, and would not catch a differently-shaped future regression

- **Description:** The test's own docstring claims it is written "over the raw source, not just a curated list, so a future new block message added without following the contract fails this test rather than slipping through silently." That claim holds for a *literal repeat* of the exact historical defect (a dedicated test asserts no message contains the literal string `--base`). It does **not** hold in general: the broader `namesAlternativeOrHumanOnly()` check accepts any message containing loose signal words (`instead`, `ask the user`, `gh pr merge`, etc.) without validating that a named flag/command is real. I constructed two synthetic messages — one naming a fabricated `--target` flag alongside the word "instead", one naming a vague "made-up flag" alongside "gh pr merge" — and confirmed both would pass `namesAlternativeOrHumanOnly()` and would not be caught by the `--base`-specific regression test. Reproduced independently with the extracted regex logic, not just read from the source.
- **Impact class:** Minor. No live message in the current script is defective — this is a latent gap in the safety net's precision, not a shipped-behavior defect. If a future edit introduces a differently-worded but still-broken message (naming a flag that doesn't exist, using a different flag name than `--base`), this test suite would give false confidence that it passed the contract.
- **Intent class:** Unintended. The test's docstring's generality claim ("a future new block message... fails this test rather than slipping through silently") is broader than what the implementation actually achieves.
- **Evidence source(s):** `test/unit/git-guard-messages.test.ts` (read directly), synthetic reproduction of its regex logic against two constructed messages (see Section 6 below for the exact strings and results).
- **Non-blocking note:** This drift does not block PR #190's completion or the milestone rollup — it is additive input for a possible follow-up hardening of the test, not a defect in the delivered behavior.

### Drift-2 (Undetermined, informational only): No dedicated `/workstream/test-plan-claude-runtime-parity.md` / traceability artifact exists for this milestone

- **Description:** The audit brief referenced `workstream/test-plan-claude-runtime-parity.md` and a "CP-11" scenario as if a separate Design Mode artifact existed. No such file exists in the repository at any point in its history — "CP-11" (and CP-05, CP-06, CP-10, etc.) are inline scenario labels used only within `tasks-claude-runtime-parity-plan.md`'s own "Relevant Files" notes, not a formal `verifier`-produced traceability matrix.
- **Impact class:** Minor. Traceability is still achievable via the task list's own AC-verification sub-tasks (11.6/11.7), which is what this audit relied on.
- **Intent class:** Undetermined — this predates PR #190 and applies to the whole milestone, not something introduced or omitted by this specific PR; it may reflect that Design Mode was never run for this milestone rather than an artifact being lost.
- **Evidence source(s):** Repository-wide `find`/`grep` across `workstream/` and `git log --all` for the filename, both empty.
- **Non-blocking note:** Informational; does not affect PR #190's own completeness.

## 5. Edge-Case and Randomized Test Outcomes

No prior `verifier` Design Mode test plan exists for this scope (see Drift-2), so there is no pre-existing edge-case catalog or randomized-tactic seed policy to check outcomes against. The two new test files in this PR are themselves the edge-case coverage for task 11.0's ACs and were evaluated directly in Sections 3–4.

## 6. Historical-Regression Verification (the specific ask in this audit)

1. **Is the exact defective message class (naming a nonexistent `--base` flag) still present anywhere in `git-guard.sh`?** No. Grepped the full current script content at the PR head commit: the only two occurrences of `--base` are in comments (line ~9 in the header note, and ~line 419 near the `gh pr view` resolution code) explaining that the script *used to* do a flag-based text check and now resolves the base via a real `gh pr view` call. All three fixed live messages that previously touched this code path now read "ask the user to check `gh auth status`/network access, or merge it themselves" — wording that matches the corrected `gh pr view`-based behavior, not stale flag-based text.
2. **Would `git-guard-messages.test.ts` catch a similarly-shaped but differently-worded future defect?** Tested directly, not assumed. Two synthetic messages were constructed and run through the test's own extracted validation logic:
   - `"could not verify the PR base; retry instead with 'gh pr merge --target <branch>' (note: --target does not exist on gh pr merge)"` → `namesAlternativeOrHumanOnly()` returns `true` (matched on `instead`), and the dedicated `--base` regression check does not fire (no literal `--base` substring) — **this synthetic defect would pass the test suite undetected.**
   - `"refusing to merge without an explicit target; for integration branches pass a made-up flag to gh pr merge"` → same result: passes on the `gh pr merge` keyword match, no `--base` literal — **also passes undetected.**
   - This confirms Drift-1: the test suite reliably prevents the *literal* historical regression but has a real gap against the *general class* of "names a plausible-sounding but nonexistent flag."

## 7. Recommendations

| Drift | Recommended next step |
|---|---|
| Drift-1 (keyword-based message test) | `developer` follow-up (optional, non-blocking): strengthen `namesAlternativeOrHumanOnly()` to require named `gh`/`git` flags to be checked against a real flag allowlist, or narrow the accepted-alternative patterns so bare "instead"/"gh pr merge" mentions aren't sufficient on their own. Not required before merging PR #190. |
| Drift-2 (no milestone test-plan artifact) | No action needed for PR #190. If `product-engineer`/`planner` wants formal per-milestone traceability going forward, consider running `verifier` Design Mode retroactively or for the next milestone; otherwise the task list's own AC-verification sub-tasks are sufficient evidence, as demonstrated in this audit. |
| AC-6 manual validation scope | No action needed — confirmed honest: mechanical guard behavior for the underlying block scenarios is already covered elsewhere (e.g., `git-guard-merge.test.ts`'s "gh pr merge base resolution (real, not text-matched)" suite), and the only genuinely-unautomatable slice is agent-level `/planner` behavior (checkpoint writing, no-retry) in a live session, which is correctly left as a documented manual procedure rather than silently skipped. |

---

**verifier_audit: PASS**
**fidelity_verdict: High (Minor, Unintended drift present — non-blocking)**
