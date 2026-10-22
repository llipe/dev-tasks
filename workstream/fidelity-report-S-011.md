# Fidelity Report: S-011 (#294)

**Fidelity: High** | **Highest drift impact: Major** (1 Major, 7 Minor; all advisory, non-blocking)
Scope: Story S-011 (#294), PR #301 `story/S-011-roadmap-closeout` @ `f2e0041` into `integration/projects-tracking-phase-2`, repository llipe/dev-tasks.

## Changelog

| Version | Date       | Summary                    | Author   |
| ------- | ---------- | -------------------------- | -------- |
| 1.0     | 2026-10-22 | Initial Audit Mode report. | verifier |

## What changed and why

The planner used to fill in the roadmap from memory and stop as soon as it handed over the consolidated pull request. That is how the roadmap ended up claiming states that were no longer true. With this change, the planner builds the roadmap row from live GitHub data. It marks the row "In progress" when it opens the consolidated pull request and says the remaining work is that pull request. When the user reports the merge, the planner runs a new final phase, "Close-out". That phase checks that the merge really happened and that the story issues closed, and reads the project board without changing it. It then marks the roadmap row "Done", archives the run's state file, updates the status comments, and opens one small pull request for the user to merge. It deletes the integration branch last. The run is now complete only after Close-out. All three platform copies of the planner carry the same wording, and the workflow diagram in the docs shows the new phase.

There is one real gap. Close-out marks the row "Done" with nothing missing even when a story was blocked and never merged. That brings back the kind of false roadmap state this story exists to prevent. It does not block the PR. It needs a decision from `product-engineer`.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | Phase 5 step 5 derives the row from `gh`: `In progress`, `Issues/PRs` from the commands, `What's missing` names the consolidated PR, commands cited verbatim | Step 5 rewritten, one line, byte-identical in all three copies (md5 `5ba41068…`). Primary source is `gh api repos/{o}/{r}/issues/{wave}/sub_issues --jq '.[] \| {number,state}'`, with the AC's `gh issue list --search …` kept as the `Wave issue: none` fallback and filtered to the state table. The AC's `gh pr list --base <integration branch> --state merged --json number` is used verbatim. `Status` is `In progress` ("only Phase 6 sets `Done`"), `What's missing` is "consolidated PR to `main`" plus any unmerged story, and the commands are quoted verbatim in the PR body's Roadmap section. The "should include" list was updated to match. | Tasks 4.1, 4.2, 4.2a and 4.5 checked. Spec §16a (D-64, D-65) supersedes the AC's literal source. | PT-42 `roadmap commands`: all markers, `inOrder` sub-issues → fallback, A-22 state-table filter, cross-tree identity. LT-11 (`roadmap-parity.test.ts`) passes: still one line, before "Open one consolidated PR" (step 7, two lines later) in every tree. | Pass (Intended drift DR-2) |
| AC-2 | New `## Phase 6 - Close-out`, triggered by the merge report, with the ordered steps | `## Phase 6 - Close-out` at level 2, between Phase 5 and Roadmap Maintenance, in all three copies. The section is byte-identical across trees (md5 `8989cdc8…`). It has 12 steps: verify `MERGED` (else stop, write nothing) → pull main → confirm issues closed (open story reported, never closed by hand) → read story PRs while the branch still exists → read Project Status (read only, `not observed(...)` values) → create `chore/<plan-id>-closeout` → roadmap `Done` (absent row: ask `product-engineer`, never invent) → `git mv` to `workstream/archive/planner-state-<plan-id>-archived.md` → DF-5 Done in `TESTING.md` → PRD and wave status comments → one `chore(roadmap)` PR, never merged by the planner → delete the integration branch locally and remotely, last. The intro allows a fresh session from the PR number and the plan id. | Tasks 4.3, 4.3a and 4.6 checked. The D-66 order is intended over the AC's literal order (§16a). D-68 replaces §6's `gh project item-list` with `projectItems`. `workstream/archive/` is not gitignored (only `/workstream/*.md`), so `git mv` works. | PT-43 `phase 6 steps`: steps numbered 1 to 12, `inOrder` heads, per-step markers, entry markers, EC-74, no `13. ` line (LT-9 safe), identical across trees. `planner-merge-gate-parity.test.ts` (LT-9) passes. | Pass (Intended drift DR-1; Major gap DR-3) |
| AC-3 | Step 9 says "then run Phase 6"; Output Contract and Invariants say the run is complete only after Phase 6 | Step 9: "…then run Phase 6 when the user reports the merge; the run is not complete until Phase 6 has run." There is a new Invariant and a new Output Contract bullet, both "complete only after Phase 6". The post-merge follow-up now says to report the merge to run Phase 6 (A-42). Resume Detection offers Phase 6 when every story is `✅ Merged` (A-41). Wave Status Comment event 9 points at Phase 6. Roadmap Maintenance describes both updates. | Task 4.4 and 4.7 checked. | PT-44 `run completes at phase 6` (matched by text, A-33). The A-40 test was updated to match by text. | Pass (Minor DR-4) |
| AC-4 | Parity `planner` block asserts the two commands, `## Phase 6`, `MERGED`, the archive path and the completion invariant in all three copies | Not applicable (test-only AC). | Task 4.1 checked. | PT-42, PT-43 and PT-44 cover every listed marker in all three copies, plus whole-body negatives and a matcher self-check. Parity file: 53/53. `test:unit`: 64 files, 2249/2249. | Pass |

Cross-tree and scope checks:

- The `-U0` diff hunks of the three planner copies are identical. No hunk touches merge gates 5, 6 or 13, so the D-60 divergence is untouched.
- Every edit lands in an identical sentence. The two copies outside `.claude` have the same edits at shifted line numbers (Phase 6 at `.github` :575ff and `.kiro` :612ff).
- Quality gates at the head, run in a detached worktree since removed: `lint` OK, `format:check` OK, `typecheck` OK, `test:unit` OK.

## Drift catalog

Every item below is **advisory and non-blocking** to PR readiness and to issue completion. Each routes to `product-engineer`'s `activity-drift-reconciliation` flow.

| ID | Description | Impact | Intent | Evidence |
| -- | ----------- | ------ | ------ | -------- |
| DR-1 | Phase 6 order differs from AC-2's literal list. Reads come first, and a `chore/<plan-id>-closeout` step is added. Branch deletion moves from third to last. The phase can start in a fresh session. | Minor | Intended (D-66, §16a) | Phase 6 steps 1–12; PT-43 `inOrder` |
| DR-2 | The AC-1 source changed. Sub-issues are primary and the AC's title search is only the `Wave issue: none` fallback (D-64). `What's missing` reads "consolidated PR to `main`" (D-65). D-55's third command (`gh pr view <consolidated> --json number`) is dropped. The merge check uses `--json state,mergedAt` (AC-2) instead of §6's `…,mergeCommit` (EC-85, the pinned prefix). | Minor | Intended (§16a) | Step 5; Phase 6 step 1 |
| DR-3 | **Close-out marks a partial wave `Done`.** Phase 6 step 7 sets `Status` to `Done` and `What's missing` to `—` unconditionally. Yet Phase 5 step 5 lists unmerged stories in `What's missing`, and Phase 6 step 3 expects the wave issue to stay open when the PR carried `Refs #<wave>`. The old "`Done` when every story … merged, otherwise `In progress`" rule was removed. Roadmap Maintenance now ties `Done` to the consolidated PR merging. This contradicts FR-14 ("never writes a state it did not observe") and the verifier's Roadmap-Mismatch trigger 2 ("`Done`, but … stories unmerged"), so the verifier would flag what the planner writes. The AC and spec are silent on partial waves. | Major | Undetermined | Phase 6 steps 3 and 7; Roadmap Maintenance bullet 2; PRD FR-14; verifier § Roadmap-Mismatch Finding |
| DR-4 | The Invariant "Final user-facing local branch state **MUST** be the integration branch for the current run" is not scoped to the Phase 5 handoff. Once Phase 6 step 12 deletes that branch, the invariant cannot be met. | Minor | Unintended | `.claude/commands/planner.md:637` (same in all trees) |
| DR-5 | Known limitation: github-ops § Branch Naming lists only `issue`, `story` and `integration`. `chore/<plan-id>-closeout` has no type row and does not follow `<type>/<issue-number>-<2–5 words>`. Judgment: acceptable. The name is spec-sanctioned (D-66) and matches wave 1's precedent `chore/projects-tracking-wave-1-closeout` (#283). `git-guard` does not enforce branch names. github-ops should gain a `chore` row (all three trees) so the convention is written down. | Minor | Intended | github-ops.md:290-310; PR #283 head |
| DR-6 | Known limitation: step 10 writes the PRD status comment's `shipped` row, a state github-ops's PRD table does not yet define (no `shipped` anywhere in github-ops today). Judgment: acceptable. D-63 assigns the table widening to S-018, which depends on S-011 and lands in this wave before the consolidated PR. The first real Phase 6 (wave 2) therefore runs with it in place. Step 10 is non-blocking on failure. | Minor | Intended | Phase 6 step 10; spec §16a D-63; story execution order |
| DR-7 | Edge-case robustness, advisory per the plan. EC-82: step 12's `git push origin --delete` has no "already deleted counts as done" sentence for repositories with auto-delete (this repository has `delete_branch_on_merge: false`). EC-78: neither the fallback `gh issue list` nor `gh pr list` sets `--limit` (default 30). `git branch -d` relies on a merge-commit merge, which github-ops mandates for integration PRs. | Minor | Undetermined | Phase 6 steps 4 and 12; step 5; test plan EC-78, EC-82 |
| DR-8 | Wording: the Phase 6 intro says "steps 6 to 11 write, on the close-out branch only". Step 10 writes GitHub comments, which are not branch writes. Step 11 correctly commits only steps 7 to 9. | Minor | Unintended | Phase 6 intro, steps 10–11 |

Not drift: `docs/workflow-chains.md` is accurate to Phase 6's order (verify → issues → Project → roadmap → archive → PR, then delete). It is a summary that leaves out pull, branch creation, DF-5 and the status comments, which is acceptable for a chain diagram.

## Edge-case and randomized test outcomes

| Case | Outcome |
| ---- | ------- |
| EC-73 OPEN/CLOSED PR | Covered: step 1 stops, reports and writes nothing (PT-43). |
| EC-74 story still open | Covered: reported, never closed by hand (PT-43, whole-body negatives). |
| EC-75 Project read refused | Covered: `not observed(<reason>)`, never asks for scope (PT-43, `asksForScope`). |
| EC-76 roadmap row absent | Covered in Phase 6 step 7 (ask `product-engineer`, never invent). |
| EC-77 title search not wave-scoped | Resolved: sub-issues are primary, and the fallback is filtered to the state table. |
| EC-78 `--limit` | Open, advisory (DR-7). |
| EC-79 PR number not yet known | Resolved by D-65 wording. |
| EC-80 no branch step | Resolved: step 6. |
| EC-81 story PRs read after deletion | Resolved: step 4 runs before step 12. |
| EC-82 branch already deleted | Open, advisory (DR-7). |
| EC-83 fresh session | Resolved: intro plus Resume Detection. |
| EC-84 duplicate deletion directive | Resolved: the follow-up now says to run Phase 6. |
| EC-85 `mergeCommit` | Intended (DR-2). |
| EC-86 archive directory | Resolved: `workstream/archive/` is not ignored, and the suffix matches Phase 0.5. Phase 0.5 itself still renames in place, which is a known advisory outside this AC. |

- Randomized tactics: none apply to this prompt-only change.
- Dogfood rows DF-13, DF-14 and DF-15 run at this wave's consolidated PR and close-out, so they cannot be observed yet.

### Documentation structure

`checkDocsStructure` on the head: no failures and no staleness findings. `tsx core/checks/run.ts` exits 0.

### Vocabulary conformance

`checkExportedIdentifiers` over the PR's 455 added lines found no hits. No added line is an `export` declaration.

### Runbook coverage and roadmap mismatch

- Runbook coverage: not triggered. There are no script, workflow or infrastructure changes, and the task list has no configuration or setup steps.
- Roadmap mismatch: not triggered. S-011 does not complete the wave, and the wave 2 row is outside this story audit's trigger. Its current `Not started` belongs to the rollup.

## Recommendations

| ID | Next step |
| -- | --------- |
| DR-3 | `product-engineer`: decide the partial-wave rule. Either Phase 6 sets `Done` only when step 3 shows every story and the wave issue closed (otherwise `In progress`, with the unmerged stories in `What's missing`), or the Roadmap-Mismatch trigger 2 and FR-14 are amended. Then `developer` adds one sentence to step 7 in all three trees and a PT-43 marker. |
| DR-4 | `developer`: scope the branch-state invariant to the Phase 5 handoff, for example "…at the Phase 5 handoff; after Phase 6 it is the close-out branch or `main`". |
| DR-5 | `product-engineer`: add a `chore` row (close-out and housekeeping branches, example `chore/<plan-id>-closeout`) to github-ops § Branch Naming in all three trees, as a follow-up. No change to S-011. |
| DR-6 | No action needed in S-011. S-018 must define `shipped` in the PRD status table. |
| DR-7 | `developer` (optional): one sentence in step 12 ("a branch already absent counts as deleted"); optionally `--limit 200` on the list commands. |
| DR-8 | `developer` (optional): "steps 6 to 9 write on the close-out branch; step 10 edits comments; step 11 opens the PR". |
| DR-1, DR-2 | No action needed. |
