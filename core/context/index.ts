/**
 * Context module — multi-repo context generation and query.
 */
export { ctxFetch } from "./fetch.js";
export type { FetchTarget, FetchOptions, FetchResult, FetchResultEntry } from "./fetch.js";
export {
  getCachePath,
  isCacheHit,
  markCacheComplete,
  touchCacheEntry,
  runGC,
  getDefaultCacheBase,
  DEFAULT_MAX_SIZE_BYTES,
  DEFAULT_MAX_AGE_MS,
} from "./cache.js";
export type { GCOptions, GCResult } from "./cache.js";
export { countTokens, truncateToTokenBudget } from "./tokens.js";
export {
  assemble,
  buildLayerDefinitions,
  BudgetExceededError,
  DEFAULT_BUDGET,
} from "./assemble.js";
export type {
  ScopeInput,
  MetaRepoContent,
  ComponentContent,
  ContractFile,
  AssembleOptions,
  BundleManifest,
  BundleFileEntry,
  TruncationRecord,
  LayerDefinition,
} from "./assemble.js";
