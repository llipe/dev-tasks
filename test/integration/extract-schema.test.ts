/**
 * Integration tests for schema extraction.
 * Each fixture → expected schema.md structure (descriptions can be stubbed).
 */

import { describe, it, expect } from "vitest";
import { extractSchema } from "../../core/extract/schema.js";
import { renderSchemaMd } from "../../core/extract/render/schema-md.js";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("integration: schema extraction pipeline", () => {
  describe("Prisma fixture (nestjs-prisma-kafkajs)", () => {
    it("extracts schema and renders markdown", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "nestjs-prisma-kafkajs"),
      });

      expect(result).not.toBeNull();
      expect(result!.orm).toBe("prisma");
      expect(result!.source).toBe("introspected");
      expect(result!.confidence).toBe("high");

      // Render and verify structure
      const md = renderSchemaMd(result!);
      expect(md).toContain("# Database Schema");
      expect(md).toContain("## User");
      expect(md).toContain("## Post");
      expect(md).toContain("## Profile");
      expect(md).toContain("## Category");
      expect(md).toContain("```mermaid");
      expect(md).toContain("erDiagram");
    });

    it("captures all expected columns for User table", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "nestjs-prisma-kafkajs"),
      });

      const user = result!.tables.find((t) => t.name === "User")!;
      const colNames = user.columns.map((c) => c.name);
      expect(colNames).toContain("id");
      expect(colNames).toContain("email");
      expect(colNames).toContain("name");
      expect(colNames).toContain("role");
      expect(colNames).toContain("createdAt");
      expect(colNames).toContain("updatedAt");
    });

    it("captures FK relations", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "nestjs-prisma-kafkajs"),
      });

      const post = result!.tables.find((t) => t.name === "Post")!;
      expect(post.relations.length).toBeGreaterThan(0);
      const authorRel = post.relations.find((r) => r.target === "User")!;
      expect(authorRel.sourceFields).toContain("authorId");
    });
  });

  describe("Drizzle fixture (express-drizzle)", () => {
    it("extracts schema and renders markdown", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "express-drizzle"),
      });

      expect(result).not.toBeNull();
      expect(result!.orm).toBe("drizzle");
      expect(result!.source).toBe("introspected");

      const md = renderSchemaMd(result!);
      expect(md).toContain("## users");
      expect(md).toContain("## posts");
      expect(md).toContain("## categories");
      expect(md).toContain("```mermaid");
    });

    it("captures FK relations from .references()", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "express-drizzle"),
      });

      const posts = result!.tables.find((t) => t.name === "posts")!;
      const authorRel = posts.relations.find((r) => r.target === "users")!;
      expect(authorRel).toBeDefined();
      expect(authorRel.sourceFields).toContain("authorId");
    });
  });

  describe("TypeORM fixture (hono-typeorm)", () => {
    it("extracts schema and renders markdown", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "hono-typeorm"),
      });

      expect(result).not.toBeNull();
      expect(result!.orm).toBe("typeorm");
      expect(result!.source).toBe("introspected");

      const md = renderSchemaMd(result!);
      expect(md).toContain("## User");
      expect(md).toContain("## Post");
      expect(md).toContain("## Category");
      expect(md).toContain("```mermaid");
    });

    it("captures ManyToOne relations", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "hono-typeorm"),
      });

      const post = result!.tables.find((t) => t.name === "Post")!;
      const authorRel = post.relations.find((r) => r.target === "User")!;
      expect(authorRel).toBeDefined();
      expect(authorRel.type).toBe("many-to-one");
    });
  });

  describe("No-ORM fixture (fastify-no-orm)", () => {
    it("returns null — no schema can be extracted without ORM or --db-url", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "fastify-no-orm"),
      });
      expect(result).toBeNull();
    });
  });

  describe("No-ORM with migrations (no-orm-migrations)", () => {
    it("returns null without --db-url (migrations alone are not enough)", async () => {
      const result = await extractSchema({
        rootDir: resolve(FIXTURES_DIR, "no-orm-migrations"),
      });
      expect(result).toBeNull();
    });
  });
});
