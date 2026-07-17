# Implementation Plan - Token-Usage Optimization for dev-tasks

> **GitHub Issue:** [#28](https://github.com/llipe/dev-tasks/issues/28) - chore: reduce per-turn token usage via scoped steering and slimmed AGENTS.md

## Relevant Files

- `.kiro/steering/plan.md` - Activity playbook for plan phase (front-matter changed to fileMatch)
- `.kiro/steering/implement.md` - Activity playbook for implement phase (front-matter changed to fileMatch)
- `.kiro/steering/git-guard-notice.md` - Git guard enforcement gap notice (trimmed to 56 words)
- `.kiro/steering/nextjs-pages-components.md` - Next.js/React component rules (narrowed to `**/app/**/*.tsx`)
- `.github/instructions/plan.instructions.md` - Copilot plan instruction (scope narrowed to `workstream/**`)
- `.github/instructions/implement.instructions.md` - Copilot implement instruction (scope narrowed)
- `.github/instructions/domain/nextjs-pages-components.instructions.md` - Copilot Next.js instruction (tightened)
- `.kiro/agents/developer.md` - Developer agent (added Steering Context Check)
- `.kiro/agents/product-engineer.md` - Product-engineer agent (added Steering Context Check)
- `.github/agents/developer.agent.md` - GitHub developer agent (added Steering Context Check)
- `.github/agents/product-engineer.agent.md` - GitHub product-engineer agent (added Steering Context Check)
- `.claude/agents/developer.md` - Claude developer agent (added Steering Context Check)
- `.claude/commands/product-engineer.md` - Claude product-engineer (added Steering Context Check)
- `.kiro/skills/memo-cli-usage/SKILL.md` - Memo CLI quick-ref (553 words)
- `.kiro/skills/memo-cli-usage/REFERENCE.md` - Memo CLI full documentation
- `.github/skills/memo-cli-usage/SKILL.md` - Memo CLI quick-ref for Copilot
- `.github/skills/memo-cli-usage/REFERENCE.md` - Memo CLI full doc for Copilot
- `.claude/skills/memo-cli-usage/SKILL.md` - Memo CLI quick-ref for Claude Code
- `.claude/skills/memo-cli-usage/REFERENCE.md` - Memo CLI full doc for Claude Code
- `.kiro/skills/activity-init/SKILL.md` - Added AGENTS.md sizing section
- `.github/skills/activity-init/SKILL.md` - Added AGENTS.md sizing section
- `.claude/skills/activity-init/SKILL.md` - Added AGENTS.md sizing section
- `AGENTS.md` - Root project description (slimmed to 1,063 words)
- `AGENTS.md.template` - Template for consumers (slimmed to 1,031 words)
- `docs/agents-md-guidelines.md` - New: guidelines for healthy AGENTS.md sizing
- `docs/workflow-chains.md` - New: relocated Workflow Chains content
- `.gitignore` - Added exceptions for new docs files
- `workstream/specification-token-optimization-devtasks.md` - Updated with measured results

## Tasks

- [x] 1.0 Convert plan/implement steering from `always` to `fileMatch` (R1)
  - [x] 1.1 Edit `.kiro/steering/plan.md` front-matter: change `inclusion: always` to `inclusion: fileMatch` with `fileMatchPattern: "workstream/**"` 
  - [x] 1.2 Edit `.kiro/steering/implement.md` front-matter: change `inclusion: always` to `inclusion: fileMatch` with `fileMatchPattern: "workstream/**/tasks-*.md"`
  - [x] 1.3 Edit `.github/instructions/plan.instructions.md` front-matter: change `applyTo: "**"` to `applyTo: "workstream/**"`
  - [x] 1.4 Edit `.github/instructions/implement.instructions.md` front-matter: change `applyTo: "**"` to `applyTo: "workstream/**/tasks-*.md"`
  - [x] 1.5 Add lightweight context-check instruction to relevant Kiro agents: developer.md should note "If no `workstream/tasks-*.md` file is open or referenced, load the implement steering by opening the relevant task file first"; product-engineer.md should note "If no workstream planning artifact is open, reference the relevant workstream file to ensure plan guidance loads"
  - [x] 1.6 Add equivalent lightweight context-check note in `.github/agents/developer.agent.md` and `.github/agents/product-engineer.agent.md`
  - [x] 1.7 Add equivalent lightweight context-check note in `.claude/agents/developer.md` and `.claude/commands/product-engineer.md`
  - [x] 1.8 Update `AGENTS.md` Instructions table to reflect new scopes (change `**` to new patterns)
  - [x] 1.9 Update `AGENTS.md.template` Instructions table to match
  - [x] 1.10 Verify: confirm body content of plan.md and implement.md is unchanged (diff only front-matter)
  - [x] 1.11 Verify Acceptance Criteria: plain chat turn without workstream files should not inject either playbook
  - [x] 1.12 Verify Acceptance Criteria: opening a tasks-*.md file should trigger implement guidance
  - [x] 1.13 Verify Acceptance Criteria: opening a workstream planning artifact triggers plan guidance

- [x] 2.0 Tighten Next.js/React steering fileMatchPattern (R2)
  - [x] 2.1 Rename `.kiro/steering/nextjs-pages-components.md` to indicate it's a Next.js App Router specific rule; update `fileMatchPattern` from `"**/*.tsx"` to `"**/app/**/*.tsx"` (Next.js App Router convention — pages, layouts, components within app dir)
  - [x] 2.2 Update `.github/instructions/domain/nextjs-pages-components.instructions.md` `applyTo` from `"**/*.tsx"` to `"**/app/**/*.tsx"`
  - [x] 2.3 Add a comment block at the top of both files (below front-matter): `<!-- Consumers: adjust fileMatchPattern/applyTo to match your Next.js app path. For React Native projects, replace with a react-native steering file (see issue #13). -->`
  - [x] 2.4 Update `AGENTS.md` and `AGENTS.md.template` Instructions table scope column to reflect new pattern
  - [x] 2.5 Verify Acceptance Criteria: editing a `.tsx` file outside `app/` directory does NOT inject the Next.js rule
  - [x] 2.6 Verify Acceptance Criteria: editing a `.tsx` file inside an `app/` directory DOES inject the rule

- [x] 3.0 Slim AGENTS.md and create consumer sizing guidelines (R3)
  - [x] 3.1 Review current `AGENTS.md` and `AGENTS.md.template` — identify content that is reference/documentation vs. operational guidance needed every turn
  - [x] 3.2 Slim `AGENTS.md.template`: remove Workflow Chains section (move to a `docs/workflow-chains.md` reference doc); remove Prompts table (agents already carry their invocation modes); keep: Core Idea, Design Standard Contract, Taxonomy, Agents table, Skills tables, Instructions table, General Agent Guidelines
  - [x] 3.3 Slim `AGENTS.md` to match the template restructure
  - [x] 3.4 Create `docs/agents-md-guidelines.md` with: purpose of AGENTS.md, recommended max size (~1000 words / ~1,350 tokens), what belongs (operational rules enforced every turn) vs. what doesn't (reference docs, workflow diagrams, post-mortems), instructions for consumers to run `product-engineer init` to generate a right-sized AGENTS.md
  - [x] 3.5 Add a note in `AGENTS.md.template` header pointing to the guidelines doc: "See `docs/agents-md-guidelines.md` for sizing guidance"
  - [x] 3.6 Ensure the `activity-init` skill references the guidelines and produces a right-sized AGENTS.md during project initialization
  - [x] 3.7 Verify Acceptance Criteria: AGENTS.md template is under ~1,000 words (measured: 1,031)
  - [x] 3.8 Verify Acceptance Criteria: no operational guidance is lost — all removed content exists in referenced docs or agent files
  - [x] 3.9 Verify Acceptance Criteria: Workflow Chains content is preserved in docs/

- [x] 4.0 Ensure consistency across all three platform trees (R4 — no deduplication, consistency check)
  - [x] 4.1 Verify `.kiro/steering/plan.md` body matches `.github/instructions/plan.instructions.md` body matches `.claude/skills/plan/SKILL.md` body (content only, front-matter differs by platform)
  - [x] 4.2 Verify `.kiro/steering/implement.md` body matches `.github/instructions/implement.instructions.md` body matches `.claude/skills/implement/SKILL.md` body
  - [x] 4.3 Verify `nextjs-pages-components` content is consistent across `.kiro/steering/` and `.github/instructions/domain/`
  - [x] 4.4 If any drift is found, reconcile to the newest/most complete version across all trees
  - [x] 4.5 Verify Acceptance Criteria: all three trees carry the same guidance text (diffing body content ignoring front-matter)

- [x] 5.0 Split memo-cli-usage skill into quick-ref + full spec (R5)
  - [x] 5.1 Create `.kiro/skills/memo-cli-usage/SKILL.md` as the quick-reference (target: <1,200 words) covering: setup validation check, everyday read commands (memo list, memo search, memo tags list), everyday write commands (memo add), cross-session patterns, and a pointer to `REFERENCE.md` for full CLI spec
  - [x] 5.2 Create `.kiro/skills/memo-cli-usage/REFERENCE.md` containing the full CLI documentation (all commands, flags, configuration, admin operations, schema details)
  - [x] 5.3 Apply same split to `.github/skills/memo-cli-usage/` (SKILL.md quick-ref + REFERENCE.md)
  - [x] 5.4 Apply same split to `.claude/skills/memo-cli-usage/` (SKILL.md quick-ref + REFERENCE.md)
  - [x] 5.5 Verify Acceptance Criteria: SKILL.md in all three trees is under 1,200 words (measured: 553)
  - [x] 5.6 Verify Acceptance Criteria: REFERENCE.md contains all original content not in SKILL.md
  - [x] 5.7 Verify Acceptance Criteria: SKILL.md includes a clear instruction for agents to read REFERENCE.md when performing setup/config/admin operations

- [x] 6.0 Trim git-guard-notice.md to essential content (R6)
  - [x] 6.1 Edit `.kiro/steering/git-guard-notice.md`: keep only front-matter + the two invariants + the single actionable backstop line; remove the verbose explanation paragraphs about the upstream defect, hook behavior, and verification comments
  - [x] 6.2 Verify Acceptance Criteria: the file still communicates the two invariants and the human PR review backstop
  - [x] 6.3 Verify Acceptance Criteria: word count is reduced from ~225 to ~80-100 words (measured: 56 words)

- [x] 7.0 Final verification and documentation
  - [x] 7.1 Run word count on all always-on files to confirm total reduction (measured: 1,119 words / ~1,511 tokens, target was <2,500)
  - [x] 7.2 Verify no guidance was deleted without being relocated
  - [x] 7.3 Update the specification document with final measured results
  - [x] 7.4 Open PR with conventional commit: `chore: reduce per-turn token usage via scoped steering and slimmed AGENTS.md`
