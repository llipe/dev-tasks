# dev-tasks

A set of agents, skills, and instructions for GitHub Copilot and other AI coding agents to run structured, PRD-driven development workflows. Inspired by [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks).

## The Core Idea

This system brings structure and clarity to AI-assisted development by:

- Defining scope with Product Requirements Documents (PRDs)
- Breaking requirements into actionable, implementation-ready tasks
- Guiding the AI to tackle one task at a time with checkpoints for review
- Providing specialized **agents** that orchestrate the workflow end-to-end
- Enforcing documentation, branch discipline, and GitHub-as-source-of-truth

---

## Taxonomy: Agent vs Skill vs Instruction

| Concept         | Purpose                                                                                                                                    | Loaded When                            | Decision Rule                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Agent**       | Autonomous role with decision-making, phases, and handoff discipline. Owns a workflow end-to-end.                                          | Invoked by name (`@agent`)             | "Does it make decisions, own a multi-phase workflow, and hand off to other agents?" → Agent |
| **Skill**       | Reusable on-demand capability. Describes _procedures_ or _activities_ that any agent can invoke when needed. Not loaded unless referenced. | On demand (invoked by agent or prompt) | "Is this capability needed only sometimes, by one or more agents?" → Skill                  |
| **Instruction** | Always-loaded rule scoped via `applyTo` frontmatter. Enforced automatically for every matching context.                                    | Always (auto-applied by runtime)       | "Must this rule be enforced every time, for every matching file or context?" → Instruction  |

**Key distinctions:**

- Skills save context window space — they are loaded only when invoked, unlike instructions which are always present.
- Agent files define _who_ (identity, phases, handoff rules). Skill files define _how_ (procedures, templates, steps).
- Instructions are for cross-cutting rules that must never be forgotten (e.g., implementation discipline, planning format).

---

## Installation

### Prerequisites

- macOS / Linux (or WSL on Windows)
- `git`
- `curl`
- `tar`
- `shasum` (or `sha256sum`)

### Option A: Install `dev-tasks` into any repository (recommended)

Run this in the repository where you want to use the workflow:

```bash
curl -fsSL https://raw.githubusercontent.com/llipe/dev-tasks/main/dev-tasks.sh \
  -o dev-tasks.sh && chmod +x dev-tasks.sh
./dev-tasks.sh install
```

### Option B: Set up this repository locally (contributors)

```bash
git clone https://github.com/llipe/dev-tasks.git
cd dev-tasks
chmod +x dev-tasks.sh
./dev-tasks.sh version
./dev-tasks.sh check
```

### Verify the installation

After install, confirm these paths exist in your target repo:

- `.github/agents/`
- `.github/skills/`
- `.github/instructions/`
- `.github/prompts/`
- `.dev-tasks-version`

---

## Getting Started

### 1. Install with the single-script installer

Bootstrap from any repository with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/llipe/dev-tasks/main/dev-tasks.sh \
  -o dev-tasks.sh && chmod +x dev-tasks.sh
