# Traceability Matrix: Shared Understanding — Phase 0 (Retire `dt`)

## Changelog

| Version | Date       | Summary                                                                                                                                                                                                                                                                                 | Author   |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1.0     | 2026-09-18 | Initial version. Maps 37 story acceptance criteria and 8 PRD requirements to the 95 test cases in `workstream/test-plan-shared-understanding-phase-0.md`. Every criterion carries at least one positive and one negative/edge case. Four coverage gaps and 14 wording defects recorded. | verifier |

---

## 1. How to Read This Matrix

- **Companion artifact:** `workstream/test-plan-shared-understanding-phase-0.md` v1.0. Case IDs (`TC-*`) are defined there and are stable.
- **Positive** — a case that passes when the criterion is satisfied.
- **Negative / Edge** — a case that fails when the criterion is violated in a way the positive case would not notice: a mutation, a false-positive probe, a vacuous-pass guard, or an adjacent boundary.
- **Layer** — the `TESTING.md` taxonomy (1 = deterministic foundations, 2 = CLI/filesystem/subprocess, 4 = human evaluation).
- **Method** — `A` automated command, `D` deterministic inspection, `M` manual check.
- **Verdict** — filled during execution. `Pass` / `Fail` / `Drift` / `Blocked`. All rows start `Pending`.
- **Note** — a pointer to a §9 finding (`NV-nn`) when the criterion needs rewording before it can be verified.

---

## 2. Story Acceptance Criteria → Test Cases

### S-001 — Remove the `dt` source tree and rewire the package (#195)

| AC   | Criterion                                              | Positive               | Negative / Edge                | Layer | Method | Verdict | Note  |
| ---- | ------------------------------------------------------ | ---------------------- | ------------------------------ | ----- | ------ | ------- | ----- |
| AC-1 | Nine source paths no longer exist                      | TC-A11                 | TC-A01, TC-A14, TC-A02         | 1     | D, A   | Pending |       |
| AC-2 | `adapters/` gone; `bin/parse-args.ts`; relative import | TC-A12                 | TC-A03                         | 1     | D      | Pending |       |
| AC-3 | `package.json` bin / imports / files pruned            | TC-C05                 | TC-C04, TC-A08                 | 1     | A      | Pending | NV-07 |
| AC-4 | `core/index.ts` exports exactly five names             | TC-A13                 | TC-A14                         | 1     | A      | Pending |       |
| AC-5 | Exit codes: retained values unchanged, `dt`-only gone  | TC-B06                 | TC-A05, TC-A06, TC-B07         | 1     | D, A   | Pending | NV-06 |
| AC-6 | `typecheck` and `build` pass                           | TC-A01                 | TC-A07, TC-A08, TC-A09, TC-A10 | 1     | A      | Pending | NV-07 |
| AC-7 | `--help`, `--version`, `status`, `doctor` unchanged    | TC-B01, TC-B02, TC-B05 | TC-B03, TC-B04, TC-A06         | 2     | A      | Pending | NV-08 |

### S-002 — Remove `dt` tests and fixtures, and guard the retirement (#196)

| AC   | Criterion                                                 | Positive       | Negative / Edge                                                | Layer | Method | Verdict | Note             |
| ---- | --------------------------------------------------------- | -------------- | -------------------------------------------------------------- | ----- | ------ | ------- | ---------------- |
| AC-1 | 74 test files and five fixture directories deleted        | TC-A04, TC-H04 | TC-F03, TC-F04                                                 | 1     | D, A   | Pending | NV-05            |
| AC-2 | `git-guard`, `infra`, `qa-standards` fixtures untouched   | TC-A04         | TC-A15                                                         | 1, 2  | D, A   | Pending |                  |
| AC-3 | `binaries.test.ts`: no `dt` cases, asserts `dt.js` absent | TC-C06         | TC-C06 (anti-vacuity arm), TC-C01                              | 2     | A      | Pending |                  |
| AC-4 | Absence guard fires on the eight scanned roots            | TC-E01         | TC-E02, TC-E03, TC-E04, TC-E05, TC-E06, TC-E07, TC-J01, TC-J02 | 1     | A      | Pending | NV-09            |
| AC-5 | `pnpm run test` reports exactly 4 pre-existing failures   | TC-H02         | TC-H03, TC-H05, TC-H07                                         | 2     | A      | Pending | **NV-01, NV-03** |
| AC-6 | Guard committed red, green after S-004                    | TC-E08         | TC-H03                                                         | 2     | A      | Pending | **NV-03**        |

