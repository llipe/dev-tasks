/**
 * Unit tests for OpenAPI Route 3: AST-based route discovery.
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  extractRoute3,
  composePath,
  extractPathParams,
} from "../../core/extract/openapi/route3.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("composePath", () => {
  it("composes prefix and route correctly", () => {
    expect(composePath("/api", "/users")).toBe("/api/users");
  });

  it("handles empty prefix", () => {
    expect(composePath("", "/users")).toBe("/users");
  });

  it("handles trailing slash on prefix", () => {
    expect(composePath("/api/", "/users")).toBe("/api/users");
  });

  it("handles route without leading slash", () => {
    expect(composePath("/api", "users")).toBe("/api/users");
  });

  it("returns / for empty inputs", () => {
    expect(composePath("", "/")).toBe("/");
  });
});

describe("extractPathParams", () => {
  it("extracts Express-style :param", () => {
    const params = extractPathParams("/users/:id");
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("id");
    expect(params[0].in).toBe("path");
    expect(params[0].required).toBe(true);
  });

  it("extracts multiple params", () => {
    const params = extractPathParams("/users/:userId/posts/:postId");
    expect(params).toHaveLength(2);
    expect(params[0].name).toBe("userId");
    expect(params[1].name).toBe("postId");
  });

  it("extracts OpenAPI-style {param}", () => {
    const params = extractPathParams("/users/{id}");
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("id");
  });

  it("returns empty array for paths without params", () => {
    const params = extractPathParams("/users");
    expect(params).toHaveLength(0);
  });
});

describe("extractRoute3 - Express typed handlers", () => {
  it("discovers routes from Express app with typed handlers", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "express-typed"));
    expect(result).toBeDefined();
    expect(result.source).toBe("inferred");
    expect(result.strategy).toBe("route3");
    expect(result.openapi).toBe("3.1.0");
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it("finds GET /users endpoint", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "express-typed"));
    const getUsers = result.endpoints.find((e) => e.method === "get" && e.path === "/users");
    expect(getUsers).toBeDefined();
  });

  it("finds GET /users/:id with path param", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "express-typed"));
    const getUser = result.endpoints.find((e) => e.method === "get" && e.path === "/users/:id");
    expect(getUser).toBeDefined();
    expect(getUser!.parameters.some((p) => p.name === "id" && p.in === "path")).toBe(true);
  });

  it("finds POST /users endpoint", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "express-typed"));
    const postUsers = result.endpoints.find((e) => e.method === "post" && e.path === "/users");
    expect(postUsers).toBeDefined();
  });

  it("finds DELETE /users/:id endpoint", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "express-typed"));
    const deleteUser = result.endpoints.find(
      (e) => e.method === "delete" && e.path === "/users/:id",
    );
    expect(deleteUser).toBeDefined();
  });
});

describe("extractRoute3 - Fastify + zod", () => {
  it("discovers routes from Fastify app with zod schemas", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "fastify-zod"));
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it("finds GET /products endpoint", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "fastify-zod"));
    const getProducts = result.endpoints.find((e) => e.method === "get" && e.path === "/products");
    expect(getProducts).toBeDefined();
  });

  it("finds GET /products/:id with path param", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "fastify-zod"));
    const getProduct = result.endpoints.find(
      (e) => e.method === "get" && e.path === "/products/:id",
    );
    expect(getProduct).toBeDefined();
    expect(getProduct!.parameters.some((p) => p.name === "id")).toBe(true);
  });

  it("finds POST /products endpoint", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "fastify-zod"));
    const postProducts = result.endpoints.find(
      (e) => e.method === "post" && e.path === "/products",
    );
    expect(postProducts).toBeDefined();
  });
});

describe("extractRoute3 - Hono", () => {
  it("discovers routes from Hono app", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "hono-routes"));
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it("finds GET /health endpoint", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "hono-routes"));
    const health = result.endpoints.find((e) => e.method === "get" && e.path === "/health");
    expect(health).toBeDefined();
  });

  it("finds CRUD routes for /items", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "hono-routes"));
    const getItems = result.endpoints.find((e) => e.method === "get" && e.path === "/items");
    const getItem = result.endpoints.find((e) => e.method === "get" && e.path === "/items/:id");
    const postItem = result.endpoints.find((e) => e.method === "post" && e.path === "/items");
    const deleteItem = result.endpoints.find(
      (e) => e.method === "delete" && e.path === "/items/:id",
    );

    expect(getItems).toBeDefined();
    expect(getItem).toBeDefined();
    expect(postItem).toBeDefined();
    expect(deleteItem).toBeDefined();
  });
});

describe("extractRoute3 - Dynamic routes (unresolved)", () => {
  it("reports dynamic routes in unresolved[]", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "dynamic-routes"));
    expect(result.unresolved.length).toBeGreaterThan(0);
  });

  it("still resolves static routes", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "dynamic-routes"));
    const health = result.endpoints.find((e) => e.method === "get" && e.path === "/health");
    expect(health).toBeDefined();
  });

  it("unresolved entries have file, line, reason, and snippet", () => {
    const result = extractRoute3(resolve(FIXTURES_DIR, "dynamic-routes"));
    for (const u of result.unresolved) {
      expect(u.file).toBeDefined();
      expect(u.line).toBeGreaterThan(0);
      expect(u.reason).toBeDefined();
      expect(u.snippet).toBeDefined();
    }
  });
});
