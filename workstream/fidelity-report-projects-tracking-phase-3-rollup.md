# Fidelity Report: projects-tracking wave 3, PRD-level rollup

**Fidelity: High** | **Highest drift impact: Minor** | Drift findings: 8 (0 Critical, 0 Major, 8 Minor) | Status: complete (DF-28 deferred until the consolidated PR opens)

Scope: wave #317 (PRD issue #289), branch `integration/projects-tracking-phase-3` at `fc86be0` against `main`, story PRs #326 (S-019), #327 (S-016), #328 (S-013), #329 (S-014), #330 (S-015), #331 and #332 (S-017). Audit date 2026-10-26. Mode: Audit, planner Phase 5 step 3.

Every finding is advisory and **non-blocking** to PR readiness and issue completion. Findings route to `product-engineer`'s `activity-drift-reconciliation`.

## Changelog

| Version | Date       | Summary                              | Author   |
| ------- | ---------- | ------------------------------------ | -------- |
| 1.0     | 2026-10-26 | Audit Mode, wave 3 PRD-level rollup. | verifier |

## What changed and why

This wave gives an existing repository a safe way to adopt the new issue-tracking conventions. One command reads the repository and writes a plan listing every change it proposes and every question only the owner can answer. Nothing changes on GitHub until the owner has answered those questions and approved the plan. A second command then makes exactly the approved changes and records the result of each one, so an interrupted run picks up where it stopped. It never touches the GitHub Project board; the owner does those few steps by hand. The labels now have a fixed meaning: exactly one kind of work per issue, and "critical" means "holds back a release". A written guide and a guided conversation walk the owner through the process, and product-engineer can first turn a free-prose roadmap into the table the command needs.

This repository was migrated with the new process. On GitHub today, the labels match the written conventions exactly, the four issues that had no type now have one, and the Project board holds only issues. A fresh read-only re-plan proposes no further changes. Every automated check passes.

The gaps are small and none blocks the wave:

- When the owner answers which issue a critical issue blocks, the tool records the link but not the "Blocks:" sentence the conventions also ask for. The repository audit will then report that sentence as missing.
- The undo instructions for a changed label description ask for the old text, but the migration record does not keep it.
- A few documents still describe older decisions: one line in the label guide, two entries in the decision log, the traceability matrix and the testing standard's version number.
- The roadmap row still reads "Not started". The planner corrects it in the consolidated PR.

## Per-AC results (PRD, wave 3)

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-11 | Fixture dry run: exactly the FR-19 writes, milestone-only and unmappable stories unmapped, no title change, no parent for the bug, nothing written before approval | `map.ts` (D-98 precedence, milestone not a rule), `plan.ts` batches 1 to 7, closed `MIGRATION_PLAN_ACTIONS` (no title or Status action), `--plan` issues GET reads only | S-013 and S-014 reports AC-6, AC-7 Pass; tasks 3.x, 4.x ticked | `ac11-fixture.test.ts` (hand-written expected plan, zero write calls, no body text); `plan-readonly.test.ts` oracle; suite 2985/2985 | Pass |
| AC-12 | After the approved run: no open issue with a retired label, no PR item on the Project, no Status written | `apply.ts`: `remove-label` only, no `label delete`, no `project` argv (PT-80) | Migration record: 14 `done`, batch 7 W-015 to W-018 `done` (owner ticks) | `apply-scope.test.ts`, `apply-states.test.ts`, PT-80. Live, read-only: `gh project item-list 5` gives 48 items, all `Issue`, 0 `PullRequest`; Project workflows `Item closed` and `Pull request merged` are enabled; no retired label exists in the repository; PR #332 (opened after the migration) is not on the Project, which corroborates the `is:issue` filter (W-017), the only part not readable through the API | Pass |
| AC-13 | Fixture roadmap passes roadmap-parity; the plan lists every active state file without `Wave issue:`; the planner's resume adds it (as amended, D-99) | `snapshot.ts` reads active `planner-state-*.md` (archive excluded); `classify.ts` `WAVE_ISSUE_LINE`, note "the next planner resume adds it (D-89)"; no state-file write anywhere | PRD v1.11 AC-13, v1.12 FR-21 (D-105) | `roadmap.test.ts` "AC-11 fixture roadmap passes" the exported roadmap-parity parser; `classify.test.ts` state-file listing; `snapshot.test.ts` | Pass (matrix wording stale: F-5) |
| AC-16 | Three github-ops copies state the type set and tie-break, priority scale, `**Blocks:**` line and dependency commands identically; the audit reports the three checks | github-ops ×3 identical from `## Labels` to the end (diff 0 lines); Command Map dependency rows identical; audit checks: `critical` without relation, zero or several `type:`, retired label on an open issue, plus D-102's fourth | S-019 report AC-1 to AC-7 Pass; D-102 | `projects-tracking-wave-3-parity.test.ts` PT-55 to PT-67, PT-81 (`conventions.ts` against the prompt, both ways) | Pass |

