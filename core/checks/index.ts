/**
 * Repository checks that run under `lint`.
 *
 * One check lives here. There is deliberately no registry, no plugin
 * interface, and no shared `Check` abstraction for the checks Phases 3,
 * 5, and 6 will add (S-004 AC-8, `SIMPLICITY.md` A4): an interface
 * designed against one implementation is a guess about the other three.
 * The third check is when the shape becomes knowable.
 */
export { checkDocsStructure } from "./docs-structure.js";
export type { DocsStructureFinding, DocsStructureResult } from "./docs-structure.js";
