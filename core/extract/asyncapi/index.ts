/**
 * AsyncAPI extraction module barrel export.
 */

export type {
  AsyncApiChannel,
  AsyncApiConfidence,
  AsyncApiDocument,
  AsyncApiExtractionResult,
  AsyncApiOperation,
  PayloadSource,
  ResolvedPayload,
  ResolvedTopic,
  TopicDirection,
  TopicResolutionSource,
  UnresolvedEntry,
} from "./types.js";

export { extractTopics } from "./topics.js";
export type { TopicExtractionResult } from "./topics.js";

export { extractPayloads } from "./payloads.js";
export type { PayloadExtractionResult } from "./payloads.js";

export { validateAsyncApi, extractionResultToAsyncApiDocument } from "./validate.js";
export type { AsyncApiValidationResult, AsyncApiValidationError } from "./validate.js";

export { extractAsyncApiDeclared, detectOnDiskAsyncApiSpec } from "./declared.js";
