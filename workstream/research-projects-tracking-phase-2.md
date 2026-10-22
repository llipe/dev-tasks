# Research: projects-tracking Wave 2 Specification Anchors

## Changelog

| Version | Date       | Summary                                                                         |
| ------- | ---------- | ------------------------------------------------------------------------------- |
| 1.0     | 2026-10-21 | Initial research for Wave 2 specification writing, FR-11 to FR-16 and FR-25    |

## Provenance

**Repository:** llipe/dev-tasks  
**Base branch:** main (782d7e2)  
**Invoking agent:** product-engineer (pre-spec)  
**Research question:** Locate exact line ranges and text anchors in planner, verifier, and github-ops across three platform trees, and identify parity-test helpers for Wave 2 blocks.  
**Date:** 2026-10-21

---

## Answer First

**Planner specs exist in three platform trees with wording differences** (lines 148–577 across files), particularly in merge-gate language (step 13 cliff between .claude and .github). **Verifier's Roadmap-Mismatch Finding is identical across .claude and .github** (lines 250–261) and compares `docs/roadmap.md` against the wave issue and its sub-issues. **github-ops "Closes #<number> or Refs #<number>" rule is at line 257**; Status comment template is at lines 131–158. **Planner-state format** (line 163 planner.md) carries Run Info, Story Status, Current Position, Decisions Log; **"Wave issue: #N" line would insert in Run Info** (around line 167–174, post-Integration branch, pre-Repository). **Implement's Status Comment procedure** (lines 122–132 in `.claude/skills/implement/SKILL.md`) documents marker finding, creation, in-place editing, and duplicate handling. **Projects-tracking parity test** loads three trees via `loadTrees()` and helpers `sectionOf()`, `splitIntoSections()`, `collectSection()`, `squashSpaces()`; test references planner only via roadmap-assertion context, not planner text pins.

---

## Relevance-Ranked File Map

| Package  | File Path | Lines | Purpose |
| -------- | --------- | ----- | ------- |
| (repo root) | `.claude/commands/planner.md` | 148–194, 325–430, 450–472, 487–527, 529–537, 560–577 | Phase 0.5, Phase 4 handoff template, merge-management rule, Phase 5, Roadmap Maintenance, Invariants |
| (repo root) | `.github/agents/planner.agent.md` | 139–184, 316–420, 441–459, 478–516, 520–527, 550–566 | Planner agent (three trees carry same sections; wording differs on merge gates 5, 6, 13) |
| (repo root) | `.kiro/agents/planner.md` | 176–221, 353–457, 478–500, 515–553, 557–564, 587–603 | Planner agent kiro version |
| (repo root) | `.claude/agents/verifier.md` | 250–262 | Roadmap-Mismatch Finding definition |
| (repo root) | `.github/agents/verifier.agent.md` | 248–261 | Roadmap-Mismatch Finding (identical wording) |
| (repo root) | `.claude/agents/github-ops.md` | 131–158, 257 | Status comment subsection; Closes/Refs rule |
| (repo root) | `.claude/agents/developer.md` | 83, 316–317 | Non-close rule (dev rule 6); implement rules 12–13 |
| (repo root) | `.claude/skills/implement/SKILL.md` | 122–132, 134–141, 183 | Status Comment procedure; Wave Status Update; lifecycle table "Then close issue" |
| (repo root) | `test/unit/projects-tracking-parity.test.ts` | 20–26, 42–71, 80–85, 92–98, 106–114, 120–122 | Helper functions: stripFrontmatter, splitIntoSections, loadTrees, collectSection, sectionOf, squashSpaces |

---

## S1 — Components/Modules

Planner, verifier, github-ops, and implement skill are the four agents/procedures under investigation. All reside in prompt trees (`.claude/`, `.github/`, `.kiro/`). Parity testing infrastructure is in `test/unit/`. No new modules.

---

## S2 — APIs/Contracts

**Planner State File Contract (line 163):**
Path: `/workstream/planner-state-<plan-id>.md`

