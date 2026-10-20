# Implementation Plan - projects-tracking Wave 1 (conventions and hierarchy)

Source: `workstream/user-stories-projects-tracking-phase-1.md` v1.0 — all 6 stories selected (#270 to #275).
Spec: `workstream/specification-projects-tracking-phase-1.md` v1.0
Decisions: `workstream/decisions-projects-tracking.md` (D-01 to D-39)
Research: `workstream/research-projects-tracking-phase-1.md`
Repository shape: single-package — package brackets omitted per `docs/tech.md`.
Order: 1.0 → 2.0 → 3.0 → 4.0 → 5.0 → 6.0. One shared parity test file; each story adds its `describe` block first (test-first, D-34).

## Relevant Files

- `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md` - Title forms, Level labels, retired stage labels, Status comment subsection, `gh` primary sentence (S-001)
- `.claude/skills/activity-publish-github/SKILL.md`, `.github/skills/activity-publish-github/SKILL.md`, `.kiro/skills/activity-publish-github/SKILL.md` - Find-or-create tracking issues, sub-issue attach and verify, wave body template, report fields (S-002)
- `.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md` - Mandatory story status comment procedure, main-thread wave update (S-003)
- `.claude/agents/developer.md`, `.github/agents/developer.agent.md`, `.kiro/agents/developer.md` - Report fields `status_comment`, `wave_status`; close rule; pointer to implement (S-004)
- `.claude/commands/developer.md` - Only if `developer-command-collapse.test.ts` requires it (S-004)
- `.claude/skills/activity-init/SKILL.md`, `.github/skills/activity-init/SKILL.md`, `.kiro/skills/activity-init/SKILL.md` - "Repository Setup — GitHub Project (Recommended)" subsection (S-005)
- `docs/runbooks/runbook-configure-github-project.md` - New runbook (S-005)
- `docs/runbooks/README.md` - Runbook row (S-005)
- `TESTING.md` - Dogfood checks table and changelog row (S-006)
- `test/unit/projects-tracking-parity.test.ts` - New; one `describe` per story plus the no-Project-writes guard (all)
- `test/unit/skill-parity-init.test.ts` - Heading pin 16 → 17 (S-005, A-1)
- `test/unit/runbook-set.test.ts` - New runbook in `EXPECTED_RUNBOOKS` (S-005, A-2)

## Tasks

- [x] 1.0 Implement Story S-001: github-ops conventions for tracking issues, level labels and the status comment (#270)

  - [x] 1.1 Create `test/unit/projects-tracking-parity.test.ts` with `stripFrontmatter()` and `splitIntoSections()` helpers copied from the existing parity tests, and a `describe("github-ops")` block asserting the two title rows, the three `level:` labels, the exemption sentence, the absence of a `status: ready` row in the Tags table, the Status comment subsection marker and the `gh` primary sentence in all three trees; run `pnpm run test:unit` and confirm red (D-34)
  - [x] 1.2 Add the `PRD tracking issue` and `Wave tracking issue` rows to the Title Format table in `.claude/agents/github-ops.md`, with the sentence that `<id>` is the roadmap's Phase/Wave cell (D-04, D-32)
  - [x] 1.3 Add the Level category with `level: prd`, `level: wave`, `level: story` in one color family; remove the `status: ready` and `status: in-progress` rows; add `status: deferred`; extend the type/priority rule with the `level: prd` / `level: wave` exemption (D-03, D-05, D-07, D-31)
  - [x] 1.4 Add the **Status comment** subsection under Issue Comments: marker line, `🔄 Update:` line with `Refs #<issue>`, the story, wave and PRD tables, and the one-per-issue, find-by-marker, PATCH-in-place, append-only-otherwise procedure (D-12, D-25, D-26, D-33, D-37)
  - [x] 1.4a Replace the phrase "progress comment" wherever github-ops uses it (for example "Long-form progress comments") with "status comment" or neutral wording; the glossary forbids it as a synonym (Design Mode A-10)
  - [x] 1.5 Apply the same edits to `.github/agents/github-ops.agent.md` and `.kiro/agents/github-ops.md`, and replace their "GitHub MCP SHOULD be used" sentence with the `.claude/` wording "`gh` CLI is the primary execution path" (D-16)
  - [x] 1.5a In the `.github/` and `.kiro/` github-ops copies, align every passage that makes MCP primary (the Identity sentence, the fallback heading, the table intro, the Multi-Line Body items, rule 8) to `gh` primary with MCP optional, so the file does not contradict itself; keep what `git-guard-mcp.test.ts` and `infra-engineer-parity.test.ts` require (Design Mode A-3, D-41)
  - [x] 1.6 Verify Acceptance Criterion: title rows present in all three trees with the `<id>` sentence
  - [x] 1.7 Verify Acceptance Criterion: Level labels, exemption sentence, no stage-label rows, `status: deferred` present
  - [x] 1.8 Verify Acceptance Criterion: Status comment subsection with marker, prefix line, three tables and procedure
  - [x] 1.9 Verify Acceptance Criterion: `gh` primary sentence identical in all three trees
  - [x] 1.10 Run Tests: `pnpm run test:unit` green, then `pnpm run validate`; map AC-1 to AC-5 to the `it` names in the PR body

- [x] 2.0 Implement Story S-002: Publish creates the tracking-issue hierarchy and reuses it on later waves (#271)

  - [x] 2.1 Add a `describe("activity-publish-github")` block asserting the `gh` primary rule, the absence of the parent-epic question, the find-or-create step with the `gh issue list --label "level: prd"` search, the wave body template headings, the sub-issue attach and verify sentence with `hierarchy:` reporting, and the three report lines, in all three trees; confirm red
  - [x] 2.2 Rewrite the execution-method rules to name `gh` as primary and MCP as optional, keeping the recorded-method rule (D-16)
  - [x] 2.3 Remove the parent-epic clarifying question; add the find-or-create step for the PRD and wave tracking issues before story creation: one match reuses, zero creates, more than one stops and lists the numbers (D-02, D-36)
  - [x] 2.3a Filter the search result client-side with `--jq` on `startswith("[PRD-<name>]")` before counting matches, since GitHub's `in:title` search tokenises leniently (Design Mode A-13)
  - [x] 2.4 Add the wave issue body template: scope line, `Integration branch: TBD`, `## Artifacts` with spec and story-set links and `Task plan: pending`, `## Stories` list, no checkboxes (D-14)
  - [x] 2.5 Add the per-story sub-issue attach (`POST .../sub_issues` with the child's numeric id), the wave-under-PRD attach, the `GET .../sub_issues` verification and the `hierarchy: verified(<n> of <n>) | failed(<reason>)` report line; all bodies via `--body-file` (D-02)
  - [x] 2.6 Add `PRD issue`, `Wave issue` and `Hierarchy` lines to the publication report template and a hierarchy sentence to Final Instructions
  - [x] 2.7 Apply the same edits to the `.github/` and `.kiro/` copies
  - [x] 2.8 Verify Acceptance Criterion: `gh` primary and method recorded
  - [x] 2.9 Verify Acceptance Criterion: epic question gone; find-or-create step with the three outcomes
  - [x] 2.10 Verify Acceptance Criterion: wave body template as specified
  - [x] 2.11 Verify Acceptance Criterion: attach, verify and `hierarchy:` report
  - [x] 2.12 Verify Acceptance Criterion: report template lines
  - [x] 2.13 Run Tests: `pnpm run test:unit`, `pnpm run validate`; record in the PR body that AC-1 of the PRD (live hierarchy) is dogfood for wave 2's publish (D-39)

- [x] 3.0 Implement Story S-003: Implement keeps a mandatory story status comment and updates the wave comment when it has no planner (#272)

  - [x] 3.1 Add a `describe("implement")` block asserting the MUST sentence, the find/create/PATCH procedure with the `status_comment:` report values, the main-thread parent lookup with `wave_status:` values, the unchanged checklist rules and the lifecycle "During" entry, and the absence of the old "SHOULD add brief issue or PR comments" sentence, across the skill, the instruction and the steering file; confirm red
  - [x] 3.2 Replace the optional progress-comment rule in `.claude/skills/implement/SKILL.md` with the mandatory status-comment rule referencing github-ops § Status comment, with its event list (D-25, D-38)
  - [x] 3.2a Replace "progress comment" in implement's Final Instructions with "status comment" (Design Mode A-10)
  - [x] 3.3 Add the procedure: find by marker via `gh api .../comments --paginate`; create with `gh issue comment --body-file`; edit with `gh api -X PATCH ... -F body=@file`; report `status_comment: written | failed(<reason>) | skipped(no issue)` (D-26, D-28, D-37)
  - [x] 3.3a State the duplicate case: two comments carry the marker → edit the oldest and report `status_comment: failed(duplicate marker)` (Design Mode A-8)
  - [x] 3.4 Add the main-thread rule: after PR open and at PR ready, `GET .../issues/{n}/parent`; 200 edits this story's row in the wave comment; 404 reports `wave_status: skipped(no parent)`; under the planner `wave_status: owned-by-planner` (D-29)
  - [x] 3.4a State the missing-comment case: parent found but the wave has no status comment → create it from the wave table and report `wave_status: written` (Design Mode A-8)
  - [x] 3.5 Add the lifecycle table "During" entry naming the status comment; leave the checklist alignment rules untouched
  - [x] 3.6 Apply the same body text to `.github/instructions/implement.instructions.md` and `.kiro/steering/implement.md`, keeping each file's own frontmatter
  - [x] 3.7 Verify Acceptance Criterion: mandatory rule with the event list in all three
  - [x] 3.8 Verify Acceptance Criterion: procedure and report values
  - [x] 3.9 Verify Acceptance Criterion: main-thread wave update with both skip values
  - [x] 3.10 Verify Acceptance Criterion: checklist rules unchanged; lifecycle entry present
  - [x] 3.11 Run Tests: `pnpm run test:unit`, `pnpm run validate`; this story's own issue #272 carries the first real status comment (dogfood for PRD AC-3, D-39)

- [x] 4.0 Implement Story S-004: Developer agent and command report the status-comment outcomes and define merged as merged to main (#273)

  - [x] 4.1 Add a `describe("developer")` block asserting the two report fields beside `checklist_sync:`, the reworded close rule, and the pointer sentence to implement's procedure, in all three developer agent files; confirm red; confirm `developer-command-collapse.test.ts` still passes before editing
  - [x] 4.2 Add `status_comment: written | failed(<reason>) | skipped(<reason>)` and `wave_status: written | skipped(<reason>) | owned-by-planner` to the completion report block in `.claude/agents/developer.md` (D-30)
  - [x] 4.3 Reword rule 6 to "You MUST NOT close the issue; GitHub closes it when the consolidated PR merges to main" (D-22)
  - [x] 4.4 Replace any restated comment guidance in the pre-coding rules with a pointer to implement's status-comment procedure (D-38)
  - [x] 4.5 Apply the same edits to `.github/agents/developer.agent.md` and `.kiro/agents/developer.md`; edit `.claude/commands/developer.md` only if the collapse test demands it
  - [x] 4.6 Verify Acceptance Criterion: report fields in all three
  - [x] 4.7 Verify Acceptance Criterion: close rule reworded in all three
  - [x] 4.8 Verify Acceptance Criterion: pointer, not a copy
  - [x] 4.9 Run Tests: `pnpm run test:unit` including `developer-command-collapse.test.ts`, then `pnpm run validate`

- [ ] 5.0 Implement Story S-005: activity-init recommends a GitHub Project and ships the configuration runbook (#274)

  - [x] 5.1 Add a `describe("activity-init")` block asserting the "Repository Setup — GitHub Project (Recommended)" subsection and the runbook path in all three trees, plus an `it` over the runbook file asserting each required step and the absence of any instruction to change a default automation; confirm red
  - [x] 5.1a Bump the activity-init pin in `test/unit/skill-parity-init.test.ts` from 16 `## ` headings to 17, with a comment naming S-005; leave the numbered-step pin at 54, since the subsection has no numbered steps (Design Mode A-1, D-40)
  - [x] 5.2 Write `docs/runbooks/runbook-configure-github-project.md` from `templates/runbooks/runbook-template.md`: frontmatter `name`, `trigger`, `owner: product-engineer`, `last_verified`, `related: [docs/requirements/prd-projects-tracking.md]` in inline bracket form; seven sections; steps for `gh auth refresh -s project`, Board template, default Status options and the named default automations kept, auto-add `is:issue`, deleting Priority, Size, Estimate, Start date, Target date, the three views with their filter strings, and verification with `gh project view` and `gh project field-list` (D-10, D-22, D-35)
  - [x] 5.2a In the runbook, state that the Auto-close issue automation is off by default and is left alone, and that the exercise must record the exact names shown on the Workflows page, including "Pull request linked to issue" as observed on riel's Project 4 (Design Mode A-5, A-6, D-43)
  - [x] 5.3 Add the runbook's row to `docs/runbooks/README.md`; run `pnpm run lint` and confirm no docs-structure finding
  - [x] 5.3a Add `runbook-configure-github-project` to `EXPECTED_RUNBOOKS` in `test/unit/runbook-set.test.ts` (Design Mode A-2)
  - [x] 5.4 Add the four-sentence subsection with the runbook link to `.claude/skills/activity-init/SKILL.md` after the Branch Protection subsection, then to the `.github/` and `.kiro/` copies
  - [ ] 5.5 Exercise the runbook once on `llipe/dev-tasks` (stop and ask the user before creating the Project); record the Project number and date in the PR body and set `last_verified` to that date
  - [x] 5.6 Verify Acceptance Criterion: subsection in all three trees, at most four sentences, link present
  - [x] 5.7 Verify Acceptance Criterion: runbook frontmatter and sections pass the docs-structure check
  - [x] 5.8 Verify Acceptance Criterion: every required step present; no default automation changed
  - [x] 5.9 Verify Acceptance Criterion: README row present
  - [ ] 5.10 Verify Acceptance Criterion: runbook exercised; Project number recorded
  - [x] 5.11 Run Tests: `pnpm run lint`, `pnpm run test:unit`, `pnpm run validate`

- [ ] 6.0 Implement Story S-006: Cross-tree guard against Project writes and the dogfood rows in TESTING.md (#275)

  - [ ] 6.1 Add a `describe("no Project writes")` block that walks every `.md` under `.claude/`, `.github/` and `.kiro/` recursively and asserts none contains `gh project item-edit` or `gh project item-add`, with a self-check that the matcher catches a fixture string containing the forbidden command; confirm the self-check is red before the matcher exists (D-23)
  - [ ] 6.1a Extend the guard walk to `docs/` as well as the three trees, so the runbook cannot carry the two forbidden verbs either (Design Mode A-11, D-44)
  - [ ] 6.1b Reword the stage-label retirement rationale bullet in all three github-ops copies so it says the linked pull request shows the state, Project or not, matching FR-7 rather than D-07's older wording (fidelity-report-S-001 DR-1)
  - [ ] 6.1c Give the PRD tracking issue a body template in the three publish copies (PRD title line, links to the PRD file and `docs/roadmap.md`, `## Waves` list) and assert it plus `level: story` in the publish parity block (fidelity-report-S-002 DR-2; qa S-002 gap)
  - [ ] 6.1d Replace the restated story-issue title form under `### Story issues` in the three publish copies with a reference to github-ops § Title Format (fidelity-report-S-002 DR-4)
  - [ ] 6.1e In the github-ops status-comment story template (three copies), make the Gates column carry `coverage_gate` and the fidelity verdict beside the five quality gates, as FR-23 states, and assert it (fidelity-report-S-003 DR-3)
  - [ ] 6.1f Make `sectionOf` level-aware in `test/unit/projects-tracking-parity.test.ts` (collect until the next heading of equal or higher level), fold the `duringImplementation()` workaround into it, add a `###`-child test case, and tighten the EC-18 assertion to the literal `create it from the wave table` (qa S-003 gaps)
  - [ ] 6.1g In the Copilot and Kiro developer copies, say "the `implement` procedure" rather than "the `implement` skill's" where the pointer names it, since implement is an instruction and a steering file there (fidelity-report-S-004 DR-3)
  - [ ] 6.2 Add a "Dogfood checks" table to `TESTING.md` with one row per behavioural criterion of wave 1 (PRD AC-1 pending wave 2's publish; PRD AC-3 satisfied by this wave's stories), each row naming the satisfying issue number or `pending`, plus a changelog row (D-39)
  - [ ] 6.2a Add a `## Changelog` section to `TESTING.md` and bump its frontmatter `version:`; the Dogfood row is the first changelog entry (Design Mode A-12)
  - [ ] 6.2b Add a `pending` Dogfood row for FR-24's success path (parent found, wave comment edited), first observable on a main-thread run of a wave 2 story (Design Mode A-16)
  - [ ] 6.3 Fill the AC-3 rows for S-003 to S-005 with their issue numbers once each story's status comment has been observed; mark the S-001 and S-002 rows `n/a (pre-rule)`, since they ran before S-003's rule existed (Design Mode A-7, D-42)
  - [ ] 6.4 Verify Acceptance Criterion: guard passes on all three trees and fails on the fixture string
  - [ ] 6.5 Verify Acceptance Criterion: Dogfood checks table and changelog row present
  - [ ] 6.6 Verify Acceptance Criterion: S-001 to S-005 rows filled
  - [ ] 6.7 Run Tests: `pnpm run test:unit`, `pnpm run validate`

## Decisions Consumed

| ID   | Decision (short form)                                                   |
| ---- | ----------------------------------------------------------------------- |
| D-02 | Tracking issues and sub-issues through REST.                            |
| D-03 | Hierarchy axis is `level:`.                                             |
| D-04 | Title forms for PRD and wave tracking issues.                           |
| D-05 | Tracking issues exempt from `type:` and `priority:`.                    |
| D-07 | Stage labels retire; flags stay.                                        |
| D-10 | Project setup is a runbook step in activity-init.                       |
| D-12 | A designated status comment may be edited in place.                     |
| D-14 | No stage checklist on the wave issue.                                   |
| D-16 | `gh` primary everywhere.                                                |
| D-22 | Native status model; GitHub closes at ship.                             |
| D-23 | No agent writes Project Status.                                         |
| D-25 | One mandatory status comment per story, wave and PRD issue.             |
| D-26 | Status comments identified by marker.                                   |
| D-28 | No issue → `skipped(no issue)`.                                         |
| D-29 | No parent → `skipped(no parent)`.                                       |
| D-30 | Report fields in the developer completion report.                       |
| D-31 | Wave 1 retires the stage labels from the taxonomy only.                 |
| D-32 | Wave `<id>` from the roadmap cell.                                      |
| D-33 | github-ops owns the status-comment template.                            |
| D-34 | One parity test file, existing helpers.                                 |
| D-35 | Runbook per template, docs-structure check.                             |
| D-36 | Publish finds tracking issues by label plus title prefix.               |
| D-37 | Marker on the first line.                                               |
| D-38 | Rule lives in implement.                                                |
| D-39 | Static parity tests plus next-wave dogfood.                             |
| D-40 | activity-init subsection stays `##`; heading pin bumped to 17.          |
| D-41 | S-001 aligns every MCP-primary passage in github-ops, not one sentence. |
| D-42 | S-001 and S-002 dogfood rows read `n/a (pre-rule)`.                     |
| D-43 | "Pull request linked to issue" is a default automation, observed on riel. |
| D-44 | The no-Project-writes guard walks `docs/` too.                          |
