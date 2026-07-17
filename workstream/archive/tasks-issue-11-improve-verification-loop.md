# Implementation Plan - Issue 11: Improve verification loop

## Changelog

| Version | Date       | Summary         | Author            |
| ------- | ---------- | ---------------- | ----------------- |
| 1.0     | 2026-07-14 | Initial task list | product-engineer |

## Relevant Files

### New agent (created once per platform mirror)

- `.kiro/agents/verifier.md` - New agent definition: `verifier`, with `design` and `audit` invocation modes (Kiro convention, includes embedded Invocation Modes section).
- `.github/agents/verifier.agent.md` - New agent definition mirror for Copilot.
- `.claude/agents/verifier.md` - New agent definition mirror for Claude Code.
- `.github/prompts/verifier-design.prompt.md` - New Copilot prompt entry point for Design Mode.
- `.github/prompts/verifier-audit.prompt.md` - New Copilot prompt entry point for Audit Mode (replaces `black-box-tester-validate.prompt.md`).
- `.claude/commands/verifier-design.md` - New Claude Code command entry point for Design Mode.
- `.claude/commands/verifier-audit.md` - New Claude Code command entry point for Audit Mode.

### Deleted agent (black-box-tester elimination)

- `.kiro/agents/black-box-tester.md` - Deleted.
- `.github/agents/black-box-tester.agent.md` - Deleted.
- `.claude/agents/black-box-tester.md` - Deleted.
- `.github/prompts/black-box-tester-design.prompt.md` - Deleted.
- `.github/prompts/black-box-tester-validate.prompt.md` - Deleted.
- `.claude/commands/black-box-tester-design.md` - Deleted.
- `.claude/commands/black-box-tester-validate.md` - Deleted.

### Skills retargeted from black-box-tester to verifier (per platform mirror: `.kiro/skills/`, `.github/skills/`, `.claude/skills/`)

- `activity-e2e-test-design/SKILL.md` - Update all `black-box-tester` references to `verifier` (Design Mode).
- `activity-contract-test-design/SKILL.md` - Update all `black-box-tester` references to `verifier` (Design Mode).
- `activity-edge-case-refinement/SKILL.md` - Update all `black-box-tester` references to `verifier` (Design Mode).
- `activity-random-test-tactics/SKILL.md` - Update all `black-box-tester` references to `verifier` (Design Mode), including the Failure Triage Workflow section.

### Framework/registry docs (root-level, single copy each)

- `AGENTS.md` - Replace the `black-box-tester` agent table row with `verifier`; update skill "Primary Consumer" columns; update Workflow Chains referencing black-box-tester.
- `AGENTS.md.template` - Same update as `AGENTS.md` (template kept in parity).
- `CLAUDE.md` - Replace `/black-box-tester-design` / `/black-box-tester-validate` command rows with `/verifier-design` / `/verifier-audit`; update Subagents list.
- `CLAUDE.md.template` - Same update as `CLAUDE.md`.
- `README.md` - Update the "Black-box compliance testing" quick-reference row, the agents table row, and the skills table "Primary Consumer" column.
- `bundle-manifest.json` - No path changes expected (agent/skill dirs are pattern-based, not name-based); verify no explicit `black-box-tester` filename references exist.
- `dev-tasks.sh` - Verify no explicit `black-box-tester` filename references exist (directories are managed by pattern, not by name).
- `scripts/build-bundle.sh` - Verify no explicit `black-box-tester` filename references exist.

### Verification/documentation

- `/workstream/issue-11-improve-verification-loop-refinement.md` - Source refinement doc (read-only reference for this task list).
- `/workstream/verifier-report-template.md` (new, optional reference artifact) - Canonical fidelity/design report template used by the `verifier` agent, if extracted as a standalone template rather than embedded inline in the agent file.

## Tasks

