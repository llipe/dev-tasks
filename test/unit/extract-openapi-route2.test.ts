/**
 * Unit tests for OpenAPI Route 2: Boot + introspect route discovery.
 *
 * Tests validate that the route2 extractor:
 * - Boots an Express app in a child process
 * - Walks the internal router stack to discover ALL routes
 * - Finds dynamically-registered routes that route3 (AST) misses
 * - Finds routes mounted with variable prefixes
 * - Returns `source: "observed"` and `confidence: "high"`
 * - Handles failure gracefully (timeout, bad entry, no export)
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { extractRoute2Express } from "../../core/extract/openapi/route2.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("extractRoute2Express", () => {
  describe("express-bootable fixture", () => {
    it("discovers all endpoints including dynamic routes", async () => {
      const fixtureDir = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractRoute2Express(fixtureDir);

      expect(result).not.toBeNull();
      const endpoints = result!.endpoints;
      const paths = endpoints.map((e) => `${e.method.toUpperCase()} ${e.path}`);

      // Static routes (route3 finds these too)
      expect(paths).toContain("GET /users");
      expect(paths).toContain("GET /users/:id");
      expect(paths).toContain("POST /users");

      // Dynamic routes from config array — route3 CANNOT find these
      expect(paths).toContain("GET /health");
      expect(paths).toContain("GET /metrics");
      expect(paths).toContain("POST /webhooks/stripe");
      expect(paths).toContain("POST /webhooks/github");

      // Variable-prefix router routes — route3 gets the path wrong
      expect(paths).toContain("GET /api/v1/status");
      expect(paths).toContain("GET /api/v1/config");
      expect(paths).toContain("POST /api/v1/config");
    });

    it("returns source: observed and confidence: high", async () => {
      const fixtureDir = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractRoute2Express(fixtureDir);

      expect(result).not.toBeNull();
      expect(result!.source).toBe("observed");
      expect(result!.confidence).toBe("high");
      expect(result!.strategy).toBe("route2");
    });

    it("resolves endpoints route3 misses with correct paths", async () => {
      const fixtureDir = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractRoute2Express(fixtureDir);

      expect(result).not.toBeNull();
      const endpoints = result!.endpoints;

      // At least one dynamic route that route3 completely misses
      const dynamicRoutes = endpoints.filter((e) =>
        ["/health", "/metrics", "/webhooks/stripe", "/webhooks/github"].includes(e.path),
      );
      expect(dynamicRoutes.length).toBeGreaterThanOrEqual(1);

      // Variable-prefix routes with correct composed path
      const prefixedRoutes = endpoints.filter((e) => e.path.startsWith("/api/v1/"));
      expect(prefixedRoutes.length).toBe(3);
    });

    it("each endpoint has method and path", async () => {
      const fixtureDir = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractRoute2Express(fixtureDir);

      expect(result).not.toBeNull();
      for (const endpoint of result!.endpoints) {
        expect(endpoint.method).toMatch(/^(get|post|put|patch|delete|head|options)$/);
        expect(endpoint.path).toMatch(/^\//);
      }
    });
  });

  describe("failure handling", () => {
    it("returns null for a directory with no resolvable entry point", async () => {
      const fixtureDir = resolve(FIXTURES_DIR, "no-framework");
      const result = await extractRoute2Express(fixtureDir);
      expect(result).toBeNull();
    });

    it("returns null when boot times out", async () => {
      // Use a very short timeout to force a timeout
      const fixtureDir = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractRoute2Express(fixtureDir, { timeout: 1 });
      expect(result).toBeNull();
    });
  });
});
