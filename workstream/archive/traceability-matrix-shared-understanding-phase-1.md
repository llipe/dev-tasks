# Traceability Matrix: Shared Understanding — Phase 1

> **Mode:** `verifier` Design Mode (pre-implementation)
> **Companion:** `workstream/test-plan-shared-understanding-phase-1.md` (v1.0)
> **Contract:** `AC-ID → Test-Case-ID → Observed-Result → Pass/Fail/Drift`. `Observed result` and `Test commit` are filled by Audit Mode after implementation (PRD AC-29).

## Changelog

| Version | Date       | Summary                                                                                                      | Author   |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| 1.0     | 2026-09-19 | Initial matrix. 62 criteria, 130 test cases, every criterion carrying ≥1 positive and ≥1 negative/edge case. | verifier |

## Summary

| Metric                                             | Value                                  |
| -------------------------------------------------- | -------------------------------------- |
| Story acceptance criteria (S-001 to S-007)         | 53                                     |
| PRD acceptance criteria in scope                   | 9 (AC-22 to AC-26, AC-29 to AC-32)     |
| **Total criteria traced**                          | **62**                                 |
| Test cases designed                                | 130 (TC-101 … TC-906)                  |
| Criteria with ≥1 positive **and** ≥1 negative/edge | 62 / 62                                |
| Criteria **verifiable as written**                 | 37                                     |
| Criteria **not verifiable as written**             | **25** (test plan §3)                  |
| PRD FRs in scope                                   | 15 (FR-44 to FR-51, FR-59 to FR-64)    |
| FRs fully covered                                  | 14 · 1 partial gap (GAP-1, FR-49a)     |
| Spec defects blocking implementation as written    | 2 (DEFECT-1 → S-004, DEFECT-3 → S-001) |

**Legend** — V: verifiable as written (`Y` / `N`, with the test plan §3 root cause: A = no skill/agent harness, B = undefined predicate, C = internally contradictory). Sub-cases written `TC-nnn·s` are seeded-negative variants inside the named test case.

---

## S-001 — Rename the foundation documents and update every reference (issue #202)

| AC   | Criterion (abridged)                                            | V         | Positive test(s)       | Negative / edge test(s)                 | Observed result | Verdict   |
| ---- | --------------------------------------------------------------- | --------- | ---------------------- | --------------------------------------- | --------------- | --------- |
| AC-1 | Both files renamed via `git mv`, content byte-identical         | Y         | TC-108, TC-109, TC-110 | TC-106, TC-107, TC-813                  | _pending_       | _pending_ |
| AC-2 | No old-name reference in the eight enumerated roots             | **N** (B) | TC-103, TC-118         | TC-101, TC-102, TC-105, TC-116          | _pending_       | _pending_ |
| AC-3 | Parity test asserts AC-2 with a commented allowlist             | Y         | TC-103                 | TC-104, TC-115, TC-117                  | _pending_       | _pending_ |
| AC-4 | Every skill/agent reading a foundation doc carries the fallback | **N** (B) | TC-111                 | TC-111·s, TC-115                        | _pending_       | _pending_ |
| AC-5 | Fallback is prose, not a new `core/` runtime module             | Y         | TC-112                 | TC-112·s (any new `core/` module fails) | _pending_       | _pending_ |
| AC-6 | Three prompt trees stay at parity                               | **N** (B) | TC-111, TC-814         | TC-814·s                                | _pending_       | _pending_ |
| AC-7 | `validate` passes with the D-40 five-name baseline unchanged    | Y         | TC-113, TC-114         | TC-801 (set equality both directions)   | _pending_       | _pending_ |

**Blocking note:** AC-2 and AC-3 cannot be implemented as written — see test plan DEFECT-3 (three immutable ADRs, three PRDs, and the in-scope PRD itself carry the old names; D-35 forbids rewriting an ADR; the cited Phase 0 precedent does not scan `docs/` at all). DEFECT-4 adds `.gitignore` as an unlisted 51st root reference that also ignores both renamed files.

---

## S-002 — `dev-tasks migrate docs` (issue #203)

