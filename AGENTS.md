# dev-tasks

Portable, repo-installed workflow harness for structured, PRD-driven AI-assisted development. Agents orchestrate the workflow end-to-end with branch discipline, test-first design, and GitHub-as-source-of-truth.

## Contracts

| File          | Owner         | Purpose                                        |
| ------------- | ------------- | ---------------------------------------------- |
| `/DESIGN.md`  | `ux-engineer` | Canonical design-system tokens and UI guidance |
| `/TESTING.md` | `qa-engineer` | Layer taxonomy, runners, thresholds, fixtures  |

If `/DESIGN.md` is missing and scope includes UI work, agents **MUST** create a baseline before finalizing design-dependent outputs. An unfilled `/TESTING.md` placeholder means "no standard established", never permission.

## Taxonomy

| Concept         | Purpose                                      | Loaded When             |
| --------------- | -------------------------------------------- | ----------------------- |
| **Agent**       | Autonomous role with decisions and handoffs  | Invoked by name         |
| **Skill**       | Reusable on-demand procedure                 | On demand by agent      |
| **Instruction** | Scoped rule auto-applied to matching context | Auto-applied by runtime |

## Agents

| Agent                | Purpose                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **product-engineer** | Preparation — PRD, spec, stories, plan. Owns drift-reconciliation.                                        |
| **developer**        | Execution — implements from task lists with mandatory verifier audit pre-PR.                              |
| **planner**          | Multi-story orchestration with dependency ordering and integration PR.                                    |
| **technical-writer** | Autonomous documentation maintenance.                                                                     |
| **housekeeping**     | Lint, type, and test-wiring fixes.                                                                        |
| **github-ops**       | GitHub consistency — issues, PRs, branches, labels, milestones, merge authority.                          |
| **ux-engineer**      | UX prototyping, DESIGN.md ownership, mockup generation.                                                   |
| **qa-engineer**      | Testing standard, test authoring, coverage/gap reporting.                                                 |
| **researcher**       | Bounded codebase investigation producing structured research artifacts.                                   |
| **verifier**         | Compliance test-plan design and post-implementation fidelity audit.                                       |
| **infra-engineer**   | Approval-gated, reversible, recorded infrastructure changes across AWS, fly.io, Supabase, and Cloudflare. |

Platform coverage: `.github/agents/` and `.kiro/agents/` carry all eleven. `.claude/agents/` carries eight — `planner`, `product-engineer`, and `infra-engineer` run as `.claude/commands/` (they need main-thread human-approval gates: per-step for `infra-engineer`, per-phase for the two orchestrators).

## Skills

### Activity Skills

| Skill                                    | Purpose                                                   | Consumer         |
| ---------------------------------------- | --------------------------------------------------------- | ---------------- |
| activity-init                            | Establish product context and technical guidelines        | product-engineer |
| activity-refine                          | Issue refinement or full PRD creation                     | product-engineer |
| activity-codebase-research               | Bounded codebase investigation with structured artifact   | researcher       |
| activity-generate-spec                   | PRD to technical specification                            | product-engineer |
| activity-generate-stories                | Spec to user stories with coverage validation             | product-engineer |
| activity-publish-github                  | Publish stories as GitHub Issues                          | product-engineer |
| activity-e2e-test-design                 | E2E scenario generation from spec/stories                 | verifier         |
| activity-contract-test-design            | Contract and schema compatibility test strategy           | verifier         |
| activity-edge-case-refinement            | Systematic edge-case discovery                            | verifier         |
| activity-random-test-tactics             | Randomized/fuzz/property test generation                  | verifier         |
| activity-test-standards                  | Establish/maintain TESTING.md, detect harness defects     | qa-engineer      |
| activity-test-implementation             | Author Layer 1-2 tests with security-negative category    | qa-engineer      |
| activity-integration-test-implementation | Layer 2.5 tests against real databases                    | qa-engineer      |
| activity-e2e-test-implementation         | Playwright E2E from verifier scenario tables              | qa-engineer      |
| activity-coverage-gap-analysis           | Coverage measurement or structural gap analysis           | qa-engineer      |
| activity-drift-reconciliation            | Route drift findings to task expansion or spec write-back | product-engineer |

### Operational Skills

| Skill          | Purpose                                                                                                                                                                | Consumer                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| git-ops        | Branch management, rebase, merge, conflict resolution                                                                                                                  | developer, planner          |
| aws-ops        | AWS CLI command sets, tiers, cost, backup/revert, log table                                                                                                            | infra-engineer              |
| fly-ops        | flyctl command sets, tiers, cost, backup/revert, log table                                                                                                             | infra-engineer              |
| supabase-ops   | Supabase CLI command sets, `db diff` flow, drift rule, backup/revert, log table                                                                                        | infra-engineer              |
| deploy-ops     | Deploy script contract, environment mapping, tag policy, deploy-target framing, and GitHub Actions workflow scaffolding (`templates/scripts/`, `templates/workflows/`) | infra-engineer              |
| ux-scaffold    | Mockup project creation (html-lite, react-full)                                                                                                                        | ux-engineer                 |
| ux-theme-gen   | Generate theme artifacts from DESIGN.md                                                                                                                                | ux-engineer, developer      |
| memo-cli-usage | Read/write decisions to shared knowledge base                                                                                                                          | technical-writer, developer |