PRD FRs (FR-17 to FR-22, FR-26): delivered as stated. FR-22's "Done when its consolidated PR merges" is pending by design.

Gates re-run by the verifier at `fc86be0`: `typecheck`, `lint` (incl. `core/checks/run.ts`), `format:check` OK; `pnpm run test` 93 files, 2985 tests passed; `pnpm run audit` no known vulnerabilities. Working tree clean after the run.

## Cross-story checks

| Check | Result | Evidence |
| --- | --- | --- |
| github-ops conventions = `conventions.ts` = what the CLI wrote | Agree (F-3 is the one prose omission) | Type set, tie-break, 8 definitions and colours, `level:` and `priority:` colours and descriptions, retired list and PRD State vocabulary including `not started` (D-107): code and prose match, PT-81 pins them. Live `gh label list`: all 16 `type:`/`priority:`/`level:` labels carry exactly the colours and descriptions in `conventions.ts`. |
| `**Blocks:**` line: prose and CLI | Gap (F-1) | Prose requires relation plus body line (D-84, D-102); batch 4b writes only the relation. |
| Runbook, Migration Mode, README, user manual, `--help` describe one CLI | Agree | Same flags (`--plan [--repo] [--out] [--json]`, `--apply [--plan-file] [--json]`), same exit codes (0, 1, 2, 11, 14 with the same causes, incl. lower-case `approved: yes` → 2, D-110), same answer grammar as `answers.ts`, same recovery for a lost first write-back, record-PR base per D-112 (`fc86be0`). `--verbose` is accepted but undocumented in `--help`; it is a global flag. |
| D-79 to D-112 reflected | Yes, except F-4 | Every decision except D-110 is cited in code, prompts or docs; D-110's amendments are in story v1.2, test plan CT-25, CT-28, MU-61 and spec §16a v1.6; D-108 and D-109 in `plan.ts`; D-111 in `gh.ts` and `bin/dev-tasks.ts`; D-112 in the runbook and github-ops ×3. |
| Per-story Unintended findings fixed or routed | Yes, one half-item open (F-4) | Planner Decisions Log routes every finding of S-013, S-014, S-015, S-016, S-019 and S-017 parts 1 and 2. S-015 F-9's "note D-91 superseded by A-82" is not done. S-017 part 2 F-1 fixed by D-112; F-2 pending (F-8). |
| Re-plan of the live repository (DF-29) at `fc86be0` | 0 writes in batches 1 to 6 | `tsx bin/dev-tasks.ts migrate projects --plan --out <scratch>`: exit 0, review 0 except 5 Information PRD questions the owner left blank. |

## Drift catalog

All items are **non-blocking** to PR readiness and issue completion.