### S-003 — Prune `dt` dependencies and fix the release workflow (#197)

| AC   | Criterion                                           | Positive       | Negative / Edge        | Layer | Method | Verdict | Note      |
| ---- | --------------------------------------------------- | -------------- | ---------------------- | ----- | ------ | ------- | --------- |
| AC-1 | `ajv` removed; `pg` peer and meta removed           | TC-D01         | TC-D03, TC-D06, TC-D07 | 1     | A, D   | Pending |           |
| AC-2 | `fast-uri` override removed                         | TC-D01         | TC-D03                 | 1     | A      | Pending |           |
| AC-3 | `yaml` moved to `devDependencies`                   | TC-D01         | TC-D06                 | 1     | A, D   | Pending |           |
| AC-4 | `execa` stays in `dependencies`                     | TC-D01         | TC-D07                 | 1     | A, D   | Pending |           |
| AC-5 | Publish workflow no longer asserts `dist/bin/dt.js` | TC-C02         | TC-C01, TC-C03, TC-J03 | 1, 2  | D, A   | Pending | **NV-04** |
| AC-6 | `pnpm install` clean; `audit --prod` recorded       | TC-D02, TC-D05 | TC-D04, TC-D08         | 2     | A, M   | Pending |           |
| AC-7 | Build yields `dev-tasks.js` and no `dt.js`          | TC-C06         | TC-C04, TC-C10         | 2     | A      | Pending |           |

### S-004 — Remove `dt` branches from the prompt trees and the registry (#198)

| AC   | Criterion                                                   | Positive | Negative / Edge        | Layer | Method | Verdict | Note      |
| ---- | ----------------------------------------------------------- | -------- | ---------------------- | ----- | ------ | ------- | --------- |
| AC-1 | No `dt` / `component.json` / meta-repo in the three trees   | TC-F01   | TC-E03, TC-F09, TC-J02 | 1     | A, D   | Pending | NV-10     |
| AC-2 | `activity-contract-validation` deleted; `-test-design` kept | TC-F05   | TC-F02                 | 1     | A      | Pending |           |
| AC-3 | `activity-init` single-repo throughout                      | TC-F06   | TC-F04                 | 1, 4  | A, M   | Pending | NV-05     |
| AC-4 | Four named agents carry no `dt` invocation                  | TC-F01   | TC-F09                 | 1     | A, D   | Pending | **NV-10** |
| AC-5 | `AGENTS.md` / `CLAUDE.md` lose RF-62/63/64 blocks           | TC-F08   | TC-F03, TC-F11         | 1     | A, D   | Pending | NV-05     |
| AC-6 | `AGENTS.md.template` receives the same removals             | TC-F10   | TC-F11, TC-E06         | 1     | A      | Pending | NV-09     |
| AC-7 | Three trees at parity; existing parity tests pass           | TC-F02   | TC-F03, TC-F04, TC-F11 | 1     | A, D   | Pending | **NV-05** |
| AC-8 | The S-002 absence test now passes                           | TC-E01   | TC-E08, TC-E11         | 1, 2  | A, M   | Pending |           |

### S-005 — Retire the `dt` documentation and record ADR-007 (#199)

