# Traceability Matrix: Issue #130

## Source

- **Issue:** https://github.com/llipe/dev-tasks/issues/130
- **Test Plan:** `workstream/test-plan-130.md`
- **Date:** 2026-08-19

## AC → Test Case → Validation Method

| AC ID | AC Description | Test Cases | Validation Method | Coverage Status |
| ----- | -------------- | ---------- | ----------------- | --------------- |
| AC-1 | `activity-integration-test-implementation` on all 3 platforms | SC-1, SC-2, SC-3, SC-4, SC-26, CT-1, CT-2, EC-1, EC-4, EC-10, EC-11 | Unit: file presence + parity assertion + line count. Manual: real-DB check. | Covered |
| AC-2 | `activity-e2e-test-implementation` on all 3 platforms | SC-5, SC-6, SC-7, SC-4, SC-26, CT-1, CT-2, EC-1, EC-5, EC-13 | Unit: file presence + parity + prerequisite contract sections. Manual: Playwright check. | Covered |
| AC-3 | `activity-contract-validation` on all 3 platforms | SC-8, SC-9, SC-4, SC-10, SC-26, CT-1, CT-2, EC-1, EC-6, EC-7 | Unit: file presence + parity + dt-verify references + fallback. Manual: dt-verify check. | Covered |
| AC-4 | Layer 2.5 in `/TESTING.md` | SC-11, SC-12, CT-3, EC-2, EC-3 | Unit: parse TESTING.md, find Layer 2.5 row, verify boundary text. | Covered |
| AC-5 | E2E layer in `/TESTING.md` | SC-13, CT-3, EC-3 | Unit: parse TESTING.md, find E2E row, verify boundary text. | Covered |
| AC-6 | Contract validation layer in `/TESTING.md` | SC-14, CT-3, EC-3 | Unit: parse TESTING.md, find Contract row, verify boundary text. | Covered |
| AC-7 | `qa-engineer` procedure extended | SC-15, SC-16, CT-4, EC-4, EC-5, EC-6 | Unit: parse prompt, verify step count (6), ordering, conditional logic, skip format. | Covered |
| AC-8 | `activity-test-standards` detects infra | SC-17, SC-18, EC-7, EC-14 | Unit: parse skill, search for detection sections. Manual: run against fixture. | Covered |
| AC-9 | Planner rollup | SC-19, SC-20, CT-6, EC-12 | Unit: parse planner prompt, verify rollup step, scope, ordering. | Covered |
| AC-10 | Scenario-to-spec traceability | SC-7, EC-8, EC-9 | Unit: search e2e skill for `@scenario` convention. Manual: verify mapping resolves. | Covered |
| AC-11 | `docs/workflow-chains.md` updated | SC-21 | Unit: parse doc, verify new sections present. | Covered |
| AC-12 | Registries and docs updated | SC-22, SC-23 | Unit: search AGENTS.md for three skill names. Search technical-guidelines for Layer 2.5. | Covered |
| AC-13 | Distribution via both paths | SC-24, SC-25, CT-5 | Unit: parse bundle-manifest.json + build-bundle.sh for skill paths. Integration: install test. | Covered |

## Summary

- **Total ACs:** 13
- **Covered:** 13 (100%)
- **Uncovered:** 0
- **Total test cases:** 46 (26 E2E + 6 contract + 14 edge cases)
- **Minimum positive scenarios per AC:** 1 (met for all)
- **Minimum negative/edge scenarios per AC:** 1 (met for all except AC-11, AC-12 which are documentation ACs with edge cases covered transitively through EC-14 and distribution constraints)

## Validation Approach

This issue delivers **documentation and configuration artifacts** (skill files, agent prompts, TESTING.md rows, workflow docs, bundle manifests). The validation approach is:

1. **Automated unit tests** — file presence, content parsing, parity assertions, structural checks
2. **Manual verification** — run skills against fixture projects to confirm they produce correct guidance
3. **Integration tests** — install/update flow places correct files

No runtime behavior is tested because the deliverables are static instruction documents, not executable code.
