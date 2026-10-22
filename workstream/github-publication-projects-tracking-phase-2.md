# GitHub Publication Report: projects-tracking — Wave 2

## Changelog

| Version | Date       | Summary                                                                 | Author                    |
| ------- | ---------- | ----------------------------------------------------------------------- | ------------------------- |
| 1.0     | 2026-10-21 | Six wave 2 stories published under the first tracking-issue hierarchy. | @llipe / product-engineer |

## Target Repository

- Repo: llipe/dev-tasks
- Date: 2026-10-21
- Source: `workstream/user-stories-projects-tracking-phase-2.md` v1.0

## Tracking Issues

- PRD issue: #289 (created)
- Wave issue: #290 (created)
- Hierarchy: verified(7 of 7)

## Created Issues

| Story ID | Story Title                                                                              | Issue URL                                      | Labels                                                     | Milestone | Assignee     |
| -------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- | --------- | ------------ |
| S-008    | The planner knows its wave issue and commits its checkpoint after every merge            | https://github.com/llipe/dev-tasks/issues/291 | `level: story`, `type: enhancement`, `priority: critical`   | (none)    | (unassigned) |
| S-009    | The planner keeps the wave issue's status comment current; no per-merge comments         | https://github.com/llipe/dev-tasks/issues/292 | `level: story`, `type: enhancement`, `priority: critical`   | (none)    | (unassigned) |
| S-010    | Nobody closes a story; the consolidated PR closes every story and the wave at ship       | https://github.com/llipe/dev-tasks/issues/293 | `level: story`, `type: enhancement`, `priority: critical`   | (none)    | (unassigned) |
| S-011    | The planner derives the roadmap row from gh and closes out the run on the merge notice   | https://github.com/llipe/dev-tasks/issues/294 | `level: story`, `type: enhancement`, `priority: high`       | (none)    | (unassigned) |
| S-012    | The verifier's rollup compares the roadmap row with the wave issue and its sub-issues    | https://github.com/llipe/dev-tasks/issues/295 | `level: story`, `type: enhancement`, `priority: medium`     | (none)    | (unassigned) |
| S-018    | The PRD issue carries one status comment updated at wave events                          | https://github.com/llipe/dev-tasks/issues/296 | `level: story`, `type: enhancement`, `priority: medium`     | (none)    | (unassigned) |

## Notes

- No stories skipped.
- First real run of the wave 1 publish hierarchy (dogfood DF-1, D-39): both tracking issues created on the zero-match path; the one-match reuse path (DF-1b) waits for wave 3's publish. All eight issues were auto-added to GitHub Project 5 by its `is:issue` auto-add workflow and read Backlog, with no agent write.
- The PRD issue's Waves list records wave 1 as shipped in PR #282 without a tracking issue; wave 3's migration (FR-19) decides whether shipped waves get one.
- No PRD status comment was posted: FR-25's publish-time comment is wave 2 scope (S-018, #296).
- Execution method used: `gh-cli`, bodies via `--body-file`, delegated to `github-ops`.
- Assisted-by: not applicable (no PR created, no issue closed).
