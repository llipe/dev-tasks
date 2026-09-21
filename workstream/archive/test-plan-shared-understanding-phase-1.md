# Compliance Test Plan: Shared Understanding — Phase 1 (Docs Foundation and Repository Shape)

> **Mode:** `verifier` Design Mode (pre-implementation)
> **Status:** Blocked-with-findings — the plan is complete and executable, but **seven factual defects in the source specification** (§2) must be routed before S-001 and S-004 can be implemented as written.

## Changelog

| Version | Date       | Summary                                                                                                              | Author   |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 1.0     | 2026-09-19 | Initial compliance test plan. 130 test cases across seven stories and nine PRD acceptance criteria; 7 spec defects; 25 criteria not verifiable as written. | verifier |

## Source Input Summary

| Input                | Value                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Repository           | `llipe/dev-tasks`                                                                            |
| Branch under design  | `claude/spec-shared-understanding-phase-1`                                                   |
| Predecessor          | Phase 0, merged to `main` as `a9f7eef` (PR #200)                                             |
| PRD                  | `docs/requirements/prd-shared-understanding-refinement.md` — FR-44 to FR-51, FR-59 to FR-64; AC-22 to AC-26, AC-29 to AC-32 |
| Specification        | `workstream/specification-shared-understanding-phase-1.md` (v1.1)                            |
| User stories         | `workstream/user-stories-shared-understanding-phase-1.md` (v1.1) — S-001 to S-007            |
| Task list            | `workstream/tasks-shared-understanding-phase-1-plan.md` (v1.1)                                |
| Decisions            | `workstream/decisions-shared-understanding.md` — D-16, D-21, D-40 to D-45 (D-46, D-47 proposed) |
| GitHub issues        | #202 (S-001) to #208 (S-007)                                                                 |
| Criteria in scope    | 53 story acceptance criteria + 9 PRD acceptance criteria = **62**                             |
| Test cases designed  | **130**                                                                                       |

### Measured baseline (this branch, 2026-09-19)

Every number below was measured, not copied from the source artifacts.

| Gate           | Command                | Result                                                                 |
| -------------- | ---------------------- | ---------------------------------------------------------------------- |
| `typecheck`    | `pnpm run typecheck`   | PASS (clean)                                                           |
| `lint`         | `pnpm run lint`        | PASS (clean)                                                           |
| `format:check` | `pnpm run format:check`| PASS (clean)                                                           |
| `test`         | `pnpm run test`        | 5 failed / 1291 passed / 1296 total — **exactly the D-40 set**         |
| Node runtime   | `node -v`              | `v22.22.2` (note: `package.json` declares `engines.node >= 24`)        |

D-40 set, by full test name — this is the regression oracle for every story:

1. `test/integration/bootstrap-commands.test.ts > dev-tasks bootstrap commands (integration) > doctor > runs all checks and outputs results`
2. `test/integration/bootstrap-commands.test.ts > dev-tasks bootstrap commands (integration) > doctor > supports --json output with structured check results`
3. `test/unit/distribution-doctor.test.ts > core/distribution/doctor > checkCacheDir > fails when path is not writable`
4. `test/unit/distribution-update.test.ts > core/distribution/update — runUpdate() > edge case: --force with unwritable backup dir > throws error when backup directory cannot be created`
5. `test/unit/infra-script-contract.test.ts > deploy.sh — blocked conditions and edge cases (AC-3, 8.9) > exits 2 when yq is missing from PATH`

---

## 1. Specification Fact-Check (performed before test design)

Ten load-bearing claims were verified directly against the codebase. Results drive the test design that follows.

| # | Claim                                                              | Verdict                | Evidence                                                                                      |
| - | ------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------- |
| 1 | 50 files reference the old foundation-doc names                    | **Accurate as scoped; spec text stale** | `git grep -l` per tree: `.claude/` 10, `.github/` 11, `.kiro/` 12, `docs/` 10, `test/` 2, root 5, `core/`/`bin/`/`templates/` 0 = 50. Spec §8.1/§14/§16 say **46** in four places. |
| 2 | 5 + 3 + 2 files; the nine FR-47 runbooks leave exactly 5 uncovered | **Inventory accurate; plan misses one file** | `ls` confirms 5/3/2. The tenth runbook is justified. But task 3.7 assigns `scripts/release.sh` (13617 B, repo-owned), not `templates/scripts/release.sh` (6443 B) — a different file, and an AC-25 surface left orphaned. |
| 3 | `INSTALL_IF_ABSENT_FILES` has no platform-agnostic option          | **Accurate**           | `core/distribution/profiles.ts`: `InstallIfAbsentFile.platform: Platform` (required, `copilot\|claude\|kiro`); all 3 entries tagged `claude`; `install-if-absent.ts` filters on `platformSet.has(file.platform)`. |
| 4 | `dev-tasks migrate docs` already parses correctly                  | **Accurate**           | Executed `parseArgs(["migrate","docs"])` → `{command:"migrate", positional:["docs"], ...}`; `--force` sets `flags.force`. |
| 5 | `core/checks` absent, `core/verify` gone                           | **Accurate**           | `ls core/` → `distribution`, `exit-codes.ts`, `index.ts`, `reconcile.ts`. Neither directory exists. |
| 6 | `lint` = `eslint . && node dist/core/checks/run.js` is workable    | **DEFECT — broken as specified** | See §2.1. Reproduced MODULE_NOT_FOUND in a fresh clone; CI runs `validate` before `build`. |
| 7 | `yaml` may stay a devDependency                                    | **DEFECT — hedge resolves against the spec** | See §2.2.                                                                                     |
| 8 | D-40 five-failure baseline still holds                             | **Accurate**           | `pnpm run test` → 5 failed / 1291 passed; failing set matches D-40 by full test name.         |
| 9 | No `validate.yml` exists, so AC-30's CI half cannot land           | **Accurate**           | `.github/workflows/` contains only `publish-npm.yml` and `release-bundle.yml`.               |
| 10| `activity-init`'s "Mode A — Mono-Repo" collides with FR-59         | **Accurate**           | `.claude/skills/activity-init/SKILL.md:56` "Mono-repo mode: `/docs` directory exists"; `:61` "## Mode A — Mono-Repo (Current Flow)". FR-59 defines monorepo as "several packages under one workspace". |

---

## 2. Factual Defects in the Specification

Each defect is stated with the evidence that produced it and the test case that will keep it closed. These are reported, not fixed — routing is the calling session's call.

### 2.1 DEFECT-1 (Critical) — the proposed `lint` chain cannot run in CI or in a fresh clone

**Claimed** (spec §8.3, S-004 Technical Notes, task 4.9): `lint` becomes `eslint . --max-warnings 0 && node dist/core/checks/run.js`.

**Actual:**

- `.gitignore:8` ignores `dist/`. `git ls-files dist/core dist/bin` → **0 tracked files**; `dist/` carries only two committed bundle tarballs.
- `package.json`: `"validate": "pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test"` — **no `build` anywhere in the chain**.
- `.github/workflows/publish-npm.yml:61` `run: pnpm run validate`, then `:64` `run: pnpm run build`. **`validate` runs before `build`.**
- `"prepublishOnly": "pnpm run validate && pnpm run build"` — same ordering.
- Reproduced against a fresh clone of this branch: `dist/` contained only the two tarballs, and `node dist/core/checks/run.js` exited `1` with `Error: Cannot find module .../dist/core/checks/run.js` (`MODULE_NOT_FOUND`).

**Impact:** as specified, the first release run after this phase merges fails at the "Run quality gates" step and never reaches publish. Every fresh contributor clone fails `pnpm run lint` and `pnpm run validate` until someone runs `pnpm run build`. S-004 AC-7 ("the check runs under `lint`, so `validate` reaches it") would be un-satisfiable on the branch it is written on.

**Resolution options, ranked:**

1. **Run the TypeScript source through `tsx`** — `"lint": "eslint . --max-warnings 0 && tsx core/checks/run.ts"`. `tsx@4.19.4` is already a devDependency and was verified working against `.ts` source in this repository. No build dependency, no ordering change, no new dependency. **Recommended.**
2. `node --experimental-strip-types core/checks/run.ts` — no new dependency, but the local runtime here is `v22.22.2` while `engines.node` declares `>=24`; behavior differs across that boundary.
3. Make `lint` depend on `build` — rejected: it makes every lint a compile, and still leaves `validate`'s declared order (`typecheck → lint → …`) lying about its real prerequisites.
4. Reorder `publish-npm.yml` and `prepublishOnly` to build first — fixes CI but not the fresh-clone case.

**Covered by:** TC-401, TC-402, TC-403, TC-404, TC-810.

### 2.2 DEFECT-2 (Major) — the `yaml` hedge resolves against `devDependencies`

**Claimed** (spec §8.3 note, S-004 Technical Notes, task 4.10): "if the check runs only in this repository's `lint`, devDependency is correct" — and task 4.10 instructs the implementer **not** to move it.

**Actual, four independent lines of evidence:**

1. `package.json` `files` ships `dist/core/` to consumers. `core/checks` compiles into `dist/core/checks/` and is therefore inside the published package.
2. Established convention in this repository: `execa` is imported by shipped code (`core/distribution/fetch-package.ts`) and lives in `dependencies`. `yaml` is currently imported by exactly one file — `test/unit/infra-workflow-templates.test.ts` — which is why D-30 could demote it in Phase 0.
3. S-004's own Business Rules and task 4.11 say the **`verifier`** is the second caller of the same exported function. `.claude/agents/verifier.md` is in `files` and runs inside consumer repositories, where `devDependencies` are not installed.
4. FR-47 requires `docs/runbooks/` in every consumer and FR-50 makes `technical-writer` maintain it on every run — consumer-side execution is the stated intent, not a hypothetical.

**Impact:** shipping `core/checks` with a `yaml` import while `yaml` sits in `devDependencies` produces `ERR_MODULE_NOT_FOUND` for the first consumer that reaches it. Task 4.10's premise is contradicted by S-004's own second-caller rule.

**Resolution options:** (a) move `yaml` to `dependencies`; or (b) **preferred under `SIMPLICITY.md` A4** — hand-parse the frontmatter. It is a fixed five-key flat block (`name`, `trigger`, `owner`, `last_verified`, `related`), not arbitrary YAML; a ~20-line parser avoids adding a runtime dependency for a format this phase itself defines.

**Covered by:** TC-405, TC-406, TC-811.

### 2.3 DEFECT-3 (Major) — S-001 AC-2 and PRD AC-22 are unsatisfiable without rewriting immutable records

**Claimed** (S-001 AC-2): no file under `docs/` references the old names "except the fallback-rule paragraph itself". Spec §14 says the allowlist works "the same way `test/unit/dt-retirement-absence.test.ts` allow-lists its own pattern literals".

**Actual:** the 10 `docs/` files carrying old names are:

| File                                                    | Hits | Nature                                                            |
| ------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `docs/README.md`                                        | 2    | Live index — should be updated                                    |
| `docs/system-overview.md`                               | 2    | Live doc — should be updated                                      |
| `docs/workflow-chains.md`                               | 2    | Live doc — should be updated                                      |
| `docs/adr/README.md`                                    | 1    | Live ADR-trigger rule — should be updated                         |
| `docs/adr/ADR-002-exit-code-contract.md`                | 1    | **Immutable ADR**                                                 |
| `docs/adr/ADR-003-qa-engineer-coverage-gate.md`         | 2    | **Immutable ADR** — one is a historical "Docs updated:" record    |
| `docs/adr/ADR-007-retire-multi-repo-context-layer.md`   | 1    | **Immutable ADR** — line 62 records which files Phase 0 changed   |
| `docs/requirements/prd-evidence-driven-development-loop.md` | 1 | Historical PRD                                                    |
| `docs/requirements/prd-infra-engineer.md`               | 2    | Historical PRD                                                    |
| `docs/requirements/prd-shared-understanding-refinement.md` | 7 | **The in-scope PRD** — FR-44 literally reads "`docs/product-context.md` becomes `docs/product.md`" |

- **D-35 (Phase 0, accepted):** "Mark Superseded; **never rewrite an ADR**." Updating ADR-007's record of Phase 0's changed files would falsify the record.
- The in-scope PRD must keep the old names to state its own requirement.
- **The cited precedent does not cover this:** `test/unit/dt-retirement-absence.test.ts` `SCAN_ROOTS` = `bin`, `core`, `test`, `.claude`, `.github`, `.kiro`, `templates`, `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`. **`docs/` is not scanned at all.** There is no Phase 0 precedent for the `docs/` half of AC-2, and AC-3 tells the implementer to copy that pattern.

**Impact:** S-001's test-first step (task 1.1) produces a test that can only go green by rewriting three ADRs and three PRDs, or by an allowlist far larger than "the fallback-rule paragraph". This blocks the first task of the first story.

**Resolution:** enumerate the allowlist explicitly before implementation — recommended categories: (a) the fallback-rule paragraph locations; (b) `docs/adr/**` historical records; (c) `docs/requirements/**` PRD prose; (d) `CHANGELOG.md`-style narration if any appears. Each entry justified by name, per the Phase 0 `EXEMPT_FILES` convention.

**Covered by:** TC-103, TC-104, TC-105, TC-812.

### 2.4 DEFECT-4 (Major) — `.gitignore` is a 51st root reference, and it ignores the renamed files

**Claimed:** root references are five files (`AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `CLAUDE.md.template`, `README.md`); `core/`, `bin/`, `templates/` carry none.

**Actual:** `.gitignore` carries two further references, and they are **functional git configuration, not prose**:

```
25: /docs/*.md
26: !/docs/README.md
27: !/docs/product-context.md
28: !/docs/technical-guidelines.md
```

Verified consequence:

- `git check-ignore -v docs/product.md` → `.gitignore:25:/docs/*.md  docs/product.md` (**ignored**)
- `git check-ignore -v docs/tech.md` → `.gitignore:25:/docs/*.md  docs/tech.md` (**ignored**)
- `git check-ignore docs/product-context.md docs/technical-guidelines.md` → exit 1 (**not ignored**, today)
- `git check-ignore docs/runbooks/README.md` → exit 1 (**not ignored** — `/docs/*.md` matches only immediate children, so S-003's runbook tree is unaffected)

`git mv` on an already-tracked file survives `.gitignore`, so the rename commit itself will look fine. The trap is downstream: any later `git add docs/product.md` (after a delete, a `migrate docs --force` on a fresh tree, or `activity-init` regenerating it) is silently refused. `.gitignore` appears in no story, no AC, and no task.

**Impact:** also makes S-001 AC-2 false on its face — `.gitignore` is a file "at the repository root" referencing `product-context.md`.

**Resolution:** add `!/docs/product.md` and `!/docs/tech.md` (and decide whether to retain the old-name negations for the fallback window) as an explicit sub-task of S-001.

**Covered by:** TC-106, TC-107, TC-813.

### 2.5 DEFECT-5 (Major) — `templates/scripts/release.sh` has no runbook, so AC-25 still fails

**Claimed** (S-003 AC-5 / Business Rules): the ten `related` assignments cover every file under `templates/scripts/` (5), `templates/workflows/` (3), `.github/workflows/` (2).

**Actual** — cross-referencing the task list's `related` assignments against the real inventory:

| File                                  | Assigned by                     |
| ------------------------------------- | --------------------------------- |
| `templates/scripts/deploy.sh`         | task 3.8 `runbook-deploy-service` |
| `templates/scripts/deploy-verify.sh`  | task 3.8                          |
| `templates/scripts/deploy-status.sh`  | task 3.8                          |
| `templates/scripts/rollback.sh`       | task 3.9 `runbook-rollback-deploy`|
| **`templates/scripts/release.sh`**    | **none**                          |
| `templates/workflows/deploy-dev.yml`  | task 3.8                          |
| `templates/workflows/deploy-prod.yml` | task 3.8                          |
| `templates/workflows/rollback.yml`    | task 3.9                          |
| `.github/workflows/publish-npm.yml`   | task 3.7 `runbook-release-npm`    |
| `.github/workflows/release-bundle.yml`| task 3.7                          |

Task 3.7 names **`scripts/release.sh`** — the repository's own release script (13617 bytes) — not **`templates/scripts/release.sh`** (6443 bytes), the consumer template. They are different files; only the latter is an AC-25 surface. 9 of 10 covered.

**Note on the tenth runbook:** the justification holds. With only FR-47's nine, `runbook-release-npm` covers the two `.github/workflows/` files plus `templates/scripts/release.sh`, and `runbook-rollback-deploy` covers the two rollback files — leaving exactly `deploy.sh`, `deploy-verify.sh`, `deploy-status.sh`, `deploy-dev.yml`, `deploy-prod.yml`. **`runbook-deploy-service` (D-46) is justified, not scope creep.** The arithmetic is right; the task list's execution of it is off by one file.

**Covered by:** TC-305, TC-306, TC-307.

### 2.6 DEFECT-6 (Minor) — `dev-tasks migrate` is detect-and-apply, not detect-and-propose

**Claimed:** PRD FR-45 — the existing `migrate` command "already performs detect-and-propose for legacy installs". S-002 Context repeats it. Spec §6: "`--force` is reused with its existing meaning ... rather than adding a second flag with overlapping semantics."

**Actual:** `core/distribution/migrate.ts` `runMigration(repoRoot)` takes no options, checks for an existing manifest, detects legacy, discovers files, and calls `writeManifest(repoRoot, manifest)` **unconditionally**. `bin/dev-tasks.ts:335` `case "migrate"` calls it directly. There is no dry-run, no propose step, and no `--force` gate anywhere on the legacy path.

**Impact:** after this story, `dev-tasks migrate` mutates by default while `dev-tasks migrate docs` does not — inconsistent defaults under one verb, which is exactly what spec §6 claims to be avoiding. S-002 AC-1 and AC-3 are individually satisfiable; the *contract* they jointly produce is not what the spec describes.

**Resolution (report-only):** either document the asymmetry deliberately, or give `migrate docs` the same apply-by-default semantics with the propose output as a separate flag. Not a code defect — a contract-description defect.

**Covered by:** TC-204, TC-205, TC-206.

### 2.7 DEFECT-7 (Minor) — the spec's "46 files" contradicts the stories' and task list's "50"

`workstream/specification-shared-understanding-phase-1.md` says **46** at §8.1 (twice), §14, and §16. The stories (Delivery Shape, S-001 Context/Technical Notes/Implementation Steps/Files) and the task list (line 55) say **50**. The measured value is **50** within AC-22's enumerated scope. The spec is stale; the downstream artifacts are correct. Same class of propagation error as Phase 0's test-baseline miscount, with the direction reversed.

**Covered by:** TC-101, TC-102.

### 2.8 Additional observations (not defects, design constraints the spec omits)

| # | Observation                                                                                                                                                                             | Consequence for the check                                                                 |
| - | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| a | `docs/README.md` links `../README.md`, `adr/README.md`, `requirements/` (a directory), and names `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `DESIGN.md`, `TESTING.md` — all root files. | A directory-relative "listed file does not exist" rule produces **5+ false failures** on the real tree. Resolution must be repo-root-aware and must tolerate directory links. |
| b | `docs/` contains `adr/` (8 files) and `requirements/` (4 files); `docs/README.md` links only the sub-indexes.                                                                           | The "index omits a file that exists in its directory" rule **must be non-recursive**, or it flags 11 files on a clean tree. Spec §8.3 states neither constraint. |
| c | `docs/README.md` is currently **in sync** with `docs/*.md` (verified by set comparison).                                                                                                | Task 4.16 ("fix anything validate legitimately finds") should find nothing in the top-level index if (a) and (b) are handled. |
| d | `docs/requirements/` has **no** `README.md` index.                                                                                                                                       | AC-32 names only the two READMEs, so this is out of scope — but the check must not generalize to "every docs subdirectory needs an index". |
| e | 24 tracked files under `workstream/` reference the old names.                                                                                                                            | `workstream/` is outside AC-22's enumerated scope, but the S-001 parity test **must** exclude it or it fails with 24 hits. Not stated anywhere. |
| f | `adapters/` no longer exists (D-34 moved `parse-args.ts` to `bin/`).                                                                                                                     | PRD AC-22 still names `adapters/`. Benign; S-001 AC-2 correctly drops it.                 |
| g | `consumer_owned_paths` is a key **inside** `bundle-manifest.json`, not a separate artifact.                                                                                              | S-003 AC-8 reads as two locations. One artifact, one edit.                                |
| h | Local Node is `v22.22.2`; `engines.node` declares `>=24`.                                                                                                                               | Rules out DEFECT-1 resolution option 2 as a safe default.                                 |

---

## 3. Acceptance-Criteria Verifiability Analysis

**25 of 62 criteria are not verifiable as written.** Each is listed with the reason and a restatement that would be verifiable. This is reported to `product-engineer`; `verifier` does not edit the stories.

### 3.1 Root cause A — no executable harness for skill/agent behavior (15 criteria)

Fourteen of the twenty-five fail for one shared reason: `activity-init`, `researcher`, `plan`, `implement`, `activity-test-standards`, `technical-writer`, and `verifier` are **prompt content**. Nothing in `test/` executes them. The only mechanically checkable property is *text presence and three-tree parity*, which is a proxy for the stated behavior, not the behavior.

| ID              | As written                                                                        | Verifiable restatement                                                                                          |
| --------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| S-005 AC-2      | "`activity-init` records a package map in `docs/tech.md` with one row per package" | "`activity-init` SKILL.md contains a package-map table template with exactly the six named columns, identically in all three trees" + "`docs/tech.md` on this branch contains a conforming table" |
| S-005 AC-4      | "filled freeform at interview time"                                                | "The skill instructs the interviewer to fill Bounded context freeform and cites D-45"                          |
| S-005 AC-7      | "`activity-init` on a fresh repository creates the three files"                    | "The skill's Final Instructions enumerate `docs/product.md`, `docs/tech.md`, `docs/runbooks/README.md` and a `SIMPLICITY.md` owner/threshold confirmation step" |
| S-006 AC-1      | "`researcher` names the package for each finding"                                  | "Each of `researcher`, `plan`, `implement` contains the package-naming instruction with the `feat(api):` example, identically in all three trees" |
| S-006 AC-2      | "root scripts fan out to every package"                                            | "`docs/tech.md` contains a fan-out contract section stating root `validate` is the single entry point" — the behavior itself is unimplementable here (see 3.2) |
| S-006 AC-3      | "`activity-test-standards` verifies every package is reachable"                    | "`activity-test-standards` contains a per-package reachability procedure; `TESTING.md` contains a per-package runner section" |
| S-007 AC-1      | "The `verifier` reports a finding when …"                                          | "`verifier` contains the FR-49b trigger with the three-or-more-steps threshold and the five listed step categories" |
| S-007 AC-3      | "The coverage trigger is wired to its owners"                                      | "Each of `infra-engineer`, `developer`, `qa-engineer`, `housekeeping` contains the FR-49b clause naming its own scope" |
| S-007 AC-5      | "`technical-writer` keeps `/docs` organized on every run"                          | "`technical-writer` contains the five named hygiene rules (index sync, frontmatter validity, naming, dangling `related`, staleness)" |
| S-002 AC-7      | "runs every agent unchanged"                                                       | "No dev-tasks-owned prompt names a foundation doc without the fallback clause" — asserted by the S-001 test, not re-asserted here |
| PRD AC-23       | "runs every agent unchanged, and `doctor` prints a warning"                        | Split: the `doctor` half is code-testable; the agent half restates S-001 AC-4                                  |
| PRD AC-26       | "`activity-init` on a fresh repository creates …"                                  | As S-005 AC-7                                                                                                   |
| PRD AC-29 (1st) | "`activity-init` on a monorepo records a package map"                              | As S-005 AC-2; the `doctor`-warns half is code-testable                                                        |
| PRD AC-31       | "a PR … receives a verifier finding"                                               | As S-007 AC-1                                                                                                   |
| S-005 AC-1      | "`activity-init` detects repository shape from the FR-59 signals"                  | Split: `core/distribution/workspace.ts` detection is code-testable; the skill's invocation of it is text-only  |

### 3.2 Root cause B — subjective or undefined predicates (7 criteria)

| ID         | Undefined term                                                            | Why it fails                                                                                         |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| S-001 AC-2 | "except the fallback-rule paragraph itself"                                | Allowlist is not enumerated, and the real set is much larger (DEFECT-3). No oracle until enumerated.  |
| S-001 AC-4 | "Every skill and agent that reads a foundation document"                   | The set is never enumerated. A test cannot assert over an undefined population.                       |
| S-001 AC-6 | "identical in `.claude/`, `.github/`, and `.kiro/`"                        | The three trees are not byte-identical today (platform frontmatter differs). No normalization defined.  Inherited by S-005 AC-8, S-006 AC-6, S-007 AC-7. |
| S-002 AC-6 | "matching the existing command output shape"                               | No JSON schema is stated. `DoctorCheck` exists as a type but is never named as the contract.           |
| S-002 AC-8 | "must be able to learn the migration from `README.md` alone"               | Summative clause is subjective; the four enumerated sub-clauses are individually checkable.            |
| S-004 AC-8 | "no registry, plugin interface, or abstraction"                            | "Abstraction" is undefined. Verifiable only as a reviewer sign-off, which is what the story already says. |
| S-005 AC-5 | "renamed so no reader can confuse it"                                      | Subjective. Restate as: "the string `Mono-Repo` does not appear in `activity-init` in any tree, and no cross-reference to the old mode name survives." |

### 3.3 Root cause C — internally contradictory or unmeasurable (3 criteria)

| ID         | Problem                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-004 AC-1 | "exports a **pure** function that takes a repository root and returns failures and staleness findings separately". A function that reads the filesystem is by definition not pure. Restate as "a single exported function with no module-level state, whose only input is `repoRoot`". |
| S-004 AC-4 | "or a **misnamed** runbook file". `runbook-<verb>-<object>.md` has no machine-checkable definition of verb or object — `runbook-setup-supabase-local` and `runbook-configure-branch-protection` both parse ambiguously. Restate as the regex `^runbook-[a-z0-9]+(-[a-z0-9]+)+\.md$`. |
| S-003 AC-8 | "`bundle-manifest.json` **and** `consumer_owned_paths`" names one artifact as two (observation 2.8g). Restate as "`bundle-manifest.json`'s `consumer_owned_paths` array contains `docs/runbooks/`". |

### 3.4 Verifiable as written (37 criteria)

S-001 AC-1, AC-3, AC-5, AC-7 · S-002 AC-1 to AC-5 · S-003 AC-1 to AC-7 · S-004 AC-2, AC-3, AC-5, AC-6, AC-7, AC-9 · S-005 AC-3, AC-6 · S-006 AC-4, AC-5 · S-007 AC-2 (as a policy statement), AC-4, AC-6 · S-005 AC-8, S-006 AC-6, S-007 AC-7 (parity, conditional on S-001 AC-6's normalization being defined) · PRD AC-22, AC-24, AC-25, AC-29 (`doctor` half), AC-30 (Phase-1 half), AC-32.

---

## 4. PRD Requirement Coverage Check

Every FR in the FR-44..FR-51 / FR-59..FR-64 range was traced to a story. One partial gap found.

| FR     | Story        | Verdict                                                                                                                                                  |
| ------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-44  | S-001        | Covered                                                                                                                                                  |
| FR-45  | S-001, S-002 | Covered (D-43 scopes session-start detection to `doctor`/`update`)                                                                                        |
| FR-46  | S-001        | Covered                                                                                                                                                  |
| FR-47  | S-003        | Covered                                                                                                                                                  |
| FR-48  | S-003        | Covered                                                                                                                                                  |
| FR-49a | S-003, S-007 | **PARTIAL GAP** — see below                                                                                                                              |
| FR-49b | S-007        | Covered                                                                                                                                                  |
| FR-50  | S-004, S-007 | Covered                                                                                                                                                  |
| FR-51  | S-007        | Covered                                                                                                                                                  |
| FR-59  | S-005        | Covered                                                                                                                                                  |
| FR-60  | S-005        | Covered                                                                                                                                                  |
| FR-61  | S-006        | Covered for the agent/contract half; CI scoping is Phase 4 (recorded)                                                                                     |
| FR-62  | S-006        | Covered                                                                                                                                                  |
| FR-63  | S-006        | Covered                                                                                                                                                  |
| FR-64  | S-006        | Covered                                                                                                                                                  |

**GAP-1 (FR-49a, "every `infra-engineer` change kind MUST have one"):** `.claude/commands/infra-engineer.md` defines **18 change kinds** (discover AWS/Fly/Supabase, build image, create app, deploy app, set secret, create IAM policy, attach IAM policy, DNS record, certificate (ACM), certificate (Fly), database migration, foundation change, repo and PR operation, pipeline change, log triage, cost sweep). S-003 AC-5 asserts only the *file* surface (`templates/scripts/`, `templates/workflows/`, `.github/workflows/`). S-007 AC-4 states the rule forward-looking, in agent instructions. **No acceptance criterion requires a runbook to exist for any change kind**, and no story records the omission as deliberate — unlike AC-30, which is explicitly documented as split. Either the change-kind half of FR-49a should be added to S-003's scope, or it should be recorded as a deliberate deferral with a decision ID.

**AC-30 split — confirmed legitimate.** `.github/workflows/` contains only `publish-npm.yml` and `release-bundle.yml`; no `validate.yml` exists to modify, and PRD AC-20 assigns its delivery to `infra-engineer` in Phase 4. The stories' recorded split is factually correct.

---

## 5. Test Design

### 5.1 Conventions

- IDs: `TC-1xx` S-001, `TC-2xx` S-002, `TC-3xx` S-003, `TC-4xx` S-004, `TC-5xx` S-005, `TC-6xx` S-006, `TC-7xx` S-007, `TC-8xx` cross-cutting / defect guards, `TC-9xx` randomized and property-based.
- Every criterion carries **at least one positive and one negative/edge case** (traceability matrix enforces this).
- Type: `U` unit, `I` integration, `E` E2E/CLI, `C` contract, `P` parity, `S` static/inspection, `R` randomized.
- Tests marked **TEST-FIRST** must be committed red before the corresponding implementation commit (PRD AC-24/AC-29, `implement` red→green→refactor rule).

### 5.2 S-001 — Rename the foundation documents (TC-101 to TC-118)

| ID     | Type | Scenario                                                                                                                 | Expected                                                                   | AC        |
| ------ | ---- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------- |
| TC-101 | S    | Recount old-name references per tree before the rename                                                                   | `.claude` 10, `.github` 11, `.kiro` 12, `docs` 10, `test` 2, root 5 = 50    | AC-2      |
| TC-102 | S    | Assert `core/`, `bin/`, `templates/`, `scripts/` carry zero references                                                   | 0 in each                                                                  | AC-2      |
| TC-103 | U    | **TEST-FIRST** Absence scan over `.claude`, `.github`, `.kiro`, `core`, `bin`, `test`, `docs`, root; enumerated allowlist | No unallowlisted hit                                                       | AC-2, AC-3 |
| TC-104 | U    | Seeded-positive self-test: inject `product-context.md` into a scratch file inside a scanned root                          | Matcher fires — proves the guard is live (Phase 0 pattern)                  | AC-3      |
| TC-105 | U    | **Negative/defect guard:** assert every allowlist entry is justified by name and that `docs/adr/**` + `docs/requirements/**` are allowlisted, not rewritten | Allowlist matches the enumerated set; no ADR content changed (D-35)        | AC-2, AC-3 |
| TC-106 | U    | **Defect guard:** `git check-ignore docs/product.md` and `docs/tech.md`                                                  | Exit 1 (not ignored) after `.gitignore` is updated                          | AC-1      |
| TC-107 | U    | `git check-ignore docs/runbooks/README.md`                                                                               | Exit 1 — confirms `/docs/*.md` does not reach the runbook subtree           | AC-1      |
| TC-108 | S    | `git log --follow docs/product.md` and `docs/tech.md`                                                                    | Rename detected; history continuous from the old paths                      | AC-1      |
| TC-109 | U    | Byte-compare pre/post content hashes of both documents                                                                   | SHA-256 identical (FR-46 behavior-preserving)                               | AC-1      |
| TC-110 | S    | Inspect the rename commit                                                                                                | Type `refactor:`; touches only the two paths (+ mechanical reference edits) | AC-1      |
| TC-111 | P    | Fallback paragraph present in every enumerated skill/agent, all three trees                                              | Present and identical after normalization                                  | AC-4, AC-6 |
| TC-112 | S    | Diff review: no new file under `core/` implementing name resolution                                                      | Zero new `core/` modules                                                    | AC-5      |
| TC-113 | E    | `pnpm run test` after the rename; compare failing set by full test name                                                  | Exactly the D-40 five                                                       | AC-7      |
| TC-114 | E    | `pnpm run typecheck`, `lint`, `format:check`                                                                             | All clean (baseline is clean today)                                        | AC-7      |
| TC-115 | U    | **Edge:** old name inside a fenced code block or a URL fragment                                                          | Matcher decision documented; behavior deterministic either way             | AC-3      |
| TC-116 | U    | **Edge:** `AGENTS.md.template` and `CLAUDE.md.template` (ship to consumers)                                              | Both updated; asserted explicitly, not by directory walk                    | AC-2      |
| TC-117 | U    | **Edge:** scanner must exclude `workstream/` (24 tracked hits) and `node_modules`, `dist`, `.git`, `fixtures`            | No false failure from out-of-scope trees                                    | AC-3      |
| TC-118 | S    | `docs/README.md` index rows name the new files                                                                           | Both rows updated; index still in sync with `docs/*.md`                    | AC-2      |

### 5.3 S-002 — `dev-tasks migrate docs` (TC-201 to TC-216)

| ID     | Type | Scenario                                                                                    | Expected                                                        | AC        |
| ------ | ---- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------- |
| TC-201 | U    | **TEST-FIRST** `detectOldFoundationDocs()` — both old names present                        | Both reported                                                   | AC-1      |
| TC-202 | U    | Detection — only one old name present                                                       | Exactly that one reported                                       | AC-1      |
| TC-203 | U    | Detection — neither present                                                                 | Empty result, no error                                          | AC-1      |
| TC-204 | E    | `dev-tasks migrate docs` (no flags) against a fixture with both old names                   | Prints both pending renames + consumer-owned references; exit 0 | AC-1      |
| TC-205 | E    | **Negative:** same run, then compare the whole fixture tree                                 | Byte-identical — zero mutation                                  | AC-1      |
| TC-206 | E    | **Defect-6 guard:** `dev-tasks migrate` (legacy, no sub-verb) against a legacy fixture      | Writes the manifest, exactly as today — documents the asymmetry | AC-3      |
| TC-207 | E    | `dev-tasks migrate docs --force`                                                            | Both files renamed; content hashes unchanged                    | AC-2      |
| TC-208 | U    | `--force` backup path                                                                       | `createBackupDir` + `backupFile` called; originals recoverable  | AC-2      |
| TC-209 | I    | Existing `migrate` integration cases in `bootstrap-commands.test.ts` run unmodified         | All pass without edits — a change here is a stop signal         | AC-3      |
| TC-210 | U    | `doctor` with old names present                                                             | Warning names both old files and both new names                 | AC-4      |
| TC-211 | U    | `doctor` with new names present                                                             | No old-name warning                                             | AC-4      |
| TC-212 | U    | **Negative:** `runUpdate()` against a fixture with old names                                | Neither file renamed, moved, or deleted                         | AC-5      |
| TC-213 | C    | `--json` on `migrate docs`, `migrate docs --force`, and the new `doctor` check              | Parses; conforms to the `DoctorCheck`/command-result shape      | AC-6      |
| TC-214 | U    | **Edge:** new name already present **and** old name present (partial migration)             | Reported; `--force` does not clobber the new file               | AC-2      |
| TC-215 | U    | **Edge:** target exists with different content; read-only directory                         | Explicit error, no partial rename, backup intact                | AC-2      |
| TC-216 | S    | `README.md` Command Reference lists `dev-tasks migrate docs`; migration subsection states propose-default, `--force` applies, backups written, consumer-paced | All four sub-clauses present | AC-8      |

### 5.4 S-003 — Runbooks scaffold and initial set (TC-301 to TC-318)

| ID     | Type | Scenario                                                                                              | Expected                                                          | AC        |
| ------ | ---- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- |
| TC-301 | U    | **TEST-FIRST** `INSTALL_IF_ABSENT_FILES` accepts a platform-agnostic entry                            | Type admits the agnostic tag; no third delivery category added     | AC-1      |
| TC-302 | I    | `install --profile all` with an agnostic entry                                                        | Delivered exactly once; one manifest entry                        | AC-1      |
| TC-303 | I    | `install --profile copilot` (single platform) with an agnostic entry                                  | Still delivered once — not dropped                                | AC-1      |
| TC-304 | I    | `install` into a temp repo                                                                            | `docs/runbooks/`, `docs/runbooks/README.md`, runbook template created | AC-2      |
| TC-305 | U    | **TEST-FIRST, defect-5 guard:** reverse coverage — enumerate the 10 files under `templates/scripts/`, `templates/workflows/`, `.github/workflows/` and assert each appears in some runbook's `related` | All 10 covered — **fails today at `templates/scripts/release.sh`** | AC-5      |
| TC-306 | U    | Assert `runbook-release-npm` `related` distinguishes `templates/scripts/release.sh` from `scripts/release.sh` | Both named if both are intended; the template one is mandatory   | AC-5      |
| TC-307 | U    | **Negative:** delete one `related` entry in a fixture                                                 | Reverse-coverage assertion fails and names the orphaned file      | AC-5      |
| TC-308 | U    | All ten runbooks exist with the exact names in AC-3                                                   | Set equality against the expected list                            | AC-3      |
| TC-309 | U    | Every runbook carries `name`, `trigger`, `owner`, `last_verified`, `related`                          | Present and typed; `last_verified` a valid ISO date               | AC-4      |
| TC-310 | U    | Every runbook body carries the five headings in order                                                 | Preconditions, Steps, Verification, Rollback, Escalation          | AC-4      |
| TC-311 | U    | `docs/runbooks/README.md` lists exactly the files on disk, with trigger/owner/last-verified columns   | Set equality both directions                                      | AC-6      |
| TC-312 | S    | `docs/README.md` links `docs/runbooks/`                                                               | Link present and resolves                                         | AC-7      |
| TC-313 | U    | `bundle-manifest.json` `consumer_owned_paths` contains `docs/runbooks/`                               | Present (one artifact — see observation 2.8g)                     | AC-8      |
| TC-314 | I    | Second `install` after a consumer **edits** a runbook                                                 | File untouched — install-if-absent honored                        | AC-2, AC-8 |
| TC-315 | I    | Second `install` after a consumer **deletes** a runbook                                               | Re-scaffolded (behavior must be stated either way)                | AC-2      |
| TC-316 | I    | `update` after a consumer fills in a runbook                                                          | Never overwritten                                                 | AC-8      |
| TC-317 | U    | **Edge:** a `related` path that exists at write time but is deleted later                             | Surfaces via S-004's condition 4, not silently                    | AC-5      |
| TC-318 | S    | `runbook-setup-simplicity-tooling` documents a Phase 4 capability                                     | Written against `SIMPLICITY.md`'s stated contract; `last_verified` reflects it | AC-3, AC-4 |

### 5.5 S-004 — `core/checks` and the `lint` gate (TC-401 to TC-420)

| ID     | Type | Scenario                                                                                                         | Expected                                                                       | AC        |
| ------ | ---- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- |
| TC-401 | E    | **DEFECT-1 guard, TEST-FIRST:** in a clean checkout with no `dist/`, run `pnpm run lint`                          | Exits 0 — the docs check must not require a prior `build`                       | AC-7      |
| TC-402 | E    | **DEFECT-1 guard:** `rm -rf dist && pnpm run validate`                                                            | Passes at the D-40 baseline — no MODULE_NOT_FOUND                               | AC-7      |
| TC-403 | S    | **DEFECT-1 guard:** assert `validate`'s chain contains no `build`, and that `lint`'s docs step is build-independent | Static assertion on `package.json` scripts                                       | AC-7      |
| TC-404 | S    | **DEFECT-1 guard:** assert `publish-npm.yml` still runs `validate` before `build` and that this is now harmless   | Ordering unchanged; gate passes                                                  | AC-7      |
| TC-405 | C    | **DEFECT-2 guard:** every module reachable from `dist/core/checks/` imports only `dependencies` + node builtins   | No `devDependencies` import in shipped code                                      | AC-1      |
| TC-406 | I    | **DEFECT-2 guard:** `npm pack`, install the tarball into a scratch repo with production-only install, invoke the check | Resolves and runs — no `ERR_MODULE_NOT_FOUND`                                  | AC-1      |
| TC-407 | U    | **TEST-FIRST** `checkDocsStructure(repoRoot)` on a clean tree                                                     | `{ failures: [], stale: [] }`                                                   | AC-1      |
| TC-408 | U    | Index lists a file that does not exist                                                                            | One failure naming file and condition                                           | AC-2      |
| TC-409 | U    | Index omits a file that exists in its own directory                                                               | One failure naming the omitted file                                             | AC-3      |
| TC-410 | U    | **False-positive guard (2.8a):** `docs/README.md` names root files (`AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `DESIGN.md`, `TESTING.md`) and `../README.md` | Zero failures — resolution is repo-root-aware | AC-2      |
| TC-411 | U    | **False-positive guard (2.8b):** `docs/` contains `adr/` (8 files) and `requirements/` (4 files) not listed in `docs/README.md` | Zero failures — the omission rule is non-recursive                | AC-3      |
| TC-412 | U    | Runbook with a missing frontmatter key (one case per key)                                                         | One failure per missing key                                                     | AC-4      |
| TC-413 | U    | Runbook filename violating `^runbook-[a-z0-9]+(-[a-z0-9]+)+\.md$`                                                 | Failure — with the regex as the stated oracle (see 3.3)                          | AC-4      |
| TC-414 | U    | `related` entry naming a non-existent script or workflow                                                          | Failure naming the dangling path                                                | AC-5      |
| TC-415 | U    | `last_verified` older than 90 days                                                                                | Appears in `stale`, **not** in `failures`; exit code unaffected                 | AC-6      |
| TC-416 | U    | `last_verified` exactly 90 days old, and 91 days old                                                              | Boundary behavior explicit and documented                                       | AC-6      |
| TC-417 | U    | `docs/runbooks/` absent entirely                                                                                  | No findings at all                                                              | AC-9      |
| TC-418 | U    | `docs/runbooks/` present but empty                                                                                | No findings (or a stated, tested decision)                                      | AC-9      |
| TC-419 | E    | Seed an ESLint error with a clean docs tree                                                                       | `lint` exits non-zero from ESLint, independently of the docs step               | AC-7      |
| TC-420 | S    | Inspect `core/checks/` for a registry, plugin interface, or base class                                            | None present — reviewer sign-off recorded (AC-8 is inspection-only by design)   | AC-8      |

### 5.6 S-005 — Repository shape and the package map (TC-501 to TC-516)

| ID     | Type | Scenario                                                                                       | Expected                                                            | AC        |
| ------ | ---- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------- |
| TC-501 | U    | **TEST-FIRST** Enumeration against `pnpm-workspace.yaml` with two packages                     | Both packages, names from their own `package.json`                   | AC-1      |
| TC-502 | U    | Enumeration against `workspaces` in root `package.json`                                        | Packages enumerated                                                  | AC-1      |
| TC-503 | U    | Presence-only detection for `turbo.json`, `nx.json`, `lerna.json`                              | Monorepo shape signalled; no parsing attempted                       | AC-1      |
| TC-504 | U    | Presence-only detection for `[tool.uv.workspace]` in `pyproject.toml`                          | Monorepo shape signalled                                             | AC-1      |
| TC-505 | U    | **Negative:** no signal file present (this repository's own shape)                             | Single-package shape                                                 | AC-1, AC-3 |
| TC-506 | U    | Single-package shape produces exactly one row, for the root                                    | One row; identical column set to the monorepo case                   | AC-3      |
| TC-507 | I    | Fixture `test/fixtures/workspace-mono/` → package-map table                                    | Six columns: Package, Path, Purpose, Owner, Canonical scripts, Bounded context | AC-2 |
| TC-508 | I    | Fixture `test/fixtures/workspace-single/` → package-map table                                  | Same six columns, one row                                            | AC-2, AC-3 |
| TC-509 | U    | Canonical-scripts column = intersection of root canonical names with the package's own scripts | Correct intersection, not a copy of the root list                    | AC-2      |
| TC-510 | U    | `doctor` drift: package on disk with no map row                                                | Warn, do **not** fail; exit code unchanged                           | AC-6      |
| TC-511 | U    | `doctor` drift: map row with no package on disk                                                | Warn, do not fail                                                    | AC-6      |
| TC-512 | U    | `doctor` with map and workspace in agreement                                                   | No drift warning                                                     | AC-6      |
| TC-513 | U    | **Edge:** workspace glob matching zero packages; package with no `name`; nested workspaces; empty `pnpm-workspace.yaml` | Each handled deterministically, no crash             | AC-1      |
| TC-514 | P    | `Mono-Repo` string absent from `activity-init` in all three trees; no dangling cross-reference to the old mode name | Zero hits; Mode Detection and Final Instructions updated | AC-5, AC-8 |
| TC-515 | S    | `activity-init` Final Instructions enumerate `docs/product.md`, `docs/tech.md`, `docs/runbooks/README.md` and the `SIMPLICITY.md` owner/threshold confirmation | All four present | AC-7   |
| TC-516 | S    | `docs/tech.md` on this branch carries a conforming one-row package map; Bounded context freeform and citing D-45 | Table present and conforming                        | AC-2, AC-4 |

### 5.7 S-006 — Package-aware agents (TC-601 to TC-610)

| ID     | Type | Scenario                                                                                                   | Expected                                                     | AC        |
| ------ | ---- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------- |
| TC-601 | P    | `researcher`, `plan`, `implement` carry the package-naming instruction with the `feat(api):` example        | Present and identical (normalized) in all three trees         | AC-1, AC-6 |
| TC-602 | S    | `docs/tech.md` states the root fan-out contract and that root `validate` is the single entry point          | Section present; no second command introduced                 | AC-2      |
| TC-603 | S    | **Negative:** no new script added to `package.json`                                                         | Script set unchanged except `lint`'s docs step                | AC-2      |
| TC-604 | S    | `TESTING.md` declares per-package runners where they differ                                                 | Section present                                               | AC-3      |
| TC-605 | I    | `activity-test-standards` reachability procedure run against the S-005 monorepo fixture                     | Every fixture package reachable from root `test`              | AC-3      |
| TC-606 | S    | **Negative:** no per-package glossary file created anywhere                                                 | Glossary remains one root file                                | AC-4      |
| TC-607 | S    | **Negative:** no per-package simplicity baseline or ratchet mechanism added                                 | One root baseline keyed by path                               | AC-5      |
| TC-608 | P    | `qa-engineer` content parity for the changed sections                                                       | Identical after normalization                                 | AC-6      |
| TC-609 | U    | **Edge:** single-package repository — scope optional, never empty (`feat():` must not be produced)          | Instruction unambiguous; asserted as text                     | AC-1      |
| TC-610 | U    | **Edge:** package name invalid as a Conventional Commits scope; package with no `test` script               | Documented fallback stated in `plan`/`implement`              | AC-1, AC-3 |

### 5.8 S-007 — Runbook coverage and docs ownership (TC-701 to TC-710)

| ID     | Type | Scenario                                                                                                    | Expected                                                        | AC        |
| ------ | ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------- |
| TC-701 | P    | `verifier` carries the FR-49b trigger with the three-or-more-steps threshold and the five step categories    | Present, identical in all three trees                            | AC-1, AC-7 |
| TC-702 | S    | The finding is declared advisory and explicitly non-blocking                                                 | Wording present and consistent with the drift policy             | AC-2      |
| TC-703 | P    | `infra-engineer`, `developer`, `qa-engineer`, `housekeeping` each carry the FR-49b clause for their own scope | All four present, all three trees                                | AC-3, AC-7 |
| TC-704 | S    | The FR-49a same-PR delivery rule is stated in the owning agents' instructions                                | Present and names scripts, workflows, and infra change kinds     | AC-4      |
| TC-705 | P    | `technical-writer` carries the five hygiene rules                                                            | Index sync, frontmatter, naming, dangling `related`, staleness   | AC-5, AC-7 |
| TC-706 | S    | `housekeeping` explicitly does **not** own documentation organization                                        | Statement present; no overlap with `technical-writer`            | AC-6      |
| TC-707 | S    | A docs-structure `validate` failure message routes to `technical-writer`                                     | Routing stated in the failure output and in `AGENTS.md`/`CLAUDE.md` | AC-6   |
| TC-708 | S    | **Negative:** no deterministic condition from `core/checks` is re-implemented in agent prose                 | No duplicated logic                                              | AC-1      |
| TC-709 | U    | **Edge:** PR with 3 config steps and an updated existing runbook → no finding; PR with 2 steps → no finding  | Threshold behavior bounded and stated                            | AC-1      |
| TC-710 | E    | Run `verifier` audit against this phase's own PR                                                             | Runbook-coverage trigger does **not** fire (S-003 delivered runbooks) | AC-1  |

### 5.9 Cross-cutting and PRD-level (TC-801 to TC-816)

| ID     | Type | Scenario                                                                                            | Expected                                                    | Criterion  |
| ------ | ---- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------- |
| TC-801 | E    | Full `pnpm run validate` after every story                                                          | D-40 five-failure set unchanged, by full test name           | all        |
| TC-802 | E    | `pnpm audit --prod`                                                                                 | No new advisory (and none introduced by a `yaml` promotion)  | gate       |
| TC-803 | S    | PRD AC-22 scope check including the now-absent `adapters/`                                          | Absence of `adapters/` recorded, not silently dropped        | PRD AC-22  |
| TC-804 | E    | PRD AC-23: consumer fixture on the old names runs `doctor`                                          | Warning names both files and both new names                  | PRD AC-23  |
| TC-805 | E    | PRD AC-24: each of the five structural conditions seeded → `validate`                               | Fails on the four hard conditions; reports the staleness one | PRD AC-24  |
| TC-806 | U    | PRD AC-25: full 10-file reverse coverage (same oracle as TC-305)                                    | All covered                                                  | PRD AC-25  |
| TC-807 | S    | PRD AC-26: three files + `SIMPLICITY.md` confirmation enumerated in `activity-init`                 | All four present                                             | PRD AC-26  |
| TC-808 | U    | PRD AC-29: monorepo package map + `doctor` drift warning                                            | Both halves asserted                                         | PRD AC-29  |
| TC-809 | S    | PRD AC-30: record that the CI half is Phase 4; assert no `validate.yml` is created in this phase    | Split deliberate and documented                              | PRD AC-30  |
| TC-810 | E    | Fresh-clone smoke: clone the merge commit, `pnpm install`, `pnpm run validate`                      | Passes at the D-40 baseline with no prior `build`            | DEFECT-1   |
| TC-811 | I    | Packaged-consumer smoke: `npm pack` → install → invoke the shipped check                            | Runs without a missing-module error                          | DEFECT-2   |
| TC-812 | U    | ADR/PRD immutability: assert no file under `docs/adr/` changed in the rename commit                 | Zero ADR diffs (D-35)                                        | DEFECT-3   |
| TC-813 | U    | `.gitignore` negations updated for both new names                                                   | `!/docs/product.md`, `!/docs/tech.md` present                | DEFECT-4   |
| TC-814 | P    | Three-tree parity after every prompt-content story, using the normalization defined for S-001 AC-6  | No divergence                                                | parity     |
| TC-815 | S    | Commit-order evidence: each behavioral increment has a red `test:` commit before its implementation | Red→green sequence visible in `git log`                      | PRD AC-24  |
| TC-816 | S    | Conventional Commits and branch discipline on `integration/prd-shared-understanding-phase-1`        | No direct commit to `main`; all types valid                  | policy     |

### 5.10 Randomized and property-based tactics (TC-901 to TC-906)

Seed policy: every randomized case takes an explicit integer seed, printed on failure. Default seed `20260919`. Failures are replayed with `SEED=<n> pnpm run test:unit -- <file>`.

| ID     | Type | Property                                                                                                                | Generator                                                                 |
| ------ | ---- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| TC-901 | R    | For any generated runbook frontmatter, `checkDocsStructure` never throws — it returns findings or none                   | Random key subsets, malformed dates, non-list `related`, empty strings, BOM, CRLF |
| TC-902 | R    | For any generated `docs/` tree, `failures` and `stale` are disjoint and staleness never affects the exit code            | Random file sets, random `last_verified` offsets in [-400, +400] days      |
| TC-903 | R    | Index/disk agreement is symmetric: a file added to disk and to the index in the same run yields zero findings            | Random filename sets matching the runbook regex                            |
| TC-904 | R    | `migrate docs` without `--force` is a no-op for any starting tree state                                                 | Random presence/absence of each of the four filenames, random contents      |
| TC-905 | R    | Workspace enumeration is stable and order-independent                                                                   | Random package counts 0..12, random globs, random `name` presence           |
| TC-906 | R    | The old-name scanner has no false positives on adjacent strings                                                         | Fuzz around `product-context`, `product_context`, `productcontext.md`, `tech.md` inside URLs and code fences |

**Failure triage (per `verifier` contract):** capture seed + input + output → replay with the seed → minimize → classify as *spec gap* (escalate to `product-engineer`), *implementation defect* (file for `developer`), or *flaky/environmental* (log with environment, mark `inconclusive`). Maximum 3 replay attempts before `inconclusive`.

---

## 6. Edge-Case Catalog

| Category              | Cases                                                                                                                                                                | Covered by                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Input domain          | Old name in a code fence, URL fragment, or filename-like prose; `product_context` vs `product-context`; template files; BOM/CRLF frontmatter                          | TC-115, TC-116, TC-906, TC-901      |
| State transition      | Partial migration (new name + old name both present); target exists with different content; consumer deleted vs. edited a runbook; second `install`; `update` after fill | TC-214, TC-215, TC-314, TC-315, TC-316 |
| Timing / staleness    | `last_verified` at exactly 90 days, 91 days, in the future, unparseable                                                                                               | TC-415, TC-416, TC-901              |
| Idempotency           | `migrate docs` twice; `install` twice; `install --profile all` vs single platform for the agnostic entry                                                              | TC-205, TC-302, TC-303, TC-314, TC-904 |
| Failure modes         | Read-only directory; missing `dist/`; missing `yaml` at runtime; MODULE_NOT_FOUND; dangling `related`                                                                 | TC-215, TC-401, TC-402, TC-406, TC-414 |
| Auth / permissions    | Not applicable — no new credential or network surface (spec §12)                                                                                                      | —                                   |
| Data boundaries       | Workspace glob matching zero packages; package with no `name`; nested workspaces; empty `pnpm-workspace.yaml`; empty `docs/runbooks/`                                 | TC-513, TC-418, TC-905              |
| Resource exhaustion   | Bounded single-pass scan — asserted not proportional to source size (OQ-12 / Phase 4 CI budget)                                                                       | TC-407 (timing assertion)           |
| Path resolution       | Index entry pointing outside the directory (`../README.md`), at a directory (`requirements/`), into a subdirectory (`adr/README.md`), or outside the repository       | TC-410, TC-411                      |
| API versioning        | `--json` shape stability across `migrate docs`, `migrate docs --force`, and the two new `doctor` checks                                                              | TC-213                              |
| Packaging             | Shipped `dist/core/` importing a `devDependency`; production-only install                                                                                            | TC-405, TC-406, TC-811              |
| VCS                   | `.gitignore` negation coverage; `git mv` rename detection; ADR immutability                                                                                          | TC-106, TC-107, TC-108, TC-812, TC-813 |

---

## 7. Execution Checklist

Run in story order. Each story's gate must be green before the next begins.

- [ ] **Pre-flight:** route §2's seven defects to the calling session. DEFECT-1 and DEFECT-3 **block** S-004 and S-001 respectively as written.
- [ ] Record the baseline: `pnpm run typecheck`, `lint`, `format:check`, `test` (expect the D-40 five).
- [ ] S-001: TC-101 to TC-118, then TC-801. Gate: absence test green with an enumerated allowlist; D-40 unchanged.
- [ ] S-002: TC-201 to TC-216, then TC-801. Gate: legacy `migrate` cases pass unmodified.
- [ ] S-003: TC-301 to TC-318, then TC-801. Gate: **TC-305 green** (all 10 AC-25 files covered).
- [ ] S-004: TC-401 to TC-420, TC-810, TC-811, then TC-801. Gate: **TC-401/TC-402 green in a clean checkout with no `dist/`**.
- [ ] S-005: TC-501 to TC-516, then TC-801.
- [ ] S-006: TC-601 to TC-610, then TC-801.
- [ ] S-007: TC-701 to TC-710, then TC-801, TC-802, TC-814, TC-815, TC-816.
- [ ] PRD-level sweep: TC-803 to TC-809.
- [ ] Randomized sweep: TC-901 to TC-906 with seed `20260919`; record any failure per the triage workflow.
- [ ] Hand off to `verifier` Audit Mode against the consolidated PR.

## 8. Open Items for the Calling Session

1. **Route DEFECT-1** (lint chain) — blocks S-004 task 4.9. Recommend `tsx core/checks/run.ts`.
2. **Route DEFECT-2** (`yaml`) — contradicts task 4.10's instruction. Recommend hand-parsing the five-key frontmatter.
3. **Route DEFECT-3** (ADR/PRD allowlist) — blocks S-001 task 1.1. Needs an enumerated allowlist before the test is written.
4. **Route DEFECT-4** (`.gitignore`) — needs a new sub-task under S-001.
5. **Route DEFECT-5** (`templates/scripts/release.sh`) — one-line fix to task 3.7.
6. **Route DEFECT-6** (`migrate` semantics) — decide whether the asymmetry is accepted; record as a decision.
7. **Route DEFECT-7** (46 vs 50) — spec §8.1/§14/§16 need correcting to 50.
8. **GAP-1** (FR-49a change kinds) — add to S-003 or record a deliberate deferral with a decision ID.
9. **25 criteria not verifiable as written** — §3 gives a verifiable restatement for each.
10. Confirm **D-46** (tenth runbook — justified by this analysis) and **D-47** (one consolidated PR).