| AC   | Criterion (abridged)                                            | V         | Positive test(s) | Negative / edge test(s)        | Observed result | Verdict   |
| ---- | --------------------------------------------------------------- | --------- | ---------------- | ------------------------------ | --------------- | --------- |
| AC-1 | `migrate docs` is report-only, mutates nothing, exits 0         | Y         | TC-201, TC-204   | TC-202, TC-203, TC-205, TC-904 | _pending_       | _pending_ |
| AC-2 | `--force` renames both, content identical, backs up first       | Y         | TC-207, TC-208   | TC-214, TC-215                 | _pending_       | _pending_ |
| AC-3 | Legacy `migrate` path unchanged, asserted by regression test    | Y         | TC-209           | TC-206                         | _pending_       | _pending_ |
| AC-4 | `doctor` detects old names and proposes `migrate docs`          | Y         | TC-210           | TC-211                         | _pending_       | _pending_ |
| AC-5 | `update` never renames a consumer-owned file                    | Y         | TC-316           | TC-212                         | _pending_       | _pending_ |
| AC-6 | Both new surfaces support `--json`, matching the existing shape | **N** (B) | TC-213           | TC-213·s (malformed flag)      | _pending_       | _pending_ |
| AC-7 | Consumer on old names runs every agent unchanged                | **N** (A) | TC-111           | TC-804                         | _pending_       | _pending_ |
| AC-8 | `README.md` documents the migration for an upgrading consumer   | **N** (B) | TC-216           | TC-216·s (missing subsection)  | _pending_       | _pending_ |

**Contract note:** DEFECT-6 — `runMigration()` applies unconditionally with no `--force` gate, so AC-1 and AC-3 jointly produce a verb whose bare form mutates and whose `docs` sub-verb does not. Spec §6 claims this asymmetry does not exist.

---

## S-003 — Scaffold `docs/runbooks/` and seed the initial set (issue #204)

| AC   | Criterion (abridged)                                              | V         | Positive test(s) | Negative / edge test(s) | Observed result | Verdict           |
| ---- | ----------------------------------------------------------------- | --------- | ---------------- | ----------------------- | --------------- | ----------------- |
| AC-1 | `INSTALL_IF_ABSENT_FILES` accepts a platform-agnostic entry       | Y         | TC-301, TC-302   | TC-303                  | _pending_       | _pending_         |
| AC-2 | `install` scaffolds directory, index, and template (if-absent)    | Y         | TC-304           | TC-314, TC-315          | _pending_       | _pending_         |
| AC-3 | The ten named runbooks exist                                      | Y         | TC-308           | TC-308·s, TC-318        | _pending_       | _pending_         |
| AC-4 | Valid frontmatter + the five fixed body headings                  | Y         | TC-309, TC-310   | TC-412, TC-413          | _pending_       | _pending_         |
| AC-5 | Every file under the three surfaces appears in some `related`     | Y         | TC-305, TC-306   | TC-307, TC-317          | **FAILS TODAY** | **Fail (design)** |
| AC-6 | `docs/runbooks/README.md` lists every runbook, with three columns | Y         | TC-311           | TC-311·s, TC-409        | _pending_       | _pending_         |
| AC-7 | `docs/README.md` links `docs/runbooks/`                           | Y         | TC-312           | TC-408                  | _pending_       | _pending_         |
| AC-8 | Runbooks directory carried in `consumer_owned_paths`              | **N** (C) | TC-313, TC-316   | TC-314                  | _pending_       | _pending_         |

**AC-5 pre-verdict:** the plan covers 9 of the 10 AC-25 files. `templates/scripts/release.sh` is orphaned because task 3.7 assigns `scripts/release.sh` (a different, repo-owned file). TC-305 would fail as planned. The tenth runbook (`runbook-deploy-service`, D-46) is nonetheless **justified** — see test plan DEFECT-5.

---

## S-004 — `core/checks` and the docs-structure gate (issue #205)

