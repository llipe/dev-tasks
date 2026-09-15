# Implementation Plan - Claude Runtime Parity and Enforcement Delivery

Source: two review passes over `.claude/` (tooling/guardrails/token profile, then three-way platform parity against `.kiro/` and `.github/`). No PRD or GitHub Issue exists yet — see "GitHub sync" below.

**Theme:** every finding here has one root cause. The `.claude` tree's *contracts* are at parity with Kiro and Copilot; its *runtime bindings* are not. Enforcement Claude expresses through a consumer-owned file (`.claude/settings.json`, `CLAUDE.md`) is undeliverable, while Kiro expresses the same things through managed paths and ships them working. Task 1 is the unblocker: tasks 2 and 6 produce nothing a consumer can use until it lands.

Sequencing: 1 → 2, 1 → 6b. Tasks 3, 4, 5, 7 are independent and may run in any order. Task 8 depends on 1, 2, and 3 because it asserts their installed state.

Each parent task is one PR on an `issue/*` branch. Per repository default, every parent task begins with a failing test.

> **Note — scope.** This list covers original-review items 2-4 and all five parity recommendations. Two findings are deliberately **excluded** and remain open:
>
> - **Developer-subagent gate ownership** (original blocking defect #1). The `developer` subagent declares no `Task` tool (`.claude/agents/developer.md:4`) but carries seven MUST-level rules to invoke `verifier`, `qa-engineer`, `technical-writer`, `github-ops`, and `researcher`. Under `/planner` delegation those gates cannot execute, and `planner`'s merge gate (`.claude/commands/planner.md:413`) validates a `verifier_audit: run` string the developer writes about itself. This is a design change to where gates are owned, not a binding fix. **Task 7 collides with it — see the decision point there.**
> - **Wiring `dt ctx assemble` into the agents.** A design question, not a defect.

> **Note — task 2.4 is an addition.** The `gh pr merge --base` guard defect was blocking defect #3 in the first review but was not part of the requested 2-4 sequence. It is included because it lives in the same file as the branch-guard work and currently blocks `/planner`'s autonomous story-PR merges. Strike 2.4 and its AC if you want this list held to the exact original scope.

## Relevant Files

- `templates/claude/settings.json` - new; the PreToolUse hook wiring and permission allowlist a consumer install must deliver
- `.claude/settings.json` - this repo's own copy; kept in sync with the template
- `.claude/hooks/branch-guard.sh` - new; port of `.kiro/hooks/scripts/branch-guard.sh`
- `.claude/hooks/git-guard.sh` - rule 3 (`gh pr merge`) correction
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

## Tasks

- [ ] 1.0 Make `.claude/settings.json` deliverable (unblocker for tasks 2 and 6b)

  > Note: `PROFILE_PATHS.claude` installs `.claude/hooks/` (the scripts) but `.claude/settings.json` — which wires them — is listed in `bundle-manifest.json:126` `consumer_owned_paths`. It is never installed, has no template, and `doctor` does not check it. The `kiro` profile installs `.kiro/hooks/` recursively, which includes `git-guard.json`, the wiring. Result: Kiro consumers get two live hooks; Claude consumers get two inert shell scripts that look installed. Copilot has no hook system at all, so Kiro is currently the only platform with working deterministic enforcement.

  - [ ] 1.1 Write `test/unit/distribution-profiles.test.ts` additions asserting the Claude profile resolves a settings source and that `.claude/settings.json` is no longer in `consumer_owned_paths`; confirm it fails
  - [ ] 1.2 Decide and record the ownership semantics in `docs/adr/ADR-006-claude-settings-ownership.md`: **install-if-absent**, not managed-overwrite. Rationale: a consumer's `permissions.allow` and any local hooks must survive `install` and `update`, so the unconditional-overwrite behaviour used for `ROOT_FILES` is wrong here. Include Context / Decision / Consequences / Alternatives per `AGENTS.md`
  - [ ] 1.3 Create `templates/claude/settings.json` containing the `PreToolUse` wiring for both hooks (see task 2) and an empty-but-documented `permissions.allow` array (populated in task 6b)
  - [ ] 1.4 Add `templates/claude` to `bundle-manifest.json` `managed_paths`, alongside the existing `templates/infra`, `templates/scripts`, `templates/workflows` entries
  - [ ] 1.5 Implement install-if-absent in `core/distribution/install.ts`: a new path category that writes the target only when it does not already exist, distinct from `ROOT_FILES` (which overwrites). Wire `templates/claude/settings.json` → `.claude/settings.json` for the `claude` profile
  - [ ] 1.6 Remove `.claude/settings.json` from `consumer_owned_paths`; confirm `update` still never clobbers a consumer-modified copy under the new semantics
  - [ ] 1.7 Add a `doctor` check in `core/distribution/doctor.ts`: when `.claude/hooks/*.sh` exist but `.claude/settings.json` declares no matching `PreToolUse` entry, report a warning naming the unwired scripts
  - [ ] 1.8 Add `templates/` coverage to `package.json` `files[]` if not already complete for the new directory
  - [ ] 1.9 Verify Acceptance Criterion: `dev-tasks install --profile claude` into an empty temp dir produces a `.claude/settings.json` that wires every shipped hook script
  - [ ] 1.10 Verify Acceptance Criterion: re-running `install` and running `update` against a consumer-modified `.claude/settings.json` leaves it byte-identical
  - [ ] 1.11 Verify Acceptance Criterion: `doctor` warns on a hooks-present / settings-absent repo and is silent on a correctly wired one
  - [ ] 1.12 Run Tests: `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`

- [ ] 2.0 Restore deterministic enforcement on Claude (depends on 1.0)

  > Note: `.claude/settings.json` currently matches `Bash` only. Claude Code writes files through `Edit`/`Write`, never the shell, so `git-guard.sh` never observes a single file write. `AGENTS.md:91` and `README.md:312` both document `branch-guard` as active; it exists only under `.kiro/`. Writes on `main` are today defended by prompt language alone — precisely the bypass the hook was written to backstop.

  - [ ] 2.1 Write `test/unit/claude-hooks-wiring.test.ts`: assert `templates/claude/settings.json` registers `git-guard.sh` on `Bash` and `branch-guard.sh` on `Edit|Write|NotebookEdit`, and that both scripts exist and are executable; confirm it fails
  - [ ] 2.2 Port `.kiro/hooks/scripts/branch-guard.sh` to `.claude/hooks/branch-guard.sh`, preserving fail-open behaviour on a missing/unavailable git repo. Drop the Kiro-specific `toolArgs` limitation comment; the script depends only on the current branch
  - [ ] 2.3 Register both hooks in `templates/claude/settings.json` and in this repo's `.claude/settings.json`
  - [ ] 2.4 **(Addition — see scope note.)** Fix `git-guard.sh:55-66` rule 3. The guard refuses any `gh pr merge` lacking `--base`, but the repository's own canonical merge commands carry no such flag (`.claude/skills/git-ops/SKILL.md:101`, `.claude/agents/github-ops.md:49`), and `gh pr merge` does not accept `--base` — confirm against the installed `gh` before editing. Replace the flag check with a base-branch determination that does not depend on a non-existent flag (resolve the PR's actual base, block only when it is `main`), and correct the block message
  - [ ] 2.5 Write `test/unit/git-guard-merge.test.ts` covering rules 1 and 3, which have no coverage today (only rule 4 / tags is tested in `test/unit/git-guard-tags.test.ts`): pushes to `main`, merges while on `main`, a story-PR merge into an integration branch (must pass), a PR merge into `main` (must block)
  - [ ] 2.6 Verify Acceptance Criterion: an `Edit` or `Write` attempted while on `main` is blocked with the branch-guard message; the same call on an `issue/*` branch passes
  - [ ] 2.7 Verify Acceptance Criterion: `planner`'s documented story-PR merge command into an integration branch is permitted; a merge into `main` is blocked
  - [ ] 2.8 Verify Acceptance Criterion: `AGENTS.md` and `README.md` hook tables describe the shipped Claude state accurately
  - [ ] 2.9 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 3.0 Deliver Claude root context to consumers

  > Note: `ROOT_FILES` is `["DESIGN.md", "TESTING.md"]` (`core/distribution/profiles.ts:56`). Nothing in `core/`, `adapters/`, `bin/`, or the README installs `CLAUDE.md` or `AGENTS.md`, and the `.template` files do not ship in `package.json` `files[]`. Kiro's equivalent always-on layer, `.kiro/steering/git-guard-notice.md` (`inclusion: always`), is a managed path and installs automatically. A Claude consumer therefore gets no project memory at all: no agent guidelines, no branch discipline, no workflow map. This is invisible from inside this repo because `CLAUDE.md` is checked in here.

  - [ ] 3.1 Write `test/integration/install-parity.test.ts` (first slice): assert `install --profile claude` into a temp dir produces a `CLAUDE.md`; confirm it fails
  - [ ] 3.2 Ship `CLAUDE.md.template` and `AGENTS.md.template` in `package.json` `files[]`
  - [ ] 3.3 Install `CLAUDE.md` (from `CLAUDE.md.template`) and `AGENTS.md` (from `AGENTS.md.template`) using the install-if-absent category built in 1.5, so a consumer's filled-in copy is never overwritten
  - [ ] 3.4 Confirm both templates carry the git invariants that `.kiro/steering/git-guard-notice.md` provides always-on, so the two platforms deliver equivalent standing guidance
  - [ ] 3.5 Update the README install section to state what each profile delivers, including the root context files
  - [ ] 3.6 Verify Acceptance Criterion: a fresh `install --profile claude` yields a repo where Claude Code loads project memory on the first turn
  - [ ] 3.7 Verify Acceptance Criterion: an existing consumer `CLAUDE.md` survives `install` and `update` unchanged
  - [ ] 3.8 Run Tests: `pnpm run test:integration`, `pnpm run validate`

