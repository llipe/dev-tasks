/**
 * Verify module — contract-diff, impact, and drift.
 */
export { runContractDiff, detectContractType, loadSpec } from "./contract-diff.js";
export { diffOpenApi } from "./openapi-diff.js";
export { diffAsyncApi } from "./asyncapi-diff.js";
export { runImpact } from "./impact.js";
export {
  runDrift,
  computeComponentDrift,
  deriveComponentPaths,
  getLastCommitDate,
  daysAgo,
} from "./drift.js";
export type {
  ContractDiffResult,
  ContractDiffOptions,
  DiffFinding,
  ChangeKind,
  PayloadConfidence,
  ImpactResult,
  ImpactConsumer,
  ImpactTaskResult,
  ImpactOptions,
  DriftResult,
  DriftEntry,
  DriftOptions,
} from "./types.js";
