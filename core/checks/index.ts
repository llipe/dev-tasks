/**
 * Repository checks that run under `lint`.
 *
 * Three checks live here now — the number the comment below used to say
 * would make the shared shape knowable enough to extract. It still is
 * not extracted, and on purpose: all three share `{ failures, staleness }`
 * by convention, and the glossary check's second caller is the
 * `verifier`, which imports one function by name (D-59). A registry
 * would add an indirection nothing asked for (`SIMPLICITY.md` A4). The
 * next check that wants a different result shape is the one that makes
 * this decision worth revisiting.
 */
export { checkDocsStructure } from "./docs-structure.js";
export type { DocsStructureFinding, DocsStructureResult } from "./docs-structure.js";
export { checkDecisionLogFormat, checkDecisionLogContent } from "./decision-log-format.js";
export type { DecisionLogFinding, DecisionLogResult } from "./decision-log-format.js";
export {
  checkGlossary,
  checkGlossaryContent,
  checkVocabularySection,
  checkVocabularyFiles,
  GLOSSARY_FILE,
  REQUIREMENTS_DIR,
} from "./glossary.js";
export type { GlossaryRule, GlossaryFinding, GlossaryResult } from "./glossary.js";
