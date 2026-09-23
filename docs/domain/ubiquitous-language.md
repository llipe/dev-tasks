---
version: 1.1
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

| Version | Date       | Summary                                                                                                                                                                                                       | Author           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1.1     | 2026-09-22 | Seeded from Phase 3 specification §8.7 (`shared-understanding#D-69`, closing `#D-45`), +decision log, +grilling, +exit gate, +bounded context, +package map, +runbook, +install-if-absent, +foundation document | product-engineer |
| 1.0     | 2026-09-21 | Delivered empty, install-if-absent on every profile (`shared-understanding#D-57`, ADR-008)                                                                                                                     | product-engineer |

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
