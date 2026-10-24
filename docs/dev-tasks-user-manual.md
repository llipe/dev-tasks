# `dev-tasks` User Manual — How It Works

This document explains the `dev-tasks` CLI: the bootstrap and distribution binary shipped in the `@llipe.com/dev-tasks` npm package.

`dev-tasks` manages the lifecycle of agent toolkit files in consumer repositories — installing, updating, pinning, and reconciling them across platform profiles.

---

## Overview

```bash
dev-tasks install    # Install agent files into the target repository
dev-tasks update     # Reconcile installed files (respects pin)
dev-tasks status     # Show installed vs. pinned vs. latest versions
dev-tasks pin        # Pin to a specific version
dev-tasks unpin      # Remove the version pin
dev-tasks doctor     # Check environment prerequisites
dev-tasks migrate    # Migrate from legacy shell-script installation
```

All commands accept `--json` for machine-readable output.

---

## Concepts

### Platform Profiles

Agent toolkit files are organized by AI platform:

| Profile   | Directories Managed                                                               |
| --------- | --------------------------------------------------------------------------------- |
| `copilot` | `.github/agents/`, `.github/skills/`, `.github/instructions/`, `.github/prompts/` |
| `claude`  | `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/hooks/`       |
| `kiro`    | `.kiro/agents/`, `.kiro/skills/`, `.kiro/steering/`, `.kiro/hooks/`               |
| `both`    | `copilot` + `claude`                                                              |
| `all`     | `copilot` + `claude` + `kiro` (default)                                           |

### Root Files

Some managed files belong to no platform. They are installed at the repository root on **every** profile, exactly once per run regardless of how many platforms the profile resolves to, and recorded in the manifest under the `root` profile tag rather than a platform tag.

| File         | Purpose                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `TESTING.md` | Canonical testing contract, shipped unfilled; consumer-owned once filled |

`TESTING.md` is listed in `consumer_owned_paths`, so `dev-tasks update` never overwrites a version you have filled in.

### Install-If-Absent Files

Some managed files must survive customization more strictly than a `consumer_owned_paths` entry provides: `dev-tasks update` never overwrites a `consumer_owned_paths` file, but a plain re-run of `dev-tasks install` still would, since `install` writes root files and managed-directory files unconditionally. Install-if-absent files are written only when the target path does not already exist — by either `install` or `update` — and, once present, are never touched again by either command.

| File                                 | Purpose                                                                                                                                          | Delivered under                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `.claude/settings.json`              | Wires the shipped Claude hook scripts (`.claude/hooks/*.sh`) into Claude Code's `PreToolUse` lifecycle; carries your `permissions.allow` entries | `--profile claude` / `both` / `all` |
| `CLAUDE.md`                          | Project memory for Claude Code; root-level context loaded on first use. Consumer-owned once filled in.                                           | `--profile claude` / `both` / `all` |
| `AGENTS.md`                          | Canonical registry of agents, skills, and instructions; loaded by all platforms as a shared reference. Consumer-owned once customized.           | `--profile claude` / `both` / `all` |
| `docs/runbooks/README.md`            | Index of operational procedures; lists all runbooks and their metadata (trigger, owner, verification, rollback steps).                           | Every profile (platform-agnostic)   |
| `docs/runbooks/runbook-template.md`  | Template for authoring new runbooks with the required five-heading structure (preconditions, steps, verification, rollback, escalation).         | Every profile (platform-agnostic)   |
| `docs/domain/ubiquitous-language.md` | Canonical domain vocabulary by bounded context, shipped unfilled; yours to fill and never overwritten                                            | Every profile (platform-agnostic)   |

Unlike root files and managed-directory files, install-if-absent files are **not** recorded in `.dev-tasks/manifest.json` — see [ADR-006](adr/ADR-006-claude-settings-ownership.md) for the rationale. `dev-tasks doctor` separately checks that every installed `.claude/hooks/*.sh` script is wired into `.claude/settings.json` and warns by script name if not.

### Manifest

Every installation writes `.dev-tasks/manifest.json` — the source of truth for what's installed:

