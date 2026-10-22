# Fidelity Report: projects-tracking — Wave 2 rollup (planner and verifier)

## Verdict

| Field                         | Value |
| ----------------------------- | ----- |
| **Fidelity**                  | **High** |
| **Highest open drift impact** | **Major** (1 item, Unintended, run conduct rather than prompt text: during this run the wave status comment was never edited at a developer closeout, so no story ever showed `PR open`; see RD-1). Open drift: 0 Critical, 1 Major, 17 Minor. |
| Scope                         | PRD `docs/requirements/prd-projects-tracking.md` v1.7, wave 2 (FR-11 to FR-16, FR-25; AC-8, AC-9, AC-10, AC-15); spec v1.1 (§16a wins); stories S-008, S-009, S-010, S-011, S-012, S-018 (issues #291 to #296, PRs #298 to #303); wave issue #290; PRD issue #289; follow-up #285 |
| Head audited                  | `c0f9772` on `integration/projects-tracking-phase-2` (planner checkpoint after the S-018 merge `680d808`). Read about one minute after the request from a detached worktree; `origin` head unchanged after the wait. Audited as one integrated diff, `git diff main...HEAD`: 34 files, +3254/−220, 47 commits. |
| Existing gates (not replaced) | `pnpm run validate` PASS on the head (typecheck; lint incl. `tsx core/checks/run.ts`; format:check; test: 71 files, 2370 tests). `pnpm run audit` PASS (no known vulnerabilities). `tsx core/checks/run.ts` exit 0. `checkDocsStructure`: 0 failures, 0 staleness. Vocabulary scan over the 3254 added lines: 0 hits. |
| AC coverage                   | PRD ACs: 4 of 4 Pass on the static half; live halves partly observed, the rest pending on named events (consolidated PR open, merge, close-out, wave 3 publish). FRs: 7 of 7 Pass on the text. Story ACs: 26 of 26 Pass on the head (S-012 AC-1 Drift and the S-011 AC-2 Major gap were fixed before their merges and re-confirmed here). |
| Blocking gaps                 | None. Every finding is advisory and does not block PR readiness or issue completion. Drift routes to `product-engineer` (`activity-drift-reconciliation`). |

## What changed and why (plain language)

Wave 2 changes the written instructions for the planner, the verifier and a few shared rules. It does not change application code. The planner now finds the wave's GitHub issue when a run starts. It saves its progress file into the shared branch after every story is merged. It also keeps one status comment on the wave issue and one on the PRD issue up to date, editing them in place instead of posting new comments. No agent closes a story any more. The final pull request to `main` lists every finished story and the wave, so GitHub closes them itself when that pull request merges. The roadmap line is filled from what GitHub reports, not from memory. A new last phase tidies up after the user merges. The verifier now checks the roadmap against the wave issue and its stories.

This run used the new rules on itself. The two status comments exist once each and were edited in place. The progress file was saved after every merge. No extra per-merge comments appeared. One rule was only half followed during the run: the wave comment was updated when each story merged, but never when a story's pull request was ready. Most remaining items are small wording mismatches or decisions still to record. The closing checks wait for the final pull request.

## Per-AC results (PRD, wave 2 scope)

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-8 | One marker comment on the wave issue after story start, closeout, merge and a second story start; state file on the integration branch after each merge | Planner § Wave Status Comment (9 events), merge rule step 13 (`git add -f`, `chore(planner): checkpoint after <story> merge`, push, then edit); identical in three trees outside the D-60 divergence | S-008, S-009 reports Pass; state file Run Info `Wave issue: #290` | Parity suite PT-33 to PT-38 green; live: #290 has exactly 1 marker comment (id 6347818375), 1 create + 6 edits within about 1 minute of each merge; six checkpoint commits, one after each merge commit | **Pass** (static); live half **partial**: closeout edit never observed (RD-1) |
| AC-9 | Consolidated PR has `Closes #N` per merged story and `Closes #<wave>`, plus the roadmap `gh` commands; no story closed before that PR merged | Phase 5 step 5 (sub-issues read, fallback search, merged story PRs, commands quoted in the PR body); step 7 `Closes` lines from the state table under `## Why`, one per line (D-67); "never closes a story issue or the wave issue"; implement rules 12, 13, lifecycle row and Final Instruction 5 rewritten ×3; github-ops `## Why` consolidated-PR sentence ×3 | S-010, S-011 reports Pass | PT-39 to PT-43, PT-48, PT-49 green; live: #291 to #296 and #290 all OPEN (none closed early) | **Pass** (static); live half pending (consolidated PR open) |
| AC-10 | Rollup reports a roadmap row that disagrees with the wave issue's sub-issue states, advisory | Verifier § Roadmap-Mismatch Finding: wave issue + paginated `sub_issues` first, merged PRs as fallback; trigger 1 requires every sub-issue and the wave issue closed (S-012 DR-1 fixed); `--state all` with its reason (S-012 DR-3 fixed); byte-identical in three trees | S-012 report (AC-1 Drift then fixed in f81583a) | PT-51 to PT-53 green, `--state all` and "the wave issue itself reads `closed`" pinned; live: this rollup's Roadmap section below (negative path, A-26) | **Pass** |
| AC-15 | One marker comment on the PRD issue after a wave is published and a run starts, listing the wave with its state | publish step 7 writes the row `published` and records `prd_status` ×3; planner § PRD Status Comment (run start, PR open, close-out); github-ops PRD table widened (D-63) ×3 | S-018 report Pass | PT-45, PT-46, PT-50 green; live: #289 has exactly 1 marker comment (id 6347818999), created 18:09:06Z, edited 20:20:44Z, wave 2 row `in progress` | **Pass** (static); run-start half observed **hand-applied** (A-25); publish half pending (wave 3) |

## Per-FR results (wave 2)

| FR | Codebase | Live | Result |
| -- | -------- | ---- | ------ |
| FR-11 | Step 13 ×3 (force-add, commit, push; push-rejection and hook-block rules) | Six checkpoint commits `bf54eaf`, `0c6801d`, `4bced12`, `2f9da9b`, `fb3b3e2`, `c0f9772`, each directly after its merge commit; `.gitignore:26` ignores the file, so `-f` was required | Pass |
| FR-12 | § Wave Status Comment ×3; github-ops wave table widened to the five states (D-63); per-merge comment sentence removed (D-53) | Exactly one marker comment on #290, edited in place; written at merges only (RD-1) | Pass (text); run conduct partial |
| FR-13 | Planner "never closes"; implement rules 12, 13 ×3; developer rule 6 ×3 | No story closed | Pass |
| FR-14 | Phase 5 step 5 and Phase 6 step 7 from `gh`; commands quoted in the PR body | Pending (step 5) | Pass (text) |
| FR-15 | Step 7 `Closes`/`Refs` set (D-67); github-ops `## Why` sentence ×3 | Pending | Pass (text) |
| FR-16 | Verifier comparison target and triggers ×3 | This report | Pass |
| FR-25 | Publish PRD write; planner PRD comment events; Artifacts lines: `plan` sets `Task plan:`, planner sets `Integration branch:` (Phase 3) and `Fidelity report:` (Phase 5 step 3) | #289 one comment; #290 body has `Integration branch:` and `Task plan:`; `Fidelity report:` pending this report | Pass (text) |

## Cross-story consistency (integrated tree)

| Check | Result |
| ----- | ------ |
| Planner read as one procedure: Phase 0 (wave issue, then PRD issue) → State File (both lines) → Phase 3 run start (both comments after the push, wave body branch line) → Phase 4 (story start, closeout, merge, block) → Phase 5 steps 3, 5, 7, 9 → Phase 6 → Roadmap Maintenance → Invariants → Output Contract | Coherent. Event numbering in § Wave Status Comment (steps 3, 7, Phase 6 "Status comments") matches the delivered step numbers (S-009 DR-5 resolved). One residual contradiction on partial waves (RD-2). |
| Three-tree parity of the wave 2 sections | Phase 0 resolution, Phase 0.5, § Wave/PRD Status Comment, Phase 5, Phase 6 and Roadmap Maintenance are byte-identical across `.claude`, `.github` and `.kiro`. The only differences are the D-60 pre-existing ones: merge gates 5, 6 and 13's opening, the qa/verifier Invariant, and Phase 3 list numbering. Verifier § Roadmap-Mismatch, the github-ops § Status comment block, and the publish and plan diffs are identical across trees. |
| Verifier triggers vs planner Phase 6 `Done` rule | Agree on the normal path: planner `Done` requires every state-table story `✅ Merged` and the wave issue closed; verifier trigger 1 requires every sub-issue and the wave issue closed. They still differ in one edge case: a story whose `Closes` was missed (S-012 DR-2, open). |
| github-ops wave and PRD tables vs what planner and publish write | Match. Wave: `pending`, `in progress (sub-task n of m)`, `PR open`, `merged into integration`, `blocked`. PRD: `published` (publish), `in progress`, `consolidated PR #n open`, `shipped` (planner). Rollup, PR-open and close-out wave events write the update line, not a state cell. |
| implement and developer close rules | Agree that nobody closes by hand. The two differ on which PR closes the issue for Copilot/Kiro single-issue runs (RD-15). |
| Agent-closing text anywhere | No prompt tells an agent to close a story or wave issue. Residual: the github-ops operations table "Close issue with attribution → `gh issue close`" row and § Issue Closure Attribution, with no story or wave carve-out, ×3 (S-010 DR-6, open, RD-5). |

## Drift catalog — items open on the head

De-duplicated against `fidelity-report-S-008.md` to `fidelity-report-S-018.md`. All items are **advisory and non-blocking** to PR readiness and issue completion and route to `product-engineer`'s `activity-drift-reconciliation`.

| ID | Description | Impact | Intent | Evidence | Owner |
| -- | ----------- | ------ | ------ | -------- | ----- |
| RD-1 | **Wave status comment not edited at developer closeout (new, run conduct).** The rule was live from the S-009 merge (18:50Z). After that, the closeouts of S-010, S-011, S-012 and S-018 never produced a `PR open` state. #290's edit history shows 1 create and 6 edits, each within about 1 minute of a merge. Story start was folded into the merge edit, and the result is equivalent. FR-12 and PRD AC-8 name closeout explicitly. The prompt text is correct. | Major | Unintended | GraphQL `userContentEdits` on comment 6347818375: 18:09:04, 18:25:27, 18:51:18, 19:15:39, 19:42:16, 19:57:42, 20:20:42; PR `createdAt` 18:54, 19:21, 19:43, 20:04 with no edit between creation and merge | planner (run conduct); product-engineer records DF-8 as partial |
| RD-2 | **Partial-wave residual of S-011 DR-3.** Phase 6 step 7 now keeps `In progress` when a story did not merge. Four texts still say it always ends `Done`: the Invariant "the roadmap row reads `Done`", Roadmap Maintenance ("to `Done` in Phase 6"; "Never leave the roadmap claiming `In progress` for a phase whose consolidated PR merged"), and `docs/workflow-chains.md` "Update roadmap row to Done" (×2). | Minor | Unintended | `.claude/commands/planner.md` Invariants, § Roadmap Maintenance (same ×3); `docs/workflow-chains.md` | developer (three trees); technical-writer (workflow-chains) |
| RD-3 | **PRD says wave 2 ships the migration runbook.** "An existing consumer migrates with the wave 2 runbook" and "Wave 2 adds `docs/runbooks/runbook-migrate-to-projects-tracking.md`, in the same PR as the planner change". FR-22 and S-017 place that runbook in wave 3, and wave 2 delivered none, correctly. This is stale text from v1.1. | Minor | Unintended | PRD lines 57, 59, 159; FR-22; story map S-017 | product-engineer (PRD changelog) |
| RD-4 | **Story and issue text not annotated where §16a superseded it.** S-008 resume backfill (EC-48; FR-21 overlap); S-009 AC-1 timing and events (D-70); S-010 AC-3 detection (D-68); S-010 AC-2, AC-4 and spec §8.5/§8.2 `## What` (D-67). | Minor | Intended | S-008 DR-1, S-009 DR-1, S-010 DR-2, DR-3 | product-engineer |
| RD-5 | github-ops "Close issue" row and § Issue Closure Attribution have no "never a story or wave issue" carve-out. | Minor | Undetermined | `.claude/agents/github-ops.md:43` (and ×3); S-010 DR-6 | product-engineer → developer |
| RD-6 | "No extra token scope is needed" for `projectItems` is unverified; A-37 recorded that `read:project` applies. A refused read is handled safely. | Minor | Undetermined | Phase 5 step 7, Phase 6 step 5 ×3; D-68; S-010 DR-1 | product-engineer |
| RD-7 | List-size and idempotency edges. The planner's `sub_issues` reads (Phase 5 step 5, Phase 6 step 3) lack `--paginate`, which the verifier uses. The fallback `gh issue list`/`gh pr list` have no `--limit` (default 30). Step 12 has no "already deleted counts as done". | Minor | Undetermined | S-011 DR-7; planner Phase 5/6 vs verifier § Comparison target | developer |
| RD-8 | Planner `Done` uses state-table merges plus the wave state, while verifier trigger 2 uses sub-issue states. When one story issue is left open because its keyword was missed, the planner writes `Done` and the verifier raises a finding. No text says whether this difference is intended. | Minor | Undetermined | S-012 DR-2 | product-engineer |
| RD-9 | Phase 5 step 3 does not pass Run Info's `Wave issue` to the verifier, although the verifier says "(the planner passes Run Info's `Wave issue: #N`)". The search fallback covers it. | Minor | Undetermined | S-012 DR-4 | developer |
| RD-10 | Test-plan literals not amended to decisions already taken. CT-20 still lists `wave_status: written` (planner decided `written` is not logged; S-009 DR-2). CT-22 still requires `--state open` byte-identity for the verifier (S-012 DR-3). The prompts and pins are right; only the Design Mode artifact lags. | Minor | Intended | `workstream/test-plan-projects-tracking-phase-2.md` CT-20, CT-22; state file Decisions Log ("CT-20 corrected at consolidation") | planner at consolidation, or verifier Design Mode re-run |
| RD-11 | `Fidelity report:` line when no report exists: "stays `pending`" assumes a line that a fresh wave body does not have. | Minor | Undetermined | Phase 5 step 3; S-018 DR-4 | product-engineer |
| RD-12 | #289's wave 1 row reads `shipped (PR #282, before tracking issues)` with `—`, outside the PRD table's state set and `#<issue>` cell; no rule says whether pre-hierarchy waves get a row (EC-96). The wave 3 row was removed. | Minor | Undetermined | `gh api repos/llipe/dev-tasks/issues/289/comments`; S-018 DR-5 (partly resolved) | product-engineer |
| RD-13 | Checkpoint step has no "commit if changed" guard (EC-51). Not hit in practice. | Minor | Undetermined | Step 13 ×3; S-008 DR-3 | product-engineer |
| RD-14 | **Run-conduct shape deviations (new).** The last checkpoint subject has a suffix ("…S-018 merge; all six stories on integration") beyond the pinned message. Each checkpoint commit also carries the story's fidelity report. The live Run Info puts `PRD issue` after `Wave issue`, where the format says after `Last updated`, and adds `Roadmap row` and `Test plan` lines. Early wave comment rows (pre-S-009) used `in progress` without the sub-task count. None of these breaks a reader or resume, because lines are read by label. | Minor | Undetermined | `git log` c0f9772; state file Run Info; #290 edit history | planner (no action required) |
| RD-15 | **Copilot and Kiro developer rule 6 and rule 12** say the issue closes "when the consolidated PR merges to main". On those platforms the same agent also runs single-issue work without a planner, where implement rule 12 says the story PR itself closes it. Pre-existing text; developer files unchanged in wave 2. | Minor | Undetermined | `.github/agents/developer.agent.md:73,305`, `.kiro/agents/developer.md:92,323`; implement rule 12 | product-engineer → developer |
| RD-16 | `TESTING.md` lags. The PRD AC-1 row still reads `pending`, although changelog 1.3 says DF-1 was observed on the wave 2 publish (#289, #290). There are no wave 2 rows yet (PRD AC-8, AC-9, AC-15, DF-5 In progress). The regex-test residual limit (8 synonym and qualifier probes) is not recorded. The state file says "the rollup records" it, but this audit edits no file. | Minor | Undetermined | `TESTING.md:153`; state file Decisions Log; S-018 qa result | planner (Phase 5 step 7, Phase 6 step 9); qa-engineer for the limit sentence |
| RD-17 | Wave 1 rollup R-6 (main-thread create: what fills the wave comment's header lines) is cited in spec §2 but no wave 2 story or task took it. The github-ops template now shows `or none` for two of the four lines; `Integration HEAD` with no integration branch is still unspecified. | Minor | Undetermined | spec §2; implement § Wave Status Update | product-engineer |
| RD-18 | Cosmetic, no action needed: Output Contract "`prd_status` values recorded in the Decisions Log" is broader than the close-out value (S-018 DR-1); `plan` Final Instruction `10a.` (S-018 DR-6). | Minor | Intended | S-018 DR-1, DR-6 | none |

**Closed on the head (verified, not carried):** S-009 DR-3 (step 13 conjunction, fixed by S-010), DR-5 (event anchors still correct); S-011 DR-3 (step 7 `Done` rule, fixed in 3d73861), DR-4 (invariant scoped), DR-6 (`shipped` defined by S-018), DR-8 (Phase 6 intro); S-012 DR-1 (trigger 1 requires the wave issue closed), DR-3 prompt half (reason stated and `--state all` pinned). **Accepted, no action:** S-008 DR-2; S-009 DR-4; S-010 DR-4, DR-5; S-011 DR-1, DR-2; S-018 DR-2, DR-3.

## Roadmap (Roadmap-Mismatch Finding, FR-16)

Comparison target: wave issue **#290**, from the state file's `Wave issue: #290`. The search was not needed: `gh issue list --label "level: wave" … --state all` was not run, because the caller named the issue. Sub-issues read with `gh api --paginate repos/llipe/dev-tasks/issues/290/sub_issues --jq '.[] | {number,state}'`: #291 open, #292 open, #293 open, #294 open, #295 open, #296 open. The wave issue #290 is open, and its parent is #289. Merged story PRs on the integration branch are #298, #299, #300, #301, #302 and #303.

**No finding.** Trigger 1 does not fire, because the wave is not complete: every sub-issue and #290 are open, and no default-branch PR exists yet (D-50, D-54). Trigger 2 does not fire, because the row is not `Done`. Trigger 3 does not fire, because the row exists. Trigger 4 does not fire, because `Issues/PRs` names #290 and #291–#296, the exact sub-issue set, and `What's missing` names no closed issue. Per A-26, this rollup runs before step 5, so the row is stale but not a finding: it reads `Not started` and "Task plan, then build".

What Phase 5 step 5 should write, from the reads above: `Status` **`In progress`**; `Issues/PRs` **wave #290, stories #291–#296 (open), story PRs #298–#303 (PRD issue #289)**; `What's missing` **"consolidated PR to `main`"** (all six stories merged into integration); `Last updated` 2026-10-22. Phase 6 then sets `Done` only when all six sub-issues and #290 read closed.

## Dogfood, edge-case and randomized outcomes

| DF | Criterion | Observed on the head date | Status |
| -- | --------- | ------------------------- | ------ |
| DF-6 | Checkpoint commit after each merge (FR-11) | Six `chore(planner): checkpoint after S-0xx merge` commits, each the first-parent child of its merge commit, touching the state file (and the story report) | observed (S-008 checkpoint and later: rule on the integration branch) |
| DF-7 | `Wave issue` in Run Info and plan header | Plan line 4 `Wave issue: #290` after `Source:`; Run Info `- Wave issue: #290` right after `- Repository:`; `- PRD issue: #289` present | observed |
| DF-8 | One wave marker comment, edited in place | 1 marker comment on #290; 1 create + 6 edits; table shows all six `merged into integration`; `Integration HEAD: c0f9772` matches the head; no closeout edit (RD-1) | observed, partial; run start and S-008/S-009 writes hand-applied (A-25, rule merged at S-009) |
| DF-9 | No per-merge table comments on #290 to #296 | 0 comments matching `\| Sequence \| Story ID` on any of #290 to #296; each story issue carries only its Design Mode comment and its one developer status comment | observed |
| DF-10 | No story closed before the consolidated merge | #291 to #296 and #290 all OPEN | observed so far; pending (consolidated PR merge) for the close half |
| DF-11 | `Closes` lines in the consolidated PR | — | pending (consolidated PR open) |
| DF-12 | Project Status In progress at PR open | #290 Project "Dev-tasks" reads `Backlog` today, consistent with D-50 | pending (consolidated PR open) |
| DF-13 | Project Status Done at merge | — | pending (consolidated PR merge) |
| DF-14 | Roadmap row from `gh`, commands in the PR body | Expected values above | pending (Phase 5 step 5) |
| DF-15 | Close-out | — | pending (user's merge notice, Phase 6) |
| DF-16 | PRD marker comment at run start, PR open, close-out | 1 marker comment on #289; created 18:09:06Z with wave 2 `in progress`; edited 20:20:44Z to the D-63 states (wave 3 row removed) | run start observed, hand-applied (A-25, rule merged at S-018); PR open and close-out pending |
| DF-16b | Publish-time PRD write | — | pending (wave 3 publish) |
| DF-17 | Wave body Artifacts and branch lines | #290 body: `Integration branch: \`integration/projects-tracking-phase-2\``, `Task plan:` link; no `Fidelity report:` line yet | branch and task-plan lines observed, hand-applied; fidelity line pending (Phase 5 step 3, after this report) |
| DF-18 | Rollup compares the row with #290 and its sub-issues | This report, § Roadmap: no finding, with reason | observed (negative path; A-26, none manufactured) |
| DF-19 | Developer closeout `wave_status: owned-by-planner` | Closeout payloads are returned to the planner and not published. No GitHub artifact carries them, and the state file logs only skipped and failed values. | not observable from GitHub (planner-held) |
| DF-20 | Main-thread story closes through its own PR | — | pending (first main-thread `/developer` run after ship) |
| DF-3 (200 path), DF-1b | Carried from wave 1 | — | pending (main-thread run on a wave 2 story; wave 3 publish) |

Edge cases: the EC catalog is static by construction. The cases with a delivered sentence are asserted by the parity suite and pass on the head: EC-44 and EC-48, the EC-58 vocabulary, EC-64 (one keyword per line), EC-74 (open story reported, not closed), EC-80 (close-out branch) and EC-93 (row edited in place). Those still open are carried as RD-7, RD-11, RD-12 and RD-13. Randomized tactics: none generated for prompt text (RT-4 had no constant to self-check; RT-5 helpers self-tested). The qa residual is 8 synonym or qualifier probes that regex pins cannot catch (RD-16).

**Runbook coverage (FR-49b):** the task list's steps are prompt and test edits, with no script, workflow, configuration or migration step. **No finding.** RD-3 records the PRD's stale runbook sentence as spec drift.

**Documentation structure:** `checkDocsStructure` on the delivered tree reports 0 failures and 0 staleness, and `tsx core/checks/run.ts` exits 0.

**Vocabulary conformance:** `checkExportedIdentifiers` over the 3254 added lines of `git diff main...HEAD` against `docs/domain/ubiquitous-language.md` reports 0 hits. The only `.ts` change is a Vitest file with no new `export`. Advisory, never blocking (D-63).

## Traceability summary

| Matrix scope (`traceability-matrix-projects-tracking-phase-2.md` v1.0) | Rows | Pass (static) | Observed (live) | Pending (named event) | Drift |
| ---- | ---- | ---- | ---- | ---- | ---- |
| PRD ACs (AC-8, AC-9, AC-10, AC-15) | 4 | 4 | AC-8 (partial), AC-10, AC-15 run-start half (hand-applied) | AC-9 (PR open/merge), AC-15 publish half (wave 3) | AC-8 live half (RD-1) |
| PRD FRs (FR-11 to FR-16, FR-25) | 7 | 7 | FR-11, FR-12 (partial), FR-13 (so far), FR-16, FR-25 (partial) | FR-14, FR-15, FR-25 PR-open/close-out | FR-12 run conduct (RD-1); FR-14 partial-wave wording (RD-2) |
| Story ACs (S-008 5, S-009 4, S-010 6, S-011 4, S-012 3, S-018 4) | 26 | 26 | S-008 AC-3/AC-4, S-009 AC-2, S-012 AC-1 | S-010 AC-2/AC-3, S-011 AC-1/AC-2, S-018 AC-1 | — |
| #285 criteria | 4 | AC-1, AC-2, AC-4 met in text | — | AC-3 (DF-5 at PR open and merge) | — |
| Decision constraints D-52 to D-70 | 19 | 19 | D-52, D-53, D-59, D-63 (PRD table), D-69 (parent read, branch line), D-70 | D-55/D-64, D-56/D-67, D-58, D-61/D-66, D-68 | D-60 divergence left as decided |

AC-ID → Test → Observed → Result: AC-8 → PT-33..PT-38, DF-6..DF-9 → one comment, six checkpoints, no closeout edit → Pass (static) / Drift (live, RD-1). AC-9 → PT-39..PT-43, PT-48, PT-49, DF-10, DF-11, DF-14 → no early close → Pass (static) / pending. AC-10 → PT-51..PT-53, DF-18 → no finding with reason → Pass. AC-15 → PT-45, PT-46, PT-50, DF-16 → one comment, in place → Pass (static) / observed hand-applied.

## Follow-ups that belong in new issues

| ID | Follow-up | Owner |
| -- | --------- | ----- |
| F-1 | Make the partial-wave rule consistent: Invariant, Roadmap Maintenance and `docs/workflow-chains.md` say `Done` "once the merge is verified when every story merged", otherwise `In progress` (RD-2); decide the verifier/planner difference for a missed keyword (RD-8). | product-engineer → developer, technical-writer |
| F-2 | github-ops hygiene ×3: story/wave carve-out on the "Close issue" row and § Issue Closure Attribution (RD-5); a `chore` type in § Branch Naming for `chore/<plan-id>-closeout` (S-011 DR-5). | product-engineer → developer |
| F-3 | Planner robustness ×3: `--paginate` on `sub_issues`, `--limit` on fallback lists, "already deleted counts as done" at step 12, "commit if changed" at step 13, pass `Wave issue` to the rollup at step 3, `Fidelity report:` line when no report exists (RD-7, RD-9, RD-11, RD-13). | developer |
| F-4 | PRD v1.8 changelog: drop "wave 2 runbook" sentences (RD-3); annotate stories S-008 to S-010 and spec §8.2/§8.5 with the §16a supersessions (RD-4); decide pre-hierarchy wave rows in the PRD table (RD-12); verify the `read:project` claim with a narrower token (RD-6). | product-engineer |
| F-5 | Developer agents on Copilot and Kiro: state both closing paths, matching implement rule 12 (RD-15); main-thread wave-comment header fill (RD-17, wave 1 R-6). | product-engineer → developer |
| F-6 | Decide whether the planner may fold story start into the merge edit, and enforce the closeout edit (for example, a merge gate that checks the wave comment shows `PR open` before merging) (RD-1). | product-engineer |
| F-7 | #285 stays open after this wave until its AC-3 is recorded at close-out. Name who closes it: `Closes #285` in the close-out PR, or the user. | planner / product-engineer |

## Recommendations

| Item | Next step |
| ---- | --------- |
| RD-1 | `product-engineer`: record DF-8 as `observed, partial (no closeout edit)` in `TESTING.md` at close-out and open F-6. The planner edits the wave comment at the next events as written. |
| RD-2, RD-7, RD-9, RD-11, RD-13 | `developer` via F-1 and F-3 in a later issue; no change to this consolidated PR is required. |
| RD-3, RD-4, RD-6, RD-8, RD-12, RD-17 | `product-engineer` spec and PRD clarification (F-1, F-4, F-5). |
| RD-5, RD-15 | `product-engineer` → `developer` (F-2, F-5). |
| RD-10 | Planner applies the CT-20 and CT-22 amendments it already decided when consolidating, or a `verifier` Design Mode refresh. |
| RD-14, RD-18 | No action needed. |
| RD-16 | Planner fills the wave 2 rows and DF-5 In progress at Phase 5 step 7, and Done at Phase 6 step 9. `qa-engineer` adds one sentence on the regex-pin limit. Correct the PRD AC-1 row from the 1.3 changelog evidence. |

This file lives under `/workstream/`, which `.gitignore:26` ignores; commit it with `git add -f`.

## Changelog

| Version | Date       | Change                                 | Author   |
| ------- | ---------- | -------------------------------------- | -------- |
| 1.0     | 2026-10-22 | Initial Audit Mode PRD-level rollup    | verifier |
