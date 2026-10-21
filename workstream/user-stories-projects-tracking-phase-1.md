# User Stories: projects-tracking — Wave 1, conventions and hierarchy

## Changelog

| Version | Date       | Summary                                                                                                                                      | Author                    |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1.1 | 2026-10-21 | Recorded intended deviations from the audits: S-004 AC-1 `wave_status` has four values (adds `failed(<reason>)`, S-003 DR-1); S-005 AC-3 accepts either template, keeps Auto-close as shipped (enabled) and makes field cleanup optional (D-45 to D-48); S-006 gained 6.1b to 6.1j from the audits and the Project 5 exercise. | product-engineer |
| 1.0     | 2026-10-20 | Initial story set from `workstream/specification-projects-tracking-phase-1.md` v1.0. Six stories; the PRD's seven candidates collapsed to six. | @llipe / product-engineer |

Source: `docs/requirements/prd-projects-tracking.md` v1.3 (wave 1: FR-1 to FR-10, FR-23, FR-24) · Specification v1.0 · Decisions `workstream/decisions-projects-tracking.md` D-01 to D-39.

Execution order: S-001 → S-002 → S-003 → S-004 → S-005 → S-006. S-002, S-003 and S-005 depend on S-001 only; S-004 depends on S-003; S-006 depends on all. Each story adds its own `describe` block to one shared parity test file (D-34), written before the prompt edits (test-first). Three-tree parity is part of every story's Definition of Done, not a separate story.

---

### Story S-001: github-ops conventions for tracking issues, level labels and the status comment

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** none

#### User Story

As a developer running dev-tasks,
I want github-ops to define the tracking-issue title forms, the `level:` labels, the retired stage labels and the single status-comment template,
So that every other agent has one convention to reference and nothing is restated across trees.

#### Context

Every later story references these rules by name (D-33, D-38). The experiment showed `type: story` colliding with `type: enhancement` and labels drifting from reality; this story settles both (D-03, D-07).

#### Acceptance Criteria

- [ ] AC-1: The Title Format table in all three github-ops copies carries two new rows, `PRD tracking issue` → `[PRD-<name>] <PRD title>` and `Wave tracking issue` → `[PRD-<name>] Wave <id>: <title>`, with one sentence stating that `<id>` is the wave's `Phase/Wave` cell in `docs/roadmap.md` (FR-1, D-04, D-32).
- [ ] AC-2: The Standardized Main Issue Tags table gains a **Level** category with `level: prd`, `level: wave`, `level: story` in one color family; the `status: ready` and `status: in-progress` rows are gone; `status: deferred` is present as a flag; the rule "Every issue MUST have at least one `type:` label and one `priority:` label" ends with "except issues labeled `level: prd` or `level: wave`" (FR-2, FR-7, D-05, D-31).
- [ ] AC-3: Issue Comments rules gain a **Status comment** subsection: line one is `<!-- dev-tasks:status -->`, line two is `🔄 Update:` with `Refs #<issue>`, then the story table (`Sub-tasks | Current | Branch | PR | Gates | Blocker | Updated`), the wave table (`Story | State | PR | Sub-task` plus current story, last merged PR, integration HEAD, gates) and the PRD table (`Wave | State | Wave issue`); the procedure "exactly one per issue, found by the marker, edited in place with `gh api -X PATCH`, every other comment append-only" (FR-23, D-12, D-25, D-26, D-33, D-37).
- [ ] AC-4: The `.github/` and `.kiro/` copies state "`gh` CLI is the primary execution path" in the same words as `.claude/` (D-16).
- [ ] AC-5: `test/unit/projects-tracking-parity.test.ts` exists with a `describe("github-ops")` block asserting AC-1 to AC-4 markers in all three trees, including the negative assertion that the taxonomy table contains no `status: ready` row (D-34).

#### Business Rules

- `type:` keeps its meaning; hierarchy lives only in `level:` (D-03).
- Tracking issues carry no `type:` or `priority:` (D-05).
- A status comment is one per issue, by marker, edited in place (D-25, D-26).

#### Technical Notes

