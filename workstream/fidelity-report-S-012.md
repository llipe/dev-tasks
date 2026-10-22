# Fidelity Report: S-012 (#295)

**Fidelity: High** | **Highest drift impact: Minor** (0 Critical, 0 Major, 4 Minor; all advisory, non-blocking)
Scope: Story S-012 (#295), PR #302 `story/S-012-verifier-wave-rollup` @ `96aab89` into `integration/projects-tracking-phase-2`, repository llipe/dev-tasks.

## Changelog

| Version | Date       | Summary                    | Author   |
| ------- | ---------- | -------------------------- | -------- |
| 1.0     | 2026-10-22 | Initial Audit Mode report. | verifier |

## What changed and why

The verifier checks whether the roadmap tells the truth about each wave. It used to compare the roadmap only with the pull requests that had merged. A wave now has its own tracking issue, with one child issue per story, and those child issues are the official list of what the wave contains. With this change, the verifier compares the roadmap with the tracking issue and its child issues when the wave has one. It finds that issue from the number the planner gives it, or else by searching for the wave's label and title. When a wave has no tracking issue, as with every wave published before this feature, the old comparison with merged pull requests still applies. Two awkward cases now have a stated rule. If the search finds two tracking issues, the verifier reports both and compares with neither. If the tracking issue has no child issues, the verifier falls back to merged pull requests and says so. The finding is still advice only and never holds up a pull request. All three platform copies say exactly the same thing, and new tests check the wording.

There are four small gaps, none of them blocking. The main one: the verifier treats a wave as finished when every story issue has closed, but the planner also waits for the tracking issue itself to close. In a rare case the two would disagree about whether the roadmap should read "Done".

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ------------- | ------------------- | ------------- | ------ |
| AC-1 | Triggers 1 and 4 compare the row with the wave issue and its sub-issues when one exists (D-36 search, `GET /repos/{o}/{r}/issues/{wave}/sub_issues`); merged-PR fallback otherwise (FR-16, D-57) | New **Comparison target** paragraph in `## Roadmap-Mismatch Finding`. It uses the caller's wave issue, else the `level: wave` + title-prefix search with client-side `startswith` (D-36). The REST path is named and the read is paginated (`gh api --paginate …/sub_issues --jq '.[] \| {number,state}'`, EC-91). The merged-PR fallback is quoted as a command, and the finding must name the source it used. Trigger 1 defines "complete" as every sub-issue `closed`, trigger 2 as a sub-issue still `open`, and trigger 4 compares with the sub-issue numbers and states. Each trigger keeps its no-wave-issue branch. The section is byte-identical across the three copies (sha1 `2822b784…`). | Tasks 5.2, 5.3 and 5.4 checked. Spec §8.4 also says trigger 1 uses "the wave issue's state", and the delivered text omits it (DR-1). PRD v1.7 FR-16 now matches D-57 (A-28 resolved). | PT-51 `sub-issue comparison` and PT-52 `fallback` are green at the head and red on the base (confirmed). LT-11 (`roadmap-parity.test.ts`, 22/22) passes. Live probe: the search returns exactly `#290`, and `sub_issues` returns #291 to #296, all `open`. | Drift (Minor, DR-1) |
| AC-2 | The finding stays advisory and routes to product-engineer | The paragraph "The finding is advisory … non-blocking to PR readiness and to issue completion … `activity-drift-reconciliation` … Never hold a PR on it" is unchanged. The two new edge-case bullets only report or fall back. | Task 5.5 checked. | PT-53 `advisory unchanged` passes on both base and head, as a regression guard should. | Pass |
| AC-3 | Parity file gains `describe("verifier")` asserting the sub-issue comparison and the fallback sentence in all three copies | `describe("verifier")` with four tests over `VERIFIER_TREES`, using `sectionOf`, `lineWith` and a local `triggerLine` that fails unless exactly one line matches. | Task 5.1 checked. The extra `edge cases` test covers EC-87 and EC-88 (A-36). | 3 of 4 red on the base and 4 of 4 green at the head. `test:unit` 64 files, 2253/2253. `validate` exit 0 (71 files, 2361 tests). | Pass |

Cross-tree and scope checks:

- The three verifier hunks are identical apart from line offsets. No text outside `## Roadmap-Mismatch Finding` changed.
- The task list edit only ticks 5.0 to 5.6. Nothing outside S-012's scope was touched.
- EC-87 and EC-88 now have one sentence each (A-36 resolved for S-012) and are tested. EC-89 passes (LT-11). EC-91 is handled with `--paginate`. EC-90 (rollup timing) is unchanged; see the A-26 note below.

## Drift catalog

Every item is **non-blocking** to PR readiness and to issue completion. Each one routes to `product-engineer`'s `activity-drift-reconciliation`.

| ID | Description | Impact | Intent | Evidence |
| --- | --- | --- | --- | --- |
| DR-1 | **Trigger 1 ignores the wave issue's own state.** Spec §8.4 says: "trigger 1 uses the sub-issues' states and the wave issue's state". The delivered text says "the wave is complete when every sub-issue's `state` reads `closed`". The planner's Phase 6 step 7 on the integration branch sets `Done` only when every state-table story is `✅ Merged` **and** the wave issue reads closed. The two triggers therefore disagree in one case: every sub-issue is closed but the wave issue is open. That happens when the consolidated PR carried `Refs #<wave>` and the stories were later closed by hand, or when the `Closes #<wave>` keyword was missed. The verifier would then ask for `Done` while the planner correctly keeps `In progress`, a false-positive advisory finding. | Minor | Unintended | Spec §8.4. Verifier trigger 1 (all three copies). `.claude/commands/planner.md` Phase 6 step 7. |
| DR-2 | **Different evidence for "complete".** The planner bases `Done` on state-table merges plus the wave issue's state. Phase 6 step 3 leaves a story issue that is still open after the merge for the user (EC-74). The verifier's trigger 2 bases it on sub-issue states. A row the planner correctly sets to `Done` with one story issue left open (keyword missed) therefore raises a trigger-2 finding. This is arguably a useful signal, since the planner reports the same open issue, but neither prompt says the two agents are meant to differ here. | Minor | Undetermined | Verifier trigger 2. Planner Phase 6 steps 3 and 7. |
| DR-3 | **`--state all` in the verifier's wave search** differs from the CT-22 literal in the Design Mode plan, which requires byte-identity with publish and planner (`--state open --json number,title`). The delivered text uses `--state all --json number,title,state`. **Judgment: the change is correct for the verifier.** Publish and planner Phase 0 look for the *active* wave to reuse or run, so `open` is right for them. The verifier audits after the fact. Trigger 2 (a `Done` row contradicted by an open sub-issue) and any re-audit of a shipped wave must find a *closed* wave issue. With `--state open`, the search would silently drop to the merged-PR fallback, which reverses D-57's precedence. The added risk is small: a closed duplicate or superseded wave issue with the same prefix now trips "more than one … compare with neither", which fails safe. The gap is that the rationale is recorded nowhere (prompt, PR body or decisions log), and no test pins `--state all`. A later "parity fix" back to CT-22 would pass every test. | Minor | Intended | Verifier Comparison target. `activity-publish-github` SKILL.md:31 and planner.md:149 (`--state open`). Test plan CT-22. PR #302 body. |
| DR-4 | **The planner handoff is claimed but not specified.** The verifier says "(the planner passes Run Info's `Wave issue: #N`)". Planner Phase 5 step 3, which invokes the rollup audit, does not say to pass the wave issue. Only the developer handoff template (planner.md:388) carries it. The search fallback covers the gap, so the effect is only an extra search. | Minor | Undetermined | Verifier Comparison target. `.claude/commands/planner.md` Phase 5 step 3. |

Carried forward, not new drift: **A-26 (rollup timing)** is still undecided. The rollup (Phase 5 step 3) runs before step 5 writes the row and before any sub-issue closes (D-54). For wave 2's rollup (DF-18), trigger 1 cannot fire, and trigger 4 will compare against the pre-run row: today `Not started`, with `Issues/PRs` reading "wave #290, stories #291–#296". All six sub-issues are listed and none is closed, so expect "no finding". The stale `Not started` status matches none of triggers 1 to 4. Planner step 5 corrects it in the consolidated PR.

## Edge-case and randomized test outcomes

| ID | Outcome |
| --- | --- |
| EC-87 (two wave issues) | Rule stated. `verifier > edge cases` passes. |
| EC-88 (zero sub-issues) | Rule stated. `verifier > edge cases` passes. |
| EC-89 (section identity) | LT-11 passes. Three identical sha1 values. |
| EC-90 (rollup timing) | Static only. A-26 is still open (see above). |
| EC-91 (pagination) | `--paginate` is present and pinned by PT-51. |

No randomized tactics apply to this scope.

- **Documentation structure:** `checkDocsStructure` returned no failures and no staleness findings. `tsx core/checks/run.ts` exited 0.
- **Vocabulary conformance:** `checkExportedIdentifiers` found nothing in the 92 added lines, which contain no new exported identifiers.
- **Runbook coverage:** no finding. The task list has no configuration, environment, tooling, credential or data steps.
- **Roadmap mismatch:** no finding. This is a story audit, and S-012 does not complete wave 2. I compared with wave issue #290 (from the D-36 search, one match). Its sub-issues #291 to #296 are all `open`, and S-018 is still pending.

## Recommendations

| ID | Next step |
| --- | --- |
| DR-1 | `developer`: in all three copies, change trigger 1's wave-issue clause to "when every sub-issue's `state` reads `closed` and the wave issue reads closed", then extend PT-51 to cover it. This can be done in this PR or as a follow-up. |
| DR-2 | `product-engineer`: decide whether an open story issue under a `Done` row is a finding the verifier should raise (keep as is) or should be excluded, then state that decision in the verifier or planner text. |
| DR-3 | `developer`: add one clause giving the reason ("`--state all`, so a shipped wave's closed issue is still found") and pin `--state all` in `verifier > sub-issue comparison`. `product-engineer`: amend CT-22 in the test plan so the verifier literal is exempt from byte-identity on `--state` and `--json`. |
| DR-4 | `developer` (S-018 or a follow-up): have planner Phase 5 step 3 pass Run Info's `Wave issue` to the verifier, or soften the verifier's parenthetical to "when the caller names it". |
| A-26 | `product-engineer`: decide this before the wave 2 rollup, as already recorded. No action is needed in S-012. |
