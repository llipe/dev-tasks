# Specification: Token-Usage Optimization for the dev-tasks Workflow

> **Status:** Draft — ready for implementation
> **Type:** Tooling / configuration (non-application-code)
> **Author:** Analysis session (Kiro)
> **Intended executor:** Any agent or developer in a fresh environment
> **RFC 2119:** MUST / SHOULD / MAY are used with their standard meanings.

---

## 1. Purpose

The `home-ledger` repository drives an agent workflow (planner, developer,
product-engineer, housekeeping, technical-writer, plus activity skills) through
three parallel definition trees (`.kiro/`, `.github/`, `.claude/`) and a set of
Kiro steering files that are injected into model context.

An analysis found that a large amount of context is injected on **every turn**
regardless of relevance, and that several rules are mis-scoped or duplicated.
This spec defines the concrete changes required to cut recurring token usage
**without losing any guidance** — activity rules should load exactly when their
artifacts are in play, not on every interaction.

This spec is self-contained: it restates the findings and the exact edits so it
can be executed in an environment that does not have access to the original
analysis session.

---

## 2. Background: how tokens are consumed

Two cost buckets exist:

1. **Per-turn injected context** — Kiro steering files with `inclusion: always`
   and the workspace `AGENTS.md` load into context on every turn. This is the
   dominant recurring cost because it is multiplied by every turn in every
   session.
2. **On-demand context** — agent definition files and skill `SKILL.md` files
   are read when an agent/skill is invoked. Lower recurring cost, but subject to
   drift because the same content is triplicated.

### 2.1 Measured baseline (word counts, ~tokens ≈ words × 1.35)

Always-injected on every turn:

| File | Words | ~Tokens | Actually relevant when |
| --- | --- | --- | --- |
| `AGENTS.md` | 1,792 | ~2,400 | implementation / orchestration only |
| `.kiro/steering/plan.md` | 1,102 | ~1,500 | **plan** activity only |
| `.kiro/steering/implement.md` | 959 | ~1,300 | **implement** activity only |
| `.kiro/steering/git-guard-notice.md` | 225 | ~300 | git push / merge only |
| **Always-on baseline** | **4,078** | **~5,500 / turn** | |

Conditionally injected (`fileMatch`):

| File | Words | ~Tokens | Current pattern |
| --- | --- | --- | --- |
| `.kiro/steering/nextjs-pages-components.md` | 2,292 | ~3,100 | `**/*.tsx` |

Triple-maintained (on-demand, not auto-injected):

| Tree | Agents (words) | Skills (words) |
| --- | --- | --- |
| `.kiro/` | 14,080 | 15,178 |
| `.github/` | 13,060 | 14,924 |
| `.claude/` | 9,134 | 17,296 |

`memo-cli-usage/SKILL.md` is ~4,293 words (~5,800 tokens), roughly 4x the average
skill.

### 2.2 Key problems identified

- **P1 — Mutually exclusive playbooks are both `always`.** `plan.md` and
  `implement.md` are activity playbooks for opposite phases, yet both carry
  `inclusion: always`. Each is paid for during the other's activity and during
  all unrelated work (chat, debugging, analysis).
- **P2 — Next.js steering is mis-scoped.** `nextjs-pages-components.md` is titled
  for **Next.js** and `AGENTS.md` scopes it to `apps/management-hub/src/**/*.tsx`,
  but its `fileMatchPattern` is the much broader `**/*.tsx`. The app
  `apps/management-hub` does not exist; the real apps are `api`, `app` (Expo /
  React Native), and `scraper`. So ~3,100 tokens of Next.js rules inject on
  nearly every React Native `.tsx` edit where they do not apply.
- **P3 — `AGENTS.md` always-on footprint is broad.** It contains per-agent
  constraints and historical post-mortems that are only relevant when a specific
  agent is active (and those agents already load their own definition files).
- **P4 — Triplicated definitions.** `.kiro/steering/plan.md` is byte-identical to
  `.github/instructions/plan.instructions.md` (front-matter aside); same for
  `implement.md`. Agent files differ only by path references and front-matter.
  Duplication invites drift.
- **P5 — `memo-cli-usage` is oversized** for an on-demand skill that may be
  invoked frequently for cross-session context.
