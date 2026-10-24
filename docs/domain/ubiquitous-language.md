---
version: 1.4
name: Ubiquitous Language
description: Canonical domain vocabulary, organized by bounded context. Append-only; terms are superseded, never deleted.
status: active
owner: product-engineer
---

# Ubiquitous Language

The canonical vocabulary of this repository. One term means one thing here, and
the name used in conversation is the name used in the code.

`status: unfilled` means no vocabulary has been established yet — never
permission to invent one. Terms arrive when a PRD or specification proposes them
and the user approves it; `product-engineer` appends them, one entry per term,
grouped under the bounded context they belong to. A term is never deleted: when
it is replaced, its `Status` records what superseded it, so a reader who meets
the old word in an old document can still find out what it meant.

Each term carries five fields — `Definition`, `Forbidden synonyms`, `Invariants`,
`Origin`, and `Status` — and every one of them is present, `none` included.
Bounded-context names resolve against the package map in `docs/tech.md`.

The eight terms below are the ones this repository's own shared-understanding
PRD introduced and already uses consistently (`shared-understanding#D-69`).
Nothing here was invented for the sake of filling the file: every `Origin`
points at the requirement, ADR, or decision that put the word into circulation.
A ninth term arrives the same way the first eight did — proposed in a PRD's
`## Vocabulary` section, resolved during grilling, appended on approval.

## Changelog

| Version | Date       | Summary                                                                                                                                                                                                         | Author           |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1.4     | 2026-10-24 | PRD projects-tracking v1.11 approved (`projects-tracking#D-79` to `#D-101`), +migration plan, +standalone issue, +release blocker                                                                               | product-engineer |
| 1.3     | 2026-10-20 | PRD projects-tracking approved (`projects-tracking#D-01` to `#D-27`), +tracking issue, +status comment                                                                                                          | product-engineer |
| 1.2     | 2026-10-19 | PRD factory-board approved (`factory-board#D-01` to `#D-13`), +board, +wave stage, +roadmap drift                                                                                                               | product-engineer |
| 1.1     | 2026-09-22 | Seeded from Phase 3 specification §8.7 (`shared-understanding#D-69`, closing `#D-45`), +decision log, +grilling, +exit gate, +bounded context, +package map, +runbook, +install-if-absent, +foundation document | product-engineer |
| 1.0     | 2026-09-21 | Delivered empty, install-if-absent on every profile (`shared-understanding#D-57`, ADR-008)                                                                                                                      | product-engineer |

## Bounded Context: AI-assisted development workflow

The one context this repository has, and the value its package map already
carries: `dev-tasks` is a single package whose domain is the workflow harness
itself — the agents, skills, checks, and contracts that drive PRD-driven
AI-assisted development.

### decision log

- Definition: The append-only `workstream/decisions-<feature>.md` table recording every question, recommendation, answer, and resolution of a feature.
- Forbidden synonyms: none
- Invariants: One file per feature, appended to and never rewritten. Each row carries a `D-NN` unique within the file; a decision that replaces another names the ID it supersedes, and the superseded row stays where it is.
- Origin: docs/requirements/prd-shared-understanding-refinement.md FR-4
- Status: active

### grilling

- Definition: The one-question-at-a-time, depth-first interview that must reach a confirmed exit gate before any document is drafted.
- Forbidden synonyms: none
- Invariants: Exactly one question per turn, each carrying a recommended answer. No PRD, specification, or story is drafted before the exit gate is confirmed.
- Origin: docs/requirements/prd-shared-understanding-refinement.md FR-1, shared-understanding#D-01
- Status: active

### exit gate

- Definition: The hard stop that requires an empty open-questions list and an explicit user statement of shared understanding before drafting begins.
- Forbidden synonyms: none
- Invariants: Both conditions hold together — an empty open list and an explicit user confirmation. An agent never declares the gate passed on the user's behalf.
- Origin: shared-understanding#D-02, ADR-008
- Status: active

### bounded context

- Definition: A named boundary within which one term has exactly one meaning; recorded per package in the `docs/tech.md` package map.
- Forbidden synonyms: none
- Invariants: Every `## Bounded Context:` heading in this file matches a name or a Bounded context value in the package map exactly, case and spacing included. A word that means two things in two places is a finding for this file to resolve, not grounds for two definitions.
- Origin: docs/requirements/prd-shared-understanding-refinement.md FR-18, shared-understanding#D-03
- Status: active

### package map

- Definition: The `docs/tech.md` table mapping each workspace package to its path, purpose, owner, canonical scripts, and bounded context.
- Forbidden synonyms: none
- Invariants: One row per package, including the single root row of a single-package repository. `dev-tasks doctor` warns when the table and the workspace disagree in either direction; it warns and never fails.
- Origin: docs/requirements/prd-shared-understanding-refinement.md FR-60
- Status: active

### runbook

