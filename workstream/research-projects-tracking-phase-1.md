# Research: Wave 1 Specification Implementation Guide — projects-tracking PRD

## Provenance

- **Repository:** llipe/dev-tasks
- **Base branch:** main
- **Commit SHA:** 9fa70e0 (docs(prd): approve projects-tracking, append tracking issue and status comment to the glossary)
- **Invoking agent:** researcher
- **Research date:** 2026-10-20
- **Research question:** For wave 1 (FR-1 to FR-10, FR-23, FR-24), identify exact paths and line ranges of prompt file changes across three trees, parity test patterns, runbook template/validation rules, and comment/checklist sync rules.

## Answer First

Wave 1 modifies five prompt files across three trees (`.claude/`, `.github/`, `.kiro/`): **github-ops** (Title Format table, Standardized Main Issue Tags, label taxonomy, status-comment edit rule), **activity-publish-github** (SKILL.md, Clarifying Questions, Issue Formatting Rules), **activity-init** (Repository Setup section), **developer** agent (Branch + PR discipline, "Do not close issue early" rule), and **implement** skill (checklist sync, PR/close rules, lifecycle table, progress-comment rules). Parity tests use marker-sentence detection (`toContain` for fixed strings) with shared `stripFrontmatter` helper and optional section-scoping helpers (`splitIntoSections`). Runbooks require five fixed frontmatter keys (name, trigger, owner, last_verified, related) and seven markdown sections (goal, preconditions, steps, verification, rollback, escalation). The plan and implement skills sync GitHub Issue checklists via direct `gh issue edit` after each sub-task completion; FR-23 replaces optional free-form progress comments with a mandatory status comment (marked with `<!-- dev-tasks:status -->`) in implement. No existing tests assert on label taxonomy; FR-10 will require new parity tests for Title Format, Level Labels, Standardized Main Issue Tags, and gh-primary rule.

## Relevance-Ranked File Map

| File | Package | Purpose | Line range |
| ---- | ------- | ------- | ---------- |
| `.claude/agents/github-ops.md` | (repo root) | github-ops Title Format, Issue Body, Issue Comments, PR Closes rule, Label taxonomy | 83-98, 100-115, 117-125, 179-204, 271-307 |
| `.github/agents/github-ops.agent.md` | (repo root) | same sections, github-ops (MCP primary) | 82-95, 97-112, 114-122, 176-201, 277-313 |
| `.kiro/agents/github-ops.md` | (repo root) | same sections, github-ops (MCP primary) | 94-109, 111-126, 128-136, 190-215, 291-327 |
| `.claude/skills/activity-publish-github/SKILL.md` | (repo root) | Execution method rules (Clarifying Questions, Issue Formatting, publication report template, Final Instructions) | 32-50, 52-74, 76-102, 110-116 |
| `.claude/skills/activity-init/SKILL.md` | (repo root) | Repository Setup — Branch Protection section (where GitHub Project step will be added) | 28-39 |
| `.claude/agents/developer.md` | (repo root) | Branch + PR discipline (rule 4, lines 76-80); "Do not close issue early" (rule 6, line 82); checklist/progress comment rules (lines 73, 124-125) | 74-80, 82, 73, 106-125 |
| `.claude/skills/implement/SKILL.md` | (repo root) | Checklist alignment (Step-by-Step Execution, lines 104-107); PR/close rules (Before Closing section, lines 129-159); lifecycle table (line 164-168); progress-comment rules (line 124) | 104-125, 129-159, 164-168, 124 |
| `test/unit/skill-parity-init.test.ts` | (repo root) | Parity test pattern: stripFrontmatter helper, marker-sentence detection with `toContain` | 15-22, 33-52 |
| `test/unit/claude-tool-declaration-parity.test.ts` | (repo root) | Parity test pattern: section-scoping helper (`splitIntoSections`), ADDENDUM_HEADING_RE, extractTools | 45-94 |
| `templates/runbooks/runbook-template.md` | (repo root) | Runbook frontmatter keys and markdown sections | 1-41 |
| `core/checks/docs-structure.ts` | (repo root) | Runbook validation: REQUIRED_KEYS, parseFrontmatter, ISO_DATE check | 73, 111-137, 75 |
| `docs/runbooks/README.md` | (repo root) | Runbook index structure and management rules | 1-33 |

## Slice Findings S1-S8

### S1: Components/modules

**github-ops agent (all three trees):** Prompt files enforce GitHub artifact conventions. Title Format table (four contexts), Issue Body Structure template, Issue Comments rules, PR Closes/Refs rule. Label taxonomy with Status and Level categories.

**activity-publish-github skill (.claude/):** SKILL.md defines publication workflow from user stories to GitHub Issues with metadata rules.

