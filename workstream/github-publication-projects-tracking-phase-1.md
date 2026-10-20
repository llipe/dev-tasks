# GitHub Publication Report: projects-tracking — Wave 1

## Changelog

| Version | Date       | Summary                                   | Author                    |
| ------- | ---------- | ----------------------------------------- | ------------------------- |
| 1.0     | 2026-10-20 | Six wave 1 stories published as issues.   | @llipe / product-engineer |

## Target Repository

- Repo: llipe/dev-tasks
- Date: 2026-10-20
- Source: `workstream/user-stories-projects-tracking-phase-1.md` v1.0

## Created Issues

| Story ID | Story Title                                                                              | Issue URL                                      | Labels                                 | Milestone | Assignee     |
| -------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- | --------- | ------------ |
| S-001    | github-ops conventions for tracking issues, level labels and the status comment          | https://github.com/llipe/dev-tasks/issues/270 | `type: enhancement`, `priority: critical` | (none)    | (unassigned) |
| S-002    | Publish creates the tracking-issue hierarchy and reuses it on later waves                | https://github.com/llipe/dev-tasks/issues/271 | `type: enhancement`, `priority: critical` | (none)    | (unassigned) |
| S-003    | Implement keeps a mandatory story status comment; main-thread wave update                | https://github.com/llipe/dev-tasks/issues/272 | `type: enhancement`, `priority: high`     | (none)    | (unassigned) |
| S-004    | Developer agent and command report the status-comment outcomes; merged means main        | https://github.com/llipe/dev-tasks/issues/273 | `type: enhancement`, `priority: high`     | (none)    | (unassigned) |
| S-005    | activity-init recommends a GitHub Project and ships the configuration runbook            | https://github.com/llipe/dev-tasks/issues/274 | `type: enhancement`, `priority: medium`   | (none)    | (unassigned) |
| S-006    | Cross-tree guard against Project writes and the dogfood rows in TESTING.md               | https://github.com/llipe/dev-tasks/issues/275 | `type: enhancement`, `priority: medium`   | (none)    | (unassigned) |

## Notes

- No stories skipped.
- Published the old way, on purpose: no PRD or wave tracking issue and no sub-issue links, because S-002 (#271) is the story that introduces them. These six issues gain a parent in wave 3's migration (D-19); wave 2's publish is the first run of the new hierarchy (D-39).
- Labels use `type: enhancement` rather than the bare `enhancement` of the phase-3 precedent, since github-ops prefers the `type:` form.
- Titles were shortened to stay under 80 characters; the full titles are in the stories file.
- Execution method used: `gh-cli`, bodies via `--body-file`, delegated to `github-ops`.
- Assisted-by: not applicable (no PR created, no issue closed).
