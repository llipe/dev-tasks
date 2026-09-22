# Research: Shared Understanding Phase 3 — Integration Points

## Changelog

| Version | Date       | Summary                                                                | Author |
| ------- | ---------- | ---------------------------------------------------------------------- | ------ |
| 1.0     | 2026-09-21 | Initial research artifact: Phase 3 integration landscape investigation | Claude |

---

## Provenance

- **Repository:** `llipe/dev-tasks` (root package)
- **Base branch:** `main`
- **Base commit:** `dac792e` (Phase 2 just merged)
- **Research question:** What existing code, prompt content, and test infrastructure does Phase 3 (ubiquitous-language glossary) need to integrate with?
- **Invoking agent:** researcher
- **Date:** 2026-09-21

---

## Answer First (10 lines max)

Phase 3 glossary integration reuses all Phase 1 infrastructure: install-if-absent delivery (existing `ROOT_PROFILE_TAG`, `AgnosticTag`, `deliverInstallIfAbsentFiles`), doctor warnings (add glossary absence check to `checkDocsStructure`), docs indexing (add `docs/domain/` to `INDEXES` list in `docs-structure.ts`). Phase 3 adds one new check function to `core/checks/` for glossary-conformance linting (hand-parsed bullet-list format, similar to existing decision-log-format precedent). The verifier's Audit Mode already calls `checkDocsStructure`; glossary checks integrate identically. No TypeScript symbol extraction exists; Phase 3's identifier-matching against glossary terms is greenfield. Activity-grill and activity-refine skip glossary integration until Phase 3 ships the file; no code changes needed there today.

---

## Relevance-Ranked File Map (≤ 30 files)

### Install-If-Absent Delivery & Distribution

1. `core/distribution/profiles.ts:55–131` — `ROOT_FILES`, `INSTALL_IF_ABSENT_FILES`, `ROOT_PROFILE_TAG`, `AgnosticTag`, delivery registry (Phase 1 runbooks already use platform-agnostic tag)
2. `core/distribution/install-if-absent.ts` — `deliverInstallIfAbsentFiles()` implementation; write-if-absent, never-overwrite logic
3. `core/distribution/install.ts` — calls `deliverInstallIfAbsentFiles()` during install flow
4. `core/distribution/update.ts` — calls `deliverInstallIfAbsentFiles()` during update flow
5. `bundle-manifest.json:127–144` — `managed_paths` (templates/runbooks), `consumer_owned_paths` (docs/runbooks/)

### Doctor Checks & Diagnostics

6. `core/distribution/doctor.ts:250–301` — Foundation-doc-names check (D-19 pattern), package-map drift check (D-45 pattern); entry point for glossary absence check
7. `core/distribution/migrate-docs.ts` — `detectOldFoundationDocs()`, fallback mechanism for old names

### Docs Structure & Index Management

8. `core/checks/docs-structure.ts:1–100` — `INDEXES` list (lines 59), `DocsStructureFinding`, `parseFrontmatter()`, validation rules; Phase 3 adds `docs/domain/ubiquitous-language.md` to index
9. `docs/README.md:1–42` — Main documentation index; Phase 3 adds `domain/` subdirectory entry
10. `docs/domain/` — **does not exist** (to be created Phase 3)

### Skills & Decision Integration

11. `.claude/skills/activity-grill/SKILL.md:51–94, 131–132` — References glossary read-only (until Phase 3 ships); three-tree mirror (.claude/, .github/, .kiro/)
12. `.claude/skills/activity-refine/SKILL.md:62–250` — PRD output structure (Decisions section at line 203, no Vocabulary section yet); Changelog format
13. `.claude/skills/activity-generate-spec/SKILL.md:1–142` — Spec output structure (Decisions HOW phase, line 92); invokes activity-grill HOW phase

### Verification & Testing

14. `.claude/agents/verifier.md:138–304` — Audit Mode calls `checkDocsStructure` (line 173); glossary conformance check integrates here identically
15. `test/unit/skill-parity-testing-layers.test.ts` — Tests "glossary stays one root file" rule (AC-4); validates no per-package glossaries
16. `test/unit/root-doc-template-parity.test.ts` — Template parity testing for foundation docs

