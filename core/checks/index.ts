/**
 * Repository checks that run under `lint`.
 *
 * Two checks live here now. There is still deliberately no registry, no
 * plugin interface, and no shared `Check` abstraction (S-004 AC-8,
 * `SIMPLICITY.md` A4): both checks already share the same
 * `{ failures, staleness }` result shape by convention, without a
 * common interface forcing it, and a third check is what would make
 * that shape knowable enough to extract.
 */
export { checkDocsStructure } from "./docs-structure.js";
export type { DocsStructureFinding, DocsStructureResult } from "./docs-structure.js";
export { checkDecisionLogFormat, checkDecisionLogContent } from "./decision-log-format.js";
export type { DecisionLogFinding, DecisionLogResult } from "./decision-log-format.js";