./dev-tasks.sh install
```

This downloads the latest versioned bundle from GitHub Releases, places all managed files in `.github/agents/`, `.github/skills/`, `.github/instructions/`, and `.github/prompts/`, writes `.dev-tasks-version` for traceability, and prints an **AGENTS.md integration prompt** showing what changed.

**Pin to a specific version:**

```bash
./dev-tasks.sh install v1.2.0
```

**Check for updates:**

```bash
./dev-tasks.sh check
```

**List installed files and directories:**

```bash
./dev-tasks.sh list
```

**Update (with automatic backup):**

```bash
./dev-tasks.sh update --backup
```

**Preview what would change without writing any files:**

```bash
./dev-tasks.sh update --dry-run
```

See [Distribution & Script Reference](#distribution--script-reference) below for full documentation.

After install, your repo contains:

```text
your-repo/
├── dev-tasks.sh               # Keep this — used for future updates
├── .dev-tasks-version         # Installed version metadata (JSON)
├── .github/
│   ├── instructions/          # Always-loaded rules
│   │   ├── plan.instructions.md
│   │   ├── implement.instructions.md
│   │   └── domain/
│   │       └── nextjs-pages-components.instructions.md
│   ├── agents/                # Agent definitions (8 agents)
│   ├── skills/                # On-demand capabilities (12 skills)
│   └── prompts/               # Ready-to-use prompt templates
├── docs/                      # Foundation docs (generated by init)
├── workstream/                # Active feature work
└── AGENTS.md                  # Master registry (you own this — see integration prompt)
```

### 2. Initialize your project foundation

Run the `product-engineer` agent in **Init Mode** to establish your product context and technical guidelines:

> Use the `product-engineer-init` prompt or invoke `@product-engineer` with a project description.

This produces `docs/product-context.md` and `docs/technical-guidelines.md`. Run this once per project (or when a major pivot occurs).

### 3. Start building

| Situation                        | How to start                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| **New feature / epic**           | Invoke `product-engineer` with a feature description, then `developer` to implement         |
| **Single GitHub Issue**          | Invoke `product-engineer` with an issue number, then `developer` to implement               |
| **Already have a task list**     | Invoke `developer` with a task list path                                                    |
| **Multi-story PRD batch**        | Invoke `planner` with a `/workstream` task file or milestone                                |
| **UX prototype**                 | Invoke `ux-engineer` with a PRD or SPEC path                                                |
| **Docs out of date**             | Invoke `technical-writer`                                                                   |
| **Lint/type/test cleanup**       | Invoke `housekeeping`                                                                       |
| **Black-box compliance testing** | Invoke `black-box-tester` with a spec or story to generate test plans and validate behavior |

### 4. (Optional) Add domain-specific instructions

Create technology-specific instruction files scoped to certain file patterns via `applyTo` frontmatter:

```yaml
---
applyTo: "apps/my-app/src/**/*.tsx"
---
# Your project-specific component conventions here
```

---

## Agents

Agents are autonomous personas that orchestrate skills and activities. They live in `.github/agents/`.

### `product-engineer`

Preparation agent — owns the full pre-coding chain:

- **Init Mode**: `activity-init` → product-context.md + technical-guidelines.md
- **Feature Mode**: `activity-refine` → `activity-generate-spec` → `activity-generate-stories` → `activity-publish-github` → `plan`
- **Issue Mode**: `activity-refine` → `plan`

Hands off to `developer` or `planner` for execution.

### `developer`

Execution agent — implements code from an existing task list. Runs `implement` only. Uses `git-ops` for branch management.

### `planner`

Multi-story orchestration with checkpoint/resume:

| Phase | What Happens                                                  |
| ----- | ------------------------------------------------------------- |
| 0     | Discover task source                                          |
| 0.5   | Resume detection — checks for existing checkpoint state file  |
| 1     | Parse stories and infer dependencies                          |
| 2     | Dependency graph — **user approval required**                 |
| 3     | Pre-flight — creates integration branch                       |
| 4     | Delegate to `developer` per story; merge and write checkpoint |
| 5     | Consolidated PR to `main` — **user must approve**             |

### Other Agents

| Agent              | Purpose                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ux-engineer`      | PRD/SPEC-to-mockup — feeds refinements back to `product-engineer`                                                                     |
| `technical-writer` | Documentation maintenance                                                                                                             |
| `housekeeping`     | Lint, type, and test-wiring fixes                                                                                                     |
| `github-ops`       | GitHub consistency — issues, PRs, branches, labels, milestones                                                                        |
| `black-box-tester` | Deep black-box testing — derives compliance test plans and edge cases from specs/stories, validates "requested vs delivered" behavior |

---

## Skills

On-demand capabilities loaded only when invoked. Each lives in `.github/skills/<name>/SKILL.md`.

| Skill                           | Purpose                                                                                                             | Consumer                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `activity-init`                 | Product context and technical guidelines                                                                            | `product-engineer`                                  |
| `activity-refine`               | Issue refinement or PRD creation                                                                                    | `product-engineer`                                  |
| `activity-generate-spec`        | PRD → technical specification                                                                                       | `product-engineer`                                  |
| `activity-generate-stories`     | Spec → user stories with coverage validation                                                                        | `product-engineer`                                  |
| `activity-publish-github`       | Stories → GitHub Issues                                                                                             | `product-engineer`                                  |
| `git-ops`                       | Branch, rebase, merge, conflict resolution                                                                          | `developer`, `planner`                              |
| `webapp-mockup`                 | React mockup scaffold for UX testing                                                                                | `ux-engineer`                                       |
| `activity-e2e-test-design`      | E2E black-box test scenario generation from spec/stories                                                            | `black-box-tester`                                  |
| `activity-contract-test-design` | Consumer/provider contract and schema compatibility testing                                                         | `black-box-tester`                                  |
| `activity-edge-case-refinement` | Systematic edge-case discovery by category with examples                                                            | `black-box-tester`                                  |
| `activity-random-test-tactics`  | Randomized, fuzz, and property-inspired test generation                                                             | `black-box-tester`                                  |
| `memo-cli-usage`                | Shared architectural memory with `memo-cli` (read session context, write intent/outcome and ADR/decision rationale) | `product-engineer`, `developer`, `technical-writer` |

---

## Instructions (Always-Loaded)

