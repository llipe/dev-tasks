# Implementation Plan - Shared Understanding Phase 3 (Ubiquitous Language)

Source: `workstream/user-stories-shared-understanding-phase-3.md` v1.1 — all 6 stories selected.
Spec: `workstream/specification-shared-understanding-phase-3.md` v1.1
Decisions: `workstream/decisions-shared-understanding.md` (D-57…D-75 for this phase; D-70…D-75 from Design Mode)
Repository shape: single-package — package brackets omitted per `docs/tech.md`.

## Relevant Files

- `templates/domain/ubiquitous-language.md` - New install-if-absent template (frontmatter, empty changelog)
- `core/distribution/profiles.ts` - One `INSTALL_IF_ABSENT_FILES` entry tagged `ROOT_PROFILE_TAG`
- `bundle-manifest.json` - Template under `managed_paths`, target under `consumer_owned_paths`
- `core/distribution/doctor.ts` - `checkGlossaryPresence()` (warn on absence only)
- `docs/README.md` - `domain/` row
- `core/checks/glossary.ts` - New module: `checkGlossaryContent`, `checkGlossary`, `checkVocabularySection`, `checkExportedIdentifiers`
- `core/checks/index.ts` - Export the new module
- `core/checks/run.ts` - Wire the structure check and the `docs/requirements/` Vocabulary walk
- `.claude/skills/activity-refine/SKILL.md` (+ `.github/skills/`, `.kiro/skills/`) - `## Vocabulary`, pre-review check, approval append
- `.claude/skills/activity-generate-spec/SKILL.md` (+ mirrors) - `## Vocabulary`
- `.claude/skills/activity-grill/SKILL.md` (+ mirrors) - FR-21 conflict rule, placeholder removal
- `.claude/agents/verifier.md`, `.github/agents/verifier.agent.md`, `.kiro/agents/verifier.md` - Conformance call, advisory finding class
- `.claude/skills/activity-init/SKILL.md` (+ mirrors) - Glossary-is-canonical pointer sentence
- `docs/domain/ubiquitous-language.md` - This repository's populated glossary
- `docs/tech.md` - Package-map note replaced by a glossary pointer
- `test/integration/install-parity.test.ts` - Extend for per-profile delivery and byte-identical re-run
- `test/unit/doctor-glossary.test.ts` (or existing doctor test) - Absence warn / present silent
- `test/unit/root-doc-template-parity.test.ts` - Extend if it enumerates templates
- `test/unit/checks-glossary.test.ts` - Unit tests for all four check functions + real-file fixture
- `test/fixtures/glossary/*.md` - Structure-rule fixtures
- `test/unit/verifier-glossary-conformance-parity.test.ts` - S-005's three-tree conformance markers, scoped to the Audit Mode Actions row and the report bullet (the implementer's choice offered by task 5.4)
- `test/integration/checks-run.test.ts` - S-005 AC-3: the scan is not a `lint` gate, proved through the process boundary
- `test/unit/checks-decision-log-format.test.ts` - Real-log fixture now asserts `staleness` as well as `failures` (the D-60 escaped-pipe defect)
- `test/unit/skill-parity-grilling.test.ts` - Extend for `activity-refine`, `activity-generate-spec`, `activity-grill`, `verifier` markers
- `test/unit/skill-parity-init.test.ts` - Extend for the `activity-init` pointer
- `test/fixtures/grilling/vocabulary-approval.md`, `vocabulary-conflict.md`, `README.md` - Scenario fixtures
- `docs/requirements/prd-shared-understanding-refinement.md` - `## Vocabulary` section added in 3.0, not 6.3a: wiring the `run.ts` walk makes `lint` report `vocabulary-missing` against this PRD immediately (test plan A-8), so the section had to land in the same PR as the walk. Its eight rows are `proposed` until the glossary exists; **task 6.3a is now a flip of those rows to `existing`**, which `lint` enforces once S-006 populates the file (D-74's `proposed`-but-present rule)

## Tasks

- [x] 1.0 Implement Story S-001: Deliver the glossary install-if-absent and warn on absence (#229)

  > Note: Delivery reuses Phase 1's platform-agnostic tag — no new mechanism (D-57). `doctor` warns on absence only; empty-but-present is silent (D-67). No `docs/domain/README.md` (D-58).

  - [x] 1.1 Write failing tests first: extend `test/integration/install-parity.test.ts` (per-profile fresh install creates the file identical to the template; `install`/`update` over an edited copy leave it byte-identical — AC-06) and add `doctor` tests (absent → warn proposing `dev-tasks update`; present-empty and present-populated → no finding) (D-67); confirm they fail
  - [x] 1.2 Add `templates/domain/ubiquitous-language.md`: five-key frontmatter (`version: 1.0`, `name`, `description`, `status: unfilled`, `owner: product-engineer`), empty `## Changelog` table, no bounded contexts (D-68)
  - [x] 1.3 Add the `INSTALL_IF_ABSENT_FILES` entry (source template, target `docs/domain/ubiquitous-language.md`, platform `ROOT_PROFILE_TAG`) (D-57)
  - [x] 1.4 Add `bundle-manifest.json` entries: template under `managed_paths`, target under `consumer_owned_paths` (D-57)
  - [x] 1.5 Add `checkGlossaryPresence()` to `core/distribution/doctor.ts` copying `checkPackageMap()`'s `warn: true` shape; register it in `runDoctor()` (D-67)
  - [x] 1.6 Add the `domain/` row to `docs/README.md`; do not create `docs/domain/README.md` or change `INDEXES` (D-58)
  - [x] 1.7 Verify Acceptance Criterion: AC-1 template shape (template-parity test)
  - [x] 1.8 Verify Acceptance Criterion: AC-2 registry entry present with `ROOT_PROFILE_TAG`
  - [x] 1.9 Verify Acceptance Criterion: AC-3 manifest paths present
  - [x] 1.10 Verify Acceptance Criterion: AC-4 per-profile delivery and byte-identical re-run, including profile `all` delivering exactly once and a fresh repo with no `docs/` directory
  - [x] 1.11 Verify Acceptance Criterion: AC-5 `doctor` warns on absence only, never fails
  - [x] 1.12 Verify Acceptance Criterion: AC-6 `pnpm run lint` passes with `docs/domain/` and no sub-index
  - [x] 1.13 Run Tests: `pnpm run test -- install-parity`, `pnpm run test -- doctor`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`

- [x] 2.0 Implement Story S-002: Validate glossary structure under `lint` (#230)

  > Note: Depends on 1.0. Separate hand-parsed module, `tsx`-invoked, one implementation for `lint` and the `verifier` (D-59, D-48, D-49). Fail-vs-report split per D-66.

  - [x] 2.1 Write `test/unit/checks-glossary.test.ts` first with one fixture per D-66 failure rule (missing field, invalid `Status`, dangling `superseded by`, duplicate term, unresolved bounded context, removed term), both report cases (no package map → exactly one finding; archived-origin `feature#D-NN`), zero-terms pass, and five-key frontmatter failure; confirm it fails (module absent)
  - [x] 2.2 Add `PackageMapRow` and its table parser to `core/distribution/workspace.ts`, shared with `doctor` (D-75)
  - [x] 2.2a Implement `core/checks/glossary.ts`: `parseFrontmatter()` reuse asserting the five glossary keys by presence (D-75), `## Bounded Context:` → `### <Term>` → five-bullet walk skipping fenced code blocks (D-74), exact-case context resolution against `PackageMapRow[]`, case-insensitive term uniqueness (D-74), append-only via `+term` rows (grammar D-74), a `GlossaryRule` typed union (D-74); `checkGlossaryContent()` pure, `checkGlossary(repoRoot)` doing filesystem work and returning no findings on an absent file (D-75) (D-59, D-66)
  - [x] 2.3 Export from `core/checks/index.ts`; call from `core/checks/run.ts` — failures → stderr + exit 1, staleness → stdout (D-48)
  - [x] 2.4 Verify Acceptance Criterion: AC-1 each structural rule fails `lint`
  - [x] 2.5 Verify Acceptance Criterion: AC-2 absent package map and archived origin report without failing
  - [x] 2.6 Verify Acceptance Criterion: AC-3 zero terms passes; malformed frontmatter fails
  - [x] 2.7 Verify Acceptance Criterion: AC-4 runs under `pnpm run lint` via `tsx`, exported for the `verifier`
  - [x] 2.8 Verify Acceptance Criterion: AC-5 no `yaml`/markdown-parser import (grep assertion, `decision-log-format` pattern) (D-49)
  - [x] 2.9 Run Tests: inject a broken fixture under `docs/domain/`, confirm `pnpm run lint` exits 1, remove it, confirm exit 0; edge cases — case-different context name, `none` values, valid `superseded by`, no `+term` rows yet, CRLF
  - [x] 2.10 Run Tests: `pnpm run test -- checks-glossary`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`

- [x] 3.0 Implement Story S-003: Propose vocabulary in PRDs and specs, enforce AC-07, append on approval (#231)

  > Note: Depends on 2.0. No prose scanning — structural Vocabulary-section check only (D-65). Append happens at approval, by `activity-refine`, never `activity-grill` (D-61).

  - [x] 3.1 Write `checkVocabularySection()` unit tests first: missing section → `vocabulary-missing`; incomplete row → `vocabulary-incomplete` naming the row; `existing` term absent from glossary; complete `proposed` row; `conflict → D-NN`; the `None — this PRD introduces no domain concepts.` sentinel; pre-Phase-2 skip (no `## Vocabulary` and no `## Decisions`) (D-65); confirm they fail
  - [x] 3.2 Implement `checkVocabularySection()` in `core/checks/glossary.ts` — findings in `failures` (D-71); header-only table and `proposed`-but-present → incomplete, `->`/`→` accepted (D-74); add the `docs/requirements/*.md` walk to `run.ts` with the pre-Phase-2 skip
  - [x] 3.3 Edit `activity-refine` (three trees): `## Vocabulary` after `## Decisions` in the PRD Output Structure with the spec §5 table; call the check before presenting for review and report the finding by name; add the approval-append step — append `proposed` rows under their bounded context (create heading only if it resolves per FR-63), `Origin` = PRD path, `Status: active`, `+term` changelog row, `version` bump, `status: unfilled` → `active` on first append; `conflict → D-NN` marks the superseded term and keeps it (D-61, spec §8.4)
  - [x] 3.4 Edit `activity-generate-spec` (three trees): `## Vocabulary` after `## Decisions (HOW phase)` (D-61); run the same pre-review Vocabulary check on specs (D-75)
  - [x] 3.5 Add `test/fixtures/grilling/vocabulary-approval.md` (proposed rows → approval → exact glossary diff) and its README row
  - [x] 3.6 Extend `test/unit/skill-parity-grilling.test.ts`: Vocabulary markers in both skills, approval-append markers in `activity-refine`, negative assertion that `activity-grill`'s Write Authority is unchanged (D-61)
  - [x] 3.7 Verify Acceptance Criterion: AC-1 Vocabulary section in both Output Structures
  - [x] 3.8 Verify Acceptance Criterion: AC-2 `vocabulary-missing` / `vocabulary-incomplete` semantics
  - [x] 3.9 Verify Acceptance Criterion: AC-3 pre-review check call; `lint` walk skips pre-Phase-2 PRDs; current `docs/requirements/` passes
  - [x] 3.10 Verify Acceptance Criterion: AC-4 approval append behavior (fixture walk)
  - [x] 3.11 Verify Acceptance Criterion: AC-5 `activity-grill` Write Authority unchanged
  - [x] 3.12 Verify Acceptance Criterion: AC-6 three-tree parity
  - [x] 3.13 Run Tests: edge cases — unresolvable bounded context (append refuses, reports), same term proposed twice (second is `existing`), `Forbidden synonyms: none`
  - [x] 3.14 Run Tests: `pnpm run test -- checks-glossary`, `pnpm run test -- skill-parity-grilling`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`
  - [x] 3.15 Merge-gate remediation (qa-engineer + verifier audit, PR #238): the `None —` sentinel is accepted only as the section's single non-blank, non-fenced line (it was matched against every line and returned clean before any row was parsed — the AC-07 gate was bypassable by a sentence); GFM's `| - |` and `|:-:|` delimiter rows are recognised as delimiters; a fenced example inside a real section is no longer read as rows; a directory named `*.md` under `docs/requirements/` no longer throws `EISDIR` out of `lint`; the section terminates at any ATX heading of depth 1 or 2. `activity-generate-spec` no longer tells specification authors to write the PRD wording of the sentinel

- [x] 4.0 Implement Story S-004: Surface vocabulary conflicts during grilling (#232)

  > Note: Depends on 1.0. Prose-only; runs in parallel with 3.0. Conflicts are questions, never auto-resolutions (FR-21).

  - [x] 4.1 Extend `test/unit/skill-parity-grilling.test.ts` first: FR-21 markers (WHAT-phase "which domain concepts" question; same-term-different-definition and forbidden-synonym checks surfaced as questions) and a negative assertion on every "(once Phase 3 ships it)" / "moot until Phase 3" phrase, across all three trees; confirm it fails
  - [x] 4.2 Edit `activity-grill` (three trees): add the WHAT-phase conflict rule per spec §8.5; remove the placeholders; leave Issue Mode's read-only rule and the Write Authority section unchanged (D-61)
  - [x] 4.3 Add `test/fixtures/grilling/vocabulary-conflict.md` (forbidden-synonym collision → FR-21 question → recorded `D-NN`) and its README row
  - [x] 4.4 Verify Acceptance Criterion: AC-1 conflict rule present, both checks, presented as a question with a recommendation
  - [x] 4.5 Verify Acceptance Criterion: AC-2 placeholders removed; Issue Mode rule intact
  - [x] 4.6 Verify Acceptance Criterion: AC-3 Write Authority unchanged
  - [x] 4.7 Verify Acceptance Criterion: AC-4 fixture walks cleanly against the skill text; edge cases — same term same definition (no question), a synonym forbidden by two terms (one question naming both)
  - [x] 4.8 Run Tests: `pnpm run test -- skill-parity-grilling`, `pnpm run lint`, `pnpm run format:check`

- [x] 5.0 Implement Story S-005: Report forbidden synonyms in new exported identifiers (#233)

  > Note: Depends on 2.0. Regex over added `export` lines, not the TypeScript compiler API (D-60). Forbidden-synonym hits only (D-64). Always advisory in this release (D-63).

  - [x] 5.1 Write `checkExportedIdentifiers()` unit tests first: each `export` form (`const|let|var|function|async function|class|type|interface|enum`, `export { a, b as c }`), each casing split (PascalCase, camelCase, snake_case, SCREAMING_CASE), plural normalization (`s`/`es`), a forbidden-synonym hit on a word and on a whole identifier, an unmatched identifier → nothing (D-64), result always in `staleness` never `failures` (D-63); confirm they fail
  - [x] 5.2 Implement `checkExportedIdentifiers(addedLines, glossaryMarkdown)` in `core/checks/glossary.ts`; export it — right-hand `as` name, optional leading `+`, plural rule (`es` after `s`/`x`/`z`/`ch`/`sh`, else one trailing `s` not after `s`), multi-word synonym joining, rule `glossary-forbidden-synonym` (D-60, D-73, D-74)
  - [x] 5.3 Edit `verifier.md` (three trees): in Audit Mode, beside the existing `checkDocsStructure()` call, run the function over the PR's added lines (`git diff <base>...HEAD`) and narrate hits as an advisory finding class that never blocks readiness (D-63)
  - [x] 5.4 Extend the parity test (or add a `verifier` parity file — implementer's choice) with the conformance-call markers across the three `verifier` files
  - [x] 5.5 Verify Acceptance Criterion: AC-1 extraction forms, splitting, normalization, hit semantics
  - [x] 5.6 Verify Acceptance Criterion: AC-2 unmatched identifiers produce nothing
  - [x] 5.7 Verify Acceptance Criterion: AC-3 findings only in `staleness`; `lint` exit code unaffected
  - [x] 5.8 Verify Acceptance Criterion: AC-4 `verifier` call present in all three trees
  - [ ] 5.9 Verify Acceptance Criterion: AC-5 run the function over this phase's own diff with the populated glossary (after 6.0) — nothing reported, or hits fixed in the same PR — **deferred to 6.6 by design:** the run needs S-006's populated glossary, which does not exist on this branch.
  - [x] 5.10 Run Tests: edge cases — `export default class`, `export * from`, `as` alias, identifier equal to a canonical term (no finding), glossary with zero forbidden synonyms
  - [x] 5.11 Run Tests: `pnpm run test -- checks-glossary`, `pnpm run test -- skill-parity-grilling`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`

- [ ] 6.0 Implement Story S-006: Populate this repository's glossary and retire the package-map placeholder (#234)

  > Note: Depends on 2.0 and 3.0. Runs last so the finished check validates the file. Eight terms only — no invented vocabulary (D-69). One pointer sentence in `activity-init`, no new step (D-62).

  - [ ] 6.1 Add the real-file assertion to `test/unit/checks-glossary.test.ts` first (reads `docs/domain/ubiquitous-language.md`, asserts zero failures and that the `## Bounded Context:` heading matches `docs/tech.md`'s column value exactly); confirm it fails against the empty template
  - [ ] 6.2 Populate `docs/domain/ubiquitous-language.md` per spec §8.7: `## Bounded Context: AI-assisted development workflow`; the eight terms (`decision log`, `grilling`, `exit gate`, `bounded context`, `package map`, `runbook`, `install-if-absent`, `foundation document`) with all five fields, `Origin` per the spec table, `Status: active`; forbidden synonyms only where this PRD's history supplies them (`bounded context` carries none, D-72); frontmatter `status: active`, `version` bumped, one `+term` changelog row (D-69)
  - [ ] 6.3 Edit `docs/tech.md`: replace the "freeform working label (`shared-understanding#D-45`) … Phase 3's glossary supersedes it" sentence with a pointer to the glossary; leave the column value unchanged (D-69 closes D-45)
  - [ ] 6.3a Flip the eight rows of `docs/requirements/prd-shared-understanding-refinement.md`'s `## Vocabulary` from `proposed` to `existing` (D-71). The section itself landed in 3.0, not here: wiring the `run.ts` walk made `lint` report `vocabulary-missing` against this PRD immediately (A-8), so the section had to ship in that PR, with its rows `proposed` because the glossary was still empty. **The flip is matched on the exact term string.** A term whose spelling in 6.2's glossary differs from the PRD row leaves that row `proposed` and `lint` green — a `proposed` row only fails when the glossary *does* define the term (D-74) — so check the eight strings against the glossary headings one by one rather than assuming the flip is mechanical
  - [ ] 6.3b Add a test asserting every term in `docs/requirements/prd-shared-understanding-refinement.md`'s `## Vocabulary` table matches a `### <Term>` heading in `docs/domain/ubiquitous-language.md` exactly, so the 6.3a flip fails loudly instead of silently — a `proposed` row whose term the glossary does not define leaves `lint` green (D-76, audit finding D-8 on issue #231)
  - [ ] 6.4 Edit `activity-init` (three trees): one sentence on the bounded-context question naming the glossary as canonical (D-62); extend `test/unit/skill-parity-init.test.ts`
  - [ ] 6.5 Verify Acceptance Criterion: AC-1 exactly eight terms, all fields, origins resolve, changelog row present
  - [ ] 6.6 Verify Acceptance Criterion: AC-2 `pnpm run lint` passes; `checkExportedIdentifiers()` over this phase's diff reports nothing (5.9)
  - [ ] 6.7 Verify Acceptance Criterion: AC-3 `docs/tech.md` note replaced, column value unchanged
  - [ ] 6.8 Verify Acceptance Criterion: AC-4 `activity-init` pointer in all three trees; no new interview step
  - [ ] 6.9 Verify Acceptance Criterion: AC-5 every term traces to a PRD FR or a decision ID (manual review of `Origin` values)
  - [ ] 6.10 Run Tests: `pnpm run test -- checks-glossary`, `pnpm run test -- skill-parity-init`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run audit`

## Decisions Consumed

| ID   | Decision (short form)                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------- |
| D-45 | Package-map bounded context is freeform until Phase 3 (closed by D-69).                                                 |
| D-48 | Checks are invoked via `tsx core/checks/run.ts`, never a compiled `dist/` path.                                          |
| D-49 | Checks hand-parse; no `yaml`/markdown dependency — the module ships to consumers in `dist/core/`.                        |
| D-57 | Delivery: one `INSTALL_IF_ABSENT_FILES` entry tagged `ROOT_PROFILE_TAG`; template + manifest paths.                     |
| D-58 | `docs/README.md` gains `domain/`; no sub-index, no `INDEXES` change.                                                     |
| D-59 | Separate `core/checks/glossary.ts`; one implementation for `lint` and the `verifier`.                                    |
| D-60 | FR-23 extraction is a regex over added `export` declarations.                                                            |
| D-61 | `## Vocabulary` after `## Decisions`; `activity-refine` appends at approval; `activity-grill` only surfaces conflicts.   |
| D-62 | No new `activity-init` step; one pointer sentence.                                                                       |
| D-63 | Glossary conformance is report-only in the first release (resolves OQ-03).                                              |
| D-64 | FR-23 reports forbidden-synonym hits only.                                                                               |
| D-65 | AC-07 is a structural Vocabulary-section check; no prose scanning.                                                       |
| D-66 | Structural glossary findings fail; absent package map and archived origin report; zero terms valid.                     |
| D-67 | `doctor` warns on absence only.                                                                                          |
| D-68 | Five-key frontmatter; owner `product-engineer`; `unfilled` is never permission.                                          |
| D-69 | This repository's glossary ships populated with eight terms; D-45's placeholder becomes the canonical context.           |
| D-70 | PRD v1.14: AC-07 and FR-23 reworded to testable forms.                                                                  |
| D-71 | `vocabulary-*` are failures; this PRD gains `## Vocabulary`.                                                            |
| D-72 | Seed: `package`/`module` dropped from `bounded context`'s forbidden synonyms.                                            |
| D-73 | Identifier rules: plural order, `as` right-hand name, optional `+`, multi-word synonyms.                                 |
| D-74 | Grammar rules: `+term`, `GlossaryRule` union, Vocabulary edge grammar, case rules, fenced blocks skipped.                |
| D-75 | Module shape: silent on absence, `PackageMapRow` in `workspace.ts`, D-68 corrected, spec check in `activity-generate-spec`. |
