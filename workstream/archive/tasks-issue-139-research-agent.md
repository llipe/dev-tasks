# Implementation Plan - Issue #139: feat: research agent

## Relevant Files

### Agent definitions (create)

- `.kiro/agents/researcher.md` - Kiro agent definition with frontmatter
- `.github/agents/researcher.agent.md` - GitHub Copilot agent definition
- `.claude/agents/researcher.md` - Claude Code subagent definition

### Entry points (create)

- `.github/prompts/researcher.prompt.md` - GitHub Copilot prompt entry point
- `.claude/commands/researcher.md` - Claude Code command entry point

### Skill (create)

- `.github/skills/activity-codebase-research/SKILL.md` - Copilot skill
- `.claude/skills/activity-codebase-research/SKILL.md` - Claude skill
- `.kiro/skills/activity-codebase-research/SKILL.md` - Kiro skill

### Caller wiring (modify)

- `.kiro/agents/product-engineer.md` - Add pre-refine/pre-spec research step
- `.github/agents/product-engineer.agent.md` - Add pre-refine/pre-spec research step
- `.claude/commands/product-engineer.md` - Add pre-refine/pre-spec research step
- `.kiro/agents/developer.md` - Add troubleshooting invocation path
- `.github/agents/developer.agent.md` - Add troubleshooting invocation path
- `.claude/agents/developer.md` - Add troubleshooting invocation path
- `.kiro/agents/planner.md` - Add pre-orchestration scoping path
- `.github/agents/planner.agent.md` - Add pre-orchestration scoping path
- `.claude/commands/planner.md` - Add pre-orchestration scoping path

### Documentation (modify)

- `AGENTS.md` - Add researcher to agents table, update counts
- `AGENTS.md.template` - Mirror AGENTS.md changes
- `CLAUDE.md` - Add researcher to subagent roster, update counts
- `CLAUDE.md.template` - Mirror CLAUDE.md changes
- `README.md` - Add researcher to agents table
- `docs/system-overview.md` - Add researcher to agent roster and artifact list
- `docs/workflow-chains.md` - Update chains with conditional research step
- `CHANGELOG.md` - Add entry for researcher agent

### ADR (create)

- `docs/adr/ADR-004-researcher-pre-spec-research-step.md` - Architecture decision record
- `docs/adr/README.md` - Add index row

### Tests (create)

- `test/unit/researcher-parity.test.ts` - Cross-platform presence and contract parity
- `test/unit/researcher-artifact-contract.test.ts` - Artifact section contract and budget constants
- `test/unit/skill-parity-codebase-research.test.ts` - Skill parity across three trees

## Tasks

- [x] 1.0 Implement Issue #139 - https://github.com/gaib-ai/dev-tasks/issues/139: Create `activity-codebase-research` skill

  > Note: The skill carries the slice procedure and budget caps. It is the single source of truth for the eight-slice taxonomy and context budget constants. Agent definitions reference the skill.

  - [x] 1.1 Author `.github/skills/activity-codebase-research/SKILL.md` with full procedure: eight-slice taxonomy (S1-S8), budget caps (250 lines, 30 files), artifact path contract, ten required sections, intake/execution/output phases, multi-repo detection, staleness provenance, and untrusted-input handling
  - [x] 1.2 Copy to `.claude/skills/activity-codebase-research/SKILL.md` (identical behavioral content, platform frontmatter may differ)
  - [x] 1.3 Copy to `.kiro/skills/activity-codebase-research/SKILL.md` (identical behavioral content, Kiro frontmatter)
  - [x] 1.4 Verify AC-2: All three trees declare all eight slices and both budget caps
  - [x] 1.5 Write `test/unit/skill-parity-codebase-research.test.ts` - presence in all three trees, identical behavioral content (strip frontmatter), eight slices and budget caps declared
  - [x] 1.6 Run tests: `pnpm run test`

