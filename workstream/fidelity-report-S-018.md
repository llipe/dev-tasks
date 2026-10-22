# Fidelity Report: S-018 (#296)

**Fidelity: High** | **Highest drift impact: Minor** | Scope: S-018 (#296), PR #303 `story/S-018-prd-status-comment` @ `3a48006` → `integration/projects-tracking-phase-2` @ `fb3b3e2`

- AC coverage: 4 of 4 Pass, plus 6 Minor drift items (3 Intended, 0 Unintended, 3 Undetermined). Drift does not block the PR or the issue.
- Three trees: the changed lines are byte-identical across `.claude`, `.github` and `.kiro` for all four file groups (github-ops, planner, publish, plan).
- Gates at head: `test` 2370/2370, `lint`, `format:check` and `typecheck` all pass. The six new S-018 tests fail on the base for the intended reasons and pass at head.
- Live (read only): #289 has exactly 1 marker comment, and `GET issues/290/parent` returns `289`.

## Changelog

| Version | Date       | Change                     | Author   |
| ------- | ---------- | -------------------------- | -------- |
| 1.0     | 2026-10-22 | Audit Mode report for S-018 | verifier |

## Human-readable summary

The PRD's tracking issue now has a single status note that lists each wave, its state and its tracking issue. Publishing a wave adds that wave as "published". The planner updates it to "in progress" when a run starts, to "consolidated PR #n open" when the final pull request opens, and to "shipped" after the user reports the merge. The note is edited in place and never duplicated. The planner finds the PRD issue by reading the wave issue's parent, and falls back to a title search. The wave issue's Artifacts list now gets filled in by whoever produces each item: the task-list step links the task plan, the planner records the integration branch at pre-flight, and the planner adds the fidelity report link once the rollup audit writes it.

The developer's three judgement calls hold up. The new state-file line sits after the timestamps so an existing check keeps passing. The final "shipped" result goes to the run summary and the close-out pull request, because the state file has already been archived by then. And the publish template was not changed to add a fidelity-report placeholder, because the planner adds that line itself. The remaining items are small wording points and a note about the status comment already live on #289.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | Publish creates or edits the PRD status comment after the hierarchy is verified, with the wave's row `published`, and reports `prd_status` | Publish Process step 7 **Write the PRD Status Comment** comes after step 6 (Attach and Verify) and before **Save Output**. It names github-ops § Status comment's PRD table and implement § Status Comment's procedure, says "never added a second time" (A-36/EC-93), resolves the PRD issue from step 3 or the `level: prd` search, and skips otherwise. The report's Tracking Issues section has the `prd_status:` line. Final Instruction 6 is added. Identical in 3 trees. | Task 6.2 `[x]`. Spec §8.3. | PT-50 `activity-publish-github PRD status comment` green, red on base. DF-16b (the live publish half) is still `pending` until the wave 3 publish (A-27). | Pass |
| AC-2 | Planner edits the comment at run start (`in progress`), consolidated PR open (`consolidated PR #n open`) and close-out (`shipped`), and reports `prd_status` in the state file | A new `### PRD Status Comment` subsection lists the 3 events in order: Phase 3 pre-flight (D-70), Phase 5 step 7, Phase 6 step 10. Each event's text is in its phase. The vocabulary includes `failed(duplicate marker)`, and the write "never blocks" anything. `prd_status` is in the Decisions Log template and the Output Contract. The new `### PRD Issue Resolution` reads the wave's parent first, then the search, then skip (D-69, A-29), and Run Info gains `PRD issue: #N \| none`. Resume reads it. | Tasks 6.3 and 6.3a `[x]`. Spec §8.2 and §16a (D-69, D-70). | PT-45 `PRD status comment events` and `PRD issue resolution` green, red on base. The PRD search is pinned byte-identical to publish's (CT-22). | Pass (DR-1, DR-2) |
| AC-3 | Wave body Artifacts: `plan` sets `Task plan:`, the planner sets the fidelity report at Phase 5 | `plan` Process step 7 **Set the Task Plan Line** runs after Save Output only when the header reads `Wave issue: #N`, and edits through `--body-file`. Final Instruction 10a is added. Planner Phase 5 step 3 sub-bullet **Fidelity report line** adds or sets `Fidelity report:` after `Task plan:`. Planner Phase 3 sets `Integration branch:` (D-69, "pre-flight"). The body edits never use inline `--body "`. | Tasks 6.3a and 6.4 `[x]`. FR-25 ("product-engineer for the task plan" is satisfied through the `plan` skill). | PT-32 `artifacts task plan line` and PT-46 `artifacts fidelity report line` green, red on base. Live #290's `Task plan:` and `Integration branch:` are filled (hand-applied this run). | Pass (DR-3, DR-4, DR-6) |
| AC-4 | Parity file extends the publish, planner and plan blocks | `test/unit/projects-tracking-parity.test.ts` +445/-9. There are 6 new S-018 tests: github-ops `PRD table states`, publish `PRD status comment`, plan `artifacts task plan line`, planner `PRD issue resolution`, `PRD status comment events` and `artifacts fidelity report line`. Each has a cross-tree identity assertion. | Task 6.1 `[x]`. | 66/66 tests in the file pass. On base prompts exactly these 6 fail and 60 pass. | Pass |

### Cross-cutting checks

| Check | Result | Evidence |
| ----- | ------ | -------- |
| Three-tree parity | Pass | The md5 of the `-U0` changed lines is identical across the 3 copies of github-ops, planner, publish and plan. |
| D-33: reference the template, don't restate it | Pass | Planner and publish name "github-ops § Status comment" and "implement § Status Comment". Neither contains `\| Wave \| State \| Wave issue \|` (pinned negative in PT-45 and PT-50). Only github-ops carries the table. |
| D-63: PRD state set widened | Pass | The github-ops `State` cell is `<published, in progress, consolidated PR #n open or shipped>`, and the one-row-per-wave and edit-in-place rule was added (A-21 resolved). |
| D-60: merge-gate wording untouched | Pass | The planner has only 2 removed lines (Phase 5 step 7 and Phase 6 step 10, both extended). No hunk falls inside `### Merge management rule`. The new subsection is inserted before that rule. `planner-merge-gate-parity` passes 3/3. |
| D-25/D-26: one comment, found by marker | Pass | Both writers use implement's find-by-marker procedure. The duplicate-marker case is `failed(duplicate marker)`. |
| Existing pins | Pass | `skill-parity-grilling` 121, `roadmap-parity` 22, `planner-merge-gate-parity` 3, `planner-decision-log-parity` 7, and all S-008 to S-012 blocks pass. The S-008 pin (Wave issue at Repository+1, Started at +2) still holds. |
| `docs/workflow-chains.md` note | Accurate | It names the four events and states in order, and the three Artifacts lines with their owners. It uses `publish-github`, which matches the file's existing naming (5 occurrences). It leaves out the "when the wave issue is known" condition for `Task plan:`, which is acceptable for a summary note. |
| Live dogfood | Pass | #289 has `marker count = 1` (also 1 with a `contains` match). `gh api repos/llipe/dev-tasks/issues/290/parent --jq .number` returns `289`. |

## Drift catalog

None of these items blocks PR #303 or issue #296. They route to `product-engineer`'s `activity-drift-reconciliation`.

| ID | Description | Impact | Intent | Evidence |
| -- | ----------- | ------ | ------ | -------- |
| DR-1 | **The close-out `prd_status` goes to the run summary and the close-out PR body, not the state file.** AC-2 says "reporting `prd_status` in the state file". Phase 6 step 8 archives the state file with `git mv` before step 10 writes the comment, and the step order is fixed by D-66 (S-011). The developer's choice holds: step 11 opens the close-out PR after step 10, so the PR body can carry the value. The Output Contract line "`prd_status` values recorded in the Decisions Log" is slightly too broad for this one value. The S-011 `wave_status` close-out write is treated the same way, so the behavior is consistent. | Minor | Intended | Planner `### PRD Status Comment` last paragraph, Phase 6 step 10, Output Contract |
| DR-2 | **The `PRD issue` Run Info line comes after `Last updated`, away from `Wave issue`.** This is cosmetic. The S-008 pin requires `Started` at Repository+2, so this is the only position in the block that keeps that pin without editing it. Readers find the line by its label, and resume reads it by name. | Minor | Intended | State File Format; test lines 1387-1389 |
| DR-3 | **No `Fidelity report: pending` line in publish's wave template.** A-39's second recommendation was not adopted. D-69 says the planner "adds `Fidelity report:` at Phase 5", and the planner adds the line after `Task plan:` when it is missing, so the decision is met without changing publish. This also keeps S-018's footprint to the files the story lists plus github-ops (A-21). | Minor | Intended | D-69; publish wave template (no change); Phase 5 step 3 sub-bullet |
| DR-4 | **"When no report file exists the line stays `pending`" assumes the line already exists.** Because of DR-3, a fresh wave body has no `Fidelity report:` line. If there is no report, the text doesn't say whether to add the line as `pending` or leave it out. This rarely matters, because the rollup audit is mandatory and normally writes a report. | Minor | Undetermined | Phase 5 step 3 **Fidelity report line**; EC-94 |
| DR-5 | **The live #289 comment, hand-applied before the rule, has states outside the widened set.** Wave 3 reads `not started`, and wave 1 reads `shipped (PR #282, before tracking issues)` with `—` as its wave issue. D-63 replaced `not started`, and no rule says whether an unpublished wave gets a row (EC-96). The planner's "keep every other row as it is" will keep them as written. | Minor | Undetermined | `gh api repos/llipe/dev-tasks/issues/289/comments` |
| DR-6 | **The `plan` Final Instruction is numbered `10a.`** It is indented under item 10, so it renders as a continuation paragraph of item 10, not as a list item. This keeps items 11 onward stable, and `format:check` passes. It is cosmetic. | Minor | Undetermined | `plan` Final Instructions, 3 copies |

### Advisory findings

- **Documentation structure** (`tsx core/checks/run.ts` exit 0; `checkDocsStructure` at head): 0 failures, 0 staleness.
- **Vocabulary conformance** (`checkExportedIdentifiers` over 594 added lines of `git diff fb3b3e2...HEAD`): 0 export lines and 0 hits. This is advisory and never blocks (D-63).
- **Runbook coverage (FR-49b):** No finding. There are no `templates/scripts/`, `templates/workflows/` or `.github/workflows/` changes and no configuration, environment, tooling, credentials or data steps; the edits are prompt and test changes only.
- **Roadmap mismatch:** No finding, because the trigger isn't met. S-018 doesn't complete wave 2: wave #290 and sub-issues #291 to #296 are all `open`, as D-54 expects before ship. I read the sub-issues with `gh api --paginate repos/llipe/dev-tasks/issues/290/sub_issues`. For the planner: the wave 2 row still reads `Not started`, and Phase 5 step 5 will set it to `In progress`.

## Edge-case and randomized outcomes (from the Design Mode plan)

| Item | Outcome |
| ---- | ------- |
| A-21 / EC-95 | Resolved: github-ops was added to the change set and the cell is pinned (`PRD table states`). |
| A-27 / EC-98 | Still deferred as Intended: DF-16b (the publish half) is `pending` until the wave 3 publish. |
| A-29 / EC-97 | Resolved: the PRD issue comes from the wave issue's parent, with a `404` fallback to the `level: prd` search, and is recorded in Run Info. |
| A-36 (S-018 row) / EC-93 | Resolved: "never added a second time" in publish, "never adding a second" in the planner, and the github-ops rule. All are pinned. |
| A-39 / EC-99 | Mostly resolved: `Integration branch:` is set at Phase 3 pre-flight and `Fidelity report:` is added at Phase 5. The template line was not added (DR-3, DR-4). |
| EC-92 | `skipped(no PRD issue)` is pinned in both the publish and planner vocabularies. |
| A-33 | Followed: the fidelity line is a sub-bullet of step 3, and the PR-open edit was added to step 7's text. No renumbering. |
| Randomized tactics | None apply to prompt-text parity. There are no seeds to record. |

## Recommendations

| ID | Next step |
| -- | --------- |
| DR-1 | No action needed. Optionally, `product-engineer` could add an AC-2 changelog note ("close-out value goes to the run summary and close-out PR body; the state file is archived by then") and narrow the Output Contract line in a later pass. |
| DR-2 | No action needed. |
| DR-3 | No action needed. D-69 is satisfied. |
| DR-4 | `product-engineer`: decide whether a missing report means "add the line as `pending`" or "leave it absent". Then one sentence for `developer` in a later wave. |
| DR-5 | `product-engineer`: decide whether unpublished waves get a PRD row (EC-96). If they do, add a pre-publish state to github-ops's cell. If not, drop the wave 3 row at the wave 3 publish. |
| DR-6 | No action needed. Optionally renumber to 11 at the next edit of `plan`. |
