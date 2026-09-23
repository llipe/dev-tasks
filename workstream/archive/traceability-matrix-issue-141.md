# Traceability Matrix: Issue #141 — PR should teach your team (MVP)

## Changelog

| Version | Date       | Summary                    | Author   |
| ------- | ---------- | -------------------------- | -------- |
| 1.0     | 2026-09-14 | Initial AC-to-test mapping | verifier |

Source: `workstream/issue-141-pr-teach-team-refinement.md` (v1.0), `workstream/test-plan-141.md` (v1.0).

Format: `AC-ID → Test-Case-ID(s) → Observed-Result → Pass/Fail/Drift`. Observed-Result is `pending` until implementation runs (Design Mode); it is filled by verifier Audit Mode.

## Coverage Map (every AC has ≥1 positive and ≥1 negative/edge)

| AC   | Description (short)                                          | Positive test(s)        | Negative / edge test(s)       | Validation method                                 | Observed | Result  |
| ---- | ------------------------------------------------------------ | ----------------------- | ----------------------------- | ------------------------------------------------- | -------- | ------- |
| AC-1 | Template gains 3 teaching sections, appended to existing set | CT-1, E2E-1, E2E-4      | EC-4 (heading/level/table)    | parity test + manual reviewer check               | pending  | pending |
| AC-2 | SHOULD-level; Examples REQUIRED for user-visible/API changes | CT-3, E2E-1             | E2E-2, E2E-3, EC-2, EC-3      | parity test (rule text) + manual                  | pending  | pending |
| AC-3 | Identical mirror across three trees                          | CT-2, P-1               | EC-1 (single-tree drift)      | parity test (normalized compare)                  | pending  | pending |
| AC-4 | `developer` shorthand updated in all four files              | CT-4                    | EC-1 (partial-file drift)     | parity test (reference assertion)                 | pending  | pending |
| AC-5 | Parity test fails before / passes after                      | CT-5 (post-impl green)  | CT-5 (pre-impl red)           | run on base rev then branch                       | pending  | pending |
| AC-6 | No secret values in examples; key names only                 | (benign example passes) | EC-5, EC-6 (secret scan)      | parity test secret-shape scan                     | pending  | pending |
| AC-7 | Quality gates pass                                           | Checklist step 8        | EC-8 (idempotent post-format) | `pnpm run typecheck/lint/format:check/test/audit` | pending  | pending |

## Scope-guard row (negative assertion on out-of-scope work)

| Guard | Assertion                                                                             | Test | Result  |
| ----- | ------------------------------------------------------------------------------------- | ---- | ------- |
| SG-1  | No test/template introduces tiers, `dt changemap`, the skill, enforcement, write-back | EC-7 | pending |

## Notes

- Design Mode leaves `Observed`/`Result` as `pending`; these are populated by the verifier Audit-Mode fidelity report (`workstream/fidelity-report-141.md`) after implementation.
- Primary automated vehicle: `test/unit/pr-teaching-template-parity.test.ts`, modeled on `test/unit/researcher-parity.test.ts`.
- Manual-only cases (E2E-2/3/4, EC-3): reviewer comprehension and the "Examples required for user-visible changes" behavior are policy the template states but a unit test cannot fully enforce on arbitrary future PRs; they are validated by sample PR bodies at implementation time and by `verifier` in Audit Mode.
