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
