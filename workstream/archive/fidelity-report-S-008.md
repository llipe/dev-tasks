# Fidelity Report — Story S-008: deploy-ops skill and script templates

## Header / Verdict

- **Overall fidelity verdict:** **High**
- **Highest drift impact present:** **Minor**
- **Scope:** Issue #161 · Story S-008 · branch `issue/153-branch-convention-hygiene`
- **Mode:** Audit (grey-box) · **Result:** All 10 ACs met; 1 Minor Unintended drift; drift is non-blocking.

## Human-Readable Summary — what changed and why

Story S-008 delivered a canonical set of deploy scripts — `deploy`, `deploy-verify`,
`rollback`, `deploy-status`, and a generalized `release` — plus a `deploy-ops` skill
that documents how they fit together, shipped identically across all three platform
trees. The goal was that any operator, from any machine or CI runner, can deploy and
roll back the same way, with every deploy recorded.

What was asked for is essentially all present and working. The scripts read the
environment definition from a YAML file, refuse to run against an unfilled template,
follow a fixed eight-step deploy order that can never skip validation or a production
backup, and treat production specially: a production deploy is only allowed from a
proper release tag, and a rollback figures out the previous good version on its own.
The safety guards that matter most are in place — production deploys triggered by
automation still require a human to have signed off, and no deploy ever points at a
mutable "latest" label. The automated tests that back all of this pass (41 of 41 for
the script contract, 87 of 87 for the three-tree skill parity).

The one gap worth flagging is small and defensive-in-depth rather than a hole in the
main protection. The requirement said the human-only guard should stop a production
deploy in two situations: when running under CI without explicit approval, **and** when
running in a non-interactive (agent) context. The `release` script guards against both.
The `deploy` script guards against the first (CI without approval) but not the second
(a non-interactive context where the `CI` variable is not set). In practice most agent
and CI environments do set `CI`, so the existing guard catches the common case; the
uncovered sliver is a non-interactive run where `CI` happens to be unset. The skill's
documentation describes both guards as applying to both scripts, so the code is slightly
behind its own documentation here. This does not block completion and is routed to
product-engineer's drift-reconciliation for a decision (fix the script, or narrow the
wording).

## Per-AC Result Table

| AC | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-1 | `deploy-ops/SKILL.md` in three trees with script-contract table, env-mapping table, tag-policy summary referencing `github-ops`, deploy-target framing with decision inputs, workflow scaffolding; declares `yq` (4.x) and `gh` | All present in `.github/.claude/.kiro/skills/deploy-ops/SKILL.md`; bodies identical after frontmatter | task 8.6 `[x]` | `skill-parity-infra.test.ts` deploy-ops block (all statements) PASS | **Pass** |
| AC-2 | Five scripts exist, `bash` + `set -euo pipefail`, `--help`; `deploy.sh`/`release.sh` support `--dry-run` | All 5 in `templates/scripts/`; strict mode + `--help` + dry-run confirmed | task 8.2–8.4 `[x]` | presence/shape + `bash -n` + `--help` tests PASS | **Pass** |
| AC-3 | `deploy.sh` runs preflight→validate→build→backup→migrate→deploy→verify→record; exit 2 on blocked; no flag skips `validate` or prod backup | Eight `Step N/8` steps in order; `validate`/`backup` unconditional for prod; `blocked()`→exit 2 | task 8.2 `[x]` | ordered-sequence, "does not skip validate", blocked-condition tests PASS | **Pass** |
| AC-4 | Production refuses any ref that is not an annotated tag on `main`; non-prod deploys `main` HEAD | `step_preflight`: exact-match tag, annotated-object check, `merge-base --is-ancestor origin/main`; else "non-production deploys main HEAD" | task 8.9 `[x]` | prod non-tag refusal, lightweight-tag, tag-not-on-main tests PASS (real git repo) | **Pass** |
| AC-5 | `deploy-verify.sh` exits 3 on failure and prints exact `rollback.sh <env>` | `deploy-verify.sh` prints `rollback.sh <env>` then `exit 3`; `deploy.sh` step 7 propagates via `|| exit $?` | task 8.3 `[x]` | exit-3-prints-rollback test PASS | **Pass** |
| AC-6 | `rollback.sh <env>` resolves previous good version from `infra/changes/` with no manual lookup; `--to` overrides | Lexical-sort of `*-<env>-*.md`, `status: good` filter, picks second-newest; `--to` short-circuits | task 8.3 `[x]` | resolves-previous-good + `--to`-override tests PASS | **Pass** |
| AC-7 | `release.sh` is generalized `scripts/release.sh` with `--dry-run` writing nothing; bump suggested from Conventional Commits and confirmed | `--dry-run` exits before any write; `suggest_increment` parses commits (major/minor/patch) and prints suggestion | task 8.4 `[x]` | dry-run-writes-nothing + bump-suggestion (`feat:`→minor) tests PASS | **Pass** |
| AC-8 | Env names/blocks read from `infra/environments.yaml` via `yq`; missing or template-status file exits 2 | `yq`-based `has()`/field reads; `[ -f ]` guard; `head -1 … '# status: template'` guard; both `blocked`→exit 2 | task 8.2 `[x]` | missing-file, template-file, unknown-env, yq-invoked, missing-yq tests PASS | **Pass** |
| AC-9 | `infra-script-contract.test.ts` passes: `bash -n`, `--help`, blocked-file exit, dry-run sequence with stubs, prod non-tag refusal; shellcheck when available | Stub bins under `test/fixtures/infra/bin/`; env fixture present | task 8.1, 8.7, 8.10 `[x]` | **41/41 PASS**; shellcheck path emits explicit SKIPPED marker when absent | **Pass** |
| AC-10 | Skill parity test covers `deploy-ops` | deploy-ops entry in `SKILLS`/`IMPLEMENTED`; 9 declared statements | task 8.6, 8.7 `[x]` | `skill-parity-infra.test.ts` **87/87 PASS** | **Pass** |