- [ ] 1.0 Implement Issue #11 - https://github.com/llipe/dev-tasks/issues/11: Improve verification loop (deliver `verifier` agent, report format, and `black-box-tester` elimination)

  > Note: Scope is limited to the `verifier` agent itself, its `design`/`audit` report formats, and full removal of `black-box-tester`. Trigger wiring into `developer`/`planner` and the drift-reconciliation flow into `product-engineer`/`github-ops` are explicitly out of scope here — tracked in the linked follow-up issue #25 (blocked by this issue).

  - [x] 1.1 Draft the `verifier` agent identity and scope (Kiro convention first, as source of truth): author `.kiro/agents/verifier.md` with Identity section, constraints references (`AGENTS.md`, `.kiro/agents/developer.md`, `.kiro/agents/product-engineer.md`, `.kiro/agents/github-ops.md`), and explicit statement that verifier never edits code/PRD/spec/task-list directly.
  - [x] 1.2 Define the `design` invocation mode in `.kiro/agents/verifier.md`: inputs (repo, issue, source artifact, input type spec/story), chained skills (`activity-e2e-test-design`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics`), and artifacts produced (`/workstream/test-plan-*.md`, `/workstream/traceability-matrix-*.md`) — preserving `black-box-tester`'s existing Design Mode behavior with no loss of capability (AC-7).
  - [x] 1.3 Define the `audit` invocation mode in `.kiro/agents/verifier.md`: grey-box fidelity audit reading (a) codebase implementation, (b) `/workstream` artifacts, (c) test suite vs. acceptance criteria, and (d) PRD/spec intent, producing a fidelity report with per-AC results (AC-3).
  - [x] 1.4 Define the drift classification schema in the audit mode report structure: impact class (Critical/Major/Minor) and intent class (Intended/Unintended/Undetermined) per drift item, with an explicit statement that drift is non-blocking to PR/issue completion (AC-4).
  - [x] 1.5 Define the human-readable summary section format ("what changed and why", plain language, no implementation jargon) as part of the audit report structure (AC-5).
  - [x] 1.6 Define the report header/verdict structure so the overall fidelity verdict and highest drift impact are the first thing visible in both the report artifact and any GitHub comment template (AC-6).
  - [x] 1.7 Define phases (Intake → Requirement Extraction → Test Design/Evidence Collection → Reporting & Publication), Non-Negotiable Operating Rules, Deliverables, Report Structure, and Output Contract sections in `.kiro/agents/verifier.md`, adapting `black-box-tester`'s existing structure to the new agent name and audit-mode additions.
  - [x] 1.8 Delete `.kiro/agents/black-box-tester.md`.
  - [x] 1.9 Update `.kiro/skills/activity-e2e-test-design/SKILL.md`, `.kiro/skills/activity-contract-test-design/SKILL.md`, `.kiro/skills/activity-edge-case-refinement/SKILL.md`, `.kiro/skills/activity-random-test-tactics/SKILL.md`: replace every `black-box-tester` reference with `verifier` (including the Failure Triage Workflow section in `activity-random-test-tactics`).
  - [x] 1.10 Mirror the finalized `.kiro/agents/verifier.md` content into `.github/agents/verifier.agent.md` (Copilot frontmatter convention: `name`, `description`) and `.claude/agents/verifier.md` (Claude Code frontmatter convention: `name`, `description`, `tools: Bash, Read, Write, Grep, Glob`), adapting only frontmatter/tool-declaration syntax per platform, not content.
  - [x] 1.11 Delete `.github/agents/black-box-tester.agent.md` and `.claude/agents/black-box-tester.md`.
  - [x] 1.12 Mirror the skill updates from 1.9 into `.github/skills/activity-e2e-test-design/SKILL.md`, `.github/skills/activity-contract-test-design/SKILL.md`, `.github/skills/activity-edge-case-refinement/SKILL.md`, `.github/skills/activity-random-test-tactics/SKILL.md` and the `.claude/skills/` equivalents.
  - [x] 1.13 Create Copilot prompt entry points `.github/prompts/verifier-design.prompt.md` and `.github/prompts/verifier-audit.prompt.md`, following the existing `black-box-tester-design.prompt.md` / `black-box-tester-validate.prompt.md` structure (frontmatter `agent: verifier`, description, invocation fields, chained phases, artifacts produced, handoff note). Delete `.github/prompts/black-box-tester-design.prompt.md` and `.github/prompts/black-box-tester-validate.prompt.md`.
  - [x] 1.14 Create Claude Code command entry points `.claude/commands/verifier-design.md` and `.claude/commands/verifier-audit.md`, following the existing `black-box-tester-design.md` / `black-box-tester-validate.md` structure (frontmatter `description`, `argument-hint`, delegation instructions referencing the Task tool). Delete `.claude/commands/black-box-tester-design.md` and `.claude/commands/black-box-tester-validate.md`.
  - [x] 1.15 Update `AGENTS.md`: replace the `black-box-tester` row in the Agents table with a `verifier` row (updated description covering design + audit modes); update the "Primary Consumer" column for `activity-e2e-test-design`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics` from `black-box-tester` to `verifier`; update any Workflow Chains section referencing `black-box-tester` (e.g., "Test-First Design (Black-Box)" chain) to reference `verifier`.
  - [x] 1.16 Apply the same update from 1.15 to `AGENTS.md.template`.
  - [x] 1.17 Update `CLAUDE.md` and `CLAUDE.md.template`: replace `/black-box-tester-design` and `/black-box-tester-validate` command table rows with `/verifier-design` and `/verifier-audit`; update the Subagents list to replace `black-box-tester` with `verifier`.
  - [x] 1.18 Update `README.md`: replace the "Black-box compliance testing" row in the quick-reference table to reference `verifier`; update the agents table row; update the skills table "Primary Consumer" column entries (4 rows) from `black-box-tester` to `verifier`.
  - [x] 1.19 Run a repo-wide search for remaining `black-box-tester` references (`grep -ri "black-box-tester"` across the repo) and resolve or explicitly justify any remaining hit (e.g., historical changelog entries in other docs that should stay as-is).
  - [x] 1.20 Delegate to `technical-writer`: confirm `AGENTS.md` parity (every `.kiro/agents/` file has a row, every `.kiro/skills/` file has a row, workflow chains reference only existing activities/agents) after the verifier addition and black-box-tester removal.
  - [x] 1.21 Run `./scripts/format.sh --check` and fix any formatting violations in modified/new Markdown, JSON files.
  - [x] 1.22 Verify Acceptance Criterion AC-1 (Verifier agent exists): confirm `.kiro/agents/verifier.md`, `.github/agents/verifier.agent.md`, `.claude/agents/verifier.md` are present with `design`/`audit` modes, phases, and output contract; confirm `AGENTS.md` registry row exists.
  - [x] 1.23 Verify Acceptance Criterion AC-2 (black-box-tester eliminated): confirm all `black-box-tester` agent files are deleted and a repo-wide search returns no unresolved references; confirm `AGENTS.md` reflects `verifier` in its place.
  - [x] 1.24 Verify Acceptance Criterion AC-3 (Grey-box fidelity audit): manually dry-run `verifier` in `audit` mode against a sample completed implementation (e.g., a previously closed issue with tests) and confirm the report covers all four sources (codebase, `/workstream`, tests-vs-AC, PRD/spec) with per-AC results.
  - [x] 1.25 Verify Acceptance Criterion AC-4 (Drift classification schema, non-blocking by design): review the report schema/template to confirm both impact and intent classification fields exist and the non-blocking statement is present.
  - [x] 1.26 Verify Acceptance Criterion AC-5 (Human-readable summary format): review a sample generated report's summary section for jargon-free, plain-language content.
  - [x] 1.27 Verify Acceptance Criterion AC-6 (Clarity of verdict): review a sample report header to confirm the fidelity verdict and highest drift impact are immediately visible at the top.
  - [x] 1.28 Verify Acceptance Criterion AC-7 (Design-mode parity): manually dry-run `verifier` in `design` mode against a sample spec/story and compare output structure against the prior `black-box-tester` Design Mode output (test plan + traceability matrix) to confirm no capability loss.
  - [x] 1.29 Verify Acceptance Criterion AC-8 (Follow-up issue linkage): confirm issue #11 and issue #25 cross-reference each other (already satisfied at refinement time — re-confirm still accurate after this implementation).
  - [x] 1.30 Run Tests: since this repo has no application test suite (markdown/bash agent-definition toolkit, no `package.json`), "testing" consists of the structural/manual verifications in 1.22-1.29 plus `./scripts/format.sh --check` (1.21) and the repo-wide reference search (1.19). Confirm all pass before marking this task complete.