- **P6 — `git-guard-notice.md` is always-on** but only relevant to git
  operations.

---

## 3. Scope

**In scope:** Kiro steering front-matter and content, `AGENTS.md` structure,
consolidation of duplicated definition trees, skill file splitting.

**Out of scope:** Any application code under `apps/`, `packages/`, or `docs/`.
No behavioral change to the agents themselves — only what context loads and when.

**Constraint:** All guidance MUST remain reachable. The goal is *right time*,
not *removal*. No rule text may be deleted unless it is provably dead (e.g.
references a non-existent app) and confirmed with the user.

---

## 4. Requirements & Implementation Tasks

Each task lists the exact file, the change, and its acceptance criteria. Tasks
are ordered by payoff. Tasks R1 and R2 are the highest-value, lowest-risk, and
fully reversible.

### R1 — Convert activity playbooks from `always` to `fileMatch` (highest impact)

**Problem:** P1. **Est. savings:** ~2,000 tokens/turn on non-activity turns.

Change the front-matter of the two activity steering files so they load only
when their working artifacts are in context. The `implement` and `plan`
activities always operate on files under `workstream/`, so the rules still load
exactly when needed.

- File: `.kiro/steering/plan.md`
  - Current front-matter:
    ```yaml
    ---
    inclusion: always
    ---
    ```
  - Target front-matter:
    ```yaml
    ---
    inclusion: fileMatch
    fileMatchPattern: 'workstream/**/{user-stories,*-refinement,*-prd,*-plan}*.md'
    ---
    ```
- File: `.kiro/steering/implement.md`
  - Current front-matter:
    ```yaml
    ---
    inclusion: always
    ---
    ```
  - Target front-matter:
    ```yaml
    ---
    inclusion: fileMatch
    fileMatchPattern: 'workstream/**/tasks-*.md'
    ---
    ```

**Acceptance criteria:**
- AC-R1.1: Opening/referencing a `workstream/**/tasks-*.md` file causes
  `implement.md` guidance to be available; a turn with no such file does not
  inject it.
- AC-R1.2: Opening/referencing a planning artifact (user-stories / refinement /
  prd / plan doc) causes `plan.md` guidance to be available.
- AC-R1.3: The body content of both files is unchanged (only front-matter is
  edited).
- AC-R1.4: A plain chat turn with no workstream file in context injects neither
  playbook.

> **Note:** If the executing environment's `fileMatch` implementation does not
> support brace expansion `{a,b}`, split `plan.md` matching by using
> `inclusion: manual` and documenting the manual `#`-context trigger instead, or
> use the simplest reliable glob available. Verify against the host tool's
> steering docs before finalizing the pattern.

---

### R2 — Fix or retire the mis-scoped Next.js steering (high impact)

**Problem:** P2. **Est. savings:** ~3,100 tokens per React Native `.tsx` edit.

- File: `.kiro/steering/nextjs-pages-components.md`
  - Current front-matter:
    ```yaml
    ---
    inclusion: fileMatch
    fileMatchPattern: '**/*.tsx'
    ---
    ```
  - Decision gate (confirm with user before choosing):
    - **Option A (narrow):** If a Next.js surface exists or is planned, set the
      pattern to its real path, e.g.:
      ```yaml
      fileMatchPattern: 'apps/management-hub/**/*.tsx'
      ```
    - **Option B (retire):** If `apps/management-hub` will not exist, delete this
      steering file. React Native guidance for `apps/app` already lives in
      `AGENTS.md` ("Design Specification Practice — apps/app").

**Acceptance criteria:**
- AC-R2.1: Editing a `.tsx` file under `apps/app` (React Native) does NOT inject
  the Next.js pages/components rule.
- AC-R2.2: If Option A is chosen, editing a `.tsx` file under the real Next.js
  path DOES inject the rule.
- AC-R2.3: If Option B is chosen, no active React Native `.tsx` guidance is lost
  (confirm the `AGENTS.md` "apps/app" section covers the needed rules).

---

### R3 — Reduce `AGENTS.md` always-on footprint (medium impact)

**Problem:** P3.

`AGENTS.md` is injected on every turn. Split it so only truly global rules stay
always-on and agent-specific / historical content loads on demand.

