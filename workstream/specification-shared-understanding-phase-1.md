# Specification: Shared Understanding — Phase 1 (Docs Foundation and Repository Shape)

## Changelog

| Version | Date       | Summary                                                    | Author           |
| ------- | ---------- | ----------------------------------------------------------- | ---------------- |
| 1.0     | 2026-09-19 | Initial version. Docs foundation rename, runbooks, monorepo/single-package detection and package map. | product-engineer |
| 1.2     | 2026-09-19 | Verifier Design Mode corrections (D-48 to D-50): `lint` invokes `tsx core/checks/run.ts`, never `dist/` — `validate` has no `build` step and `publish-npm.yml` runs `validate` before `build`, so a compiled path breaks every fresh clone and the first release; frontmatter is hand-parsed, not `yaml`-parsed, because the check ships to consumers where devDependencies are absent; 51 files carry the old names, not 46, and ADRs, PRDs, and `workstream/` among them are never rewritten; `.gitignore` would silently ignore both new filenames; the docs-structure rules gain four constraints that otherwise produce false failures on a clean tree. | verifier / product-engineer |
| 1.1     | 2026-09-19 | Open Questions A-D resolved (D-42 to D-45): fallback-window removal tracked as issue #201, not version-comparison code; `doctor`/`update` output satisfies FR-45's session-start detection for the first release; `activity-init`'s "Mode A — Mono-Repo" renamed to avoid colliding with the new "monorepo" repository-shape term; package map's Bounded Context column is freeform at `activity-init` time. | @llipe / product-engineer |

## 1. Executive Summary