- Sections and line ranges per tree: research artifact "Summary of Key Line Ranges" (github-ops Title Format 83–98 / 82–95 / 94–109; Tags 271–307 / 277–313 / 291–327; Comments 117–125 / 114–122 / 128–136).
- Parity pattern: `stripFrontmatter()` plus `toContain()` from `test/unit/skill-parity-init.test.ts:16-22`; section scoping with `splitIntoSections()` from `test/unit/claude-tool-declaration-parity.test.ts:77-94`.
- `SIMPLICITY.md` A5: the subsection explains why one copy, not what a comment is.

#### Testing Requirements

- **Unit Tests:** parity block per AC, three trees each; negative row assertion scoped to the Tags table section.
- **Integration Tests:** none.
- **Manual/UI Testing:** none.
- **Edge-Case Matrix:** a tree where the Tags table heading differs (`.kiro/` wording) still matches by the table's first header cell.
- **Acceptance-Criteria Mapping:** AC-1 → `it("title forms")`; AC-2 → `it("level labels and exemption")`, `it("no stage labels")`; AC-3 → `it("status comment subsection")`; AC-4 → `it("gh primary")`; AC-5 is the file itself.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable: no data model. Existing issues keep their labels until wave 3 (D-31).

#### Implementation Steps

1. Write the parity `describe` block; run it, confirm it fails on all three trees.
2. Edit `.claude/agents/github-ops.md`; copy the same edits to `.github/agents/github-ops.agent.md` and `.kiro/agents/github-ops.md`, aligning the MCP sentence.
3. Run the block until green; run `pnpm run validate`.

#### Files to Create/Modify

- `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md` — conventions.
- `test/unit/projects-tracking-parity.test.ts` — new, github-ops block.

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

### Story S-002: Publish creates the tracking-issue hierarchy and reuses it on later waves

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As a developer publishing a wave's stories,
I want publish to find or create the PRD and wave tracking issues and attach every story as a sub-issue,
So that the Project shows the hierarchy and a progress bar per wave with no extra work.

#### Context

The hierarchy is the one change that made "Projects alone can show progress" partly true in the experiment (D-02). Idempotent lookup by label plus title prefix lets wave 2 reuse wave 1's PRD issue and lets wave 3 migrate repositories that pre-date the convention (D-36).

#### Acceptance Criteria

- [ ] AC-1: Execution method rules in all three copies name `gh` as primary and MCP as optional, and the method is still recorded in the report (FR-9, D-16).
- [ ] AC-2: The clarifying question about a parent epic or project board is removed; the Process gains, before story creation, a find-or-create step for the PRD tracking issue and then the wave tracking issue using `gh issue list --label "level: prd" --search "[PRD-<name>] in:title" --state open` (and `level: wave` with the `Wave <id>:` prefix); one match reuses, zero creates, more than one stops and lists the numbers (FR-3, D-36).
- [ ] AC-3: The wave issue body template carries the scope line, `Integration branch: TBD`, an `## Artifacts` section with the spec and story-set paths as root-relative links and `Task plan: pending`, and a `## Stories` list; no checkboxes (FR-4, D-14).
- [ ] AC-4: After each story is created it is attached with `POST /repos/{o}/{r}/issues/{wave}/sub_issues`; the wave is attached under the PRD if not already; the hierarchy is verified with `GET .../sub_issues` and reported as `hierarchy: verified(<n> of <n>)` or `failed(<reason>)` (FR-3, D-02).
- [ ] AC-5: The publication report template gains `PRD issue`, `Wave issue` and `Hierarchy` lines under its header; Final Instructions mention the hierarchy (FR-3).
- [ ] AC-6: The parity file gains a `describe("activity-publish-github")` block asserting AC-1 to AC-5 markers in all three trees.

#### Business Rules

- The hierarchy is not optional; no question asks for it (FR-3).
- More than one matching tracking issue is a stop, never a pick (D-36).
- Every body goes through `--body-file`; inline `--body` is blocked by git-guard.

#### Technical Notes

- Child numeric id: `gh api repos/{o}/{r}/issues/{n} --jq .id`; sub-issue endpoints are REST with `repo` scope (spec §6).
- Sections per tree: research artifact file map (SKILL.md 32–50, 52–74, 76–102, 110–116 in `.claude/`; locate the same headings in `.github/` and `.kiro/`).
- Delegation to github-ops stays "whenever possible", with the fallback sentence unchanged.

#### Testing Requirements