```markdown
# Planner State: <plan-id>

## Run Info
- Task source: <path or milestone>
- Integration branch: <branch-name>
- Repository: <owner/repo>
- Started: <timestamp>
- Last updated: <timestamp>

## Story Status
| Sequence | Story ID | Issue # | Status | PR | Branch |

## Current Position
- Next story: <id>
- Last merged PR: <number>
- Integration branch HEAD: <sha>

## Decisions Log
- <decisions made during run>
```

**Wave issue insertion point:** The `Wave issue: #N` line for FR-21 (wave 3 document backfill) would logically follow `Repository: <owner/repo>` and precede `Started:` in the Run Info section. Suggested line would be:
```
- Wave issue: #<number>
```

This matches the pattern of other identifiers (task source, integration branch, repository).

---

## S3 — UI Surfaces

No UI changes; all output is GitHub Issues, PRs, and markdown artifacts.

---

## S4 — Tests

**Test file:** `test/unit/projects-tracking-parity.test.ts` (lines 1–954)

**Helper functions with lines:**
- `stripFrontmatter()` (lines 20–26): removes YAML frontmatter for comparison across platforms
- `interface Section` (lines 35–40): type for section metadata (heading, level, text)
- `splitIntoSections()` (lines 42–71): **level-aware** section parser; ignores heading markers inside code fences (backtick fences); produces preamble section with empty heading and level 0
- `interface TreeCopy` (lines 73–78): tree/path/body/sections tuple
- `loadTrees()` (lines 80–85): reads three platform tree files, strips frontmatter, parses sections; paths passed as `Record<string, string>`
- `collectSection()` (lines 92–98): collects a section's text plus all child sections of deeper level, up to equal/higher level; preserves child heading lines so the span reads like source
- `sectionOf()` (lines 106–114): **selector function** — finds a section by heading text, optionally by a substring (`containing` parameter); level-aware (a `##` section includes its `###` children); throws if no match
- `squashSpaces()` (lines 120–122): collapses runs of spaces for table-row matching (prettier may reformat column padding)

**Planner text pins:**
The test does not pin planner text directly. It references planner state and roadmap through other contexts (roadmap update assertions). No standalone `describe("planner", ...)` block exists in this file; planner appears only in the `github-ops` and broader test contexts (e.g., in comments about merge gates).

**Notable test case — S4 helper verification (lines 129–147, 153–181):**
- `splitIntoSections ignores headings inside code fences` (lines 130–147): proves the parser respects fence boundaries
- `sectionOf collects child headings of a deeper level` (lines 153–181): proves level-aware collection works for `##` → `###` → `####` hierarchy

**PROJECT_WRITE constant (line 703):**
```typescript
const PROJECT_WRITE = /gh\s+project\s+item-(edit|add)\b/;
```
Used by guards to block agent-written Project Status updates (FR-6, no `gh project item-edit` or `item-add` in any prompt tree).

---

## S5 — Data Model

No schema changes. Planner state file is a new markdown artifact. GitHub issues (tracking issues, status comments) use existing fields plus new mandatory `level:` label and status comment marker.

---

## S6 — Config/Env/CI

**Parity test configuration:** Helpers hardcode file paths as arguments to `loadTrees()`. Planner paths would be:
```typescript
const PLANNER_TREES = {
  claude: ".claude/commands/planner.md",
  github: ".github/agents/planner.agent.md",
  kiro: ".kiro/agents/planner.md",
};
```

Wave 1 tests at line 186–190 show the pattern. Note: planner is a command (`.claude/commands/`) not just an agent.

---

## S7 — Relationships

**Wording differences between trees (critical for parity tests):**

