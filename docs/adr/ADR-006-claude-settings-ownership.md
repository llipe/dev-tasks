# ADR-006: `.claude/settings.json` ownership — install-if-absent, not managed-overwrite

## Status

Accepted

## Context

`.claude/settings.json` is the file that wires Claude Code's `PreToolUse` hooks to the shell scripts `dev-tasks` ships under `.claude/hooks/`. `PROFILE_PATHS.claude` installs `.claude/hooks/*.sh`, but `.claude/settings.json` was listed in `bundle-manifest.json` `consumer_owned_paths` and was never installed by any code path. The result: a `--profile claude` consumer received two inert shell scripts with nothing wiring them into Claude Code's tool-use lifecycle, while the Kiro profile shipped the equivalent wiring file (`.kiro/hooks/git-guard.json`) as a normal managed path and worked out of the box. `.claude`'s contracts were at parity with Kiro; its runtime bindings were not.

Two existing distribution categories were considered and both are the wrong shape for this file:

- **Managed-directory files** (`PROFILE_PATHS` — `.claude/agents`, `.claude/skills`, `.claude/commands`, `.claude/hooks`) are unconditionally overwritten on every `install` and hash-reconciled on `update`. That is correct for files nobody customizes per-repo. `.claude/settings.json` is not that: task 6.0 of this plan populates `permissions.allow` with commands specific to a consumer's workflow, and a consumer may wire additional local hooks beyond the two `dev-tasks` ships. Overwriting it on every `install` would discard both.
- **`ROOT_FILES`** (`DESIGN.md`, `TESTING.md`) are unconditionally overwritten by `installFiles` on every run and protected from `update` only via `consumer_owned_paths`. That means a second `install` run — not just `update` — clobbers a filled-in copy back to the placeholder. `.claude/settings.json` needs protection at `install` time too, since a consumer's `permissions.allow` and local hooks must survive `install` and `update` alike.

Neither category's semantics fit. A third one was needed.

## Decision

Deliver `.claude/settings.json` with **install-if-absent** semantics: written to the target repo only when the path does not already exist, and never touched again afterward by either `install` or `update` — by either command, regardless of which delivered it (or whether it pre-existed for any other reason).

Concretely:

- `core/distribution/profiles.ts` exports `INSTALL_IF_ABSENT_FILES`, a registry of `{ source, target, platform }` entries — currently one entry mapping `templates/claude/settings.json` -> `.claude/settings.json` for the `claude` platform. This is a dedicated registry, not an extension of `PROFILE_PATHS`, because `PROFILE_PATHS` models directories where source and target are identical; this file's source and target relative paths differ.
- `core/distribution/install-if-absent.ts` implements the shared delivery logic (`deliverInstallIfAbsentFiles`), used by both `installFiles` (fresh install) and `runUpdate` (so a consumer who installed before this file existed still receives it on their next `update`, gated on the `claude` platform already being tracked in their manifest).
- These files are **not** recorded in `.dev-tasks/manifest.json`. Tracking them would eventually subject them to the standard hash-based reconcile used for managed files, which is exactly the ongoing-overwrite risk this decision exists to avoid, and the source/target path mismatch would break the reconcile loop's assumption that a tracked entry's path is valid in both the consumer repo and the package.
- `.claude/settings.json` is removed from `bundle-manifest.json` `consumer_owned_paths`. That list existed to make `update` skip a path outright; since the file was never delivered by any code path, the entry was documentary only. Install-if-absent delivery supersedes it with an actual delivery mechanism, and the two conventions would otherwise document contradictory intents for the same path.
- `templates/claude/settings.json` ships with a valid, minimal structure (`hooks.PreToolUse: []`, `permissions.allow: []`) that later tasks extend: task 2.0 populates `PreToolUse` with the `branch-guard` and `git-guard` wiring; task 6.0 (subtask 6b) populates `permissions.allow`. This task delivers the mechanism, not the content.
- `core/distribution/doctor.ts` adds `checkClaudeHooksWiring`: since install-if-absent means `.claude/settings.json` is never force-synced to match newly shipped hook scripts, a repo can legitimately end up with a hook script on disk that nothing wires (a newer package version, or a consumer who deleted a `PreToolUse` entry). The check reads `.claude/hooks/*.sh`, reads `.claude/settings.json`'s `PreToolUse` entries, and warns by script name for anything unwired — instead of leaving the drift silent.

