# dev-tasks

Portable, repo-installed workflow harness for structured, PRD-driven AI-assisted development. Agents orchestrate the workflow end-to-end with branch discipline, test-first design, and GitHub-as-source-of-truth.

## Contracts

| File | Owner | Purpose |
|------|-------|---------|
| `/DESIGN.md` | `ux-engineer` | Canonical design-system tokens and UI guidance |
| `/TESTING.md` | `qa-engineer` | Layer taxonomy, runners, thresholds, fixtures |

If `/DESIGN.md` is missing and scope includes UI work, agents **MUST** create a baseline before finalizing design-dependent outputs. An unfilled `/TESTING.md` placeholder means "no standard established", never permission.

## Taxonomy

| Concept | Purpose | Loaded When |
|---------|---------|-------------|
| **Agent** | Autonomous role with decisions and handoffs | Invoked by name |
| **Skill** | Reusable on-demand procedure | On demand by agent |
| **Instruction** | Scoped rule auto-applied to matching context | Auto-applied by runtime |

## Agents

| Agent | Purpose |
|-------|---------|
| **product-engineer** | Preparation — PRD, spec, stories, plan. Owns drift-reconciliation. |
| **developer** | Execution — implements from task lists with mandatory verifier audit pre-PR. |
| **planner** | Multi-story orchestration with dependency ordering and integration PR. |
| **technical-writer** | Autonomous documentation maintenance. |
| **housekeeping** | Lint, type, and test-wiring fixes. |
| **github-ops** | GitHub consistency — issues, PRs, branches, labels, milestones, merge authority. |
| **ux-engineer** | UX prototyping, DESIGN.md ownership, mockup generation. |
| **qa-engineer** | Testing standard, test authoring, coverage/gap reporting. |
| **verifier** | Compliance test-plan design and post-implementation fidelity audit. |

Platform coverage: `.github/agents/` and `.kiro/agents/` carry all nine. `.claude/agents/` carries seven — `planner` and `product-engineer` run as `.claude/commands/` (need user-approval gates).

## Skills

### Activity Skills

| Skill | Purpose | Consumer |
|-------|---------|----------|
| activity-init | Establish product context and technical guidelines | product-engineer |
| activity-refine | Issue refinement or full PRD creation | product-engineer |
| activity-generate-spec | PRD to technical specification | product-engineer |
| activity-generate-stories | Spec to user stories with coverage validation | product-engineer |
| activity-publish-github | Publish stories as GitHub Issues | product-engineer |
| activity-e2e-test-design | E2E scenario generation from spec/stories | verifier |
| activity-contract-test-design | Contract and schema compatibility test strategy | verifier |
| activity-edge-case-refinement | Systematic edge-case discovery | verifier |
| activity-random-test-tactics | Randomized/fuzz/property test generation | verifier |
| activity-test-standards | Establish/maintain TESTING.md, detect harness defects | qa-engineer |
| activity-test-implementation | Author Layer 1-2 tests with security-negative category | qa-engineer |
| activity-integration-test-implementation | Layer 2.5 tests against real databases | qa-engineer |
| activity-e2e-test-implementation | Playwright E2E from verifier scenario tables | qa-engineer |
| activity-contract-validation | API contract drift/breaking-change detection | qa-engineer |
| activity-coverage-gap-analysis | Coverage measurement or structural gap analysis | qa-engineer |
| activity-drift-reconciliation | Route drift findings to task expansion or spec write-back | product-engineer |

### Operational Skills

| Skill | Purpose | Consumer |
|-------|---------|----------|
| git-ops | Branch management, rebase, merge, conflict resolution | developer, planner |
| ux-scaffold | Mockup project creation (html-lite, react-full) | ux-engineer |
| ux-theme-gen | Generate theme artifacts from DESIGN.md | ux-engineer, developer |
| memo-cli-usage | Read/write decisions to shared knowledge base | technical-writer, developer |

## Instructions

