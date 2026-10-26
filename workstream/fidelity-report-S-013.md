# Fidelity Report: S-013 (#320), `migrate projects --plan` and the plan file

**Fidelity: High** | **Highest drift impact: Minor** | **Drift items: 8 (0 Critical, 0 Major, 8 Minor)** | **Status: complete**

Scope: story S-013 (#320), PR #328 (`story/S-013-migrate-plan` at `5fd90ef`, base `integration/projects-tracking-phase-3`). Audited against #320 (ACs, v1.1 annotation, checklist 3.1 to 3.18), `workstream/user-stories-projects-tracking-phase-3.md` S-013, spec v1.3 (§5, §6, §7, §8.1, §12, §13, §16a, where §16a wins), decisions D-79 to D-105, the S-013 rows of the test plan and traceability matrix, and PRD FR-17, FR-19 and FR-26 (v1.12).

Drift is advisory. None of it blocks PR readiness or issue completion. Findings go to `product-engineer`'s `activity-drift-reconciliation`.

## What changed and why

The toolkit now has a command that looks at an existing repository and writes a plan file listing what the new tracking conventions would change. Nothing on GitHub changes when it runs. The plan also lists the questions the owner has to answer: issues with no clear type, urgent issues that don't say what they block, and planner files missing a line. Owners review a concrete list instead of letting an agent make changes on its own. This story covers the reading side and the plan file. Mapping stories to waves and building the actual change list come in the next story (S-014). Making the changes comes in the one after (S-015).

As part of this work, every `dev-tasks` command now refuses a mistyped or incomplete option instead of quietly ignoring it. The changelog records this.

We ran the command read-only against this repository and it worked. It found the four open issues that have no type label and changed nothing on GitHub. One gap: the plan file tells the owner to type answers and run the command again, but this version throws those answers away when it runs again. The next story is scheduled to keep them.

## Per-AC results

| AC | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-1 | Command, flags, defaults, `--help` beside `migrate docs` | `bin/dev-tasks.ts` `migrateProjects()`, help text lines 102-105; `bin/parse-args.ts` `parseMigrateProjectsArgs` (A-63: exactly one of `--plan`/`--apply`, unknown/foreign/valueless flags, stray argument → 2); default out `workstream/migration-projects.md`; `--repo` checked against `gh repo view` (A-52, exit 2) | Tasks 3.6e, 3.7, 3.8, 3.16 ticked | `cli.test.ts`, `parse-args.test.ts`, `cli-flags.test.ts` pass; CLI probe from a scratch copy: all 20 invocations exit as specified | Pass (see F-2, F-4) |
| AC-2 | `gh auth status` first; exit 11 + `gh auth login` hint; nothing else read | `snapshot.ts` `readSnapshot`: `auth status --hostname github.com` (A-88) is the first call, throws `SnapshotError("auth")` before any other read; `GhNotFoundError` → `gh-missing` → 11; `repo-view` failure → 11 (A-64) | 3.8 ticked | `cli.test.ts` (fake `gh` on purpose-built `PATH`, A-85), `snapshot.test.ts` assert the call list stops after auth | Pass |
| AC-3 | Snapshot through one injectable `GhRunner`, paginated | Every list is `gh api --paginate ... per_page=100`, no `--limit` (A-74, A-75); REST numeric `id` kept; parent read for stories and tracking issues (A-76); sub-issues for tracking issues; `dependencies/blocking` for critical issues (A-72); closed tracking issues by `search/issues ... is:closed PRD in:title` (A-91); local files through `LocalReader` (A-52); roadmap, PRD H1s and state files enter the hash | 3.4, 3.6b, 3.9, 3.18 ticked | `snapshot.test.ts` (32) pass; error paths (non-404 parent, unreadable JSON) asserted | Pass |
| AC-4 | Classification, "needs a type", "needs a blocking link" | `classify.ts`: story first (A-53, EC-110/M1 fixed), `STORY_TITLE_PATTERN` single constant, tolerant `**Story:**` line (A-54, CRLF, fences, quotes); tracking by Wave prefix, PRD title forms, or container labels (D-87); containers exempt (A-68); D-85 set only, retired `type:` count as none, D-100 default-label suggestions, tie-break (A-69, A-70, `conventions.ts`); critical check on `blocking` only (A-72 supersedes the AC's `**Blocks:**` clause), never invents a link | 3.5, 3.6c, 3.10, 3.17 ticked | `classify.test.ts` (48) pass; live dogfood: #108, #244, #262, #263 listed with suggestions `chore`, `bug`, `chore`, `chore` | Pass (see F-6) |
| AC-5 | Plan file render and parse round-trip with answers | `planfile.ts`: `Format: 1`, `Generated`, `Snapshot`, `Plan digest`, `Approved: no` (A-51); one table per review list plus Information (A-77); `W-NNN` widening (A-78); escaped cells; closed Action set; strict parse guards | 3.6, 3.6d, 3.11 ticked | `planfile.test.ts` (49) pass, answers survive parse | Pass (see F-1) |
| AC-6 | `--plan` makes zero write calls | Code read: only `auth status`, `repo view`, and GET `gh api` calls with no `-X` and no field flags; the only local write is the plan file (temp file + rename) | 3.11 ticked | `plan-readonly.test.ts` uses a test-side oracle (`helpers/is-write.ts`); mutation probes injecting `label create` or `api -X POST` into `readSnapshot` fail 48-50 tests | Pass |
| AC-7 | No issue bodies in the plan file | `body` is held in the snapshot for classification and hashing only; `buildMigrationPlan` copies number, title, type-label names, notes; notes are fixed strings or roadmap parser reasons (local doc text, not issue data) | 3.11 ticked | Sentinel test in `plan-readonly.test.ts`; mutation probe splicing the body into a needs-type title fails 2 tests | Pass |

## Drift catalog

Every item below is **non-blocking** to PR readiness and issue completion.

| ID | Description | Impact | Intent | Evidence | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F-1 | Running `--plan` again throws away answers typed into the review tables. The rendered plan file says: "Answer in the Answer column, then run `dev-tasks migrate projects --plan` again: it reads the answers and rebuilds the batches." `runMigrationPlan` reads the existing file only for the A-65 check, then writes a fresh plan with `answer: ""`. The probe typed `bug` into #12's Answer, re-ran, and the answer came back `""` with exit 0. Carrying answers over is S-014 task 4.7 (A-50), so the gap is scheduled. In the meantime, the file's own instruction leads to lost work. | Minor | Undetermined | `core/migrate-projects/index.ts` `buildMigrationPlan`/`runMigrationPlan`; `planfile.ts` `renderMigrationPlan` instruction line; tasks 4.7, 4.4a | `developer`: before S-014 lands, either drop "it reads the answers" from the instruction line, or refuse to overwrite (exit 14, like A-65) when any Answer cell is filled. S-014 4.7 closes it either way. |
| F-2 | Test plan MC-2 ("`--plan --repo o/r` → no `repo view` argv") contradicts §16a A-52, which runs `repo view` every time to check `--repo` against the working tree. The code follows A-52, and §16a wins. MC-2 is a stale row. | Minor | Intended | `snapshot.ts` lines after the auth check; test plan line 295 | `product-engineer`: rewrite MC-2 as "`--plan --repo o/r` in a clone of `o/r` → header names `o/r`; in another clone → exit 2". |
| F-3 | A missing canonical roadmap table is a roadmap note in S-013. It does not exit 2 yet, although spec §6, §13 and A-64 say it should. S-014 AC-2 and task 4.2 own that exit 2, so the split matches the story files. | Minor | Intended | `classify.ts` roadmap branch; S-014 AC-2; task 4.2 | No action in S-013. When S-014 adds the exit, check that it replaces the note and doesn't duplicate it. |
| F-4 | `migrate projects --apply` parses and then exits 2 with "not available in this version yet". S-015 delivers `--apply`, and README and the user manual both say it isn't in this version. | Minor | Intended | `bin/dev-tasks.ts` `migrateProjects` | No action. S-015 replaces the branch. |
| F-5 | Pre-existing: the user manual's Exit Codes table lists `3 ReconciliationConflict` and `4 DependencyError`, and is missing 1, 11 and 14. `core/exit-codes.ts` defines 0, 1, 2, 11 and 14, and README matches it. The new manual section right above the table cites exits 11 and 14, so the contradiction is now two scrolls apart. The manual also doesn't say that an existing non-plan file at `--out` exits 14. | Minor | Unintended (pre-existing) | `docs/dev-tasks-user-manual.md` lines 350-357; `core/exit-codes.ts`; README "Exit codes" | `technical-writer` (FR-51): align the table with `core/exit-codes.ts` and README, and add the non-plan-file case to the 14 line. |
| F-6 | A-53 says a PRD tracking issue's title is "exactly `[PRD-<name>] <H1 of the PRD file>`". `prdTitleForms` also accepts the H1 without its `PRD:` lead and its `<name> —` lead. This repository needs that: H1 `PRD: projects-tracking — GitHub Projects as …` against #289 `[PRD-projects-tracking] GitHub Projects as …`. It reads D-04's "`<PRD title>`" sensibly, but neither the spec nor the decision log records it. | Minor | Intended | `classify.ts` `prdTitleForms` and its comment; D-04; A-53 | `product-engineer`: add a line to spec §16a A-53, or a decision, naming the accepted title forms. |
| F-7 | The retired-label half of PT-81 is weak. It checks that each code label appears in the prompt, not the reverse, and it matches `needs:` labels by their suffix only. A probe that removed `"needs: merge"` from `RETIRED_LABELS` passed all 186 tests. The type set, tie-break and definitions halves catch changes (probes swapping tie-break order and editing a definition both failed). | Minor | Unintended | `test/unit/projects-tracking-wave-3-parity.test.ts` PT-81 third `it`; mutation probe | `developer`/`qa-engineer`: parse the prompt's retired list into a set and compare it with `RETIRED_LABELS` both ways. Do it before S-014 batch 5 starts using the list. |
| F-8 | PT-80 catches `gh project …` strings and any quoted `project` argv token (probes failed as expected). It would not catch a Project write through `gh api graphql` (`addProjectV2ItemById`, `updateProjectV2ItemFieldValue`) or a REST `projects` path. Nothing like that exists today, and the repository-wide PT-28 guard has the same gap. | Minor | Undetermined | PT-80 block; PT-28 `PROJECT_WRITE` pattern | `developer`: add `/ProjectV2|projectV2|\/projects\b/` to PT-80's line check (and consider the same for PT-28). |

## Edge-case and randomized test outcomes

- Story edge-case matrix: `gh` not on PATH → 11; zero open issues → empty plan, 0; `Story S-NNN` title with an empty body → story; `[PRD-x] Wave 1:` without `level:` → tracking; CRLF bodies; more than 1,000 issues paginated. All are covered in `snapshot.test.ts`, `classify.test.ts` and `cli.test.ts`, and all pass.
- Randomized tests: RT-7 (sentinel body), RT-8 (hash stable under reordering), RT-10 (read-only oracle), RT-13 (exactly one kind, story wins), RT-15. They use a seeded PRNG (`MIGRATE_SEED`), print the seed on failure, and all pass. No failures needed triage.
- Traceability tags: ten S-013 test-plan IDs (MU-8, MU-13, MU-14, EC-102, EC-112, EC-113, EC-119, CT-29, CT-31, CT-34) are not cited in any test file. The behaviour behind each one is tested (tie-break, `blocking: [...]`, `**Blocks:**`-only, `--hostname`, D-100, `search/issues`, `formatWriteId`, exit codes, `GhNotFoundError`). This is a tagging gap, not missing coverage. Traceability matrix rows S-013/AC-1 to AC-7 still read `planned`.
- Quality gates, re-run here: `typecheck`, `lint`, `format:check` clean; `pnpm run test` 81 files and 2,658 tests pass. qa-engineer gate: `coverage_gate: PASS` (as reported).
- Dogfood (task 3.13), re-run read-only with `--out` set to a scratch path: exit 0. 4 "needs a type" rows, 0 state-file rows (the active state file carries `- Wave issue: #317`), 0 roadmap notes. `git status` clean afterwards and no GitHub write. The closed-issue search finds wave issue #290.
- **Plan-file headroom for S-014.** S-014 can fill the batches without a format change. All eight batch tables (1-6, 4b, 7) already render with `ID | Action | Target | Detail | Depends on | State`. The closed Action set covers A-71, A-73, A-67 and A-84 (`create-label`, `edit-label`, `create-issue`, `add-label`, `remove-label`, `link-sub-issue`, `add-blocked-by`, `status-comment`). Unknown columns and header lines survive a round trip. The Unmapped and Information tables already have Answer columns for the A-83 answers. `Format: 1` leaves room for a version bump if one is ever needed.
- **CLI flag regression (3.16).** Behaviour is consistent across `install`, `update`, `status`, `pin`, `unpin`, `doctor`, `migrate`, `migrate docs` and `migrate projects`: an unknown or valueless flag exits 2 and is named in the message. `migrate --plan`, `--apply` and `--repo` exit 2 with the `migrate projects` hint and never reach the legacy migration. CHANGELOG `[Unreleased] / Changed` records it. Every `dev-tasks` invocation documented in README, the user manual, `docs/`, `.claude/`, `.github/`, `.kiro/` and `templates/` uses only `--profile`, `--pin`, `--json`, `--force`, `--plan` and `--out`, so none of them breaks. `migrate projects --help` prints the global help (0), which is acceptable. On failure, `--json` emits `review: null`, a small departure from the A-64 shape that is reasonable when no plan was built.

### Documentation structure

`tsx core/checks/run.ts`: no failures and no staleness findings.

### Vocabulary conformance

`checkExportedIdentifiers` over the PR's 5,259 added lines against `docs/domain/ubiquitous-language.md`: no hits. The scan is advisory and blocks nothing (D-63).

### Runbook coverage (FR-49b)

Not triggered. The S-013 task list has no setup, configuration or migration steps, and the PR changes no script or workflow under `templates/` or `.github/workflows/`.

### Roadmap mismatch

No finding. Wave issue #317 (`level: wave`) has sub-issues #318 to #323, all `open`. S-013 does not complete the wave. The roadmap row's `Issues/PRs` (wave #317, stories #318–#323) matches. `Not started` is left for the planner's consolidated-PR update.

## Recommendations

1. F-1: `developer` drops the "it reads the answers" sentence or guards filled answers until S-014 4.7 lands.
2. F-2, F-6: `product-engineer` updates MC-2 and records the A-53 title forms, through drift reconciliation.
3. F-3, F-4: no action. They are tracked by S-014 4.2 and S-015.
4. F-5: `technical-writer` fixes the user-manual Exit Codes table.
5. F-7, F-8: `developer`/`qa-engineer` tighten PT-81's retired-label pin and widen PT-80's pattern. Neither changes behaviour.
