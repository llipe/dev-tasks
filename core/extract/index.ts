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

export {
  deriveComponent,
  deriveFields,
  applyInference,
  applyPrompted,
  computeFieldHashes,
  assembleProvenance,
  reconcileField,
  reconcileComponent,
  getMissingRequiredFields,
  FIELD_CATEGORIES,
} from "./component.js";

export type {
  ComponentYaml,
  ProvenanceBlock,
  FieldProvenance,
  FieldSource,
  FieldCategory,
  Confidence,
  ExtractionInputs,
  InferenceResult,
  PromptedValues,
  ConfirmationResult,
  DeriveComponentOptions,
} from "./component.js";

export { isInteractive, promptNonDerivableFields, confirmInference } from "./prompt.js";

export { buildExtractionReport, serializeReport } from "./report.js";

export type {
  ExtractionReport,
  ReportInputs,
  StrategyEntry,
  CoverageMetrics,
  UnresolvedItem,
  RequiresHumanItem,
  ConfidenceCounts,
} from "./report.js";
