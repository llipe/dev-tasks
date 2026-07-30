/**
 * Unit tests for schema extraction orchestrator.
 * Tests ORM detection + delegation to the correct extractor.
 */

import { describe, it, expect } from "vitest";
import { extractSchema } from "../../core/extract/schema.js";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("extractSchema orchestrator", () => {
  it("detects Prisma and delegates to Prisma extractor", async () => {
    const result = await extractSchema({
      rootDir: resolve(FIXTURES_DIR, "nestjs-prisma-kafkajs"),
    });
    expect(result).not.toBeNull();
    expect(result!.orm).toBe("prisma");
    expect(result!.source).toBe("introspected");
    expect(result!.tables.length).toBeGreaterThan(0);
  });

  it("detects Drizzle and delegates to Drizzle extractor", async () => {
    const result = await extractSchema({
      rootDir: resolve(FIXTURES_DIR, "express-drizzle"),
    });
    expect(result).not.toBeNull();
    expect(result!.orm).toBe("drizzle");
    expect(result!.source).toBe("introspected");
    expect(result!.tables.length).toBeGreaterThan(0);
  });

  it("detects TypeORM and delegates to TypeORM extractor", async () => {
    const result = await extractSchema({
      rootDir: resolve(FIXTURES_DIR, "hono-typeorm"),
    });
    expect(result).not.toBeNull();
    expect(result!.orm).toBe("typeorm");
    expect(result!.source).toBe("introspected");
    expect(result!.tables.length).toBeGreaterThan(0);
  });

  it("returns null for repos with no ORM and no --db-url", async () => {
    const result = await extractSchema({
      rootDir: resolve(FIXTURES_DIR, "fastify-no-orm"),
    });
    expect(result).toBeNull();
  });

  it("attaches source: introspected for ORM-based extraction", async () => {
    const result = await extractSchema({
      rootDir: resolve(FIXTURES_DIR, "nestjs-prisma-kafkajs"),
    });
    expect(result!.source).toBe("introspected");
    expect(result!.confidence).toBe("high");
  });
});
