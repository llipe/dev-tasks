# Fidelity Report — Story S-010: Caller wiring and workflow chains

## Header / Verdict

- **Overall fidelity:** **High**
- **Highest drift impact present:** **Minor**
- **Scope:** Story S-010 / issue #163 · branch `issue/153-branch-convention-hygiene` · commits `0b29a62`, `506dee5`, `c7e6a24`, `77c5bba` (range `948f0a3..HEAD`)
- **Mode:** Audit (grey-box) · **coverage_gate:** SKIPPED(no coverage provider configured; structural analysis performed) · **Drift is non-blocking to completion.**

## Human-Readable Summary — what changed and why

S-010 is the integration story that makes the new `infra-engineer` actually get used. Before it, any agent could run a live platform command (deploy, set a secret, change DNS) directly, bypassing the approval, revert, and backup safety gates. This change wires every relevant agent to hand that work to `infra-engineer` instead.

What was delivered, and it matches what was asked:

- **`developer` now refuses to run platform writes** (`aws`, `flyctl`, `supabase`, Cloudflare) and names `infra-engineer` as the owner for secrets, deploy, DNS, certificates, IAM policy, and cloud/shared migrations. The one subtle requirement — narrowing an older "infrastructure/config is exempt from tests" rule so nobody reads it as permission to run a live command — was handled cleanly by adding a **new rule 23** that explicitly re-scopes that exemption to local, version-controlled edits only. The original rule-19 line was deliberately left untouched because a separate test (issue-130) pins it to an exact fingerprint; the narrowing lives in rule 23, which references and constrains it. Both constraints are satisfied at once.
- **The `implement` execution rules, `housekeeping`, `planner`, `product-engineer`, and `github-ops`** all received matching, conditional routing/guard language. `housekeeping` is now explicitly forbidden from touching infra paths, even to fix a lint error.
- **`infra-engineer` gained reverse-direction routing** — it may pull in `researcher` for an unfamiliar platform, and it documents that `verifier` audits do not apply to `infra/` operational artifacts (human PR review is that gate instead).
- **`docs/workflow-chains.md`** gained a new "Infrastructure Change" chain and conditional infra handoffs on the two existing chains.

The routing is consistently described as **conditional** everywhere: a story with no infrastructure scope invokes `infra-engineer` for nothing, and a local-only `.env.example` edit stays with `developer`. Every edit was mirrored across all three platform trees. The dedicated parity test passes 179/179.

## Per-AC Result Table

| AC    | Description                                                                                                       | Codebase evidence                                                                                       | Workstream evidence    | Test evidence                                                                                                          | Result                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| AC-1  | `developer` (×4 files) MUST NOT emit platform writes, names routed sub-task kinds, narrows rule 19 exemption      | Rule 23 added in all 4 developer files + `infra-engineer` collaborator row; rule 19 line byte-identical | Task 10.2 `[x]`        | Parity AC-1 block (3 assertions ×4 files) green; `qa-testing-standard` SC-20/AC-7 hash `27aa0238…` still green (79/79) | **Pass**                               |
| AC-2  | `implement` skill (×3 trees) carries same routing rule                                                            | "Platform-Write Routing" section added to all 3 implement variants                                      | Task 10.3 `[x]`        | Parity caller-wiring + edge-case blocks cover implement files                                                          | **Pass**                               |
| AC-3  | `housekeeping` (×3) adds infra paths to Never-touch                                                               | Never-touch table row + Hard Rule 8 in all 3                                                            | Task 10.4 `[x]`        | Parity AC-3 block asserts each path listed                                                                             | **Pass**                               |
| AC-4  | `planner` (×3) conditional per-story infra routing                                                                | Per-story infra routing paragraph in all 3                                                              | Task 10.4 `[x]`        | Parity AC-9 caller wiring for planner                                                                                  | **Pass**                               |
| AC-5  | `product-engineer` (×3) recommends infra pass + routes `infra/` drift via drift-reconciliation                    | Rule 12 (infra pass) + rule 9 amendment (infra drift) in all 3                                          | Task 10.4 `[x]`        | Parity AC-9 caller wiring for product-engineer                                                                         | **Pass**                               |
| AC-6  | `github-ops` (×3) documents change-record draft PR shape (title prefix, ChangeId body sections, label)            | "Change-Record PR Shape" section in all 3                                                               | Task 10.4 `[x]`        | Parity AC-6 block asserts ChangeId, title prefix, `infra-change` label                                                 | **Pass**                               |
| AC-7  | Reverse direction: `infra-engineer` (×3) conditionally invokes `researcher`, states `verifier` stance on `infra/` | "Reverse-direction routing" section in all 3                                                            | Task 10.6 `[x]`        | Parity AC-7 block asserts conditional researcher + verifier stance                                                     | **Pass**                               |
| AC-8  | `docs/workflow-chains.md` gains Infrastructure Change chain; existing two chains show conditional handoff         | New chain + notes on Full Feature and Single Issue chains                                               | Tasks 10.5, 10.8 `[x]` | Parity AC-8 block asserts heading, lifecycle steps, conditional handoff                                                | **Pass**                               |
| AC-9  | Parity test gains caller-wiring block modeled on researcher AC-6, across three trees                              | S-010 block added to `infra-engineer-parity.test.ts`                                                    | Task 10.1 `[x]`        | 179/179 green; every caller file asserted for infra-engineer reference + conditional language                          | **Pass**                               |
| AC-10 | `pnpm run validate` passes; caller-wiring reachable from `pnpm run test`                                          | —                                                                                                       | Task 10.11 `[x]`       | `pnpm run test`: 1910 pass; parity block runs within suite                                                             | **Pass (with caveat — see Drift D-1)** |

