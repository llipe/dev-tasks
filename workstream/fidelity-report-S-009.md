# Fidelity Report - S-009 (#292)

**Fidelity: High** | **Highest drift impact: Minor** | Scope: Story S-009 (#292), wave issue #290, PR #299 (`story/S-009-wave-status-comment` @ `b9e9034` → `integration/projects-tracking-phase-2` @ `bf54eaf`)

Drift: 0 Critical, 0 Major, 5 Minor. All drift is advisory and non-blocking to PR readiness and issue completion. It routes to `product-engineer`'s `activity-drift-reconciliation`.

## Changelog

| Version | Date       | Change                    | Author   |
| ------- | ---------- | ------------------------- | -------- |
| 1.0     | 2026-10-22 | Initial Audit Mode report | verifier |

## What changed and why

The planner now keeps a single progress note on the GitHub issue that tracks the whole wave. It writes the note once, when the run's shared branch exists, and then updates that same note whenever a story starts, a story's work is handed back, a story is merged, a story is blocked, the final review summary is ready, the combined pull request opens, and the wave ships. Before this change the planner added a new comment after every merge, and in the last wave those comments ended up spread across six different story issues.

The note's story states are now the same words everywhere: pending, in progress (with how many steps are done), PR open, merged into integration, and blocked. GitHub's comment template was widened to allow those words, because it previously listed a shorter, different set. When there is no wave issue, or GitHub refuses the update, the planner writes that down in its progress file and its final summary, and carries on: a failed note never holds up a merge. The final review summary, which used to be posted as a separate comment, now goes into the same note. Only the planner and comment-template instructions and their tests changed; the existing merge checks were left as they were.

## Sources

- Story S-009 AC-1 to AC-4 (`workstream/user-stories-projects-tracking-phase-2.md:87`).
- Spec v1.1 §8.2, §8.7, §9 and §16a (`workstream/specification-projects-tracking-phase-2.md`). §16a wins where it differs.
- PRD v1.7 FR-12 (`docs/requirements/prd-projects-tracking.md:96`) and AC-8.
- Decisions D-25, D-26, D-33, D-53, D-60, D-63, D-70 (`workstream/decisions-projects-tracking.md`).
- Design Mode plan `workstream/test-plan-projects-tracking-phase-2.md` (PT-36 to PT-38, PT-47, CT-15, CT-20, LT-9, LT-11, EC-52 to EC-61, DF-8, DF-9, findings A-20, A-30, A-31, A-32, A-40, A-45) and `workstream/traceability-matrix-projects-tracking-phase-2.md` § S-009.
- Codebase: `gh pr diff 299`. The head tree was read in a detached worktree at `b9e9034`, removed afterwards. The main checkout was not switched.
- Live GitHub: comments on #290 to #296.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | Wave status comment created at run start (or edited on resume) and edited in place at story start, developer closeout, merge (step 13) and block, by the implement § Status Comment procedure and github-ops's wave table | New `### Wave Status Comment` section in Phase 4, byte-identical in all three planner copies. It names implement § Status Comment and github-ops § Status comment and does not restate the table (D-33), and lists nine events in order: Run start, Resume, Story start, Developer closeout, Merge, Block, Rollup, Consolidated PR open, Close-out. Run start sits at the end of Phase 3 after the push, not at the end of Phase 0 (D-70 supersedes the AC wording, see DR-1). Resume bullet in Phase 0.5, handoff sentence in Phase 4, step 13 tail, and the Error Handling `Story returns blocked` row all point at it. github-ops's wave `State` cell is widened to `pending, in progress (sub-task n of m), PR open, merged into integration or blocked` in all three trees (D-63, A-20). | Tasks 2.2, 2.2a, 2.2b, 2.5 and 2.6 are checked. | PT-36 `planner > wave status comment events` and PT-4 extension `github-ops > wave table states` are green on head and red on base. | Pass (Intended drift on timing, DR-1) |
| AC-2 | Step 13's per-merge comment sentence gone from all three; Invariants read "edit the wave status comment" | "post a GitHub Issue comment on the plan/milestone issue" is absent from all three copies, and "plan/milestone issue" is absent anywhere (A-31: Phase 5 step 3 now targets the wave status comment, with the consolidated PR body as the no-wave-issue fallback). Invariant: "Planner **MUST**, after every story merge, write the checkpoint state file, commit the state file (force-added and pushed to the integration branch) and edit the wave status comment.", identical in three trees (A-32). | Tasks 2.3, 2.3a and 2.7 are checked. | PT-37 `planner > no per-merge comment` is green on head and red on base. S-008's interim positive pin on the old sentence was removed in the same PR (A-45 sequence held). | Pass |
| AC-3 | No wave issue → `wave_status: skipped(no wave issue)` to Decisions Log and run summary; refused PATCH → `wave_status: failed(<reason>)`; never blocks a merge | The Wave Status Comment section's last paragraph carries both values, `failed(duplicate marker)` per implement § Status Comment item 4 (EC-52), the Decisions Log and run-summary targets, and "never blocks a merge gate, a story, or the consolidated PR handoff". The state-file template's Decisions Log gains a `wave_status:` line; the Output Contract gains a `wave_status` bullet. | Tasks 2.4 and 2.8 are checked. | PT-38 `planner > wave_status report values` is green on head and red on base. | Pass (see DR-2 on `written`) |
| AC-4 | Parity `planner` block gains assertions for AC-1 to AC-3 and the negative on the removed sentence | `test/unit/projects-tracking-parity.test.ts`: PT-36, PT-37, PT-38 in `describe("planner")`, the `waveStateCell` helper, and the `github-ops > wave table states` pin. | Task 2.1 is checked. | All four new tests fail against the base prompts (checked by swapping the six base prompt files into the worktree) and pass on head, so the tests were written first (D-34). | Pass |

## Targeted checks requested

| Check | Result |
| ----- | ------ |
| Each AC in all three planner copies | Pass. The `+` lines of the `.claude`, `.github` and `.kiro` diffs are identical except step 13, whose pre-existing lead-in differs by design (D-60). `.github` and `.kiro` diffs are identical apart from that line. |
| D-60: only sentences added, merge-gate wording untouched | Pass. Per copy the only rewritten prose lines are step 13 (per-merge clause removed, one sentence appended), Phase 5 steps 3, 7 and 9, the Invariant, and the `Story returns blocked` row. Gates 5 and 6 are untouched. Step 13 keeps `.github`'s "**Write checkpoint**" wording and the `.claude`/`.kiro` `gh pr view` verification clause byte for byte; it is still one line, identical in `.claude` and `.kiro` (LT-9 green, EC-60). The other `.github`/`.kiro` Error Handling rows changed by padding only. |
| Per-merge comment sentence gone everywhere | Pass. No planner copy contains "plan/milestone issue". |
| References by name, table not restated (D-33) | Pass. "implement § Status Comment" and "github-ops § Status comment" appear in all three; `\| Story \| State \| PR \| Sub-task \|` does not appear in any planner copy. The section names the four summary-line fields and the five state words, which CT-15 requires as one shared vocabulary; that is a reference, not a restatement. Both target headings exist (`### Status Comment` in the three implement files, `#### Status comment` in github-ops). |
| github-ops widened wave table identical across trees | Pass. The diff hunks have one md5 across three trees, and the whole `#### Status comment` section is byte-identical across three trees. No remaining `in review` state anywhere in github-ops, implement or the planner. |
| Rollup summary targets the wave comment | Pass. Phase 5 step 3: "Record the resulting human-readable summary in the wave status comment, edited in place …, never as a new comment; with no wave issue, carry it in the consolidated PR body." |
| Existing pins pass | Pass. LT-9 `planner-merge-gate-parity` (3), LT-10 `planner-decision-log-parity` (7), LT-11 `roadmap-parity` (22), PT-33 to PT-35 and PT-47 markers green. |
| Quality gates on head (worktree run) | `pnpm run validate` exit 0: `typecheck`, `lint` (incl. `core/checks/run.ts`), `format:check`, `test`: 71 files, 2345 tests, all passed. PR CI `pnpm run validate` was pending at audit time. |
| Dogfood: #290 has exactly one marker comment, edited in place | Pass. One comment starts with `<!-- dev-tasks:status -->` (id 6347818375), created 2026-10-22T18:09:04Z, updated 18:25:27Z. `Integration HEAD: bf54eaf` equals `git rev-parse --short origin/integration/projects-tracking-phase-2`. DF-9 so far: 0 non-marker status-table comments on #290 to #296. |

## Drift catalog

All items are non-blocking to PR #299 readiness and to #292 completion.

| ID | Description | Impact | Intent | Evidence |
| -- | ----------- | ------ | ------ | -------- |
| DR-1 | AC-1 says the comment is created "at the end of Phase 0 (or Phase 0.5 on resume)". The delivered text creates it at the end of Phase 3, after the integration branch push, and only edits on resume. It also adds Rollup, Consolidated PR open and Close-out events beyond AC-1's list. Both follow D-70 (A-30, A-40) and spec §16a, which supersede the AC. The story text still carries the old wording. | Minor | Intended | Planner Phase 3 and Wave Status Comment section (three copies); D-70; story S-009 AC-1 |
| DR-2 | CT-20 lists `wave_status: written \| failed(<reason>) \| skipped(no wave issue)`. The planner records only skipped and failed values ("Every skipped or failed value goes to the state file's Decisions Log and to the run summary"); a successful write reports nothing, and the Output Contract bullet names only the Decisions Log values. AC-3 does not require `written`. | Minor | Undetermined | Wave Status Comment last paragraph; Output Contract; test plan CT-20 |
| DR-3 | Step 13's list lost its conjunction when the clause was removed: "…update `Current Position` to the next pending story, update the `Last updated` timestamp. Then commit…". Wording only; meaning unchanged. | Minor | Unintended | Step 13 (three copies) |
| DR-4 | The PR also tightens two S-008 assertions in PT-33 (anchors the order check on the "Resolve in this order:" steps; scopes the `skipped(no wave issue)` line comparison to the Phase 0 span). The second change is required because S-009 adds the same value in two more places; the first is S-008 qa gate hardening (G1) carried here. No S-009 AC asks for it; it strengthens rather than weakens the pins. | Minor | Intended | `test/unit/projects-tracking-parity.test.ts` PT-33 hunk |
| DR-5 | Events are anchored to step numbers: "Phase 5 step 3", "step 7", "step 9". S-010, S-011 and S-018 edit the Phase 5 list (A-33), and spec §8.2 puts close-out in a new Phase 6 (S-011). If those stories renumber or move close-out, the Wave Status Comment section must be re-pointed. PT-36 locates steps 7 and 9 by number too. | Minor | Intended | Wave Status Comment events 7 to 9; test plan A-33, A-45 overlap table |

Not drift, noted for the record:

- The live #290 comment was hand-applied before this rule: S-009's row reads `in progress` with `0 of 12`, the row format is `S-008 #291` rather than the template's `S-008 (#291)`, and it has not yet been edited for PR #299 (`PR open`). The rule takes effect from the S-009 merge; DF-8 at S-010 story start should see the widened vocabulary and the template row format.
- EC-53 (resume edits, never creates) and EC-54 (block row) are static only; no resume or block has happened in this run.
- Phase 3's sub-list numbering (`1. Push integration branch` after `3. Create integration branch`) is pre-existing and untouched.

## Edge-case and test-plan outcomes

| Test-plan row | Outcome |
| ------------- | ------- |
| PT-36 / CT-15 (incl. D-33 negative) | Satisfied |
| PT-37 (incl. A-31 extension, A-32 invariant) | Satisfied |
| PT-38 | Satisfied |
| PT-4 extension (A-20) | Satisfied |
| PT-47 (S-009 markers) | Satisfied; the Wave Status Comment section and the Invariant are each asserted identical across trees |
| LT-9, LT-10, LT-11 | Green on head |
| EC-52 (two marked comments) | Satisfied by reference to implement § Status Comment item 4 |
| EC-53 (resume) | Satisfied (static) |
| EC-54 (block mid-story) | Satisfied (static, Error Handling row and Block event) |
| EC-55, EC-56 | Satisfied (static) |
| EC-57 (comment before approval) | Resolved by D-70; creation moved to after the Phase 3 push |
| EC-58 (state vocabulary) | Resolved by D-63; one vocabulary, pinned on both sides |
| EC-59 (step 3 residual) | Resolved (A-31) |
| EC-60 (step 13 verification intact) | Satisfied (LT-9) |
| EC-61 (pagination) | Satisfied by reference (`--paginate` in the procedure) |
| A-20, A-30, A-31, A-32, A-40, A-45 | All resolved as recommended or per D-63/D-70 |
| DF-8 (dogfood) | Partial: one marker comment, edited in place, HEAD correct. Full check due at S-010 story start |
| DF-9 (dogfood) | So far 0 on #290 to #296; final read at end of Phase 4 |

No randomized tests were run in scope.

### Documentation structure

`checkDocsStructure` on the head tree (`tsx core/checks/run.ts` exit 0, plus a direct call): 0 failures, 0 staleness findings.

### Vocabulary conformance

`checkExportedIdentifiers` over the added lines of `git diff bf54eaf...b9e9034` against `docs/domain/ubiquitous-language.md`: 0 hits. The only new identifier (`waveStateCell`) is not exported. Advisory, never blocks.

### Runbook coverage (FR-49b)

Not a finding. Task 2.0's steps are prompt and test edits; no script or workflow under `templates/` or `.github/workflows/` changed.

### Roadmap mismatch

Not applicable. S-009 does not complete the wave. (`docs/roadmap.md` row 2 reads `Not started` while the wave is running; no trigger covers that, and the planner updates the row in Phase 5.)

## Recommendations

| Drift | Next step |
| ----- | --------- |
| DR-1 | `product-engineer`: record in the S-009 changelog that AC-1's timing and event list follow D-70 and §16a. |
| DR-2 | `product-engineer`: decide whether `wave_status: written` is reported. If yes, route a one-sentence addition to `developer` in a later story; otherwise drop `written` from CT-20. |
| DR-3 | `developer`: restore "and" before "update the `Last updated` timestamp" in step 13 of all three copies, in this PR or the next story that edits step 13 (S-010), keeping LT-9's one-line shape. |
| DR-4 | No action needed. |
| DR-5 | `developer` (S-010, S-011, S-018): re-point the Wave Status Comment events and PT-36 if Phase 5 is renumbered or close-out moves to Phase 6. |