## Alternatives Considered

- **Managed-overwrite (treat it like `.claude/agents/*.md`)** — rejected: would discard a consumer's `permissions.allow` and any additional local hooks on every `install`/`update`, defeating the point of the file being consumer-configurable at all.
- **`ROOT_FILES`-style unconditional overwrite, protected only via `consumer_owned_paths` during `update`** — rejected: `install` itself still clobbers a filled-in copy on every run, which fails acceptance criterion AC-2 (re-running `install` must leave a consumer-modified `.claude/settings.json` byte-identical) directly.
- **Track it in the manifest with hash-based reconcile (like a normal managed file, just delivered via a different source path)** — considered, since it would let template improvements to the empty scaffold (e.g. future `PreToolUse` additions) propagate to existing installs on `update` when the consumer hasn't customized the file. Rejected for now: the reconcile loop in `update.ts` assumes a tracked entry's `path` is valid as a lookup key in both the consumer repo and the package source tree, which does not hold here (`templates/claude/settings.json` vs `.claude/settings.json`). Making that assumption safe for a single dual-path entry was judged more complex than the benefit for this task's scope; revisit if a future task needs template-driven settings.json evolution to reach already-installed consumers automatically.
- **Never deliver it at all; require the consumer to copy `templates/claude/settings.json` manually** — rejected: this is the status quo defect (issue #169) and is the reason Claude consumers get inert hook scripts today.

## Consequences

Positive:

- `dev-tasks install --profile claude` into an empty repo now produces a `.claude/settings.json`, closing the gap that left `.claude/hooks/*.sh` inert.
- A consumer's `permissions.allow` entries and any local hook wiring survive both `install` and `update` unconditionally — no hash-comparison edge case can silently discard them.
- Existing installs (manifest already tracks a `claude` entry, but predates this file) receive it on their next `update` without requiring a fresh `install`.
- `doctor` surfaces hooks/settings drift by name instead of leaving it silently inert, closing the observability gap install-if-absent semantics would otherwise leave open.

Negative / bounded:

- Once delivered, `.claude/settings.json` never receives template improvements automatically — a future addition to the shipped `PreToolUse` wiring (or a security-relevant tightening of the scaffold) reaches only fresh installs, not existing ones, until a consumer deletes and regenerates the file or a maintainer documents a manual migration step.
- The file's delivery is invisible to `.dev-tasks/manifest.json` and to `dev-tasks status`; a consumer inspecting the manifest will not see it listed, which is a deliberate trade-off (see Alternatives) but a discoverability cost.
- `checkClaudeHooksWiring`'s wiring detection is a substring match against each `PreToolUse` entry's `command` string, not a JSON-schema-aware parse of the hook contract; a hook wired through an unconventional command shape could produce a false negative.

Follow-up:

- Task 2.0 populates `templates/claude/settings.json` `PreToolUse` with the `branch-guard`/`git-guard` wiring this task left empty.
- Task 6.0 (subtask 6b) populates `permissions.allow`.
- Task 8.0 (installed-state parity test) asserts this file's presence as part of the Claude profile's installed-state contract, once tasks 1, 2, and 3 have landed.

## Related

- Requirements: `workstream/tasks-claude-runtime-parity-plan.md` (parent task 1.0), issue [#169](https://github.com/llipe/dev-tasks/issues/169)
- Workstream: `workstream/test-plan-claude-runtime-parity.md` (CP-01), `workstream/traceability-matrix-claude-runtime-parity.md`
- Code: `core/distribution/profiles.ts` (`INSTALL_IF_ABSENT_FILES`), `core/distribution/install-if-absent.ts`, `core/distribution/install.ts`, `core/distribution/update.ts`, `core/distribution/doctor.ts` (`checkClaudeHooksWiring`)
- Templates: `templates/claude/settings.json`
- Manifest: `bundle-manifest.json` (`managed_paths` entry `templates/claude`; `.claude/settings.json` removed from `consumer_owned_paths`)
- Docs updated: `docs/adr/README.md`