- [ ] 4.0 Resolve the Next.js conventions parity claim

  > Note: Copilot delivers these via `applyTo`, Kiro via `fileMatch`. `CLAUDE.md` claims they are "preserved as a nested `CLAUDE.md` inside each React app's root directory when that app exists" — grep across `core/`, `adapters/`, `templates/`, and `.claude/` finds no code that creates it. The claim documents a feature that does not exist. Either build it or withdraw it; do not leave it asserted.

  - [ ] 4.1 Decide: scaffold a nested `CLAUDE.md` during `install` when a Next.js app root is detected, **or** withdraw the claim and document the platform limitation explicitly. Recommendation: withdraw for now — detection heuristics for "each React app root" are a larger job than this list, and an honest gap beats a false claim
  - [ ] 4.2 If withdrawing: correct the "Domain-Specific Conventions" section of `CLAUDE.md` and `CLAUDE.md.template` to state that the Next.js conventions have no automatic Claude delivery, and give consumers the one-line manual step (copy the conventions into their app's nested `CLAUDE.md`)
  - [ ] 4.3 If scaffolding: add the detection and write path to `core/distribution/install.ts`, source the content from the Copilot instruction file, and cover it in `test/integration/install-parity.test.ts`
  - [ ] 4.4 Reflect the outcome in the `AGENTS.md` Instructions table, which currently lists `nextjs-pages-components` without noting the Claude gap
  - [ ] 4.5 Verify Acceptance Criterion: no file in the repository claims a Claude delivery mechanism that does not exist
  - [ ] 4.6 Run Tests: `pnpm run test:unit`, `pnpm run format:check`

- [ ] 5.0 Remove the Kiro-ism and collapse the `developer` command duplication

  > Note: `.claude/agents/developer.md:53-55` carries a "Steering Context Check" instructing the agent to "load the implement steering by opening the relevant task file first." That is Kiro `fileMatch` semantics; on Claude, opening a file loads no skill. The instruction is inert and tells the agent a mechanism exists that does not. It appears in the agent but not the command — one instance of a broader drift: `.claude/commands/developer.md` (21.8 KB) is a near-verbatim copy of `.claude/agents/developer.md` (23.9 KB), 81 differing lines across ~600, and they have already diverged (the agent has the hard branch gate at step 4 and the `--scope related` memo search; the command has neither). `/github-ops` is 681 bytes and is the right shape.

  - [ ] 5.1 Write a test asserting `.claude/commands/developer.md` stays under a size cap and contains no restatement of the Non-Negotiable Operating Rules; confirm it fails
  - [ ] 5.2 Delete the "Steering Context Check" block from `.claude/agents/developer.md`
  - [ ] 5.3 Add an explicit skill invocation as step 0 of the developer execution flow — invoke the `implement` skill directly rather than relying on file-open activation — in both the agent and the command
  - [ ] 5.4 Collapse `.claude/commands/developer.md` to a thin wrapper on the pattern of `.claude/commands/github-ops.md`: frontmatter, `$ARGUMENTS`, step-gated default, and a pointer to the `developer` agent contract plus the `implement` skill
  - [ ] 5.5 Audit the remaining agent/command pairs for the same duplication and confirm none other restates its agent body
  - [ ] 5.6 Verify Acceptance Criterion: `/developer` and the `developer` subagent resolve to one behavioural contract with no divergent copy
  - [ ] 5.7 Verify Acceptance Criterion: no `.claude` file references Kiro steering, `fileMatch`, or `applyTo` activation semantics
  - [ ] 5.8 Verify Acceptance Criterion: existing `developer` parity tests still pass against the reduced command file
  - [ ] 5.9 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 6.0 Cost controls: subagent models and permission allowlist

  > Note: none of the eight `.claude/agents/*.md` declares `model:`, so every delegated run — including mechanical ones — inherits the main-thread model. And `.claude/settings.json` has no `permissions` block, so every `git status`, `pnpm test`, and `gh pr view` raises a prompt, which is what makes "pre-approved autonomous sequential" feel non-autonomous. 6b depends on task 1.

  - [ ] 6.1 Write a test asserting every `.claude/agents/*.md` declares a `model:` value from the allowed set; confirm it fails
  - [ ] 6.2 Add `model:` frontmatter to the four mechanical agents — `github-ops`, `housekeeping`, `technical-writer`, `researcher` — selecting a smaller model per agent. Leave `developer`, `verifier`, `qa-engineer`, and `ux-engineer` on the inherited model, where judgement quality dominates cost
  - [ ] 6.3 Confirm the model identifiers used are current and valid before committing; do not carry a model name into any other repository artifact
  - [ ] 6.4 **(6b — depends on 1.0)** Populate `permissions.allow` in `templates/claude/settings.json` with read-only and quality-gate commands the workflow runs constantly: `git status`, `git diff`, `git log`, `git rev-parse`, `git branch`, `pnpm run lint`, `pnpm run test`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run audit`, `gh pr view`, `gh issue view`. Exclude every write path so the guards still bind
  - [ ] 6.5 Mirror the allowlist into this repo's `.claude/settings.json`
  - [ ] 6.6 Verify Acceptance Criterion: a delegated `github-ops` or `researcher` run executes on the smaller model
  - [ ] 6.7 Verify Acceptance Criterion: no allowlisted command can push, merge, commit, tag, or write a file
  - [ ] 6.8 Verify Acceptance Criterion: the hook guards still block their four invariants with the allowlist active
  - [ ] 6.9 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 7.0 Tool-declaration parity test — **contains a decision point**

  > Note: `test/unit/qa-engineer-parity.test.ts:162` and `test/unit/researcher-parity.test.ts:139` assert only that a `tools:` line *exists*, never which tools. Nothing mechanically catches an agent whose prompt requires a capability its frontmatter withholds. The invariant — *every agent whose prompt instructs it to invoke a subagent must declare `Task`* — is four lines and would have caught the `developer` defect at authoring time.
  >
  > **It cannot pass today.** `developer` violates it, and the real fix is the excluded gate-ownership change. Resolve 7.1 before writing the assertions.

  - [ ] 7.1 **Decision.** Choose one:
        **(a) Recommended — make the prompt honest.** Strip the impossible invocation claims from `.claude/agents/developer.md` (rules 10, 18, 22 and the `researcher` troubleshooting path), have the subagent emit `verifier_audit: not-run(no-delegation)` and `coverage_gate: SKIPPED(no-delegation)`, and note in the file that these gates are owned by the caller. This is a small, self-contained subset of the excluded fix; it makes the test green honestly and stops `/planner` from merging on a self-certified string. It does **not** by itself relocate the gates to `planner` — that remains open.
        **(b) Land the test as a documented expected failure** tied to a tracking issue for the gate-ownership change. Keeps scope tight; leaves a red test in the suite.
        Do not write the test until this is decided — option (b) changes what the file asserts.
  - [ ] 7.2 Write `test/unit/claude-tool-declaration-parity.test.ts`: parse each `.claude/agents/*.md`, extract the declared `tools:` list, scan the body for instructions to invoke a named subagent, and assert `Task` is declared whenever such an instruction is present
  - [ ] 7.3 Extend it with the inverse check: no agent declares a tool its prompt never uses, to keep tool grants minimal
  - [ ] 7.4 Apply the 7.1 outcome to `.claude/agents/developer.md`
  - [ ] 7.5 If 7.1(a): update `.claude/commands/planner.md` merge gate 6 so it no longer treats `verifier_audit: run` as sufficient evidence, and record the residual risk in the tracking issue for the excluded fix
  - [ ] 7.6 Verify Acceptance Criterion: the test fails when `Task` is removed from an agent whose prompt requires it
  - [ ] 7.7 Verify Acceptance Criterion: the suite is green, or the single expected failure is documented and linked (per 7.1)
  - [ ] 7.8 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 8.0 Installed-state parity test (depends on 1.0, 2.0, 3.0)

  > Note: every existing parity test asserts files exist *in this repository*. None asserts that `install --profile claude` produces an install functionally equivalent to `install --profile kiro`. That is the exact blind spot all four delivery gaps fell through — each platform's files were present and correct in-tree, and only the installed result diverged.

  - [ ] 8.1 Complete `test/integration/install-parity.test.ts`: install each profile into a separate temp dir and compare *enforcement surface*, not file counts
  - [ ] 8.2 Assert per profile: hooks present **and wired** to a runtime trigger; always-on context present (`CLAUDE.md` for Claude, `inclusion: always` steering for Kiro); scoped execution rules reachable (`implement` and `plan`, by whatever mechanism the platform uses)
  - [ ] 8.3 Assert the documented intentional asymmetries hold and do not silently widen: `infra-engineer`, `planner`, and `product-engineer` as Claude commands rather than agents; `verifier` as two commands; the merged `planner-resume` and three `product-engineer` entry points
  - [ ] 8.4 Assert every consumer-owned path is either installed from a template or explicitly documented as consumer-supplied, so nothing else can fall into the settings.json trap
  - [ ] 8.5 Verify Acceptance Criterion: the test fails if `.claude/settings.json` is removed from the install path
  - [ ] 8.6 Verify Acceptance Criterion: the test fails if a hook script is shipped without a matching trigger registration
  - [ ] 8.7 Verify Acceptance Criterion: the test passes for all three profiles and for `--profile all`
  - [ ] 8.8 Run Tests: `pnpm run test:integration`, `pnpm run validate`

## Completion

Per `AGENTS.md`, before any parent task's PR is marked ready: quality gates (`test`, `lint`, `format:check`, `typecheck`, `audit`) recorded, `qa-engineer` run with `coverage_gate` recorded, `verifier` audit run and posted, `technical-writer` run. Tasks 1, 3, and 4 change documented behaviour and require `/docs` updates; task 1.2 requires the ADR.

## GitHub sync

The `plan` skill requires this checklist to be mirrored onto a GitHub Issue, and no issue exists for this work. Confirm whether to create one (or a milestone with one issue per parent task) before implementation starts.
