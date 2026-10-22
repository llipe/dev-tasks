# Implementation Plan - projects-tracking Wave 2 (planner and verifier)

Source: `workstream/user-stories-projects-tracking-phase-2.md` v1.0 — all 6 stories selected (#291 to #296).
Wave issue: #290
Spec: `workstream/specification-projects-tracking-phase-2.md` v1.0
Decisions: `workstream/decisions-projects-tracking.md` (D-01 to D-61; wave 2 HOW rows D-52 to D-61)
Research: `workstream/research-projects-tracking-phase-2.md`
Follow-up consumed: #285 (D-50)
Repository shape: single-package — package brackets omitted per `docs/tech.md`.
Order: 1.0 → 2.0 → 3.0 → 4.0 → 5.0 → 6.0. One shared parity test file; each story adds or extends its `describe` block first (test-first, D-34). The planner's three copies are `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`; their pre-existing wording differences on merge gates 5, 6 and 13 stay (D-60).

## Relevant Files

- `.claude/skills/plan/SKILL.md`, `.github/instructions/plan.instructions.md`, `.kiro/steering/plan.md` - `Wave issue:` header line; Artifacts `Task plan:` update (S-008, S-018)
- `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md` - Wave issue discovery, state file, handoff, checkpoint commit, wave and PRD status comments, never-close sentence, `Closes` lines, DF-5 observation, roadmap commands, Phase 6 close-out, Artifacts fidelity-report line (S-008 to S-011, S-018)
- `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md` - wave status table states widened (S-009); `## Why` consolidated-PR `Closes` rule (S-010)
- `.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md` - Rules 12 and 13, lifecycle row, Final Instruction 5: nobody closes (S-010)
- `.claude/agents/verifier.md`, `.github/agents/verifier.agent.md`, `.kiro/agents/verifier.md` - Roadmap-Mismatch Finding compares with the wave issue and its sub-issues (S-012)
- `.claude/skills/activity-publish-github/SKILL.md`, `.github/skills/activity-publish-github/SKILL.md`, `.kiro/skills/activity-publish-github/SKILL.md` - PRD status comment at publish (S-018)
- `TESTING.md` - DF-5 In progress observation written by the planner at consolidated PR open (S-010, dogfood)
- `test/unit/projects-tracking-parity.test.ts` - `describe("plan")`, `describe("planner")`, `describe("verifier")`; extensions to the github-ops, implement and publish blocks (all)

## Tasks

- [x] 1.0 Implement Story S-008: The planner knows its wave issue and commits its checkpoint after every merge (#291)

  - [x] 1.1 Add `describe("plan")` and `describe("planner")` to `test/unit/projects-tracking-parity.test.ts`, with `loadTrees` taking explicit paths for the plan files (skill, instruction, steering) and the planner files (command, two agents); assert the `Wave issue:` header line, the Phase 0 discovery order with the `level: wave` search and `startswith` filter, the `skipped(no wave issue)` value, the Run Info `Wave issue` line, the handoff `Wave issue` line, and the `git add -f` checkpoint commit with its message; run `pnpm run test:unit`, confirm red (D-34)
  - [x] 1.2 In the three plan copies, add `Wave issue: #N` to the Output Format header after `Source:` and the Process step that reads it from the publication report's `Wave issue` line, writing `Wave issue: none` with a note when absent (D-59)
  - [x] 1.2a Add a `Source:` line to the plan Output Format header in all three plan copies so `Wave issue:` has its anchor (Design Mode A-19, D-62)
  - [x] 1.3 In `.claude/commands/planner.md` Phase 0, add the wave issue resolution: plan header line; else the D-36 search with the `[PRD-<name>] Wave <id>:` prefix and client-side `startswith` filter, one match reused, more than one stops; else `wave_status: skipped(no wave issue)` (D-59)
  - [x] 1.4 Add `Wave issue: #N | none` to the State File Format's Run Info after `Repository`, make Phase 0.5 resume read it, and add `Wave issue: #N | none` to the Phase 4 handoff template (FR-11, D-59)
  - [x] 1.5 Rewrite merge rule step 13's checkpoint sentence: write the state file, `git add -f` it, commit on the integration branch with `chore(planner): checkpoint after <story> merge`, push (FR-11, D-52)
  - [x] 1.5a State the edge cases: plan header says none but the search finds one (use it and record it); two search matches (stop and ask); push rejected (report, retry once, then blocked) (A-36)
  - [x] 1.6 Apply the same edits to `.github/agents/planner.agent.md` and `.kiro/agents/planner.md`, leaving their merge-gate wording as it is (D-60)
  - [x] 1.7 Verify Acceptance Criterion: plan header line in all three plan copies
  - [x] 1.8 Verify Acceptance Criterion: Phase 0 discovery order and skip value in all three planner copies
  - [x] 1.9 Verify Acceptance Criterion: state file and handoff carry the wave issue
  - [x] 1.10 Verify Acceptance Criterion: checkpoint commit sentence with `git add -f` and the message
  - [x] 1.10a Fix `TESTING.md`: move the changelog rows 1.2 and 1.3 out of the Test Layers table into `## Changelog`, and relax PT-30 so the PRD AC-1 row may read observed (A-38)
  - [x] 1.11 Run Tests: `pnpm run test:unit`, `pnpm run validate`; dogfood note in the PR body: this wave's own run will show the state file on the integration branch after the first merge

- [x] 2.0 Implement Story S-009: The planner keeps the wave issue's status comment current and stops posting per-merge comments (#292)

  - [x] 2.1 Extend `describe("planner")` with assertions for the wave status comment events (run start, story start, closeout, merge, block), the reference to implement § Status Comment and github-ops's wave table by name, the `wave_status` values `skipped(no wave issue)` and `failed(<reason>)`, and a negative on "post a GitHub Issue comment on the plan/milestone issue"; confirm red
  - [x] 2.2 In `.claude/commands/planner.md`, add the wave status comment creation at the end of Phase 0 (or on resume) and its in-place edits at story start, developer closeout, step 13 merge, and block, using the implement procedure and the github-ops wave table with the story-state vocabulary `pending`, `in progress (sub-task n of m)`, `PR open`, `merged into integration`, `blocked` (FR-12, D-53)
  - [x] 2.2a Widen github-ops's wave status table states in all three copies to pending, in progress (sub-task n of m), PR open, merged into integration, blocked (A-20, D-63)
  - [x] 2.2b Post the run-start wave comment after Phase 3 pre-flight, and edit the same comment at consolidated PR open and at close-out (A-30, A-40, D-70)
  - [x] 2.3 Remove the per-merge comment sentence from step 13 and change the Invariants line to "edit the wave status comment" (D-53)
  - [x] 2.3a Redirect Phase 5 step 3's rollup summary from the plan/milestone issue to the wave status comment, and make the Invariant read "commit the state file and edit the wave status comment" (A-31, A-32, D-70)
  - [x] 2.4 Add the report rule: `wave_status: skipped(no wave issue)` or `failed(<reason>)` goes to the state file's Decisions Log and the run summary and never blocks a merge gate (D-53)
  - [x] 2.5 Apply the same edits to the `.github/` and `.kiro/` planner copies
  - [x] 2.6 Verify Acceptance Criterion: comment events and table reference in all three
  - [x] 2.7 Verify Acceptance Criterion: per-merge comment sentence gone, Invariants reworded
  - [x] 2.8 Verify Acceptance Criterion: report values and never-blocks rule
  - [x] 2.9 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [x] 3.0 Implement Story S-010: Nobody closes a story; the consolidated PR closes every story and the wave at ship (#293)

  - [x] 3.1 Extend the `planner`, `github-ops` and `implement` blocks: the never-closes sentence, the `Closes #N` per story and `Closes #<wave>` requirement in Phase 5 step 7 and the include list, the `project_observation` DF-5 line, the github-ops `## Why` consolidated-PR sentence, and negatives on "Then close issue" and the old implement rules 12 and 13 wording; confirm red
  - [x] 3.2 In the three planner copies, add under the merge rule: the planner never closes a story issue; it closes when the consolidated PR merges to main (FR-13, D-54)
  - [x] 3.3 In Phase 5 step 7 and the "Consolidated PR should include" list, require `Closes #N` for every story in the state table and `Closes #<wave issue>` when a wave issue exists, generated from the state table, `Refs` for everything else; a blocked, unmerged story gets `Refs` with the reason (FR-15, D-56)
  - [x] 3.3a `Closes #N` only for stories whose state-table row is merged, `Refs #N` with the reason for unmerged ones, `Closes #<wave>` only when every story merged, all under the PR body's `## Why` (A-34, A-35, A-47, D-67)
  - [x] 3.4 After the PR opens, when a Project is configured (number from the runbook's exercise record or `docs/roadmap.md`), read one story's Status (superseded by 3.4a: `projectItems`, no Project number) and record `project_observation: observed | not observed(<reason>)` for "In progress at consolidated PR open" in the PR body and in `TESTING.md`'s DF-5 row (#285, D-50)
  - [x] 3.4a Detect a Project and read Status with `gh issue view <n> --json projectItems`; empty means no Project; never a write verb or a scope request (A-37, D-68)
  - [x] 3.5 In the three github-ops copies, extend the `## Why` rule with the consolidated-PR `Closes` sentence (D-56)
  - [x] 3.6 In the three implement copies, rewrite rules 12 and 13, the lifecycle row "Then close issue" and Final Instruction 5: nobody closes the issue; it closes when a PR against the default branch carrying `Closes #N` merges, the consolidated PR under the planner or the story PR in a main-thread run (D-54)
  - [x] 3.7 Verify Acceptance Criterion: never-closes sentence in all three planner copies
  - [x] 3.8 Verify Acceptance Criterion: `Closes` lines required and generated from the state table
  - [x] 3.9 Verify Acceptance Criterion: DF-5 observation step present
  - [x] 3.10 Verify Acceptance Criterion: github-ops `## Why` sentence in all three
  - [x] 3.11 Verify Acceptance Criterion: implement close rules rewritten in all three, old wording absent
  - [x] 3.12 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 4.0 Implement Story S-011: The planner derives the roadmap row from gh and closes out the run when the user reports the merge (#294)

  - [ ] 4.1 Extend `describe("planner")`: the two roadmap commands, `## Phase 6`, the `MERGED` check, the archive path `workstream/archive/planner-state-<plan-id>-archived.md`, the `chore(roadmap)` PR, and the completion invariant; confirm red
  - [ ] 4.2 In the three planner copies, rewrite Phase 5 step 5: `Status` `In progress`; `Issues/PRs` from `gh issue list --search "[PRD-<name>] in:title" --state all --json number,state` and `gh pr list --base <integration branch> --state merged --json number`; `What's missing` names the consolidated PR; both commands cited verbatim in the PR body's Roadmap section (FR-14, D-55)
  - [ ] 4.2a Take story numbers and states from `gh api repos/{o}/{r}/issues/{wave}/sub_issues`, the title search only as the no-wave-issue fallback, and write `What's missing` as "consolidated PR to `main`" (A-22, A-23, D-64, D-65)
  - [ ] 4.3 Add `## Phase 6 - Close-out` after Phase 5 in the three copies with the ordered steps: `gh pr view <n> --json state,mergedAt` must show `MERGED` else stop; pull main; delete the integration branch locally and remotely; confirm every story issue and the wave issue closed; when a Project is configured read the items and confirm Done, else `not observed(no project)`; roadmap row `Done` with `Issues/PRs` naming stories, story PRs and the consolidated PR and `What's missing` `—`; move the state file to the archive path; record the DF-5 Done observation in `TESTING.md`; edit the PRD status comment to shipped; open one `chore(roadmap)` PR to main (D-55, D-58, D-61)
  - [ ] 4.3a Order Phase 6 as: read PR state, sub-issues, story PRs and Project items first; create `chore/<plan-id>-closeout`; write and open the PR there; delete the integration branch last; Phase 6 may start in any session from the merged PR number and the plan id; a story issue still open after merge is reported, not closed (A-24, A-36, A-41, A-46, D-66)
  - [ ] 4.4 Change Phase 5 step 9 to "then run Phase 6" and state in the Output Contract and Invariants that the run is complete only after Phase 6 (D-61)
  - [ ] 4.5 Verify Acceptance Criterion: step 5 commands and citation rule in all three
  - [ ] 4.6 Verify Acceptance Criterion: Phase 6 steps in order in all three
  - [ ] 4.7 Verify Acceptance Criterion: completion invariant
  - [ ] 4.8 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 5.0 Implement Story S-012: The verifier's rollup compares the roadmap row with the wave issue and its sub-issues (#295)

  - [ ] 5.1 Add `describe("verifier")` asserting the sub-issue comparison with the `sub_issues` read, the D-36 search, the merged-PR fallback sentence, and the advisory sentence, in all three verifier copies; confirm red
  - [ ] 5.2 In `.claude/agents/verifier.md`, rewrite Roadmap-Mismatch Finding triggers 1 and 4 to compare with the wave tracking issue and its sub-issues when one exists (D-36 search, `GET /repos/{o}/{r}/issues/{wave}/sub_issues`), keeping the merged-PR comparison as the fallback and the finding advisory (FR-16, D-57)
  - [ ] 5.2a State the edge cases: two wave issues match (report, compare with neither); wave issue with zero sub-issues (fall back to merged PRs, note it) (A-36)
  - [ ] 5.3 Apply the same edit to the `.github/` and `.kiro/` verifier copies
  - [ ] 5.4 Verify Acceptance Criterion: sub-issue comparison and fallback in all three
  - [ ] 5.5 Verify Acceptance Criterion: finding still advisory, routing unchanged
  - [ ] 5.6 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 6.0 Implement Story S-018: The PRD issue carries one status comment updated at wave events (#296)

  - [ ] 6.1 Extend the `activity-publish-github`, `planner` and `plan` blocks: PRD status comment at publish with `prd_status` values, planner edits at run start, PR open and close-out, Artifacts `Task plan:` set by plan and fidelity report set by the planner; confirm red
  - [ ] 6.2 In the three publish copies, after hierarchy verification, create or edit the PRD issue's status comment per github-ops's PRD table with the wave row `published`, reporting `prd_status: written | failed(<reason>) | skipped(no PRD issue)` in the publication report; PRD issue number from the report's line, else the D-36 `level: prd` search (FR-25)
  - [ ] 6.2a Widen github-ops's PRD status table states in all three copies to published, in progress, consolidated PR #n open, shipped; an existing wave row is edited, never duplicated (A-21, A-36, D-63)
  - [ ] 6.3 In the three planner copies, edit the PRD status comment at run start (`in progress`), at consolidated PR open (`consolidated PR #n open`) and in Phase 6 (`shipped`), recording `prd_status` in the state file; and set the wave issue body's Artifacts fidelity-report line at Phase 5 (FR-25, D-61)
  - [ ] 6.3a Read the PRD issue as the wave issue's parent (`GET issues/{wave}/parent`); set the wave body's `Integration branch:` at pre-flight and add a `Fidelity report:` Artifacts line at Phase 5 (A-29, A-39, D-69)
  - [ ] 6.4 In the three plan copies, set the wave issue body's `Task plan:` Artifacts line to the plan path when the wave issue is known (FR-25)
  - [ ] 6.5 Verify Acceptance Criterion: publish-time comment and `prd_status` values in all three publish copies
  - [ ] 6.6 Verify Acceptance Criterion: planner events in all three
  - [ ] 6.7 Verify Acceptance Criterion: Artifacts updates by plan and planner
  - [ ] 6.8 Run Tests: `pnpm run test:unit`, `pnpm run validate`; dogfood: post the first PRD status comment on #289 for wave 2 as `in progress` from this story's own branch, per the new rule, and report it

## Decisions Consumed

| ID   | Decision (short form)                                                       |
| ---- | --------------------------------------------------------------------------- |
| D-34 | One parity test file, existing helpers.                                     |
| D-36 | Tracking issues found by `level:` label plus title prefix.                  |
| D-50 | Only a PR against the default branch links an issue.                        |
| D-52 | Force-add and commit the state file after every merge.                      |
| D-53 | The wave status comment replaces the per-merge comment.                     |
| D-54 | Nobody closes a story; GitHub closes it at ship.                            |
| D-55 | Roadmap row from two `gh` commands, cited in the PR body.                   |
| D-56 | `Closes` for every story and the wave; github-ops rule extended.            |
| D-57 | Rollup compares with the wave issue and sub-issues; merged PRs as fallback. |
| D-58 | State file archived at close-out.                                           |
| D-59 | Wave issue from the plan header, then search, then skip.                    |
| D-60 | Planner tree divergence left as is.                                         |
| D-61 | Phase 6 Close-out, triggered by the user's merge notice.                    |
| D-62 to D-70 | Design Mode resolutions (spec v1.1 §16a).                          |