- Keep always-on (global) in `AGENTS.md`:
  - Branch & PR discipline (mandatory)
  - GitHub Issue synchronization
  - Testing & type-safety gates (`pnpm test`, `pnpm typecheck`, `pnpm lint`,
    `pnpm format`)
  - The short workflow checklist
- Move out of always-on:
  - Per-agent sections ("Agent: planner", "Agent: developer", …) → each agent's
    own definition file already carries its constraints; deduplicate into those
    files.
  - "Known Procedural Failures & Safeguards" post-mortem (~400 words) → move to a
    `fileMatch` steering doc or a `docs/` reference; it is documentation, not
    per-turn instruction.
  - "Design Specification Practice — apps/app" → convert to a `fileMatch`
    steering keyed to `apps/app/**/*.tsx` (this is the correct home for the RN
    guidance referenced in R2 Option B).

**Acceptance criteria:**
- AC-R3.1: `AGENTS.md` always-on content is reduced to the global constraints and
  checklist (target: < ~800 words).
- AC-R3.2: No per-agent rule is lost — each is present in the corresponding agent
  definition file.
- AC-R3.3: The `apps/app` design-spec guidance is injected when an
  `apps/app/**/*.tsx` file is in context.
- AC-R3.4: The Registry Parity Snapshot table is preserved (in `AGENTS.md` or a
  linked doc).

---

### R4 — Collapse duplicated definition trees to one source of truth (medium impact)

**Problem:** P4. Reduces drift and on-demand read cost.

`.kiro/steering/plan.md` == `.github/instructions/plan.instructions.md` and
`.kiro/steering/implement.md` == `.github/instructions/implement.instructions.md`
(identical apart from front-matter). Agent files across `.kiro/agents`,
`.github/agents`, `.claude/agents` differ only by front-matter and path
references.

Choose one canonical mechanism and apply consistently:
- **Preferred:** Use Kiro's file-reference include (`#[[file:<relative_path>]]`)
  so shared body content exists once and is referenced from the thin
  tool-specific wrapper files.
- **Alternative:** Designate `.github/` as canonical and generate the `.kiro/`
  and `.claude/` copies via a small sync script run in CI or a pre-commit hook.

**Acceptance criteria:**
- AC-R4.1: The plan and implement rule *body* text exists in exactly one place;
  other locations reference it.
- AC-R4.2: A documented mechanism (include or sync script) prevents future
  divergence.
- AC-R4.3: Path references inside each tree still resolve correctly for that tool
  (e.g. `.kiro` agents reference `.kiro/...`, `.github` agents reference
  `.github/...`).
- AC-R4.4: No agent or activity loses content during consolidation (diff-verify
  before/after).

---

### R5 — Split the `memo-cli-usage` skill (medium impact)

**Problem:** P5. ~5,800 tokens per invocation.

Split `memo-cli-usage/SKILL.md` (present in all three skill trees) into:
- A concise "read/write a memo" quick reference (loaded by default) —
  target < ~1,200 words.
- A full CLI spec loaded only when configuring/administering memo.

**Acceptance criteria:**
- AC-R5.1: The common read/write path is documented in the small file.
- AC-R5.2: The full spec remains available and is referenced from the small file.
- AC-R5.3: Applied consistently across whichever skill trees remain after R4.

---

### R6 — Scope `git-guard-notice.md` to git contexts (low impact)

**Problem:** P6. ~300 tokens/turn.

