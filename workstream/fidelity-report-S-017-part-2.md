# Fidelity Report: S-017 part 2 (#323), PR #332

**Fidelity: High** | **Highest drift impact: Minor** | Drift findings: 2 (both non-blocking)

Scope: story S-017 (#323) AC-3 and dogfood rows DF-21 to DF-29 of `workstream/test-plan-projects-tracking-phase-3.md`; PR #332, head `chore/323-projects-migration`, base `integration/projects-tracking-phase-3`. DF-28's consolidated-PR reference is deferred to Phase 5 by the caller.

## Changelog

| Version | Date       | Summary                       | Author   |
| ------- | ---------- | ----------------------------- | -------- |
| 1.0     | 2026-10-26 | Audit Mode, S-017 part 2.     | verifier |

## Summary (plain language)

This repository has now been moved to the new issue-tracking conventions, using the procedure written in part 1 of this story. The tool proposed what it expected to: two new labels, clearer descriptions for eight existing labels, and a type label for four issues. Before anything was written, the owner answered every open question, one at a time, and approved the plan explicitly. After that, the tool made exactly those 14 changes and nothing else. The owner then did the four GitHub Project steps by hand. The board held no pull requests to remove, and the two settings were confirmed. Running the planning step again now proposes nothing, so the migration is complete. The committed plan file is the record of what changed.

Two small things differ from the written procedure. First, the record's pull request targets the wave's integration branch, while the runbook says it targets the main branch. Second, the task "referenced from the consolidated PR" is ticked before that reference exists. Neither one blocks anything.

## Sources

- PRD `docs/requirements/prd-projects-tracking.md` v1.12, FR-22.
- Decisions D-79, D-80, D-81, D-85, D-91, D-92, D-93, D-94, D-97, D-101 (`workstream/decisions-projects-tracking.md`).
- Runbook `docs/runbooks/runbook-migrate-to-projects-tracking.md`; github-ops § Migration Mode (`.claude/agents/github-ops.md`).
- Test plan DF-21 to DF-29, A-90 and its 2026-10-25 updated expectation (F-8).
- `gh pr diff 332`; live `gh` reads on 2026-10-26; read-only `gh project item-list 5`; a local re-plan to a scratch path.
- qa-engineer: `coverage_gate: SKIPPED(no code)`. The planner's attestations of session conduct.

## Per-AC result

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-3 | This repository is migrated with the runbook. The plan file has every write `done` or `skipped(<reason>)` and the Project batch ticked by the owner. It is committed in a chore PR referenced from the consolidated PR (D-93). | `workstream/migration-projects.md` is tracked in commit c3c7fde and ignored by `.gitignore:26` (`/workstream/*.md`), so it was force-added. Its single header line reads `Approved: yes`. `computePlanDigest` over the parsed batches gives `1d68731a…f0c1f`, which equals the header. | W-001 to W-014 (batches 1 and 4) read `done`; batches 2, 3, 4b, 5 and 6 are empty. W-015 to W-018 (batch 7) read `done`. The head branch is `chore/323-projects-migration`. | DF-21 to DF-27 and DF-29 pass (table below). DF-28 passes on head branch and files; its consolidated-PR reference is pending Phase 5. | **Pass** (reference pending Phase 5; F-1 and F-2 Minor) |

## Dogfood rows

| Test-ID | Expectation | Observed | Result |
| --- | --- | --- | --- |
| DF-21 | S-016 is a no-op; the roadmap test is green; runbook step 1 says the conversion is skipped for a canonical roadmap. | `vitest run test/unit/roadmap-parity.test.ts`: 28/28 passed. `docs/roadmap.md` holds the canonical table. Runbook step 1 says "this step is a no-op". | Pass |
| DF-22 | `--plan` is read-only. | Re-verified on my scratch re-plan: no repository file changed, and every review count was 0 except Information (5). The live labels and issues match the record (qa-engineer, and re-read below). | Pass |
| DF-23 | One question per review item, each with a recommendation; answers written in. | The record's Answer cells hold `chore`, `test`, `chore`, `chore`, and are blank for the five Information rows (the runbook's "leave it blank"). Two answers overrode the recommendation: #108 (planner recommended enhancement; the Suggested cell reads `chore`) and #262 (planner recommended test). An override shows the answers were the owner's own. One question per message is attested by the planner. | Pass (attested) |
| DF-24 | `Approved: yes` only after the owner's explicit approval. | `grep -c '^Approved:'` returns 1, reading `yes`. The re-plan after the answers reset the header to `no` (attested). The owner said "approved" before it was set (attested). The `type:` labels were added at 22:46:54Z–22:47:00Z, after the plan's `Generated: 22:02:33Z`, so `--apply` ran on the last rebuild. | Pass (attested, timestamps corroborate) |
| DF-25 | Exit 0; zero `pending` or `failed` rows in batches 1–6. | Exit 0 with 14 done, 0 skipped, 0 failed (attested). The parsed record shows all 14 CLI rows `done`. | Pass |
| DF-26 | Every batch 7 row ticked by the owner; Project 5 holds issue items only. | W-015 to W-018 read `done`. `gh project item-list 5` returns `{"Issue":48}`, no PullRequest items. The Workflows-page settings (auto-add `is:issue`; Item closed and Pull request merged On) rest on the owner's screenshot; no API exists for them (D-81). | Pass (Workflows half attested) |
| DF-27 | A re-plan to scratch proposes no CLI rows in batches 1–6 except `skipped(already applied)` (A-66). | I ran `pnpm exec tsx bin/dev-tasks.ts migrate projects --plan --out <scratchpad>/migration-check.md`: exit 0, batches 1 to 6 at 0 rows, batch 7 at 4 `pending` steps (always printed), Needs a type 0, Information 5. | Pass |
| DF-28 | Head `chore/323-projects-migration`; files include `workstream/migration-projects.md`; the consolidated PR body references it. | Head and files match. The base is the integration branch, not the default branch (F-1). The consolidated-PR reference is deferred to Phase 5. | Pass (partial; Phase 5) |
| DF-29 | 0 open issues per D-91 retired label; #317 parent 289; sub-issues 318–323; one marker on #289; titles unchanged. | No D-91 retired label is defined, and every `gh issue list --label` for `status: ready`, `status: in-progress`, `type: prd`, `type: wave`, `type: story`, `type: other`, `needs: decision`, `needs: approval` and `needs: merge` returns 0. No `wave:` label exists. The parent is 289; the sub-issues are [318,319,320,321,322,323]; #289 has 1 marker comment. The titles of #289 and #317–#323 are unchanged. | Pass |

