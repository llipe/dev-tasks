# Fidelity Report: S-014 (#321), mapping precedence and scope-rule batches

**Fidelity: High** | **Highest drift impact: Minor** | Drift findings: 9 (0 Critical, 0 Major, 9 Minor) | Status: complete

Scope: story S-014 (#321), PR #329, branch `story/S-014-map-and-batches` at a5d051a, base `integration/projects-tracking-phase-3`. Audit date 2026-10-24.

All drift is **non-blocking** to PR readiness and issue completion. It routes to `product-engineer`'s `activity-drift-reconciliation`.

## Summary

The migration plan now does what the story asked for. Each story is matched to its wave in a fixed order: first the story line in the issue body, then a `phase:` label within the story's own PRD. A story neither rule can place is listed for the owner and never guessed. The plan proposes only the changes the rules allow. It never renames an issue, never puts a bug or chore into the hierarchy, never moves an issue that already has a parent, never sets a Project status, and never creates a tracking issue for a wave that has already shipped. The Project clean-up is printed for the owner to run; the tool never runs it. Answers the owner types into the plan are read back on the next run.

Run read-only against this repository, the plan predicted in advance (A-90) came out: ten label rows (two new type labels, eight description updates), four issues that need a type, five questions about PRDs that have no tracking issue, the PRD comment already complete, and no hierarchy or label moves.

What remains is small. Two wordings are off: a wave that has not started reads `not started`, a word the status comment's vocabulary lacks, and an answer naming a wave the plan has set aside is called "not a wave". One edge case could leave an empty wave issue. The issue text still describes a mapping rule that was dropped. A few undocumented choices should be written into the spec.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-1 | Mapping precedence, as amended: story line, scoped `phase:` label, else unmapped (D-98, A-55, A-56) | `map.ts` `mapStory`: rule 1 via `roadmapRows` (`All` for no `-phase-N`); rule 2 filtered to `titlePrd(title)`; milestone is cited as "not a mapping rule (D-98)"; disagreement cited in `notes` | Task 4.3, 4.3a ticked; story v1.1 annotation | `map.test.ts`, RT-9; suite green | Pass (issue text drift F-9) |
| AC-2 | Missing canonical table exits 2 with conversion pointer (D-86) | `snapshot.ts` throws `SnapshotError("roadmap")` before any issue read; `index.ts` maps `roadmap` to `InvalidUsage`; `ROADMAP_CONVERSION_POINTER` | Task 4.2 | `cli.test.ts` MC-8/E2E-19 (no GitHub read after the check) | Pass |
| AC-3 | Batches 1 to 7 in §8.3 order and contents, with §16a amendments (A-66, A-67, A-71, A-73, A-81 to A-84, D-103) | `plan.ts` `planMigration`; `planfile.ts` batches `1,2,3,4,4b,5,6,7`, only `7` is `user`; `retiredDescription` (`Retired (D-91): `, 100 chars, not doubled); `prdState`; `Depends on` via `Drafts.deps` | Tasks 4.4, 4.4a, 4.4b, 4.15, 4.17, 4.19 | `plan.test.ts` MU-44 to MU-51, EC-125 to EC-133, RT-12 (200 repositories, replay from answers) | Pass with drift F-1, F-2, F-4, F-5, F-6, F-7, F-8 |
| AC-4 | Reused pre-`level:` tracking issue gets `level:` and loses the experiment `type:`; two matches omit that PRD and list both (D-87) | `plan.ts` batch 4 loop over `openTracking`; `omitted` set → `untouchable`; Information note lists both numbers | Task 4.5 | `plan.test.ts` MU-52, MU-53, EC-129, EC-130 | Pass |
| AC-5 | No title write, no standalone hierarchy write, no Status write (D-19, D-27, D-82) | Closed `MIGRATION_PLAN_ACTIONS` has no title or Status action; `mapped` holds stories only; `parent !== null` always `continue`s (never relinked); `Done` rows skipped in hierarchy; PT-80 confines `gh project` to `projectCleanupSteps` lines and forbids a `project` argv and ProjectV2/`/projects` | Task 4.6 | `plan.test.ts` MU-54 (oracle fixed per 4.16), RT-13; parity PT-80 incl. range self-test | Pass |
| AC-6 | Previous plan's answers read and applied before batching; `Approved: no` reset (A-50) | `answers.ts` `readAnswers`, parsers; `index.ts` reads answers only from an all-pending plan of the same repo; type, blocking and "yes" answers feed batches 4, 4b, 2 | Task 4.7 | `answers.test.ts` MU-55 to MU-58, E2E-25, EC-134 to EC-137 | Pass (F-3) |
| AC-7 | AC-11 fixture in one test (PRD AC-11 v1.11) | `test/fixtures/migrate-projects/ac11/` | Task 4.1, 4.11 | `ac11-fixture.test.ts`: batches 1 to 6 row for row, batch 7 ids, review lists exact, milestone-only story unmapped, nothing for bug #20, zero write calls, no body text | Pass |

Gates re-run by the verifier: `typecheck`, `lint`, `format:check` OK; `pnpm run test` 86 files, 2768 tests passed; `pnpm run audit` no vulnerabilities. qa-engineer: `coverage_gate: PASS` (as reported by the caller).

### Code reads asked for by the caller

| Guard | Where | Verdict |
| --- | --- | --- |
| No title write | No title action exists in `MIGRATION_PLAN_ACTIONS`; `title:` appears only in a `create-issue` Detail | Holds |
| No Status write, no `gh project` run | No Status action; `projectCleanupSteps` returns strings only; no `project` argv anywhere in the module | Holds |
| No hierarchy write on a standalone issue | Batch 3 iterates waves and `mapped` (stories) only; batch 4 `level:` only on tracking issues and `mapped` | Holds |
| Never relink an issue with a parent | Story: `if (parent !== null) { …; continue; }`; wave: same for a parented wave issue; foreign parent noted by `classify.ts` (probe P1) | Holds |
| No wave issue for a `Done` wave | `row.status === "Done"` → open stories noted, no `needsWave`, story links skipped | Holds. An existing, unparented open wave issue of a `Done` row is still linked under its PRD (probe P2), which links an existing container and creates nothing |
| PT-80 scope | `gh project` allowed only strictly inside `projectCleanupSteps`' line range in `plan.ts`; the range helper has a negative self-test | Holds. The guard does not restrict which `gh project` subcommand appears inside the builder; acceptable today |

### Read-only `--plan` against llipe/dev-tasks (A-90)

`dev-tasks migrate projects --plan --repo llipe/dev-tasks --out <scratchpad>/plan.md --json`, exit 0, working tree unchanged.

- Batch 1: 10 rows. `create-label` for `type: refactor` and `type: test`; `edit-label` descriptions for `type: bug`, `enhancement`, `chore`, `tech-debt` and the four `priority:` labels (D-103). The `level:` labels already exist.
- Batches 2 to 6: empty. Stories #318 to #323 already sit under wave #317, which sits under #289. They carry `level: story`, and no open issue carries a retired label. #289's status comment already has rows 1, 2 and 3, so nothing is added (A-67).
- Review: 4 "needs a type" (#108, #262, #263 → `chore` from the `[chore]` prefix or `chore` label; #244 → `bug` from its default label, D-100); 0 unmapped; 5 Information questions, one per PRD with no tracking issue (A-83).
- Batch 7: the four user steps.

This matches A-90's prediction: label creation, description updates, "needs a type" rows and the PRD comment check.

## Drift catalog

Every item below is **non-blocking** to PR readiness and to issue completion.

| # | Description | Impact | Intent | Evidence |
| --- | --- | --- | --- | --- |
| F-1 | Batch 6 writes `not started` for a `Not started` row with no wave issue. github-ops' PRD State vocabulary is `published`, `in progress`, `consolidated PR #n open`, `shipped`, and A-67 says batch 6 uses it. | Minor | Undetermined (the vocabulary has no word for this case) | `plan.ts` `prdState` lines 125-129; probe P3 `3 = not started, —`; `.claude/agents/github-ops.md` line 181 |
| F-2 | The snapshot reads every open PRD tracking issue's comments, one paginated read each, to tell batch 6 "create" from "add". A-74's list of reads does not name it. | Minor | Intended (A-67 needs it) | `snapshot.ts` `statusCommentOf` and the `issues/{n}/comments` read; spec §16a A-74 |
| F-3 | An unmapped answer that names a real wave of a PRD whose batches are omitted (two tracking matches) is rejected as "not a roadmap wave id". It is one. The answer is also cleared. | Minor | Unintended | `plan.ts` lines 357 and 372-378; probe P5 |
| F-4 | An open story whose parent is a closed wave issue of its own row: the plan creates a new wave issue and links it under the PRD, but never relinks the story (A-76). The new wave issue would have no children. | Minor | Undetermined (A-91 "new wave issue" against A-76 "never relinked") | probe P4: `W-001` create, `W-002` link under #1, Information "never relinked" |
| F-5 | Wave titles over 80 characters are cut at a word and end with `…`. The spec defines the title (A-84) but not truncation. | Minor | Intended | `plan.ts` `waveTitle` lines 109-116; github-ops Title Format line 103 |
| F-6 | A PRD tracking-issue title is not capped at 80 characters. Capping it would break A-53's exact-H1 match, so a long H1 yields a title over github-ops' limit. | Minor | Undetermined | `plan.ts` `prdTitle` lines 119-122 |
| F-7 | A `Phase/Wave` cell containing a space or colon gets no wave issue and is listed instead. The spec is silent. | Minor | Intended | `plan.ts` lines 574-580; task 4.19 |
| F-8 | A closed PRD tracking issue is never reused; a new one is created and the closed one is noted. This extends A-91, which is stated for wave parents, to the PRD level. | Minor | Intended | `plan.ts` lines 550-555 |
| F-9 | #321's body (AC-1 "the milestone when exactly one row names it", AC-7 "one by milestone", Decisions line without D-98 and the rest) does not carry the v1.1 annotation the story file has. Spec §8.2 rule 3, §8.3 batch 1's `Retired (projects-tracking#D-91):` prefix and D-91's text are superseded by §16a (A-57, D-98, A-82). The code follows §16a. | Minor | Unintended (documentation lag) | #321 body; `workstream/user-stories-projects-tracking-phase-3.md` lines 269-272; spec §8.2, §8.3 |

## Edge-case and randomized test outcomes

- The test-plan edge cases for S-014 are all present and green: EC-120 to EC-137, the ambiguous `phase:` label, body line against label, a closed-story wave with an active state file, wrong-wave listing, EC-117 / D-106 case-insensitive labels, and the task 4.19 branches.
- RT-12 replays 200 random repositories, including rows produced from answers and a pre-existing PRD comment. Its replay helper (`helpers/model-apply.ts`) is independent of production. RT-13 now generates `[PRD-x]`-prefixed standalones. No randomized failure needed triage.
- **Documentation structure.** `checkDocsStructure` returns no failures and no staleness.
- **Vocabulary conformance.** `checkExportedIdentifiers` over the PR's added lines finds no hits.
- **Runbook coverage.** Not triggered: the S-014 steps are code changes, not setup, configuration or migration procedure.
- **Roadmap mismatch.** Not triggered: S-014 does not complete wave 3, whose issue #317 and stories #318 to #323 are open. Row 3 reads `Not started` while the wave is under way; the planner updates it in the consolidated PR (D-72).
- **D-106.** As the caller noted, the decision row is recorded by the planner after merge. The code (`sameLabel`, `hasLabel`, `hasLabelPrefix`, the lowercase label map) and the tests implement it.

## Recommendations

| # | Next step | Owner |
| --- | --- | --- |
| F-1 | Decide the state word for a not-started wave without an issue. Either add it to github-ops' PRD State vocabulary in all three trees and record the decision, or map it to an existing word. Then align `prdState`. | `product-engineer`, then `developer` |
| F-2 | Add the PRD-comment read to §16a A-74's read list. No code change. | `product-engineer` |
| F-3 | Give the omitted-PRD case its own reason, e.g. "names wave `<id>` of PRD `<p>`, whose batches are omitted (D-87)", and keep the typed answer. | `developer` |
| F-4 | Clarify A-91 against A-76. Either list the story and create no wave issue when every mapped story is parented to the closed wave issue, or allow a relink away from a closed parent. | `product-engineer` |
| F-5, F-7, F-8 | Record these as spec write-back in §16a. | `product-engineer` |
| F-6 | Decide whether a PRD title over 80 characters is listed instead of created, or exempt from the limit. | `product-engineer` |
| F-9 | Annotate #321's body with the v1.1 note (D-98, A-55 to A-57, A-82) and the additional decisions. Optionally mark spec §8.2 rule 3 and §8.3's prefix as superseded. | `product-engineer` |