```json
{
  "version": "0.7.0",
  "pinned": "0.7.0",
  "installed_at": "2026-08-07T10:00:00.000Z",
  "files": [
    {
      "path": ".github/agents/developer.agent.md",
      "profile": "copilot",
      "sha256": "abc123...",
      "origin_sha256": "abc123..."
    }
  ],
  "extraction": {}
}
```

Key fields per file entry:

- `sha256` — current hash of the file as installed
- `origin_sha256` — hash as originally shipped (used for conflict detection during updates)
- `profile` — which platform this file belongs to

### Manifest Merging

Installing a single profile does **not** erase entries from other profiles. For example:

```bash
dev-tasks install --profile copilot   # Installs copilot files
dev-tasks install --profile kiro      # Adds kiro files; copilot entries preserved
```

When you install a profile, only entries for that profile are replaced in the manifest. Entries from other profiles remain untouched.

### Version Pinning

A pin locks the project to a specific version of the toolkit. The pin is stored in `.dev-tasks/version` (a plain text file containing the version string).

When pinned:

- `dev-tasks update` fetches the pinned version from the npm registry and reconciles against it — even if the locally installed package is newer
- `dev-tasks status` compares the installed version against the pin (not against the latest)

When unpinned:

- `dev-tasks update` reconciles against the locally installed package version
- `dev-tasks status` compares against the latest available version

---

## Commands

### `dev-tasks install`

Copies agent toolkit files from the package source into the target repository and writes/updates the manifest.

```bash
dev-tasks install                          # Install all platforms (default)
dev-tasks install --profile copilot        # Only .github/ files
dev-tasks install --profile claude         # Only .claude/ files
dev-tasks install --profile kiro           # Only .kiro/ files
dev-tasks install --profile both           # .github/ + .claude/
dev-tasks install --profile all            # All three platforms
dev-tasks install --pin 0.5.0             # Install and pin to 0.5.0
dev-tasks install --json                   # Machine-readable output
```

#### What it does

