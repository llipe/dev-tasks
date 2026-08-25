# Traceability Matrix - Issue 123: QA agent, testing skills, and /TESTING.md standard

## Changelog

| Version | Date       | Summary                                     | Author   |
| ------- | ---------- | ------------------------------------------- | -------- |
| 1.0     | 2026-08-17 | Initial matrix (Design Mode, pre-execution) | verifier |

## Scope

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Repository      | `llipe/dev-tasks`                                                         |
| Issue           | [#123](https://github.com/llipe/dev-tasks/issues/123)                     |
| Source artifact | `workstream/issue-123-qa-agent-and-testing-standard-refinement.md` (v1.2) |
| Test plan       | `workstream/test-plan-123.md` (v1.0)                                      |
| Mode            | design                                                                    |

`Observed Result` and `Status` are unpopulated by design — Design Mode establishes the mapping; Audit Mode fills the results.

## Coverage Summary

| Metric                                | Value |
| ------------------------------------- | ----- |
| Acceptance criteria                   | 11    |
| ACs with ≥1 positive test             | 11    |
| ACs with ≥1 negative/edge test        | 11    |
| ACs uncovered                         | 0     |
| E2E scenarios                         | 32    |
| Contract scenarios                    | 11    |
| Edge cases                            | 20    |
| Randomized tactics                    | 6     |
| Total test cases                      | 69    |

**AC coverage status: covered.** Every acceptance criterion maps to at least one positive and one negative or edge case.

## AC-to-Test Mapping

| AC-ID | Requirement (abbreviated)                        | Positive              | Negative / Edge                                    | Contract              | Randomized   | Observed Result | Status |
| ----- | ------------------------------------------------ | --------------------- | -------------------------------------------------- | --------------------- | ------------ | --------------- | ------ |
| AC-1  | Agent on three platforms, entry points, parity    | SC-1                  | SC-2, SC-3                                         | CT-8, CT-10           | —            |                 |        |
| AC-2  | Prompt ≤150 lines, one procedure, no modes        | SC-4                  | SC-5, EC-16                                        | —                     | —            |                 |        |
| AC-3  | Three skills; security-negative category; trap    | SC-6                  | SC-7, SC-8, SC-9, EC-15                            | CT-10                 | —            |                 |        |
| AC-4  | `/TESTING.md` per-package placeholder contract    | SC-10, SC-12          | SC-11, EC-4, EC-5, EC-19                           | CT-5, CT-6            | RT-6         |                 |        |
| AC-5  | Existing-project setup + harness-defect detection | SC-13, SC-12          | SC-14, SC-15, EC-1, EC-4, EC-5, EC-8, EC-10, EC-13, EC-14, EC-18 | —       | RT-1         |                 |        |
| AC-6  | Monorepo- and CI-aware script reachability        | SC-16                 | SC-17, SC-18, EC-1, EC-10, EC-11, EC-18            | —                     | RT-1, RT-2   |                 |        |
| AC-7  | Five touchpoints; rule 19 unchanged               | SC-19                 | SC-20, SC-21                                       | CT-1, CT-9, CT-11     | —            |                 |        |
| AC-8  | `SKIPPED(<reason>)` only; skip preserves analysis  | SC-22                 | SC-23, SC-24, EC-9                                 | CT-1, CT-2, CT-3, CT-4, CT-11 | —    |                 |        |
| AC-9  | Registries, docs, manifest, build script updated   | SC-25                 | SC-26                                              | —                     | —            |                 |        |
| AC-10 | Distributed on both install paths, idempotent      | SC-27                 | SC-28, SC-29, EC-6, EC-7, EC-12, EC-19, EC-20      | CT-7                  | RT-4, RT-5   |                 |        |
| AC-11 | Gap analysis without a provider, risk-ranked       | SC-30                 | SC-31, SC-32, SC-23, EC-2, EC-3, EC-9, EC-17, EC-18 | —                    | RT-3         |                 |        |

## Reverse Mapping — Test to AC

| Test range   | ACs covered                       |
| ------------ | --------------------------------- |
| SC-1 – SC-3  | AC-1                              |
| SC-4 – SC-5  | AC-2                              |
| SC-6 – SC-9  | AC-3                              |
| SC-10 – SC-12 | AC-4, AC-5                       |
| SC-13 – SC-15 | AC-5                             |
| SC-16 – SC-18 | AC-6                             |
| SC-19 – SC-21 | AC-7                             |
| SC-22 – SC-24 | AC-8, AC-11                      |
| SC-25 – SC-26 | AC-9                             |
| SC-27 – SC-29 | AC-10                            |
| SC-30 – SC-32 | AC-11                            |
| CT-1 – CT-4  | AC-7, AC-8                        |
| CT-5 – CT-6  | AC-4                              |
| CT-7         | AC-10                             |
| CT-8         | AC-1                              |
| CT-9 – CT-11 | AC-1, AC-3, AC-7, AC-8            |
| EC-1 – EC-3  | AC-5, AC-6, AC-11                 |
| EC-4 – EC-5  | AC-4, AC-5                        |
| EC-6 – EC-8  | AC-5, AC-10                       |
| EC-9 – EC-12 | AC-5, AC-6, AC-8, AC-10, AC-11    |
| EC-13 – EC-15 | AC-3, AC-5                       |
| EC-16 – EC-17 | AC-2, AC-11                      |
| EC-18        | AC-5, AC-6, AC-11                 |
| EC-19 – EC-20 | AC-4, AC-10                      |
| RT-1 – RT-6  | AC-4, AC-5, AC-6, AC-10, AC-11    |

## Audit-Benchmark Mapping

The `home-ledger` audit findings that drove refinement v1.2, and the test cases that must catch each one.

| Audit finding                                                  | AC    | Must be caught by       |
| -------------------------------------------------------------- | ----- | ----------------------- |
| Aggregate script omits a package holding 393 tests             | AC-6  | SC-17, RT-2             |
| Deploy quality gate never runs backend tests                    | AC-6  | SC-18                   |
| No coverage provider installed in any package                    | AC-11 | SC-30, RT-3             |
| Coverage artifact stale and scoped to 1 of 8 modules             | AC-11 | SC-32                   |
| Large untested surfaces invisible without a provider             | AC-11 | SC-30, EC-3, EC-17      |
| React Native app tested under `environment: 'node'`              | AC-5  | SC-14                   |
| Missing test config; alias defined in `tsconfig` but not in test | AC-5  | SC-14                   |
| Stubbed globals never restored                                   | AC-5  | SC-14                   |
| Local Python 3.14 vs CI 3.11 runtime mismatch                    | AC-5  | SC-14                   |
| `expect(true)` placeholders reporting false health                | AC-5  | SC-14                   |
| Auth tests pass `alg: 'none'` over an unverifying implementation | AC-3  | SC-8, SC-9              |
| Cross-tenant isolation asserted only over JS fakes               | AC-3  | EC-15                   |
| Mixed vitest + pytest monorepo undescribable                     | AC-4  | SC-12                   |

Any of these test cases passing against its fixture while the corresponding defect is present is a **plan defect**, not an implementation pass, and must be reported.

## Gaps and Notes

1. **Closeout payload has no versioned schema.** It is defined in prose inside the agent prompts, so CT-11 is verified by inspection rather than schema validation. Non-blocking for #123; recommend `product-engineer` consider extracting a versioned schema in a future issue.
2. **SC-20 baseline captured.** `verifier` recorded the pre-implementation hash of `developer` rule 19 on 2026-08-18: all four variants hash to `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876`. See the Rule 19 Baseline section of the test plan. SC-20 passes only if all four still match after implementation.
3. **Fixture projects are a prerequisite, not a by-product.** SC-8/SC-9, SC-12, SC-14, SC-17/SC-18, and SC-30/SC-32 all require fixtures reproducing specific defects. Task-list `test/fixtures/` covers this; if fixtures are skipped, those ACs revert to prose-only verification and the matrix status must be recorded as `blocked`, not `pass`.
4. **Concurrency largely non-applicable.** Only EC-6 exercises a genuine concurrent surface. The remaining Timing & Concurrency category is marked `N/A` with reason in the plan.
5. **Out-of-scope findings are not represented here.** Frontend component/a11y/DESIGN.md enforcement, mock-reimplementation detection, mutation testing, RLS, migrations, OpenAPI validation, and Layer 3 evals have no rows by design — they route to follow-up issues.