| Instruction                                      | Scope      | Purpose                                |
| ------------------------------------------------ | ---------- | -------------------------------------- |
| `plan.instructions.md`                           | `**`       | Convert stories/issues into task lists |
| `implement.instructions.md`                      | `**`       | Execute task list with approval gates  |
| `domain/nextjs-pages-components.instructions.md` | `**/*.tsx` | Next.js + React conventions            |

---

## Prompts

| Prompt                      | Agent            | Purpose                                             |
| --------------------------- | ---------------- | --------------------------------------------------- |
| `product-engineer-init`     | product-engineer | Initialize foundation documents                     |
| `product-engineer-feature`  | product-engineer | Design and plan a feature                           |
| `product-engineer-issue`    | product-engineer | Refine and plan a GitHub Issue                      |
| `developer-execute`         | developer        | Execute an existing task list                       |
| `planner`                   | planner          | Orchestrate multi-story execution                   |
| `planner-resume`            | planner          | Resume from checkpoint                              |
| `ux-engineer`               | ux-engineer      | Generate UX mockups                                 |
| `github-ops`                | github-ops       | GitHub consistency                                  |
| `technical-writer`          | technical-writer | Documentation maintenance                           |
| `housekeeping`              | housekeeping     | Lint, type, test fixes                              |
| `black-box-tester-design`   | black-box-tester | Generate compliance test plan from spec or stories  |
| `black-box-tester-validate` | black-box-tester | Validate delivered behavior against spec or stories |

---

## Workflow Chains

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

### UX Validation Loop

```
product-engineer: refine → generate-spec → ux-engineer: mockups → product-engineer: update
```

### Test-First Design (Black-Box)

```
product-engineer: refine → spec → stories → plan
                                                 ↓
black-box-tester: generate test plan (from spec or stories)
                                                 ↓
developer: implement (feature + tests from test plan)
                                                 ↓
black-box-tester: validate compliance → validation report
```

---

## File Organization

| Directory                      | Contents                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| `/docs/`                       | Foundation documents — product-context, technical-guidelines, ADRs    |
| `/docs/requirements/`          | PRDs produced by the refine skill                                     |
| `/workstream/`                 | Active feature work — specs, stories, task lists, planner state files |
| `.github/instructions/`        | Always-loaded instruction files                                       |
| `.github/instructions/domain/` | Project-specific coding standards (auto-applied)                      |
| `.github/agents/`              | Agent definition files                                                |
| `.github/skills/`              | On-demand skill definitions                                           |
| `.github/prompts/`             | Agent invocation prompts                                              |

---

## Tips

- Use `step-gated` mode (default) to review each sub-task
- Use `pre-approved autonomous batch` mode when you trust the agent to run autonomously
- Use `planner-resume` when a multi-story orchestration is interrupted
- Run `housekeeping` after major feature branches to catch regressions
- Domain instructions are auto-applied based on `applyTo` patterns

## memo-cli Integration (Optional)

When `memo-cli` is installed and configured, this workflow supports shared context across sessions, agents, and repositories.

- `product-engineer` reads context from memo at session start and before major design choices.
- `developer` writes an `intent` entry before story implementation and an `outcome` entry after completion.
- `technical-writer` writes one memo entry per ADR and per significant technical documentation change.

Recommended startup check:

```bash
which memo && memo setup validate
```

If `memo` is installed but validation fails, configure the repo first:

```bash
memo setup init --repo <repo-name> --org <org-name> --domain <domain>
```

Use `--scope related` for cross-repo context when `relates_to` is configured in `memo.config.json`.

### Formatting

Use the repo-local formatter wrapper for tracked Markdown, JSON, and YAML files:

```bash
./scripts/format.sh --check
./scripts/format.sh --write
```

The script uses `prettier` from your `PATH` when available and falls back to `npx --yes prettier` otherwise.

---

## Distribution & Script Reference

The toolkit is distributed as a versioned tarball via **GitHub Releases**. `dev-tasks.sh` is the single installer/updater — no runtime beyond standard POSIX tools (`curl`, `tar`, `shasum`) is required.

### Commands

| Command                            | Description                                              |
| ---------------------------------- | -------------------------------------------------------- |
| `./dev-tasks.sh install [version]` | Install latest or a pinned version                       |
| `./dev-tasks.sh update [version]`  | Update managed files to the latest or a specific version |
| `./dev-tasks.sh check`             | Compare installed version vs latest release              |
| `./dev-tasks.sh list`              | List installed directories, files, and metadata          |
| `./dev-tasks.sh version`           | Print installed version and script version               |

### Options (install / update)