1. Resolves the profile to a list of platforms
2. For each platform, collects all files from the package's managed directories
3. Copies each file to the target repo at its native path
4. Copies root files (see [Root Files](#root-files)) once per run, regardless of profile
5. Delivers install-if-absent files (see [Install-If-Absent Files](#install-if-absent-files)) for each platform being installed, skipping any that already exist
6. Computes SHA-256 hash per file
7. Reads the existing manifest (if any) and merges:
   - Preserves entries from profiles **not** being installed
   - Replaces entries for the profiles being installed, plus the `root` tag
8. Writes the updated manifest to `.dev-tasks/manifest.json`

#### Flags

| Flag            | Description                                     |
| --------------- | ----------------------------------------------- |
| `--profile <p>` | Platform profile to install (default: `all`)    |
| `--pin <ver>`   | Also write this version to `.dev-tasks/version` |
| `--json`        | Output JSON result                              |

---

### `dev-tasks update`

Reconciles installed files against the package source using three-way hash comparison. Respects the version pin — if pinned to a different version than the local package, fetches the pinned version from npm.

```bash
dev-tasks update              # Reconcile against pinned or local version
dev-tasks update --force      # Backup conflicts and overwrite
dev-tasks update --json       # Machine-readable output
```

#### How reconciliation works

For each file in the manifest, three hashes are compared:

| Hash          | Source                        | Meaning                               |
| ------------- | ----------------------------- | ------------------------------------- |
| `localHash`   | File on disk in consumer repo | What's currently there                |
| `originHash`  | `origin_sha256` in manifest   | What was there at last install/update |
| `packageHash` | File in the package source    | What the target version ships         |

Decision tree:

| Condition                                                | Action        | Meaning                                               |
| -------------------------------------------------------- | ------------- | ----------------------------------------------------- |
| `localHash` is null                                      | **install**   | File was deleted locally — re-copy from package       |
| `localHash == packageHash`                               | **skip**      | Already up to date                                    |
| `localHash == originHash` AND `packageHash` differs      | **overwrite** | User hasn't edited; safe to update                    |
| `localHash != originHash` AND `localHash != packageHash` | **conflict**  | User edited AND package changed — cannot auto-resolve |

#### Pin-aware fetching

When a pin is set (`.dev-tasks/version` exists) and the pinned version differs from the locally installed package version:

1. `update` downloads the pinned version's tarball from npm (`npm pack @llipe.com/dev-tasks@<pin>`)
2. Extracts it to a temporary directory
3. Reconciles files against the fetched package source
4. Cleans up the temporary directory

This means you can **downgrade** to a previous version:

```bash
dev-tasks pin 0.5.0    # Lock to an older version
dev-tasks update       # Fetches 0.5.0 from npm, reconciles files to match
```

Or **upgrade to a specific version** without changing your global install:

```bash
dev-tasks pin 0.8.0    # Lock to a newer version
dev-tasks update       # Fetches 0.8.0 from npm, reconciles
```

When no pin is set (or pin matches the local package version), `update` reconciles against the local package — no network access required.

#### Conflict resolution

When conflicts are detected (user edited a file AND the package changed it):

- **Without `--force`:** reports conflicts and exits with a non-zero code. No files are modified.
- **With `--force`:** creates a timestamped backup directory, copies conflicting files there, then overwrites with the package version.

#### Flags

| Flag      | Description                                                         |
| --------- | ------------------------------------------------------------------- |
| `--force` | Backup conflicting files and overwrite                              |
| `--json`  | Output JSON result including `resolvedVersion` and `fetched` fields |

#### JSON output includes

```json
{
  "command": "update",
  "resolvedVersion": "0.5.0",
  "fetched": true,
  "updated": [...],
  "installed": [...],
  "conflicts": [...],
  "skipped": [...],
  "backupDir": "/path/to/backup"
}
```

---

### `dev-tasks status`

Reports the current installation state: installed version, pinned version, latest available version, and whether the installation is up to date.

```bash
dev-tasks status         # Human-readable output
dev-tasks status --json  # Machine-readable output
```

#### Up-to-date logic

- If pinned: `upToDate = (installed == pinned)`
- If not pinned: `upToDate = (installed == latest)`

---

### `dev-tasks pin`

Sets the version pin. Subsequent `update` calls will fetch and reconcile against this version.

```bash
dev-tasks pin 0.5.0         # Pin to version 0.5.0
dev-tasks pin 0.5.0 --json  # Machine-readable output
```

Writes the version string to `.dev-tasks/version`.

#### Typical workflow: downgrade

```bash
dev-tasks pin 0.5.0    # Set the target version
dev-tasks update       # Fetches 0.5.0 from registry, reconciles all files
```

#### Typical workflow: controlled upgrade

```bash
dev-tasks pin 0.8.0    # Set the target version
dev-tasks update       # Fetches 0.8.0 from registry, reconciles all files
```

---

### `dev-tasks unpin`

Removes the version pin. After unpinning, `update` reconciles against the locally installed package version (no network fetch).

```bash
dev-tasks unpin         # Remove the pin
dev-tasks unpin --json  # Machine-readable output
```

Deletes `.dev-tasks/version`. If no pin exists, reports "No version pin found" and exits successfully.

---

### `dev-tasks doctor`

Checks environment prerequisites and reports pass/fail for each:

```bash
dev-tasks doctor         # Human-readable output
dev-tasks doctor --json  # Machine-readable output
```

#### Checks performed

| Check                     | Requirement                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js version           | >= 24                                                                                                                                                                                         |
| Git version               | >= 2.37                                                                                                                                                                                       |
| Cache directory           | `~/.dev-tasks/cache/` is writable                                                                                                                                                             |
| Version skew              | Installed version matches pinned version (if pinned)                                                                                                                                          |
| Claude hooks wiring       | Every `.claude/hooks/*.sh` script is referenced by a `PreToolUse` entry in `.claude/settings.json` (warns by script name otherwise; silent when there are no hooks or all are wired)          |
| Foundation document names | `docs/product.md` and `docs/tech.md` exist; warns when a repository installed before the rename still carries the pre-rename filenames instead, and suggests running `dev-tasks migrate docs` |
| Package map               | `docs/tech.md` package map matches the workspace (warns of drift when a package exists on disk with no row, or a row with no package found; never fails)                                      |
| Glossary presence         | `docs/domain/ubiquitous-language.md` exists (warns and proposes `dev-tasks update` when absent; never fails, and never reports on its contents)                                               |

---

### `dev-tasks migrate`

Migrates from the legacy `dev-tasks.sh` shell-script installation to the npm package format.

```bash
dev-tasks migrate         # Run migration
dev-tasks migrate --json  # Machine-readable output
```

Detects legacy `.dev-tasks/skills/` layout, maps files to native platform paths, and writes a fresh manifest.

#### `dev-tasks migrate projects --plan`

Reads the repository through `gh` and writes a reviewable projects-tracking migration plan. Read-only: nothing on GitHub changes.

```bash
dev-tasks migrate projects --plan [--repo <owner/repo>] [--out <path>] [--json]
```

- `--out` defaults to `workstream/migration-projects.md`. `--repo` defaults to the working tree's repository (`gh repo view`); a different value exits `2`, because the roadmap and planner state files are read from the working tree.
- `gh auth status --hostname github.com` runs first; when it fails, or `gh` is not installed, the command exits `11` with the `gh auth login` hint and reads nothing else.
- The plan file starts with `Format: 1`, `Generated:`, `Snapshot:` (SHA-256 of what was read), `Plan digest:` and `Approved: no`, then the review tables (unmapped issues, needs a type, needs a blocking link, state files, roadmap notes, information) and one table per batch. It holds issue numbers, titles and label names only, never issue bodies.
- `docs/roadmap.md` must hold the canonical table (`PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing`); without it the command exits `2` before reading any issue and points to product-engineer's roadmap conversion.
- Mapping (FR-18): a story maps to a wave by its `**Story:**` body line (the PRD by the roadmap's PRD link text, the wave by `-phase-<N>`, or the `All` row for a file without it), then by a `phase:` label matched exactly within the PRD named in its `[PRD-<name>]` title prefix. A rule maps only when it yields exactly one row. The milestone is not a rule. Anything else is listed under unmapped issues with the reason.
- Batches, in order, each row with an ID, Action, Target, Detail, `Depends on` and State: `1` labels (missing `level:` and `type:` labels created, type and `priority:` descriptions set, retired descriptions prefixed `Retired (D-91): `), `2` tracking issues (reused, or created with the exact title shown; none for a `Done` wave), `3` hierarchy links (never a relink), `4` `level:` and answered `type:` labels, `4b` blocking-link and priority answers, `5` retired labels removed from open issues, `6` the PRD status comment (created, or missing rows added), and `7` the Project cleanup steps you run yourself. A row already in effect is not proposed, so re-planning after an apply proposes no writes.
- Answers: fill the Answer columns (a wave id such as `alpha 2`, or `standalone`; a type; `#<issue it blocks>` or `lower priority to high`; `yes` on an Information question) and run `--plan` again. It reads the previous file's answers, rebuilds the batches and resets `Approved: no`; an invalid answer stays listed with the reason.
- It refuses with exit `14` to overwrite the file at `--out` when that file is a plan with any row that is not `pending`, or is not a migration plan at all; choose another `--out`.

#### `dev-tasks migrate projects --apply`

Runs an approved migration plan and records every write's result in the plan file, so a re-run resumes.

```bash
dev-tasks migrate projects --apply [--plan-file <path>] [--json]
```

- `--plan-file` defaults to `workstream/migration-projects.md`; the states are written back to that file only, after every call, through a temporary file and a rename.
- Gates, in this order, each writing nothing: a missing or unparsable plan file, or a row whose Detail does not match its Action, exits `2`; `gh` missing or unauthenticated exits `11`; then exit `14` when the header is not exactly one `Approved: yes` line, when `Plan digest:` no longer matches the rows (a row edited after the plan was generated), when another run holds `workstream/.migration-projects.lock`, or, while every row is still `pending`, when the repository changed since the plan was generated ("regenerate the plan").
- Batches `1` to `6` run in order. Each row's State becomes `done` (`done(#N)` for a created issue), `failed(<first line of gh's error>)`, `skipped(already applied)` when its target is already in the desired state, or `skipped(depends on W-NNN)` when a row it depends on did not apply. A failed row does not stop rows that do not depend on it.
- A re-run executes `pending`, `failed` and `skipped(depends on …)` rows, never a `done` or `skipped(already applied)` one. Once any row is recorded, the snapshot hash is no longer compared; each write instead checks its own target just before it runs and records `failed(target changed)` when the target is in neither the state the plan expected nor the desired one. A created tracking issue whose state was lost is found again by its exact title, never created twice.
- Every write is built from the row's Action, Target and Detail only, each value as `--flag=value` and a label name after `--`. Issue and comment bodies go through `--body-file` (an edit through `--field=body=@<file>`) in a temporary directory, removed after each call. The PRD status comment is found by its marker: created when absent, otherwise edited in place by id with only the missing rows added.
- It never runs batch 7, never makes a Project call, never deletes a label, issue or comment, and never writes a title or a Status. The summary prints batch 7's steps for you to run with your own session; tick each by setting its State to `done`.
- Answers in the review tables never become writes here: run `--plan` again to turn them into rows, then approve the rebuilt plan. The summary counts the items still waiting for an answer.
- It exits `0` when every write applied, and `1` when any write is `failed` or the run was interrupted (the states so far are kept). `--json` prints `{ command, mode: "apply", repo, planFile, batches: [{ name, pending, done, failed, skipped }], review, exitCode }`.

---

## Exit Codes

Every code comes from [`core/exit-codes.ts`](../core/exit-codes.ts); no command adds its own.

| Code | Constant                 | Meaning                                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `Success`                | Command completed successfully                                                                                                                                                                                                                                                                                                      |
| 1    | `GeneralError`           | Unexpected error, a failed rename in `migrate docs`, a failed `gh` read in `migrate projects`, or a `failed` write or an interrupted run in `migrate projects --apply`                                                                                                                                                              |
| 2    | `InvalidUsage`           | Invalid arguments or flags: an unknown flag, a value flag with no value, an unknown command, a `--repo` that is not the working tree's repository, or no canonical `docs/roadmap.md` table (`migrate projects`)                                                                                                                     |
| 11   | `DependencyError`        | A `doctor` check failed, or `gh` is missing or unauthenticated (`migrate projects`)                                                                                                                                                                                                                                                 |
| 14   | `ReconciliationConflict` | `update` found conflicting edits (use `--force`), `migrate docs` skipped a rename, `migrate projects --plan` refused to overwrite the file at `--out` (an applied plan, or not a plan), or `migrate projects --apply` refused a plan that is not approved, was edited after it was generated, is locked by another run, or is stale |

---

## File Layout

After installation, managed files live at their native platform paths:

```text
your-repo/
├── .dev-tasks/
│   ├── manifest.json    # Installation manifest (managed by dev-tasks)
│   └── version          # Pin file (optional, written by `dev-tasks pin`)
├── TESTING.md           # Root file — testing contract (consumer-owned once filled)
├── .github/             # Copilot platform files
│   ├── agents/
│   ├── skills/
│   ├── instructions/
│   └── prompts/
├── .claude/             # Claude Code platform files
│   ├── agents/
│   ├── skills/
│   ├── commands/
│   └── hooks/
└── .kiro/               # Kiro platform files
    ├── agents/
    ├── skills/
    ├── steering/
    └── hooks/
```

---

## Common Workflows

### Fresh install (all platforms)

```bash
pnpm add -g @llipe.com/dev-tasks
cd your-project
dev-tasks install
```

### Add a platform later

```bash
dev-tasks install --profile kiro   # Adds kiro without touching copilot/claude
```

### Pin and downgrade

```bash
dev-tasks pin 0.5.0
dev-tasks update        # Fetches 0.5.0, reconciles files to that version
```

### Upgrade to latest

```bash
dev-tasks unpin                              # Remove any existing pin
pnpm add -g @llipe.com/dev-tasks@latest      # Get the latest package
dev-tasks update                             # Reconcile against new version
```

### Controlled upgrade (without changing global install)

```bash
dev-tasks pin 0.8.0
dev-tasks update        # Fetches 0.8.0 from registry, reconciles
```

### Check status

```bash
dev-tasks status        # Shows installed, pinned, latest, and up-to-date state
```

### Resolve conflicts after update

```bash
dev-tasks update                    # Reports conflicts
# Review the conflicting files manually, or:
dev-tasks update --force            # Backup + overwrite all conflicts
```
