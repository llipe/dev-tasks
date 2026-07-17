# Story: Distribute the agent toolkit as a versioned GitHub bundle

## Summary
Provide a single downloadable script (`dev-tasks.sh`) that a consumer repository can `curl` from the dev-tasks repo, run locally, and use to install, update, check versions, and integrate the full agent toolkit — without requiring manual file management or build tooling.

## User Story
As a maintainer of multiple parallel projects,
I want to download a single script from the dev-tasks repository that handles install, update, and version management of the agent toolkit,
so that I can roll out and maintain a consistent set of agents, skills, instructions, and prompts across repositories with minimal effort and no drift.

## Problem
The current repository works well as the source of truth, but distribution is still implicit. There is no formal release artifact, manifest, or supported installer/update path. Each consuming project must invent its own sync mechanism, which creates version drift, inconsistent layouts, and higher maintenance cost.

## Goals
- **Single entry point:** One script file (`dev-tasks.sh`) that lives in the dev-tasks repo and can be downloaded via `curl`/`wget` into any consumer repo.
- **Self-contained commands:** The script handles `install`, `update`, `check`, and `version` — no separate build step required by the consumer.
- **Version-aware:** Supports pinned versions and `latest` resolution; can detect when a newer version is available.
- **Safe updates:** Downloads and replaces managed files, detects local modifications before overwriting, supports dry-run and backup.
- **AGENTS.md integration prompt:** On install or update, the script outputs a ready-to-use prompt (or diff) showing how to update the consumer repo's `AGENTS.md` to include the new toolkit contents — it does NOT silently overwrite `AGENTS.md`.
- **Robust error handling:** Graceful failures for network errors, missing dependencies, permission issues, and dirty state.
- **Deterministic and auditable:** Records installed version metadata so updates are traceable and reversible.

## Proposed Strategy

### 1. Single Script as Entry Point
The script (`dev-tasks.sh`) is committed to the dev-tasks repo root. Consumers bootstrap with:
```bash
curl -sL https://raw.githubusercontent.com/llipe/dev-tasks/main/dev-tasks.sh -o dev-tasks.sh
chmod +x dev-tasks.sh
```
After that, all operations go through `./dev-tasks.sh <command>`.

### 2. Commands

| Command | Description |
|---------|-------------|
| `./dev-tasks.sh install [version]` | Download and install the toolkit (specific version or latest). Creates managed directories and writes version metadata. |
| `./dev-tasks.sh update [version]` | Check for updates, download the new version, replace managed files, and output the AGENTS.md integration prompt. |
| `./dev-tasks.sh check` | Compare installed version vs latest available; print upgrade path if available. |
| `./dev-tasks.sh version` | Print the currently installed version and script version. |

### 3. Bundle Contract — Managed File Surface
The script manages these paths in the consumer repo:

| Path | Content |
|------|---------|
| `.github/agents/*.agent.md` | Agent definitions (8 agents) |
| `.github/skills/*/SKILL.md` | Activity and operational skills (12 skills) |
| `.github/instructions/*.instructions.md` | Always-loaded instructions |
| `.github/instructions/domain/` | Domain-specific instructions |
| `.github/prompts/*.prompt.md` | Prompt entry points |
| `.agents/skills/*/SKILL.md` | Third-party skills (Vercel, etc.) |
| `skills-lock.json` | Skill dependency lock |
| `.dev-tasks-version` | Installed version metadata (written by script) |

**NOT managed (never overwritten):**
- `AGENTS.md` — the consumer owns this; the script provides an integration prompt instead.
- Any consumer-specific files outside the managed paths.

### 4. Release Artifacts
- A GitHub Actions workflow packages the managed files into a tarball (`dev-tasks-bundle-vX.Y.Z.tar.gz`) with a SHA256 checksum on every tagged release.
- The script downloads the tarball from GitHub Releases (not raw repo files) for install/update.

### 5. AGENTS.md Integration Prompt
After install or update, the script:
1. Reads the bundled `AGENTS.md` (the canonical reference).
2. Generates a diff or ready-to-paste snippet showing new/changed agents, skills, instructions, and prompts.
3. Prints the snippet to stdout with clear instructions like:
   ```
   === AGENTS.md Integration ===
   The following sections have changed. Update your repo's AGENTS.md:
   
   [paste-ready markdown block]
   ```
