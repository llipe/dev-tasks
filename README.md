# dev-tasks

A set of agents, skills, and instructions for GitHub Copilot, Claude Code, Kiro, and other AI coding agents to run structured, PRD-driven development workflows. Inspired by [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks).

---

## Getting Started

### 1. Install the package

```bash
pnpm add -g @llipe.com/dev-tasks
```

This gives you two binaries:

| Binary      | Purpose                                                 |
| ----------- | ------------------------------------------------------- |
| `dev-tasks` | Bootstrap: install agent files, update, status, migrate |
| `dt`        | Runtime: extract repo metadata, build context           |

### 2. Install agent workflow files into your repo

```bash
cd your-project
dev-tasks install
```

This installs agent definitions, skills, instructions, and prompts into your project for the AI platforms you use. By default it installs for Copilot + Claude Code (`--profile both`).

**Choose your platform profile:**

```bash
dev-tasks install --profile copilot       # .github/ only
dev-tasks install --profile claude        # .claude/ only
dev-tasks install --profile kiro          # .kiro/ only
dev-tasks install --profile all           # all platforms
```

### 3. Initialize your project context

Invoke the `product-engineer` agent in Init Mode (via `@product-engineer` or the `product-engineer-init` prompt). This creates:

- `docs/product-context.md` — what your product is and who it's for
- `docs/technical-guidelines.md` — stack, conventions, and constraints

Run this once per project.

### 4. Build a feature

```text
a) Invoke @product-engineer with a feature description or GitHub issue number
   → creates PRD → spec → stories → task list

b) Invoke @developer with the task list path
   → implements, tests, and opens a PR
```

### 5. Keep files up to date

```bash
dev-tasks update            # reconcile with hash-based conflict detection
dev-tasks update --force    # accept all upstream changes
dev-tasks status            # compare installed vs latest version
```

---

## Using `dt` for Multi-Repo Context

`dt` extracts repository metadata (schema, OpenAPI, AsyncAPI), derives a `component.json` manifest with provenance and confidence tracking, and builds cross-repo context for agent sessions.

### Extract metadata from a repo

```bash
cd my-service

# Run the full extraction pipeline
dt extract all --interactive

# Or run individual extractors
dt extract detect       # stack, framework, ORM, messaging
dt extract schema       # database schema from ORM definitions
dt extract openapi      # OpenAPI spec (copy existing or AST inference)
dt extract asyncapi     # AsyncAPI spec from Kafka topic patterns
dt extract component    # derive component.json manifest
```

### Review outputs

```bash
cat component.json           # manifest with _provenance metadata
cat extraction_report.json   # coverage, confidence, unresolved items
```

### Validate a manifest (offline, no network access)

```bash
dt validate-component component.json          # exit 0 valid, exit 4 invalid
dt validate-component component.json --json   # structured error list
```

### Typical workflow

```bash
dt extract all --interactive
dt validate-component component.json
git add component.json contracts/ docs/schema.md extraction_report.json
git commit -m "feat: add component manifest via dt extract"
```

### Artifact formats

For which artifacts are JSON vs YAML, and which are generated vs hand-written, see [`docs/artifact-formats.md`](docs/artifact-formats.md). Generated artifacts (`catalog/index.yaml`, `catalog/components/`) are never hand-edited.

### Global options

| Flag                 | Description                  |
| -------------------- | ---------------------------- |
| `--json`             | Machine-readable JSON output |
| `--meta-repo <path>` | Path or URL to the meta-repo |
| `-v`                 | Verbose diagnostics (stderr) |

### Exit codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 0    | OK                                                |
| 1    | Unexpected error                                  |
| 2    | Incorrect usage                                   |
| 13   | Incomplete extraction: required fields unresolved |
| 14   | Reconciliation conflict (edited fields)           |

---

## `dev-tasks` Command Reference