| AC   | Criterion                                               | Positive       | Negative / Edge             | Layer | Method  | Verdict | Note      |
| ---- | ------------------------------------------------------- | -------------- | --------------------------- | ----- | ------- | ------- | --------- |
| AC-1 | Four documents deleted                                  | TC-G01         | TC-G02, TC-G13              | 1     | D, A    | Pending |           |
| AC-2 | `docs/README.md` lists no deleted document              | TC-G04         | TC-G02, TC-G03              | 1     | A, M    | Pending | **NV-11** |
| AC-3 | No `dt` section; `system-overview.md` rewritten         | TC-G05         | TC-G06, TC-G02              | 1, 4  | A, M    | Pending | NV-12     |
| AC-4 | `product-context.md` Current State and Roadmap          | TC-G07         | TC-G05                      | 1, 4  | A, M    | Pending |           |
| AC-5 | `TESTING.md` declares no Contract-validation layer      | TC-G08         | TC-G13                      | 1     | A       | Pending | NV-13     |
| AC-6 | ADR-007 complete, with the restore path                 | TC-G09         | TC-I05, TC-I03              | 1     | A, M    | Pending |           |
| AC-7 | ADR-001/002 Superseded, status line only; index updated | TC-G10, TC-G11 | TC-G03                      | 1, 4  | D, A, M | Pending | **NV-11** |
| AC-8 | `CHANGELOG.md` `Removed` section; version `0.14.0`      | TC-G12, TC-C09 | TC-E05                      | 1     | A       | Pending |           |
| AC-9 | Release commit `chore!:` with `BREAKING CHANGE:` footer | TC-C09         | TC-C09 (hook-rejection arm) | 1     | A       | Pending |           |

---

## 3. PRD Requirements → Test Cases

| Requirement | Substance                                                         | Positive                       | Negative / Edge                       | Story cover         | Verdict | Note            |
| ----------- | ----------------------------------------------------------------- | ------------------------------ | ------------------------------------- | ------------------- | ------- | --------------- |
| FR-53       | Remove binary, modules, schemas, tests, fixtures, bin entry, deps | TC-A11, TC-A12, TC-D01, TC-H04 | TC-A02, TC-A03, TC-D03, TC-D06        | S-001, S-002, S-003 | Pending |                 |
| FR-54       | Remove `dt` prompt branches and the two `AGENTS.md` blocks        | TC-F01, TC-F08                 | TC-F09, TC-F11, TC-E06, TC-J02        | S-004               | Pending | NV-10           |
| FR-55       | Delete/strip/rewrite docs; remove the Contract layer; supersede   | TC-G01, TC-G05, TC-G08, TC-G10 | TC-G02, TC-G03, TC-G06, TC-G13        | S-005               | Pending | NV-11           |
| FR-56       | ADR-007 and a CHANGELOG release naming every command              | TC-G09, TC-G12                 | TC-I05, TC-E05, TC-C09                | S-005               | Pending |                 |
| FR-57       | Checks live in a new `core/checks`; `core/verify` not reused      | TC-A11 (deletion half only)    | TC-G14 (asserts `core/checks` absent) | S-001 **partial**   | Pending | **NV-14 — gap** |
| FR-58       | Phase 0 lands before Phase 1                                      | TC-G14                         | TC-G15                                | all                 | Pending |                 |
| AC-27       | `validate` passes; no `dt` anywhere; no `pg` peer; parity test    | TC-E01, TC-D01, TC-A08, TC-H02 | TC-E02…TC-E07, TC-E11, TC-J01, TC-J02 | S-002, S-004        | Pending | **NV-02**       |
| AC-28       | ADR-007 with four alternatives and restore tag; CHANGELOG         | TC-G09, TC-G12                 | TC-E05, TC-I03, TC-I05                | S-005               | Pending |                 |

---

## 4. Reverse Map: Test Case → Requirement

