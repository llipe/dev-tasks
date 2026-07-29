/**
 * Shared types for OpenAPI extraction results.
 */

/**
 * Provenance source for OpenAPI extraction.
 */
export type OpenApiSource = "introspected" | "inferred";

/**
 * Confidence level for OpenAPI extraction.
 */
export type OpenApiConfidence = "high" | "medium" | "low";

/**
 * An extracted route parameter.
 */
export interface RouteParam {
  /** Parameter name */
  name: string;
  /** Parameter location: path, query, header, cookie */
  in: "path" | "query" | "header" | "cookie";
  /** Whether the parameter is required */
  required: boolean;
  /** Inferred type (e.g., "string", "number", "integer") */
  type: string;
  /** Optional description */
  description?: string;
}

/**
 * An extracted request body schema.
 */
export interface RequestBodySchema {
  /** Content type (default: application/json) */
  contentType: string;
  /** JSON Schema for the body */
  schema: Record<string, unknown>;
  /** Whether the body is required */
  required: boolean;
}

/**
 * An extracted response schema.
 */
export interface ResponseSchema {
  /** HTTP status code (e.g., "200", "default") */
  statusCode: string;
  /** Content type */
  contentType: string;
  /** JSON Schema for the response (null if untyped/any) */
  schema: Record<string, unknown> | null;
  /** Description */
  description: string;
}

/**
 * A single extracted endpoint/operation.
 */
export interface ExtractedEndpoint {
  /** HTTP method (lowercase) */
  method: string;
  /** Full path (composed from router prefixes + route pattern) */
  path: string;
  /** Path parameters extracted from the route pattern */
  parameters: RouteParam[];
  /** Request body (if applicable) */
  requestBody?: RequestBodySchema;
  /** Response schemas */
  responses: ResponseSchema[];
  /** Whether this endpoint has typed parameters/body */
  typed: boolean;
  /** Confidence for this specific endpoint */
  confidence: OpenApiConfidence;
  /** LLM-generated summary (added in LLM pass) */
  summary?: string;
  /** LLM-generated description (added in LLM pass) */
  description?: string;
  /** LLM-generated tags (added in LLM pass) */
  tags?: string[];
}

/**
 * An unresolved route that could not be statically determined.
 */
export interface UnresolvedRoute {
  /** Source file where the dynamic registration was found */
  file: string;
  /** Line number */
  line: number;
  /** Reason it could not be resolved */
  reason: string;
  /** Code snippet showing the dynamic pattern */
  snippet: string;
}

/**
 * Full OpenAPI extraction result.
 */
export interface OpenApiExtractionResult {
  /** OpenAPI specification version */
  openapi: string;
  /** API info */
  info: {
    title: string;
    version: string;
    description?: string;
  };
  /** Extracted endpoints */
  endpoints: ExtractedEndpoint[];
  /** Routes that could not be statically resolved */
  unresolved: UnresolvedRoute[];
  /** Provenance source */
  source: OpenApiSource;
  /** Overall confidence */
  confidence: OpenApiConfidence;
  /** Strategy used: "route1" | "route3" */
  strategy: "route1" | "route3";
}

/**
 * OpenAPI document in the standard format (for validation / output).
 */
export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
}