## Business Rules

| Rule | Evidence | Result |
| --- | --- | --- |
| `release` and `deploy.sh prod` refuse when `CI` set without `INFRA_HUMAN_APPROVED=1`, **and** refuse in a non-interactive agent context | `release.sh`: CI guard **and** `[ ! -t 0 ]` non-interactive guard, both present. `deploy.sh`: CI guard present (`IS_PROD && CI && !INFRA_HUMAN_APPROVED`); **non-interactive/tty guard absent** | **Partial — see Drift D-1** |
| No deploy targets a mutable `latest` tag | No `latest` string anywhere in `templates/scripts/*.sh`; build tags are strictly `vX.Y.Z` or `main-<short-sha>`; skill states the rule explicitly | **Pass** (enforced by construction) |
| Deploy-kind ambiguity refusal | `detect_kind` refuses (exit 2) on >1 platform block with no explicit `deploy_kind`, on zero blocks, and on supabase-only (no compute target) | **Pass** |

## Drift Catalog

### D-1 — `deploy.sh prod` implements only the CI half of the two-part human-only guard

- **Description:** The S-008 business rule requires `deploy.sh prod` to refuse **both** (a)
  under CI without `INFRA_HUMAN_APPROVED=1` **and** (b) in a non-interactive agent context.
  `deploy.sh` implements only (a). `release.sh` implements both (a) and the non-interactive
  check `[ ! -t 0 ] && INFRA_HUMAN_APPROVED != 1`. The `deploy-ops` skill's "Human-only guard"
  section documents both guards as applying to `deploy.sh prod`, so the script is behind its
  own documented contract.
- **Impact class:** **Minor.** The common automation path (CI runners, most agent contexts)
  sets `CI`, which the existing guard catches. The uncovered case is a non-interactive run
  with `CI` unset. No AC assertion tests the non-interactive branch for `deploy.sh`, so the
  suite is green despite the gap.
- **Intent class:** **Unintended.** No task note, comment, or rationale documents an intentional
  divergence between the two scripts; the skill text asserts parity of the guard, indicating the
  omission was not deliberate.
- **Evidence source(s):** `templates/scripts/deploy.sh` (lines ~155–159, guard block);
  `templates/scripts/release.sh` (CI guard + `[ ! -t 0 ]` guard); `.github/skills/deploy-ops/SKILL.md`
  ("Human-only guard" section); `test/unit/infra-script-contract.test.ts` (human-only-guard describe
  block asserts only the CI branch for `deploy.sh`).
- **Non-blocking:** This drift does **not** block PR or issue completion. It routes to
  product-engineer's `activity-drift-reconciliation`.

## Edge-Case and Randomized Test Outcomes

No Design-Mode test plan was authored for this scope, so this section reflects the delivered
contract test's edge-case coverage rather than a separate plan:

- Dirty working tree at preflight → exit 2 (real-repo test) — covered.
- Lightweight (non-annotated) tag for prod → exit 2 — covered.
- Annotated tag not on `main` → exit 2 — covered.
- Missing `yq` on PATH → exit 2 — covered.
- Two platform blocks with no `deploy_kind` (ambiguous) → exit 2 — covered.
- Missing / template-status env file → exit 2 — covered.
- **Not covered:** non-interactive-context branch of the human-only guard for `deploy.sh` (see D-1);
  verify-timeout edge case from the story matrix is represented only by the forced-fail hook, not a timeout.
- **Manual step 8.8** (`deploy.sh dev` against a throwaway fly app, forced health-check failure, run
  printed rollback) is intentionally **not run** — requires live fly credentials. Documented in the
  task list; acceptable per scope.

## Recommendations

| Item | Suggested next step | Owner |
| --- | --- | --- |
| D-1 (guard parity) | Either add the `[ ! -t 0 ] && INFRA_HUMAN_APPROVED != 1` non-interactive check to `deploy.sh`'s prod guard to match `release.sh` and the skill text, **or** narrow the skill's "Human-only guard" wording to reflect the CI-only guard for `deploy.sh`. Decide via drift-reconciliation. | `developer` (fix) or `product-engineer` (wording) |
| Manual 8.8 | Run once live fly credentials and a throwaway app are available to close the behavioral verification of the exit-3 → rollback loop. | operator / `infra-engineer` |
| Verify timeout | Consider a follow-up edge case exercising a verify timeout distinct from the forced-fail hook. | `qa-engineer` / `verifier` (design) |

## Notes on Audit Integrity

- No application code, tests, docs, PRD, spec, or task list were modified during this audit.
- No PR was opened, converted, or merged.
- The test run did **not** regenerate `test/fixtures/catalog/catalog/index.yaml`; no revert was needed.
- `TESTING.md` and `test/unit/qa-testing-standard.test.ts` were left untouched (they carried
  pre-existing uncommitted modifications unrelated to S-008 and outside this audit's scope).
- `coverage_gate: PASS` was previously recorded by `qa-engineer`; this audit is additive and non-blocking.