### Grilling Configuration

17. `docs/tech.md:13–87` — Package map (Bounded context column is freeform until Phase 3 supersedes it, D-45); Grilling section for question caps (D-55)
18. `.claude/skills/activity-init/SKILL.md` — Bounded-context interview question; states Phase 3 glossary supersedes it

### Reference Patterns (no changes needed Phase 3)

19. `core/checks/decision-log-format.ts` — Hand-parsed Markdown table format (precedent for glossary-check parser design)
20. `core/checks/index.ts` — Check registry pattern (glossary check integrates here)
21. `core/checks/run.ts` — Invocation harness (`tsx core/checks/run.ts` from lint)

### Historical Context (archived, not live refs)

22. `workstream/archive/specification-shared-understanding-phase-1.md` — Phase 1 spec; documents install-if-absent and bounded-context decisions
23. `workstream/archive/user-stories-shared-understanding-phase-1.md` — Phase 1 stories; documents the delivery-registry gap Phase 3 inherits
24. `workstream/decisions-shared-understanding.md:D-45, D-53–D-56` — Key decisions: freeform bounded contexts, phase 2 HOW decisions on grilling

---

## Slice Findings

### S1: Components & Modules

**(root)** `core/distribution/profiles.ts` exports `INSTALL_IF_ABSENT_FILES` registry and `AgnosticTag` type, ready to receive glossary entry. The `ROOT_PROFILE_TAG = "root"` constant (line 65) and the `AgnosticTag = typeof ROOT_PROFILE_TAG` type alias (line 76) are directly reusable; no new mechanism needed. Runbooks template already uses this pattern (lines 122–130).

**(root)** `core/distribution/install-if-absent.ts` implements the write-if-absent logic (line 64–106): reads source, checks target existence, writes only when absent, appends result. This logic is directly reusable for glossary delivery; no changes required.

**(root)** `core/checks/docs-structure.ts` defines `INDEXES` list (line 59) that controls which subdirectories are treated as first-level indexes. Currently: `["docs/README.md", "docs/runbooks/README.md"]`. Phase 3 adds `docs/domain/ubiquitous-language.md` to this list. The same check-and-hand-parse pattern used for runbooks (frontmatter validation, related-list resolution) will be reused for glossary frontmatter (five fixed keys per FR-48 precedent), with a new glossary-specific check function for term format and forbidden-synonym validation.

### S2: APIs & Contracts

**(root)** `core/distribution/profiles.ts:117–131` — `INSTALL_IF_ABSENT_FILES` array accepts entries with `platform: AgnosticTag`, already proven by runbook entries. Phase 3 glossary entry:

```typescript
{
  source: "templates/domain/ubiquitous-language.md",
  target: "docs/domain/ubiquitous-language.md",
  platform: ROOT_PROFILE_TAG
}
```

**(root)** `core/checks/docs-structure.ts` — `DocsStructureFinding` interface (lines 35–49) reports `rule` enum that includes `"runbook-*"` categories. Phase 3 adds new rules: `"glossary-term-format"`, `"glossary-forbidden-synonym"`, `"glossary-origin-invalid"`. Same `failures` (gate-failing) and `staleness` (reported-only) split used by runbook stale-date rule.

**(root)** `core/distribution/doctor.ts:284–301` — `checkPackageMap()` returns a `DoctorCheck` with `warn?: true`. Phase 3 adds `checkGlossaryAbsence()` returning identical shape: `{ name: "glossary-file", pass: true, warn: true, message: "..." }` when file is missing. Integrates into `runDoctor()` at line 334 alongside package-map check.

### S3: UI Surfaces

**Not applicable.** Phase 3 defines no UI components; work is documentation, linting, and agent integration.

### S4: Tests