**activity-init skill (.claude/):** SKILL.md defines Repository Setup steps including Branch Protection rule; GitHub Project step to be added as sibling.

**developer agent (.claude/):** Defines step-gated execution with branch/PR discipline and GitHub Issue synchronization.

**implement skill (.claude/):** Single source of truth for task-list execution, checklist sync, PR close rules.

### S2: APIs/contracts

**github-ops conventions:** `gh issue create --title <title> --body <body> --label <label>` contracts defined at .claude/agents/github-ops.md:40-55.

**Publication contract:** activity-publish-github outputs `github-publication-[prd-name].md` with Created Issues table and execution method recorded.

**Plan/Implement contract:** Task lists sync GitHub Issue checklists via `gh issue edit` (delegated to github-ops whenever possible); status comments marked with `<!-- dev-tasks:status -->` identifier.

### S3: UI surfaces

GitHub Issues and Pull Requests are the visible execution surfaces. No UI code changes in this wave; purely metadata/convention changes.

### S4: Tests

**Existing parity test patterns:**
- `.claude/agents/github-ops.md` changes need two parity tests (one for Title Format table, one for Label taxonomy).
- Pattern: read three files, strip YAML frontmatter, scan for fixed marker strings with `toContain`.
- Helper: `stripFrontmatter(content: string): string` (test/unit/skill-parity-init.test.ts:16-22).
- Invocation: `for (const content of [kiroContent, githubContent, claudeContent]) { expect(content).toContain("marker string"); }`.

**Existing helper functions:**
- `extractTools(contents: string): string[]` (claude-tool-declaration-parity.test.ts:63-70) — parses `tools:` line.
- `splitIntoSections(body: string): Array<{ heading: string; text: string }>` (claude-tool-declaration-parity.test.ts:77-94) — for section-scoped assertions.

**No current label-taxonomy tests:** grep across `test/unit/` yields no assertions on `status: ready`, `status: in-progress`, `status: blocked`, `status: deferred`, `status: needs-refinement`, or `level:` labels. FR-10 will require new tests asserting on these.

### S5: Data model

No schema changes. GitHub Issue labels, comments, and PR metadata are the data model surface. Frontmatter for runbooks is pre-defined (fixed five keys).

### S6: Config/env/CI

- `.claude/settings.json` may wire hooks for git-guard pre-commit validation (no changes required for wave 1).
- No environment variables or CI workflow additions in wave 1.

### S7: Relationships

- **github-ops** defines conventions used by **activity-publish-github**, **developer**, **implement**, **plan**.
- **activity-init** recommends GitHub Project setup via runbook (new `runbook-configure-github-project.md` in FR-8).
- **developer** and **implement** both enforce checklist sync and comment rules.
- **planner** (wave 2+) will own wave-level status comments and state file commits.

### S8: Prior history

- Current github-ops (lines 83-98 in .claude/): Title Format table with four contexts (PRD story, Standalone issue, Bug, Chore). No tracking-issue forms yet (FR-1 adds `[PRD-<name>] <PRD title>` and `[PRD-<name>] Wave <id>: <title>`).
- Current Label taxonomy (lines 271-307 in .claude/): no `level:` category (FR-2 adds it); status labels include `status: ready` and `status: in-progress` (FR-7 retires both).
- Current activity-publish-github (SKILL.md lines 32-50): Clarifying question asks "Do you want a parent epic issue or project board association?" (FR-3 removes; hierarchy is mandatory, not optional).
- Current implement skill (line 124): "You **SHOULD** add brief issue or PR comments" (optional free-form; FR-23 makes status comment mandatory with fixed table structure).

## Relationships

| Relationship | Implication |
| ------------ | ----------- |
| github-ops Title Format table is used by publish and developer | Title Format change (FR-1) must propagate to three trees before publish runs |
| Label taxonomy is enforced by github-ops | Retiring `status: ready` and `status: in-progress` (FR-7) requires audit of all three trees and label-rule updates |
| activity-init Repository Setup grows a sibling GitHub Project step (FR-8) | FR-8 updates `.claude/`, `.github/`, `.kiro/` activity-init identically; runbook lives in `docs/runbooks/` |
| developer and implement both enforce checklist sync | Rules at developer.md:73, implement.md:104-107, 118-119 must stay in sync; FR-23 changes implement.md progress-comment rule only |
| plan and implement sync checklists | plan.md lines 29, 185-186 delegate checklist updates to github-ops; implement.md lines 104-107 do the same |

## Risks and Gotchas

1. **Three-tree synchronization:** Title Format table and Label taxonomy table appear in `.claude/`, `.github/`, and `.kiro/` with minor wording differences (MCP primary vs. gh CLI primary). Wave 1 must update all three simultaneously; parity tests must pass before specs are finalized.