| Case            | Covers                                                     | Layer   | Method  |
| --------------- | ---------------------------------------------------------- | ------- | ------- |
| TC-A01          | S-001 AC-1, AC-6; BR-07; D-29                              | 1       | A       |
| TC-A02          | S-001 AC-1; FR-53; spec §4 separation claim                | 1       | D       |
| TC-A03          | S-001 AC-2, AC-3; D-34                                     | 1       | D       |
| TC-A04          | S-002 AC-1, AC-2; BR-02                                    | 1       | D       |
| TC-A05          | S-001 AC-5; BR-02                                          | 1       | A       |
| TC-A06          | S-001 AC-5, AC-7; BR-01; ADR-002                           | 1       | D       |
| TC-A07          | S-001 AC-6                                                 | 1       | A       |
| TC-A08          | S-001 AC-3, AC-6; AC-27                                    | 1       | A       |
| TC-A09          | S-001 AC-6; S-002 AC-1                                     | 2       | A       |
| TC-A10          | S-001 AC-6                                                 | 1       | D       |
| TC-A11          | S-001 AC-1; FR-53; FR-57 (deletion half)                   | 1       | D       |
| TC-A12          | S-001 AC-2; D-34; FR-53                                    | 1       | D       |
| TC-A13          | S-001 AC-4                                                 | 1       | A       |
| TC-A14          | S-001 AC-1, AC-4                                           | 1       | A       |
| TC-A15          | S-002 AC-2                                                 | 2       | A       |
| TC-B01 … TC-B05 | S-001 AC-7; BR-01                                          | 2       | A       |
| TC-B06, TC-B07  | S-001 AC-5; ADR-002                                        | 1       | D, A    |
| TC-C01          | S-003 AC-5; spec §16 risk 1                                | 2       | A       |
| TC-C02          | S-003 AC-5                                                 | 1       | D       |
| TC-C03          | S-003 AC-5 (recommended addition)                          | 2       | A       |
| TC-C04          | S-001 AC-3; S-003 AC-7                                     | 2       | A       |
| TC-C05          | S-001 AC-3                                                 | 1       | A       |
| TC-C06          | S-002 AC-3; S-003 AC-7                                     | 2       | A       |
| TC-C07          | FR-53, FR-54 (uncovered surface)                           | 1       | D       |
| TC-C08          | S-001 AC-3; spec §8 `bundle-manifest.json` claim           | 1       | A       |
| TC-C09          | S-005 AC-8, AC-9; D-28                                     | 1       | A       |
| TC-C10          | S-003 AC-7; consumer impact (spec §3)                      | 2       | A       |
| TC-D01 … TC-D08 | S-003 AC-1 to AC-4, AC-6; D-30; AC-27 (`pg`)               | 1, 2    | A, D, M |
| TC-E01 … TC-E11 | S-002 AC-4, AC-6; S-004 AC-1, AC-8; AC-27                  | 1, 2, 4 | A, D, M |
| TC-F01 … TC-F11 | S-004 AC-1 to AC-7; FR-54; BR-04                           | 1, 4    | A, D, M |
| TC-G01 … TC-G13 | S-005 AC-1 to AC-8; FR-55, FR-56; BR-05, BR-06             | 1, 4    | A, D, M |
| TC-G14, TC-G15  | FR-58; D-33; non-goals                                     | 1, 4    | D, M    |
| TC-H01 … TC-H07 | S-002 AC-5; D-36; BR-03                                    | 1, 2, 4 | A, D, M |
| TC-I01 … TC-I07 | Spec §15 rollback and restore path; D-37; S-005 AC-6       | 1, 2, 4 | A, D, M |
| TC-J01 … TC-J04 | S-002 AC-4; S-003 AC-5; S-005 AC-2 (tactic-level coverage) | 1, 2    | A       |

---

## 5. Coverage Summary

| Dimension                                      | Count | Status                                         |
| ---------------------------------------------- | ----- | ---------------------------------------------- |
| Story acceptance criteria                      | 37    | 37 mapped                                      |
| … with at least one positive case              | 37    | Complete                                       |
| … with at least one negative/edge case         | 37    | Complete                                       |
| PRD requirements in scope                      | 8     | 7 fully mapped, 1 partial (FR-57)              |
| Test cases defined                             | 95    | —                                              |
| Cases automated (`A`)                          | 65    | 68 %                                           |
| Cases by deterministic inspection (`D`)        | 20    | 21 %                                           |
| Cases requiring manual judgment (`M`)          | 10    | 11 % — each justified in the plan              |
| Cases predicted to fail as currently specified | 6     | TC-A05, TC-A08, TC-C01, TC-F03, TC-F04, TC-H03 |
| Recommended new automated guards               | 3     | TC-C03, TC-F02, TC-G02                         |

### Manual cases and why nothing else is possible

