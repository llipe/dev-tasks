## verifier — Design Mode complete

**AC coverage: covered (11/11).** Every acceptance criterion maps to at least one positive and one negative or edge test case. No blocking gaps.

| Metric              | Count  |
| ------------------- | ------ |
| Acceptance criteria | 11     |
| E2E scenarios       | 32     |
| Contract scenarios  | 11     |
| Edge cases          | 20     |
| Randomized tactics  | 6      |
| **Total cases**     | **69** |

### Artifacts

Per this repo's convention, active `/workstream/*.md` files are gitignored and become tracked only when archived, so the full documents are local until then. The traceability matrix is reproduced inline below so AC coverage is reviewable from this issue without them.

- `workstream/test-plan-123.md` — full plan: 32 E2E scenarios, 11 contract scenarios, 20 edge cases across all 9 categories, 6 randomized tactics with seed policy, execution checklist (local)
- `workstream/traceability-matrix-123.md` — inline below (local)

### Traceability matrix

| AC-ID | Requirement (abbreviated)                         | Positive     | Negative / Edge                                                  | Contract                      | Randomized |
| ----- | ------------------------------------------------- | ------------ | ---------------------------------------------------------------- | ----------------------------- | ---------- |
| AC-1  | Agent on three platforms, entry points, parity    | SC-1         | SC-2, SC-3                                                       | CT-8, CT-10                   | —          |
| AC-2  | Prompt ≤150 lines, one procedure, no modes        | SC-4         | SC-5, EC-16                                                      | —                             | —          |
| AC-3  | Three skills; security-negative category; trap    | SC-6         | SC-7, SC-8, SC-9, EC-15                                          | CT-10                         | —          |
| AC-4  | `/TESTING.md` per-package placeholder contract    | SC-10, SC-12 | SC-11, EC-4, EC-5, EC-19                                         | CT-5, CT-6                    | RT-6       |
| AC-5  | Existing-project setup + harness-defect detection | SC-13, SC-12 | SC-14, SC-15, EC-1, EC-4, EC-5, EC-8, EC-10, EC-13, EC-14, EC-18 | —                             | RT-1       |
| AC-6  | Monorepo- and CI-aware script reachability        | SC-16        | SC-17, SC-18, EC-1, EC-10, EC-11, EC-18                          | —                             | RT-1, RT-2 |
| AC-7  | Five touchpoints; rule 19 unchanged               | SC-19        | SC-20, SC-21                                                     | CT-1, CT-9, CT-11             | —          |
| AC-8  | `SKIPPED(<reason>)` only; skip preserves analysis | SC-22        | SC-23, SC-24, EC-9                                               | CT-1, CT-2, CT-3, CT-4, CT-11 | —          |
| AC-9  | Registries, docs, manifest, build script updated  | SC-25        | SC-26                                                            | —                             | —          |
| AC-10 | Distributed on both install paths, idempotent     | SC-27        | SC-28, SC-29, EC-6, EC-7, EC-12, EC-19, EC-20                    | CT-7                          | RT-4, RT-5 |
| AC-11 | Gap analysis without a provider, risk-ranked      | SC-30        | SC-31, SC-32, SC-23, EC-2, EC-3, EC-9, EC-17, EC-18              | —                             | RT-3       |

### What this plan is designed to catch

The `home-ledger` audit findings that drove refinement v1.2 are mapped to specific test cases, so the plan can be judged on whether it would have caught them.

| Audit finding                                                                                              | Caught by          |
| ---------------------------------------------------------------------------------------------------------- | ------------------ |
| Aggregate script omits a package holding 393 tests                                                         | SC-17, RT-2        |
| Deploy quality gate never runs backend tests                                                               | SC-18              |
| No coverage provider installed anywhere                                                                    | SC-30, RT-3        |
| Coverage artifact stale and scoped to 1 of 8 modules                                                       | SC-32              |
| Large untested surfaces invisible without a provider                                                       | SC-30, EC-3, EC-17 |
| Seven harness defects (environment, config, alias, cleanup, runtime parity, locale policy, `expect(true)`) | SC-14              |
| Auth tests pass `alg: 'none'` over an unverifying implementation                                           | SC-8, SC-9         |
| Cross-tenant isolation asserted only over JS fakes                                                         | EC-15              |
| Mixed vitest + pytest monorepo undescribable                                                               | SC-12              |

Any of these cases passing against its fixture while the corresponding defect is present is a **plan defect**, not an implementation pass, and must be reported.

### Three prerequisites for implementation

1. **Capture a hash of `developer` rule 19 before any edit** (task-list sub-task 1.1). SC-20 asserts rule 19 is byte-identical to baseline; without a pre-change hash the assertion has nothing to compare against.
2. **Fixture projects are a prerequisite, not a by-product.** SC-8/SC-9, SC-12, SC-14, SC-17/SC-18, and SC-30/SC-32 each need a fixture reproducing a specific defect. If fixtures are skipped, those ACs revert to prose-only verification and must be recorded as `blocked`, not `pass`.
3. **Presence is not a pass.** Several ACs are satisfiable by adding a heading. The plan requires behavioral assertions against fixtures — a scenario that passes while its target defect is present is a plan defect.

### Non-blocking findings

- The `developer` → `planner` closeout payload has no versioned schema; it is defined in prose inside the agent prompts. CT-11 (version compatibility) is therefore verified by inspection rather than schema validation. Worth a versioned schema in a future issue — not blocking for #123.
- Timing & Concurrency is largely non-applicable here: only EC-6 (concurrent `dev-tasks install`) exercises a genuine concurrent surface. The rest of that category is marked `N/A` with reason in the plan.

### Next step

Hand off to `developer` for implementation, test-first, using `workstream/test-plan-123.md` as the primary guide for which tests to write first. Re-invoke `verifier` in `audit` mode post-implementation.
