# Fidelity Report - S-008 (#291)

**Fidelity: High** | **Highest drift impact: Minor** | Scope: Story S-008 (#291), wave issue #290, PR #298 (`story/S-008-wave-issue-checkpoint-commit` @ `08834b2` → `integration/projects-tracking-phase-2` @ `a586a7e`)

Drift: 0 Critical, 0 Major, 3 Minor. All drift is advisory and non-blocking to PR readiness and issue completion. It routes to `product-engineer`'s `activity-drift-reconciliation`.

## Changelog

| Version | Date       | Change                    | Author   |
| ------- | ---------- | ------------------------- | -------- |
| 1.0     | 2026-10-22 | Initial Audit Mode report | verifier |

## What changed and why

The planner now finds out at the start of a run which GitHub issue tracks the whole wave. It looks first at the plan file, then searches GitHub, and otherwise notes that there isn't one. It records the answer in its saved progress file, so every later story reuses it and nothing has to look it up again. After each story is merged, the planner now also saves that progress file into the shared branch and pushes it. Anyone can then see from GitHub how far the run has got. Before this change the file stayed on one person's machine unless someone added it by hand.

The plan template now has a "Source" line, with the wave issue line directly below it. Before, the template had nowhere to put the wave issue line. Two history rows in the testing document had ended up inside the wrong table, and they were moved to its history section. Text that already existed was left alone, apart from those two moved rows and one rule that was loosened. That rule is the testing document's check on the "PRD AC-1" row, which may now read "observed" as well as "pending".

## Sources

- Story S-008 AC-1 to AC-5 (`workstream/user-stories-projects-tracking-phase-2.md`).
- Spec v1.1: §5, §8.1, §8.2, §8.7 and §16a (`workstream/specification-projects-tracking-phase-2.md`). §16a wins where it differs.
- PRD v1.7 FR-11 (`docs/requirements/prd-projects-tracking.md:95`).
- Decisions D-36, D-52, D-59, D-60 and D-62.
- Design Mode plan `workstream/test-plan-projects-tracking-phase-2.md` (PT-31, PT-33 to PT-35, PT-47, PT-54, CT-13, CT-14, CT-21, CT-22, RT-5, LT-9 to LT-14, EC-41 to EC-51, findings A-19, A-36, A-38, A-44, A-45) and `workstream/traceability-matrix-projects-tracking-phase-2.md` § S-008.
- Codebase: `gh pr diff 298`. The head tree was read in a detached worktree at `08834b2`, which was removed afterwards. The main checkout was not switched.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | `plan` Output Format header carries `Wave issue: #N` after `Source:`, read from the publication report's `Wave issue` line, else `Wave issue: none` with a planner-search note | Three plan copies (`.claude/skills/plan/SKILL.md`, `.github/instructions/plan.instructions.md`, `.kiro/steering/plan.md`): the template gains `Source:` plus `Wave issue: #N` on the next line (D-62, A-19). Process step 4 gains the same "Plan header" bullet in all three. It names the publication report's `Wave issue` line, `Wave issue: none` and a `> Note:` that the planner will search. No bold. The bodies are identical (LT-13 green). | Live plan lines 3-4 are `Source:` and `Wave issue: #290`, which matches CT-14. Task 1.2 and 1.2a are checked. | PT-31 `plan > wave issue header` is green on head and red on base. LT-13 `skill-parity-grilling` is green (121 tests). | Pass |
| AC-2 | Phase 0 order: plan header, else the D-36 `level: wave` search with prefix and `startswith`, reusing a single match, else `wave_status: skipped(no wave issue)` | New `### Wave Issue Resolution` in all three planner copies, inside the Phase 0 span before `---`. It goes header, then search, then skip. More than one match means stop and ask. When the header says `none` and the search finds one, the search wins and is recorded in the Decisions Log (EC-41, A-36). The search literal is byte-identical across the three publish copies and the three planner copies: 1 unique string out of 6 (CT-22). | Task 1.3 and 1.5a are checked. | PT-33 `planner > wave issue discovery` is green on head and red on base. It asserts `inOrder`, `WAVE_SEARCH` against publish, and identical `skipped` lines. LT-11 is green. | Pass |
| AC-3 | Run Info `Wave issue: #N \| none` after `Repository`; resume reads it; handoff passes it | `- Wave issue: #N \| none` sits between `- Repository:` and `- Started:` in all three State File Formats. Resume Detection gains a bullet that reads and reuses the line, and resolves it again if it is absent (see DR-1). The handoff fence gains one identical `Wave issue: {{ wave_issue }}` line with `wave_status: owned-by-planner`, as spec §8.2 says. | Task 1.4 is checked. | PT-34 is green on head and red on base. LT-10 `planner-decision-log-parity` is green (7 tests). | Pass |
| AC-4 | Step 13 commits the state file in the same step, `git add -f`, message `chore(planner): checkpoint after <story> merge`, then pushes | Step 13 in all three copies gets one appended sentence block: `git add -f workstream/planner-state-<plan-id>.md`, a commit on the integration branch with the exact message, a push, and a rejected push that is reported, retried once and then blocked. A hook block is never retried. Step 13 is still one line. On `.claude` and `.kiro` it comes after the `gh pr view` verification. | Task 1.5 and 1.5a are checked. `.gitignore:26` ignores `/workstream/*.md`, so `-f` is needed here (EC-44). | PT-35 is green on head and red on base. LT-9 `planner-merge-gate-parity` is green (3 tests). The checkpoint sentence is identical across trees (PT-47 for this marker). | Pass |
| AC-5 | Parity file gains `describe("plan")` and `describe("planner")` with explicit-path `loadTrees` | `test/unit/projects-tracking-parity.test.ts` adds `PLAN_TREES` and `PLANNER_TREES` path maps, `describe("plan")` (PT-31), `describe("planner")` (PT-33, PT-34, PT-35), the `WAVE_SEARCH` constant, and the helpers `lineWith`, `inOrder` and `sentenceWith`. The helpers have self-checks (RT-5). | Task 1.1 is checked. | The four new tests failed on the base prompts and pass on head, so the tests were written first (D-34). The file runs 37 tests, all green. | Pass |

## Targeted checks requested

| Check | Result |
| ----- | ------ |
| Three plan copies identical | Pass. The added lines are byte-identical and LT-13 is green. |
| Three planner copies identical for added text | Pass. All added hunks are identical across `.claude/commands/planner.md`, `.github/agents/planner.agent.md` and `.kiro/agents/planner.md`. |
| D-60: only sentences added, existing merge-gate wording untouched | Pass. Each planner file has exactly 1 deleted line, which is step 13. In all three, the new step 13 starts with the full old line byte for byte, and the change only appends. `.github`'s "**Write checkpoint**" wording and the `.claude` and `.kiro` verification wording are unchanged. Gates 5 and 6 are untouched. |
| A-45: step 13 still carries the per-merge comment sentence for S-009 | Pass. "post a GitHub Issue comment on the plan/milestone issue" is still in step 13 in all three copies. PT-35 pins it, so S-009's PT-37 will be red on its base. |
| Planner wave search identical to publish | Pass. Across the 3 publish and 3 planner copies there is 1 unique literal, and it equals CT-22. |
| `TESTING.md` changelog move | Pass. Rows 1.2 and 1.3 moved from Test Layers to `## Changelog`. Their cell text is identical after whitespace normalization, and the Layer rows were only re-padded. The new pin asserts that Test Layers has no dated rows. PT-30 was relaxed to `(pending\|observed)` as PT-54 says (A-38a/b). |
| Unrequested 1.4 changelog row and version bump | Acceptable. See DR-2. |
| Existing pins on head | Pass: LT-9, LT-10, LT-11, LT-13 and LT-14 (PT-20, PT-28, PT-30 amended). |
| Quality gates on head (worktree run) | `test` 0, `lint` 0, `format:check` 0, `typecheck` 0, `audit` 0, `validate` 0. `test:unit`: 64 files, 2233 tests, all passed. PR CI `pnpm run validate`: pass. |

## Drift catalog

All items are non-blocking to PR #298 readiness and to #291 completion.

| ID | Description | Impact | Intent | Evidence |
| -- | ----------- | ------ | ------ | -------- |
| DR-1 | Resume Detection adds a backfill. A state file written before the `Wave issue` line existed has the wave issue resolved again and the line added. The story's Migration Requirements say "Existing state files gain the line in wave 3 (FR-21)", and no AC covers this. It follows the Design Mode recommendation for EC-48, and this wave's own state file (started before S-008) needs it. It may overlap with FR-21's wave 3 scope. | Minor | Intended | Planner diff, Phase 0.5 resume bullet (three copies); story S-008 § Migration Requirements; test plan EC-48 |
| DR-2 | `TESTING.md` was bumped from version 1.3 to 1.4, with a developer-authored 1.4 changelog row for the move. Task 1.10a did not ask for this. It is consistent with the CLAUDE.md rule to maintain changelogs, and it changes no content. The relaxed PT-30 pin (PT-54) is not mentioned in the 1.4 row, but that pin lives in the test file, not in `TESTING.md`, so the row is accurate. | Minor | Intended | `TESTING.md` frontmatter and `## Changelog` |
| DR-3 | EC-51 is not addressed. Step 13 has no "commit if changed" guard, so a re-run of step 13 on an unchanged state file would hit `git commit` failing on an empty index. In practice the `Last updated` timestamp always changes, so this is unlikely. | Minor | Undetermined | Step 13 (three copies); test plan EC-51 (advisory, not tested) |

Not drift, noted for the record:

- The handoff line's parenthetical about `wave_status: owned-by-planner` matches spec §8.2. CT-20 and DF-19 will observe it.
- The "Issue Mode writes `Wave issue: none`" case follows from §8.1, since Issue Mode has no publication report.
- PT-47 is implemented for the two markers S-008 introduces (the `git add -f` sentence and the `skipped(no wave issue)` line). The rest belong to later stories.
- A-44's optional hygiene item (LT-9's stale header comment about `.github`) was not done. It was optional.

