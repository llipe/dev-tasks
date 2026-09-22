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
 *
 * Three checks run: documentation structure, decision-log format, and
 * the ubiquitous-language glossary (D-59). The glossary check is silent
 * on a repository that does not have the file yet — absence is
 * `doctor`'s warning, not a `lint` failure (D-67, D-75).
 */

import { checkDocsStructure } from "./docs-structure.js";
import { checkDecisionLogFormat } from "./decision-log-format.js";
import { checkGlossary } from "./glossary.js";

const docsStructure = checkDocsStructure(process.cwd());
const decisionLog = checkDecisionLogFormat(process.cwd());
const glossary = checkGlossary(process.cwd());

const staleness = [...docsStructure.staleness, ...decisionLog.staleness, ...glossary.staleness];
const failures = [...docsStructure.failures, ...decisionLog.failures, ...glossary.failures];

for (const finding of staleness) {
  process.stdout.write(`${finding.rule}: stale: ${finding.message}\n`);
}

if (failures.length > 0) {
  process.stderr.write(`checks: ${failures.length} failure(s)\n`);
  for (const finding of failures) {
    process.stderr.write(`  [${finding.rule}] ${finding.message}\n`);
  }
  process.stderr.write(
    "\nDocumentation and decision-log structure are a gate. Fix the files above.\n",
  );
  process.exit(1);
}