**A-90 updated expectation (F-8).** The record matches it exactly:

- Batch 1 has 10 rows: it creates `type: refactor` (color D4C5F9) and `type: test` (color BFDADC), and sets the four `type:` and four `priority:` descriptions, all confirmed live.
- Batches 2 to 6 have 0 rows before the answers.
- Batch 7 has 4 steps.
- Needs a type lists #108, #244 (Suggested `bug`), #262 and #263.
- Information lists the 5 PRDs.

After the answers, batch 4 holds only the four confirmed type answers. Each of #108, #244, #262 and #263 now carries exactly one `type:` label (D-85).

## Conduct against the runbook and Migration Mode

| Rule | Evidence | Result |
| --- | --- | --- |
| One question per review item, with a recommendation, one per message (mode step 2) | Planner attestation. Two owner overrides of the recommendation (#108, #262). | Followed (attested) |
| Answers written exactly as given; nothing else edited (mode step 3) | The Answer cells match the attested answers. The digest recomputes, so no ID, Action, Target or Detail cell was edited. | Followed |
| Re-plan after the answers resets approval (runbook step 4, A-50) | Attested. The `Generated` timestamp is the rebuild's. | Followed |
| Explicit approval; no inferred approval (mode steps 5 and 6, D-80) | Attested: "approved", then `Approved: yes` set once. | Followed (attested) |
| `--apply` only after approval (D-80) | The writes are timestamped after the last rebuild, and the plan holds only one `Approved: yes` line. | Followed |
| No agent Project write (D-22, D-81, mode rules) | The planner attests it never ran a `gh project` command. The owner ran batch 7 with their own session. The CLI has no Project path (PT-80, part 1). | Followed (attested) |
| Batch 7 commands copied from the runbook or summary, not the plan file (mode step 8) | No PR items existed, so step 2 was a no-op. The rule was not stressed. | n/a |
| Commit only after every batch 7 row reads `done`; `git add -f` (runbook step 8, mode step 9, D-93) | The commit came after the ticks; the file is ignored yet tracked. | Followed |
| PR against the default branch (runbook step 8, mode step 9) | The base is `integration/projects-tracking-phase-3`. | **Deviation (F-1)** |
| Only the user merges | PR #332 is open and unmerged. | Followed |

## Drift catalog

All drift is **non-blocking** to PR readiness and to issue completion. It routes to `product-engineer`'s `activity-drift-reconciliation`.

**F-1. The chore PR targets the integration branch, not the default branch.**

- Impact: Minor. Intent: Undetermined.
- What the documents say: runbook step 8 says "`gh pr create --base <default-branch>` … The PR targets the default branch". Migration Mode step 9 says "open a PR against the default branch". The runbook's Preconditions also assume work starts from the default branch.
- What happened: PR #332's base is `integration/projects-tracking-phase-3`, so the record reaches `main` through the consolidated PR. Neither D-93 nor AC-3 names a base, and AC-3's "referenced from the consolidated PR" fits either choice. Under a planner run, the integration base is arguably the better choice.
- Gap: no decision records it, and the runbook and mode do not cover a migration run inside a planner wave.
- Evidence: `gh pr view 332 --json baseRefName`; runbook lines 208 and 211; `.claude/agents/github-ops.md` § Migration Mode step 9.

**F-2. Task 6.6, and with it parent 6.0, is ticked before its last clause holds.**

- Impact: Minor. Intent: Intended.
- 6.6 ends "…open the PR, referenced from the consolidated PR (D-93)". No consolidated PR exists yet; the caller defers the reference to Phase 5.
- The tick is ahead of the evidence. The Phase 5 rollup check will close the gap.
- Evidence: `workstream/tasks-projects-tracking-phase-3-plan.md` 6.0 and 6.6 in the PR #332 diff.

### Other checks (no finding)

- **Runbook coverage (FR-49b).** Not a finding. The PR's data-touching steps are 6.5 and 6.6, below the threshold of three. The procedure's runbook shipped in part 1 (PR #331) and was followed here.
- **Roadmap mismatch.** Not a finding. The wave 3 row lists wave #317 and stories #318–#323, all still `open` (wave #317 `OPEN`), with "What's missing: All". No trigger fires, since the wave is not complete. The row's Status reads `Not started` although six story PRs (#326–#331) have merged into the integration branch. The planner should update it in the consolidated PR (planner Phase 6).
- **Evidence limitation.** Not drift. DF-23 and DF-24, the "no agent Project write" rule and DF-26's Workflows-page half rest on planner attestation and the owner's screenshot. No transcript is committed, and the test plan names "Session transcript" as their evidence. The record's digest, the answer overrides and the GitHub event timestamps corroborate them, and no evidence contradicts them.

## Documentation structure

`pnpm exec tsx core/checks/run.ts` exited 0 with no failures. The runbook's `last_verified` is 2026-10-24, within 90 days, so there is no staleness finding. Because the dogfood exercised the runbook end to end on 2026-10-25, `last_verified` could be bumped (optional).

## Vocabulary conformance

`checkExportedIdentifiers` over the PR's added lines against `docs/domain/ubiquitous-language.md` returns `{"failures":[],"staleness":[]}`. The PR adds no exported identifiers, since it has no code.

## Auditor note

My first DF-27 attempt used `pnpm exec dev-tasks`. That resolved to a globally installed dev-tasks (`~/Library/pnpm/bin/dev-tasks`), not this repository's CLI. It ran a legacy-install migration and created an untracked `.dev-tasks/manifest.json`. Nothing on GitHub and no tracked file changed. I removed the directory, and `git status` is clean apart from this report.

The same pitfall applies to the runbook, which tells users to run `pnpm exec dev-tasks`. Inside this repository, that resolves to a global binary, because the package does not list itself in `node_modules/.bin`. In a consumer repository that installs the package, it resolves correctly. This is noted for awareness only, not as drift in this scope.

## Recommendations

| Item | Next step |
| --- | --- |
| F-1 | `product-engineer`: either add one runbook and Migration Mode sentence ("inside a planner wave, the chore PR targets the integration branch and reaches the default branch through the consolidated PR") or record the dogfood deviation as accepted. |
| F-2 | No action needed if Phase 5 adds the reference to the consolidated PR body. The rollup audit re-checks DF-28. |
| Roadmap row | Planner: set wave 3's row in the consolidated PR (Phase 6). |
