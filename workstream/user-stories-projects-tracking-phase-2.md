# User Stories: projects-tracking — Wave 2, planner and verifier

## Changelog

| Version | Date       | Summary                                                                                                         | Author                    |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1.1     | 2026-10-22 | Rollup RD-4 (#308): S-008, S-009 and S-010 annotated where spec §16a and D-71 supersede their ACs; no AC text rewritten. | product-engineer |
| 1.0     | 2026-10-21 | Initial story set from `workstream/specification-projects-tracking-phase-2.md` v1.0. Six stories, PRD ids kept. | @llipe / product-engineer |

Source: `docs/requirements/prd-projects-tracking.md` v1.6 (wave 2: FR-11 to FR-16, FR-25; #285) · Specification v1.0 · Decisions `workstream/decisions-projects-tracking.md` D-01 to D-61.

Execution order: S-008 → S-009 → S-010 → S-011 → S-012 → S-018. S-009, S-010 and S-011 depend on S-008; S-018 depends on S-009 and S-011; S-012 is independent. Each story adds its `describe` block or extension to `test/unit/projects-tracking-parity.test.ts` before editing prompts (D-34). Three-tree parity is part of every Definition of Done; the planner's three copies are `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`, and their pre-existing wording differences on merge gates 5, 6 and 13 stay (D-60).

---

### Story S-008: The planner knows its wave issue and commits its checkpoint after every merge

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** none

#### User Story

As a developer following a planner run from GitHub,
I want the planner to resolve the wave tracking issue at start and commit its state file on the integration branch after every merge,
So that the run's position is readable from the branch and every later write knows which issue is the wave.

#### Context

Wave 1's checkpoint reached GitHub only because the planner force-added it by hand each time (D-52); riel's checkpoint never reached GitHub at all. The wave issue number is the key every other wave 2 story needs (D-59).

#### Acceptance Criteria

> **Annotated v1.1 (RD-4).** AC-3's resume also backfills: a state file written before the `Wave issue` line existed has the wave issue resolved again by Phase 0's order and the line added (EC-48, S-008 DR-1). This overlaps FR-21 only for planner state files; wave 3's migration still covers issues and docs. The story's Migration Requirements line "Existing state files gain the line in wave 3" is superseded by that resume step.

- [ ] AC-1: The `plan` skill's Output Format header in all three trees carries `Wave issue: #N` after `Source:`, read from the publication report's `Wave issue` line, or `Wave issue: none` with a note that the planner will search when the report has none (D-59).
- [ ] AC-2: The planner's Phase 0 in all three copies resolves the wave issue in this order: the plan header line; else `gh issue list --label "level: wave"` with the `[PRD-<name>] Wave <id>:` title prefix and a client-side `startswith` filter, reusing a single match; else `wave_status: skipped(no wave issue)` (D-59, D-36).
- [ ] AC-3: The State File Format's Run Info gains `Wave issue: #N | none` after `Repository`, Phase 0.5 resume reads it, and the Phase 4 handoff template passes `Wave issue: #N | none` to the developer (FR-11, D-59).
- [ ] AC-4: Merge rule step 13 commits the state file on the integration branch in the same step that writes it, with `git add -f` so an ignored `workstream/` still commits, message `chore(planner): checkpoint after <story> merge`, then pushes (FR-11, D-52).
- [ ] AC-5: The parity file gains `describe("plan")` and `describe("planner")` blocks asserting AC-1 to AC-4 markers in all three copies, with `loadTrees` taking explicit paths for the planner (one command, two agents) and the plan files (skill, instruction, steering).

#### Business Rules

- The wave issue is resolved once per run and recorded in the state file; every later story reads it from there (D-59).
- A checkpoint that is not committed is not a checkpoint (D-11, D-52).

#### Technical Notes

- Line ranges per tree: research artifact file map (planner Phase 0.5 at `.claude/commands/planner.md:148-194`, `.github:139-184`, `.kiro:176-221`; handoff and merge rule at `325-472`, `316-459`, `353-500`).
- `plan` copies: `.claude/skills/plan/SKILL.md`, `.github/instructions/plan.instructions.md`, `.kiro/steering/plan.md`; frontmatter differs, body matches.

#### Testing Requirements

- **Unit Tests:** parity blocks per AC; negative: the old step 13 has no `git add` today, so the positive marker is the whole test.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood on this wave's own run: the state file appears on the integration branch after the first merge; `Wave issue: #<n>` in its Run Info.
- **Edge-Case Matrix:** plan header `Wave issue: none` with a matching search result (search wins, recorded); two search matches (stop and ask, D-36); repository that tracks `workstream/` (`git add -f` is harmless); push rejected (report, retry once, then blocked).
- **Acceptance-Criteria Mapping:** AC-1 → `plan > wave issue header`; AC-2 → `planner > wave issue discovery`; AC-3 → `planner > state file and handoff carry the wave issue`; AC-4 → `planner > checkpoint commit`; AC-5 is the file.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Existing state files gain the line in wave 3 (FR-21).

#### Implementation Steps

1. Parity blocks for plan and planner; red.
2. Edit the three plan copies; edit the three planner copies: Phase 0, State File Format, handoff template, step 13.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/skills/plan/SKILL.md`, `.github/instructions/plan.instructions.md`, `.kiro/steering/plan.md`
- `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`
- `test/unit/projects-tracking-parity.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-009: The planner keeps the wave issue's status comment current and stops posting per-merge comments

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-008

#### User Story

As a developer following a planner run from my phone,
I want one status comment on the wave issue that shows every story's state, the current story, the last merged PR, the integration head and the gates, updated at every event,
So that I never read a workstream file to know where the run stands.

#### Context

Wave 1 posted six status-table comments on six different story issues because no wave issue existed; the run's picture was scattered. FR-12 and D-53 move it to one comment, edited in place with the procedure implement already defines.

#### Acceptance Criteria

> **Annotated v1.1 (RD-4).** AC-1's timing is superseded by spec §16a (D-70): the comment is created at run start after Phase 3 pre-flight, not at the end of Phase 0, and the rollup summary, the consolidated-PR open and the close-out also edit it, nine events in all. The developer-closeout edit is made before the merge gates and checked by merge gate 10 (D-71).

- [ ] AC-1: In all three planner copies, the wave status comment is created at the end of Phase 0 (or Phase 0.5 on resume) when a wave issue exists, and edited in place at every story start, every developer closeout, every merge (step 13) and on block, using implement § Status Comment's find-by-marker, create and PATCH procedure and github-ops's wave table: `Story | State | PR | Sub-task`, plus `Current story`, `Last merged PR`, `Integration HEAD`, `Gates` (FR-12, D-53).
- [ ] AC-2: The sentence in step 13 that posts "a GitHub Issue comment on the plan/milestone issue with the current story status table" is gone from all three copies; the Invariants line "post a GitHub comment with status" reads "edit the wave status comment" (D-53).
- [ ] AC-3: When no wave issue exists, every comment write reports `wave_status: skipped(no wave issue)` in the state file's Decisions Log and the run summary; a refused PATCH reports `wave_status: failed(<reason>)` and never blocks the merge (D-53).
- [ ] AC-4: The parity `planner` block gains assertions for AC-1 to AC-3 markers and the negative on the removed sentence.

#### Business Rules

- One comment per wave issue, by marker, edited in place (D-25, D-26).
- A failed comment write never blocks a merge gate (spec §9).

#### Technical Notes

- Reference implement § Status Comment and github-ops § Status comment by name; do not restate the tables (D-33).
- Story state vocabulary in the wave table: `pending`, `in progress (sub-task n of m)`, `PR open`, `merged into integration`, `blocked`.

#### Testing Requirements

- **Unit Tests:** parity assertions; negative on the old per-merge comment sentence in all three.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood on this wave's run: exactly one marker comment on the wave issue, `updated_at` advancing after each merge, table rows matching the state file.
- **Edge-Case Matrix:** two marked comments on the wave issue (edit the oldest, report `failed(duplicate marker)`); resume from checkpoint (edit, not create); block mid-story (row reads `blocked` with the reason).
- **Acceptance-Criteria Mapping:** AC-1 → `planner > wave status comment events`; AC-2 → `planner > no per-merge comment`; AC-3 → `planner > wave_status report values`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Parity assertions; red.
2. Edit the three planner copies: Phase 0 end, Phase 4 story start and closeout, step 13, block handling, Invariants.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`
- `test/unit/projects-tracking-parity.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-010: Nobody closes a story; the consolidated PR closes every story and the wave at ship

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-008

#### User Story

As a developer trusting the Project board,
I want story issues to close only when the consolidated PR merges to main, carrying `Closes` for every story and the wave,
So that Done means on main and GitHub's own automations move Status with no agent write.

#### Context

GitHub links a PR to an issue only when the PR's base is the default branch (D-50, #285). Under the planner the consolidated PR is therefore the one PR that moves Status and closes issues. Wave 1's consolidated PR #282 did this by hand; this story makes it the rule and removes the last agent-side closing text (D-54, D-56).

#### Acceptance Criteria

> **Annotated v1.1 (RD-4).** Spec §16a supersedes three ACs. AC-2 and AC-4: `Closes #N` only for merged stories, `Refs #N` with the reason for unmerged ones, `Closes #<wave>` only when every story merged, all under `## Why` rather than `## What` (D-67). AC-3: "when a Project is configured" means `gh issue view <n> --json projectItems` returns an item, and the Status comes from that read (D-68).

- [ ] AC-1: All three planner copies state under the merge rule that the planner never closes a story issue; it closes when the consolidated PR merges to main (FR-13, D-54).
- [ ] AC-2: Phase 5's consolidated-PR step and the "Consolidated PR should include" list require `Closes #N` for every story in the state table and `Closes #<wave issue>` when a wave issue exists, generated from the state table, with `Refs` for everything else (FR-15, D-56).
- [ ] AC-3: After opening the consolidated PR, when a Project is configured, the planner reads one story's Project Status and records `project_observation: observed | not observed(<reason>)` for "In progress at consolidated PR open" in the PR body and in `TESTING.md`'s DF-5 row (#285).
- [ ] AC-4: github-ops's `## Why` rule in all three copies gains the consolidated-PR sentence: `Closes #<number>` for every story issue it delivers and for the wave tracking issue (D-56).
- [ ] AC-5: implement's rules 12 and 13, the lifecycle row "Then close issue" and Final Instruction 5 in all three copies say nobody closes the issue; it closes when a PR against the default branch carrying `Closes #N` merges, the consolidated PR under the planner or the story PR itself in a main-thread run (D-54).
- [ ] AC-6: The parity file extends the `planner`, `github-ops` and `implement` blocks for AC-1 to AC-5, including negatives on "Then close issue" and on the old rules 12 and 13 wording.

#### Business Rules

- No agent closes a story or wave issue (D-22, D-54).
- The consolidated PR is the only PR that may carry `Closes` for more than one issue (D-56).

#### Technical Notes

- github-ops `## Why` rule: `.claude/agents/github-ops.md:257` and its counterparts.
- implement rules 12 to 13: `.claude/skills/implement/SKILL.md` Before Closing section; lifecycle table row; Final Instruction 5.
- The Project read is `gh project item-list <n> --owner <o> --format json`, read only; the project number comes from `docs/roadmap.md` or the runbook's exercise record when present; `not observed(no project)` otherwise.

#### Testing Requirements

- **Unit Tests:** parity assertions; negatives in all three implement copies.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood on this wave's run: the consolidated PR body carries one `Closes` per story and one for the wave; Project 5 shows the stories In progress after it opens and Done after it merges.
- **Edge-Case Matrix:** no wave issue (no `Closes #<wave>`, note in the body); a story blocked and not merged (no `Closes` for it; `Refs` instead with the reason); Project not configured (`not observed(no project)`).
- **Acceptance-Criteria Mapping:** AC-1 → `planner > never closes`; AC-2 → `planner > consolidated PR Closes lines`; AC-3 → `planner > DF-5 observation`; AC-4 → `github-ops > consolidated PR Why rule`; AC-5 → `implement > nobody closes`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Parity assertions; red.
2. Edit the three planner copies (merge rule sentence, Phase 5 step 7 and the include list, DF-5 observation), the three github-ops copies, the three implement copies.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`
- `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md`
- `.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md`
- `test/unit/projects-tracking-parity.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-011: The planner derives the roadmap row from gh and closes out the run when the user reports the merge

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-008

#### User Story

As a developer who merges consolidated PRs,
I want the planner to write the roadmap row from `gh` evidence and, when I say the PR merged, to finish the run with a close-out that sets Done, archives its state and opens one small PR,
So that the roadmap never claims a state that ended a day earlier and nothing is left for me to tidy by hand.

#### Context

All four roadmap errors in the riel experiment were rows written before an event (D-13). Wave 1's close-out was improvised in PR #283 (D-58, D-61). This story makes both a procedure.

#### Acceptance Criteria

- [ ] AC-1: Phase 5 step 5 in all three planner copies derives the row: `Status` `In progress`; `Issues/PRs` from `gh issue list --search "[PRD-<name>] in:title" --state all --json number,state` and `gh pr list --base <integration branch> --state merged --json number`; `What's missing` names the consolidated PR; the two commands are cited verbatim in the PR body's Roadmap section (FR-14, D-55).
- [ ] AC-2: A new `## Phase 6 - Close-out` in all three copies, triggered by the user reporting the merge, with these steps in order: `gh pr view <n> --json state,mergedAt` must show `MERGED`, else stop; pull main; delete the integration branch locally and remotely; confirm every story issue and the wave issue are closed; when a Project is configured, read its items and confirm Done, else `not observed(no project)`; set the roadmap row to `Done` with `Issues/PRs` naming stories, story PRs and the consolidated PR and `What's missing` `—`; move the state file to `workstream/archive/planner-state-<plan-id>-archived.md`; record the DF-5 Done observation in `TESTING.md`; edit the PRD status comment so the wave reads shipped (S-018 provides the comment); open one `chore(roadmap)` PR to main (FR-14, D-55, D-58, D-61).
- [ ] AC-3: Phase 5 step 9 says "then run Phase 6"; the Output Contract and the Invariants state the run is complete only after Phase 6.
- [ ] AC-4: The parity `planner` block asserts the two commands, `## Phase 6`, the `MERGED` check, the archive path, and the completion invariant in all three copies.

#### Business Rules

- The roadmap row is derived, never typed from memory (D-13, D-55).
- Close-out opens a PR; the planner never commits to main (merge authority unchanged).

#### Technical Notes

- Phase 5 per tree: `.claude/commands/planner.md:487-527`, `.github:478-516`, `.kiro:515-553`; Roadmap Maintenance and Invariants follow.
- Project number source for the read: the runbook's exercise record (Project 5 for this repository) or `docs/roadmap.md`; the read is optional.

#### Testing Requirements

- **Unit Tests:** parity assertions.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood on this wave's run: the consolidated PR's Roadmap section cites both commands; after your merge notice, the close-out PR appears with the row `Done` and the archived state file.
- **Edge-Case Matrix:** `gh pr view` shows OPEN (stop, report); a story issue still open after merge (report, do not close it); Project read refused (`not observed(<reason>)`); roadmap row absent (ask product-engineer, do not invent).
- **Acceptance-Criteria Mapping:** AC-1 → `planner > roadmap commands`; AC-2 → `planner > phase 6 steps`; AC-3 → `planner > run completes at phase 6`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Parity assertions; red.
2. Edit the three planner copies: step 5, step 9, Phase 6, Roadmap Maintenance, Output Contract, Invariants.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`
- `test/unit/projects-tracking-parity.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-012: The verifier's rollup compares the roadmap row with the wave issue and its sub-issues

**Priority:** Medium
**Estimated Size:** S
**Dependencies:** none

#### User Story

As a developer relying on the rollup audit,
I want the roadmap-mismatch finding to compare the row with the wave tracking issue and its sub-issues when one exists,
So that the comparison target is the same object the Project shows, and merged PRs remain the fallback for waves without one.

#### Context

The finding today compares the row with "the delivered tree" and merged PRs. With a wave issue, the sub-issues' states are the authoritative story list (D-57, FR-16).

#### Acceptance Criteria

- [ ] AC-1: In all three verifier copies, the Roadmap-Mismatch Finding's triggers 1 and 4 compare the row with the wave tracking issue and its sub-issues when a wave issue exists, found by the D-36 search, reading `GET /repos/{o}/{r}/issues/{wave}/sub_issues` for the numbers and states; without a wave issue the existing comparison against merged PRs stands (FR-16, D-57).
- [ ] AC-2: The finding remains advisory and routes to product-engineer as today.
- [ ] AC-3: The parity file gains `describe("verifier")` asserting the sub-issue comparison and the fallback sentence in all three copies.

#### Business Rules

- Advisory, never blocking (CLAUDE.md verifier rule).

#### Technical Notes

- Roadmap-Mismatch Finding: `.claude/agents/verifier.md:250-262`, `.github/agents/verifier.agent.md:248-261`, `.kiro/agents/verifier.md` equivalent.

#### Testing Requirements

- **Unit Tests:** parity block.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood on this wave's rollup: the finding cites the wave issue and its sub-issue states.
- **Edge-Case Matrix:** two wave issues match (report, compare with neither); wave issue with zero sub-issues (fallback to PRs, note).
- **Acceptance-Criteria Mapping:** AC-1 → `verifier > sub-issue comparison`, `verifier > fallback`; AC-2 → `verifier > advisory unchanged`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Parity block; red.
2. Edit the three verifier copies.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/agents/verifier.md`, `.github/agents/verifier.agent.md`, `.kiro/agents/verifier.md`
- `test/unit/projects-tracking-parity.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-018: The PRD issue carries one status comment updated at wave events

**Priority:** Medium
**Estimated Size:** S
**Dependencies:** S-009, S-011

#### User Story

As a stakeholder opening the PRD's tracking issue,
I want one comment listing every wave with its state and a link to its wave issue,
So that the PRD-level picture is on GitHub without opening the roadmap.

#### Context

FR-25 names four events: publish (product-engineer), run start, consolidated PR open, and shipped (planner). The last is the close-out of S-011 (D-61). The comment uses github-ops's PRD table and implement's edit procedure.

#### Acceptance Criteria

- [ ] AC-1: activity-publish-github in all three copies, after the hierarchy is verified, creates or edits the PRD tracking issue's status comment per github-ops's PRD table (`Wave | State | Wave issue`) with the published wave's row `published`, reporting `prd_status: written | failed(<reason>) | skipped(no PRD issue)` in the publication report (FR-25).
- [ ] AC-2: The planner edits the same comment at run start (`in progress`), at consolidated PR open (`consolidated PR #n open`), and at close-out (`shipped`), in all three copies, reporting `prd_status` in the state file (FR-25, D-61).
- [ ] AC-3: The wave issue body's Artifacts section is updated by the agent that produces an artifact: `plan` sets `Task plan:` to the plan path, the planner sets the fidelity report path at Phase 5 (FR-25).
- [ ] AC-4: The parity file extends the `activity-publish-github`, `planner` and `plan` blocks for AC-1 to AC-3.

#### Business Rules

- One comment per PRD issue, by marker, edited in place (D-25, D-26).
- The PRD comment is a summary; the wave comment is the detail.

#### Technical Notes

- PRD table and marker: github-ops § Status comment. Procedure: implement § Status Comment.
- The PRD issue number comes from the publication report's `PRD issue` line, else the D-36 search with `level: prd`.

#### Testing Requirements

- **Unit Tests:** parity assertions.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood: after this wave's publish, the PRD issue carries one marker comment with the wave row `published`; after the planner run, `in progress`, then `consolidated PR #n open`, then `shipped`.
- **Edge-Case Matrix:** no PRD issue (`skipped(no PRD issue)`); a wave row already present (edit it, do not add a second); artifact path absent (leave `pending`).
- **Acceptance-Criteria Mapping:** AC-1 → `activity-publish-github > PRD status comment`; AC-2 → `planner > PRD status comment events`; AC-3 → `plan > artifacts task plan line`, `planner > artifacts fidelity report line`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Parity assertions; red.
2. Edit the three publish copies, the three planner copies, the three plan copies.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/skills/activity-publish-github/SKILL.md`, `.github/skills/activity-publish-github/SKILL.md`, `.kiro/skills/activity-publish-github/SKILL.md`
- `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`
- `.claude/skills/plan/SKILL.md`, `.github/instructions/plan.instructions.md`, `.kiro/steering/plan.md`
- `test/unit/projects-tracking-parity.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

## Coverage Validation

### Summary

- **Total PRD Requirements (wave 2):** 7 functional (FR-11 to FR-16, FR-25), 4 acceptance criteria (AC-8, AC-9, AC-10, AC-15), 4 follow-up criteria (#285), 3 user stories (3, 4, 7), 3 business rules
- **Total User Stories:** 6
- **Coverage:** 100% of wave 2 scope
- **Status:** Complete

### Requirement Mapping

| PRD Requirement                                       | Story ID(s)         | Status     |
| ----------------------------------------------------- | ------------------- | ---------- |
| FR-11 committed checkpoint                            | S-008               | ✅ Covered |
| FR-12 wave status comment                             | S-009               | ✅ Covered |
| FR-13 planner never closes                            | S-010               | ✅ Covered |
| FR-14 roadmap row from `gh`                           | S-011               | ✅ Covered |
| FR-15 `Closes` for every story and the wave           | S-010               | ✅ Covered |
| FR-16 verifier rollup target                          | S-012               | ✅ Covered |
| FR-25 PRD status comment and Artifacts updates        | S-018               | ✅ Covered |
| PRD AC-8 state file and one wave comment              | S-008, S-009        | ✅ Covered |
| PRD AC-9 `Closes` lines and cited commands            | S-010, S-011        | ✅ Covered |
| PRD AC-10 rollup advisory on mismatch                 | S-012               | ✅ Covered |
| PRD AC-15 PRD comment after publish and run start     | S-018               | ✅ Covered |
| #285 AC-1 spec documents D-50                         | spec v1.0 §6, §8.2  | ✅ Covered |
| #285 AC-2 consolidated PR requires `Closes`           | S-010               | ✅ Covered |
| #285 AC-3 DF-5 In progress observation                | S-010               | ✅ Covered |
| #285 AC-4 spec cites D-50                             | spec v1.0           | ✅ Covered |
| User story 3 (status comments before merge)           | S-009, S-018        | ✅ Covered |
| User story 4 (roadmap from GitHub at batch end)       | S-011               | ✅ Covered |
| User story 7 (works without a Project)                | S-008, S-010, S-011 | ✅ Covered |
| Business rule: no agent writes Status                 | S-010               | ✅ Covered |
| Business rule: closed by GitHub at ship               | S-010               | ✅ Covered |
| Business rule: roadmap row derived at batch boundary  | S-011               | ✅ Covered |

### Gaps

None.

### Non-Goals Validation

- [x] Agent-written Project Status, Merged option — no story writes Status; S-010 reads it once, read only
- [x] Stage checklist, Stage field, `needs:` labels — absent
- [x] Milestones per wave, integration branch renaming — absent; S-008 records whatever branch the planner uses
- [x] Migration of existing repositories — wave 3, not in any story
- [x] Planner merge-gate divergence across trees — left as is (D-60)