**(root)** `test/unit/skill-parity-testing-layers.test.ts` — Existing test asserts "docs/tech.md keeps the glossary and simplicity baseline at the root (AC-4, AC-5)" and checks for phrase "One glossary, at the root". This test validates the single-glossary rule; glossary-conformance checks must not create per-package files or glossaries.

**(root)** `test/integration/` and `test/unit/` — No existing tests for glossary delivery or content (it does not exist yet). Phase 3 will add tests for:
- `deliverInstallIfAbsentFiles()` with glossary entry (parallel to runbook test pattern)
- Glossary absence detection in doctor
- Glossary frontmatter parsing (parallel to runbook frontmatter tests in `test/unit/runbook-set.test.ts`)
- Glossary conformance linting (term format, forbidden-synonym validation)

### S5: Data Model

**(root)** `docs/tech.md:13–31` — Package map table. Bounded-context column is freeform until Phase 3 glossary exists (D-45). The glossary's bounded contexts **must** map to these package names or to explicit domain labels listed in the same column. This is a referential integrity rule: glossary check validates that every `## Bounded Context: <name>` header matches a package in the map or a freeform domain label in the map's Bounded context column.

**(root)** `docs/domain/ubiquitous-language.md` (to be created) — Template structure per PRD Data Requirements (§ Ubiquitous language):

```markdown
## Bounded Context: <name>

### <Term>

- Definition:
- Forbidden synonyms:
- Invariants:
- Origin: <prd-file or feature#D-NN>
- Status: active | superseded by <Term> (<feature#D-NN>)
```

Frontmatter (per FR-48, D-49, hand-parsed precedent): `version`, `name`, `description`, `status`, `owner` (same as `TESTING.md`, `SIMPLICITY.md`).

### S6: Config, Environment, CI

**(root)** `bundle-manifest.json:127–131, 133–145` — Adds `templates/domain/ubiquitous-language.md` to `managed_paths` and `docs/domain/ubiquitous-language.md` to `consumer_owned_paths` (like runbooks and DESIGN.md, TESTING.md).

**(root)** `core/checks/run.ts` — Invocation harness that runs all checks from `core/checks/`. Phase 3 check integrates here. Invoked by `lint` step in JS/TS repos; currently called as `tsx core/checks/run.ts` (D-48 precedent: not `dist/`, because `dist/` is gitignored and `validate` has no build step).

**(root)** `.dev-tasks-version` and manifest reconciliation — No CI changes needed. Install-if-absent delivery is already integrated into `install.ts` and `update.ts` (called before reconcile, so glossary file survives updates).

### S7: Relationships

**Phase 3 depends on:**
- **Phase 1 (shipped):** Platform-agnostic install-if-absent mechanism (`ROOT_PROFILE_TAG`), docs structure check, doctor pattern, package map
- **Phase 2 (shipped):** Decision log format (hand-parse precedent), activity-grill glossary read-only placeholder, activity-refine PRD structure (Decisions section), activity-generate-spec spec structure
- **Phase 5 (later):** TDD commit-order evidence; Phase 5 uses glossary terms in commit-message scope validation (scope e.g. `feat(order-processing):` must map to a glossary term)

**Phase 3 feeds forward to:**
- **Phase 4 (later):** Simplicity contract references glossary terms; Phase 4 spec may cite glossary as authority for domain names in thresholds
- **Phase 5 (later):** Commit-order checker validates scope (`feat(scope-name):`) against glossary terms
- **Phase 6 (later):** Change-map extraction in `core/checks` (Phase 6 feature) outputs exported symbols; glossary conformance checker validates those symbols against glossary terms

**Three-tree parity:** activity-grill, activity-refine, activity-generate-spec, and verifier agent exist in `.claude/`, `.github/` (Copilot), and `.kiro/` mirrors. Glossary-related content is in prose; no code changes needed in these files for Phase 3 glossary to exist. Phase 3 spec updates prose references in all three trees.

### S8: Prior History

**Phase 0 (shipped):** Retired `core/extract` and `dt` binary; multi-repo `glossary.md` metadata deleted. No live glossary references remain in active code; only forward-looking references ("once Phase 3 ships it").

