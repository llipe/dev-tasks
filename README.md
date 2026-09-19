# dev-tasks

A set of agents, skills, and instructions for GitHub Copilot, Claude Code, Kiro, and other AI coding agents to run structured, PRD-driven development workflows. Inspired by [snarktank/ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks).

---

## Getting Started

### 1. Install the package

Use npm to install the [dev-tasks package](https://www.npmjs.com/package/@llipe.com/dev-tasks/).

```bash
pnpm add -g @llipe.com/dev-tasks
```

This gives you one binary:

| Binary      | Stability  | Purpose                                                 |
| ----------- | ---------- | -------------------------------------------------------- |
| `dev-tasks` | **Stable** | Bootstrap: install agent files, update, status, migrate |

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

**What each profile delivers, beyond the platform-specific agent/skill/command directories:**

| Profile        | Root context files delivered                                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `copilot`      | `DESIGN.md`, `TESTING.md` (install-if-absent for consumer-owned files not covered here — see below)                                                                                                                                                            |
| `claude`       | `DESIGN.md`, `TESTING.md`, plus `CLAUDE.md` and `AGENTS.md` — project memory Claude Code loads on every turn, and the shared agent/skill registry it imports. Delivered install-if-absent: written on a fresh install, never overwritten once you fill them in |
| `kiro`         | `DESIGN.md`, `TESTING.md` — Kiro's equivalent standing guidance ships as always-on steering (`.kiro/steering/git-guard-notice.md`) rather than a root file                                                                                                     |
| `both` / `all` | Union of the profiles above                                                                                                                                                                                                                                    |

`DESIGN.md` and `TESTING.md` install unconditionally on every run (they are canonical contract documents, not consumer-authored memory). `CLAUDE.md`, `AGENTS.md`, and `.claude/settings.json` use install-if-absent semantics instead: delivered once, then fully consumer-owned, so `install` and `update` never clobber content you've customized.

### 3. Configure branch protection (required, not optional)

The `git-guard`/`branch-guard` hooks (Claude Code) and their Kiro equivalents are **advisory, best-effort, local checks** — defense-in-depth, not the actual gate. They are text/JSON pattern matching over a tool call and can always be evaded by a sufficiently creative command or tool-input shape; Copilot has no hook system at all. The only control that is server-side and unbypassable by any tool surface (`gh` CLI, raw `git`, or an MCP server) is a **GitHub branch protection rule** on the repository's default branch. Configure it before relying on any agent to work in this repository:

- Require a pull request before merging
- Require at least 1 approving review
- Require status checks to pass before merging
- Disable force-pushes to the default branch
- Disable branch deletion for the default branch

```bash
gh api repos/<owner>/<repo>/branches/<default-branch>/protection \
  --method PUT \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -F required_status_checks='{"strict":true,"contexts":[]}' \
  -F enforce_admins=true \
  -F restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

Or configure it via **Settings → Branches → Branch protection rules** in the GitHub UI. Run this once per repository, immediately after installing dev-tasks.

### 4. Initialize your project context

Invoke the `product-engineer` agent in Init Mode (via `@product-engineer` or the `product-engineer-init` prompt). This creates:

- `docs/product-context.md` — what your product is and who it's for
- `docs/technical-guidelines.md` — stack, conventions, and constraints

Run this once per project.

### 5. Build a feature

```text
a) Invoke @product-engineer with a feature description or GitHub issue number
   → creates PRD → spec → stories → task list

b) Invoke @developer with the task list path
   → implements, tests, and opens a PR
