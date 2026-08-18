# Fixture: harness defects (AC-5 / SC-14)

Reproduces all seven harness-defect classes from the home-ledger audit. Each
must be reported with a file path and the expected state.

| # | Defect | Where |
| - | ------ | ----- |
| 1 | DOM components under a bare `node` environment | `vitest.config.ts` |
| 2 | Missing test config for a package that has tests | `packages-note.md` |
| 3 | Alias in `tsconfig.json` absent from the test config | `tsconfig.json` vs `vitest.config.ts` |
| 4 | Stubbed global never restored | `test/fetch-stub.test.ts` |
| 5 | Local runtime differs from CI | `.tool-versions` vs `.github/workflows/ci.yml` |
| 6 | No locale/timezone fixture policy while formatting currency | `src/format.ts` |
| 7 | False-green placeholder assertion | `test/placeholder.test.ts` |