- [x] 2.0 Implement Issue #139 - https://github.com/gaib-ai/dev-tasks/issues/139: Create `researcher` agent definitions

  > Note: The agent ships on all three platforms plus both entry points. Kiro variant requires specific frontmatter (description, tools, no permissions). All variants must carry equivalent behavioral contract.

  - [x] 2.1 Author `.kiro/agents/researcher.md` with YAML frontmatter (`description`, `tools: [read, shell, write]`, no `permissions` block), behavioral contract (read-only authority, eight-slice reference, budget caps, artifact path, non-mandatory status, staleness provenance, multi-repo fallback, untrusted-input rule), and single-procedure execution flow
  - [x] 2.2 Author `.github/agents/researcher.agent.md` with equivalent behavioral contract adapted for Copilot format
  - [x] 2.3 Author `.claude/agents/researcher.md` as a subagent with equivalent behavioral contract adapted for Claude Code format
  - [x] 2.4 Author `.github/prompts/researcher.prompt.md` entry point
  - [x] 2.5 Author `.claude/commands/researcher.md` entry point
  - [x] 2.6 Verify AC-1: All five files exist, are non-empty, carry equivalent contract (read-only, eight slices, budget caps, artifact path, non-mandatory); Kiro frontmatter has `description`/`tools`, no `permissions`
  - [x] 2.7 Verify AC-5: Read-only prohibition stated explicitly on all three platforms
  - [x] 2.8 Write `test/unit/researcher-parity.test.ts` - file presence across five paths, contract-statement regexes in all three agent variants, Kiro frontmatter conformance (description/tools, no permissions), read-only prohibition
  - [x] 2.9 Run tests: `pnpm run test`

- [x] 3.0 Implement Issue #139 - https://github.com/gaib-ai/dev-tasks/issues/139: Wire callers with conditional triggers

  > Note: `product-engineer` (Issue Mode pre-refine, Feature Mode pre-spec), `developer` (troubleshooting), `planner` (pre-orchestration). All wiring is conditional/recommended, never mandatory. Trivial issues skip research.

  - [x] 3.1 Update `.kiro/agents/product-engineer.md` - add research step in Issue Mode (pre-refine) and Feature Mode (pre-spec) with trigger heuristics; update mode-detection table; state conditional/non-blocking
  - [x] 3.2 Update `.github/agents/product-engineer.agent.md` - equivalent wiring
  - [x] 3.3 Update `.claude/commands/product-engineer.md` - equivalent wiring
  - [x] 3.4 Update `.kiro/agents/developer.md` - add troubleshooting invocation path with conditional trigger
  - [x] 3.5 Update `.github/agents/developer.agent.md` - equivalent wiring
  - [x] 3.6 Update `.claude/agents/developer.md` - equivalent wiring
  - [x] 3.7 Update `.kiro/agents/planner.md` - add pre-orchestration scoping path with conditional trigger
  - [x] 3.8 Update `.github/agents/planner.agent.md` - equivalent wiring
  - [x] 3.9 Update `.claude/commands/planner.md` - equivalent wiring
  - [x] 3.10 Verify AC-6: All callers document conditional triggers; no blocking gate added; trivial single-file issue proceeds to refine without research
  - [x] 3.11 Add caller-wiring assertions to `test/unit/researcher-parity.test.ts` - grep caller files for research step and conditional language
  - [x] 3.12 Run tests: `pnpm run test`

- [x] 4.0 Implement Issue #139 - https://github.com/gaib-ai/dev-tasks/issues/139: Artifact contract tests

  > Note: Pure test helpers for the ten required sections, slice completeness, and budget-cap boundary comparators. These validate the contract structurally even without a real research run.

  - [x] 4.1 Write `test/unit/researcher-artifact-contract.test.ts` with: ten required sections listed and ordered, slice completeness check (populated or `N/A` with reason), budget-cap boundary comparators (249/250/251 lines; 29/30/31 files), provenance fields check (base branch + commit SHA), and relevance-ranking assertion
  - [x] 4.2 Verify AC-3: Artifact section contract validatable (section order, slice completeness)
  - [x] 4.3 Verify AC-4: Budget comparators test boundary conditions
  - [x] 4.4 Verify AC-7: Provenance fields required by test
  - [x] 4.5 Run tests: `pnpm run test`