**Phase 1 (shipped):** Established `ROOT_PROFILE_TAG` pattern for platform-agnostic delivery and proved it with runbooks. No glossary delivery work done (deferred to Phase 3 per D-12).

**Phase 2 (shipped):** activity-grill reads glossary (once Phase 3 ships it, line 51 of SKILL.md); treated read-only in Issue Mode (line 94). PRD FR-20 specifies Vocabulary proposals in PRDs/specs; resolved during grilling; appended to glossary "when PRD is approved, not when drafted." No Vocabulary section template exists yet in activity-refine output structure (added in Phase 3 spec). activity-grill and activity-refine have no code that touches the glossary file; they reference its future existence.

**Earlier:** Archived artifacts mention meta-repo `glossary.md` (retired with `dt`); no live references survive Phase 0 deletion.

---

## Relationships

**Install-if-absent registry** ↔ **Consumer delivery** — Phase 3 glossary entry in `INSTALL_IF_ABSENT_FILES` (profiles.ts) flows through `install.ts` and `update.ts` calling `deliverInstallIfAbsentFiles()` → writes to consumer's `docs/domain/ubiquitous-language.md` when absent.

**Doctor warnings** ↔ **Glossary absence** — `doctor.ts:checkGlossaryAbsence()` (new) checks `docs/domain/ubiquitous-language.md` existence and warns if absent (parallel to foundation-doc-names and package-map warnings).

**Docs structure check** ↔ **Glossary index** — `docs-structure.ts:INDEXES` list expanded to include `docs/domain/ubiquitous-language.md`, treating it as a first-level index (parallel to `docs/runbooks/README.md`). Index consistency check runs under `lint`.

**Bounded contexts** ↔ **Package map** — Glossary conformance check (new in `core/checks/`) validates `## Bounded Context:` headers against `docs/tech.md` package map (referential integrity: context names must resolve to package names or freeform domains in the Bounded context column).

**Glossary conformance** ↔ **Verifier Audit Mode** — Verifier's Audit Mode (line 173 of verifier.md) calls `checkDocsStructure()`. Phase 3 adds glossary conformance call to the same check function (new rules in `DocsStructureFinding.rule` enum).

**Activity-grill** ↔ **Glossary read-only** — activity-grill reads glossary in resolve-before-ask step (3) once it ships. No code change required Phase 3; runtime behavior changes when file exists.

**Activity-refine & activity-generate-spec** ↔ **Vocabulary proposals** — PRD FR-20 says "Vocabulary" section proposed in PRDs/specs, resolved during grilling, appended to glossary when PRD approved. Phase 3 spec adds Vocabulary section template to activity-refine output structure and activity-generate-spec output structure.

---

## Risks and Gotchas

1. **Bundle-manifest parity** — bundle-manifest.json must list glossary template in `managed_paths` (for Phase 3 template to ship) and glossary file in `consumer_owned_paths` (to protect consumer edits on `update`). Three-tree skill prose references glossary as future; timing of those updates must align with glossary file existing (Phase 3 delivery, not Phase 2).

2. **Index consistency race** — If `docs/domain/ubiquitous-language.md` is not listed in `docs/README.md` or `docs/domain/` lacks its own `README.md`, `lint` fails on `checkDocsStructure()`. Phase 3 spec must add both files: glossary template itself and a `docs/domain/README.md` index. Omitting either causes the first `lint` after install to fail on the fresh repo.

3. **Frontmatter hand-parsing** — Glossary frontmatter (version, name, description, status, owner) uses the same hand-parse precedent as runbooks and decision logs (D-49 decision: no `yaml` dependency, no devDependencies in dist/). The module ships to consumers inside `dist/core/`, so glossary-check function must not import `yaml` or any external parser. Glossary's bullet-list term body differs from runbook's multi-line frontmatter or decision log's flat table — parser complexity increases.

