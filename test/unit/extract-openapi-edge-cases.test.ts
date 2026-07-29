/**
 * Edge-case tests for OpenAPI extraction:
 * - Nested routers
 * - Dynamic route loop → unresolved
 * - Untyped handlers → low confidence
 * - Malformed on-disk spec → route 1 error
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractRoute1, Route1Error } from "../../core/extract/openapi/route1.js";
import { extractRoute3 } from "../../core/extract/openapi/route3.js";

describe("Route 1 edge cases", () => {
  it("throws Route1Error for malformed JSON spec", () => {
    const tmpDir = join(tmpdir(), `openapi-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, "openapi.json"), "{ invalid json content");

    try {
      expect(() => extractRoute1(tmpDir)).toThrow(Route1Error);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("throws Route1Error for spec without paths", () => {
    const tmpDir = join(tmpdir(), `openapi-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, "openapi.json"),
      JSON.stringify({ openapi: "3.0.0", info: { title: "T", version: "1" } }),
    );

    try {
      expect(() => extractRoute1(tmpDir)).toThrow(Route1Error);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("Route 3 edge cases - untyped handlers", () => {
  it("marks untyped handlers with low confidence", () => {
    const tmpDir = join(tmpdir(), `openapi-test-${Date.now()}`);
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });

    // Create a simple untyped Express app
    writeFileSync(
      join(srcDir, "app.ts"),
      `
import express from "express";
const app = express();
app.get("/untyped", (req, res) => {
  res.send("hello");
});
export default app;
`,
    );
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.18.0" } }),
    );
    writeFileSync(
      join(tmpDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext" },
        include: ["src/**/*.ts"],
      }),
    );

    try {
      const result = extractRoute3(tmpDir);
      const endpoint = result.endpoints.find((e) => e.path === "/untyped");
      expect(endpoint).toBeDefined();
      expect(endpoint!.confidence).toBe("low");
      expect(endpoint!.typed).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("Route 3 edge cases - dynamic routes produce unresolved", () => {
  it("dynamic routes in loops are reported as unresolved", () => {
    const result = extractRoute3(
      resolve(import.meta.dirname, "../fixtures/extract/dynamic-routes"),
    );
    // At least some dynamic routes should be unresolved
    expect(result.unresolved.length).toBeGreaterThan(0);
    // Static /health should still be resolved
    expect(result.endpoints.some((e) => e.path === "/health")).toBe(true);
  });
});

describe("Route 3 edge cases - nested routers (Express)", () => {
  it("discovers routes in nested router files", () => {
    const tmpDir = join(tmpdir(), `openapi-test-nested-${Date.now()}`);
    const srcDir = join(tmpDir, "src");
    mkdirSync(srcDir, { recursive: true });

    // Main app with router
    writeFileSync(
      join(srcDir, "app.ts"),
      `
import express from "express";
const app = express();
const router = express.Router();
router.get("/items", (req, res) => res.json([]));
router.get("/items/:id", (req, res) => res.json({}));
app.get("/health", (req, res) => res.json({ ok: true }));
export default app;
`,
    );
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.18.0" } }),
    );
    writeFileSync(
      join(tmpDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext" },
        include: ["src/**/*.ts"],
      }),
    );

    try {
      const result = extractRoute3(tmpDir);
      // Should find both router-level and app-level routes
      expect(result.endpoints.some((e) => e.path === "/health")).toBe(true);
      expect(result.endpoints.some((e) => e.path === "/items")).toBe(true);
      expect(result.endpoints.some((e) => e.path === "/items/:id")).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