- [x] 5.0 Implement Issue #139 - https://github.com/gaib-ai/dev-tasks/issues/139: ADR-004 and documentation updates

  > Note: Update all registries and docs to list the new agent and skill with corrected counts.

  - [x] 5.1 Create `docs/adr/ADR-004-researcher-pre-spec-research-step.md` with Context, Decision, Consequences, and Alternatives Considered sections
  - [x] 5.2 Add index row to `docs/adr/README.md`
  - [x] 5.3 Update `AGENTS.md` - add `researcher` to agents table, add `activity-codebase-research` to activity skills table, update platform-coverage sentence (Copilot/Kiro ten, Claude subagents eight)
  - [x] 5.4 Update `AGENTS.md.template` - mirror changes from 5.3
  - [x] 5.5 Update `CLAUDE.md` - add `researcher` to subagent roster, update count (seven -> eight), add to commands table
  - [x] 5.6 Update `CLAUDE.md.template` - mirror changes from 5.5
  - [x] 5.7 Update `README.md` - add `researcher` to agents table
  - [x] 5.8 Update `docs/system-overview.md` - add researcher to agent roster and `/workstream/research-*.md` to artifact list
  - [x] 5.9 Update `docs/workflow-chains.md` - update Single-Issue chain (`research -> refine -> plan`), Full-Feature chain (`refine -> research -> generate-spec -> ...`), add standalone Codebase Research chain
  - [x] 5.10 Add entry to `CHANGELOG.md`
  - [x] 5.11 Verify AC-9: All registries and docs list researcher and skill with correct counts; ADR-004 exists and is indexed
  - [x] 5.12 Add registry-consistency assertions to `test/unit/researcher-parity.test.ts` - grep AGENTS.md, CLAUDE.md, README.md, docs/system-overview.md, docs/workflow-chains.md, docs/adr/README.md for researcher references
  - [x] 5.13 Run tests: `pnpm run test`

- [x] 6.0 Implement Issue #139 - https://github.com/gaib-ai/dev-tasks/issues/139: Quality gates and final verification

  - [x] 6.1 Run `pnpm run lint` and fix any issues
  - [x] 6.2 Run `pnpm run format:check` and fix any issues
  - [x] 6.3 Run `pnpm run typecheck` and fix any issues
  - [x] 6.4 Run `pnpm run test` — confirm all new tests pass and are reachable from aggregate test script
  - [x] 6.5 Run `pnpm run audit` and address findings
  - [x] 6.6 Verify AC-8: Multi-repo path documented (dt context/catalog when component.json exists, fallback otherwise) in agent and skill definitions
  - [x] 6.7 Verify AC-10: All quality gates pass; new tests reachable from aggregate test script per `/TESTING.md`
  - [x] 6.8 Run `pnpm run validate` (aggregate gate)

## AC-to-Task Mapping

| AC    | Primary Task(s) | Validation Method |
| ----- | --------------- | ----------------- |
| AC-1  | 2.1-2.5, 2.6   | `researcher-parity.test.ts` — presence, contract, frontmatter |
| AC-2  | 1.1-1.3, 1.4   | `skill-parity-codebase-research.test.ts` — three trees, slices, caps |
| AC-3  | 4.1, 4.2       | `researcher-artifact-contract.test.ts` — section order, slice completeness |
| AC-4  | 4.1, 4.3       | `researcher-artifact-contract.test.ts` — boundary comparators |
| AC-5  | 2.1-2.3, 2.7   | `researcher-parity.test.ts` — prohibition text |
| AC-6  | 3.1-3.9, 3.10  | `researcher-parity.test.ts` — caller wiring assertions |
| AC-7  | 4.1, 4.4       | `researcher-artifact-contract.test.ts` — provenance fields |
| AC-8  | 1.1, 2.1, 6.6  | Manual + contract text in skill/agent |
| AC-9  | 5.1-5.10, 5.11 | `researcher-parity.test.ts` — registry grep assertions |
| AC-10 | 6.1-6.8        | `pnpm run validate` |