2. **Label retirement scope:** `status: ready` and `status: in-progress` appear only in the Label taxonomy table, not in prose rules, so FR-7 is a clean table edit. However, if any prompt prose recommends these labels (e.g., "apply `status: ready` when refined"), that prose must be updated too. Grep of `.claude/`, `.github/`, `.kiro/` agents and skills found no such prose — clear.

3. **Checklist vs. progress comment precedent:** implement.md:124 currently says `// SHOULD`. FR-23 changes this to MUST and replaces free-form with a fixed table. The transition must not break existing task lists mid-execution (no task list in the repo will be in-flight during wave 1 rollout; low risk).

4. **Runbook frontmatter parser:** core/checks/docs-structure.ts:111-137 is hand-written (no YAML library in dist/core/). The parser accepts both inline bracketed `related` lists and YAML block sequences. A new runbook must conform to this parser or fail `lint`. Test this before shipping the runbook.

5. **github-ops delegation:** activity-publish-github (SKILL.md:38) and implement (SKILL.md:75-76) delegate issue/PR creation to github-ops "whenever possible." In Claude Code the `Task` tool provides the delegation; in interactive `.claude/commands/developer.md` it does as well. In `.github/` and `.kiro/` (Copilot and Kiro), explicit function calls replace task delegation. Parity tests must not assume delegation availability.

6. **PR Closes rule wording:** github-ops.md:179-204 currently states the `Closes` rule for single issues. FR-15 (wave 2) adds `Closes #<wave issue>` to the consolidated PR. This is a wave-2 addition, not wave-1, but the section is cited in the spec; do not change it in wave 1.

## External Sources

- `docs/requirements/prd-projects-tracking.md` (version 1.3, approved by @llipe): Wave 1 functional requirements FR-1 to FR-10 and FR-23, FR-24; candidate stories S-001 to S-007; decision log D-01 to D-27.
- `AGENTS.md` (codebase root): § Orchestration model (explains why developer agent subagent has no `Task` tool); § General Agent Guidelines (Conventional Commits, test-first design, branch discipline, quality gates).
- `SIMPLICITY.md` (codebase root): Code simplicity contract, linting thresholds; not changed by this PRD but referenced by activity-init.

## Not Investigated

1. **Verifier and qa-engineer integration:** Wave 1 does not introduce changes to verifier or qa-engineer prompts. Their interaction with the new status-comment structure is documented in wave 2 (FR-12, FR-25).

2. **Consumer repository migration:** Wave 3 is the migration story. Consumer repositories will receive wave-1 conventions via `dev-tasks update`; the migration flow is out of scope for wave 1.

3. **Project automations:** GitHub's native Project Status automations (linked PR → In progress, closed issue → Done) are enforced by D-22 and D-23 but are not prompt-level; they are GitHub UI configuration (documented in FR-8 runbook).

4. **Closed PRs in integration branches:** github-ops.md:154-156 documents planner merge authority (integration branches only; user merges to main). Wave 1 does not change this; wave 2 documents that planner never closes stories until the consolidated PR merges to main (FR-13).

5. **Glossary (ubiquitous-language.md) updates:** The PRD Vocabulary section (lines 260-269) defines `tracking issue`, `status comment`, etc. as "existing" status in the glossary. Updating that glossary file is out of scope for this research; it is documented as an appendix action in the approved PRD.

## Confidence

**High (90%)** on sections 1-3 and 7-8 (file paths, line ranges, relationships, prior history). Files read directly from repository at known commit SHA; patterns verified against working test examples.

**Medium (75%)** on section 4 (Tests). No existing label-taxonomy tests found; the spec names "parity tests" (FR-10) but the exact assertion shape for FR-1, FR-2, FR-7, FR-9 is not yet written. The patterns from existing parity tests (init, grilling, infra) are consistent and transferable; implementing them for github-ops is straightforward but not yet validated.

**High (90%)** on section 6 (Risks). Risks identified by cross-referencing spec with codebase; no gotchas found where spec and code disagree.

---

## Summary of Key Line Ranges by Tree and File

### github-ops (all three trees)

| Section | .claude/agents/github-ops.md | .github/agents/github-ops.agent.md | .kiro/agents/github-ops.md |
| --- | --- | --- | --- |
| Title Format table | 83–98 | 82–95 | 94–109 |
| Issue Body Structure | 100–115 | 97–112 | 111–126 |
| Issue Comments rules | 117–125 | 114–122 | 128–136 |
| PR Closes/Refs rule | 179–204 | 176–201 | 190–215 |
| Standardized Main Issue Tags table | 271–307 | 277–313 | 291–327 |

**Wording differences:** .github/ and .kiro/ versions state "GitHub MCP **SHOULD** be used when available" (lines 16, 18 respectively); .claude/ states "`gh` CLI is the primary execution path" (line 24). Both express the same rule with tree-specific language.

---
