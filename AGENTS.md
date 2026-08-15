# dev-tasks

A set of agents, skills, and instructions for GitHub Copilot, Claude Code, Kiro, and other AI coding agents to run structured, PRD-driven development workflows.

## Core Idea

This system brings structure and clarity to AI-assisted development by:

- Defining scope with Product Requirements Documents (PRDs)
- Breaking requirements into actionable, implementation-ready tasks
- Guiding the AI to tackle one task at a time with checkpoints for review
- Providing specialized **agents** that orchestrate the workflow end-to-end
- Enforcing documentation, branch discipline, and GitHub-as-source-of-truth
- Standardizing visual design decisions through `/DESIGN.md` as the canonical UI contract
- **Test-first design as the default**: `verifier` (Design Mode) produces compliance test plans before implementation, and `developer` writes tests before code

## Design Standard Contract (DESIGN.md)

`/DESIGN.md` is the canonical design-system artifact for this repository.

- `ux-engineer` **MUST** use `/DESIGN.md` as the primary style source for mockups.
- `product-engineer` **MUST** reference `/DESIGN.md` for UI-impacting specs and stories.
- `developer` **MUST** validate UI changes against `/DESIGN.md` and update it when the visual contract changes.
- `planner` **MUST** require DESIGN.md compliance in UI-impacting delegated runs.

If `/DESIGN.md` is missing and the requested scope includes UI work, agents **MUST** create a baseline DESIGN.md before finalizing design-dependent outputs.

---

## Taxonomy: Agent vs Skill vs Instruction

| Concept         | Purpose                                                     | Loaded When                  |
| --------------- | ----------------------------------------------------------- | ---------------------------- |
| **Agent**       | Autonomous role with decision-making and handoff discipline | Invoked by name (`@agent`)   |
| **Skill**       | Reusable on-demand capability (procedures/activities)       | On demand (invoked by agent) |
| **Instruction** | Scoped rule enforced automatically for matching context     | Auto-applied by runtime      |

---

## Agents

| Agent                | File                        | Purpose                                                                                                                                                                                                                                          |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **product-engineer** | `product-engineer.agent.md` | Preparation agent — owns the full pre-coding chain: PRD, spec, stories, plan. Owns drift-reconciliation (`activity-drift-reconciliation`) for findings handed off by `developer`/`planner`. Hands off to `developer` or `planner` for execution. |
| **developer**        | `developer.agent.md`        | Execution agent — implements code from an existing task list. Runs `implement`, including a mandatory, non-skippable `verifier` audit before every PR is marked ready.                                                                           |
| **planner**          | `planner.agent.md`          | Multi-story orchestration — dependency-ordered sequential execution with checkpoint/resume, a mandatory per-story and PRD-level rollup `verifier` audit gate, and one consolidated integration PR.                                               |
| **technical-writer** | `technical-writer.agent.md` | Autonomous documentation maintenance                                                                                                                                                                                                             |
| **housekeeping**     | `housekeeping.agent.md`     | Lint, type, and test-wiring fixes                                                                                                                                                                                                                |
| **github-ops**       | `github-ops.agent.md`       | GitHub consistency — standardizes issues, PRs, branches, labels, milestones, comments, and enforces merge authority policy                                                                                                                       |
| **ux-engineer**      | `ux-engineer.agent.md`      | UX prototyping and gap analysis — turns PRD/SPEC into testable mockups and feeds refinements back to `product-engineer`                                                                                                                          |
| **verifier**         | `verifier.agent.md`         | Verification agent — owns compliance test-plan design (`design` mode) and post-implementation grey-box fidelity auditing (`audit` mode) against codebase, `/workstream`, tests, and PRD/spec intent                                              |

`.github/agents/` and `.kiro/agents/` carry all eight agents. `.claude/agents/` carries six by design: `planner` and `product-engineer` are orchestrators that must pause for user-approval gates, so on Claude Code they run in the main thread as `.claude/commands/` entry points rather than as subagents. See `CLAUDE.md`.

## Skills

Skills are on-demand capabilities invoked by agents — **not** loaded unless explicitly referenced.

### Activity Skills