## Edge-case and test-plan outcomes

| Test-plan row | Outcome |
| ------------- | ------- |
| PT-31 / CT-14 (incl. bold negative) | Satisfied |
| PT-33 / CT-22 | Satisfied |
| PT-34 / CT-13 | Satisfied |
| PT-35 / CT-21 | Satisfied |
| PT-47 (S-008 markers) | Satisfied |
| PT-54 (PT-30 relaxed) | Satisfied |
| RT-5 helpers | Satisfied (self-tests on fixtures) |
| LT-9, LT-10, LT-11, LT-13, LT-14 | Green on head |
| EC-41 (header `none` + one match, recorded) | Satisfied. Sentence added and pinned (A-36 resolved for S-008). |
| EC-42 (two matches, stop) | Satisfied |
| EC-43 (no header, zero matches) | Satisfied (static). PT-40 belongs to a later story. |
| EC-44 (`git add -f` with ignored or tracked `workstream/`) | Satisfied (static) |
| EC-45 (push rejected, retry once, blocked; hook block terminal) | Satisfied. Sentence added and pinned (A-36 resolved for S-008). |
| EC-46, EC-47 (header variants, `Source:` anchor) | Satisfied (A-19 resolved per D-62) |
| EC-48 (resume of a pre-wave-2 state file) | Addressed by an added sentence (DR-1). Not pinned. |
| EC-49, EC-50 (LT-9 line shape, `.github` step 13) | Satisfied |
| EC-51 (empty commit) | Not addressed (DR-3) |
| A-38 (a), (b) | Resolved. (c) is naming only and needs no change. |
| DF-6, DF-7, DF-19 (dogfood) | Pending. They will be observed after PR #298 merges, at the first checkpoint commit (`hand-applied`, A-25). |

No randomized tests were run in scope. RT-5 is enumerated fixtures with no seed.

### Documentation structure

`checkDocsStructure` on the head tree (`tsx core/checks/run.ts` exit 0, plus a direct call): 0 failures, 0 staleness findings.

### Vocabulary conformance

`checkExportedIdentifiers` over the added lines of `git diff a586a7e...08834b2` against `docs/domain/ubiquitous-language.md`: 0 hits. This is advisory and never blocks (D-63).

### Runbook coverage (FR-49b)

Not a finding. Task 1.0's steps are prompt and test edits. None is configuration, environment, tooling, credential or data work, and no script or workflow under `templates/` or `.github/workflows/` changed.

### Roadmap mismatch

Not applicable. S-008 does not complete the wave.

## Recommendations

| Drift | Next step |
| ----- | --------- |
| DR-1 | `product-engineer`: record in the S-008 changelog that resume backfills a missing `Wave issue` line (EC-48 resolved), and check FR-21's wave 3 scope for overlap. Optionally pin the sentence in a later parity extension. |
| DR-2 | No action needed. |
| DR-3 | `product-engineer`: decide whether step 13 should say "commit if changed". If so, route it to `developer` in a later story. Otherwise mark EC-51 as accepted. |