## Instructions

| Instruction             | Scope                      | Purpose                                            |
| ----------------------- | -------------------------- | -------------------------------------------------- |
| plan                    | `workstream/**`            | Convert stories/issues into task lists             |
| implement               | `workstream/**/tasks-*.md` | Execute task list with branching and PR discipline |
| nextjs-pages-components | `**/app/**/*.tsx`          | Next.js + React conventions                        |
| git-guard-notice        | Always (Kiro)              | Git invariants reminder                            |

`nextjs-pages-components` has a Claude gap: there is no automatic Claude delivery mechanism (no glob-scoped auto-load, no nested-`CLAUDE.md` scaffolding) — Claude Code consumers must manually copy the conventions into their app's nested `CLAUDE.md`. See `CLAUDE.md`'s "Domain-Specific Conventions" section.

## Hooks

Kiro (`.kiro/hooks/`) and Claude Code (`.claude/hooks/`, wired via `.claude/settings.json`) both ship these two `PreToolUse` hooks; Copilot has no hook system, so its enforcement is prompt-level only.

| Hook         | Matcher (Claude Code)                                                                                                                                                                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| git-guard    | `Bash`, plus (issue #178) the mutating GitHub MCP tool surface — `mcp__github__merge_pull_request`, `enable_pr_auto_merge`, `push_files`, `create_or_update_file`, `delete_file`, `create_branch` | Blocks pushes/merges/writes into the default branch (resolved dynamically, not hardcoded to `main`) — including `gh pr merge` with its base resolved via `gh pr view` (not a `--base` text check), `gh pr merge --admin` (blocked outright), `gh pr merge --auto` when the resolved base is the default branch, the raw-git escape of merging a story/issue branch into an integration branch, and the equivalent MCP-tool-call forms of all of the above (base/branch resolved from structured `tool_input` fields, not a command string) — plus non-Conventional commits, inline `gh --body`, and human-only tags |
| branch-guard | `Edit\|Write\|NotebookEdit`                                                                                                                                                                       | Blocks write operations on default branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Hook enforcement is best-effort and fails open on unexpected errors, with one exception: if `git-guard` cannot verify a `gh pr merge`'s (or its MCP equivalent's) base branch — the `gh pr view` lookup fails (`gh` missing, unauthenticated, or a network error), or an MCP merge/auto-merge call omits enough `tool_input` to identify the PR at all — it fails **closed** and blocks the call, since an unverified base could be the default branch.

**Hooks are advisory, not the gate.** Every hook in this table is a best-effort, local, pattern-matching check over a command string or a structured tool-input shape — not a real parser, and not a completeness guarantee against every future command form or tool surface (a new MCP server, a future first-party tool) that could reopen the same class of gap. **GitHub branch protection on the default branch — require a PR, require ≥1 approving review, require passing status checks, disable force-push and branch deletion — is the actual, server-side, unbypassable-by-any-tool-surface control.** Hooks narrow the window and catch the common cases; they do not replace branch protection. Configure it per the README "Configure branch protection" step and `activity-init`'s Repository Setup section.

## General Agent Guidelines

All agents **MUST**:

- Create feature branches — never commit to default branch
- Use Conventional Commits (`feat`, `fix`, `chore`, `docs`, etc.)
- Create PRs for review — never self-merge into `main`; PRs targeting `main` require user approval
- Follow standards from `technical-guidelines.md`
- Reference GitHub Issues in branch names and commits
- Prefer `pnpm` over `npm`; use canonical scripts: `lint`, `format:check`, `typecheck`, `test`, `audit`, `validate`
- Enforce quality gates before completion
- Use `git-ops` for complex branch operations
- Run `qa-engineer` at completion gate (record `coverage_gate: PASS | FAIL | SKIPPED(<reason>)`)
- Run `verifier` audit (mandatory, non-skippable) before PR is ready; drift findings route to `product-engineer`
- Follow test-first design: write tests before implementation code
- If `memo-cli` is available: read/write entries per role
- Treat a blocked guard as a decision, not an obstacle: when a hook blocks a tool call, surface the block verbatim, stop that line of work, and **MUST NOT** attempt an alternative command, tool surface, or sequence that achieves the same effect the block just prevented. Using a legitimate alternate mechanism for an unrelated, non-triggering purpose (e.g. `Read` instead of `grep`, `Write` instead of a shell heredoc) is not a route-around and remains allowed

---

For workflow chains: [`docs/workflow-chains.md`](docs/workflow-chains.md). For architecture and invariants: [`docs/system-overview.md`](docs/system-overview.md). Full docs index: [`docs/README.md`](docs/README.md).
