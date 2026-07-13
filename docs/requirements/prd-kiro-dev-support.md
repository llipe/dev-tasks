# PRD: Kiro.dev Support

## Changelog

| Version | Date       | Summary          | Author              |
| ------- | ---------- | ----------------- | -------------------- |
| 1.0     | 2026-07-13 | Initial version   | product-engineer     |
| 1.1     | 2026-07-13 | Corrected canonical source: `.github/` (Copilot) is the reference behavior (8 peer agents, 12 skills, 3 always-loaded instructions, 12 prompts) rather than `.claude/`'s Claude-Code-specific adaptation (6 subagents + 2 main-thread commands, 14 skills incl. `plan`/`implement`). Restored the `.github/prompts/*.prompt.md` layer as an in-scope requirement. Noted that Kiro shares Claude Code's no-nested-subagent constraint, so `.claude/`'s command/subagent split is reusable as an *implementation pattern* even though it isn't the content source. | product-engineer |

## Executive Summary

`dev-tasks` currently distributes its agent/skill/instruction workflow to two AI coding surfaces — GitHub Copilot (`.github/`) and Claude Code (`.claude/`) — from a single versioned bundle. This PRD adds **Kiro.dev** (IDE) as a third first-class target, at full parity with the existing two, so that teams using Kiro get the same structured PRD → spec → stories → plan → implement workflow, agents, and skills as Copilot/Claude Code users, installed and updated through the same `dev-tasks.sh` distribution mechanism.

## Feature Overview

