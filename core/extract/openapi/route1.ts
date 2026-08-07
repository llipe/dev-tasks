/**
 * OpenAPI Route 1: On-disk spec detection.
 * Detects an existing openapi.yaml/openapi.json in the repository,
 * copies it, normalizes (resolves $refs within single file, sets openapi: 3.1.x),
 * validates, and attaches source: introspected, confidence: high.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { OpenApiExtractionResult, OpenApiDocument } from "./types.js";

/** File names to search for an on-disk OpenAPI spec. */
const OPENAPI_FILE_CANDIDATES = [
  "openapi.yaml",
  "openapi.yml",
  "openapi.json",
  "swagger.yaml",
  "swagger.yml",
  "swagger.json",
  "api/openapi.yaml",
  "api/openapi.yml",
  "api/openapi.json",
  "docs/openapi.yaml",
  "docs/openapi.yml",
  "docs/openapi.json",
  "docs/api/openapi.yaml",
  "docs/api/openapi.yml",
  "docs/api/openapi.json",
  "spec/openapi.yaml",
  "spec/openapi.yml",
  "spec/openapi.json",
];

/**
 * Detect an on-disk OpenAPI specification file.
 * Returns the absolute path if found, null otherwise.
 */
export function detectOnDiskSpec(rootDir: string): string | null {
  for (const candidate of OPENAPI_FILE_CANDIDATES) {
    const fullPath = resolve(rootDir, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Parse an OpenAPI file (JSON or YAML-as-JSON for simplicity).
 * For YAML support, we parse basic YAML structure. In production this
 * would use a proper YAML parser, but we keep deps minimal.
 */
export function parseOpenApiFile(filePath: string): OpenApiDocument {
  const content = readFileSync(filePath, "utf-8");
  const ext = filePath.toLowerCase();

  if (ext.endsWith(".json")) {
    return JSON.parse(content) as OpenApiDocument;
  }

  // For YAML files, try JSON parse first (in case it's actually JSON with .yaml ext)
  try {
    return JSON.parse(content) as OpenApiDocument;
  } catch {
    // Basic YAML parsing for simple OpenAPI specs
    return parseSimpleYaml(content);
  }
}

/**
 * Normalize an OpenAPI document:
 * - Resolve single-file $ref pointers
 * - Set openapi version to 3.1.0 if not already 3.1.x
 */
export function normalizeSpec(doc: OpenApiDocument): OpenApiDocument {
  // Ensure openapi version is 3.1.x
  const normalized = { ...doc };
  if (!normalized.openapi || !normalized.openapi.startsWith("3.1")) {
    normalized.openapi = "3.1.0";
  }

  // Resolve internal $refs
  const resolved = resolveInternalRefs(normalized);
  return resolved;
}

/**
 * Resolve $ref pointers within the same document.
 * Only handles JSON Pointer (#/components/schemas/Foo style) refs.
 */
function resolveInternalRefs(doc: OpenApiDocument): OpenApiDocument {
  const docAsAny = doc as unknown as Record<string, unknown>;

  function resolveValue(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(resolveValue);
    if (typeof value !== "object") return value;

    const obj = value as Record<string, unknown>;
    if ("$ref" in obj && typeof obj["$ref"] === "string") {
      const refPath = obj["$ref"];
      if (refPath.startsWith("#/")) {
        const resolved = getByJsonPointer(docAsAny, refPath.slice(2));
        if (resolved !== undefined) {
          return resolveValue(resolved);
        }
      }
      // External refs or unresolvable — leave as-is
      return obj;
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = resolveValue(val);
    }
    return result;
  }

  return resolveValue(doc) as OpenApiDocument;
}

/**
 * Get a value from a nested object using a JSON Pointer path (without leading #/).
 */
function getByJsonPointer(obj: Record<string, unknown>, pointer: string): unknown {
  const parts = pointer.split("/");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Simple YAML parser for basic OpenAPI specs.
 * Handles the subset needed: key-value pairs, nested objects, arrays.
 * This is intentionally minimal — a production version would use a YAML lib.
 */
function parseSimpleYaml(content: string): OpenApiDocument {
  // This is a best-effort parser for structured YAML.
  // It handles indented key: value pairs and basic arrays.
  const result: Record<string, unknown> = {};
  const lines = content.split("\n");
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: result },
  ];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Pop stack until we find the right parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    // Handle array items
    if (trimmed.startsWith("- ")) {
      const lastKey = Object.keys(parent).pop();
      if (lastKey && Array.isArray(parent[lastKey])) {
        const value = trimmed.slice(2).trim();
        (parent[lastKey] as unknown[]).push(parseYamlValue(value));
      }
      continue;
    }

    // Handle key: value
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const valueStr = trimmed.slice(colonIdx + 1).trim();

      if (valueStr === "" || valueStr === "|" || valueStr === ">") {
        // Nested object or multiline
        const nested: Record<string, unknown> = {};
        parent[key] = nested;
        stack.push({ indent, obj: nested });
      } else {
        parent[key] = parseYamlValue(valueStr);
      }
    }
  }

  return result as unknown as OpenApiDocument;
}

function parseYamlValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;
  // Strip quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Extract OpenAPI specification using Route 1 strategy.
 * Returns null if no on-disk spec is found.
 */
export function extractRoute1(rootDir: string): OpenApiExtractionResult | null {
  const specPath = detectOnDiskSpec(rootDir);
  if (!specPath) return null;

  let doc: OpenApiDocument;
  try {
    doc = parseOpenApiFile(specPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Route1Error(`Failed to parse OpenAPI spec at ${specPath}: ${message}`);
  }

  // Validate basic structure
  if (!doc.paths || typeof doc.paths !== "object") {
    throw new Route1Error(`Invalid OpenAPI spec at ${specPath}: missing or invalid 'paths'`);
  }

  // Normalize
  const normalized = normalizeSpec(doc);

  // Convert to extraction result
  const endpoints = pathsToEndpoints(normalized.paths);

  return {
    openapi: normalized.openapi,
    info: normalized.info ?? { title: "API", version: "1.0.0" },
    endpoints,
    unresolved: [],
    source: "introspected",
    confidence: "high",
    strategy: "route1",
  };
}

/**
 * Convert OpenAPI paths object to extracted endpoints.
 */
function pathsToEndpoints(
  paths: Record<string, Record<string, unknown>>,
): OpenApiExtractionResult["endpoints"] {
  const endpoints: OpenApiExtractionResult["endpoints"] = [];
  const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const method of methods) {
      const operation = (pathItem as Record<string, unknown>)[method];
      if (!operation || typeof operation !== "object") continue;

      const op = operation as Record<string, unknown>;
      const params = extractParametersFromOp(op, path);

      endpoints.push({
        method,
        path,
        parameters: params,
        responses: extractResponsesFromOp(op),
        typed: true,
        confidence: "high",
        summary: op.summary as string | undefined,
        description: op.description as string | undefined,
        tags: op.tags as string[] | undefined,
      });
    }
  }

  return endpoints;
}

function extractParametersFromOp(
  op: Record<string, unknown>,
  path: string,
): OpenApiExtractionResult["endpoints"][0]["parameters"] {
  const params: OpenApiExtractionResult["endpoints"][0]["parameters"] = [];

  // Extract path parameters from the path pattern
  const pathParamMatches = path.matchAll(/\{([^}]+)\}/g);
  for (const match of pathParamMatches) {
    params.push({
      name: match[1],
      in: "path",
      required: true,
      type: "string",
    });
  }

  // Extract from parameters array in the operation
  if (Array.isArray(op.parameters)) {
    for (const param of op.parameters) {
      if (param && typeof param === "object") {
        const p = param as Record<string, unknown>;
        // Don't duplicate path params
        if (p.in === "path" && params.some((existing) => existing.name === p.name)) continue;
        params.push({
          name: (p.name as string) ?? "unknown",
          in: (p.in as "path" | "query" | "header" | "cookie") ?? "query",
          required: (p.required as boolean) ?? false,
          type: getSchemaType(p.schema as Record<string, unknown> | undefined),
        });
      }
    }
  }

  return params;
}

function extractResponsesFromOp(
  op: Record<string, unknown>,
): OpenApiExtractionResult["endpoints"][0]["responses"] {
  const responses: OpenApiExtractionResult["endpoints"][0]["responses"] = [];

  if (op.responses && typeof op.responses === "object") {
    for (const [statusCode, response] of Object.entries(op.responses as Record<string, unknown>)) {
      if (!response || typeof response !== "object") continue;
      const resp = response as Record<string, unknown>;
      const content = resp.content as Record<string, unknown> | undefined;

      if (content && typeof content === "object") {
        for (const [contentType, mediaType] of Object.entries(content)) {
          const mt = mediaType as Record<string, unknown>;
          responses.push({
            statusCode,
            contentType,
            schema: (mt.schema as Record<string, unknown>) ?? null,
            description: (resp.description as string) ?? "",
          });
        }
      } else {
        responses.push({
          statusCode,
          contentType: "application/json",
          schema: null,
          description: (resp.description as string) ?? "",
        });
      }
    }
  }

  return responses;
}

function getSchemaType(schema: Record<string, unknown> | undefined): string {
  if (!schema) return "string";
  return (schema.type as string) ?? "string";
}

/**
 * Error class for Route 1 failures.
 */
export class Route1Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Route1Error";
  }
}