| ID | Description | Impact | Intent | Evidence | Route |
| --- | --- | --- | --- | --- | --- |
| F-1 | A "needs a blocking link" answer `#N` makes batch 4b write only the native `blocked_by` relation (`plan.ts` line 703, A-73). D-84, FR-26 and github-ops require the relation **and** a `**Blocks:** #N — <reason>` body line, and the D-102 audit check reports "Blocking relation without its body line". So every critical issue migration fixes is flagged by the next github-ops audit. Neither the runbook nor Migration Mode tells the owner to add the line. Not exercised here (dev-tasks had no critical issue); riel will hit it. | Minor | Undetermined | `plan.ts` batch 4b; `MIGRATION_PLAN_ACTIONS` (no body edit); github-ops § Labels and audit check 4; spec A-73 predates D-102 | product-engineer: decide whether 4b adds the body line (a new write class: editing an existing body), or the runbook and Migration Mode step 2 tell the owner to add it |
| F-2 | Runbook Rollback for batch 1 says "set it back with `gh label edit ... --description "<previous>"`", but neither the plan nor the committed record holds the previous description: Detail holds only the new text. In this repository, eight descriptions (W-003 to W-010) were overwritten and their old text is in no record. | Minor | Undetermined | Runbook § Rollback; `workstream/migration-projects.md` batch 1; `plan.ts` (no previous-value field) | product-engineer: record the previous description (Information or a column outside the digest), or state in the runbook where to recover it (main's github-ops Labels table) |
| F-3 | github-ops § Labels names GitHub's default unprefixed labels as `bug`, `documentation`, `enhancement`. D-100 and `conventions.ts` `DEFAULT_LABEL_SUGGESTIONS` also cover `chore` (suggests `type: chore`) and `story` (no suggestion). PT-81 excludes this sentence. An agent auditing by hand would not suggest `type: chore` from a `chore` label, as the CLI did for #108, #262 and #263. | Minor | Undetermined | `.claude/agents/github-ops.md` line 388 (×3); D-100; `conventions.ts` | product-engineer: add `chore` and `story` to the sentence, or record that the prose names GitHub's own defaults only |
| F-4 | The decision log still states superseded text without a superseding row: D-91 gives the prefix `Retired (projects-tracking#D-NN):` (delivered: `Retired (D-91): `, A-82), and D-85 says `type: prd|wave|story` are "deleted" (delivered: retired, definitions kept, A-82). The log's own rule is that the superseding row names the row it replaces; A-82 is a spec amendment, not a log row. This is the open half of S-015 F-9. | Minor | Unintended | `decisions-projects-tracking.md` rows D-85, D-91, header line 3; spec §16a A-82; `conventions.ts` `RETIRED_DESCRIPTION_PREFIX` | product-engineer (drift-reconciliation): add a row superseding the D-85 and D-91 wording, citing A-82 |
| F-5 | `traceability-matrix-projects-tracking-phase-3.md` was not updated during the wave. The AC-13 row keeps the pre-D-99 wording ("each active state file carries the wave issue line") and "uncovered by design (second half) until A-58". Every row still reads `planned`, and the summary counts AC-13 as partial, although PRD v1.11 amended it and it is now met. | Minor | Unintended | Matrix lines 33, 119; PRD AC-13 v1.11 | product-engineer: amend the AC-13 row and set statuses from the story reports (or a verifier Design Mode refresh) |
| F-6 | `TESTING.md` front matter reads `version: 1.9`, while its changelog runs to 1.11 (S-015 tasks 5.x, 5.22). | Minor | Unintended | `TESTING.md` lines 2, 184 to 186 | qa-engineer (owner) or developer: set `version: 1.11` |
| F-7 | Roadmap mismatch (trigger 4). On the delivered tree, the wave 3 row reads `Not started`, Issues/PRs `wave #317, stories #318–#323 (PRD issue #289)` and What's missing `All`, while all seven PRs #326 to #332 have merged into the integration branch. Trigger 1 does not fire: wave #317 and sub-issues #318 to #323 all read `open`, so `Done` is not due. The PRD status comment on #289 already reads `3 | in progress | #317`. | Minor | Intended | `docs/roadmap.md` line 26; `gh api --paginate .../issues/317/sub_issues` (6 open); `gh pr view` × 7 (merged); a wave-issue search returned exactly #317 | planner, in the consolidated PR (row text below) |
| F-8 | Pending, not checkable yet: DF-28 and task 6.6 (ticked) need the consolidated PR to reference record PR #332 (S-017 part 2 F-2). No PR from `integration/projects-tracking-phase-3` exists yet. Also, the planner state's `Integration branch HEAD: 2e9f4dd` predates `fc86be0`. | Minor | Intended | `gh pr list --head integration/projects-tracking-phase-3` (none); state file Current Position | planner: reference #332 in the consolidated PR body and refresh the checkpoint |

Roadmap row the consolidated PR should carry (wave 2's row format):

- Status: `In progress`
- Issues/PRs: `wave #317, stories #318–#323, story PRs #326–#332, consolidated PR #<n> (PRD issue #289)`
- What's missing: `Consolidated PR #<n> to merge; Done when it merges and #317, #318–#323 close (D-94); riel is the post-delivery test bed`

At Phase 6, after the merge and with #317 and every sub-issue closed: Status `Done`, What's missing `—`.

## Edge-case and randomized test outcomes

The randomized suites (RT-9 to RT-13 with seeded PRNG, `helpers/prng.ts`) ran as part of the 2985 green tests with no failure, so no triage was needed. The per-story reports record the mutation-probe and edge-case outcomes. No new edge case was exercised at rollup level beyond the live re-plan.

- **Documentation structure:** `checkDocsStructure` on the delivered tree reports no failures and no staleness findings. The new runbook is indexed in `docs/runbooks/README.md`.
- **Vocabulary conformance:** `checkExportedIdentifiers` over the 15,805 added lines of `git diff main...integration/projects-tracking-phase-3` against `docs/domain/ubiquitous-language.md` reports no hits. Advisory, never blocking (D-63).
- **Runbook coverage (FR-49a/b):** not a finding. The wave changes no `templates/scripts/`, `templates/workflows/` or `.github/workflows/` file, and the setup and migration procedure ships with its runbook (`runbook-migrate-to-projects-tracking.md`) in the same consolidated PR.

## Recommendations

| ID | Next step |
| --- | --- |
| F-1 | product-engineer: decide batch 4b's body-line behaviour, then developer or the runbook and Migration Mode text |
| F-2 | product-engineer: decide how the previous description is kept or recovered; then developer or technical-writer |
| F-3 | product-engineer: align the github-ops sentence with D-100 (×3, then extend PT-81) |
| F-4 | product-engineer: superseding decision-log row for D-85 and D-91 wording |
| F-5 | product-engineer: refresh the traceability matrix |
| F-6 | qa-engineer: bump the `TESTING.md` version |
| F-7 | planner: set the wave 3 row as above in the consolidated PR; `Done` at Phase 6 |
| F-8 | planner: reference #332 in the consolidated PR, then re-check DF-28 |
