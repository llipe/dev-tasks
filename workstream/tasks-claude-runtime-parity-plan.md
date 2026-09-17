# Implementation Plan - Claude Runtime Parity and Enforcement Delivery

Source: two review passes over `.claude/` (tooling/guardrails/token profile, then three-way platform parity against `.kiro/` and `.github/`). No PRD or GitHub Issue exists yet — see "GitHub sync" below.

**Theme:** every finding here has one root cause. The `.claude` tree's *contracts* are at parity with Kiro and Copilot; its *runtime bindings* are not. Enforcement Claude expresses through a consumer-owned file (`.claude/settings.json`, `CLAUDE.md`) is undeliverable, while Kiro expresses the same things through managed paths and ships them working. Task 1 is the unblocker: tasks 2 and 6 produce nothing a consumer can use until it lands.

Sequencing: 1 → 2, 1 → 6b, 1 → 9 → 10. Task 11 is prompt-level and independent, but should land with or after 9 so its guidance matches the corrected guard. Tasks 3, 4, 5, 7 are independent and may run in any order. Task 8 depends on 1, 2, and 3 because it asserts their installed state.

**Tasks 9-11 were added after a reported `/planner` symptom:** story branches arriving on the integration branch with no PR review trail. Root cause confirmed — `git-guard.sh` blocks the merge command `planner` is mandated to run, and permits the unreviewed alternative. They are the highest-priority items in this list after task 1.

Each parent task is one PR on an `issue/*` branch. Per repository default, every parent task begins with a failing test.