```bash
dev-tasks install [--pin <version>]   # Install skill files + write manifest
dev-tasks update [--force]            # Reconcile with hash-based conflict detection
dev-tasks status                      # Compare installed/pinned/latest versions
dev-tasks pin <version>               # Pin to a specific version
dev-tasks doctor                      # Check Node ≥20, git ≥2.37, cache writable
dev-tasks migrate                     # Migrate from legacy shell-script install
```

### Options (install / update)

| Option             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `--profile <name>` | `copilot` \| `claude` \| `kiro` \| `both` \| `all`   |
| `--dry-run`        | Print planned changes without writing any files      |
| `--backup`         | Backup managed files before replacing                |
| `--yes`            | Skip confirmation prompts (useful in CI)             |
| `--pin <version>`  | Pin to a specific release version                    |
| `--force`          | Accept all upstream changes without conflict prompts |

---

## The Core Idea

This system brings structure and clarity to AI-assisted development by:

- Defining scope with Product Requirements Documents (PRDs)
- Breaking requirements into actionable, implementation-ready tasks
- Guiding the AI to tackle one task at a time with checkpoints for review
- Providing specialized **agents** that orchestrate the workflow end-to-end
- Enforcing documentation, branch discipline, and GitHub-as-source-of-truth

---

## Taxonomy: Agent vs Skill vs Instruction

| Concept         | Purpose                                                                                                                                    | Loaded When                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| **Agent**       | Autonomous role with decision-making, phases, and handoff discipline. Owns a workflow end-to-end.                                          | Invoked by name (`@agent`)             |
| **Skill**       | Reusable on-demand capability. Describes _procedures_ or _activities_ that any agent can invoke when needed. Not loaded unless referenced. | On demand (invoked by agent or prompt) |
| **Instruction** | Always-loaded rule scoped via `applyTo` frontmatter. Enforced automatically for every matching context.                                    | Always (auto-applied by runtime)       |

**Key distinctions:**

- Skills save context window space — they are loaded only when invoked, unlike instructions which are always present.
- Agent files define _who_ (identity, phases, handoff rules). Skill files define _how_ (procedures, templates, steps).
- Instructions are for cross-cutting rules that must never be forgotten (e.g., implementation discipline, planning format).

---

## Agents

Agents are autonomous personas that orchestrate skills and activities.

> **Available for:** Copilot (`.github/agents/`), Claude Code (`.claude/agents/`), Kiro (`.kiro/agents/`). All three platforms define the same 8 agents below.

### `product-engineer`

Preparation agent — owns the full pre-coding chain:

- **Init Mode**: `activity-init` → product-context.md + technical-guidelines.md
- **Feature Mode**: `activity-refine` → `activity-generate-spec` → `activity-generate-stories` → `activity-publish-github` → `plan`
- **Issue Mode**: `activity-refine` → `plan`

Also owns drift reconciliation via `activity-drift-reconciliation`.

### `developer`

Execution agent — implements code from an existing task list. Runs `implement`, including a mandatory `verifier` audit before every PR is marked ready. Uses `git-ops` for branch management.

### `planner`

Multi-story orchestration with checkpoint/resume:

| Phase | What Happens                                                      |
| ----- | ----------------------------------------------------------------- |
| 0     | Discover task source                                              |
| 0.5   | Resume detection                                                  |
| 1     | Parse stories and infer dependencies                              |
| 2     | Dependency graph — user approval required                         |
| 3     | Pre-flight — creates integration branch                           |
| 4     | Delegate to `developer` per story; merge and write checkpoint     |
| 5     | PRD-level rollup `verifier` audit, then consolidated PR to `main` |

### Other Agents

| Agent              | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `ux-engineer`      | PRD/SPEC-to-mockup prototyping                     |
| `technical-writer` | Documentation maintenance                          |
| `housekeeping`     | Lint, type, and test-wiring fixes                  |
| `github-ops`       | GitHub consistency — issues, PRs, branches, labels |
| `verifier`         | Compliance test-plan design and fidelity auditing  |

---

## Skills

On-demand capabilities loaded only when invoked.

