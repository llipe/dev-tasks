# Fidelity Report: S-017 part 1 (#323), PR #331

**Fidelity: High** | **Highest drift impact: Minor** | Drift findings: 8 (0 Critical, 0 Major, 8 Minor)

Scope: Story S-017 (#323) part 1, which covers AC-1, AC-2, AC-4 and AC-5. PR #331, branch `story/S-017-runbook-and-mode` at `91a8bcb`, base `integration/projects-tracking-phase-3`. AC-3 (the migration of this repository: tasks 6.5, 6.6 and 6.8) is part 2. It is out of scope here and not counted as a gap.

Audit date: 2026-10-24. Mode: Audit (grey-box). Every finding is advisory and non-blocking to PR readiness and issue completion. Findings route to `product-engineer`'s `activity-drift-reconciliation`.

## Summary

This PR adds a step-by-step guide for moving a repository onto the new issue-tracking conventions. It also teaches the GitHub assistant a "migration mode" that walks the owner through that guide in a conversation. The guide's steps match what the migration tool actually does today:

- the commands it names;
- what each result code means;
- the re-run after the owner answers the questions;
- the exact approval line;
- the recovery steps;
- the Project clean-up commands;
- the undo-by-hand instructions.

The assistant's new mode makes the promises the story asks for:

- it waits for an explicit "yes" before it changes anything;
- it asks one question at a time;
- it never answers for the owner;
- it never touches the GitHub Project;
- it never merges.

The mode is the same, byte for byte, in all three assistant platforms. The guide is indexed and passes the documentation checks.

A fresh read-only dry run against this repository produced exactly the result the PR predicted.

The gaps found are small wording and coverage issues:

- the guide describes the wave name the owner should type in a misleading way;
- the undo section leaves out two kinds of label change;
- the assistant's reaction to a "busy or locked" result is too blunt;
- a few statements in the guide are not yet protected by tests.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-1 | Runbook documents, in order: the roadmap check and conversion, `--plan`, the answers, approval, `--apply`, the Project batch (query, `item-delete`, Workflows-page steps), committing the plan with `git add -f` on `chore/<issue-number>-projects-migration` and opening a PR, and rollback by hand | `docs/runbooks/runbook-migrate-to-projects-tracking.md`, compared line by line with `bin/dev-tasks.ts` (`migrateProjects`, `migrateProjectsApply`), `core/migrate-projects/index.ts` (A-65 refusal, answers carried), `apply.ts` (gates: plan file → gh → approval → digest → lock → file-changed → snapshot-while-pending; write-back failure), `planfile.ts` (approval needs exactly one `Approved: yes`; lower-case `approved:` is unparsable, so exit 2, D-110), `plan.ts` `projectCleanupSteps` (batch 7 text is identical to the runbook). The gh syntax was checked against gh 2.103.2 help. `item-list <n> --owner --limit --format json --jq` was run read-only on Project 5: 48 items, all `Issue`, so the filter returns 0 ids. `item-delete <n> --owner --id` is valid. | Task list 6.2, 6.3a; spec §15; D-81, D-86, D-88, D-93, D-97, D-101, D-110, D-111 | PT-75 green; 13 of 18 meaning probes were caught (see the probe table) | Pass, with F-1, F-3, F-4, F-6, F-7 (Minor) |
| AC-2 | github-ops migration mode ×3. It runs `--plan`, asks one question per item with a recommendation, writes the answers, re-runs `--plan` (A-50), asks for explicit approval, sets `Approved: yes`, runs `--apply`, hands batch 7 to the user, then commits the plan and opens the chore PR. It never applies without approval and never writes the Project. | `## Migration Mode` in `.claude/agents/github-ops.md:507`, `.github/agents/github-ops.agent.md:504`, `.kiro/agents/github-ops.md:518`. The three sections are byte-identical (sha1 `9bf152d7…`). The mode infers no approval ("silence, a question, a change request or approval of an earlier plan is not approval"), never answers for the user, asks one question per message, quotes no Project command (A-61) and says "Only the user merges it". It points to the runbook. | Task list 6.4, 6.13; D-79, D-80, D-81, D-22 | PT-73, PT-74, PT-78, CT-39 and the 6.13 hardened pins are green | Pass, with F-1, F-2, F-5 (Minor) |
| AC-3 | This repository migrated; plan file committed | — | Tasks 6.5, 6.6 and 6.8 are unticked by design | — | Out of scope (part 2) |
| AC-4 | Runbook indexed; docs-structure passes | `docs/runbooks/README.md` row; `EXPECTED_RUNBOOKS` gains the slug; five FR-48 headings present | Task list 6.3, 6.3a (A-62) | PT-76, LT-20, LT-21 green. `tsx core/checks/run.ts` exits 0. `checkDocsStructure`: failures [], staleness []. | Pass |
| AC-5 | Parity pins; the runbook is the only `docs/` file naming `gh project item-delete`; PT-28b green | `git grep "gh project item-delete" -- docs` finds only `runbook-migrate-to-projects-tracking.md:171`. No prompt-tree or template file names `item-delete` or `item-list`. | Task list 6.9 | PT-77, PT-78, PT-79, PT-80, PT-81 green. PT-28b green (`projects-tracking-parity.test.ts`, 70 tests). `test/unit/migrate-projects`: 425 pass. | Pass |

### Dogfood expectation (A-90)

The PR body states the expected result in advance:

- batch 1 has 10 rows: create `type: refactor` and `type: test`, plus 8 description edits;
- batches 2 to 6 are empty;
- "Needs a type" lists 4 issues: #108, #244, #262, #263;
- "Information" lists 5 PRDs;
- batch 7 has 4 steps.

A fresh `pnpm exec tsx bin/dev-tasks.ts migrate projects --plan --out <scratch>/plan.md` run (exit 0, working tree unchanged, nothing written to GitHub) matched this exactly:

- the same 10 batch 1 rows (W-001 to W-010);
- 0 rows in batches 2 to 6;
- "Needs a type" lists #108 chore, #244 bug, #262 chore, #263 chore;
- Unmapped, Needs a blocking link, State files and Roadmap notes are all 0;
- Information lists 5: shared-understanding-refinement, infra-engineer, kiro-dev-support, evidence-driven-development-loop, factory-board;
- batch 7 holds W-011 to W-014.

### Meaning probes (spot-check of the 6.13 hardening)

Each probe made one meaning edit in an extracted copy of HEAD, then ran the three parity and runbook test files.

| Probe | Result |
| --- | --- |
| Runbook jq filter `PullRequest` → `Issue` | caught |
| Mode `MUST NOT run --apply` → `SHOULD NOT` | caught |
| Runbook `git add -f` → `git add` | caught |
| Rollback gains `gh issue delete` | caught |
| Mode drops "one question per message" | caught |
| Mode: silence counts as approval | caught |
| Only the `.claude` copy edited | caught (PT-78) |
| Verification drops `--out` | caught |
| `--limit 500` → `30` | caught |
| Mode exit-1 reaction `--apply` → `--plan` | caught |
| Mode "Only the user merges it" → "Merge it once checks pass" | caught |
| `item-delete --id` → `--item` | caught |
| `Approved: yes` block → lower-case | caught |
| **Runbook exit-14 reaction → "pass `--force`"** | **survived** |
| **Runbook step 2: "Exit `11` means gh missing" → "Exit `2`"** | **survived** |
| **Runbook: "runs batches 1 to 6" → "1 to 7"** | **survived** |
| **Runbook resume: "never repeats a `done`…" → "repeats every row"** | **survived** |
| **Runbook lost write-back: "exits `14`" → "exits `1`"** | **survived** |

The mode's pins hold. The runbook's pins check that each exit code appears in the table, not what it means or what to do about it (F-4).

## Drift catalog

All items are non-blocking to PR readiness and to issue completion.

**F-1. The wave-id answer is described wrongly.** Minor, Unintended.

- Evidence: runbook step 3 (Unmapped row) says "a wave id exactly as the roadmap's `Phase/Wave` cell (`alpha 2`)". Mode step 2 says "a wave id exactly as the roadmap's `Phase/Wave` cell".
- The CLI accepts only `<PRD key> <Phase/Wave>`. See `waveId()` in `core/migrate-projects/roadmap.ts`, and `parseUnmappedAnswer` in `answers.ts`, which matches `waveId(r) === text`.
- So for this roadmap the answer must be `projects-tracking 3`. A bare `3`, typed per the wording, is rejected as invalid, and `--plan` lists it back. No wrong write results, but the agent's recommendation would be wrong. `docs/dev-tasks-user-manual.md:348` gets it right ("a wave id such as `alpha 2`").
- Fix (`developer`): in the runbook and all three mode copies, say "a wave id `<PRD key> <Phase/Wave>`, exactly as the roadmap's PRD and `Phase/Wave` cells read (`alpha 2`)".

**F-2. The mode's exit-14 reaction is too coarse, and the stale-lock recovery is missing.** Minor, Unintended.

- Evidence: mode step 7 says "Exit `14`: … is locked by another run … run `--plan` again and go back to step 5". The runbook's exit table correctly says "wait for the other run".
- Running `--plan` while another `--apply` holds the lock is wrong. If every row is still pending, it rewrites the file the other run is writing back to. If any row is recorded, `--plan` refuses with exit 14 (A-65). That same refusal makes "regenerate" a dead end for a partly applied plan that exits 14 because it is unapproved or a row was edited.
- Neither document covers a lock file left by a killed process (SIGKILL; SIGINT, SIGTERM and SIGHUP release it, D-111). The CLI message says "remove the file if no run is active" (`workstream/.migration-projects.lock`).
- Fix (`developer`): split the mode's exit-14 reaction. For the lock: wait, or remove `workstream/.migration-projects.lock` when no run is active. For unapproved: approve. For an edited row: restore it, or re-plan only while every row is pending. For a stale snapshot: re-plan. Add the stale-lock line to the runbook's Escalation.

**F-3. The rollback map leaves out two kinds of label write.** Minor, Unintended.

- Evidence: `## Rollback` lists batch 4 only as "label added: remove it" and batch 4b only as "Blocking link added".
- `plan.ts` also drafts the following:
  - batch 4 `remove-label` rows: retired `type:` labels on tracking issues (line 680), and other `type:` labels removed after a type answer (line 696);
  - batch 4b `add-label priority: high` plus `remove-label priority: critical` for a "lower priority to high" answer (lines 706–710).
- Fix (`developer`): add "Label removed (batch 4, or the 4b priority change): re-add it, and remove `priority: high` where 4b added it."

**F-4. The runbook's exit codes and resume claims are pinned by presence, not meaning.** Minor, Unintended (test gap).

- Evidence: 5 of 18 probes survived, all in the runbook: the exit-14 reaction with `--force`, the swapped exit meaning in step 2, "batches 1 to 7", resume "repeats every row", and the lost write-back "exits `1`".
- The test `states --apply's exits…` checks only `| \`N\` |` and the phrase "lost first write-back". The 6.13 hardening covered the mode's exits, not the runbook's.
- Fix (`developer`, or `qa-engineer`): pin each runbook exit row's meaning and reaction, with no `--force` anywhere in the runbook. Also pin "batches 1 to 6", the D-88 "never repeats a `done`" sentence, and the lost-write-back "exits `14`".

**F-5. The mode does not say to wait for the owner's batch 7 ticks before committing.** Minor, Undetermined.

- Evidence: mode step 8 says "The user runs each step … and sets its State to `done`". Step 9 then commits at once, with no wait or check that every batch 7 row reads `done`.
- AC-3 and task 6.5 require the committed record to carry the owner's ticks ("wait for the owner to tick it").
- Fix (`developer`): in step 9, add "after the user confirms each batch 7 row reads `done`".

**F-6. The raw batch 7 cells carry `\|`.** Minor, Undetermined.

- Evidence: in the plan file, W-011's cell reads `--jq '.items[] \| select(.content.type == "PullRequest") \| .id'` (the A-79 escaping). Copied from the raw file, the jq expression breaks.
- The mode says the plan file and the runbook "carry the exact commands". The runbook and the `--apply` summary print the unescaped form; the summary comes from `unescapeCell`.
- Fix (`developer`): in the runbook step 7 and mode step 8, say to copy the commands from the runbook or the `--apply` summary, not from the raw table cell. Changing the CLI is out of scope.

**F-7. Some exit-code causes are not documented.** Minor, Undetermined.

- `--plan` exit `1` (a failed `gh` read) and exit `2` for a `--repo` that is not the working tree (A-52) are not in runbook step 2.
- `--apply` exit `1` also follows a snapshot read failure or a lost write-back, with no failed rows to read; the runbook table says "Read the failed rows".
- Exit `11` also covers a failed `gh repo view`.
- The mode's step 1 exit 14 names only "an applied plan", not "not a plan".
- Fix (`developer`): extend the runbook's exit meanings. Optional.

**F-8. The A-90 expectation lives only in the PR body, and the test plan's version is stale.** Minor, Intended.

- Evidence: the PR #331 body states the expected dogfood result. `workstream/test-plan-projects-tracking-phase-3.md:383` gives an earlier expectation: needs-type rows for #64 and #118, and batch 4 holding type answers. The live plan no longer lists those issues.
- Fix (`product-engineer`, drift reconciliation): copy the PR's expectation into the test plan's DF section, or have part 2 (DF-27) compare against the PR body. No code change.

## Edge-case and randomized outcomes

- EC-164 (declined approval writes nothing; plan kept) is stated in the runbook (step 5) and the mode (Rules).
- EC-165 (`standalone` gets no write) is stated in both.
- EC-166 (interrupted apply resumes per D-88) is stated in both.
- EC-167 (verification uses a scratch `--out`, A-65) is stated in the runbook Verification.
- These are static checks; the live outcomes belong to part 2.
- No randomized tactics apply to S-017.

### Documentation structure

`checkDocsStructure`: no failures and no staleness findings. The new runbook has `last_verified: 2026-10-24`.

### Vocabulary conformance

`checkExportedIdentifiers` over the PR's added lines found no hits. The PR adds no exported identifiers.

### Runbook coverage (FR-49b)

No finding. The PR delivers the runbook.

### Roadmap mismatch

No finding.

- Wave issue #317 is open. Its sub-issues #318 to #323 are all `open`, read with `gh api --paginate …/issues/317/sub_issues`.
- This is a story audit, and it does not complete the wave.
- The row's `Issues/PRs` (wave #317, stories #318–#323) agrees with the sub-issues.

## Recommendations

| Finding | Next step |
| --- | --- |
| F-1 | `developer`: fix the wave-id wording in the runbook and the three mode copies |
| F-2 | `developer`: split the mode's exit-14 reaction; add stale-lock recovery to the runbook's Escalation |
| F-3 | `developer`: add the batch 4 label removals and the 4b priority change to Rollback |
| F-4 | `developer` or `qa-engineer`: pin the runbook's exit meanings and reactions, "batches 1 to 6", D-88 resume, and the lost-write-back exit |
| F-5 | `developer`: in mode step 9, commit after the batch 7 rows read `done` |
| F-6 | `developer`: copy batch 7 commands from the runbook or the `--apply` summary, not the raw cell |
| F-7 | `developer` (optional): list the remaining exit causes |
| F-8 | `product-engineer`: reconcile the test plan's DF expectation with the PR's A-90 statement |

`--apply` was not run. Nothing was written to GitHub except this report's PR comment.