| AC   | Criterion (abridged)                                                | V         | Positive test(s) | Negative / edge test(s)        | Observed result | Verdict           |
| ---- | ------------------------------------------------------------------- | --------- | ---------------- | ------------------------------ | --------------- | ----------------- |
| AC-1 | Exported function takes a repo root, returns failures and staleness | **N** (C) | TC-407           | TC-405, TC-406, TC-901         | _pending_       | _pending_         |
| AC-2 | `validate` fails when an index lists a non-existent file            | Y         | TC-408           | TC-410                         | _pending_       | _pending_         |
| AC-3 | `validate` fails when an index omits an existing file               | Y         | TC-409           | TC-411                         | _pending_       | _pending_         |
| AC-4 | `validate` fails on invalid frontmatter or a misnamed runbook       | **N** (C) | TC-412, TC-413   | TC-407, TC-901                 | _pending_       | _pending_         |
| AC-5 | `validate` fails on a dangling `related` entry                      | Y         | TC-414           | TC-407, TC-317                 | _pending_       | _pending_         |
| AC-6 | Staleness > 90 days is reported, not failed                         | Y         | TC-415           | TC-416, TC-902                 | _pending_       | _pending_         |
| AC-7 | The check runs under `lint`; `lint` still fails on ESLint errors    | Y         | TC-401, TC-402   | TC-403, TC-404, TC-419, TC-810 | **FAILS TODAY** | **Fail (design)** |
| AC-8 | No registry, plugin interface, or abstraction in `core/checks`      | **N** (B) | TC-420           | TC-420·s (reviewer sign-off)   | _pending_       | _pending_         |
| AC-9 | An absent `docs/runbooks/` produces no findings                     | Y         | TC-417           | TC-418                         | _pending_       | _pending_         |

**AC-7 pre-verdict:** un-satisfiable as specified. `dist/` is gitignored and untracked, `validate` contains no `build`, and `publish-npm.yml` runs `validate` before `build`. Reproduced `MODULE_NOT_FOUND` in a fresh clone. See test plan DEFECT-1.
**AC-1 note:** shipping `dist/core/checks/` while importing the `yaml` devDependency breaks consumer-side invocation — test plan DEFECT-2.

---

## S-005 — Repository shape and the package map (issue #206)

| AC   | Criterion (abridged)                                               | V                  | Positive test(s)               | Negative / edge test(s) | Observed result | Verdict   |
| ---- | ------------------------------------------------------------------ | ------------------ | ------------------------------ | ----------------------- | --------------- | --------- |
| AC-1 | Shape detected from the six FR-59 signals                          | **N** (A, partial) | TC-501, TC-502, TC-503, TC-504 | TC-505, TC-513, TC-905  | _pending_       | _pending_ |
| AC-2 | Package map recorded in `docs/tech.md` with the six columns        | **N** (A)          | TC-507, TC-516                 | TC-509, TC-513          | _pending_       | _pending_ |
| AC-3 | Single-package repo records exactly one row, same table shape      | Y                  | TC-506, TC-508                 | TC-505                  | _pending_       | _pending_ |
| AC-4 | Bounded-context column freeform, not blocked on Phase 3            | **N** (A)          | TC-516                         | TC-516·s (blank column) | _pending_       | _pending_ |
| AC-5 | "Mode A — Mono-Repo" renamed; every cross-reference updated        | **N** (B)          | TC-514                         | TC-514·s (dangling ref) | _pending_       | _pending_ |
| AC-6 | `doctor` warns, does not fail, on package-map drift                | Y                  | TC-510, TC-511                 | TC-512                  | _pending_       | _pending_ |
| AC-7 | `activity-init` on a fresh repo creates the three files + confirms | **N** (A)          | TC-515, TC-807                 | TC-515·s                | _pending_       | _pending_ |
| AC-8 | Three prompt trees stay at parity                                  | **N** (B)          | TC-514, TC-814                 | TC-814·s                | _pending_       | _pending_ |

**Naming note:** D-44's premise is confirmed — `.claude/skills/activity-init/SKILL.md:56` defines "Mono-repo mode" as "`/docs` directory exists", colliding with FR-59's "several packages under one workspace".