> **Note — scope.** This list covers original-review items 2-4 and all five parity recommendations. Two findings are deliberately **excluded** and remain open:
>
> - **Developer-subagent gate ownership** (original blocking defect #1). The `developer` subagent declares no `Task` tool (`.claude/agents/developer.md:4`) but carries seven MUST-level rules to invoke `verifier`, `qa-engineer`, `technical-writer`, `github-ops`, and `researcher`. Under `/planner` delegation those gates cannot execute, and `planner`'s merge gate (`.claude/commands/planner.md:413`) validates a `verifier_audit: run` string the developer writes about itself. This is a design change to where gates are owned, not a binding fix. **Task 7 collides with it — see the decision point there.**
> - **Wiring `dt ctx assemble` into the agents.** A design question, not a defect.

> **Note — the `gh pr merge` guard defect was promoted out of task 2.** It began as an optional addition and is now **task 9**, confirmed as the cause of an observed `/planner` failure. Task 2 covers `branch-guard` only.

## Relevant Files

- `templates/claude/settings.json` - new; the PreToolUse hook wiring and permission allowlist a consumer install must deliver
- `.claude/settings.json` - this repo's own copy; kept in sync with the template
- `.claude/hooks/branch-guard.sh` - new; port of `.kiro/hooks/scripts/branch-guard.sh`
- `.claude/hooks/git-guard.sh` - rule 3 base resolution, raw-git escape, `--admin`/`--auto`, dynamic default branch, rule 4 false positive
- `.claude/commands/planner.md` - post-merge verification, blocked-guard error handling
- `.claude/agents/github-ops.md` - MCP equivalents for mutating operations, merge authority
- `.claude/skills/activity-init/SKILL.md` - branch protection as a setup step
- `.kiro/hooks/scripts/branch-guard.sh`, `.kiro/hooks/git-guard.json` - port source and wiring reference
- `core/distribution/profiles.ts` - `PROFILE_PATHS`, `ROOT_FILES`, install-if-absent set
- `core/distribution/install.ts` - root-file and template install semantics
- `core/distribution/doctor.ts` - new check: Claude hooks wired
- `bundle-manifest.json` - `managed_paths`, `consumer_owned_paths`
- `package.json` - `files[]` (ship templates)
- `CLAUDE.md.template`, `AGENTS.md.template` - consumer-facing root context, currently unshipped
- `.claude/agents/developer.md` - remove the Kiro-ism; closeout-payload honesty (task 7)
- `.claude/commands/developer.md` - collapse to a thin wrapper
- `.claude/agents/{github-ops,housekeeping,technical-writer,researcher}.md` - `model:` frontmatter
- `.claude/skills/implement/SKILL.md` - explicit skill-invocation step
- `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/system-overview.md` - registry and install-doc updates
- `.github/instructions/domain/nextjs-pages-components.instructions.md`, `.kiro/steering/nextjs-pages-components.md` - parity source for task 4
- `docs/adr/ADR-006-claude-settings-ownership.md` - new; distribution-ownership decision
- `test/unit/claude-hooks-wiring.test.ts` - new; hook wiring and matcher coverage
- `test/unit/git-guard-merge.test.ts` - new; git-guard rules 1 and 3 (currently only rule 4 is tested)
- `test/unit/claude-tool-declaration-parity.test.ts` - new; agents declare the tools their prompts require
- `test/integration/install-parity.test.ts` - new; per-profile installed-state equivalence
- `test/unit/distribution-install.test.ts`, `test/unit/distribution-update.test.ts`, `test/unit/distribution-profiles.test.ts` - extend for the new path category
- `test/unit/nextjs-claude-parity-claim.test.ts` - new; CP-04 repo-wide scan that the withdrawn Next.js/Claude scaffolding claim is not repeated anywhere
- `test/unit/developer-command-collapse.test.ts` - new; CP-05 size-cap and no-restatement checks for the collapsed `.claude/commands/developer.md`, plus Kiro-activation-marker absence checks on the `developer` agent/command pair
- `test/unit/architecture-change-parity.test.ts`, `test/unit/cross-repo-partitioning-parity.test.ts`, `test/unit/infra-engineer-parity.test.ts`, `test/unit/qa-testing-standard.test.ts` - updated; `.claude/commands/developer.md` is no longer asserted to carry the full agent contract text, only a pointer to it
- `test/unit/model-tiers-permission-allowlist.test.ts` - new; CP-06 `model:` frontmatter set/tier assertions, `permissions.allow` content and write-pattern scan, guard-still-blocks-with-allowlist-active check (task 6.0)

## Tasks

- [x] 1.0 Make `.claude/settings.json` deliverable (unblocker for tasks 2 and 6b) — [#169](https://github.com/llipe/dev-tasks/issues/169)

  > Note: `PROFILE_PATHS.claude` installs `.claude/hooks/` (the scripts) but `.claude/settings.json` — which wires them — is listed in `bundle-manifest.json:126` `consumer_owned_paths`. It is never installed, has no template, and `doctor` does not check it. The `kiro` profile installs `.kiro/hooks/` recursively, which includes `git-guard.json`, the wiring. Result: Kiro consumers get two live hooks; Claude consumers get two inert shell scripts that look installed. Copilot has no hook system at all, so Kiro is currently the only platform with working deterministic enforcement.
  >
  > **Scope note (execution):** per explicit direction at execution time, `templates/claude/settings.json` ships with a valid, empty-but-documented structure (`hooks.PreToolUse: []`, `permissions.allow: []`) in this task. The `PreToolUse` wiring content and `permissions.allow` contents are populated by tasks 2.0 and 6.0 (6b) respectively, not here. AC 1.9's literal "wires every shipped hook script" is therefore satisfied at the delivery-mechanism level by this task; the wiring *content* lands with task 2.0.

  - [x] 1.1 Write `test/unit/distribution-profiles.test.ts` additions asserting the Claude profile resolves a settings source and that `.claude/settings.json` is no longer in `consumer_owned_paths`; confirm it fails
  - [x] 1.2 Decide and record the ownership semantics in `docs/adr/ADR-006-claude-settings-ownership.md`: **install-if-absent**, not managed-overwrite. Rationale: a consumer's `permissions.allow` and any local hooks must survive `install` and `update`, so the unconditional-overwrite behaviour used for `ROOT_FILES` is wrong here. Include Context / Decision / Consequences / Alternatives per `AGENTS.md`
  - [x] 1.3 Create `templates/claude/settings.json` with a valid, empty-but-documented structure (`PreToolUse`/`permissions.allow` populated in tasks 2.0/6b, not here)
  - [x] 1.4 Add `templates/claude` to `bundle-manifest.json` `managed_paths`, alongside the existing `templates/infra`, `templates/scripts`, `templates/workflows` entries
  - [x] 1.5 Implement install-if-absent in `core/distribution/install.ts`: a new path category that writes the target only when it does not already exist, distinct from `ROOT_FILES` (which overwrites). Wire `templates/claude/settings.json` → `.claude/settings.json` for the `claude` profile
  - [x] 1.6 Remove `.claude/settings.json` from `consumer_owned_paths`; confirm `update` still never clobbers a consumer-modified copy under the new semantics
  - [x] 1.7 Add a `doctor` check in `core/distribution/doctor.ts`: when `.claude/hooks/*.sh` exist but `.claude/settings.json` declares no matching `PreToolUse` entry, report a warning naming the unwired scripts
  - [x] 1.8 Add `templates/` coverage to `package.json` `files[]` if not already complete for the new directory (already complete — `templates/` covers `templates/claude/`)
  - [x] 1.9 Verify Acceptance Criterion: `dev-tasks install --profile claude` into an empty temp dir produces a `.claude/settings.json` that wires every shipped hook script (delivery mechanism verified; wiring content lands with task 2.0 per scope note above)
  - [x] 1.10 Verify Acceptance Criterion: re-running `install` and running `update` against a consumer-modified `.claude/settings.json` leaves it byte-identical
  - [x] 1.11 Verify Acceptance Criterion: `doctor` warns on a hooks-present / settings-absent repo and is silent on a correctly wired one
  - [x] 1.12 Run Tests: `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`

- [x] 2.0 Restore deterministic enforcement on Claude (depends on 1.0) — [#170](https://github.com/llipe/dev-tasks/issues/170)

  > Note: `.claude/settings.json` currently matches `Bash` only. Claude Code writes files through `Edit`/`Write`, never the shell, so `git-guard.sh` never observes a single file write. `AGENTS.md:91` and `README.md:312` both document `branch-guard` as active; it exists only under `.kiro/`. Writes on `main` are today defended by prompt language alone — precisely the bypass the hook was written to backstop.

  - [x] 2.1 Write `test/unit/claude-hooks-wiring.test.ts`: assert `templates/claude/settings.json` registers `git-guard.sh` on `Bash` and `branch-guard.sh` on `Edit|Write|NotebookEdit`, and that both scripts exist and are executable; confirm it fails
  - [x] 2.2 Port `.kiro/hooks/scripts/branch-guard.sh` to `.claude/hooks/branch-guard.sh`, preserving fail-open behaviour on a missing/unavailable git repo. Drop the Kiro-specific `toolArgs` limitation comment; the script depends only on the current branch
  - [x] 2.3 Register both hooks in `templates/claude/settings.json` and in this repo's `.claude/settings.json`
  - [x] 2.4 Verify Acceptance Criterion: an `Edit` or `Write` attempted while on `main` is blocked with the branch-guard message; the same call on an `issue/*` branch passes
  - [x] 2.5 Verify Acceptance Criterion: `AGENTS.md` and `README.md` hook tables describe the shipped Claude state accurately
  - [x] 2.6 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [x] 3.0 Deliver Claude root context to consumers — [#171](https://github.com/llipe/dev-tasks/issues/171)

  > Note: `ROOT_FILES` is `["DESIGN.md", "TESTING.md"]` (`core/distribution/profiles.ts:56`). Nothing in `core/`, `adapters/`, `bin/`, or the README installs `CLAUDE.md` or `AGENTS.md`, and the `.template` files do not ship in `package.json` `files[]`. Kiro's equivalent always-on layer, `.kiro/steering/git-guard-notice.md` (`inclusion: always`), is a managed path and installs automatically. A Claude consumer therefore gets no project memory at all: no agent guidelines, no branch discipline, no workflow map. This is invisible from inside this repo because `CLAUDE.md` is checked in here.

  - [x] 3.1 Write `test/integration/install-parity.test.ts` (first slice): assert `install --profile claude` into a temp dir produces a `CLAUDE.md`; confirm it fails
  - [x] 3.2 Ship `CLAUDE.md.template` and `AGENTS.md.template` in `package.json` `files[]`
  - [x] 3.3 Install `CLAUDE.md` (from `CLAUDE.md.template`) and `AGENTS.md` (from `AGENTS.md.template`) using the install-if-absent category built in 1.5, so a consumer's filled-in copy is never overwritten
  - [x] 3.4 Confirm both templates carry the git invariants that `.kiro/steering/git-guard-notice.md` provides always-on, so the two platforms deliver equivalent standing guidance
  - [x] 3.5 Update the README install section to state what each profile delivers, including the root context files
  - [x] 3.6 Verify Acceptance Criterion: a fresh `install --profile claude` yields a repo where Claude Code loads project memory on the first turn
  - [x] 3.7 Verify Acceptance Criterion: an existing consumer `CLAUDE.md` survives `install` and `update` unchanged
  - [x] 3.8 Run Tests: `pnpm run test:integration`, `pnpm run validate`

- [x] 4.0 Resolve the Next.js conventions parity claim — [#172](https://github.com/llipe/dev-tasks/issues/172)

  > Note: Copilot delivers these via `applyTo`, Kiro via `fileMatch`. `CLAUDE.md` claims they are "preserved as a nested `CLAUDE.md` inside each React app's root directory when that app exists" — grep across `core/`, `adapters/`, `templates/`, and `.claude/` finds no code that creates it. The claim documents a feature that does not exist.
  >
  > **Decided 2026-09-16: withdraw.** Building real detection ("each React app root" in an arbitrary consumer monorepo — single app, `apps/*`, Turborepo/Nx workspaces, `next` dependency vs. `next.config.js` detection, keeping scaffolded copies in sync with the source instructions file over time) is a distinct feature with its own design questions, not a one-task fix, and it doesn't belong bundled into a parity milestone whose other nine tasks are mechanical enforcement-delivery fixes. The harm today is the false claim, not the missing feature; withdrawing removes that harm immediately and doesn't foreclose a future standalone feature request for real scaffolding.

  - [x] 4.1 ~~Decide: scaffold a nested `CLAUDE.md` during `install` when a Next.js app root is detected, **or** withdraw the claim and document the platform limitation explicitly.~~ Decided: withdraw
  - [x] 4.2 Correct the "Domain-Specific Conventions" section of `CLAUDE.md` and `CLAUDE.md.template` to state that the Next.js conventions have no automatic Claude delivery, and give consumers the one-line manual step (copy the conventions into their app's nested `CLAUDE.md`)
  - [x] 4.4 Reflect the outcome in the `AGENTS.md` Instructions table, which currently lists `nextjs-pages-components` without noting the Claude gap
  - [x] 4.5 Verify Acceptance Criterion: no file in the repository claims a Claude delivery mechanism that does not exist
  - [x] 4.6 Run Tests: `pnpm run test:unit`, `pnpm run format:check`

- [x] 5.0 Remove the Kiro-ism and collapse the `developer` command duplication — [#173](https://github.com/llipe/dev-tasks/issues/173)

  > Note: `.claude/agents/developer.md:53-55` carries a "Steering Context Check" instructing the agent to "load the implement steering by opening the relevant task file first." That is Kiro `fileMatch` semantics; on Claude, opening a file loads no skill. The instruction is inert and tells the agent a mechanism exists that does not. It appears in the agent but not the command — one instance of a broader drift: `.claude/commands/developer.md` (21.8 KB) is a near-verbatim copy of `.claude/agents/developer.md` (23.9 KB), 81 differing lines across ~600, and they have already diverged (the agent has the hard branch gate at step 4 and the `--scope related` memo search; the command has neither). `/github-ops` is 681 bytes and is the right shape.

  > Scope note (5.7): `.claude/commands/product-engineer.md:68` carries its own separate "Steering Context Check" block. It is not in this task's Relevant Files and is out of scope for #173 — narrowed per explicit instruction to keep this task confined to the `developer` duplication issue. 5.7 is verified against `.claude/agents/developer.md` and `.claude/commands/developer.md` only.

  - [x] 5.1 Write a test asserting `.claude/commands/developer.md` stays under a size cap and contains no restatement of the Non-Negotiable Operating Rules; confirm it fails
  - [x] 5.2 Delete the "Steering Context Check" block from `.claude/agents/developer.md`
  - [x] 5.3 Add an explicit skill invocation as step 0 of the developer execution flow — invoke the `implement` skill directly rather than relying on file-open activation — in both the agent and the command
  - [x] 5.4 Collapse `.claude/commands/developer.md` to a thin wrapper on the pattern of `.claude/commands/github-ops.md`: frontmatter, `$ARGUMENTS`, step-gated default, and a pointer to the `developer` agent contract plus the `implement` skill
  - [x] 5.5 Audit the remaining agent/command pairs for the same duplication and confirm none other restates its agent body
  - [x] 5.6 Verify Acceptance Criterion: `/developer` and the `developer` subagent resolve to one behavioural contract with no divergent copy
  - [x] 5.7 Verify Acceptance Criterion: no `.claude` file references Kiro steering, `fileMatch`, or `applyTo` activation semantics (scoped to `developer` agent/command per scope note above)
  - [x] 5.8 Verify Acceptance Criterion: existing `developer` parity tests still pass against the reduced command file
  - [x] 5.9 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 6.0 Cost controls: subagent models and permission allowlist — [#174](https://github.com/llipe/dev-tasks/issues/174)

  > Note: none of the eight `.claude/agents/*.md` declares `model:`, so every delegated run — including mechanical ones — inherits the main-thread model. And `.claude/settings.json` has no `permissions` block, so every `git status`, `pnpm test`, and `gh pr view` raises a prompt, which is what makes "pre-approved autonomous sequential" feel non-autonomous. 6b depends on task 1.

  > **Fix (post-audit, PR #186 D-1):** `verifier`'s Audit Mode pass against PR #186 (`workstream/fidelity-report-174.md`) found that `Bash(git branch:*)` in `permissions.allow` is a plain prefix match, so it also silently pre-approved `git branch -D <name>` (delete) and `git branch -m <old> <new>` (rename) alongside the intended listing form — real write operations with no confirmation prompt and no `git-guard.sh` backstop. Claude Code's permission syntax has no sub-flag-exclusion form within a single prefix rule, so `git branch` was dropped from `permissions.allow` in both `.claude/settings.json` and `templates/claude/settings.json` entirely rather than mis-scoped; branch state remains visible via the already-allowed `git status` and `git rev-parse --abbrev-ref HEAD`. `test/unit/model-tiers-permission-allowlist.test.ts` gained a regression check (`allowlistEntryMatches` + two `it`s per settings file) proving `git branch -D`/`-m` are not matched by any final allowlist entry — written first against the unfixed allowlist and confirmed failing before the fix landed.

  - [x] 6.1 Write a test asserting every `.claude/agents/*.md` declares a `model:` value from the allowed set; confirm it fails
  - [x] 6.2 Add `model:` frontmatter to the four mechanical agents — `github-ops`, `housekeeping`, `technical-writer`, `researcher` — selecting a smaller model per agent. Leave `developer`, `verifier`, `qa-engineer`, and `ux-engineer` on the inherited model, where judgement quality dominates cost
  - [x] 6.3 Confirm the model identifiers used are current and valid before committing; do not carry a model name into any other repository artifact
  - [x] 6.4 **(6b — depends on 1.0)** Populate `permissions.allow` in `templates/claude/settings.json` with read-only and quality-gate commands the workflow runs constantly: `git status`, `git diff`, `git log`, `git rev-parse`, `git branch`, `pnpm run lint`, `pnpm run test`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run audit`, `gh pr view`, `gh issue view`. Exclude every write path so the guards still bind
  - [x] 6.5 Mirror the allowlist into this repo's `.claude/settings.json`
  - [ ] 6.6 Verify Acceptance Criterion: a delegated `github-ops` or `researcher` run executes on the smaller model (manual/observational — see PR #186 known limitations; not assertable by a unit test per test-plan CP-06)
  - [x] 6.7 Verify Acceptance Criterion: no allowlisted command can push, merge, commit, tag, or write a file
  - [x] 6.8 Verify Acceptance Criterion: the hook guards still block their four invariants with the allowlist active
  - [x] 6.9 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 7.0 Tool-declaration parity test — **contains a decision point** — [#175](https://github.com/llipe/dev-tasks/issues/175)

  > Note: `test/unit/qa-engineer-parity.test.ts:162` and `test/unit/researcher-parity.test.ts:139` assert only that a `tools:` line *exists*, never which tools. Nothing mechanically catches an agent whose prompt requires a capability its frontmatter withholds. The invariant — *every agent whose prompt instructs it to invoke a subagent must declare `Task`* — is four lines and would have caught the `developer` defect at authoring time.
  >
  > **It cannot pass today.** `developer` violates it. The full gate-ownership redesign (relocating every `developer` MUST-level delegation rule) stays excluded — see the top-of-file note — but this task now also closes the one hole 7.1(a) would otherwise open: once `developer`-as-subagent stops self-certifying `verifier_audit`/`coverage_gate`, nothing else runs those gates per-story under `/planner` unless `planner` triggers them itself (see 7.6). Resolve 7.1 before writing the assertions.

  - [ ] 7.1 **Decision.** Choose one:
        **(a) Recommended — make the prompt honest.** Strip the impossible invocation claims from `.claude/agents/developer.md` (rules 10, 18, 22 and the `researcher` troubleshooting path), have the subagent emit `verifier_audit: not-run(no-delegation)` and `coverage_gate: SKIPPED(no-delegation)`, and note in the file that these gates are owned by the caller. This is a small, self-contained subset of the excluded fix; it makes the test green honestly and stops `/planner` from merging on a self-certified string. It does **not** by itself relocate the gates to `planner` — that remains open.
        **(b) Land the test as a documented expected failure** tied to a tracking issue for the gate-ownership change. Keeps scope tight; leaves a red test in the suite.
        Do not write the test until this is decided — option (b) changes what the file asserts.
  - [ ] 7.2 Write `test/unit/claude-tool-declaration-parity.test.ts`: parse each `.claude/agents/*.md`, extract the declared `tools:` list, scan the body for instructions to invoke a named subagent, and assert `Task` is declared whenever such an instruction is present
  - [ ] 7.3 Extend it with the inverse check: no agent declares a tool its prompt never uses, to keep tool grants minimal
  - [ ] 7.4 Apply the 7.1 outcome to `.claude/agents/developer.md`
  - [ ] 7.5 If 7.1(a): update `.claude/commands/planner.md` merge gate 6 so it no longer treats `verifier_audit: run` as sufficient evidence
  - [ ] 7.6 **Scoped gate-ownership fix (decided in place of a separate tracking issue).** Once `developer`-as-subagent honestly reports `not-run`/`SKIPPED` (7.1a), the mandatory per-story `qa-engineer` coverage check and `verifier` audit stop happening anywhere in the `/planner` path — Phase 5's PRD-level rollup is the only remaining real invocation. `planner` is the only actor in this path that holds the `Task` tool (it runs in the main thread; `developer`-as-subagent does not and structurally cannot invoke another subagent). Close this gap — without taking on the excluded full gate-ownership redesign — by editing `.claude/commands/planner.md`'s per-story merge management rule (Phase 4) so that, after each story's `developer` subagent reports its closeout payload, `planner` itself invokes `qa-engineer` and `verifier` (Audit Mode) directly, scoped to that story's diff/branch/PR, and records their actual results. Merge gates 5 and 6 then check the result `planner` itself obtained, not a self-reported field
  - [ ] 7.7 Verify Acceptance Criterion: the test fails when `Task` is removed from an agent whose prompt requires it
  - [ ] 7.8 Verify Acceptance Criterion: the suite is green, or the single expected failure is documented and linked (per 7.1)
  - [ ] 7.9 Verify Acceptance Criterion: a `/planner` dry run against a story shows `qa-engineer` and `verifier` invoked directly by `planner` per story, not merely reported by `developer`
  - [ ] 7.10 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 8.0 Installed-state parity test (depends on 1.0, 2.0, 3.0) — [#176](https://github.com/llipe/dev-tasks/issues/176)

  > Note: every existing parity test asserts files exist *in this repository*. None asserts that `install --profile claude` produces an install functionally equivalent to `install --profile kiro`. That is the exact blind spot all four delivery gaps fell through — each platform's files were present and correct in-tree, and only the installed result diverged.

  - [ ] 8.1 Complete `test/integration/install-parity.test.ts`: install each profile into a separate temp dir and compare *enforcement surface*, not file counts
  - [ ] 8.2 Assert per profile: hooks present **and wired** to a runtime trigger; always-on context present (`CLAUDE.md` for Claude, `inclusion: always` steering for Kiro); scoped execution rules reachable (`implement` and `plan`, by whatever mechanism the platform uses)
  - [ ] 8.3 Assert the documented intentional asymmetries hold and do not silently widen: `infra-engineer`, `planner`, and `product-engineer` as Claude commands rather than agents; `verifier` as two commands; the merged `planner-resume` and three `product-engineer` entry points
  - [ ] 8.4 Assert every consumer-owned path is either installed from a template or explicitly documented as consumer-supplied, so nothing else can fall into the settings.json trap
  - [ ] 8.5 Verify Acceptance Criterion: the test fails if `.claude/settings.json` is removed from the install path
  - [ ] 8.6 Verify Acceptance Criterion: the test fails if a hook script is shipped without a matching trigger registration
  - [ ] 8.7 Verify Acceptance Criterion: the test passes for all three profiles and for `--profile all`
  - [ ] 8.8 Run Tests: `pnpm run test:integration`, `pnpm run validate`

- [x] 9.0 Fix the `planner` merge path (depends on 1.0) — **confirmed live defect** — [#177](https://github.com/llipe/dev-tasks/issues/177)

  > Note: observed symptom — story branches land on the integration branch with no PR review trail. Cause: `git-guard.sh:60-66` blocks any `gh pr merge` lacking `--base`; `gh pr merge` has no `--base` flag (it belongs to `gh pr create`), and the repository's own canonical merge commands carry none (`.claude/skills/git-ops/SKILL.md:101`, `.claude/agents/github-ops.md:49`). So `planner`'s mandated merge command is unconditionally blocked, while `git checkout integration && git merge story/… && git push origin integration` is fully permitted — rule 1 only blocks `git merge` when HEAD is `main`, and the push is not to `main`. **The guard blocks the reviewable path and permits the unreviewable one.** A `--squash` raw merge also rewrites commits, so GitHub never marks the PR merged: the state file records `✅ Merged` while the PR sits open. That divergence is the diagnostic signature.

  - [x] 9.1 Write `test/unit/git-guard-merge.test.ts` covering rules 1 and 3, which have no coverage today (only rule 4 / tags is tested): a story-PR merge into an integration branch (must pass), a PR merge into `main` (must block), a `git merge` of a `story/*` branch into `integration/*` (must block after 9.4), a push to `main` (must block). Confirm it fails
  - [x] 9.2 Replace the `--base` flag check in rule 3 with real base resolution: extract the PR number from the command (or resolve the current branch's PR when omitted) and read the base via `gh pr view <n> --json baseRefName -q .baseRefName`. Block only when the base is the default branch. Confirm `gh pr merge`'s actual flag set against the installed `gh` before editing
  - [x] 9.3 **Decision — failure mode on base lookup.** The script's header contract is global fail-open. For this rule, recommend **fail-closed**: when the base cannot be determined (no `gh`, unauthenticated, network error), block with a message naming the verification command, because failing open here permits an unreviewed merge into `main`. Record the exception in the script header so the contract stays honest
  - [x] 9.4 Close the raw-git escape: block `git merge` of a `story/*` or `issue/*` branch into an `integration/*` branch, with a message naming `gh pr merge <n> --squash --delete-branch` as the permitted path. The policy is that story work reaches integration through a reviewed PR; the guard must enforce the same thing the prompt mandates
  - [x] 9.5 Block `gh pr merge --admin` outright (it bypasses branch protection) and block `--auto` on a PR whose base is the default branch (it defers an unapproved merge rather than preventing one)
  - [x] 9.6 Replace the hardcoded `main` throughout `git-guard.sh` with a resolved default branch (`git symbolic-ref refs/remotes/origin/HEAD`, falling back to `gh repo view --json defaultBranchRef`, then to `main`). dev-tasks installs into other people's repositories; a repo on `master` or `trunk` currently gets no protection at all from any of the four rules
  - [x] 9.7 Fix the rule-4 tag-push false positive: `v[0-9]+\.[0-9]+\.[0-9]+` matches anywhere in the command, so pushing a branch named `issue/42-bump-v1.2.3` is blocked as a tag push. Anchor the pattern to a ref position
  - [x] 9.8 Add a `planner` post-merge verification step to `.claude/commands/planner.md` merge gate 13: before writing `✅ Merged` to the state file, confirm `gh pr view <n> --json state,mergedAt` reports merged. The checkpoint must record observed GitHub state, not planner's belief — this is what let the state file and GitHub diverge silently
  - [x] 9.9 Verify Acceptance Criterion: `planner`'s documented story-PR merge into an integration branch succeeds end to end, and the PR shows as merged on GitHub
  - [x] 9.10 Verify Acceptance Criterion: every route into the default branch is blocked — `gh pr merge`, `--admin`, `--auto`, `git merge` while on it, `git push` to it
  - [x] 9.11 Verify Acceptance Criterion: a repository whose default branch is `master` receives identical protection
  - [x] 9.12 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 10.0 Close the MCP bypass and establish the durable gate (depends on 9.0) — [#178](https://github.com/llipe/dev-tasks/issues/178)

  > Note: `.claude/settings.json` matches `"Bash"` only. `github-ops.md:49` explicitly offers `merge_pull_request` as the MCP equivalent of `gh pr merge`, and `CLAUDE.md:35` states that where a GitHub MCP server is configured, "agents may use it instead." **All four git-guard invariants — merge/push to the default branch, Conventional Commits, inline `--body`, tag operations — are bypassed completely on the MCP path.** Any consumer with the GitHub MCP server enabled has no enforcement whatsoever, whatever the hook says.
  >
  > Pushing back on the architecture: regex-matching shell command strings is the wrong primary gate for this. It has already produced one blocked-correct-path, one permitted-wrong-path, one false positive (9.7), one hardcoded-branch gap (9.6), and a total bypass. `AGENTS.md:93` already concedes "hook enforcement is best-effort." The durable gate for "no agent merges into the default branch" is a **GitHub branch protection rule** — server-side, unbypassable by any tool surface, Bash or MCP. Sub-task 10.4 is the one that actually closes this; the hook work is fast local feedback, not the control.

  - [ ] 10.1 Write a test asserting the hook matcher covers the mutating GitHub MCP tool names as well as `Bash`; confirm it fails
  - [ ] 10.2 Extend the `PreToolUse` matcher in `templates/claude/settings.json` to cover the mutating MCP surface — `mcp__github__merge_pull_request`, `enable_pr_auto_merge`, `push_files`, `create_or_update_file`, `delete_file`, `create_branch` — and add a guard branch that reads `tool_input` rather than a command string for those calls
  - [ ] 10.3 Reconcile the policy text: either `github-ops.md` stops offering unguarded MCP equivalents for mutating operations, or the guard covers them. Do not leave the table advertising a bypass
  - [ ] 10.4 **Document branch protection as the required control**, not an optional hardening step: on the default branch require a PR, at least one approving review, and passing status checks, with force-push and deletion disabled. Add it to the README install section and to `activity-init` as a setup step, so consumers configure it when they adopt dev-tasks. State plainly in `AGENTS.md` that hooks are advisory and branch protection is the gate
  - [ ] 10.5 Verify Acceptance Criterion: an attempted merge into the default branch via the MCP tool is blocked by the hook
  - [ ] 10.6 Verify Acceptance Criterion: with branch protection configured, the same merge fails server-side even with every hook disabled
  - [ ] 10.7 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 11.0 Never route around a blocked guard — behavioural rules — [#179](https://github.com/llipe/dev-tasks/issues/179)

  > Note: the deepest lesson from this defect is not the regex. An agent under a **MUST** instruction, whose mandated command is blocked, will find another way to satisfy the instruction. That is rational behaviour given the prompt, and no amount of guard-patching prevents the next instance. Two structural rules prevent the whole class: a blocked guard must be terminal, and every block message must name the permitted path.

  - [ ] 11.1 Add to `CLAUDE.md` General Agent Guidelines: when a hook blocks a tool call, the agent **MUST** surface the block verbatim and stop that line of work. It **MUST NOT** attempt an alternative command, tool surface, or sequence that achieves the same effect. A blocked guard is a decision, not an obstacle
  - [ ] 11.2 Mirror the rule into `AGENTS.md` General Agent Guidelines so all three platforms carry it
  - [ ] 11.3 Audit all four `git-guard.sh` block messages: each **MUST** name the permitted alternative, or state plainly that the action is human-only. Rule 3's current message names a flag that does not exist — the direct cause of the route-around
  - [ ] 11.4 Add an Error Handling row to `.claude/commands/planner.md`: *merge command blocked by git-guard* → report the block verbatim, mark the story blocked, write the checkpoint, ask the user. Never attempt an alternative merge path
  - [ ] 11.5 Add the same row to the `developer` agent and command for the commit and PR paths
  - [ ] 11.6 Verify Acceptance Criterion: a `/planner` run against a deliberately blocked merge stops and reports, leaving the integration branch untouched
  - [ ] 11.7 Verify Acceptance Criterion: every guard block message names a permitted path or an owner
  - [ ] 11.8 Run Tests: `pnpm run test:unit`, `pnpm run format:check`

## Completion

Per `AGENTS.md`, before any parent task's PR is marked ready: quality gates (`test`, `lint`, `format:check`, `typecheck`, `audit`) recorded, `qa-engineer` run with `coverage_gate` recorded, `verifier` audit run and posted, `technical-writer` run. Tasks 1, 3, and 4 change documented behaviour and require `/docs` updates; task 1.2 requires the ADR.

## GitHub sync

Resolved 2026-09-16: milestone [`v0.13 — Claude runtime parity and enforcement delivery`](https://github.com/llipe/dev-tasks/milestone/2) created with one issue per parent task (#169–#179, mapping above). Priority labels applied per the sequencing/urgency called out in this plan (task 1 as `priority: critical` unblocker; tasks 9–11 as the confirmed live-defect chain). Dependency relationships are cross-linked as issue comments.