| Skill                             | Directory                               | Purpose                                                                                                                           | Primary Consumer   |
| --------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **activity-init**                 | `skills/activity-init/`                 | Establish product context and technical guidelines (mono/multi-repo/greenfield mode detection)                                    | `product-engineer` |
| **activity-refine**               | `skills/activity-refine/`               | Clarify scope — issue refinement or full PRD creation                                                                             | `product-engineer` |
| **activity-generate-spec**        | `skills/activity-generate-spec/`        | Transform PRD into technical specification                                                                                        | `product-engineer` |
| **activity-generate-stories**     | `skills/activity-generate-stories/`     | Break spec into user stories with coverage validation                                                                             | `product-engineer` |
| **activity-publish-github**       | `skills/activity-publish-github/`       | Publish stories as GitHub Issues via MCP                                                                                          | `product-engineer` |
| **activity-e2e-test-design**      | `skills/activity-e2e-test-design/`      | End-to-end black-box test scenario generation from spec/stories                                                                   | `verifier`         |
| **activity-contract-test-design** | `skills/activity-contract-test-design/` | Consumer/provider contract and schema compatibility test strategy                                                                 | `verifier`         |
| **activity-edge-case-refinement** | `skills/activity-edge-case-refinement/` | Systematic edge-case discovery by category with concrete examples                                                                 | `verifier`         |
| **activity-random-test-tactics**  | `skills/activity-random-test-tactics/`  | Randomized, fuzz, and property-inspired test generation with reproducibility                                                      | `verifier`         |
| **activity-drift-reconciliation** | `skills/activity-drift-reconciliation/` | Routes verifier drift findings into task-list/checklist expansion, new issues, or PRD/spec changelog write-back (human-confirmed) | `product-engineer` |

### Operational Skills

| Skill              | Directory                | Purpose                                                                                                                                   | Primary Consumer                |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **git-ops**        | `skills/git-ops/`        | Branch management, rebase, merge, conflict resolution, recovery                                                                           | `developer`, `planner`          |
| **webapp-mockup**  | `skills/webapp-mockup/`  | Scaffold and generate React mockup apps for UX testing                                                                                    | `ux-engineer`                   |
| **memo-cli-usage** | `skills/memo-cli-usage/` | Read and write architectural decisions to a shared Qdrant knowledge base for multi-session, multi-agent, and team-wide context continuity | `technical-writer`, `developer` |

### Third-Party Skills

None currently vendored. Third-party skills, when added, are installed under each platform's skills directory alongside the skills above.

## Instructions (Scoped)

Instructions are scoped via `applyTo`/`fileMatchPattern` and auto-applied to matching files. Claude Code has no scoped-instruction mechanism, so `plan` and `implement` ship there as skills instead.

| Instruction                 | Copilot / Kiro file                                                                                                 | Claude equivalent           | Scope                      | Purpose                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **plan**                    | `.github/instructions/plan.instructions.md` / `.kiro/steering/plan.md`                                              | `.claude/skills/plan/`      | `workstream/**`            | Convert stories or refined issues into execution-ready task lists                                               |
| **implement**               | `.github/instructions/implement.instructions.md` / `.kiro/steering/implement.md`                                    | `.claude/skills/implement/` | `workstream/**/tasks-*.md` | Execute task list with step-gated approval, branching, and PR discipline                                        |
| **nextjs-pages-components** | `.github/instructions/domain/nextjs-pages-components.instructions.md` / `.kiro/steering/nextjs-pages-components.md` | —                           | `**/app/**/*.tsx`          | Next.js + React conventions                                                                                     |
| **git-guard-notice**        | `.kiro/steering/git-guard-notice.md`                                                                                | —                           | Always loaded (Kiro)       | Restates the three git invariants: no push/merge to `main`, Conventional Commits, `--body-file` for `gh` bodies |

## Hooks

| Hook             | Files                                                                                          | Purpose                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **git-guard**    | `.kiro/hooks/git-guard.json`, `.kiro/hooks/scripts/git-guard.sh`, `.claude/hooks/git-guard.sh` | Blocks pushes/merges to `main`, non-Conventional commit messages, and inline `gh --body` |
| **branch-guard** | `.kiro/hooks/scripts/branch-guard.sh`                                                          | Blocks write operations while on the default branch                                      |

Hook enforcement is best-effort. Human PR review is the actual gate for these invariants.

## Prompts

See individual agent files for invocation modes and entry points. Reference: Copilot (`.github/prompts/`), Claude Code (`.claude/commands/`), Kiro (embedded in `.kiro/agents/`).