4. **Glossary absence vs. empty file** — doctor check for glossary absence (missing file) is straightforward; but what if the file exists but is empty or contains only frontmatter? Current doctor pattern (checkFoundationDocNames, checkPackageMap) warn on structural issues, not content. Phase 3 spec must clarify: is an empty glossary a warning or a silent pass?

5. **Bounded-context validation cycle** — If `docs/tech.md` package map is not yet filled (single-package repo, but a monorepo consumer has no packages listed), glossary conformance check will report "bounded context does not resolve to package map" on every glossary term. The check must handle the case where the package map is incomplete or absent, reporting it as a finding rather than crashing.

6. **Three-tree phrase updates** — activity-grill, activity-refine, activity-generate-spec, and verifier agent prose references glossary as "(once Phase 3 ships it)" in `.claude/`, `.github/`, and `.kiro/` versions. Phase 3 spec changes must touch all three trees' prose, or a parity test will catch the skew. The existing parity tests (e.g., `skill-parity-grilling.test.ts`) already validate glossary references; new checks may be needed.

7. **Greenfield symbol extraction** — FR-23 requires verifier to "extract new exported identifiers from the diff" and match them against glossary terms and forbidden synonyms. No TypeScript symbol extraction exists today (core/extract was retired Phase 0). The implementation will be regex-based over export declarations (precedent: deterministic-first, SIMPLICITY.md A4 pressure). False positives (matching code comments, strings, or variable names) are inevitable; spec must clarify "exported identifiers" as `export` keyword + type/class/function/module names, not all occurrences.

8. **Glossary as schema enforcement** — AC-07 requires "PRD using a domain term absent from glossary and without Vocabulary proposal fails refinement with a named finding." This check runs in activity-refine, scanning the PRD body for domain terms (nouns, capitalized, matching a term-scanning pattern). The check is heuristic (false positives on company names, acronyms, or common words); Phase 3 spec must set the confidence threshold so refinement does not reject every PRD that capitalizes "the Order Service".

---

## External Sources

None. This research is codebase-first; all findings are from in-repository files at commit `dac792e`.

---

## Not Investigated

1. **Python stack profile (Phase 4)** — Phase 3 focuses on glossary; Phase 4 adds simplicity-tooling profiles for Python. No Python-specific glossary checks investigated.

2. **Per-package glossary rejection test** — Existing test asserts "one glossary at root"; no test yet for rejecting an attempt to create `docs/packages/order/glossary.md`. Phase 3 tests will add it.

3. **Glossary rendering and presentation** — Phase 3 delivers the markdown file; no tooling to render it as HTML, PDF, or a searchable index. Renderer is out of Phase 3 scope (Phase 6 may cover explainer-grounded definitions).

4. **Glossary migration from old `dt` meta-repo format** — Archived artifacts show old `glossary.md` metadata from the multi-repo context layer. No migration path for consumers who had a meta-repo glossary; Phase 3 assumes fresh start with the new format. Migration is a future runbook, if needed.

5. **Glossary versioning strategy** — File carries a `version:` frontmatter key (per FR-48); no spec for how versions increment or how consumers track compatibility. Phase 3 spec may defer this to Phase 4 or Phase 5 (TDD/teaching phases).

---

## Confidence

**High (90%+).** All findings are from current shipped code and committed decisions (`workstream/decisions-shared-understanding.md` D-45, D-53–D-56). The install-if-absent mechanism, doctor pattern, and docs-structure check are proven patterns by Phase 1 runbooks. The verifier's integration point is documented in the agent contract. No ambiguity about what Phase 3 depends on; only implementation details (e.g., exact error messages, term-scanning heuristics) remain unspecified in the PRD and will be resolved in the Phase 3 specification.

**Medium-high (80%+) for Phase 3–6 forward dependencies** — Phase 5 and Phase 6 features (commit-order evidence, symbol extraction, change maps) are planned but not yet specified. Assumptions about where they integrate (verifier Audit Mode, core/checks module) are consistent with the PRD and the two precedents (Phase 1 docs-structure check, Phase 2 decision-log-format check) but carry execution risk if the spec diverges.
