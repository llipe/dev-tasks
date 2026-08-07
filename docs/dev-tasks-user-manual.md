# `dev-tasks` User Manual — How It Works

This document explains the `dev-tasks` CLI: the bootstrap and distribution binary shipped in the `@llipe.com/dev-tasks` npm package.

While `dt` handles runtime extraction and catalog operations, `dev-tasks` manages the lifecycle of agent toolkit files in consumer repositories — installing, updating, pinning, and reconciling them across platform profiles.

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
4. Computes SHA-256 hash per file
5. Reads the existing manifest (if any) and merges:
   - Preserves entries from profiles **not** being installed
   - Replaces entries for the profiles being installed
6. Writes the updated manifest to `.dev-tasks/manifest.json`

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

| Check           | Requirement                                          |
| --------------- | ---------------------------------------------------- |
| Node.js version | >= 20                                                |
| Git version     | >= 2.37                                              |
| Cache directory | `~/.dev-tasks/cache/` is writable                    |
| Version skew    | Installed version matches pinned version (if pinned) |

---

### `dev-tasks migrate`

Migrates from the legacy `dev-tasks.sh` shell-script installation to the npm package format.

```bash
dev-tasks migrate         # Run migration
dev-tasks migrate --json  # Machine-readable output
```

Detects legacy `.dev-tasks/skills/` layout, maps files to native platform paths, and writes a fresh manifest.

---

## Exit Codes

| Code | Constant                 | Meaning                                               |
| ---- | ------------------------ | ----------------------------------------------------- |
| 0    | `Success`                | Command completed successfully                        |
| 2    | `InvalidUsage`           | Invalid arguments or flags                            |
| 3    | `ReconciliationConflict` | Update detected conflicts (use `--force` to override) |
| 4    | `DependencyError`        | Doctor check failed                                   |

---

## File Layout

After installation, managed files live at their native platform paths:

```text
your-repo/
├── .dev-tasks/
│   ├── manifest.json    # Installation manifest (managed by dev-tasks)
│   └── version          # Pin file (optional, written by `dev-tasks pin`)
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
