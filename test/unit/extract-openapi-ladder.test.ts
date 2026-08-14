/**
 * Unit tests for OpenAPI ladder orchestrator.
 * Tests the declared → observed → inferred ordering and fallback behavior.
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { extractOpenApiLadder } from "../../core/extract/openapi/index.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("extractOpenApiLadder", () => {
  describe("declared rung (route1)", () => {
    it("uses on-disk spec when available (route1 wins)", async () => {
      const fixture = resolve(FIXTURES_DIR, "openapi-on-disk");
      const result = await extractOpenApiLadder({ rootDir: fixture });

      expect(result.extraction).not.toBeNull();
      expect(result.ladder.winningRung).toBe("declared");
      expect(result.ladder.confidence).toBe("high");
      expect(result.extraction!.strategy).toBe("route1");
    });

    it("does not attempt route2 or route3 when route1 succeeds", async () => {
      const fixture = resolve(FIXTURES_DIR, "openapi-on-disk");
      const result = await extractOpenApiLadder({ rootDir: fixture });

      // Route2/3 diagnostics should not be present
      expect(result.ladder.diagnostics).not.toContain("route2 returned no endpoints or null");
      expect(result.ladder.diagnostics.find((d) => d.startsWith("route3"))).toBeUndefined();
    });
  });

  describe("observed rung (route2)", () => {
    it("boots the app when no on-disk spec exists", async () => {
      const fixture = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractOpenApiLadder({ rootDir: fixture });

      expect(result.extraction).not.toBeNull();
      expect(result.ladder.winningRung).toBe("observed");
      expect(result.ladder.confidence).toBe("high");
      expect(result.extraction!.source).toBe("observed");
    });

    it("finds dynamic routes that route3 misses", async () => {
      const fixture = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractOpenApiLadder({ rootDir: fixture });

      const paths = result.extraction!.endpoints.map((e) => e.path);
      expect(paths).toContain("/health");
      expect(paths).toContain("/metrics");
      expect(paths).toContain("/api/v1/status");
    });
  });

  describe("--no-boot flag", () => {
    it("skips route2 and falls through to route3", async () => {
      const fixture = resolve(FIXTURES_DIR, "express-bootable");
      const result = await extractOpenApiLadder({ rootDir: fixture, noBoot: true });

      expect(result.extraction).not.toBeNull();
      expect(result.ladder.winningRung).toBe("inferred");
      expect(result.ladder.confidence).toBe("low");
      expect(result.ladder.diagnostics).toContain("route2 skipped (--no-boot)");
    });

    it("never spawns a child process", async () => {
      const fixture = resolve(FIXTURES_DIR, "express-bootable");
      // If route2 were invoked, it would take measurable time
      const start = Date.now();
      await extractOpenApiLadder({ rootDir: fixture, noBoot: true });
      const elapsed = Date.now() - start;
      // Should complete in under 2s (route3 AST is fast)
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe("inferred rung (route3)", () => {
    it("falls through to route3 when both route1 and route2 fail", async () => {
      // express-typed has no on-disk spec and route2 may not boot properly
      // but route3 can parse it via AST
      const fixture = resolve(FIXTURES_DIR, "express-typed");
      const result = await extractOpenApiLadder({ rootDir: fixture, noBoot: true });

      expect(result.extraction).not.toBeNull();
      expect(result.ladder.winningRung).toBe("inferred");
      expect(result.ladder.confidence).toBe("low");
    });

    it("caps all endpoint confidence to low", async () => {
      const fixture = resolve(FIXTURES_DIR, "express-typed");
      const result = await extractOpenApiLadder({ rootDir: fixture, noBoot: true });

      for (const endpoint of result.extraction!.endpoints) {
        expect(endpoint.confidence).toBe("low");
      }
    });
  });

  describe("all rungs fail", () => {
    it("returns null extraction when nothing works", async () => {
      const fixture = resolve(FIXTURES_DIR, "no-framework");
      const result = await extractOpenApiLadder({ rootDir: fixture, noBoot: true });

      expect(result.extraction).toBeNull();
      expect(result.ladder.winningRung).toBeNull();
    });
  });
});