| Case   | Property                                     | Why not automated                                                                                                               |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| TC-D08 | A dependency re-added without an importer    | No guard exists that ties each `dependencies` entry to a retained importer. Recommend one; review-only until then               |
| TC-E11 | The guard runs before a merge                | A property of CI wiring, not of the repository. Both workflows are tag-triggered; there is nothing to assert in-suite           |
| TC-F06 | `activity-init` reads coherently             | Structural half is automated (numbering, anchors). Whether the remaining prose still instructs an agent correctly is a judgment |
| TC-G03 | Broken links in never-rewritten ADRs         | A decision between two conflicting rules, not a check                                                                           |
| TC-G06 | "Rewritten rather than stripped"             | A quality judgment. A length-retention proxy is automated as a smoke alarm only                                                 |
| TC-G07 | Product context describes the product in use | Prose accuracy. The `dt`-mention count is automated; truthfulness is not                                                        |
| TC-G15 | Phase ordering                               | A GitHub milestone fact, outside the repository                                                                                 |
| TC-H06 | Environment triple recorded                  | A property of the runner, captured as a record rather than an assertion                                                         |
| TC-I03 | Restore tag resolves on the remote           | Network operation; `TESTING.md` Layer 1 forbids sockets and Layer 2 has no network harness                                      |
| TC-I06 | Consumer can reinstall v0.13.0               | Queries the npm registry                                                                                                        |

---

## 6. Gaps

Four coverage gaps. None is a defect in the plan; each is an obligation the phase has not assigned to anyone.

| ID    | Gap                                                                                                                                                                                                           | Case           | Recommended owner                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| GAP-1 | **FR-57 is half-covered.** `core/verify` is deleted; `core/checks` is deferred by D-33. The stories' coverage table marks it ✅ Covered.                                                                      | TC-A11, TC-G14 | `product-engineer` — reword the coverage row (NV-14) and carry FR-57 forward                                    |
| GAP-2 | **`templates/bitbucket-pipelines.yml` ships `dt catalog build` / `dt catalog validate` to consumers.** It is in `package.json` `files`, in no deletion inventory, and outside the guard's scan scope.         | TC-C07, TC-E06 | `developer` — add to the S-004 inventory; `product-engineer` — widen S-002 AC-4's scope (NV-09)                 |
| GAP-3 | **Six prompt files carry `dt` references with no assigned step.** `developer` and `planner` across all three trees. Covered semantically by S-004 AC-1, operationally by nobody.                              | TC-F09         | `developer` — add steps 4.4b/4.4c; `product-engineer` — reword AC-4 (NV-10)                                     |
| GAP-4 | **The regression guard never runs before a merge.** Both workflows are `on: push: tags:`; `TESTING.md` already records this as harness defect 3. The spec's mitigation for the regression risk does not hold. | TC-E11         | `product-engineer` — either add a `pull_request` CI job to this phase's scope or downgrade the risk-table claim |

---

## 7. Criteria Requiring Rewording Before Verification

Fourteen findings are recorded in §9 of the test plan. The five that will otherwise cause a correct implementation to fail its own gate, or an incorrect one to pass:

| Finding   | Criterion                           | Effect if left unchanged                                                                                       |
| --------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **NV-01** | S-002 AC-5, D-36, task 0.2          | The pass signal is off by one. A correct run shows 5 retained failures and is read as a regression             |
| **NV-02** | PRD AC-27                           | "`pnpm validate` passes" is unachievable and contradicts D-36 inside the same PRD                              |
| **NV-03** | S-002 AC-5 vs AC-6                  | The two criteria cannot both hold at the guard commit                                                          |
| **NV-04** | S-003 AC-5                          | The publish workflow still asserts `dist/adapters/` at line 71; the next release fails, and no CI job says so  |
| **NV-05** | S-004 AC-7 and S-002's no-edit rule | Five parity tests assert the presence of removed content. Two need deletion, three need edits the rule forbids |

The remaining nine (NV-06 to NV-14) tighten criteria that are verifiable in spirit but not as written: exit-code enumeration, the missing `lint`/`format:check` gate, "behave exactly as before", the guard's scan scope and matcher, the unassigned prompt files, the broken-ADR-link conflict, "rewritten rather than stripped", the `test:contract` row, and the FR-57 coverage claim.

---

## 8. Execution Record

To be filled during implementation. One row per case; the six predicted-failure cases and the four gaps are the rows a reviewer should read first.

| Case | Command run | Exit status | Observation | Verdict |
| ---- | ----------- | ----------- | ----------- | ------- |
| …    |             |             |             | Pending |