| Option             | Description                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `--profile <name>` | Install/update file sets: `copilot` \| `claude` \| `kiro` \| `both` \| `all` (default: `both`, meaning Copilot + Claude only) |
| `--dry-run`        | Print planned changes without writing any files                                          |
| `--backup`         | Copy managed files to `.dev-tasks-backup/<timestamp>/` before replacing                  |
| `--yes`            | Skip confirmation prompts (useful in CI)                                                 |

> **Kiro guard hook — enforcement gap disclosure:** `--profile kiro`/`all` installs `.kiro/hooks/git-guard.json` + `.kiro/hooks/scripts/git-guard.sh`, a best-effort port of `.claude/hooks/git-guard.sh` that blocks pushes/merges to `main` and non-Conventional-Commit messages. **This hook is not guaranteed to be equivalent to `.claude/hooks/git-guard.sh`.** A tracked upstream Kiro defect (kirodotdev/Kiro#7375) may prevent Kiro IDE's `PreToolUse` hook from seeing command text, in which case it cannot reliably block anything; when it can't see command context it fails loud (stderr warning) rather than silently allowing. Until this is verified fixed on a live Kiro install, treat PR review as the actual enforcement backstop for these rules on Kiro. See `.kiro/steering/git-guard-notice.md` for the full disclosure.

### Managed file surface

The script owns these paths and may overwrite them on update:

| Path                                     | Contents                        |
| ---------------------------------------- | ------------------------------- |
| `.github/agents/*.agent.md`              | Agent definitions               |
| `.github/skills/*/SKILL.md`              | Activity and operational skills |
| `.github/instructions/*.instructions.md` | Always-loaded instructions      |
| `.github/instructions/domain/`           | Domain-specific instructions    |
| `.github/prompts/*.prompt.md`            | Prompt entry points             |
| `.dev-tasks-version`                     | Installed version metadata      |

**Never touched by the script:** `AGENTS.md` — the script prints an integration prompt instead (see below).

### AGENTS.md integration prompt

After every install or update, the script prints a `=== AGENTS.md Integration ===` block showing the diff between the bundled reference `AGENTS.md` and your local copy. It also saves the reference to `.dev-tasks-agents-update.md`. The script **never** silently overwrites your `AGENTS.md` — you decide what to merge.

### Version pinning and rollback

```bash
# Pin to a specific version
./dev-tasks.sh install v0.1.3

# Update with backup so you can roll back manually
./dev-tasks.sh update --backup

# Roll back: restore from backup
cp -r .dev-tasks-backup/<timestamp>/. ./
```

### Version metadata file

`.dev-tasks-version` is written after every install/update:

```json
{
  "version": "1.2.0",
  "installed_at": "2026-04-20T12:00:00Z",
  "script_version": "1.0.0",
  "source": "https://github.com/llipe/dev-tasks"
}
```

### Release publishing (maintainers)

Every git tag matching `v*.*.*` triggers `.github/workflows/release-bundle.yml`, which:

1. Runs `scripts/build-bundle.sh` to package managed files into `dev-tasks-bundle-v<version>.tar.gz`
2. Generates a SHA256 checksum
3. Runs a smoke test against the bundle
4. Creates the GitHub Release and attaches the bundle + checksum as assets

#### How to create a new release

1. Ensure the release changes are merged into `main`.
2. Sync your local branch:

```bash
git checkout main
git pull origin main
```

3. Create and push a semantic version tag (`vMAJOR.MINOR.PATCH`):

```bash
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0
```

4. Wait for `.github/workflows/release-bundle.yml` to complete.
5. Verify the GitHub Release contains both assets:

- `dev-tasks-bundle-v1.3.0.tar.gz`
- `dev-tasks-bundle-v1.3.0.tar.gz.sha256`

Optional post-release validation:

```bash
./dev-tasks.sh install v1.3.0
```

#### Option: download assets directly from the Releases page

If you prefer manual installation, download the bundle and checksum from:

- https://github.com/llipe/dev-tasks/releases

Example for a specific version:

```bash
VERSION=v1.3.0
BASE_URL="https://github.com/llipe/dev-tasks/releases/download/${VERSION}"

curl -fL -o "dev-tasks-bundle-${VERSION}.tar.gz" \
  "${BASE_URL}/dev-tasks-bundle-${VERSION}.tar.gz"
curl -fL -o "dev-tasks-bundle-${VERSION}.tar.gz.sha256" \
  "${BASE_URL}/dev-tasks-bundle-${VERSION}.tar.gz.sha256"

# Verify checksum
shasum -a 256 -c "dev-tasks-bundle-${VERSION}.tar.gz.sha256"

# Extract
tar -xzf "dev-tasks-bundle-${VERSION}.tar.gz"
```

---

## Attribution

Original idea based on [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)