| Instruction | Scope | Purpose |
|-------------|-------|---------|
| plan | `workstream/**` | Convert stories/issues into task lists |
| implement | `workstream/**/tasks-*.md` | Execute task list with branching and PR discipline |
| nextjs-pages-components | `**/app/**/*.tsx` | Next.js + React conventions |
| git-guard-notice | Always (Kiro) | Git invariants reminder |

## Hooks

| Hook | Purpose |
|------|---------|
| git-guard | Blocks pushes/merges to `main`, non-Conventional commits, inline `gh --body` |
| branch-guard | Blocks write operations on default branch |

Hook enforcement is best-effort. Human PR review is the actual gate.

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

---

## Task Types

### architecture-change

The only mode granting write authority to the meta-repo. Agents **MUST NOT** write to the meta-repo outside this task type — applies to `product-engineer`, `developer`, `planner`, `housekeeping`, and all others.

#### Write Scope (RF-62)

**MAY** modify: `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, `catalog/flows/`.

**MUST NOT** modify: `catalog/components/*.json`, `catalog/index.yaml` — generated by CI (`dt extract` and `dt catalog build`), never hand-edited or agent-edited.

#### Generated-File Prohibition

`catalog/components/*.json` and `catalog/index.yaml` are generated by CI pipelines. No agent or human may edit these files directly.

#### ADR Requirement

Before opening any meta-repo PR under this task type, the agent **MUST** produce an Architecture Decision Record (ADR) containing: **Context** (why), **Decision** (what), **Consequences** (impact), and **Alternatives considered** (rejected approaches). The ADR **MUST** be committed as part of the PR.

#### Human Approval Gate

PRs from this task type targeting the meta-repo **REQUIRE** explicit human review and approval. No agent may auto-merge an `architecture-change` PR into the default branch.

#### Exclusion Rule (RF-64)

Agents **MUST NOT** write to the meta-repo outside the `architecture-change` task type. Refuse with:

> "Meta-repo writes require the `architecture-change` task type. Create an architecture-change task to modify these files."

---

## Cross-Repo Partitioning (RF-63)

When a scoping step identifies more than one `primary` component, the feature spans multiple repositories and the agent **MUST** partition the work into per-repo sub-tasks.

### Partitioning Procedure

1. **Detection:** If `scope.primary` contains >1 component, partition is **REQUIRED**.
2. **One sub-task per repo:** Each `primary` component becomes its own sub-task, scoped exclusively to that component's repository.
3. **Partition proposal:** When a partition proposal is available from `dt scope gate` (G1 abort, exit 7), the agent **SHOULD** use it as the basis for the partition. When no proposal exists, the agent **MUST** apply the same rules manually.

### Contract-as-Interface

Each sub-task uses the **boundary contract** (with a target version) as its interface. Acceptance criteria **MUST** reference the contract definition, **not** the foreign repo's internal implementation.

### Ordering Rule

Sub-tasks **MUST** be ordered producer-before-consumers: the provider (producer) implements its contract first. Consumer sub-tasks implement adaptation to the contract after the provider sub-task is complete.

### Low-Payload Elevation Guard

A boundary contract with `payload_confidence: low` **MUST** be raised to at least `medium` before use as an acceptance boundary. This is achieved by Re-running extraction (`dt extract`) with improved source hints, or Manual confirmation of the payload shape by a human reviewer.

Until elevated, the agent **MUST NOT** use it as an acceptance interface and **MUST** block the sub-task with:

> "Boundary contract `<contract-id>` has `payload_confidence: low`. Re-run extraction or manually confirm the payload shape before using it as an acceptance boundary."

### Single-Primary — No Partition

When `scope.primary` contains exactly 1 component, no partitioning is needed. The feature is single-repo and proceeds normally.

---

For workflow chains: [`docs/workflow-chains.md`](docs/workflow-chains.md). For architecture and invariants: [`docs/system-overview.md`](docs/system-overview.md). Full docs index: [`docs/README.md`](docs/README.md).