---

## S-006 — Make agents package-aware (issue #207)

| AC   | Criterion (abridged)                                               | V         | Positive test(s) | Negative / edge test(s)                  | Observed result | Verdict   |
| ---- | ------------------------------------------------------------------ | --------- | ---------------- | ---------------------------------------- | --------------- | --------- |
| AC-1 | `researcher`/`plan`/`implement` name the package; commit scope     | **N** (A) | TC-601           | TC-609, TC-610                           | _pending_       | _pending_ |
| AC-2 | Root scripts fan out; root `validate` stays the entry point        | **N** (A) | TC-602           | TC-603                                   | _pending_       | _pending_ |
| AC-3 | `TESTING.md` per-package runners; reachability verified            | **N** (A) | TC-604, TC-605   | TC-610                                   | _pending_       | _pending_ |
| AC-4 | Glossary stays one root file; no per-package glossaries            | Y         | TC-606           | TC-606·s (seeded per-package file fails) | _pending_       | _pending_ |
| AC-5 | One root simplicity baseline keyed by path; no per-package ratchet | Y         | TC-607           | TC-607·s                                 | _pending_       | _pending_ |
| AC-6 | Three prompt trees stay at parity                                  | **N** (B) | TC-608, TC-814   | TC-814·s                                 | _pending_       | _pending_ |

**Scope note:** AC-2's behavior is unobservable in this repository — `dev-tasks` is single-package and no fan-out exists to exercise. The story acknowledges this and scopes the criterion to documentation, which is why it is classed not-verifiable-as-written rather than failing.

---

## S-007 — Runbook coverage and docs ownership (issue #208)

| AC   | Criterion (abridged)                                                    | V         | Positive test(s) | Negative / edge test(s) | Observed result | Verdict   |
| ---- | ----------------------------------------------------------------------- | --------- | ---------------- | ----------------------- | --------------- | --------- |
| AC-1 | `verifier` reports a finding for a procedure PR with no runbook         | **N** (A) | TC-701, TC-710   | TC-708, TC-709          | _pending_       | _pending_ |
| AC-2 | The finding is advisory and does not block PR readiness                 | **N** (A) | TC-702           | TC-702·s                | _pending_       | _pending_ |
| AC-3 | The coverage trigger is wired to its four owning agents                 | **N** (B) | TC-703           | TC-703·s                | _pending_       | _pending_ |
| AC-4 | FR-49a same-PR delivery rule stated in the owning agents                | Y         | TC-704           | TC-307                  | _pending_       | _pending_ |
| AC-5 | `technical-writer` keeps `/docs` and runbooks organized every run       | **N** (A) | TC-705           | TC-705·s                | _pending_       | _pending_ |
| AC-6 | Ownership explicit; docs-structure failure routes to `technical-writer` | Y         | TC-706, TC-707   | TC-706·s                | _pending_       | _pending_ |
| AC-7 | Three prompt trees stay at parity                                       | **N** (B) | TC-814           | TC-814·s                | _pending_       | _pending_ |

---

## PRD Acceptance Criteria (AC-22 to AC-26, AC-29 to AC-32)