- Definition: A `docs/runbooks/` document describing a multi-step setup, configuration, or migration procedure that is otherwise held in one head.
- Forbidden synonyms: none
- Invariants: One file per procedure, named `runbook-<verb>-<object>.md` and listed in `docs/runbooks/README.md`. It ships in the same pull request as the procedure it documents, never as a follow-up issue.
- Origin: docs/requirements/prd-shared-understanding-refinement.md FR-47
- Status: active

### install-if-absent

- Definition: The delivery mode that writes a consumer-owned file only when it is missing and never overwrites an edited copy on a later run.
- Forbidden synonyms: none
- Invariants: Delivered on every profile. A second `install` or `update` over an edited copy leaves it byte-identical, and the target is listed under `consumer_owned_paths` in the bundle manifest.
- Origin: ADR-006, ADR-008, shared-understanding#D-12
- Status: active

### foundation document

- Definition: A repository-level context document every agent reads before it works: `docs/product.md` and `docs/tech.md`.
- Forbidden synonyms: product-context, technical-guidelines
- Invariants: Read by resolving the canonical name first and falling back to the retired name only when the canonical one is absent; always written under the canonical name.
- Origin: docs/requirements/prd-shared-understanding-refinement.md FR-44
- Status: active

### board

- Definition: The generated, read-only page and its `board.json` that show every PRD's waves, stories and progress, derived from repository files and GitHub.
- Forbidden synonyms: dashboard, factory
- Invariants: Regenerated whole by `dev-tasks board` on every run; no field is hand-edited and no output is committed to the default branch.
- Origin: docs/requirements/prd-factory-board.md, factory-board#D-01, factory-board#D-06
- Status: active

### wave stage

- Definition: One of the eight evidence-backed steps a wave passes through: Refine, Spec, Stories, Publish, Plan, Build, Audit, Ship.
- Forbidden synonyms: phase step, milestone
- Invariants: A stage is `present` only when its evidence file exists or its derived condition holds; stages are recorded individually, never as a count, so a skipped stage stays visible.
- Origin: docs/requirements/prd-factory-board.md FR-6, factory-board#D-05
- Status: active

### roadmap drift

- Definition: A disagreement between a `docs/roadmap.md` row and the state GitHub or `workstream/` evidence shows for the same wave.
- Forbidden synonyms: roadmap mismatch
- Invariants: GitHub wins. The board reports the drift and never edits the roadmap; correction stays with `planner` in the consolidated PR and with `product-engineer`.
- Origin: docs/requirements/prd-factory-board.md FR-10, factory-board#D-09
- Status: active

### tracking issue

- Definition: A GitHub issue that stands for a PRD or a wave, labeled `level: prd` or `level: wave`, holding its sub-issues and its status comment.
- Forbidden synonyms: epic, parent issue, umbrella issue
- Invariants: One per PRD file and one per wave with open stories; created by `activity-publish-github`; exempt from `type:` and `priority:` labels; closed by GitHub when the consolidated PR merges to main, never by an agent.
- Origin: docs/requirements/prd-projects-tracking.md FR-1, projects-tracking#D-02, projects-tracking#D-05
- Status: active

### status comment

- Definition: The one marker-identified comment on a story, wave or PRD issue that the owning agent edits in place at defined events to record current state.
- Forbidden synonyms: progress comment, checkpoint comment, update comment
- Invariants: Exactly one per issue, found by the marker `<!-- dev-tasks:status -->` and never by a stored id; edited in place, never re-posted; every other comment on the issue stays append-only.
- Origin: docs/requirements/prd-projects-tracking.md FR-23, projects-tracking#D-25, projects-tracking#D-26
- Status: active

### migration plan

- Definition: The reviewable file `workstream/migration-projects.md` listing every proposed write by batch, the items that need an answer, and each write's state.
- Forbidden synonyms: dry run file, migration script
- Invariants: Written only by `dev-tasks migrate projects --plan`; applied only by `--apply` once its header reads `Approved: yes` and its `Plan digest:` still matches; never overwritten once a row is no longer `pending`; committed as the record of what migration changed.
- Origin: docs/requirements/prd-projects-tracking.md FR-17, projects-tracking#D-79, projects-tracking#D-88, projects-tracking#D-93
- Status: active

### standalone issue

- Definition: An open issue that is not a story or a tracking issue; it carries no `level:` label and no parent.
- Forbidden synonyms: orphan issue, loose issue
- Invariants: Follow-ups, bugs and chores are standalone unless they are stories; a `phase:` label stays on it as a filter; migration never links it into the hierarchy.
- Origin: docs/requirements/prd-projects-tracking.md FR-19, projects-tracking#D-19, projects-tracking#D-82
- Status: active

### release blocker

- Definition: An issue labelled `priority: critical` that blocks a wave, PRD or release from shipping, linked by a native `blocked by` relation from the issue it blocks.
- Forbidden synonyms: showstopper, blocker label
- Invariants: Carries a `**Blocks:** #N — <reason>` body line; a `critical` issue without a blocking relation is reported by the github-ops audit; a blocking link is never invented.
- Origin: docs/requirements/prd-projects-tracking.md FR-26, projects-tracking#D-84
- Status: active