**Canonical source note:** `.github/` (GitHub Copilot) is this repo's original, unconstrained platform tree and is treated as the reference behavior for *content* (what each agent/skill/instruction does). `.claude/` is a derived adaptation, reshaped specifically to work around Claude Code's constraint that a delegated subagent cannot itself spawn further subagents (documented in this repo's `CLAUDE.md` under "Orchestration model"). Content requirements below are sourced from `.github/`; `.claude/`'s command/subagent split is referenced only where Kiro faces the *same* technical constraint and needs an analogous structural solution.

Kiro's IDE exposes a workspace-local `.kiro/` directory with conventions that map closely — but not identically — onto `dev-tasks`' existing concepts:

| dev-tasks concept (canonical `.github/` shape) | Kiro IDE equivalent |
| --- | --- |
| Always-loaded instructions, `applyTo`-scoped (`.github/instructions/*.instructions.md`, 3 files: `plan`, `implement`, `domain/nextjs-pages-components`) | `.kiro/steering/*.md` (frontmatter `inclusion: always\|fileMatch\|manual`) |
| PRD → spec → stories → tasks pipeline | `.kiro/specs/<feature>/{requirements.md,design.md,tasks.md}` |
| Agents (`.github/agents/*.agent.md`, 8 peer files: `product-engineer`, `developer`, `planner`, `technical-writer`, `housekeeping`, `github-ops`, `ux-engineer`, `black-box-tester`) | `.kiro/agents/*.md` (YAML frontmatter: `description`, `model`, `tools`, `mcpServers`, `permissions`, + prompt body). **Kiro confirmed to share Claude Code's no-nested-subagent constraint** (a Kiro subagent can delegate to further subagents only if it's the active/main agent with `subagent` in its `tools`; a spawned subagent cannot itself spawn nested subagents) — so `product-engineer` and `planner` (which delegate to the other 6) will need the same kind of active-agent/delegated-subagent split `.claude/` already solved, even though their *content* comes from `.github/`. |
| Skills (`.github/skills/*/SKILL.md`, 12 files — **not** including `plan`/`implement`, which are instructions in the canonical shape) | `.kiro/skills/*/SKILL.md` (same `agentskills.io` SKILL.md format — likely near-verbatim port) |
| Prompt entry points (`.github/prompts/*.prompt.md`, 12 files — thin invocation templates, some agents have multiple mode-specific prompts, e.g. `product-engineer-init/-feature/-issue`) | No confirmed IDE-side filesystem bundling convention found for Kiro prompts (Kiro's `/prompts` management appears to be a CLI/interactive feature). Needs spec-level resolution — likely folding each prompt's invocation guidance into the corresponding `.kiro/agents/*.md` description/body, similar to how `.claude/commands/*.md` consolidated multiple prompt variants into one file with internal mode detection. |
| Deterministic tool guard (`.claude/hooks/git-guard.sh` — Claude-Code-specific; `.github/` has no equivalent since Copilot has no PreToolUse hook mechanism) | `.kiro/hooks/*.json` (declarative event triggers, e.g. `PostFileSave`) — best-effort only, see Functional Requirements |

This feature adds a third managed file tree (`.kiro/…`), extends `bundle-manifest.json`, `dev-tasks.sh`, and `scripts/build-bundle.sh` to install/update/list it, and produces Kiro-native versions of all 8 agents (content sourced from `.github/agents/`), all 12 skills, the 12 prompt entry points (in whatever form Kiro can actually host them), and a steering-doc equivalent of the 3 `.github/instructions/` files.

## Goals & Objectives

1. A repository can run `dev-tasks.sh install` and receive working `.kiro/agents/`, `.kiro/skills/`, `.kiro/steering/`, and `.kiro/hooks/` content, in addition to the existing `.github/` and `.claude/` trees.
2. Every subagent and skill available to Copilot/Claude Code has a functioning Kiro equivalent — no silent capability gaps beyond what Kiro itself cannot support (see Non-Goals).
3. The full activity chain (`activity-refine` → `activity-generate-spec` → `activity-generate-stories` → `activity-publish-github` → `plan` → `implement`) is usable end-to-end from Kiro.
4. The "no self-merge to `main`" and Conventional Commits rules are represented in the Kiro bundle in the most faithful form Kiro's hook model actually supports, with the enforcement gap versus `.claude/hooks/git-guard.sh` explicitly documented rather than silently weaker.
5. `dev-tasks.sh check`, `list`, and `version` correctly report Kiro-managed paths alongside the existing two.

## Affected Repositories

| Repo | Role / Impact |
| --- | --- |
| `llipe/dev-tasks` | Source of truth. Adds `.kiro/` managed content, updates `bundle-manifest.json`, `dev-tasks.sh`, `scripts/build-bundle.sh`, `.github/workflows/release-bundle.yml`, `README.md`, `AGENTS.md`/`AGENTS.md.template`, `CLAUDE.md.template`. |
| Consumer repositories (any repo running `dev-tasks.sh install`) | Gain an additional managed path set (`.kiro/agents`, `.kiro/skills`, `.kiro/steering`, `.kiro/hooks`) on install/update; unaffected if they don't use Kiro. |

## Target Users

- **Primary:** Developers using the Kiro IDE who want the same PRD-driven, agent/skill-based workflow already available to Copilot and Claude Code users.
- **Secondary:** Maintainers of `dev-tasks` who author and keep the three platform trees in sync.

## User Stories

1. As a **Kiro IDE user**, I want to run `dev-tasks.sh install` and get working `.kiro/agents/*.md` files so I can invoke `product-engineer`, `developer`, `planner`, `github-ops`, `technical-writer`, `housekeeping`, `ux-engineer`, and `black-box-tester` — the same 8 agents `.github/agents/` defines — the same way Copilot users do.
2. As a **Kiro IDE user**, I want the 12 activity/operational skills (`activity-refine`, `activity-generate-spec`, `activity-generate-stories`, `activity-publish-github`, `activity-e2e-test-design`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics`, `activity-init`, `git-ops`, `webapp-mockup`, `memo-cli-usage`) available as Kiro skills/slash commands.
3. As a **Kiro IDE user**, I want the always-loaded rules from `plan.instructions.md`, `implement.instructions.md`, and the Next.js domain instruction represented as `.kiro/steering/*.md` files with correct `inclusion` modes, so agents follow the same task-list and implementation discipline — matching `.github/`'s canonical shape where these are instructions, not skills.
4. As a **Kiro IDE user**, I want some form of automated guard against pushing/merging to `main` and against non-Conventional-Commit messages, even if Kiro's hook model can only warn rather than hard-block.
5. As a **maintainer**, I want `bundle-manifest.json` to declare the `.kiro/` managed paths so `dev-tasks.sh install/update/check/list` handle them identically to the existing two trees.
6. As a **maintainer**, I want `scripts/build-bundle.sh` and the release workflow to package `.kiro/` content into the same versioned release tarball, so there is still a single install/update flow and a single version number across all three platforms.
7. As a **maintainer**, I want the README's Agents/Skills/Instructions/Distribution tables and the AGENTS.md/CLAUDE.md templates updated to document the third platform, so the registry stays the single source of truth.
8. As a **Kiro IDE user with an existing `.kiro/` workspace**, I want install/update to respect files I already own (analogous to `consumer_owned_paths` for `AGENTS.md`/`CLAUDE.md`) so my own steering docs or MCP config aren't silently overwritten.
9. As a **Kiro IDE user**, I want a Kiro-native way to invoke each agent's specific mode (e.g. `product-engineer-init` vs. `-feature` vs. `-issue`, `planner` vs. `planner-resume`), preserving the intent of `.github/prompts/*.prompt.md` even if Kiro hosts it differently (e.g. folded into the agent file itself).

## Functional Requirements

1. The system **MUST** add a `.kiro/agents/*.md` file for each of the 8 agents defined by `.github/agents/*.agent.md` (`product-engineer`, `developer`, `planner`, `technical-writer`, `housekeeping`, `github-ops`, `ux-engineer`, `black-box-tester`), with content (identity, responsibilities, process) sourced from the `.github/` version, translated into Kiro's agent frontmatter schema (`description`, `model`, `tools`, `mcpServers`, `permissions`).
2. Because Kiro subagents cannot spawn further nested subagents (confirmed against Kiro's docs), the system **MUST** structure the agents that need to delegate (at minimum `product-engineer` and `planner`, which orchestrate the other 6) so they run as Kiro's active/main agent with `subagent` included in `tools`, while the delegated-to agents remain invocable as plain subagents. `.claude/`'s existing command-vs-subagent split **MAY** be used as the structural reference for how to solve this, but the resulting Kiro agent content **MUST** still trace back to `.github/agents/`.
3. The system **MUST** add a `.kiro/skills/<name>/SKILL.md` for each of the 12 skills defined by `.github/skills/` (the canonical shape — `plan` and `implement` are **excluded** here since they are instructions, not skills, in `.github/`), reusing the existing SKILL.md content with only the adaptations required by Kiro's skill-loading conventions (e.g., `skill://` path expectations).
4. The system **MUST** add `.kiro/steering/*.md` file(s) representing the 3 files in `.github/instructions/` (`plan.instructions.md`, `implement.instructions.md`, `domain/nextjs-pages-components.instructions.md`), using Kiro's `inclusion: always|fileMatch|manual` frontmatter to preserve the current always-loaded vs. `applyTo`-scoped behavior.
5. The system **MUST** resolve, at spec time, how the 12 `.github/prompts/*.prompt.md` entry points (including multi-mode agents like `product-engineer-init/-feature/-issue` and `planner`/`planner-resume`) are represented for Kiro — either as Kiro-hosted prompt files (if a filesystem convention is confirmed to exist) or folded into the relevant `.kiro/agents/*.md` body/description — such that no invocation mode present in `.github/prompts/` is lost.
6. The system **MUST** add a `.kiro/hooks/*.json` best-effort guard implementing whatever subset of the `git-guard.sh` behavior (block/deny push or merge to `main`, enforce Conventional Commits) Kiro's declarative hook trigger model actually supports. Where Kiro cannot express a hard block, the hook **MUST** implement the closest available warning/lint behavior instead of being silently omitted.
7. The system **MUST** document, in both the Kiro-facing steering docs and the top-level README, that Kiro's guard enforcement is weaker than Claude Code's `git-guard.sh` (event-triggered/advisory vs. PreToolUse deny), and that human PR review is the backstop for the `main`-merge and commit-convention rules on Kiro.
8. The system **MUST** extend `bundle-manifest.json`'s `managed_paths` with entries for `.kiro/agents`, `.kiro/skills`, `.kiro/steering`, and `.kiro/hooks`, following the same `pattern`/`recursive` structure as the existing Claude Code entries.
9. The system **MUST** extend `bundle-manifest.json`'s `consumer_owned_paths` (or an equivalent Kiro-specific list) to exclude any Kiro files a consumer repo is expected to own directly (e.g. `.kiro/settings/mcp.json`, `.kiro/specs/` feature content), mirroring how `AGENTS.md`/`CLAUDE.md`/`.claude/settings.json` are excluded today.
10. The system **MUST** update `dev-tasks.sh` so `install`, `update`, `check`, `list`, and `version` correctly place, report, and diff the new `.kiro/` managed paths, with no behavior change required from the consumer beyond running the existing commands.
11. The system **MUST** update `scripts/build-bundle.sh` to include `.kiro/` managed content in the release tarball, and `.github/workflows/release-bundle.yml`'s smoke test to verify `.kiro/` files are present in a built bundle.
12. The system **MUST** update `README.md` (agent/skill/instruction/prompt tables, "After install, your repo contains" tree, managed file surface table) and `AGENTS.md`/`AGENTS.md.template`/`CLAUDE.md.template` to describe Kiro as a first-class third platform alongside Copilot and Claude Code.
13. The system **SHOULD** provide a translation note or mapping table (in the spec, not necessarily user-facing) documenting, per agent, which Kiro frontmatter fields (`tools`, `permissions`, `mcpServers`) were chosen and why, so future maintainers can keep the Kiro agents in sync when Claude/Copilot agents change.
14. Content for `.kiro/agents`, `.kiro/skills`, `.kiro/steering`, and `.kiro/hooks` **MUST** be maintained as independent files (not generated/deduped from a shared source), consistent with how `.github/` and `.claude/` are maintained today.
15. The system **MUST** extend `dev-tasks.sh`'s existing `--profile <copilot|claude|both>` flag with a `kiro` value (installing only the Kiro tree) and an `all` value (installing all three), without changing what the current `both` value or the default (no flag) installs — see Open Question 3.

## Business Rules

- `.kiro/` managed files follow the same ownership split as the existing two platforms: `dev-tasks.sh` may overwrite anything under the declared `managed_paths`, and must never touch files a consumer repo is expected to own (analogous to `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`).
- Kiro's weaker hook enforcement **MUST NOT** be presented as equivalent to `git-guard.sh` — documentation must state the gap explicitly rather than imply parity that doesn't exist.
- The Kiro platform targets the **Kiro IDE** conventions only in this iteration; Kiro CLI-specific conventions are out of scope (see Non-Goals).

## Data Requirements

Not applicable — this feature adds/modifies configuration and documentation files (Markdown, YAML frontmatter, JSON) only; no runtime data model or storage is introduced.

## Non-Goals (Out of Scope)

- Kiro **CLI** conventions (as distinct from the Kiro IDE conventions used throughout this PRD) — CLI-specific steering/agent/hook formats are not covered.
- A shared/deduped single-source content pipeline across `.github/`, `.claude/`, and `.kiro/` skills — each platform keeps independent copies, per the locked-in decision.
- `.kiro/specs/` content generation (i.e., teaching `dev-tasks` agents to write into Kiro's own spec format for a *user's* feature work) — this PRD only ships the Kiro-native agents/skills/steering/hooks; whether those agents themselves choose to write `.kiro/specs/*` artifacts when running under Kiro is an implementation-time detail, not a new deliverable here.
- Any change to how MCP servers are configured for Kiro users (`.kiro/settings/mcp.json` is a consumer-owned file, untouched by `dev-tasks.sh`).
- Automated behavioral testing inside the actual Kiro IDE (no CI access to Kiro) — verification is limited to structural/format checks and manual maintainer review.

## Design Considerations

Not applicable — no end-user UI is introduced. `/DESIGN.md` is not impacted.

## Technical Considerations

- **Format translation risk is uneven across surfaces.** Skills (`SKILL.md`) are nearly a direct copy given the shared `agentskills.io` format; agents require real schema translation (Claude's agent frontmatter vs. Kiro's `tools`/`permissions`/`mcpServers`); steering docs require choosing correct `inclusion` modes per file; hooks require the largest behavioral compromise.
- **Bundle build must stay single-version.** All three platforms **MUST** continue to ship from one version number / one release tarball — no separate Kiro release cadence.
- **`dev-tasks.sh` diffing logic** (used by `update --dry-run` and `check`) must be extended path-by-path for the new managed paths; reuse the existing per-path diff mechanism rather than introducing a parallel one.
- Dependency: relies on the documented Kiro IDE conventions holding as researched (steering, specs, agents, skills, hooks, mcp.json) — Kiro's official docs blocked automated fetching during research; findings were corroborated via web search across multiple `kiro.dev/docs/*` pages plus third-party write-ups, and **SHOULD** be spot-checked against a live Kiro IDE install during spec/implementation.

## Acceptance Criteria

1. Running `./dev-tasks.sh install` in a clean repo places files under `.kiro/agents/`, `.kiro/skills/*/SKILL.md`, `.kiro/steering/`, and `.kiro/hooks/`, matching the paths declared in `bundle-manifest.json`.
2. `.kiro/agents/` contains one file per agent defined by `.github/agents/*.agent.md` (8 total), each with valid Kiro frontmatter (`description` required at minimum) and a non-empty prompt body whose content traces back to the `.github/agents/` source (using `.claude/`'s command/subagent split only as a structural pattern for the delegating agents, per FR #2).
3. `.kiro/skills/` contains one directory per skill defined by `.github/skills/` (12 total, excluding `plan`/`implement` which are steering docs per FR #4) each with a `SKILL.md`.
4. `.kiro/agents/` and/or the Kiro-hosted prompt representation collectively cover all 12 invocation modes from `.github/prompts/*.prompt.md` — none dropped (FR #5).
5. `.kiro/steering/` contains files covering `plan`, `implement`, and the Next.js domain instruction, each with an explicit `inclusion` frontmatter value that preserves current always-loaded vs. scoped semantics.
6. `.kiro/hooks/` contains at least one hook file implementing the best-effort main-branch/commit-message guard, and README/steering documentation explicitly states the enforcement gap versus `git-guard.sh`.
7. `./dev-tasks.sh list` reports the new `.kiro/` paths and file counts.
8. `./dev-tasks.sh check` and `update --dry-run` correctly detect and report changes to `.kiro/` managed files without affecting the existing `.github/`/`.claude/` diff behavior.
9. `scripts/build-bundle.sh` output tarball contains the `.kiro/` files, and the release workflow's smoke test passes with them included.
10. `README.md`, `AGENTS.md`, `AGENTS.md.template`, and `CLAUDE.md.template` list Kiro as a supported platform with an accurate file tree and managed-path table.
11. No existing `.github/` or `.claude/` managed path, install behavior, or hook behavior regresses.

## Success Metrics

- `dev-tasks.sh install`/`update` succeed against a repo with no prior `.kiro/` directory and against a repo with a pre-existing (consumer-owned) `.kiro/settings/mcp.json`, without data loss in either case.
- All 8 `.github/agents/` agents and all 12 `.github/skills/` skills have a corresponding, non-empty Kiro artifact (zero silent omissions).
- Release smoke test remains green after adding the third platform to the bundle.

## Assumptions

- The researched Kiro IDE conventions (steering, specs, agents, skills, hooks, mcp.json paths and formats) are accurate as of this PRD's writing; kiro.dev blocked direct automated fetches, so findings were triangulated via web search rather than a direct docs read. This **MUST** be validated against a live Kiro install (or the most current Kiro docs snapshot obtainable) at spec time before implementation begins.
- Kiro's custom-agent and skill hot-reload behavior means no additional "registration" step beyond placing files under `.kiro/agents/` and `.kiro/skills/` is required for a workspace to pick them up, once the workspace is trusted.
- Consumer repos installing the Kiro bundle are expected to separately have Kiro IDE installed; `dev-tasks.sh` does not install or configure Kiro itself.

## Constraints & Dependencies

- No CI access to a real Kiro IDE instance for end-to-end verification; validation is structural (file presence, frontmatter well-formedness, content fidelity to source) plus manual review, not live agent-invocation testing.
- Must not break the existing single-version-number release model or the existing `.github/`/`.claude/` install/update paths.

## Security & Compliance

- No new secrets, credentials, or auth flows are introduced. `.kiro/settings/mcp.json` (which can carry environment-variable-based secrets) is explicitly out of scope and consumer-owned, never written by `dev-tasks.sh`.
- No change to existing repository access or GitHub permissions model.

## Open Questions

1. `product-engineer` and `planner` will need to run as Kiro's active/main agent (with `subagent` in `tools`) to delegate to the other 6, per FR #2 — but should each of the 6 delegated agents (`developer`, `technical-writer`, `housekeeping`, `github-ops`, `ux-engineer`, `black-box-tester`) also get a *second*, directly-selectable `.kiro/agents/*.md` entry for interactive standalone use (mirroring `.claude/`'s dual-role pattern where e.g. `developer` exists as both a command and a subagent), or is a single subagent-only file sufficient for Kiro? Deferred to spec — needs a concrete look at Kiro's agent-selector UX and whether a subagent-only file can still be manually selected as the active agent.
2. Does Kiro's hook trigger set include anything closer to a pre-command gate (vs. purely post-event triggers like `PostFileSave`) that research didn't surface? Worth a direct check against Kiro's hook-types reference before finalizing the hook design in the spec.
3. `dev-tasks.sh` already has `--profile <copilot|claude|both>` (default `both`). Confirmed in code (`dev-tasks.sh`): adding `kiro` as a third value is straightforward, but the **default** behavior needs a decision — should `--profile` (no flag) install all three platforms once Kiro ships (silently changing what a bare `install`/`update` does for existing users), or should Kiro require an explicit `--profile kiro` / `--profile all` opt-in while `both`/default stays Copilot+Claude only for backward compatibility? Recommend keeping `both` meaning exactly Copilot+Claude (unchanged), and adding `--profile kiro` plus a new `--profile all` value for all three — but this needs explicit sign-off since it's a behavior-affecting default choice.