- **Unit Tests:** parity block; negative assertion that the epic question is absent in all three trees.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood (D-39): wave 2's publish is the first real run; recorded in `TESTING.md` by S-006 and observed by the verifier rollup.
- **Edge-Case Matrix:** zero matches; one match; two matches (stop); wave issue exists but a story attach fails midway (report `failed`, do not retry silently); PRD with no numbered phases (`<id>` from roadmap cell).
- **Acceptance-Criteria Mapping:** AC-1 → `it("gh primary")`; AC-2 → `it("find-or-create")`, `it("no epic question")`; AC-3 → `it("wave body template")`; AC-4 → `it("sub-issue attach and verify")`; AC-5 → `it("report fields")`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Existing issues gain parents in wave 3 (D-19).

#### Implementation Steps

1. Write the parity block; confirm red.
2. Edit the three `activity-publish-github/SKILL.md` copies: execution rules, questions, process, body template, report template, final instructions.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/skills/activity-publish-github/SKILL.md`, `.github/skills/activity-publish-github/SKILL.md`, `.kiro/skills/activity-publish-github/SKILL.md`.
- `test/unit/projects-tracking-parity.test.ts` — publish block.

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

### Story S-003: Implement keeps a mandatory story status comment and updates the wave comment when it has no planner

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As a developer following a run from my phone,
I want the story issue to carry one status comment that says which sub-task is in progress, the branch, the PR, the gates and any blocker, updated before any merge,
So that I never open a workstream file to know where a story stands.

#### Context

Implement already keeps the issue checklist synced and only *should* add free-form comments (SKILL.md:124). This story makes the one comment mandatory, fixed in shape and edited in place (FR-23, D-25), and gives the main-thread developer the wave update it has no planner to do for it (FR-24).

#### Acceptance Criteria

- [ ] AC-1: In all three implement copies the optional progress-comment rule is replaced by "MUST keep the story's status comment current per github-ops § Status comment: create it at the first sub-task completion, edit it in place at every later sub-task completion, at PR open, at each gate recorded, and on block" (FR-23, D-38).
- [ ] AC-2: The procedure is stated: find by marker through `gh api repos/{o}/{r}/issues/{n}/comments --paginate`; absent → `gh issue comment {n} --body-file`; present → `gh api -X PATCH repos/{o}/{r}/issues/comments/{id} -F body=@file`; each write reported as `status_comment: written | failed(<reason>) | skipped(no issue)` (D-26, D-28, D-37).
- [ ] AC-3: The main-thread rule: after PR open and at PR ready, `GET repos/{o}/{r}/issues/{n}/parent`; 200 → edit this story's row in the wave's status comment; 404 → `wave_status: skipped(no parent)`; under the planner → `wave_status: owned-by-planner` (FR-24, D-29).
- [ ] AC-4: The checklist alignment rules (lines 104–118) are unchanged, and the lifecycle table gains a "During" entry naming the status comment (FR-23).
- [ ] AC-5: The parity file gains a `describe("implement")` block asserting AC-1 to AC-4 markers in `.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md` and `.kiro/steering/implement.md`.

#### Business Rules

- A failed write never blocks a sub-task; it is reported (spec §9).
- Bodies go through files, never inline (spec §12).
- Nothing in this story touches Project Status (D-23).

#### Technical Notes

- The implement counterpart differs per tree: skill, instruction (`applyTo`), steering (`fileMatchPattern`); frontmatter differs, the body rule text must match.
- Comment body template is referenced, not restated (D-33).

#### Testing Requirements

- **Unit Tests:** parity block; negative assertion that the old "SHOULD add brief issue or PR comments" sentence is gone from all three.
- **Integration Tests:** none.
- **Manual/UI Testing:** dogfood (D-39): this wave's own stories, implemented under `/developer`, are the first real run; S-006 records the satisfying issue in `TESTING.md`.
- **Edge-Case Matrix:** no issue (skip); two marked comments (edit the oldest, report `failed(duplicate marker)`); PATCH refused (report `failed`); parent 404; parent 200 but wave comment absent (create it, report `written`).
- **Acceptance-Criteria Mapping:** AC-1 → `it("mandatory rule")`; AC-2 → `it("procedure and report field")`; AC-3 → `it("main-thread wave update")`; AC-4 → `it("checklist rules unchanged")`, `it("lifecycle row")`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. A consumer's in-flight story gains the comment at its next sub-task (spec §16).

#### Implementation Steps

1. Write the parity block; confirm red.
2. Edit the three implement copies.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md`.
- `test/unit/projects-tracking-parity.test.ts` — implement block.

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

