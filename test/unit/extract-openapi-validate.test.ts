/**
 * Unit tests for OpenAPI 3.1 validation.
 */

import { describe, it, expect } from "vitest";
import {
  validateOpenApi,
  extractionResultToDocument,
} from "../../core/extract/openapi/validate.js";
import type { OpenApiDocument, OpenApiExtractionResult } from "../../core/extract/openapi/types.js";

describe("validateOpenApi", () => {
  it("validates a correct OpenAPI 3.1 document", () => {
    const doc: OpenApiDocument = {
      openapi: "3.1.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing openapi field", () => {
    const doc = {
      info: { title: "Test", version: "1.0.0" },
      paths: {},
    } as unknown as OpenApiDocument;
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/openapi")).toBe(true);
  });

  it("rejects non-3.1.x openapi version", () => {
    const doc: OpenApiDocument = {
      openapi: "3.0.3",
      info: { title: "Test", version: "1.0.0" },
      paths: {},
    };
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("3.1.x"))).toBe(true);
  });

  it("rejects missing info field", () => {
    const doc = {
      openapi: "3.1.0",
      paths: {},
    } as unknown as OpenApiDocument;
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/info")).toBe(true);
  });

  it("rejects missing paths field", () => {
    const doc = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
    } as unknown as OpenApiDocument;
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/paths")).toBe(true);
  });

  it("rejects paths that don't start with /", () => {
    const doc: OpenApiDocument = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        users: {
          get: { responses: { "200": { description: "OK" } } },
        },
      },
    };
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("start with '/'"))).toBe(true);
  });

  it("rejects invalid HTTP methods", () => {
    const doc: OpenApiDocument = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/users": {
          foo: { responses: { "200": { description: "OK" } } },
        },
      },
    };
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("Invalid HTTP method"))).toBe(true);
  });

  it("rejects operations without responses", () => {
    const doc: OpenApiDocument = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/users": {
          get: {},
        },
      },
    };
    const result = validateOpenApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("responses"))).toBe(true);
  });
});

describe("extractionResultToDocument", () => {
  it("converts extraction result to valid OpenAPI document", () => {
    const result: OpenApiExtractionResult = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      endpoints: [
        {
          method: "get",
          path: "/users",
          parameters: [],
          responses: [
            {
              statusCode: "200",
              contentType: "application/json",
              schema: { type: "array" },
              description: "OK",
            },
          ],
          typed: true,
          confidence: "medium",
        },
        {
          method: "get",
          path: "/users/:id",
          parameters: [{ name: "id", in: "path", required: true, type: "string" }],
          responses: [
            {
              statusCode: "200",
              contentType: "application/json",
              schema: { type: "object" },
              description: "OK",
            },
          ],
          typed: true,
          confidence: "medium",
        },
      ],
      unresolved: [],
      source: "inferred",
      confidence: "medium",
      strategy: "route3",
    };

    const doc = extractionResultToDocument(result);
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/users"]).toBeDefined();
    expect(doc.paths["/users/:id"]).toBeDefined();

    const validation = validateOpenApi(doc);
    expect(validation.valid).toBe(true);
  });
});