| Skill                           | Purpose                                         | Consumer                                            |
| ------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `activity-init`                 | Product context and technical guidelines        | `product-engineer`                                  |
| `activity-refine`               | Issue refinement or PRD creation                | `product-engineer`                                  |
| `activity-generate-spec`        | PRD → technical specification                   | `product-engineer`                                  |
| `activity-generate-stories`     | Spec → user stories with coverage validation    | `product-engineer`                                  |
| `activity-publish-github`       | Stories → GitHub Issues                         | `product-engineer`                                  |
| `activity-drift-reconciliation` | Routes verifier drift findings into remediation | `product-engineer`                                  |
| `git-ops`                       | Branch, rebase, merge, conflict resolution      | `developer`, `planner`                              |
| `webapp-mockup`                 | React mockup scaffold for UX testing            | `ux-engineer`                                       |
| `activity-e2e-test-design`      | E2E black-box test scenario generation          | `verifier`                                          |
| `activity-contract-test-design` | Consumer/provider contract testing              | `verifier`                                          |
| `activity-edge-case-refinement` | Systematic edge-case discovery                  | `verifier`                                          |
| `activity-random-test-tactics`  | Randomized, fuzz, and property-inspired tests   | `verifier`                                          |
| `memo-cli-usage`                | Shared architectural memory across sessions     | `product-engineer`, `developer`, `technical-writer` |

---

## Instructions (Always-Loaded)

| Instruction                                      | Scope      | Purpose                                |
| ------------------------------------------------ | ---------- | -------------------------------------- |
| `plan.instructions.md`                           | `**`       | Convert stories/issues into task lists |
| `implement.instructions.md`                      | `**`       | Execute task list with approval gates  |
| `domain/nextjs-pages-components.instructions.md` | `**/*.tsx` | Next.js + React conventions            |

---

## Prompts

> Copilot: `.github/prompts/*.prompt.md`. Claude Code: `.claude/commands/*.md`. Kiro: embedded in `.kiro/agents/*.md`.

| Prompt                     | Agent            | Purpose                           |
| -------------------------- | ---------------- | --------------------------------- |
| `product-engineer-init`    | product-engineer | Initialize foundation documents   |
| `product-engineer-feature` | product-engineer | Design and plan a feature         |
| `product-engineer-issue`   | product-engineer | Refine and plan a GitHub Issue    |
| `developer-execute`        | developer        | Execute an existing task list     |
| `planner`                  | planner          | Orchestrate multi-story execution |
| `planner-resume`           | planner          | Resume from checkpoint            |
| `ux-engineer`              | ux-engineer      | Generate UX mockups               |
| `github-ops`               | github-ops       | GitHub consistency                |
| `technical-writer`         | technical-writer | Documentation maintenance         |
| `housekeeping`             | housekeeping     | Lint, type, test fixes            |
| `verifier-design`          | verifier         | Generate compliance test plan     |
| `verifier-audit`           | verifier         | Grey-box fidelity audit           |

---

## Workflow Chains

Match your situation to a chain below, then invoke the first agent in the chain.

### Full Feature (PRD-Driven)

```
product-engineer: refine → generate-spec → generate-stories → publish-github → plan
                                                                                  ↓
developer: implement
```

### Single GitHub Issue

```
product-engineer: refine → plan
                            ↓
developer: implement
```

### Multi-Story Orchestration

```
product-engineer: ... → plan
                          ↓
planner: orchestrate → developer: implement (per story, sequential)
```

### Quick Fix

```
developer: implement
```

### Test-First Design (Verifier)

```
product-engineer: spec → stories → plan
                                        ↓
verifier (design mode): generate test plan
                                        ↓
developer: implement (tests first, then code)
                        ↓ (mandatory)
verifier (audit mode): fidelity audit → report
                        ↓ (drift findings, non-blocking)
product-engineer: drift-reconciliation
```

---

## File Organization