### Story S-004: Developer agent and command report the status-comment outcomes and define merged as merged to main

**Priority:** High
**Estimated Size:** S
**Dependencies:** S-003

#### User Story

As a planner parsing a developer's closeout,
I want the developer's completion report to carry `status_comment:` and `wave_status:` beside `checklist_sync:`,
So that wave 2's planner reads the status-comment outcome from the block it already parses.

#### Context

D-30 placed the two fields in the developer completion report (`.claude/agents/developer.md:376`); D-38 made the rule live in implement with the agent and the `/developer` command inheriting. The "do not close early" rule is reworded now so wave 2 does not touch the file again (spec §8.3).

#### Acceptance Criteria

- [ ] AC-1: The completion report block in `.claude/agents/developer.md`, `.github/agents/developer.agent.md` and `.kiro/agents/developer.md` gains `status_comment: written | failed(<reason>) | skipped(<reason>)` and `wave_status: written | skipped(<reason>) | owned-by-planner` beside `checklist_sync:` (FR-23, D-30).
- [ ] AC-2: Rule 6 reads "You MUST NOT close the issue; GitHub closes it when the consolidated PR merges to main" in all three (FR-13 wording, D-22).
- [ ] AC-3: The developer's pre-coding rules point to implement's status-comment procedure by name rather than restating it (D-38).
- [ ] AC-4: `test/unit/developer-command-collapse.test.ts` still passes, so `.claude/commands/developer.md` inherits the change; the parity file gains a `describe("developer")` block for AC-1 to AC-3.

#### Business Rules

- No agent closes a story issue (D-22).
- Report fields are never omitted; `skipped(<reason>)` is the floor (D-28).

#### Technical Notes

- Research artifact: developer rules 4 and 6 at lines 74–82; completion report at ~370–380 in `.claude/`; locate the same blocks in the other trees.

#### Testing Requirements

