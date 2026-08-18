Defect 2: `src/format.ts` and the `test/` directory exist, but there is no
per-package test config beyond the root `vitest.config.ts` -- no `setupFiles`,
no global cleanup, and no coverage provider configured anywhere.
