# Fidelity Report - S-010 (#293)

**Fidelity: High** | **Highest drift impact: Minor** | Scope: Story S-010 (#293), wave issue #290, PR #300 (`story/S-010-closes-at-ship` @ `4168409` → `integration/projects-tracking-phase-2` @ `0c6801d`)

Drift: 0 Critical, 0 Major, 6 Minor (0 Unintended, 4 Intended, 2 Undetermined). All drift is advisory and non-blocking to PR readiness and issue completion. It routes to `product-engineer`'s `activity-drift-reconciliation`.

## Changelog

| Version | Date       | Change                    | Author   |
| ------- | ---------- | ------------------------- | -------- |
| 1.0     | 2026-10-22 | Initial Audit Mode report | verifier |

## What changed and why

No assistant closes a story's GitHub issue any more, and neither does the planner. A story issue closes automatically when its work reaches the main branch. Under the planner that happens when the final combined pull request is merged. When a developer works alone without the planner, it happens when that story's own pull request is merged. Earlier instructions told the assistant to close the issue after the merge. Those instructions are gone from every copy and have been replaced with "do not close it by hand; if it is still open after the merge, report it".

The planner's final combined pull request now lists one "Closes" line for every story that was actually merged. It also lists one for the wave issue, but only when every story in the wave merged. A story that was blocked or skipped gets a "Refs" line with the reason, so it stays open. The lines go in the "Why" section and are written one per line, because GitHub ignores a second number in a comma-separated list. If there is no wave issue, the description says so.

After opening that pull request, the planner checks the Project board status of one merged story. This is a read-only check and never writes to the board. It records whether the story showed "In progress", and if not, why not. That includes "no project" for repositories without a board.

GitHub's pull request rules gained the same "Closes for every story and the wave" sentence.

All of this reads the same in the Claude, Copilot and Kiro copies. The pre-existing differences between those copies were left alone, as decided earlier.

## Sources

- Story S-010 AC-1 to AC-6 (`workstream/user-stories-projects-tracking-phase-2.md:157`).
- Spec v1.1 §8.2, §8.5, §8.6 and §16a (`workstream/specification-projects-tracking-phase-2.md`). §16a wins where it differs (D-67 supersedes §8.2's `## What`; D-68 supersedes `gh project item-list`).
- PRD v1.7 FR-13 and FR-15 (`docs/requirements/prd-projects-tracking.md:97`, `:99`) and AC-9; issue #285 (AC-2, AC-3).
- Decisions D-22, D-50, D-54, D-56, D-60, D-67, D-68 (`workstream/decisions-projects-tracking.md`).
- Design Mode plan `workstream/test-plan-projects-tracking-phase-2.md`: PT-39, PT-40, PT-41, PT-48, PT-49, CT-17, CT-23, LT-12, LT-14, EC-62 to EC-71, EC-74, DF-10 to DF-12, and findings A-34, A-35, A-37, A-43, A-47. Also `workstream/traceability-matrix-projects-tracking-phase-2.md`.
- `workstream/fidelity-report-S-009.md` DR-3 (the step 13 conjunction).
- Codebase: `gh pr diff 300`. The head tree was read in a detached worktree at `4168409`, removed afterwards. The main checkout was not switched.
- Live GitHub: `gh issue view 290|291|293 --json projectItems`; PR #300 body; issue #293 checklist.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | Planner never closes a story; it closes when the consolidated PR merges to main | The same sentence appears under the merge rule, after "MUST NOT allow multiple open story PRs", in `.claude/commands/planner.md:511` and in the `.github` and `.kiro` copies. It also covers the wave issue and delegated agents, and cites D-22, D-50 and D-54. No `gh issue close` appears in any planner copy. | Task 3.2, 3.7 `[x]` | PT-39 `planner > never closes`: green; it was red at `33f4e05`. It checks that the sentence is identical across trees and that no line matches `/gh issue close/`. | Pass |
| AC-2 | `Closes`/`Refs` lines in Phase 5 step 7 and the include list, generated from the state table | Step 7 gains the **Closes lines.** sub-bullet (it keeps the step numbering, per A-33). Its rules:<br>• `Closes #N` only for `✅ Merged` rows.<br>• `Refs #N` with the reason for unmerged rows.<br>• `Closes #<wave>` only when every story merged, otherwise `Refs #<wave>` naming the unmerged stories.<br>• When `Wave issue: none`, there is no wave line and the body says so.<br>• One keyword per line, with the comma-list warning.<br>• Lines go under `## Why`.<br>The include list gains a matching bullet. All of this is identical in three trees. | Tasks 3.3, 3.3a, 3.8 `[x]`. Follows D-67 and §16a, which supersede the AC's literal "every story in the state table" and "whenever a wave issue exists" (A-34, A-35, A-47). | PT-40 `consolidated PR Closes lines`: green, was red. It pins A-34, A-35, EC-62, EC-63, EC-64 and A-33's step order. | Pass (Intended drift DR-3) |
| AC-3 | DF-5 "In progress at consolidated PR open" observation | The **Project Status observation (read only).** sub-bullet uses `gh issue view <n> --json projectItems --jq '.projectItems[].status.name'`. It handles each outcome:<br>• Empty result: `not observed(no project)`.<br>• `In progress`: `observed`.<br>• Any other value: one re-read, then `not observed(automation pending at <time>)`.<br>• Refused read: `not observed(<reason>)`, with no access request.<br>The result goes in the PR body and in `TESTING.md` DF-5, committed on the integration branch. The step has no write verb, no `gh project item-list` and no `gh auth refresh`. | Tasks 3.4, 3.4a `[x]` (3.4 is annotated "superseded by 3.4a"). Follows D-68. | PT-41 `DF-5 observation`: green, was red. It asserts no `PROJECT_WRITE`, no `gh project item-list` and no `gh auth refresh`. PT-28 and PT-28b (whole-tree write and scope negatives) still pass. Live read: `#293`, `#291` and `#290` each return `Backlog` on "Dev-tasks". | Pass (DR-1, DR-2) |
| AC-4 | github-ops `## Why` consolidated-PR sentence | One added line after the existing `## Why` rule, identical in `.claude/agents/github-ops.md:258`, `.github/agents/github-ops.agent.md` and `.kiro/agents/github-ops.md`. The existing rule is kept. | Tasks 3.5, 3.10 `[x]` | PT-48 `github-ops > consolidated PR Why rule`: green, was red. It checks the line is identical across trees. | Pass (wording extends §8.5 per D-67; DR-3) |
| AC-5 | implement rules 12 and 13, the lifecycle row and Final Instruction 5 say nobody closes | Rule 12: nobody closes; a default-branch PR carrying `Closes #N` closes the issue. That PR is the consolidated PR under the planner, or the story PR in a main-thread `/developer` run. A story PR into an integration branch closes nothing.<br>Rule 13: never close by hand; report an issue that is still open.<br>Lifecycle row: "Then close issue" became "GitHub closes the issue (`Closes #N` on a default-branch PR)".<br>FI-5: rewritten to match.<br>The `## Before Starting Work` … `## GitHub Execution Rules` span (LT-12) is byte-identical across trees (same `shasum`), and so is everything from `## Before Starting Work` to end of file. The story-PR `Closes #<issue-number>` line is kept (EC-71). | Tasks 3.6, 3.11 `[x]` | PT-49 `implement > nobody closes`: green, was red. It has negatives on old rules 12, 13 and FI-5 and on "Then close issue". LT-12 (`memo-write-reliability`) passes. | Pass |
| AC-6 | Parity file extends the planner, github-ops and implement blocks with negatives | `test/unit/projects-tracking-parity.test.ts` gains PT-39, PT-40, PT-41, PT-48 and PT-49, plus the S-009 hardening pin test. Each test collects its added line across trees and asserts that the set has one element. | Task 3.1 `[x]` | At `33f4e05` (tests only), 6 tests fail. At `4168409`, all 47 parity tests pass. `pnpm run validate` passes: typecheck, lint (eslint and `core/checks`), format:check, and 71 test files with 2351 tests. | Pass |

## Targeted checks requested

| Check | Result |
| ----- | ------ |
| Each AC in all copies | Yes: planner ×3, github-ops ×3, implement ×3. Every added line is identical across trees (asserted by set size 1 in each new test, and re-read in the diff). |
| Existing merge-gate wording untouched (D-60) | Yes. I compared the `For each completed story PR:` … `### Merge authority policy` span of `.claude` against `.github` and against `.kiro`, at base `0c6801d` and at head. The divergence hunks are identical apart from the DR-3 conjunction. Gates 5 and 6 differ in `.github` as before, and gate 13 still opens "**Write checkpoint**" in `.github` and "**Verify the merge actually happened, then write checkpoint.**" in `.claude` and `.kiro`. |
| implement span byte-identical across three copies | Yes. `## Before Starting Work` … `## GitHub Execution Rules` has `shasum` `e5c1dcc751d5` in all three, and the span to end of file is `4c0c849aabfd` in all three. |
| No agent-closing text in implement or the planner | Yes. Every remaining "close" in implement is prohibitive (rule 13, FI-5) or the lifecycle row naming GitHub as the closer. In the planner the only remaining forms are the never-closes sentence, the `Closes` generation rules and "close-out" for the wave status comment. `developer` rule 12 ×3 is prohibitive too (A-43: rule 6 is unchanged, as intended). The one remaining `gh issue close` in prompt trees is github-ops's generic operations-table row (DR-6). |
| Project read uses no write verb or scope request | Yes. Step 7's observation contains no `gh project item-edit` or `item-add`, no `gh project item-list` and no `gh auth refresh`. A refused read "never asks for more access". PT-28 and PT-28b are green tree-wide. One caveat on the "no extra token scope is needed" claim (DR-1). |
| `.github` step 13 DR-3 edit | Judged correct and in scope. S-009's DR-3 recommendation reads "restore 'and' … in step 13 of all three copies". The edit touches only the shared tail list ("…, and update the `Last updated` timestamp.") and leaves the D-60-divergent opening of `.github` step 13 alone. The new pin asserts the tail in all three trees. S-009 DR-3 is resolved. |
| Existing pins pass | Yes. PT-1 to PT-38, PT-47, LT-9, LT-11, LT-12, LT-14 and the roadmap parity tests pass: the full `test` suite is green with 2351 tests. |

## Drift catalog

All items are **non-blocking** to PR readiness and to issue completion.

| ID | Description | Impact | Intent | Evidence source(s) |
| -- | ----------- | ------ | ------ | ------------------ |
| DR-1 | The observation sub-bullet says "no Project number and no extra token scope is needed". D-68 says "no project scope" too. But Design Mode A-37 recorded that `projectItems` uses the same `read:project` scope as `gh project item-list`, and gh normally reports a missing `read:project` scope for that field. I could not test this here: the session token has full `project` scope, and the read succeeded. Behaviour is still safe, because a refused read records `not observed(<reason>)` and never asks for access (EC-66). Only the factual claim is in question. | Minor | Undetermined | Planner step 7 ×3; D-68; test plan A-37; `gh auth status` (scopes include `project`) |
| DR-2 | Story AC-3 says "when a Project is configured", and its Technical Notes name `gh project item-list` with a Project number from `docs/roadmap.md` or the runbook. The delivered step always reads `projectItems` and treats an empty result as no Project. This follows D-68 and §16a, and task 3.4 is annotated. The story and issue text are not annotated. | Minor | Intended | Story S-010 Technical Notes; spec §16a; task 3.4 |
| DR-3 | Story AC-2 and AC-4, spec §8.5 and FR-15 say `Closes` for every story in the state table and for the wave whenever a wave issue exists. The delivered text gives `Closes` only to merged stories and `Refs` with a reason to unmerged ones. It closes the wave only when every story merged, places the lines under `## Why` and requires one keyword per line. All of this follows D-67 and §16a (A-34, A-35, A-47, EC-64). The github-ops sentence is a superset of §8.5's text. | Minor | Intended | Planner step 7 ×3; github-ops ×3; D-67 |
| DR-4 | The PR applies S-009 DR-3 (the step 13 conjunction) in all three planner copies, including `.github`, which the task brief had not asked for. This matches DR-3's own recommendation, and the D-60-divergent opening is untouched. | Minor | Intended | Planner step 13 ×3; `fidelity-report-S-009.md` DR-3 |
| DR-5 | The PR carries the S-009 gate-hardening pin test (qa M4, M8, M10, M11, M12, M17 and verifier DR-3), which is outside S-010's ACs. It is declared in the PR's `## What` and in the test commit subject. | Minor | Intended | `test/unit/projects-tracking-parity.test.ts`; PR #300 body |
| DR-6 | github-ops's operations table still lists "Close issue with attribution → `gh issue close <number> …`" in all three copies. No prompt tells an agent to use it on a story or wave issue. However, the row has no carve-out matching the business rule "No agent closes a story or wave issue" (D-22, D-54). It predates this change, and S-010's ACs do not name it. | Minor | Undetermined | `.claude/agents/github-ops.md:43`, `.github/agents/github-ops.agent.md:41`, `.kiro/agents/github-ops.md:41` |

## Edge-case and test-plan outcomes

| Case | Outcome |
| ---- | ------- |
| EC-62 no wave issue | Covered: there is no `Closes #<wave>` line and the body says so (PT-40). |
| EC-63 blocked, unmerged story | Covered: `Refs #N` with the reason. A-34 is resolved, so the wave gets `Refs`, not `Closes` (PT-40). |
| EC-64 comma-joined keywords | Covered: one keyword per line, plus the "closes only the first" warning (PT-40). |
| EC-65 no Project | Covered: `not observed(no project)` (PT-41). |
| EC-66 read refused | Covered: `not observed(<reason>)` with no access request, and the PT-28b negative holds. See DR-1 on the scope claim. |
| EC-67 automation latency | Covered: one re-read, then `not observed(automation pending at <time>)` (PT-41). |
| EC-68 / A-43 developer rule 6 | Unchanged, as intended. PT-20 is green. |
| EC-69 LT-12 span | Byte-identical, and LT-12 is green. |
| EC-70 / A-35 placement | Lines go under `## Why`. §8.2's `## What` is superseded. |
| EC-71 story PRs still carry `Closes` | The line is kept, and PT-49 asserts it. |
| EC-74 still open after merge | Rule 13 says to report it and not close it. |
| DF-10, DF-11, DF-12 (dogfood) | `pending`: they observe at this wave's consolidated PR. Today #290, #291 and #293 are OPEN and in `Backlog`, which is consistent with D-50 because no default-branch PR exists yet. |
| RT-4 | No `CLOSES_LINE` constant was added, so there is no self-check to run. |

### Documentation structure

`tsx core/checks/run.ts` at head exits 0, and `checkDocsStructure` returns `{"failures":[],"staleness":[]}`. There are no findings.

### Vocabulary conformance

I ran `checkExportedIdentifiers` over the 231 added lines of `git diff origin/integration/projects-tracking-phase-2...HEAD` against `docs/domain/ubiquitous-language.md`. It returned no hits. The diff adds no exported identifiers.

### Runbook coverage (FR-49b)

Not a finding. The PR contains prompt and test edits only: no configuration, environment, tooling, credential or data steps, and no `templates/scripts/` or workflow change.

### Roadmap mismatch

Not applicable. S-010 does not complete wave 2, so the roadmap row stays `In progress` while S-011, S-012 and S-018 are open.

## Recommendations

| ID | Next step |
| -- | --------- |
| DR-1 | `product-engineer`: verify with a token that lacks `read:project`. If the read is refused, reword D-68 and step 7 ×3 to "no Project number and no scope request" instead of "no extra token scope is needed". The refused-read branch already behaves correctly. |
| DR-2 | `product-engineer`: add a changelog note to S-010's story text and to issue #293 saying AC-3 detection and the Technical Notes command are superseded by D-68. |
| DR-3 | `product-engineer`: annotate S-010 AC-2 and AC-4 and spec §8.5 with "superseded by D-67" in the changelog. No code change. |
| DR-4 | No action needed. S-009 DR-3 can be marked resolved by PR #300. |
| DR-5 | No action needed. |
| DR-6 | `product-engineer`: decide whether github-ops's "Close issue" row needs a carve-out ("never for a story or wave issue; GitHub closes those at ship", D-54). If so, route it to a later story. |