- **Unit Tests:** parity block; existing collapse test.
- **Integration Tests:** none.
- **Manual/UI Testing:** none beyond S-003's dogfood.
- **Edge-Case Matrix:** report emitted when the story has no issue (`skipped(no issue)` for both fields).
- **Acceptance-Criteria Mapping:** AC-1 → `it("report fields")`; AC-2 → `it("close rule")`; AC-3 → `it("pointer not copy")`; AC-4 → existing test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Parity block; red.
2. Edit the three developer agent files; confirm the command collapses.
3. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/agents/developer.md`, `.github/agents/developer.agent.md`, `.kiro/agents/developer.md`, and `.claude/commands/developer.md` only if the collapse test demands it.
- `test/unit/projects-tracking-parity.test.ts` — developer block.

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

### Story S-005: activity-init recommends a GitHub Project and ships the configuration runbook

**Priority:** Medium
**Estimated Size:** S
**Dependencies:** S-001

#### User Story

As a developer setting up a repository,
I want activity-init to recommend a GitHub Project and hand me a runbook that keeps GitHub's defaults and removes only the template noise,
So that setup takes minutes and nothing fights GitHub's own automations.

#### Context

D-10 and D-22 settled the setup: default Status options and automations kept, auto-add narrowed to `is:issue`, template fields deleted, three views by hand. The runbook must pass the docs-structure check (D-35) and ship in the same PR as the step (shared-understanding FR-49a).

#### Acceptance Criteria

- [ ] AC-1: All three `activity-init/SKILL.md` copies carry a "Repository Setup — GitHub Project (Recommended)" subsection after the Branch Protection one, with at most four sentences and a link to `docs/runbooks/runbook-configure-github-project.md` (FR-8).
- [ ] AC-2: The runbook exists with frontmatter `name`, `trigger`, `owner: product-engineer`, `last_verified: <date>`, `related: [docs/requirements/prd-projects-tracking.md]` in inline bracket form, and the seven sections of `templates/runbooks/runbook-template.md`; `tsx core/checks/run.ts` reports no docs-structure finding (D-35).
- [ ] AC-3: The runbook's steps are: `gh auth refresh -s project`; create the Project from the Board template; keep the default Status options and the item-added, item-closed, item-reopened and pull-request-linked automations, each named; set auto-add to `is:issue`; delete Priority, Size, Estimate, Start date, Target date; create three views with these filters: table grouped by Parent issue, board by Status filtered to one wave by `level:` and title, table filtered `label:"status: blocked"`; verify with `gh project view` and `gh project field-list` (FR-8, D-10). It contains no instruction to change a default automation (AC-5 of the PRD).
- [ ] AC-4: `docs/runbooks/README.md` gains the runbook's row.
- [ ] AC-5: The runbook has been exercised once on `llipe/dev-tasks`, creating its Project; the runbook's `last_verified` is that date and the PR body names the Project number (spec §14).
- [ ] AC-6: The parity file gains a `describe("activity-init")` block asserting the subsection and the runbook path in all three trees.

#### Business Rules

- Project setup is a one-time human step; no prompt file contains a `gh project` write (D-23, D-24).
- Runbook ships in the same PR (FR-49a).

#### Technical Notes

- Frontmatter parser is hand-written (`core/checks/docs-structure.ts:111-137`); use the inline `related: [...]` form.
- Views cannot be created through the API; the runbook says so and gives the filter strings.

#### Testing Requirements

- **Unit Tests:** parity block; `tsx core/checks/run.ts` green (runs under `lint`).
- **Integration Tests:** none.
- **Manual/UI Testing:** AC-5, the exercise on this repository; screenshot or `gh project view` output in the PR.
- **Edge-Case Matrix:** repository where Projects are disabled (runbook names the setting to enable); user project versus organization project (both covered by `--owner`).
- **Acceptance-Criteria Mapping:** AC-1, AC-6 → `it("init subsection")`; AC-2, AC-4 → lint; AC-3 → `it("runbook steps")` on the runbook file; AC-5 → PR body.
- **Execution Commands:** `pnpm run lint`, `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Parity block and runbook-content test; red.
2. Write the runbook from the template; add the README row; add the subsection in three trees.
3. Exercise the runbook on this repository; record the date and Project number.
4. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/skills/activity-init/SKILL.md`, `.github/skills/activity-init/SKILL.md`, `.kiro/skills/activity-init/SKILL.md`.
- `docs/runbooks/runbook-configure-github-project.md` — new.
- `docs/runbooks/README.md` — row.
- `test/unit/projects-tracking-parity.test.ts` — init block.

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

### Story S-006: Cross-tree guard against Project writes and the dogfood rows in TESTING.md

**Priority:** Medium
**Estimated Size:** XS
**Dependencies:** S-001, S-002, S-003, S-004, S-005

#### User Story

As a maintainer,
I want a test that fails if any prompt file in any tree ever contains a `gh project item-edit` or `gh project item-add` command, and a `TESTING.md` record of which issue proved each behavioural criterion,
So that the native status model stays native and the dogfood evidence is written down.

#### Context

D-23 is a promise with no enforcement until this test exists. D-39 made the behavioural criteria dogfood checks; `TESTING.md` is where the toolkit records manual and dogfood evidence.

#### Acceptance Criteria

- [ ] AC-1: The parity file gains a `describe("no Project writes")` block that walks every `.md` under `.claude/`, `.github/` and `.kiro/` and asserts none contains `gh project item-edit` or `gh project item-add` (PRD AC-3, D-23).
- [ ] AC-2: `TESTING.md` gains a "Dogfood checks" table with one row per behavioural criterion of wave 1: PRD AC-1 (hierarchy, satisfied by wave 2's publish, pending) and PRD AC-3 (story status comment, satisfied by this wave's own stories); each row names the satisfying issue number once observed, `pending` until then (D-39).
- [ ] AC-3: The rows for S-001 to S-005 of this wave are filled with their issue numbers at closure, since their own implementation under `/developer` is the AC-3 evidence.

#### Business Rules

- No agent writes Project Status; the test is the guard (D-23).
- `TESTING.md` is owned by qa-engineer; this story edits only the new table and adds a changelog row.

#### Technical Notes

- Walk with `readdirSync` recursive; exclude nothing, the guard is global.
- The `TESTING.md` changelog convention applies.

#### Testing Requirements

- **Unit Tests:** the guard block, plus a self-check fixture string containing `gh project item-edit` that the walker's matcher catches.
- **Integration Tests:** none.
- **Manual/UI Testing:** none.
- **Edge-Case Matrix:** a code fence quoting the forbidden command as an example (none exist after wave 1; the guard forbids it anywhere, so the runbook phrases setup steps without those two verbs).
- **Acceptance-Criteria Mapping:** AC-1 → `it("no gh project writes in any tree")`; AC-2, AC-3 → `TESTING.md` diff.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Guard block with the self-check; red on the fixture, green on the trees.
2. `TESTING.md` table and changelog row.
3. `pnpm run validate`.

#### Files to Create/Modify

- `test/unit/projects-tracking-parity.test.ts` — guard block.
- `TESTING.md` — Dogfood checks table, changelog row.

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

- **Total PRD Requirements (wave 1):** 12 functional (FR-1 to FR-10, FR-23, FR-24), 7 acceptance criteria (AC-1 to AC-7), 4 user stories (1, 2, 5, 7), 5 business rules
- **Total User Stories:** 6
- **Coverage:** 100% of wave 1 scope
- **Status:** Complete

### Requirement Mapping

| PRD Requirement                                   | Story ID(s)  | Status     |
| ------------------------------------------------- | ------------ | ---------- |
| FR-1 title forms                                  | S-001        | ✅ Covered |
| FR-2 `level:` labels and exemption                | S-001        | ✅ Covered |
| FR-3 publish creates hierarchy, no epic question  | S-002        | ✅ Covered |
| FR-4 wave issue body                              | S-002        | ✅ Covered |
| FR-5 withdrawn                                    | —            | ✅ N/A     |
| FR-6 no agent Status writes; `Closes` linking     | S-004, S-006 | ✅ Covered |
| FR-7 stage labels retired, flags kept             | S-001        | ✅ Covered |
| FR-8 activity-init step and runbook               | S-005        | ✅ Covered |
| FR-9 `gh` primary in publish                      | S-002        | ✅ Covered |
| FR-10 parity tests                                | S-001 to S-006 | ✅ Covered |
| FR-23 story status comment                        | S-003, S-004 | ✅ Covered |
| FR-24 main-thread wave update                     | S-003        | ✅ Covered |
| PRD AC-1 hierarchy (dogfood, wave 2)              | S-002, S-006 | ✅ Covered |
| PRD AC-2 tracking labels, exemption               | S-001        | ✅ Covered |
| PRD AC-3 no Project writes; story comment         | S-003, S-006 | ✅ Covered |
| PRD AC-4 taxonomy                                 | S-001        | ✅ Covered |
| PRD AC-5 runbook settings                         | S-005        | ✅ Covered |
| PRD AC-6 publish `gh` primary                     | S-002        | ✅ Covered |
| PRD AC-7 three-tree parity                        | S-001 to S-006 | ✅ Covered |
| User story 1 (hierarchy at publish)               | S-002        | ✅ Covered |
| User story 2 (Status by GitHub automations)       | S-005, S-006 | ✅ Covered |
| User story 5 (setup keeps defaults)               | S-005        | ✅ Covered |
| User story 7 (works without a Project)            | S-002, S-003 | ✅ Covered |
| Business rule: no agent writes Status             | S-006        | ✅ Covered |
| Business rule: closed by GitHub at ship           | S-004        | ✅ Covered |
| Business rule: containers carry no type/priority  | S-001        | ✅ Covered |
| Business rule: no `gh project` write in prompts   | S-006        | ✅ Covered |
| Business rule: one status comment, by marker      | S-001, S-003 | ✅ Covered |

### Gaps

None.

### Non-Goals Validation

- [x] Stage checklist or Stage field — not in any story (D-14)
- [x] `needs:` labels — not in any story (D-15)
- [x] Agent-written Project Status or Merged option — not in any story; S-006 guards against it (D-22, D-23)
- [x] Closing a story at integration merge — S-004 forbids it (D-22)
- [x] `docs/tech.md` Project section — not in any story (D-24)
- [x] Milestones per wave, integration branch naming, automated views, organization issue types — not in any story
- [x] Planner, verifier and migration changes — wave 2 and wave 3, not in any story
