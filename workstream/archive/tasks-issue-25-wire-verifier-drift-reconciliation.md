# Implementation Plan - Issue 25: Wire verifier into developer/planner and drift reconciliation

## Changelog

| Version | Date       | Summary           | Author           |
| ------- | ---------- | ----------------- | ---------------- |
| 1.0     | 2026-07-14 | Initial task list | product-engineer |

## Context

- **Source of scope:** GitHub Issue [#25](https://github.com/llipe/dev-tasks/issues/25) already carries a fully refined body (Summary, Refined Scope, AC-1 through AC-8, Dependencies, Testing Notes) published as part of the #11 split decision. Per the `plan` skill's Mode Detection table, the GitHub Issue itself is an acceptable refinement source when a standalone `/workstream/issue-25-*-refinement.md` doesn't exist yet — no separate refinement pass was run for this task list.
- **Dependency:** Blocked by #11, which is closed and merged (PR #26, merged 2026-07-14T18:02:08Z). The `verifier` agent, its `design`/`audit` modes, and its fidelity/drift report format already exist at `.kiro/agents/verifier.md` (+ platform mirrors). This issue only wires mandatory trigger points into `developer`/`planner` and adds the drift-reconciliation flow into `product-engineer`/`github-ops`.
- **Migration lifecycle tasks — documented opt-out:** No schema or data-model changes are in scope. This repository is a markdown/bash agent-definition toolkit with no database, so migration artifact/rollback/apply/verify tasks are not applicable.
- **Package manager / quality gates:** This repository has no `package.json`; the canonical `pnpm`/`npm` script gates (`test`, `lint`, `format:check`, `typecheck`, `audit`) referenced inside the agent files are guidance for _consumer_ repositories, not for verifying this repo's own changes. Verification of this repo's own changes uses `./scripts/format.sh --check` plus structural/manual review, matching the precedent set in issue #11's task list.

## Relevant Files

### Execution agents (mandatory verifier trigger wiring — AC-1, AC-2, AC-7, AC-8)

- `.kiro/agents/developer.md` - Add mandatory, non-skippable `verifier` audit-mode invocation before PR-ready conversion; extend Completion Gate, Integration table, and closeout payload schema.
- `.github/agents/developer.agent.md` - Mirror of the above (Copilot convention).
- `.claude/agents/developer.md` - Mirror of the above (Claude Code subagent convention).
- `.claude/commands/developer.md` - Mirror of the above (Claude Code interactive command convention).
- `.kiro/agents/planner.md` - Add mandatory per-story verifier audit gate (merge management rule) and a PRD-level rollup audit in Phase 5 before the consolidated PR.
- `.github/agents/planner.agent.md` - Mirror of the above (Copilot convention).
- `.claude/commands/planner.md` - Mirror of the above (Claude Code command convention; no separate planner subagent file exists).

### Drift-reconciliation flow (new skill — AC-3, AC-4, AC-5, AC-6, AC-8)

- `.kiro/skills/activity-drift-reconciliation/SKILL.md` - New skill: routes verifier drift findings into task-list/GitHub-checklist expansion (Unintended, active list), PRD/spec changelog write-back with human-confirmation gate (Intended), new-issue creation via `github-ops` (out-of-task-scope Unintended drift), and closed-task-list follow-up handling.
- `.github/skills/activity-drift-reconciliation/SKILL.md` - Mirror of the above.
- `.claude/skills/activity-drift-reconciliation/SKILL.md` - Mirror of the above.
- `.kiro/agents/product-engineer.md` - Wire the new skill into the Activity Skills table and Non-Negotiable Operating Rules.
- `.github/agents/product-engineer.agent.md` - Mirror of the above.
- `.claude/commands/product-engineer.md` - Mirror of the above.

### Verifier agent scope-boundary update (resolves prior "out of scope, tracked in follow-up issue" language)

- `.kiro/agents/verifier.md` - Update Audit Mode / Mandatory Workflow Integration Points / Out of Scope sections to reflect that trigger wiring and drift reconciliation are now implemented elsewhere (developer/planner/product-engineer), while verifier's own boundary (report-only, no direct edits) is unchanged.
- `.github/agents/verifier.agent.md` - Mirror of the above.
- `.claude/agents/verifier.md` - Mirror of the above.
- `.github/prompts/verifier-audit.prompt.md` - Update handoff language: Audit Mode is now also triggered automatically by `developer`/`planner`; drift findings route to `product-engineer`'s drift-reconciliation flow.
- `.claude/commands/verifier-audit.md` - Mirror of the above.

### Execution rules (single source of truth)

- `.kiro/steering/implement.md` - Add mandatory verifier audit gate to "Before Closing a Story/Issue", explicitly non-blocking on drift.
- `.github/instructions/implement.instructions.md` - Mirror of the above.
- `.claude/skills/implement/SKILL.md` - Mirror of the above.

### Framework/registry docs (root-level, single copy each)

- `AGENTS.md` - Update Agents table descriptions (`developer`, `planner`, `product-engineer`), add `activity-drift-reconciliation` skill row, update "Test-First Design (Verifier)" workflow chain, add General Agent Guidelines bullet for the mandatory audit trigger.
- `AGENTS.md.template` - Same update as `AGENTS.md`.
- `CLAUDE.md` - Update General Agent Guidelines / Skills description for the mandatory trigger and new skill.
- `CLAUDE.md.template` - Same update as `CLAUDE.md`.
- `README.md` - Update Agents table, Skills table, and "Test-First Design (Verifier)" workflow chain diagram.

### Verification/documentation

- Issue [#25](https://github.com/llipe/dev-tasks/issues/25) - Source issue (refined scope already published in the issue body).

## Tasks

- [x] 1.0 Implement Issue #25 - https://github.com/llipe/dev-tasks/issues/25: Wire verifier into developer/planner and drift reconciliation

  > Note: Scope is limited to (a) making `verifier` Audit Mode a mandatory, non-skippable trigger point in `developer` (per-issue) and `planner` (per-story + PRD-level rollup), and (b) building the drift-reconciliation flow that routes verifier findings back into task lists, GitHub checklists, new issues, and PRD/spec changelogs via `product-engineer`/`github-ops`. The `verifier` agent itself, its report format, and `black-box-tester` elimination were delivered in #11 (merged) and are out of scope here. None of this work may make drift a hard blocker of PR/issue completion (AC-8) or replace existing quality gates.
  - [x] 1.1 Confirm dependency satisfied: verify issue #11 is closed and merged (PR #26) and `.kiro/agents/verifier.md` exists with design/audit modes before starting any wiring work.
  - [x] 1.2 Kiro (source of truth) — wire the mandatory audit trigger into `.kiro/agents/developer.md`: add a Non-Negotiable Operating Rule stating `developer` MUST invoke `verifier` in `audit` mode post-implementation and pre-PR-ready, for every issue, with no path that skips the call (AC-1); insert the call into the Execution Flow between "run mandatory quality gates" and "convert PR from Draft to Ready for Review"; require posting the verifier human-readable summary to the issue/PR via `github-ops` comment conventions as part of that same step (AC-7); update the Completion Gate list to add "verifier audit executed and summary posted" as a mandatory condition while explicitly stating drift findings do not block completion (AC-8); add a `verifier` row to the "Integration with Other Agents" table.
  - [x] 1.3 Extend the developer closeout payload schema in `.kiro/agents/developer.md` with `verifier_audit: run | blocked` and `fidelity_verdict`/`highest_drift_impact`/`drift_findings` fields so `planner` can validate the gate was reached during delegated runs.
  - [x] 1.4 Mirror 1.2-1.3 into `.github/agents/developer.agent.md`, `.claude/agents/developer.md` (subagent), and `.claude/commands/developer.md` (interactive command) — same content, platform-appropriate frontmatter/tool syntax only.
  - [x] 1.5 Kiro — wire the mandatory audit trigger into `.kiro/agents/planner.md`: add a per-story merge-gate check requiring the delegated `developer` closeout payload to show `verifier_audit: run` before that story's PR is merged into the integration branch (AC-2, per-story); add a Phase 5 step requiring `planner` to invoke `verifier` in `audit` mode for a PRD-level rollup audit against the full integrated scope before/alongside opening the consolidated PR, and post the resulting summary to the plan/milestone issue via `github-ops` conventions (AC-2 rollup, AC-7); explicitly state that rollup drift findings do not block the consolidated PR handoff (AC-8); update the per-story handoff "Required payload schema" to include the same verifier fields added in 1.3.
  - [x] 1.6 Mirror 1.5 into `.github/agents/planner.agent.md` and `.claude/commands/planner.md`.
  - [x] 1.7 Kiro — author the new `activity-drift-reconciliation` skill at `.kiro/skills/activity-drift-reconciliation/SKILL.md`, owned by `product-engineer`, covering: (a) Unintended drift on an active task list → expand `/workstream/tasks-*.md` with new sub-task(s) and update the GitHub Issue checklist to match (AC-3); (b) Unintended drift warranting tracking beyond the current task → create a new GitHub issue/sub-task via `github-ops`, cross-referenced to the originating issue (AC-4); (c) Intended drift → require explicit human confirmation before updating the PRD/spec with an incremented changelog entry, with no new task created (AC-5); (d) drift discovered against an already-closed/merged task list (e.g., a PRD-level rollup) → open a new follow-up issue/task list rather than reopening the closed one (AC-6); (e) an explicit statement that none of the above blocks PR/issue completion — reconciliation runs after the gating decision, not before it (AC-8).
  - [x] 1.8 Mirror 1.7 into `.github/skills/activity-drift-reconciliation/SKILL.md` and `.claude/skills/activity-drift-reconciliation/SKILL.md`.
  - [x] 1.9 Wire the new skill into `product-engineer`: update `.kiro/agents/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.claude/commands/product-engineer.md` — add `activity-drift-reconciliation` to the Activity Skills table, and add a "Drift Reconciliation" responsibility note under Non-Negotiable Operating Rules referencing the skill and the mandatory human-confirmation gate for Intended drift.
  - [x] 1.10 Update `.kiro/agents/verifier.md`, `.github/agents/verifier.agent.md`, `.claude/agents/verifier.md`: replace the "out of scope, tracked in the linked follow-up issue" language in the Audit Mode description, "Mandatory Workflow Integration Points," and "Out of Scope" sections with wording that reflects trigger wiring now lives in `developer`/`planner` and drift reconciliation now lives in `product-engineer` via `activity-drift-reconciliation`, while keeping verifier's own boundary unchanged (report-only, never edits code/PRD/spec/task-list directly).
  - [x] 1.11 Update `.github/prompts/verifier-audit.prompt.md` and `.claude/commands/verifier-audit.md`: revise the handoff language so it reflects that Audit Mode is now also triggered automatically by `developer`/`planner`, and that defects/Unintended drift route to `product-engineer`'s `activity-drift-reconciliation` flow rather than only "hand off to developer for fixes."
  - [x] 1.12 Update the single-source-of-truth execution rules in `.kiro/steering/implement.md`, `.github/instructions/implement.instructions.md`, and `.claude/skills/implement/SKILL.md`: add a step to "Before Closing a Story/Issue" requiring the `verifier` audit to have run and its summary posted to the issue/PR, explicitly stating this is non-blocking on drift (consistent with, and without altering, the existing quality-gate blocking rules).
  - [x] 1.13 Update `AGENTS.md`: revise the `developer`/`planner`/`product-engineer` rows in the Agents table to mention the mandatory verifier audit trigger and drift-reconciliation ownership respectively; add an `activity-drift-reconciliation` row to the Skills table (`product-engineer` consumer); update the "Test-First Design (Verifier)" workflow chain to show the audit as an automatically-triggered step of `implement`/`planner` rather than a manual chain step; add a General Agent Guidelines bullet stating the verifier audit call is mandatory and non-skippable, and that drift reconciliation is non-blocking.
  - [x] 1.14 Apply the same update from 1.13 to `AGENTS.md.template`.
  - [x] 1.15 Update `CLAUDE.md` and `CLAUDE.md.template`: revise the General Agent Guidelines bullet list and the Skills description paragraph to reflect the mandatory verifier audit trigger and the new `activity-drift-reconciliation` skill.
  - [x] 1.16 Update `README.md`: revise the `developer`/`planner`/`product-engineer` entries in the Agents section, add `activity-drift-reconciliation` to the Skills table, and update the "Test-First Design (Verifier)" workflow chain diagram to reflect automatic triggering.
  - [x] 1.17 Delegate to `technical-writer`: confirm `AGENTS.md` parity (every new/changed skill and agent file has an accurate row, workflow chains reference only existing activities/agents) after these additions. Result: all 8 agents and 13 skills (incl. new `activity-drift-reconciliation`) have accurate rows; workflow chains reference only existing agents/activities. Pre-existing, out-of-scope gap flagged (not fixed): `vercel-composition-patterns`/`vercel-react-best-practices` are listed in AGENTS.md's Third-Party Skills table but the directories do not exist on disk in any platform — predates this issue.
  - [x] 1.18 Run `./scripts/format.sh --check` and fix any formatting violations in modified/new Markdown files. Result: fixed all 13 files touched by this issue via `--write`; remaining 17 warnings are pre-existing drift in unrelated files (github-ops, plan, activity-init, activity-generate-stories, memo-cli-usage, prd-kiro-dev-support.md, prettier.config.cjs) and are out of scope.
  - [x] 1.19 Run a repo-wide search (`grep -ri "tracked in the linked follow-up issue\|out of scope for this agent" `) for stale scoped-out references to this issue in verifier/prompt/command files, and resolve or explicitly justify any remaining hit. Result: no hits remain in `.kiro/`, `.github/`, or `.claude/` agent/skill/steering files. The only remaining textual matches are in `/workstream/tasks-issue-25-*.md` (this file's own task description, historical) and `/workstream/tasks-issue-11-*.md` (issue #11's closed task list, historical record of the original split decision) — both are point-in-time records, not live agent instructions, so no change is needed.
  - [x] 1.20 Verify Acceptance Criterion AC-1 (mandatory developer trigger): confirm `.kiro/agents/developer.md` and all mirrors state the verifier audit call with no skip path; dry-run/simulate a `developer` run reaching pre-PR-ready state and confirm the audit step is reached without manual triggering. Result: confirmed in all 4 developer files (Rule 18, Execution Flow step, Completion Gate condition 5, closeout payload `verifier_audit` field) — the audit step sits between quality gates and PR-ready conversion with no conditional/skip path.
  - [x] 1.21 Verify Acceptance Criterion AC-2 (mandatory planner trigger): confirm the per-story merge gate and the Phase 5 rollup-audit step in `.kiro/agents/planner.md` and mirrors; simulate a multi-story run and confirm both the per-story and rollup audit invocation points are reached. Result: confirmed in all 3 planner files (merge-gate step 5, Phase 5 step 2, Invariants bullet) — per-story gate blocks merge on missing evidence, rollup runs unconditionally before the consolidated PR.
  - [x] 1.22 Verify Acceptance Criterion AC-3 (Unintended drift, active task list): simulate Unintended drift mid-task-list and confirm the `activity-drift-reconciliation` skill's steps correctly describe expanding `/workstream/tasks-*.md` and the GitHub checklist. Result: confirmed — decision table row + Step 5 describe adding numbered sub-tasks and syncing the GitHub checklist with identical wording.
  - [x] 1.23 Verify Acceptance Criterion AC-4 (new issue for out-of-task-scope drift): confirm the skill's steps describe creating a new GitHub issue/sub-task via `github-ops`, cross-referenced to the originating issue, when drift warrants tracking beyond the current task. Result: confirmed — Step 6 delegates to `github-ops` and requires `Refs #<originating-issue-number>`.
  - [x] 1.24 Verify Acceptance Criterion AC-5 (Intended drift): simulate Intended drift and confirm the skill requires explicit human confirmation before any PRD/spec changelog update, and that no new task is created for it. Result: confirmed — Step 4 requires an explicit y/n confirmation before any PRD/spec edit, adds a changelog row, and explicitly states "MUST NOT create a new task for this item."
  - [x] 1.25 Verify Acceptance Criterion AC-6 (closed-task-list edge case): simulate drift found against an already-closed/merged task list and confirm the skill opens a new follow-up issue/task list rather than reopening the closed one. Result: confirmed — Step 7 requires confirming closed/merged state first, then opens a new issue + task list, and explicitly states "MUST NOT reopen the closed issue."
  - [x] 1.26 Verify Acceptance Criterion AC-7 (summary publication): confirm the updated `developer`/`planner` execution-flow wording requires posting verifier's human-readable summary to the relevant GitHub issue/PR via `github-ops` comment conventions as part of the trigger flow. Result: confirmed — present in developer Execution Flow, planner merge-gate context, and planner Phase 5 rollup step, all via `github-ops` comment conventions.
  - [x] 1.27 Verify Acceptance Criterion AC-8 (non-blocking): review every updated file from 1.2-1.16 to confirm none of them state or imply that drift blocks PR/issue completion, and that this is consistent with the unchanged, still-blocking quality-gate rules (`test`/`lint`/`format:check`/`typecheck`/`audit`). Result: confirmed via repo-wide grep across developer/planner/verifier/product-engineer/skill/steering files — no "drift blocks/MUST block" language found; only explicit non-blocking statements. Quality-gate blocking language (`test`/`lint`/`format:check`/`typecheck`/`audit`) was left untouched in all files.
  - [x] 1.28 Run Tests: since this repo has no application test suite (markdown/bash agent-definition toolkit, no `package.json`), "testing" consists of the structural/manual dry-run verifications in 1.20-1.27 plus `./scripts/format.sh --check` (1.18) and the stale-reference search (1.19). Confirm all pass before marking this task complete. Result: all pass — AC-1 through AC-8 verified (1.20-1.27), format check clean for all issue-#25-touched files (1.18), no stale scoped-out references remain in live agent/skill/steering files (1.19).