Phase 1 renames the two foundation documents to `docs/product.md` and `docs/tech.md` behind a one-release fallback, establishes `docs/runbooks/` as an install-if-absent capability with nine seeded runbooks, teaches `activity-init` to detect single-package vs. monorepo shape and record a package map in `docs/tech.md`, and creates the `core/checks` module (first use: a docs-structure check wired into `lint`). It runs after Phase 0 (merged, PR #200) so the rename never touches a file Phase 0 was scheduled to delete, and it is a prerequisite for every later phase because Phases 2 to 5 name `docs/product.md`, `docs/tech.md`, and the package map directly.

## 2. Reference Documents

| Document                                                    | Relevance                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `docs/requirements/prd-shared-understanding-refinement.md`  | FR-44 to FR-51 (docs foundation and runbooks), FR-59 to FR-64 (repository shape), AC-22 to AC-26, AC-29 to AC-32, Non-Goals |
| `docs/technical-guidelines.md`                                | Canonical script names, quality gates, `SIMPLICITY.md` A4/A10/B1           |
| `SIMPLICITY.md`                                               | A4 (deep modules, no premature generality), A10 (delete over deprecate, burden of proof on adding), B1 (behavior-preserving refactor), B3 (smallest change) |
| `docs/adr/ADR-006-claude-settings-ownership.md`               | Precedent for a delivered-once, consumer-owned file category               |
| `core/distribution/profiles.ts`                               | `ROOT_FILES`, `ROOT_PROFILE_TAG`, `INSTALL_IF_ABSENT_FILES` — the registries this phase extends |
| `core/distribution/migrate.ts`                                | The existing legacy-install migration this phase extends with `migrate docs` |
| `.claude/skills/activity-init/SKILL.md` (+ `.github`/`.kiro`) | The skill this phase teaches shape detection and renames                   |
| `workstream/decisions-shared-understanding.md`                | D-16, D-21 (WHAT phase); D-42 onward reserved for this phase's HOW decisions |

## 3. Affected Repositories

| Repository  | Role                       | Scope of Changes                                                                                   |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `dev-tasks` | Workflow harness (this repo) | Renames its own two foundation docs; adds `core/checks`, `docs/runbooks/`, package-map detection, and the `migrate docs` command; updates all three prompt trees and every test that names the old filenames. |

No other repository is touched. Consumer repositories receive the new capability through the next `dev-tasks update`; this phase does not modify any consumer repository directly (Non-Goals: "the rename applies to new installs and to `dev-tasks` itself; consumers rename on their own schedule with `doctor` guidance").

## 4. System Architecture

Three independent capabilities land in this phase, sharing one dependency: all three are named by every later phase, so getting the names and the detection contract right here is the point of running Phase 1 before the feature phases.

```mermaid
flowchart TB
    subgraph "1. Docs rename"
        A1["docs/product-context.md → docs/product.md<br/>docs/technical-guidelines.md → docs/tech.md"]
        A2["dev-tasks migrate docs<br/>(propose / --force apply)"]
        A3["Old-name fallback<br/>(one release cycle)"]
        A1 --> A2
        A1 --> A3
    end
    subgraph "2. Runbooks"
        B1["INSTALL_IF_ABSENT_FILES<br/>+ platform-agnostic ROOT tag"]
        B2["docs/runbooks/README.md index<br/>+ 9 seeded runbooks"]
        B1 --> B2
    end
    subgraph "3. Repository shape"
        C1["activity-init shape detection<br/>(workspace signals)"]
        C2["Package map in docs/tech.md"]
        C3["doctor: package-map drift warning"]
        C1 --> C2 --> C3
    end
    subgraph "4. core/checks (new module)"
        D1["docs-structure check<br/>(FR-50, AC-24, AC-32)"]
    end
    A1 -.reads/writes.-> D1
    B2 -.validated by.-> D1
    D1 -->|wired into| LINT["pnpm run lint"]
```

`core/checks` is a new module, not an extension of an existing one — `core/verify` belongs to the retired `dt` binary and is not reused (FR-57, already recorded in the Phase 0 spec as an architectural constraint for this phase to satisfy). Phase 1 builds exactly one check inside it: the docs-structure check. Later phases add their own checks alongside it (glossary conformance in Phase 3, commit-order and refactor-invariance in Phase 5, the change map in Phase 6); this phase does **not** build a generic checks-registry or plugin interface for them; premature generality for three not-yet-written consumers fails `SIMPLICITY.md` A4's "what breaks without it" test. If a third or fourth check later needs shared scaffolding, that refactor happens when it is needed, against real duplication, not speculatively here.

## 5. Data Model & Database Design

No database. Three new structured-text schemas.

### Package map (`docs/tech.md`, one table)

| Column             | Source                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| Package             | Workspace package name (from the package's own `package.json` `name`, or the directory name when absent) |
| Path                | Relative path from repo root                                           |
| Purpose             | One line, human-confirmed at `activity-init` time                       |
| Owner               | Human-confirmed at `activity-init` time                                 |
| Canonical scripts   | Intersection of the root's canonical script names (`lint`, `test`, `typecheck`, …) actually present in the package's own `package.json` |
| Bounded context     | Freeform at `activity-init` time; becomes canonical once Phase 3's glossary exists — not blocked on it |

A single-package repository (this one, today) records one row for the root itself, so `docs/tech.md` has the same table shape regardless of shape, and `doctor`'s drift check has one code path.

### Runbook frontmatter (`docs/runbooks/runbook-<verb>-<object>.md`)

Exact shape from the PRD Data Requirements section: `name`, `trigger`, `owner`, `last_verified` (date), `related` (list of paths). Body: Preconditions, Steps, Verification, Rollback, Escalation — five fixed headings, enforced by the docs-structure check (not merely documented).

### Runbook index (`docs/runbooks/README.md`)

| Column        | Source                              |
| -------------- | -------------------------------------- |
| Runbook        | Filename, linked                     |
| Trigger        | Copied from frontmatter               |
| Owner          | Copied from frontmatter               |
| Last verified  | Copied from frontmatter               |

```mermaid
erDiagram
    PACKAGE_MAP ||--o{ PACKAGE_ROW : "one row per"
    RUNBOOK_INDEX ||--o{ RUNBOOK : lists
    RUNBOOK ||--|| RUNBOOK_FRONTMATTER : carries
    RUNBOOK }o--o{ SCRIPT_OR_WORKFLOW : "related to"
    PACKAGE_ROW }o--o| BOUNDED_CONTEXT : "maps to (Phase 3)"
```

## 6. API Design

No HTTP API. The `dev-tasks` CLI surface gains one subcommand and `doctor` gains two new warning classes.

| Command                    | Behavior                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `dev-tasks migrate`         | Unchanged — legacy shell-install detection (`core/distribution/migrate.ts`).                                                        |
| `dev-tasks migrate docs`    | New. Dry-run by default: prints the two pending renames and the consumer-owned files (`CLAUDE.md`, `AGENTS.md`, custom prompts) that still reference the old names, and exits `0` doing nothing. `dev-tasks migrate docs --force` performs the rename (content byte-identical `git`-free file move via `node:fs`), backing up the two originals first via the existing `createBackupDir`/`backupFile` (`core/distribution/backup.ts`) — the same reuse `update --force` already established, not a new backup mechanism. |
| `dev-tasks doctor`          | Gains two checks: (a) old foundation-doc names present → propose `migrate docs`, mirroring the existing legacy-install proposal shape; (b) package map present but disagrees with the detected workspace (a package on disk with no map row, or vice versa) → warn, do not fail (`doctor` warns; `lint`/`validate` is where structural failures block, per FR-50). |

`--force` is reused with its existing meaning ("perform the mutating action, back up first") rather than adding a second flag with overlapping semantics.

## 7. Authentication & Authorization Design

Not applicable. No new network or credential surface.

## 8. Business Logic Implementation

### 8.1 Docs rename and fallback resolution

```mermaid
stateDiagram-v2
    [*] --> Renamed: git mv, content unchanged (FR-46)
    Renamed --> ReferencesUpdated: update the rewritable references (51 carry them, 31 are rewritten)
    ReferencesUpdated --> MigrateCommand: add `migrate docs` (propose/apply)
    MigrateCommand --> FallbackWindow: agents resolve old names for one release cycle
    FallbackWindow --> FallbackRemoved: window closes — tracked follow-up, issue #201 (D-42)
    FallbackRemoved --> [*]
```

The rename itself is one behavior-preserving `refactor:` commit (FR-46, `SIMPLICITY.md` B1): `git mv` for the two files, content untouched. Updating the references by string (agents, skills, instructions, steering, tests) is mechanical and follows in the same or an immediately adjacent commit — it is still behavior-preserving, since it changes prose/config, not runtime behavior of the `dev-tasks` binary.

**51 files carry the old names, and not all of them may be rewritten (D-50).** Measured on this branch: `.claude/` 10, `.github/` 11, `.kiro/` 12, `docs/` 10, `test/` 2, root 6 (`AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `CLAUDE.md.template`, `README.md`, `.gitignore`). `core/`, `bin/`, `templates/`, and `scripts/` carry none. Earlier drafts said 46 and then 50; 51 is the measured figure, `.gitignore` being the file both earlier counts missed.

Three groups inside that 51 are **not** rewritten:

| Group | Files | Why |
| ----- | ----- | --- |
| ADRs | `docs/adr/ADR-002`, `ADR-003`, `ADR-007`, `docs/adr/README.md` | D-35: an ADR is never rewritten. ADR-007 records which files Phase 0 changed; editing it falsifies the record. |
| PRDs | `docs/requirements/prd-shared-understanding-refinement.md`, `prd-infra-engineer.md`, `prd-evidence-driven-development-loop.md` | A PRD is a historical statement of intent. FR-44 itself reads "`docs/product-context.md` becomes `docs/product.md`" — rewriting it erases the requirement's own subject. |
| `workstream/` | 24 tracked files | Out of PRD AC-22's enumerated scope, and archived per-feature records. The parity test **must** exclude `workstream/` or it fails with 24 hits. |

`.gitignore` is not in those groups — it is a live config file and must change, for a different reason (§8.1a).

PRD AC-22's scope list names `adapters/`, which Phase 0 deleted (D-34). S-001 AC-2 drops it; that is deliberate, not drift.

### 8.1a `.gitignore` silently ignores both new filenames

`.gitignore:25` is `/docs/*.md`, followed by an explicit negation per tracked document — including `!/docs/product-context.md` and `!/docs/technical-guidelines.md`. There is no negation for the new names, so `git check-ignore -v docs/product.md` resolves to `.gitignore:25` today: **both renamed files would be ignored.**

`git mv` on a tracked file survives this, so the rename commit itself looks clean. The trap is later: any `git add docs/product.md` after a delete, after `migrate docs --force` on a fresh tree, or after `activity-init` regenerates the file, is silently refused. The fix is two negation lines; the cost of missing it is a file that appears to save and never commits.

### 8.1b Fallback resolution

Fallback resolution (FR-45) is scoped to what `dev-tasks` itself ships to agents, not a new file-system watcher: any dev-tasks-authored instruction that names the foundation docs resolves `docs/product.md` first, falling back to `docs/product-context.md` (and the `docs/tech.md`/`docs/technical-guidelines.md` pair) only if the new name is absent. This is a resolution rule stated in the prompt content itself (a short paragraph in `activity-init` and any skill that reads these files), not new executable code — there is no runtime "foundation doc reader" module in `dev-tasks` today, and adding one solely to implement a fallback would be exactly the kind of abstraction `SIMPLICITY.md` A4 asks to justify against what breaks without it. Nothing breaks without it: an agent reading a file it's told to read either finds the new name or falls back per the documented rule.

### 8.2 Repository shape detection

```mermaid
flowchart LR
    Start["activity-init: Part 0 (new)"] --> Check{"Workspace signal present?<br/>pnpm-workspace.yaml, workspaces in<br/>package.json, turbo.json, nx.json,<br/>lerna.json, [tool.uv.workspace]"}
    Check -->|No| Single["Single-package shape<br/>One row: the root itself"]
    Check -->|Yes| Multi["Monorepo shape<br/>Enumerate workspace packages"]
    Single --> Record["Record package map in docs/tech.md"]
    Multi --> Record
    Record --> Confirm["Human confirms purpose/owner/bounded-context per row"]
```

Detection is a pure read of the signal files listed in FR-59 (`pnpm-workspace.yaml`, `workspaces` in `package.json`, `turbo.json`, `nx.json`, `lerna.json`; Python's `[tool.uv.workspace]`). No new dependency: parsing JSON/YAML/TOML already has a path in this codebase or its dependency set (`yaml` is already a devDependency after Phase 0; TOML parsing is new and small enough to hand-roll for the one key this needs, or deferred — see the Stack Profiles Non-Goal: "other stacks get the `make validate` entry point... until a profile exists").

`dev-tasks` itself has no workspace signal, so it detects single-package shape and records one row for its own root — this phase does not turn `dev-tasks` into a monorepo; it builds and tests the capability against a monorepo fixture in `test/fixtures/`.

### 8.3 Docs-structure check (`core/checks`)

Per FR-50, `validate` fails (via `lint`) on:

1. `docs/README.md` or `docs/runbooks/README.md` lists a file that does not exist (AC-32).
2. `docs/README.md` or `docs/runbooks/README.md` omits a file that does exist in its directory (AC-32).
3. A runbook has invalid or missing frontmatter (missing `name`, `trigger`, `owner`, `last_verified`, or `related`; `last_verified` not a valid date) (AC-24).
4. A `related` entry names a script or workflow path that does not exist (AC-24, AC-25).

It reports, without failing, a runbook whose `last_verified` exceeds the staleness window (90 days, D-21/OQ-14).

Four constraints the rules above do not state, each of which produces false failures on today's clean tree if missed:

- **Rule 1 must be repo-root-aware and tolerate directory links.** `docs/README.md` links `../README.md`, the `requirements/` directory, `adr/README.md`, and five root files (`AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `DESIGN.md`, `TESTING.md`). Resolving those relative to `docs/` yields five or more false failures.
- **Rule 2 must be non-recursive.** `docs/` contains seven ADRs and four PRDs in subdirectories that `docs/README.md` does not list individually and should not have to. Only immediate children of the indexed directory count.
- **Rule 3's "misnamed" needs a machine-checkable rule.** Use `^runbook-[a-z0-9]+(-[a-z0-9]+)+\.md$`. A stricter verb-object rule is not checkable: `runbook-configure-branch-protection` and `runbook-setup-supabase-local` both parse ambiguously into verb and object.
- **Frontmatter is hand-parsed, not `yaml`-parsed (D-49).** The five keys are fixed and flat. `yaml` is a devDependency, and the check ships to consumers inside `dist/core/`, where devDependencies are not installed — parsing five known keys directly avoids promoting a dependency to satisfy one call site (`SIMPLICITY.md` A4).

This is a Node function (`core/checks/docs-structure.ts`, `checkDocsStructure(repoRoot): { failures: Finding[]; stale: Finding[] }`) invoked two ways: `lint` runs it, so `validate` reaches it, and the `verifier` reads the same result for its audit summary (`lint` is the enforcement path; the verifier only reports). One implementation, two callers; no duplicated logic.

**Invocation (D-48).** `lint` runs `tsx core/checks/run.ts`, not `node dist/core/checks/run.js`. The compiled path cannot work: `dist/` is gitignored with zero tracked files, `validate` is `typecheck → lint → format:check → test` with no `build` step, and `publish-npm.yml` runs `validate` at line 61 *before* `build` at line 64. A `dist/`-dependent `lint` therefore fails on every fresh clone and breaks the first release after merge — it only passes for whoever implements it, because their `dist/` is already warm. `tsx` is an existing devDependency and runs the TypeScript source directly. Making `lint` depend on `build` was rejected: it turns every lint into a compile, and it reorders a gate chain that is not this phase's to reorder.

Consumers reach the same check through the published package (`dist/core/` is in `package.json` `files`), so the check itself must not need a devDependency at runtime — see the frontmatter-parsing note in §16.

### 8.4 Runbook coverage (FR-49, AC-25, AC-31)

Two triggers, both advisory/verifier-level except the structural conditions in 8.3 which are hard `lint` failures:

- **Coverage**: every file under `templates/scripts/`, `templates/workflows/`, and `.github/workflows/` must appear in some runbook's `related` field (AC-25) — checked by the same docs-structure check (condition 4 above, run in reverse: every script/workflow path must be *referenced by* some runbook, not just that referenced paths must exist).
- **Procedure**: a PR whose task list contains ≥3 setup/config/migration/credential/data steps and adds or updates no runbook gets a `verifier` finding (AC-31) — this is verifier-side pattern matching over the task list and the diff, not a `core/checks` structural rule, since "plausibly repeated" is a judgment call the deterministic checker cannot make.

## 9. Integration Details

No third-party integrations. `activity-init`'s shape detection reads local files only.

## 10. User Interface & Client Behavior

No graphical interface. `/DESIGN.md` is unaffected.

## 11. Performance & Scalability Approach

The docs-structure check adds one more step to `lint`; it is a bounded, single-pass filesystem scan (runbooks directory + two README indexes), not proportional to source size, so it does not threaten Phase 4's CI wall-time budget (OQ-12). `activity-init`'s shape detection runs once per init, not per validate.

## 12. Security Implementation

Not applicable. No new credential, network, or data-handling surface. The rename touches documentation and CLI wiring only.

## 13. Error Handling & Logging

`dev-tasks migrate docs` without `--force` never mutates the working tree — it is report-only, matching the existing `update` dry-run convention. `doctor`'s two new checks follow the existing `doctor` output shape (pass/warn, `--json` supported). The docs-structure check's failures are `lint` failures with file:line-equivalent (file:condition) messages, not a new exit code — `core/exit-codes.ts`'s 5-code contract from Phase 0 is unaffected, since `lint` failure is ESLint's own process exit, not a `dev-tasks` exit code.

## 14. Testing Strategy

| Layer        | Approach                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Static        | `typecheck` covers the new `core/checks` and `core/distribution/migrate-docs.ts` modules.                                                    |
| Unit          | `core/checks/docs-structure.test.ts`: each of the four failure conditions plus the staleness-without-failure case, seeded fixtures under `test/fixtures/`. `migrate-docs.test.ts`: propose (no mutation) and `--force` apply (rename + backup) against a temp dir. |
| Integration   | `activity-init` shape detection against two fixture repos: one single-package, one monorepo (`pnpm-workspace.yaml` with 2 packages) — asserts the package-map table shape in each. |
| Parity        | Existing parity-test pattern extended into a new absence assertion over the rewritable references. Its scan roots and allowlist are **not** a copy of `test/unit/dt-retirement-absence.test.ts`: that guard does not scan `docs/` at all, and this one must, while excluding `docs/adr/**`, `docs/requirements/**`, and `workstream/` per D-50, plus the fallback-rule locations. |
| Docs-structure | Seed a broken index, a missing-frontmatter runbook, and a dangling `related` entry; assert `lint` fails on each and passes once fixed — mirrors the absence-guard self-test pattern from Phase 0. |
| Regression    | Re-run the D-40 five-name failure baseline; this phase is not expected to change it, since it touches no code the five failing tests exercise. |

## 15. Deployment & Rollout

| Aspect                 | Decision                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Feature flag            | None. `SIMPLICITY.md` A10 — no flag for a single-consumer capability.                                          |
| Fallback window         | One release cycle (FR-45); removal tracked as a follow-up issue (#201, D-42), not version-comparison code.     |
| Backward compatibility  | Old names keep working for agents for the fallback window; `update` never renames a consumer's files unprompted. |
| Version/commit type     | Additive capability, no breaking change to the `dev-tasks` binary's CLI contract (new subcommand, new warnings) — `feat:` commits, no `!`. Actual version bump is `./scripts/release.sh`, run by the maintainer on `main` after merge (D-41 — this phase does not repeat the Phase 0 process error). |
| Rollback                | Revert the merge commit. The rename is the only stateful-feeling change, and it is a pure `git mv` with content unchanged, so revert is complete. |

## 16. Dependencies & Risks

| Risk                                                                                     | Likelihood | Mitigation                                                                                                    |
| ------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| A reference to the old names is missed among the 51 files, and an agent reads a stale name  | Medium     | The fallback rule (§8.1b) means a miss degrades to "still works via fallback," not silent failure; the parity test (§14) closes the gap before merge. |
| The parity test is written by copying Phase 0's absence guard and inherits its scan roots  | High       | Stated explicitly in §14: that guard omits `docs/`, which is where the immutable records live. Copying it silently passes while leaving `docs/` unchecked. |
| `activity-init`'s existing "Mono-Repo" mode name collides in meaning with the new "monorepo" repository-shape term | Medium     | Resolved (D-44): the existing mode is renamed to "Mode A — Documented" (or equivalent) to free the term.       |
| `INSTALL_IF_ABSENT_FILES` has no platform-agnostic tag today, and `docs/runbooks/README.md` needs one | Low        | Extend the registry with a `ROOT_PROFILE_TAG`-style dedicated tag (reusing the pattern `ROOT_FILES` already established), not a new third category — same fix the PRD's own Technical Considerations section anticipates for Phase 3's glossary file, built here first since Phase 1 needs it first. |
| The docs-structure check produces false positives on legitimate historical `related` references (e.g., a runbook documenting a since-removed script for troubleshooting history) | Low | Runbooks describe current procedures, not history; a removed script's runbook is retired with it, consistent with `SIMPLICITY.md` A10. |
| Monorepo detection is only exercised against one fixture shape (`pnpm-workspace.yaml`) before a real consumer monorepo validates it | Medium | Documented as a known limitation; `nx.json`/`turbo.json`/`lerna.json`/`[tool.uv.workspace]` detection is signal-file presence only (existence check), not full parsing, which keeps the untested-parser surface small. |

## 17. Open Questions

None. All four were resolved on 2026-09-19 and recorded as decisions.

| Question                                                  | Resolution                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| How is the one-release-cycle fallback window enforced?     | Tracked follow-up issue, not version-comparison code. Filed as [#201](https://github.com/llipe/dev-tasks/issues/201). Recorded as `D-42`. |
| Does FR-45's "agent at session start" detection need a new hook? | No, for the first release: `doctor`/`update` output satisfies it, advisory (FR-72 pattern). Recorded as `D-43`. |
| Does `activity-init`'s "Mode A — Mono-Repo" collide with the new "monorepo" term? | Yes — renamed to avoid the collision (§8.2 update below). Recorded as `D-44`.                    |
| Is the package map's "Bounded context" column populated before Phase 3's glossary exists? | Yes, freeform, superseded by the glossary later. Recorded as `D-45`.                              |

## Decisions (HOW phase)

Confirmed on 2026-09-19 and recorded in `workstream/decisions-shared-understanding.md`. Numbering continues the feature's single decision-log ID space.

| ID   | Decision                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| D-42 | Fallback-window removal is a tracked follow-up issue (#201), not version-comparison code.                                       |
| D-43 | `doctor`/`update` output satisfies FR-45's session-start detection for the first release; no new per-platform hook this phase.  |
| D-44 | `activity-init`'s existing "Mode A — Mono-Repo" is renamed to "Mode A — Documented" (or equivalent) to free the "monorepo" term for FR-59's repository-shape concept. |
| D-45 | Package map's "Bounded context" column is freeform at `activity-init` time; Phase 3's glossary supersedes it by decision ID.     |