```

### 6. Keep files up to date

```bash
dev-tasks update            # reconcile with hash-based conflict detection
dev-tasks update --force    # accept all upstream changes
dev-tasks status            # compare installed vs latest version
```

---

## `dev-tasks` CLI Reference

- **CLI documentation:** [`docs/dev-tasks-user-manual.md`](docs/dev-tasks-user-manual.md) — install, update, pin/unpin, profiles, manifest merging, reconciliation
- **Architecture and artifacts:** [`docs/system-overview.md`](docs/system-overview.md)
- **Everything else:** [`docs/README.md`](docs/README.md)

### Global options

| Flag     | Description                  |
| -------- | ----------------------------- |
| `--json` | Machine-readable JSON output |
| `-v`     | Verbose diagnostics (stderr) |

### Exit codes

| Code | Meaning                                   |
| ---- | ------------------------------------------ |
| 0    | Success                                    |
| 1    | Unexpected error                           |
| 2    | Incorrect usage                            |
| 11   | Dependency check failed (`doctor`)         |
| 14   | Reconciliation conflict (edited fields)    |

Full contract, including retirement history for codes no longer in use: [`core/exit-codes.ts`](core/exit-codes.ts).

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

> **Available for:** Copilot (`.github/agents/`), Claude Code (`.claude/agents/`), Kiro (`.kiro/agents/`). Copilot and Kiro define all 11 agents below. On Claude Code, the two orchestrators (`planner`, `product-engineer`) and `infra-engineer` run in the main thread as `/commands` so they can pause for approval gates (per-phase for the orchestrators, per-step for `infra-engineer`); the other 8 are subagents.

### `product-engineer`

Preparation agent — owns the full pre-coding chain:

- **Init Mode**: `activity-init` → product-context.md + technical-guidelines.md
- **Feature Mode**: `activity-refine` → `activity-generate-spec` → `activity-generate-stories` → `activity-publish-github` → `plan`
- **Issue Mode**: `activity-refine` → `plan`

Also owns drift reconciliation via `activity-drift-reconciliation`.

### `developer`

Execution agent — implements code from an existing task list. Runs `implement`, including a `qa-engineer` coverage gate and a mandatory `verifier` audit before every PR is marked ready. Uses `git-ops` for branch management.

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

| Agent              | Purpose                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `ux-engineer`      | PRD/SPEC-to-screen visualization (lite/full), DESIGN.md ownership, gap analysis                 |
| `technical-writer` | Documentation maintenance                                                                       |
| `housekeeping`     | Lint, type, and test-wiring fixes                                                               |
| `github-ops`       | GitHub consistency — issues, PRs, branches, labels                                              |
| `verifier`         | Compliance test-plan design and fidelity auditing                                               |
| `qa-engineer`      | Testing standard, missing test harnesses, coverage and gap reporting                            |
| `researcher`       | Bounded codebase investigation producing structured research artifacts                          |
| `infra-engineer`   | Approval-gated, reversible, recorded infrastructure changes (AWS, fly.io, Supabase, Cloudflare) |

---

## Skills

On-demand capabilities loaded only when invoked.

| Skill                            | Purpose                                                                                                                  | Consumer                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `activity-init`                  | Product context and technical guidelines                                                                                 | `product-engineer`                                  |
| `activity-refine`                | Issue refinement or PRD creation                                                                                         | `product-engineer`                                  |
| `activity-generate-spec`         | PRD → technical specification                                                                                            | `product-engineer`                                  |
| `activity-generate-stories`      | Spec → user stories with coverage validation                                                                             | `product-engineer`                                  |
| `activity-publish-github`        | Stories → GitHub Issues                                                                                                  | `product-engineer`                                  |
| `activity-drift-reconciliation`  | Routes verifier drift findings into remediation                                                                          | `product-engineer`                                  |
| `git-ops`                        | Branch, rebase, merge, conflict resolution                                                                               | `developer`, `planner`                              |
| `aws-ops`                        | AWS CLI command sets, tiers, cost, backup/revert, logs                                                                   | `infra-engineer`                                    |
| `fly-ops`                        | flyctl command sets, tiers, cost, backup/revert, logs                                                                    | `infra-engineer`                                    |
| `supabase-ops`                   | Supabase CLI sets, `db diff` flow, drift rule, logs                                                                      | `infra-engineer`                                    |
| `deploy-ops`                     | Deploy script contract, env mapping, tag policy, and workflow scaffolding (`templates/scripts/`, `templates/workflows/`) | `infra-engineer`                                    |
| `ux-scaffold`                    | Template-aware mockup generation (lite/full)                                                                             | `ux-engineer`                                       |
| `ux-theme-gen`                   | DESIGN.md → theme artifacts (CSS vars, Tailwind v4, RN)                                                                  | `ux-engineer`, `developer`                          |
| `activity-e2e-test-design`       | E2E black-box test scenario generation                                                                                   | `verifier`                                          |
| `activity-contract-test-design`  | Consumer/provider contract testing                                                                                       | `verifier`                                          |
| `activity-edge-case-refinement`  | Systematic edge-case discovery                                                                                           | `verifier`                                          |
| `activity-random-test-tactics`   | Randomized, fuzz, and property-inspired tests                                                                            | `verifier`                                          |
| `activity-test-standards`        | Establish and maintain `/TESTING.md`                                                                                     | `qa-engineer`                                       |
| `activity-test-implementation`   | Author Layer 1-2 tests with enforced boundaries                                                                          | `qa-engineer`                                       |
| `activity-coverage-gap-analysis` | Coverage measurement and risk-ranked gaps                                                                                | `qa-engineer`                                       |
| `memo-cli-usage`                 | Shared architectural memory across sessions                                                                              | `product-engineer`, `developer`, `technical-writer` |

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

Kiro (`.kiro/hooks/`) and Claude Code (`.claude/hooks/`, wired via `.claude/settings.json`) both ship two deterministic `PreToolUse` hooks; Copilot has no hook system. `git-guard` matches shell (`Bash`/terminal) commands and blocks pushes and merges into the default branch (resolved dynamically — `master`/`trunk` repos are protected identically to `main`), including `gh pr merge` with its base resolved via `gh pr view` (not a `--base` text check, which doesn't exist on that subcommand), `gh pr merge --admin` (blocked outright), `gh pr merge --auto` when the resolved base is the default branch, and the raw-git escape of merging a story/issue branch straight into an integration branch, plus non-Conventional commit messages, inline `gh --body`, and human-only tags. `branch-guard` matches file-write tools (`Edit`/`Write`/`NotebookEdit` on Claude Code) and blocks write operations while on the default branch. Both hooks fail open on unexpected errors — except `git-guard`'s PR-base lookup, which fails **closed** (blocks the merge) if `gh pr view` can't verify the base, since an unverified base could be the default branch. Human PR review is the actual gate.

---

## Prompts

> Copilot: `.github/prompts/*.prompt.md`. Claude Code: `.claude/commands/*.md`. Kiro: embedded in `.kiro/agents/*.md`.

| Prompt                     | Agent            | Purpose                               |
| -------------------------- | ---------------- | ------------------------------------- |
| `product-engineer-init`    | product-engineer | Initialize foundation documents       |
| `product-engineer-feature` | product-engineer | Design and plan a feature             |
| `product-engineer-issue`   | product-engineer | Refine and plan a GitHub Issue        |
| `developer-execute`        | developer        | Execute an existing task list         |
| `planner`                  | planner          | Orchestrate multi-story execution     |
| `planner-resume`           | planner          | Resume from checkpoint                |
| `ux-engineer`              | ux-engineer      | Generate UX mockups                   |
| `github-ops`               | github-ops       | GitHub consistency                    |
| `technical-writer`         | technical-writer | Documentation maintenance             |
| `housekeeping`             | housekeeping     | Lint, type, test fixes                |
| `qa-engineer`              | qa-engineer      | Testing standard and coverage gate    |
| `infra-engineer`           | infra-engineer   | Plan and apply infrastructure changes |
| `verifier-design`          | verifier         | Generate compliance test plan         |
| `verifier-audit`           | verifier         | Grey-box fidelity audit               |

---

## Workflow Chains

Match your situation to a chain, then invoke the first agent in it. Full diagrams, including the UX validation loop and project initialization, are in [`docs/workflow-chains.md`](docs/workflow-chains.md).

| Situation                   | Chain                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Full feature, PRD-driven    | `product-engineer` (refine → spec → stories → publish → plan) → `developer`                                                   |
| Single GitHub Issue         | `product-engineer` (refine → plan) → `developer`                                                                              |
| Several dependent stories   | `product-engineer` (… → plan) → `planner` → `developer` per story, sequential                                                 |
| Quick fix, task list exists | `developer`                                                                                                                   |
| Test-first design           | … → plan → `verifier` (design) → `developer` → `qa-engineer` → `verifier` (audit) → `product-engineer` (drift reconciliation) |
| UX validation before build  | `product-engineer` (refine → spec) → `ux-engineer` (lite) → `product-engineer` (stories) → `developer`                        |
| Quick screen sketches       | `ux-engineer` (lite mode, direct invocation with PRD/spec path)                                                               |
| New project                 | `product-engineer` (init mode)                                                                                                |

The `verifier` audit after implementation is mandatory and non-skippable before a PR is marked ready.

---

## File Organization

| Directory             | Contents                                                                |
| --------------------- | ----------------------------------------------------------------------- |
| `/docs/`              | Documentation — see [`docs/README.md`](docs/README.md) for the index    |
| `/docs/adr/`          | Architecture decision records                                           |
| `/docs/requirements/` | PRDs produced by the refine skill                                       |
| `/workstream/`        | Active feature work — specs, stories, task lists, fidelity reports      |
| `bin/`                | CLI entrypoint (`dev-tasks.ts`) and its argument parser                |
| `core/`               | Business logic — `distribution` (install/update/status/pin/doctor)     |
| `scripts/`            | Bundle build, release, and formatting scripts                           |
| `templates/`          | Claude settings, infra scaffold, deploy scripts, and CI workflows       |
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

- **Route 2 (boot + introspect) supports Express and Express 5 only** — Fastify, Hono, and NestJS support is planned but not yet implemented.
- **Observed DB rung requires PostgreSQL** — the `information_schema` reader works with `pg` only; MySQL/SQLite support is deferred.
- **Only Node/TS provider** — other language stacks require additional extraction providers.
- **Zod extraction handles basic `z.object` patterns only** — complex compositions are not fully supported.
- **Only kafkajs patterns supported** — other messaging clients are not detected; kafkajs inference is now low-confidence.
- **Monorepo detection is pnpm/npm workspaces only** — custom workspace layouts require manual configuration.

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

- Node.js >= 24
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
