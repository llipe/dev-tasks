/**
 * Extract module — component metadata extraction.
 */
export type {
  Capability,
  DetectionEvidence,
  DetectionResult,
  ExtractionProvider,
  HttpDetection,
  MessagingDetection,
  OpenApiStrategy,
  OrmDetection,
  RepoContext,
  RequiresHumanEntry,
} from "./provider.js";

export {
  runDetection,
  registerProvider,
  clearProviders,
  getProviders,
  getMatchingProvider,
  getRequiresHuman,
} from "./detect.js";

export { nodeTsProvider } from "./providers/node-ts.js";