---

## Agent File Format (Kiro Custom Agents)

Agent files in `.kiro/agents/` use YAML frontmatter followed by a markdown body containing the system prompt. The frontmatter conforms to the [official Kiro custom agent configuration reference](https://kiro.dev/docs/cli/custom-agents/configuration-reference/).

### Frontmatter Schema

```yaml
---
description: "<human-readable agent description>"
tools: [<tool-tags>] # Allowed: read, write, shell, web
resources: # Context files auto-loaded into the agent
  - file://<relative-path> # Project files (e.g., file://AGENTS.md)
  - skill://<glob-pattern> # Skill definitions (e.g., skill://.kiro/skills/**/SKILL.md)
permissions: # (Optional) Fine-grained access control
  - allow: <action>
    paths: ["<glob>"]
  - deny: <action>
    paths: ["<glob>"]
---
```

### Field Reference

| Field          | Required | Description                                                                                                                                                                             |
| -------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`  | Yes      | Human-readable purpose. Used by the runtime for agent selection and routing.                                                                                                            |
| `tools`        | Yes      | Tag-based tool categories: `read`, `write`, `shell`, `web`. Use `["*"]` for unrestricted.                                                                                               |
| `resources`    | No       | Context files auto-loaded via `file://` (project files) and `skill://` (skill definitions).                                                                                             |
| `permissions`  | No       | Inline permission rules for fine-grained access control (allow/deny by path glob). **Note:** Not yet supported by the Kiro runtime as of v1.0 — presence causes agents to fail to load. |
| `model`        | No       | Model selection override (omit to use the runtime default).                                                                                                                             |
| `mcpServers`   | No       | Embedded MCP server configurations for tool extensions.                                                                                                                                 |
| `allowedTools` | No       | Tools that execute without prompting (pre-approved).                                                                                                                                    |

### Tool Categories

| Tag     | Grants Access To                      |
| ------- | ------------------------------------- |
| `read`  | File reading, search, code navigation |
| `write` | File creation, editing, deletion      |
| `shell` | Terminal command execution            |
| `web`   | Web browsing and HTTP requests        |

> **Note:** `subagent` is not an official tool category. Subagent delegation is a runtime capability, not a tool permission.

### References

- [Kiro Custom Agent Configuration Reference](https://kiro.dev/docs/cli/custom-agents/configuration-reference/)
- [Kiro CLI v3 Agent Config](https://kiro.dev/docs/cli/v3/agent-config/)
- [Sample Multi-Agent Repository](https://github.com/aws-samples/sample-kiro-cli-multiagent-development)

---

## General Agent Guidelines

All AI coding agents working in this repository **MUST**:

- Always create feature branches — never commit to the default branch
- Use Conventional Commits (`feat`, `fix`, `chore`, `docs`, etc.)
- Create PRs for review — never self-merge into `main`
- **PRs targeting `main` require user approval** — no agent may merge into the default branch
- Follow testing, linting, and documentation standards from `technical-guidelines.md`
- Reference GitHub Issues in branch names and commits
- Treat `/DESIGN.md` as the source of truth for visual tokens, components, and design guidance
- Prefer `pnpm` over `npm` for JS/TS workflows
- Use canonical script names: `lint`, `format:check`, `typecheck`, `test`, `audit`, `validate`
- Enforce quality gates before completion: `test`, `lint`, `format:check`, `typecheck`, `audit`
- Use the `git-ops` skill for branch management, rebase, and conflict resolution
- The `verifier` audit is mandatory and non-skippable before every PR is marked ready. Drift findings are non-blocking and route to `product-engineer`'s `activity-drift-reconciliation`.
- **Test-first design is the default:** `product-engineer` recommends `verifier` Design Mode after planning; `developer` writes tests before implementation code; `planner` checks for test plans and enforces test-first in developer handoffs
- If `memo-cli` is installed and configured: agents **MUST** read/write entries per their role (see agent files for details)

---

## Task Types

### architecture-change

The `architecture-change` task type is the **only** mode that grants write authority to the meta-repo (the shared architecture/catalog repository). It enforces structural integrity of the semantic layer by restricting what can be modified, requiring formal decision records, and mandating human approval.

#### Write Scope (RF-62)

An `architecture-change` task **MAY** modify:

- `architecture.md`
- `domains.md`
- `glossary.md`
- `conventions.md`
- `catalog/flows/` (flow definitions)

An `architecture-change` task **MUST NOT** modify:

- `catalog/components/*.json` — generated by CI from component-repo extraction; never hand-edited or agent-edited
- `catalog/index.yaml` — generated by `dt catalog build`; never hand-edited or agent-edited

#### Generated-File Prohibition

`catalog/components/*.json` and `catalog/index.yaml` are **generated artifacts** produced by CI pipelines (`dt extract` and `dt catalog build`). No agent or human may edit these files directly. Changes to component metadata flow exclusively through the component-repo extraction pipeline.

#### ADR Requirement

Before opening any meta-repo PR under the `architecture-change` task type, the agent **MUST** produce an Architecture Decision Record (ADR) containing:

- **Context:** Why the change is needed
- **Decision:** What is being changed
- **Consequences:** Impact on consumers, domains, or contracts
- **Alternatives considered:** Other approaches evaluated and reasons for rejection

The ADR **MUST** be committed as part of the PR (in the meta-repo's ADR directory).

#### Human Approval Gate

- PRs from the `architecture-change` task type targeting the meta-repo **REQUIRE** explicit human review and approval.
- No agent may auto-merge an `architecture-change` PR into the default branch.
- This aligns with the existing branch/PR discipline: PRs targeting `main` require user approval.

#### Exclusion Rule (RF-64)

Agents **MUST NOT** write to the meta-repo outside the `architecture-change` task type. Any attempt to modify meta-repo files (including those in the allowed write scope) outside this task type **MUST** be refused with a clear message:

> "Meta-repo writes require the `architecture-change` task type. Create an architecture-change task to modify these files."

This applies to all agents (`product-engineer`, `developer`, `planner`, `housekeeping`, etc.).

---

## Cross-Repo Partitioning (RF-63)

When a scoping step (via `dt init --task` or manual multi-repo planning) identifies more than one `primary` component, the feature spans multiple repositories. In this case, the agent **MUST** partition the work into per-repo sub-tasks rather than treating it as a single monolithic task.

### Partitioning Procedure

1. **Detection:** If `scope.primary` contains >1 component, the feature is cross-repo and **MUST** be partitioned.
2. **One sub-task per repo:** Each `primary` component becomes its own sub-task, scoped exclusively to that component's repository.
3. **Partition proposal consumption:** When a partition proposal is available from `dt scope gate` (G1 abort, exit 7), the agent **SHOULD** use it as the basis for the partition. When no automated proposal is available, the agent **MUST** apply the same rules manually.

### Contract-as-Interface

- Each sub-task uses the **boundary contract** (with a target version) as its interface.
- Acceptance criteria for each sub-task **MUST** reference the contract definition (OpenAPI spec, AsyncAPI channel, or schema), **not** the foreign repo's internal implementation.
- A sub-task is complete when it satisfies its contract obligations — it does not depend on or verify the other repo's implementation details.

### Ordering Rule

Sub-tasks **MUST** be ordered **producer-before-consumers**:

- The provider (producer) implements its contract first.
- Consumer sub-tasks implement adaptation to the contract after the provider sub-task is complete.
- This ensures the contract exists in its target form before consumers adapt to it.

### Low-Payload Elevation Guard

A boundary contract with `payload_confidence: low` **MUST** be raised to at least `medium` confidence before it can serve as an acceptance boundary. This is achieved by:

- Re-running extraction (`dt extract`) with improved source hints, OR
- Manual confirmation of the payload shape by a human reviewer.

Until the boundary contract reaches `medium` or higher confidence, the agent **MUST NOT** use it as an acceptance interface and **MUST** block the sub-task that depends on it with a clear message:

> "Boundary contract `<contract-id>` has `payload_confidence: low`. Re-run extraction or manually confirm the payload shape before using it as an acceptance boundary."

### Single-Primary — No Partition

When `scope.primary` contains exactly 1 component, no partitioning is needed. The feature is single-repo and proceeds with normal task planning.

---

For workflow chains and sequencing diagrams, see [`docs/workflow-chains.md`](docs/workflow-chains.md). For architecture, artifacts, and invariants, see [`docs/system-overview.md`](docs/system-overview.md) and [`docs/data-model.md`](docs/data-model.md). Full documentation index: [`docs/README.md`](docs/README.md).