| PRD AC | Criterion (abridged)                                                     | Story               | V                     | Positive test(s)               | Negative / edge test(s)                   | Observed result | Verdict               |
| ------ | ------------------------------------------------------------------------ | ------------------- | --------------------- | ------------------------------ | ----------------------------------------- | --------------- | --------------------- |
| AC-22  | No old-name reference anywhere listed; a parity test asserts it          | S-001               | **N** (B)             | TC-103, TC-803                 | TC-104, TC-105, TC-812                    | _pending_       | _pending_             |
| AC-23  | Consumer on old names runs every agent; `doctor` warns naming both pairs | S-001, S-002        | **N** (A)             | TC-804, TC-111                 | TC-211                                    | _pending_       | _pending_             |
| AC-24  | `validate` fails on the four structural breaks; reports staleness        | S-004               | Y                     | TC-805, TC-412, TC-413, TC-414 | TC-415, TC-407, TC-901                    | _pending_       | _pending_             |
| AC-25  | Every script/workflow appears in some runbook's `related`                | S-003               | Y                     | TC-806, TC-305                 | TC-307                                    | **FAILS TODAY** | **Fail (design)**     |
| AC-26  | `activity-init` creates the three files and confirms `SIMPLICITY.md`     | S-005               | **N** (A)             | TC-807, TC-515                 | TC-515·s                                  | _pending_       | _pending_             |
| AC-29  | Monorepo package map recorded; `doctor` warns on drift                   | S-005               | **N** (A, first half) | TC-808, TC-507                 | TC-512, TC-513                            | _pending_       | _pending_             |
| AC-30  | Root `validate` runs every package; CI scopes to affected packages       | S-006 + **Phase 4** | Split                 | TC-602, TC-809                 | TC-809 (assert no `validate.yml` created) | _pending_       | **Split (confirmed)** |
| AC-31  | Procedure PR with no runbook receives a verifier finding                 | S-007               | **N** (A)             | TC-701, TC-710                 | TC-709                                    | _pending_       | _pending_             |
| AC-32  | `validate` fails on index/file mismatch in either README                 | S-004               | Y                     | TC-408, TC-409                 | TC-410, TC-411                            | _pending_       | _pending_             |

**AC-30 split verified.** `.github/workflows/` contains only `publish-npm.yml` and `release-bundle.yml`. No `validate.yml` exists to modify, and PRD AC-20 assigns its delivery to `infra-engineer` in Phase 4. The stories' recorded split is factually correct and needs no change.

**AC-22 note.** The PRD still names `adapters/`, which no longer exists (D-34 moved `parse-args.ts` to `bin/`). S-001 AC-2 correctly omits it; TC-803 records the deviation so Audit Mode does not read it as drift.

---

## Functional-Requirement Coverage

| FR     | Requirement (abridged)                                                | Story(ies)   | Criteria                           | Status                                                   |
| ------ | --------------------------------------------------------------------- | ------------ | ---------------------------------- | -------------------------------------------------------- |
| FR-44  | Rename both foundation documents                                      | S-001        | AC-1, AC-2                         | Covered                                                  |
| FR-45  | Propose migration; one-release agent fallback; `update` never renames | S-001, S-002 | S-001 AC-4; S-002 AC-1, AC-4, AC-5 | Covered (D-43 scopes session-start to `doctor`/`update`) |
| FR-46  | Behavior-preserving `refactor:` commit                                | S-001        | AC-1                               | Covered                                                  |
| FR-47  | `docs/runbooks/`, index, template, initial set, install-if-absent     | S-003        | AC-2, AC-3                         | Covered                                                  |
| FR-48  | Frontmatter + fixed body shape                                        | S-003        | AC-4                               | Covered                                                  |
| FR-49a | Coverage trigger — scripts, workflows, **and infra change kinds**     | S-003, S-007 | S-003 AC-5; S-007 AC-4             | **PARTIAL — GAP-1**                                      |
| FR-49b | Procedure trigger — verifier finding                                  | S-007        | AC-1, AC-3                         | Covered                                                  |
| FR-50  | `technical-writer` hygiene + deterministic check under `lint`         | S-004, S-007 | S-004 AC-2..AC-7; S-007 AC-5       | Covered                                                  |
| FR-51  | Ownership: `technical-writer`, not `housekeeping`                     | S-007        | AC-6                               | Covered                                                  |
| FR-59  | Shape terminology and the six detection signals                       | S-005        | AC-1, AC-5                         | Covered                                                  |
| FR-60  | Package map in `docs/tech.md`; `doctor` drift warning                 | S-005        | AC-2, AC-6                         | Covered                                                  |
| FR-61  | Root fan-out; `validate` single entry point                           | S-006        | AC-2                               | Covered (CI half is Phase 4, recorded)                   |
| FR-62  | `TESTING.md` per-package runners; reachability                        | S-006        | AC-3                               | Covered                                                  |
| FR-63  | Package-scoped findings/tasks/commits; one root glossary              | S-006        | AC-1, AC-4                         | Covered                                                  |
| FR-64  | One root simplicity baseline keyed by path                            | S-006        | AC-5                               | Covered                                                  |

