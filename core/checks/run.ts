/**
 * Entry point for the repository checks, chained into `lint`.
 *
 * Invoked as `tsx core/checks/run.ts`, never as a `dist/` path (D-48).
 * `dist/` is gitignored with no tracked files, `validate` has no `build`
 * step, and `publish-npm.yml` runs `validate` before `build` — a
 * compiled path passes only on a machine whose `dist/` is already warm,
 * and fails on every fresh clone and on the first release after merge.
 *
 * Failures exit non-zero. Staleness is printed and does not (D-21).
 */

import { checkDocsStructure } from "./docs-structure.js";

const { failures, staleness } = checkDocsStructure(process.cwd());

for (const finding of staleness) {
  process.stdout.write(`docs-structure: stale: ${finding.message}\n`);
}

if (failures.length > 0) {
  process.stderr.write(`docs-structure: ${failures.length} failure(s)\n`);
  for (const finding of failures) {
    process.stderr.write(`  [${finding.rule}] ${finding.message}\n`);
  }
  process.stderr.write("\nDocumentation structure is a gate. Fix the files above.\n");
  process.exit(1);
}