- File: `.kiro/steering/git-guard-notice.md`
  - Option A: change `inclusion: always` → a git-scoped `fileMatch` (e.g. match
    `.kiro/hooks/git-guard.json` / `.husky/**`), OR
  - Option B: fold its single actionable line ("treat human PR review as the
    enforcement backstop for the main-merge and commit-convention rules") into
    the git section of `AGENTS.md` and remove the standalone always-on file.

**Acceptance criteria:**
- AC-R6.1: The git-guard enforcement-gap warning is preserved somewhere
  reachable.
- AC-R6.2: It no longer loads on every non-git turn.

---

## 5. Estimated impact

- R1 + R2 together drop the per-turn always-on baseline from ~5,500 tokens to
  roughly ~2,400 (the global slice of `AGENTS.md`) and remove the ~3,100-token
  Next.js injection from React Native work.
- On a ~40-turn implement session that is on the order of **200K+ tokens saved
  per session**, with no loss of guidance.
- R3–R6 add incremental savings and materially reduce drift/maintenance cost.

### 5.1 Measured Results (Post-Implementation)

| Metric | Before | After | Reduction |
| --- | --- | --- | --- |
| Always-on words (AGENTS.md + git-guard-notice.md) | ~4,078 | 1,119 | **73%** |
| Always-on tokens (~words × 1.35) | ~5,500 | ~1,511 | **73%** |
| memo-cli SKILL.md words (per invocation) | 4,293 | 553 | **87%** |
| AGENTS.md template words | ~1,792 | 1,031 | **42%** |
| git-guard-notice.md words | 225 | 56 | **75%** |
| Next.js steering scope | `**/*.tsx` | `**/app/**/*.tsx` | Scoped to App Router only |
| plan.md injection | Every turn | Only workstream files | Scoped |
| implement.md injection | Every turn | Only tasks-*.md files | Scoped |

---

## 6. Verification plan

For each change:
1. **Front-matter/content edits (R1, R2, R6):** confirm the file body is
   byte-unchanged except the intended lines (`diff` against the pre-edit copy).
2. **Injection behavior:** in the host environment, open a file that should
   trigger the rule and confirm the guidance is present; open an unrelated file
   / plain chat and confirm it is absent.
3. **No lost guidance (R3, R4, R5):** diff the aggregate rule text before and
   after; every removed line from an always-on file MUST appear in its new home.
4. **Path integrity (R4):** grep each tree for cross-references and confirm they
   resolve within the correct tool tree.

There is no application build to run for these changes. If the repo has a
docs/lint check for steering front-matter, run it. Otherwise verification is the
diff + injection-behavior checks above.

---

## 7. Execution notes for a fresh environment

- These are configuration/documentation changes only. They fall under the
  `AGENTS.md` exception allowing `.github/`-style config updates, but since they
  also touch `.kiro/` steering and `AGENTS.md` itself, the executor SHOULD open a
  feature branch and a PR rather than committing to `main` directly, per the
  repo's branch/PR discipline.
- Suggested branch: `chore/token-optimization-devtasks-steering`.
- Suggested PR title (Conventional Commits):
  `chore: reduce dev-tasks per-turn token usage via scoped steering`.
- R2 and R6 have a decision gate (retire vs. narrow) — confirm with the user
  before deleting any file.
- Apply R1 first (safest, largest win), verify, then proceed.

---

## 8. Task checklist (for the implement activity)

- [ ] R1.1 Edit `.kiro/steering/plan.md` front-matter to `fileMatch` (planning artifacts)
- [ ] R1.2 Edit `.kiro/steering/implement.md` front-matter to `fileMatch` (`tasks-*.md`)
- [ ] R1.3 Verify injection behavior for both (AC-R1.1..R1.4)
- [ ] R2.1 Decide Option A (narrow) vs B (retire) with user
- [ ] R2.2 Apply chosen change to `nextjs-pages-components.md`
- [ ] R2.3 Verify RN `.tsx` no longer triggers the rule (AC-R2.1..R2.3)
- [ ] R3.1 Split `AGENTS.md` into global always-on + on-demand sections
- [ ] R3.2 Move per-agent rules into agent definition files (dedupe)
- [ ] R3.3 Convert `apps/app` design-spec section to `fileMatch` steering
- [ ] R3.4 Verify no per-agent rule lost (AC-R3.1..R3.4)
- [ ] R4.1 Choose canonical mechanism (include vs sync script)
- [ ] R4.2 Deduplicate plan/implement bodies and agent defs
- [ ] R4.3 Verify path references + no content loss (AC-R4.1..R4.4)
- [ ] R5.1 Split `memo-cli-usage` into quick-ref + full spec
- [ ] R5.2 Verify across remaining skill trees (AC-R5.1..R5.3)
- [ ] R6.1 Scope or fold `git-guard-notice.md` (AC-R6.1..R6.2)
- [ ] Final: diff-verify all always-on reductions; open PR
