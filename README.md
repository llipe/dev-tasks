# dev-tasks

A set of agents, skills, and instructions for GitHub Copilot, Claude Code, Kiro, and other AI coding agents to run structured, PRD-driven development workflows. Inspired by [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks).

---

## Getting Started

### 1. Install the package

```bash
pnpm add -g @llipe.com/dev-tasks
```

This gives you two binaries:

| Binary      | Stability    | Purpose                                                 |
| ----------- | ------------ | ------------------------------------------------------- |
| `dev-tasks` | **Stable**   | Bootstrap: install agent files, update, status, migrate |
| `dt`        | **Unstable** | Runtime: extract repo metadata, build context           |

> **⚠️ `dt` is unstable** — recommended for testing purposes only. The extraction pipeline, manifest format, and CLI surface may change without notice between releases. The rest of dev-tasks (agents, skills, instructions, `dev-tasks` CLI) is available for use.

### 2. Install agent workflow files into your repo

```bash
cd your-project
dev-tasks install
```

This installs agent definitions, skills, instructions, and prompts into your project for the AI platforms you use. By default it installs for all platforms (`--profile all`).

**Choose your platform profile:**

```bash
dev-tasks install --profile copilot       # .github/ only
dev-tasks install --profile claude        # .claude/ only
dev-tasks install --profile kiro          # .kiro/ only
dev-tasks install --profile both          # copilot + claude only
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

## Using `dt` for Multi-Repo Context _(Unstable — testing only)_

> **⚠️ Unstable:** The `dt` command is under active development and recommended for testing purposes only. APIs, flags, output formats, and exit codes may change between releases.

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

### CLI documentation

- **`dev-tasks` (bootstrap/distribution):** [`docs/dev-tasks-user-manual.md`](docs/dev-tasks-user-manual.md) — install, update, pin/unpin, profiles, manifest merging, reconciliation
- **`dt` (extraction/catalog/context):** [`docs/dt-user-manual.md`](docs/dt-user-manual.md) — extract, catalog, context, scope
- **Architecture and artifacts:** [`docs/system-overview.md`](docs/system-overview.md) and [`docs/data-model.md`](docs/data-model.md)
- **Everything else:** [`docs/README.md`](docs/README.md)

### Global options

| Flag                 | Description                  |
| -------------------- | ---------------------------- |
| `--json`             | Machine-readable JSON output |
| `--meta-repo <path>` | Path or URL to the meta-repo |
| `-v`                 | Verbose diagnostics (stderr) |

### Exit codes

Both binaries share one exit-code table. Common cases:

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 0    | OK                                                |
| 1    | Unexpected error                                  |
| 2    | Incorrect usage                                   |
| 7    | Gate aborted (scope gate G1–G4)                   |
| 8    | Breaking contract change detected                 |
| 13   | Incomplete extraction: required fields unresolved |
| 14   | Reconciliation conflict (edited fields)           |

Full table with all 15 codes: [`docs/data-model.md`](docs/data-model.md#exit-code-contract).

---

## `dev-tasks` Command Reference

```bash
dev-tasks install [--pin <version>]   # Install skill files + write manifest
dev-tasks update [--force]            # Reconcile with hash-based conflict detection
dev-tasks status                      # Compare installed/pinned/latest versions
dev-tasks pin <version>               # Pin to a specific version
dev-tasks unpin                       # Remove the version pin
dev-tasks doctor                      # Check Node ≥20, git ≥2.37, cache writable
dev-tasks migrate                     # Migrate from legacy shell-script install
```

### Version Pinning

Pin locks your project to a specific version. When pinned, `update` fetches the pinned version from the npm registry and reconciles against it — even if your locally installed package is newer:

```bash
dev-tasks pin 0.5.0    # Lock to 0.5.0
dev-tasks update       # Fetches 0.5.0 from registry and reconciles against it
dev-tasks unpin        # Remove the pin (update will use the local package version)
```

### Options (install / update)

| Option             | Applies to | Description                                                         |
| ------------------ | ---------- | ------------------------------------------------------------------- |
| `--profile <name>` | install    | `copilot` \| `claude` \| `kiro` \| `both` \| `all` (default: `all`) |
| `--pin <version>`  | install    | Pin to a specific release version                                   |
| `--force`          | update     | Back up conflicting files, then overwrite them                      |
| `--json`           | both       | Machine-readable output                                             |

`update` never overwrites a locally modified managed file without `--force`; it reports the conflict and exits `14`.

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
| **Instruction** | Rule scoped via `applyTo`/`fileMatchPattern` frontmatter. Enforced automatically whenever the agent touches a matching file.               | Auto-applied on matching context       |

**Key distinctions:**

- Skills save context window space — they are loaded only when invoked, unlike instructions which load automatically for every matching file.
- Agent files define _who_ (identity, phases, handoff rules). Skill files define _how_ (procedures, templates, steps).
- Instructions are for cross-cutting rules that must never be forgotten (e.g., implementation discipline, planning format).

---

## Agents

Agents are autonomous personas that orchestrate skills and activities.

> **Available for:** Copilot (`.github/agents/`), Claude Code (`.claude/agents/`), Kiro (`.kiro/agents/`). Copilot and Kiro define all 8 agents below. On Claude Code, the two orchestrators (`planner`, `product-engineer`) run in the main thread as `/commands` so they can pause for approval gates; the other 6 are subagents.

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

## Instructions (Scoped)

Auto-applied whenever the agent touches a matching file. Claude Code has no scoped-instruction mechanism, so `plan` and `implement` ship there as skills.

| Instruction               | Scope                      | Purpose                                |
| ------------------------- | -------------------------- | -------------------------------------- |
| `plan`                    | `workstream/**`            | Convert stories/issues into task lists |
| `implement`               | `workstream/**/tasks-*.md` | Execute task list with approval gates  |
| `nextjs-pages-components` | `**/app/**/*.tsx`          | Next.js + React conventions            |
| `git-guard-notice`        | Always loaded (Kiro)       | Restates the three git invariants      |

Copilot reads `.github/instructions/*.instructions.md`, Kiro reads `.kiro/steering/*.md`, and Claude Code reads `.claude/skills/{plan,implement}/`.

### Hooks

`git-guard` blocks pushes and merges to `main`, non-Conventional commit messages, and inline `gh --body`. `branch-guard` blocks write operations while on the default branch. Both are best-effort; human PR review is the actual gate.

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

Match your situation to a chain, then invoke the first agent in it. Full diagrams, including the UX validation loop and project initialization, are in [`docs/workflow-chains.md`](docs/workflow-chains.md).

| Situation                   | Chain                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Full feature, PRD-driven    | `product-engineer` (refine → spec → stories → publish → plan) → `developer`                                   |
| Single GitHub Issue         | `product-engineer` (refine → plan) → `developer`                                                              |
| Several dependent stories   | `product-engineer` (… → plan) → `planner` → `developer` per story, sequential                                 |
| Quick fix, task list exists | `developer`                                                                                                   |
| Test-first design           | … → plan → `verifier` (design) → `developer` → `verifier` (audit) → `product-engineer` (drift reconciliation) |
| UX validation before build  | `product-engineer` (refine → spec) → `ux-engineer` → `product-engineer`                                       |
| New project                 | `product-engineer` (init mode)                                                                                |

The `verifier` audit after implementation is mandatory and non-skippable before a PR is marked ready.

---

## File Organization

| Directory             | Contents                                                                |
| --------------------- | ----------------------------------------------------------------------- |
| `/docs/`              | Documentation — see [`docs/README.md`](docs/README.md) for the index    |
| `/docs/adr/`          | Architecture decision records                                           |
| `/docs/requirements/` | PRDs produced by the refine skill                                       |
| `/workstream/`        | Active feature work — specs, stories, task lists, fidelity reports      |
| `bin/`                | CLI entrypoints (`dev-tasks.ts`, `dt.ts`)                               |
| `core/`               | Business logic — catalog, context, distribution, extract, scope, verify |
| `adapters/cli/`       | CLI adapter — wraps core, formats stdout/JSON                           |
| `adapters/mcp/`       | MCP adapter placeholder (not implemented)                               |
| `schemas/`            | JSON Schemas for validation                                             |
| `scripts/`            | Bundle build, release, and formatting scripts                           |
| `templates/`          | Meta-repo scaffold and CI templates                                     |
| `test/`               | Unit and integration tests + fixtures                                   |
| `.github/`            | Copilot agents, skills, instructions, prompts; CI workflows             |
| `.claude/`            | Claude Code agents, skills, commands, hooks                             |
| `.kiro/`              | Kiro agents, skills, steering, hooks                                    |

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
