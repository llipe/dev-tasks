/**
 * Integration tests for OpenAPI extraction.
 * Each fixture → expected OpenAPI output + schema validation pass.
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { extractRoute1 } from "../../core/extract/openapi/route1.js";
import { extractRoute3 } from "../../core/extract/openapi/route3.js";
import {
  validateOpenApi,
  extractionResultToDocument,
} from "../../core/extract/openapi/validate.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("Integration: Route 1 - openapi-on-disk fixture", () => {
  it("extracts and validates the on-disk OpenAPI spec", () => {
    const result = extractRoute1(resolve(FIXTURES_DIR, "openapi-on-disk"));
    expect(result).not.toBeNull();
    expect(result!.source).toBe("introspected");
    expect(result!.confidence).toBe("high");
    expect(result!.strategy).toBe("route1");

    // Should have the pet store endpoints
    expect(result!.endpoints.length).toBe(3); // GET /pets, POST /pets, GET /pets/{petId}

    // Convert to document and validate
    const doc = extractionResultToDocument(result!);
    const validation = validateOpenApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("Integration: Route 3 - express-typed fixture", () => {
  it("extracts routes and produces valid OpenAPI output", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "express-typed"));
    expect(result.endpoints.length).toBeGreaterThanOrEqual(4);
    expect(result.source).toBe("inferred");
    expect(result.strategy).toBe("route3");

    // Convert to document and validate
    const doc = extractionResultToDocument(result);
    const validation = validateOpenApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("Integration: Route 3 - fastify-zod fixture", () => {
  it("extracts routes and produces valid OpenAPI output", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "fastify-zod"));
    expect(result.endpoints.length).toBeGreaterThanOrEqual(3);
    expect(result.source).toBe("inferred");

    const doc = extractionResultToDocument(result);
    const validation = validateOpenApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("Integration: Route 3 - hono-routes fixture", () => {
  it("extracts routes and produces valid OpenAPI output", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "hono-routes"));
    expect(result.endpoints.length).toBeGreaterThanOrEqual(4);
    expect(result.source).toBe("inferred");

    const doc = extractionResultToDocument(result);
    const validation = validateOpenApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("Integration: Route 3 - dynamic-routes fixture", () => {
  it("resolves static routes and reports dynamic in unresolved[]", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "dynamic-routes"));

    // Should have the static /health route
    expect(result.endpoints.some((e) => e.path === "/health")).toBe(true);

    // Should have unresolved entries for dynamic routes
    expect(result.unresolved.length).toBeGreaterThan(0);

    // Should still produce valid OpenAPI output for resolved routes
    const doc = extractionResultToDocument(result);
    const validation = validateOpenApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("Integration: Provenance and confidence", () => {
  it("Route 1 attaches source: introspected, confidence: high", () => {
    const result = extractRoute1(resolve(FIXTURES_DIR, "openapi-on-disk"));
    expect(result!.source).toBe("introspected");
    expect(result!.confidence).toBe("high");
    for (const ep of result!.endpoints) {
      expect(ep.confidence).toBe("high");
    }
  });

  it("Route 3 attaches source: inferred with appropriate confidence", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "express-typed"));
    expect(result.source).toBe("inferred");
    // Endpoints should have medium or low confidence
    for (const ep of result.endpoints) {
      expect(["medium", "low"]).toContain(ep.confidence);
    }
  });
});
