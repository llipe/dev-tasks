# Fidelity Report: S-015 (#322), `dev-tasks migrate projects --apply`

**Fidelity: High** | **Highest drift impact: Minor** | Drift items: 9 (0 Critical, 0 Major, 9 Minor) | Scope: S-015 (#322), PR #330, branch `story/S-015-migrate-apply` @ 849dbe6, base `integration/projects-tracking-phase-3`

Drift is advisory and non-blocking to PR readiness and issue completion. Findings route to `product-engineer` (`activity-drift-reconciliation`) or `developer`.

## Changelog

| Version | Date       | Change                    | Author   |
| ------- | ---------- | ------------------------- | -------- |
| 1.0     | 2026-10-24 | Audit Mode, story scope.  | verifier |

## Summary (what changed and why)

The migration command can now carry out a plan the owner has reviewed and approved. It refuses to start if the plan is not approved, was edited after it was produced, is already being run elsewhere, or (before anything has been done) if the repository changed since the plan was made. It then makes the changes in the agreed order and writes the outcome of each one into the plan file straight away, so if the run stops part-way, running it again picks up where it left off and never repeats a change already made. It never touches the GitHub Project board, never deletes anything, never renames an issue and never sets a status: the board cleanup steps are printed for the owner to do by hand.

The delivered behaviour matches what was asked. The differences found are small: a few places where the code made a sensible choice the written requirements had not spelled out (where an issue number is recorded, retrying steps that were skipped because something they needed had failed, a plan with a lower-case approval line counting as malformed), one small reporting bug after a failed save, and some documents (the GitHub issue, two docs pages) that lag behind the agreed design.

## Per-AC results

Sources: codebase = `core/migrate-projects/apply.ts`, `bin/dev-tasks.ts`, `planfile.ts`; workstream = story file (v1.1 annotation), tasks 5.1 to 5.27, spec v1.5 §16a, test plan and matrix rows S-015/AC-1..8; tests = `test/unit/migrate-projects/apply-*.test.ts`, `cli.test.ts` (447/447 module tests pass; full suite 2925/2925).

| AC | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| -- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | Unapproved plan → 14, nothing written | `runMigrationApply` gate 3 after parse (2) and auth (11); `parseMigrationPlan` approves only on exactly one header line `Approved: yes` before the first `## ` | §16a A-79, A-64; task 5.19 gate order | `apply-gates.test.ts` (20 its, table-driven gate order, CT-25 near-misses, fenced line), `cli.test.ts` MC-11; probe: `Approved: Yes` → 14, 0 writes | Pass (see F-5) |
| AC-2 | Stale snapshot → 14 "regenerate the plan" | Hash compared only while every row is `pending` (gate 6), per D-101 | §16a A-49 / D-101 supersede the unconditional wording | `apply-gates.test.ts`, `cli.test.ts` MC-12 | Pass (per §16a) |
| AC-3 | Batches 1-6 in order; state written back after each call | Batches built in canonical `MIGRATION_PLAN_BATCHES` order; `store.write(renderMigrationPlan(plan))` after every state change; atomic tmp+rename in `createPlanFileStore` | A-80, D-88, tasks 5.4, 5.22 | `apply-states.test.ts`, `apply-writeback.test.ts` (EC-140 crash mock) | Pass (see F-1, F-6) |
| AC-4 | Re-run executes only pending/failed; no done repeated | `isRunnable`: `pending`, `failed(`, `skipped(depends on`; `isApplied` rows never run; target checks before every write | D-88, CT-28 | `apply-states.test.ts` "throws on write 5 … repeats writes 1 to 4 zero times", RT-11; probe: full ac11 run 32 writes, re-run 0 writes | Pass (see F-2, F-3) |
| AC-5 | Batch 7 never executed; steps printed; no `gh project` | Only `runner === "cli"` batches yield writes; batch 7 rows parse as steps; no `project` argv anywhere in `apply.ts`; summary prints steps | D-81, D-22, A-60 | `apply-scope.test.ts` (EC-149), PT-80 in `projects-tracking-wave-3-parity.test.ts`; probe: no project/delete argv in 32 writes | Pass |
| AC-6 | Retired labels removed from open issues; descriptions prefixed; no delete | `remove-label` → `issue edit N --remove-label=<l>`; `edit-label` from Detail; no `label delete`, no `DELETE` anywhere | §16a A-82 prefix `Retired (D-91): ` (supersedes AC-6 text) | `apply-scope.test.ts` MU-72/73/75, EC-150 | Pass (see F-9) |
| AC-7 | Bodies via `--body-file`; marker procedure | `withBody` writes into `mkdtemp(tmpdir())`, removes each file in `finally`; bin removes its temp dir in `finally`; comment created by `issue comment --body-file`, edited by `api -X PATCH … --field=body=@<file>`, comments re-read live just before | github-ops § Status comment, D-92, A-67 | `apply-bodies.test.ts` (8 its, MU-77); probe: body paths under OS temp dir | Pass |
| AC-8 | Exit 1 on any failed, else 0; `--json` counts | Final `failed ? GeneralError : Success`; interruption → 1; `migrationApplyJson` matches A-64 shape | A-64 | `cli.test.ts` MC-13/14, E2E-22, signal tests | Pass |

Invariants checked in the code, not only the tests: no `gh project` call and no batch 7 execution; no `label delete`, no deletion, no title write (`--title` only on `issue create`), no Project Status write; review-table answers are never parsed into rows (A-50); argv built only from the closed Action set's Action/Target/Detail, every value `--flag=value`, label names after `--`, numeric-only positionals and paths; `--repo` comes from the snapshot, which must equal the working tree (a hand-edited header cannot redirect writes); atomic write-back after every state change; lock released in `finally` and on SIGINT/SIGTERM; bodies only by file in the OS temp dir. All hold.

## Drift catalog

All items are non-blocking to PR readiness and issue completion.

| ID | Description | Impact | Intent | Evidence | Route |
| -- | ----------- | ------ | ------ | -------- | ----- |
| F-1 | Created issue numbers are recorded in the State column (`done(#N)`, `skipped(already applied, #N)`), not in Detail as the story's Technical Notes say. Detail is under the `Plan digest:`, so recording there would break the digest; State is the right place. `skipped(already applied, #N)` is not in CT-28's grammar. | Minor | Intended | `apply.ts` `createdNumber`, `resolveRef`; story Technical Notes; test plan CT-28 | product-engineer: amend story note and CT-28 |
| F-2 | `skipped(depends on W-NNN)` rows run again on the next run. AC-4/D-88 say only `pending` and `failed`; CT-28 says `skipped*` never re-run; §8.4 shows `skipped` as terminal. Re-running is the safer reading (those rows were never attempted) and is what lets a fixed wave-issue create unblock its links. | Minor | Intended | `isRunnable`; probe P5: failed create → 6 `skipped(depends on …)`, re-run applied all | product-engineer: amend AC-4, CT-28, §8.4 |
| F-3 | Per-write target checks use the start-of-run snapshot plus the run's own writes, not a live read just before each write as A-49/D-101 word it. Status comments, sub-issue parents and blocking lists not in the snapshot are read live. The gap is one run's duration, under the lock, and only matters for concurrent outside edits. The user manual repeats "just before it runs". | Minor | Intended | `apply.ts` header comment, `Live` class; manual `--apply` bullet 4 | product-engineer: amend D-101/A-49 wording; technical-writer: manual wording |
| F-5 | A lower-case `approved: yes` that replaces the `Approved:` line exits 2 (the required header is absent, "missing the `Approved:` header line"), not 14 as CT-25 and MU-61 state. `Approved: Yes`, trailing space, duplicates and fenced lines all exit 14 (confirmed). Exit 2 matches A-64 (unparsable → 2) and the gate order of task 5.19. The manual's "exit 14 when the header is not exactly one `Approved: yes` line" is inaccurate for this case. | Minor | Intended | `planfile.ts` header parse; `apply-gates.test.ts:154`; probe P2 | product-engineer: amend CT-25/MU-61 (planner already intends this); manual: note a plan with no `Approved:` line is unparsable (2) |
| F-6 | After a failed write-back, the row's in-memory state is set to `pending` rather than restored to what it was before, so the summary and `--json` count a row that reads `failed(...)` on disk as pending. The plan file itself is correct. | Minor | Unintended | `apply.ts` write-back `catch`: `w.state = "pending"`; probe P4: on-disk W-002 `failed(boom)`, summary batch 1 pending=1 failed=0 | developer: keep the previous state and restore it |
| F-7 | Known limitation, confirmed: when the first write lands but its state is never recorded, every row still reads `pending`, the hash check fires and the next run exits 14 "regenerate the plan". Recovery works: `--plan` may overwrite an all-pending file (A-65) and the rebuilt plan does not repeat the landed write. The error message says this; README and manual do not. | Minor | Intended | probe P3 (re-run → 14), P6 (re-plan + apply: 31 writes, no duplicate) | technical-writer / S-017 runbook: document recovery |
| F-8 | Only SIGINT and SIGTERM are handled. SIGHUP (terminal closed) leaves the lock file behind (the message tells the user to remove it). On a signal sent to the node process alone, an in-flight `gh` child is not stopped and may land its write after exit and after the lock is released; the next run's target check finds it (except in F-7's first-write case). | Minor | Undetermined | `bin/dev-tasks.ts` `migrateProjectsApply`; `gh.ts` `execFile` | developer: consider SIGHUP and stopping the in-flight child, or document |
| F-9 | Issue #322's body does not carry the v1.1 annotation that the story file has. Its AC-6 prefix `Retired (projects-tracking#D-91):`, its unconditional AC-2 and its "unanswered review row" edge case are superseded by §16a A-82, A-49 and A-50; the code follows §16a (`Retired (D-91): `). D-91's text still names the old prefix. | Minor | Unintended | `gh issue view 322`; story file line 349; `conventions.ts` `RETIRED_DESCRIPTION_PREFIX` | product-engineer: add the annotation to #322; note D-91 superseded by A-82 |
| F-10 | Exit-code documentation for `--apply` is incomplete. The manual's exit-code table row 2 and README row 2 do not list a missing or unparsable plan file (the manual's `--apply` section does). Neither says `--apply` also exits 2 when the working tree is not the plan's repository or the roadmap table is missing, or 14 when the plan file changes while `--apply` starts. CHANGELOG and README are otherwise accurate, and nothing claims `--apply` touches the Project. | Minor | Unintended | `SNAPSHOT_ERROR_EXIT` reused by `--apply`; `apply.ts` "changed while --apply started"; README, manual | technical-writer |

