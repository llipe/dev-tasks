/**
 * OpenAPI extraction module barrel export.
 */

export type {
  ExtractedEndpoint,
  OpenApiConfidence,
  OpenApiDocument,
  OpenApiExtractionResult,
  OpenApiSource,
  RequestBodySchema,
  ResponseSchema,
  RouteParam,
  UnresolvedRoute,
} from "./types.js";

export { extractRoute1, detectOnDiskSpec, normalizeSpec, Route1Error } from "./route1.js";
export { extractRoute3, composePath, extractPathParams } from "./route3.js";
export { extractRoute2, extractRoute2Express } from "./route2.js";
export type { Route2Config, Route2Extractor, Route2Options } from "./route2.js";
export { validateOpenApi, extractionResultToDocument } from "./validate.js";
export type { ValidationResult, ValidationError } from "./validate.js";
export { applyLlmDescriptions } from "./llm-descriptions.js";
export type { OpenApiLlmProvider } from "./llm-descriptions.js";
