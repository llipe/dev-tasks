/**
 * OpenAPI 3.1 validation.
 * Validates the extraction output against the OpenAPI 3.1 specification structure.
 * Uses structural validation (required fields, types, valid paths/methods).
 */

import type { OpenApiDocument } from "./types.js";

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * A single validation error.
 */
export interface ValidationError {
  path: string;
  message: string;
}

const VALID_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

/**
 * Validate an OpenAPI document against the OpenAPI 3.1 specification structure.
 */
export function validateOpenApi(doc: OpenApiDocument): ValidationResult {
  const errors: ValidationError[] = [];

  // Required: openapi field
  if (!doc.openapi) {
    errors.push({ path: "/openapi", message: "Missing required field 'openapi'" });
  } else if (typeof doc.openapi !== "string") {
    errors.push({ path: "/openapi", message: "'openapi' must be a string" });
  } else if (!doc.openapi.startsWith("3.1")) {
    errors.push({
      path: "/openapi",
      message: `'openapi' must be 3.1.x, got '${doc.openapi}'`,
    });
  }

  // Required: info field
  if (!doc.info) {
    errors.push({ path: "/info", message: "Missing required field 'info'" });
  } else {
    if (!doc.info.title || typeof doc.info.title !== "string") {
      errors.push({ path: "/info/title", message: "Missing or invalid 'info.title'" });
    }
    if (!doc.info.version || typeof doc.info.version !== "string") {
      errors.push({ path: "/info/version", message: "Missing or invalid 'info.version'" });
    }
  }

  // Required: paths field
  if (!doc.paths) {
    errors.push({ path: "/paths", message: "Missing required field 'paths'" });
  } else if (typeof doc.paths !== "object") {
    errors.push({ path: "/paths", message: "'paths' must be an object" });
  } else {
    validatePaths(doc.paths, errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the paths object.
 */
function validatePaths(
  paths: Record<string, Record<string, unknown>>,
  errors: ValidationError[],
): void {
  for (const [path, pathItem] of Object.entries(paths)) {
    // Path must start with /
    if (!path.startsWith("/")) {
      errors.push({
        path: `/paths/${path}`,
        message: `Path '${path}' must start with '/'`,
      });
    }

    if (!pathItem || typeof pathItem !== "object") {
      errors.push({
        path: `/paths/${path}`,
        message: `Path item for '${path}' must be an object`,
      });
      continue;
    }

    // Validate each operation
    for (const [key, operation] of Object.entries(pathItem)) {
      if (key === "parameters" || key === "summary" || key === "description") continue;

      if (!VALID_METHODS.includes(key)) {
        errors.push({
          path: `/paths/${path}/${key}`,
          message: `Invalid HTTP method '${key}'`,
        });
        continue;
      }

      if (!operation || typeof operation !== "object") {
        errors.push({
          path: `/paths/${path}/${key}`,
          message: `Operation for '${key}' must be an object`,
        });
        continue;
      }

      validateOperation(path, key, operation as Record<string, unknown>, errors);
    }
  }
}

/**
 * Validate an individual operation.
 */
function validateOperation(
  path: string,
  method: string,
  operation: Record<string, unknown>,
  errors: ValidationError[],
): void {
  // responses is required
  if (!operation.responses) {
    errors.push({
      path: `/paths/${path}/${method}/responses`,
      message: "Missing required field 'responses'",
    });
  } else if (typeof operation.responses !== "object") {
    errors.push({
      path: `/paths/${path}/${method}/responses`,
      message: "'responses' must be an object",
    });
  }

  // Validate parameters if present
  if (operation.parameters) {
    if (!Array.isArray(operation.parameters)) {
      errors.push({
        path: `/paths/${path}/${method}/parameters`,
        message: "'parameters' must be an array",
      });
    } else {
      for (let i = 0; i < operation.parameters.length; i++) {
        const param = operation.parameters[i] as Record<string, unknown>;
        if (!param.name) {
          errors.push({
            path: `/paths/${path}/${method}/parameters/${i}/name`,
            message: "Parameter missing required 'name'",
          });
        }
        if (!param.in) {
          errors.push({
            path: `/paths/${path}/${method}/parameters/${i}/in`,
            message: "Parameter missing required 'in'",
          });
        }
      }
    }
  }
}

/**
 * Convert an OpenApiExtractionResult to a standard OpenAPI document for validation.
 */
export function extractionResultToDocument(
  result: import("./types.js").OpenApiExtractionResult,
): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of result.endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }

    const operation: Record<string, unknown> = {};

    // Parameters
    if (endpoint.parameters.length > 0) {
      operation.parameters = endpoint.parameters.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required,
        schema: { type: p.type },
      }));
    }

    // Request body
    if (endpoint.requestBody) {
      operation.requestBody = {
        required: endpoint.requestBody.required,
        content: {
          [endpoint.requestBody.contentType]: {
            schema: endpoint.requestBody.schema,
          },
        },
      };
    }

    // Responses
    const responses: Record<string, unknown> = {};
    for (const resp of endpoint.responses) {
      if (resp.schema) {
        responses[resp.statusCode] = {
          description: resp.description,
          content: {
            [resp.contentType]: { schema: resp.schema },
          },
        };
      } else {
        responses[resp.statusCode] = {
          description: resp.description,
        };
      }
    }
    operation.responses =
      Object.keys(responses).length > 0 ? responses : { "200": { description: "Response" } };

    // Summary/description/tags from LLM pass
    if (endpoint.summary) operation.summary = endpoint.summary;
    if (endpoint.description) operation.description = endpoint.description;
    if (endpoint.tags)
      operation.operationId = `${endpoint.method}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, "_")}`;
    if (endpoint.tags) operation.tags = endpoint.tags;

    paths[endpoint.path][endpoint.method] = operation;
  }

  return {
    openapi: result.openapi,
    info: result.info,
    paths,
  };
}