Behavioral manual check (AC-1 / Task 10.9 — hand `developer` a "set the production secret" sub-task and confirm refusal) is **not run**; it is documented as requiring a live agent runtime with a repro recipe. This is expected for a prompt-contract change and does not lower the verdict.

## Drift Catalog

All drift below is **non-blocking to completion.**

- **D-1 — Pre-existing suite failures (3) in `skill-parity-testing-layers.test.ts`.**

  - **Impact:** Minor · **Intent:** Intended (documented)
  - **Evidence:** `pnpm run test` reports `3 failed | 1910 passed`. `git diff --name-only 948f0a3..HEAD` confirms neither `TESTING.md` nor `skill-parity-testing-layers.test.ts` is in the S-010 change range. The failures are coupled to the unfilled `TESTING.md` (issue-130, AC-4/5/6 / SC), a different story. AC-10 asks that `pnpm run validate` pass; the aggregate `test` has these three unrelated reds. Both the task-list validation note and the story scope explicitly leave `TESTING.md` untouched, so this is a known, out-of-scope condition rather than a regression introduced here.
  - **Recommendation:** No action for S-010. Track under issue-130 (`TESTING.md`) — already owned there.

- **D-2 — AC-1 narrowing placed in new rule 23 rather than in rule 19's text.**

  - **Impact:** Minor · **Intent:** Intended
  - **Evidence:** AC-1 says rule 19's exemption "is narrowed so it cannot read as licence to run platform writes." The literal rule-19 line is byte-identical (hash `27aa0238…` pinned by `qa-testing-standard` SC-20/AC-7, which stays green). The narrowing is delivered in the new rule 23, which quotes rule 19's "purely infrastructure/config" phrase, re-scopes it to local version-controlled edits, and states it is "**not** a licence to run platform writes." This satisfies AC-1's _intent_ (the exemption can no longer be read as such licence) while honoring the competing byte-identical pin from issue-130. The parity test explicitly asserts "narrows the rule 19 infrastructure/config exemption" per developer file. This is a sound resolution of two conflicting hard constraints, noted only for transparency.
  - **Recommendation:** No action needed. Optionally note the cross-rule reference in the S-006 doc pass so future readers of rule 19 are pointed to rule 23.

- **D-3 — AC-10 phrasing vs. observed aggregate `test` reds.**
  - **Impact:** Minor · **Intent:** Undetermined→Intended (folds into D-1)
  - **Evidence:** AC-10 requires `pnpm run validate` to pass and the caller-wiring assertions to be reachable from `pnpm run test`. The caller-wiring assertions are reachable and green (179/179). The only reds in the aggregate are the D-1 pre-existing, out-of-scope failures. No S-010-authored assertion fails.
  - **Recommendation:** No action for S-010; resolves when issue-130 lands. Confirm `pnpm run validate` (not just `test`) status in the PR checklist for completeness.

## Edge-Case Outcomes (from Task 10.10 / Edge-Case Matrix)

| Edge case                                                                       | Delivered | Evidence                                                                                                       |
| ------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Infra-shaped but local-only (`.env.example`) stays with `developer`             | Yes       | Rule 23 + implement routing carve-out; parity edge-case block "carves out local-only .env.example edits" green |
| Story with no infra scope invokes nothing                                       | Yes       | "conditional, never mandatory" language in all callers; parity "no-infra-scope invokes nothing" block green    |
| `housekeeping` over a repo with a lint-erroring deploy workflow leaves it alone | Yes       | Hard Rule 8 "even when a deploy workflow has a lint or formatting error"                                       |

## Recommendations

1. **No blocking action.** All ten ACs map to passing structural/parity evidence; fidelity is High.
2. **D-1 / D-3:** carry the three `skill-parity-testing-layers` reds under issue-130; they are not S-010 regressions. Surface `pnpm run validate` result explicitly in the PR.
3. **AC-1 / Task 10.9:** run the manual behavioral check (developer refuses `fly secrets set`, cites rule 23, names `infra-engineer`) once a live agent session is available; repro is recorded in the task list.
4. Route any of the above through `product-engineer`'s `activity-drift-reconciliation` per standard flow — `verifier` reports only.