Not drift: signals exit 1 rather than 130/143. Spec §6 does not cover signals; CT-34 and the user manual say 1, and the code does the same.

## Edge-case and randomized test outcomes

- The test plan's S-015 rows (MU-60 to MU-78, MC-11 to MC-17, E2E-20 to E2E-26, EC-138 to EC-155, RT-11, RT-14, PT-80) are present and green. RT-11 and RT-14 use the seeded PRNG (`MIGRATE_SEED`, printed on failure).
- The four story edge cases are covered: a label already present (`apply-states.test.ts:264`); a failed wave create skipping its links (probe P5 and tests); the "unanswered review row" case, replaced by A-50 (`apply-gates.test.ts:297`); a lost write-back (`apply-hardening`/`apply-writeback`).
- qa-engineer: `coverage_gate: PASS` on re-run (27/27 mutants killed; `apply.ts` 99.7% lines, 98.1% branches).
- **Documentation structure:** `checkDocsStructure` reported no failures and no staleness.
- **Vocabulary conformance:** `checkExportedIdentifiers` over the PR's added lines against `docs/domain/ubiquitous-language.md` reported no hits.
- **Runbook coverage (FR-49b):** not a finding. The task list's steps are ordinary code changes, with no new script or workflow under `templates/` or `.github/workflows/`; the migration runbook belongs to S-017.
- **Roadmap mismatch:** not a finding. Wave issue #317 and its sub-issues #318 to #323 are all `open`, so S-015 does not complete wave 3. The row's `Issues/PRs` cell (wave #317, stories #318 to #323) agrees.
- **Quality gates (re-run by verifier):** `lint` 0, `format:check` 0, `typecheck` 0, `audit` 0, `test` 0 (2925 tests).

## Recommendations

| ID | Next step |
| -- | --------- |
| F-1, F-2, F-3, F-5 | `product-engineer` via `activity-drift-reconciliation`: record the accepted deviations in the story, CT-28/CT-25/MU-61, §8.4 and the D-101 wording |
| F-6 | `developer`: a one-line fix (restore the previous state), with a test |
| F-8 | `developer`: optional hardening, or document it in the S-017 runbook |
| F-9 | `product-engineer`: add the v1.1 annotation to #322's body; note that A-82 supersedes D-91 |
| F-7, F-10 | `technical-writer` (or S-017's runbook): recovery from a lost first write-back; complete the `--apply` exit-code rows |
