# Fidelity Report: S-016 (#319), PR #327

**Fidelity: High** | **Highest drift impact: Minor** | **Drift findings: 5** (all non-blocking)

Scope: Story S-016 (#319), PR #327, branch `story/S-016-roadmap-conversion` into `integration/projects-tracking-phase-3`. Audited 2026-10-24 by `verifier` (Audit Mode, story scope).

Sources: #319 (ACs, checklist; status comment), `workstream/user-stories-projects-tracking-phase-3.md` S-016 (v1.1 annotation), spec v1.3 §8.6 and §16a (A-56, A-59, A-86; §16a wins), decisions D-86, D-89, D-94, D-98, D-99, test plan PT-68 to PT-72 and EC-161 to EC-163, traceability rows S-016/AC-1 to AC-4, PRD v1.11 FR-18, FR-21 and AC-13.

## Summary

product-engineer now has a written procedure for a repository whose roadmap is free prose rather than the standard table. It drafts the table, puts it above the existing prose without changing the prose, uses only the three allowed statuses, shows the owner every status it had to interpret, and ships the result as its own small docs PR, approved by the owner, before any migration runs. It also explains that migration needs that table, that migration matches labels to roadmap rows only on an exact match, and that migration lists planner state files without ever editing them. The text is the same in all three tool trees.

Five small gaps remain:

- The text describes the earlier label-matching rule. Since D-98, a `phase:` label only counts within its own PRD, and the text does not say so.
- The automated checks confirm that the key phrases are present, but they would still pass if the surrounding words were changed to mean the opposite. One of the checks, which is meant to stop the conversion from marking work as finished without proof, has a hole in it.
- The text does not tell the agent to confirm on GitHub that a PR the prose cites as "done" really merged. An older rule in the same section also still says there is only one exception to "never mark a row Done yourself."
- The GitHub issue is missing the v1.1 design notes that the story file carries.
- The PRD's FR-21 wording was not updated to match the decision about state files.

None of these blocks the PR.

## Per-AC Results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | Conversion step: draft table (row per phase/wave, scope, Status from fixed set, Issues/PRs from narrative), narrative verbatim below, flag translated Status, own docs PR before migration | `### Roadmap Conversion (before migration)` under `## Roadmap Maintenance` in all three trees. The steps come in order 1 to 4. Step 2 says "never instead of it" and "the table is added above the narrative". Step 3 lists translated rows "with the original word". Step 4 says "the user approves the draft" and "never inside the migration's own PR". A partial table is defined per A-59. The "paused" and two-sections edge cases are present. | Task 2.2, 2.4a, 2.6 `[x]`; spec §8.6; D-86; A-59; A-86 (owns § Roadmap Maintenance) | PT-68 `roadmap conversion` green; "lives under Roadmap Maintenance" green | Pass |
| AC-2 | `--plan` refuses without table; `phase: X` exact match only | "refuses to run without the canonical table"; "maps `phase: X` only to a row whose `Phase/Wave` cell equals `X` exactly"; "listed as unmapped for the user, never fuzzy-matched (D-86)". The PRD scoping from D-98/A-56 is missing. | Task 2.3; D-86; D-98; spec §16a A-56 | PT-69 `migration dependency` green | Drift (F1) |
| AC-3 | Migration does not edit state files; planner resume adds the line | "Migration edits no `workstream/planner-state-*.md` file: `--plan` lists each active state file that lacks a `Wave issue:` line as information, and the planner's resume adds the missing `Wave issue:` line (D-89; PRD AC-13 as amended by D-99)" | Task 2.4, 2.4a; D-89; D-99; PRD AC-13 v1.11 | PT-70 `state files` green | Pass |
| AC-4 | Parity pins, byte-identical across three copies | All three subsections hash to `48b20bef…`, and roadmap-parity is green (27/27) | Task 2.1, 2.7, 2.8 | PT-71 green; full suite 2432/2432 | Pass (pin strength: F2) |
| BR-1 | Narrative kept verbatim, table above, never instead | Step 2 | FR-21 | PT-68 (bold label only) | Pass |
| BR-2 | No `Done` without merged evidence | Step 3: "never upgraded to `Done` by the conversion; a `Done` row cites the merged PR or closed issue behind it" | D-86 | PT-72 green | Pass with drift (F3) |

Meaning checks requested by the caller:

| Check | Verdict |
| ----- | ------- |
| Narrative kept, never replaced | Holds (step 2) |
| Status from the fixed set | Holds (step 1, together with the "`Status` is exactly one of…" line above it) |
| The user approves the draft | Holds (step 4) |
| Own docs PR, never inside the migration PR | Holds (step 4) |
| Exact match only, never fuzzy, unmatched listed as unmapped | Holds (dependency paragraph) |
| Migration only lists state files and never edits them | Holds (state-file paragraph) |
| Nothing lets the conversion set `Done` from narrative alone | Mostly holds. Narrative-cited evidence is not verified (F3). |
| D-98/A-56 scoping of `phase: X` to the title's PRD | Missing (F1) |
| Three-tree agreement | Holds (identical SHA-1 over the subsection, PT-71) |
| roadmap-parity | Holds (`roadmap-parity.test.ts` 27/27). `docs/roadmap.md` is unchanged. |

Quality gates re-run: `format:check`, `lint` and `typecheck` pass, and `vitest run` passes 74 files and 2432 tests.

## Drift Catalog

Every item below is **non-blocking** to PR readiness and issue completion. Route each to `product-engineer`'s `activity-drift-reconciliation`.

### F1. `phase: X` matching is not scoped to the title's PRD (D-98, A-56)

- **Impact:** Minor. **Intent:** Unintended.
- **Evidence:**
  - The delivered sentence is "maps `phase: X` only to a row whose `Phase/Wave` cell equals `X` exactly".
  - Spec §16a A-56/D-98 (which wins) and PRD v1.11 FR-18 say rule 2 matches only "within the PRD named by the story's title prefix".
  - The test plan's A-56 recommendation explicitly said "State it in FR-18 and S-016 AC-2". FR-18 was amended, but S-016 AC-2 and task 2.3 were not, so the developer followed the stale AC.
- **Effect:** The sentence is not false, since a scoped match is still an exact match. It is incomplete, though. In this repository's roadmap, `Phase/Wave` `1` appears under four PRDs, so a reader of the step would expect a global match and could treat a cross-PRD collision as the conversion's problem.

### F2. The parity pins prove presence, not meaning; PT-72's negative half is weaker than specified

- **Impact:** Minor. **Intent:** Unintended for PT-72's negative half (the test plan specifies "no **sentence** lets the conversion set `Done`"). Intended for the other sub-clauses (the test plan states "They prove presence only. Meaning is checked in Audit Mode").
- **Evidence:** Mutation probes were run on a scratch copy, applying each edit identically to all three trees, then running the wave-3 parity file and roadmap-parity:
  - M1: append ", and a narrative "shipped" may be set to `Done` without evidence" to step 3's line. **Passes** (43/43). That line contains "never" and "merged", so the `/never|merged/` line check is satisfied.
  - M2: add "A narrative that says done may be marked Done directly." without backticks. **Passes**, because the filter matches only `` `Done` ``.
  - M10: a separate line "…is set to `Done`." **Fails** (caught).
  - M3: "never instead of it" changed to "the table may replace the narrative". **Passes.**
  - M4: drop "the user approves the draft". **Passes.**
  - M5: "never inside the migration's own PR" changed to "or inside the migration PR". **Passes.**
  - M6: "listed as unmapped…, never fuzzy-matched" changed to "fuzzy-matched to the closest row". **Passes.**
  - M7: "`Status` from the fixed set" changed to "in the narrative's own words". **Passes.**
  - M8: "`--plan` lists each active state file… as information" changed to "`--plan` edits each…". **Passes.**
  - M9: drop ", with the original word, for the user to confirm or correct". **Passes.**
  - Control M0: drop "refuses". **Fails** (caught).
- **Conclusion:** This confirms qa-engineer's finding. Several AC-1 sub-clauses (narrative-kept, user-approves, never-inside-migration-PR) are pinned only by their bold labels. The fuzzy/unmapped clause and the state-file "lists… as information" clause are not pinned at all. Byte-identity (PT-71) only catches cross-tree divergence, not a uniform change.

### F3. The `Done` path relies on the narrative's citation, and the "one exception" bullet is not updated

- **Impact:** Minor. **Intent:** Undetermined.
- **Evidence:**
  - Step 3 says "a `Done` row cites the merged PR or closed issue behind it", but it never says to confirm on GitHub that the cited PR merged or the issue closed. A narrative that says "done in PR #12" could therefore yield `Done` on the narrative's word. Two things mitigate this: the translation is flagged, and the user approves the draft.
  - The same section's bullet "Never mark a row `Done` yourself…; `Done` requires merged work, and `planner` sets it… The one exception is… (planner D-72)" still names a single exception. The conversion now writes `Done` rows too.

### F4. Issue #319 lacks the v1.1 annotation

- **Impact:** Minor. **Intent:** Unintended.
- **Evidence:** The story file's S-016 ACs carry "Annotated v1.1 (Design Mode, spec §16a)": A-86 section ownership, the A-59 partial-table definition, and AC-3 matching AC-13 as amended (D-99). The #319 body has no such note. Only the synced task 2.4a references A-59/D-99. GitHub is the source of truth for execution status.

### F5. PRD FR-21 wording is out of step with D-86/D-89/D-99

- **Impact:** Minor. **Intent:** Undetermined.
- **Evidence:**
  - FR-21 (v1.11) still says "every active `planner-state-*.md` gains a `Wave issue: #N` line". D-99 amended only AC-13.
  - FR-21 says the converted table's Issues/PRs name "the wave tracking issue". D-86 and the delivered step take Issues/PRs "from the narrative", which is unavoidable because conversion precedes migration and no wave issue may exist yet.
  - The delivered text follows the decisions, so this is a PRD-text gap, not an implementation defect.

## Advisory Checks

- **Documentation structure:** `tsx core/checks/run.ts` exits 0 with no findings.
- **Vocabulary conformance:** the PR adds no `export` lines, so `checkExportedIdentifiers` has no input and there are no hits.
- **Runbook coverage:** no finding. The task steps are prompt and test edits. No script, workflow or infra change is involved.
- **Roadmap mismatch:** no finding. I compared the row against wave issue #317 (open) and its sub-issues #318–#323, all open. S-016 does not complete the wave. The row reads `Not started`, although S-019 has merged to the integration branch. No trigger covers that, and planner and product-engineer set `In progress`/`Done`.

## Edge-Case Outcomes (test plan)

- EC-161: the partial table is defined as the canonical header with at least one row (A-59). Present and pinned (PARTIAL_TABLE). Pass.
- EC-162: "paused" translates to `Not started` and is flagged. Present and pinned. Pass.
- EC-163: two sections give one row citing both. Present and pinned. Pass.
- Not covered (observation only): a canonical header with zero rows is neither "partial" nor clearly "no table". Under A-59 it is not canonical, so conversion would run.

## Recommendations

| Finding | Next step | Owner |
| ------- | --------- | ----- |
| F1 | Append to the AC-2 sentence: ", among the rows of the PRD named in the story's `[PRD-<name>]` title prefix (D-98)". Amend S-016 AC-2 and task 2.3 to match. Extend PT-69's EXACT_MATCH pin. | `product-engineer` (AC wording), then `developer` |
| F2 | Make PT-72's negative half sentence-based and case-insensitive on `done`. Allow only the NEVER_DONE sentence and the citation sentence. Pin the meaning-bearing phrases: "never instead of it", "the user approves the draft", "never inside the migration's own PR", "listed as unmapped for the user, never fuzzy-matched", "`Status` from the fixed set", "lists each active state file that lacks a `Wave issue:` line as information", "with the original word". Alternatively, pin the whole subsection as a golden string. | `developer` / `qa-engineer` |
| F3 | Step 3: "confirm each cited PR is merged (`gh pr view <n> --json state`) or issue closed before writing `Done`; otherwise keep the translated Status and flag it". Amend the "one exception" bullet to name the conversion. | `product-engineer` decides, then `developer` |
| F4 | Sync the v1.1 annotation into the #319 body. | `product-engineer` |
| F5 | Amend FR-21 in a PRD changelog entry: state files are listed and filled by the planner's resume (D-89, D-99); Issues/PRs come from the narrative at conversion time (D-86). | `product-engineer` |