| Directory             | Contents                                                |
| --------------------- | ------------------------------------------------------- |
| `/docs/`              | Foundation docs — product-context, technical-guidelines |
| `/docs/requirements/` | PRDs produced by the refine skill                       |
| `/workstream/`        | Active feature work — specs, stories, task lists        |
| `bin/`                | CLI entrypoints (`dev-tasks.ts`, `dt.ts`)               |
| `core/`               | Business logic library (extract, distribution)          |
| `adapters/cli/`       | CLI adapter — wraps core, formats stdout/JSON           |
| `schemas/`            | JSON Schemas for validation                             |
| `test/`               | Unit and integration tests + fixtures                   |
| `.github/`            | Copilot agents, skills, instructions, prompts           |
| `.kiro/`              | Kiro agents, skills, steering, hooks                    |

---

## memo-cli Integration (Optional)

When `memo-cli` is installed and configured, agents share context across sessions and repositories.

```bash
which memo && memo setup validate
```

If `memo` is installed but validation fails:

```bash
memo setup init --repo <repo-name> --org <org-name> --domain <domain>
```

---

## Known Limitations

- **Route 2 (isolated framework boot) is interface-only** — only routes 1 and 3 are functional for OpenAPI extraction.
- **LLM inference is stubbed** — no real LLM provider is wired yet.
- **Only Node/TS provider** — other language stacks require additional extraction providers.
- **Zod extraction handles basic `z.object` patterns only** — complex compositions are not fully supported.
- **Only kafkajs patterns supported** — other messaging clients are not detected.

---

## Tips

- Use `step-gated` mode (default) to review each sub-task
- Use `pre-approved autonomous batch` mode when you trust the agent to run autonomously
- Use `planner-resume` when a multi-story orchestration is interrupted
- Run `housekeeping` after major feature branches to catch regressions
- Domain instructions are auto-applied based on `applyTo` patterns

---

## Contributing

### Prerequisites

- Node.js >= 20
- pnpm (via `corepack enable`)
- git >= 2.37

### Setup

```bash
git clone https://github.com/llipe/dev-tasks.git
cd dev-tasks
pnpm install
```

### Build

```bash
pnpm run build          # compile TypeScript to dist/
pnpm run typecheck      # type-check without emitting
```

### Test

```bash
pnpm run test           # all tests (vitest)
pnpm run test:unit      # unit tests only
pnpm run test:integration  # integration tests only
```

### Lint and Format

```bash
pnpm run lint           # ESLint (zero warnings)
pnpm run lint:fix       # auto-fix lint issues
pnpm run format:check   # Prettier check
pnpm run format         # Prettier write
```

### Full validation (CI equivalent)

```bash
pnpm run validate       # typecheck + lint + format:check + test
```

### Releasing a new version

Releases are automated via git tags. Use the release script:

```bash
git checkout main
git pull origin main
./scripts/release.sh patch   # or: minor / major
```

The script:

1. Validates pre-flight conditions (branch, clean tree, format check).
2. Auto-generates a CHANGELOG entry from commit history.
3. Updates `package.json` version.
4. Commits (`chore(release): v<version>`), creates an annotated tag, and pushes.
5. The tag push triggers CI workflows:
   - `.github/workflows/release-bundle.yml` — builds the tarball and creates a GitHub Release
   - `.github/workflows/publish-npm.yml` — publishes to npm as `@llipe.com/dev-tasks`

After the workflows complete, verify:

```bash
npm view @llipe.com/dev-tasks version
```

### CI setup (npm Trusted Publishers)

The npm publish workflow uses OIDC — no npm token secret needed. Configure once on npmjs.com:

1. Go to npmjs.com → `@llipe.com/dev-tasks` → Settings → Trusted Publisher
2. Select GitHub Actions:
   - Organization/user: `llipe`
   - Repository: `dev-tasks`
   - Workflow: `publish-npm.yml`
   - Environment: `npm`
3. Create a GitHub environment named `npm` in the repo (Settings → Environments)

---

## Attribution

Original idea based on [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)