| Section | Claude | GitHub | Kiro | Variance |
| ------- | ------ | ------ | ---- | -------- |
| Phase 4, step 5 (QA gate) | Line 460: delegates to `qa-engineer` directly, specifies "merge gate 5" | Line 451: same language | Line 488: same language | **No wording difference observed** |
| Phase 4, step 6 (verifier) | Line 461: "invoke `verifier` in Audit Mode directly"; notes self-reported `not-run(no-delegation)` is "valid, expected" | Line 452: "Verify the delegated closeout payload reports `verifier_audit: run`"; drift findings "MUST NOT" block | Line 489: same as .github | **Divergence: .claude says direct invocation mandatory; .github says verify self-report only** |
| Phase 4, step 13 | Line 468: "Verify the merge actually happened, then write checkpoint" — requires `gh pr view <n>` confirmation before writing ✅ Merged | Line 459: "Write checkpoint" — no verification step named | Line 496: "Verify the merge actually happened, then write checkpoint" — matches .claude | **Divergence: .github omits the verification command; .claude/.kiro both require it** |
| Invariants | Line 576: "planner **MUST** invoke `qa-engineer` and `verifier` (Audit Mode) directly, scoped to each story's diff/branch/PR, before merging that story's PR" | Line 566: "planner **MUST** verify `verifier_audit: run` in every story's closeout payload before merging that story's PR, and **MUST** invoke `verifier` in `audit` mode for a PRD-level rollup audit" | Line 603: same as .github | **Divergence: .claude emphasizes direct invocation as mandatory; .github emphasizes payload verification + rollup** |

**github-ops Status comment subsection (lines 131–158, identical across trees):**
Defines the marker `<!-- dev-tasks:status -->`, the prefix line `🔄 Update: <summary> — Refs #<issue>`, and three template tables (story, wave, PRD). All three trees carry the same template.

**Planner state file format (line 163, identical across trees):**
All three planner copies carry the same state file format definition.

---

## S8 — Prior History

Wave 1 shipped conventions and hierarchy (PR #282, merged 2026-10-20). Rollup analysis (finding R-1) and decision D-50 established that GitHub links PRs only when the base is the default branch, so status moves at consolidated PR, not story PR.

---

## Risks and Gotchas

1. **Wording cliff on merge gates 5–6–13 (planner).** The `.github` version of the planner omits the direct `qa-engineer` and `verifier` invocation language and replaces it with "verify payload report" + "invoke at PRD level." Wave 2 specifications must align language across all three trees before parity tests run. Test at lines 566–577 of `.claude/commands/planner.md` and lines 560–566 of `.github/agents/planner.agent.md` to confirm alignment.

2. **Planner state file format has no "Wave issue: #N" anchor.** FR-21 (wave 3 document backfill) reads existing planner-state files to backfill the `Wave issue: #N` line. The format template (line 163) does not show where this line goes. Insertion point is Run Info section, after Repository line, before Started. Confirm with product-engineer before coding.

3. **Status Comment procedure is in implement skill, not in developer agent or github-ops.** Three agents reference it (developer line 75, implement line 124 header, github-ops line 139 template). Wave 2 references must use the same procedure anchor. Line 122 in `.claude/skills/implement/SKILL.md` is the single source of truth.

4. **Verifier Roadmap-Mismatch Finding applies only to PRD-level rollup audits and story audits that complete a phase/wave (trigger line 254).** Wave 2 spec must clarify when the planner triggers the finding — at consolidated PR time, when does it compare?

5. **No planner text is pinned by existing tests.** The parity test file does not have a `describe("planner", ...)` block. Wave 2 tests for planner text (merge gate language, invariants, state file format) would need new describe blocks and loadTrees calls at lines 186–190 pattern.

---

## External Sources

- Issue #285: "Wave 2 inherits D-50: Project Status moves at consolidated PR, not story PR" — links to PRD rollup finding R-1 and decision D-50 (GitHub automations and closing behavior).
- PRD v1.6 (lines 1–272): defines FR-11 to FR-16 and FR-25; changelog records design-mode findings A-5, A-18, and rollup findings R-1 from wave 1 audit.

---

## Not Investigated

None identified. All research questions resolved to specific line numbers and file paths.

---

## Confidence

**High** on planner phase/section locations, verifier Roadmap-Mismatch Finding language, github-ops rules, implement Status Comment procedure, and parity-test helpers. **Medium-High** on wording divergence interpretation (the `.github` version's emphasis on payload verify vs. .claude's direct invocation may be intentional per design or may be a parity gap to close in Wave 2). Recommend spot-checking the three trees' merge gate invariants with product-engineer before finalizing Wave 2 spec language.