### GAP-1 — FR-49a's infra change-kind half has no covering criterion

FR-49a requires a runbook for **"every `infra-engineer` change kind"** in addition to the file surfaces. `.claude/commands/infra-engineer.md` enumerates **18** change kinds: discover AWS, discover Fly, discover Supabase, build image, create app, deploy app, set secret, create IAM policy, attach IAM policy, DNS record, certificate (ACM), certificate (Fly), database migration, foundation change, repo and PR operation, pipeline change, log triage, cost sweep.

- S-003 AC-5 asserts only the `templates/scripts/` + `templates/workflows/` + `.github/workflows/` file surface.
- S-007 AC-4 states the rule forward-looking, inside agent instructions.
- **No acceptance criterion requires a runbook to exist for any change kind**, and the omission is not recorded as deliberate — unlike AC-30, which the stories explicitly document as split.

**Recommended routing:** `product-engineer` — either extend S-003's scope, or record a deliberate deferral with a decision ID so the Phase 4 audit does not read it as drift.

---

## Defect-to-Test Index

| Defect   | Severity | Would it have caused rework at implementation time?                                                                                                    | Guarding tests           |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| DEFECT-1 | Critical | Yes — implemented as written, it breaks `lint`, `validate`, every fresh clone, and the release workflow; found only after merge or at the next release | TC-401 to TC-404, TC-810 |
| DEFECT-3 | Major    | Yes — blocks S-001 task 1.1 (test-first) and pressures the implementer into rewriting immutable ADRs                                                   | TC-103, TC-105, TC-812   |
| DEFECT-2 | Major    | Yes — latent; surfaces only at the first consumer invocation, after release                                                                            | TC-405, TC-406, TC-811   |
| DEFECT-4 | Major    | Partly — `git mv` masks it; surfaces later as a silently refused `git add`                                                                             | TC-106, TC-107, TC-813   |
| DEFECT-5 | Major    | No — task 3.14 would catch it, but only after ten runbooks were authored against the wrong list                                                        | TC-305, TC-306, TC-307   |
| GAP-1    | Minor    | No — but it would surface as unexplained drift in the Phase 4 audit                                                                                    | TC-704                   |
| DEFECT-6 | Minor    | No — a contract-description error, not a code error; leaves an undocumented CLI asymmetry                                                              | TC-204, TC-205, TC-206   |
| DEFECT-7 | Minor    | No — the stories and task list already carry the correct 50; only the spec is stale                                                                    | TC-101, TC-102           |

---

## Coverage Assertions

- [x] Every one of the 62 criteria maps to at least one positive test case.
- [x] Every one of the 62 criteria maps to at least one negative or edge test case.
- [x] Every test case maps back to at least one criterion or named defect.
- [x] Every PRD FR in the FR-44..FR-51 / FR-59..FR-64 range is traced (14 covered, 1 partial).
- [x] Randomized cases (TC-901 to TC-906) carry a fixed seed (`20260919`) and replay instructions.
- [ ] `Observed result`, `Verdict`, and test-commit hashes — filled by Audit Mode after implementation (PRD AC-29).

## Status

**`blocked`** — the matrix is complete and every criterion is traced, but two defects prevent implementing the criteria as written:

- **DEFECT-1** blocks S-004 AC-7 (and therefore AC-2 to AC-6, which reach `validate` through it).
- **DEFECT-3** blocks S-001 AC-2 and AC-3, the first test-first task of the phase.

Three further criteria (S-003 AC-5 / PRD AC-25, via DEFECT-5) would fail as planned. Twenty-five criteria need a verifiable restatement before Audit Mode can return anything stronger than an inspection verdict. All findings are reported for routing to `developer` (implementation) or `product-engineer` (spec, stories, task list, and `activity-drift-reconciliation` write-back); `verifier` has edited nothing.