4. Optionally writes the snippet to `.dev-tasks-agents-update.md` for later use.

### 6. Version Metadata
The script writes `.dev-tasks-version` in the consumer repo root:
```json
{
  "version": "1.2.0",
  "installed_at": "2026-04-20T12:00:00Z",
  "script_version": "1.0.0",
  "source": "https://github.com/llipe/dev-tasks"
}
```

### 7. Safety Behavior
- **Local modification detection:** Before overwriting, compare checksums of managed files against known good state; warn and list modified files.
- **Dry-run mode:** `--dry-run` flag on install/update shows what would change without writing.
- **Backup:** `--backup` flag copies current managed files to `.dev-tasks-backup/` before replacing.
- **Rollback guidance:** The version metadata and backup enable manual rollback; the script prints rollback instructions when relevant.

## Acceptance Criteria
- [ ] `dev-tasks.sh` exists in the repo root and is the single entry point for distribution.
- [ ] `curl -sL .../dev-tasks.sh | bash` (or download + run) successfully installs the toolkit into a clean consumer repo.
- [ ] `./dev-tasks.sh install` downloads and places all managed files in the correct paths.
- [ ] `./dev-tasks.sh install v1.2.0` installs a specific pinned version.
- [ ] `./dev-tasks.sh update` detects the current version, downloads the latest, replaces managed files, and prints the AGENTS.md integration prompt.
- [ ] `./dev-tasks.sh check` reports current vs latest version and whether an update is available.
- [ ] `./dev-tasks.sh version` prints the installed version and script version.
- [ ] The AGENTS.md integration prompt is printed after every install/update — never silently overwritten.
- [ ] Local modifications to managed files are detected and warned about before overwriting.
- [ ] `--dry-run` shows planned changes without modifying any files.
- [ ] `--backup` creates a backup of managed files before replacement.
- [ ] `.dev-tasks-version` is written after every install/update with version and timestamp.
- [ ] A GitHub Actions workflow produces a tarball and checksum on tagged releases.
- [ ] Network errors, missing `curl`/`tar`, and permission failures produce clear error messages and non-zero exit codes.
- [ ] README documents installation, update, version check, pinning, and rollback.

## Suggested Implementation Outline
- [ ] Define the bundle contract and managed file surface in a manifest.
- [ ] Create `bundle-manifest.json` listing managed paths and compatibility metadata.
- [ ] Create `dev-tasks.sh` with subcommands: `install`, `update`, `check`, `version`.
- [ ] Implement `install` flow: resolve version → download tarball → extract → place files → write `.dev-tasks-version` → print AGENTS.md prompt.
- [ ] Implement `update` flow: read current version → resolve latest → detect local modifications → download → replace → write metadata → print AGENTS.md prompt.
- [ ] Implement `check` flow: read current version → query GitHub API for latest release → compare and report.
- [ ] Implement `version` flow: read `.dev-tasks-version` and print.
- [ ] Implement AGENTS.md integration prompt generation (diff between bundled and consumer AGENTS.md, or ready-to-paste block).
- [ ] Add `--dry-run` and `--backup` flag support.
- [ ] Add error handling for network failures, missing tools, permissions, and corrupt archives.
- [ ] Create `scripts/build-bundle.sh` to package the managed files into a tarball with checksum.
- [ ] Create `.github/workflows/release-bundle.yml` GitHub Actions workflow.
- [ ] Document usage in the README.

## Non-Goals
- Supporting multiple independent distribution mechanisms for different artifact types.
- Publishing skills separately from the rest of the toolkit.
- Automatically self-updating consumer repositories without an explicit install/update action.
- Silently overwriting the consumer's `AGENTS.md` — always prompt, never auto-merge.

## Notes
- This story treats the repository as a versioned product. The script and manifest are part of the public API.
- The script should require only standard POSIX tools (`curl` or `wget`, `tar`, `shasum`, `jq` optional) — no Node.js, Python, or other runtime dependency.
- The AGENTS.md prompt is critical UX: consumers need to understand what changed and decide how to integrate it into their own documentation structure.
