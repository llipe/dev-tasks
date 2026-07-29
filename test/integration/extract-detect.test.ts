import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { runDetection, registerProvider, clearProviders } from "#core/extract/detect.js";
import { nodeTsProvider } from "#core/extract/providers/node-ts.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/extract");

describe("extract detect — integration (fixture repos)", () => {
  beforeEach(() => {
    clearProviders();
    registerProvider(nodeTsProvider);
  });

  it("nestjs-prisma-kafkajs → full detection", () => {
    const result = runDetection({
      rootDir: join(FIXTURES_DIR, "nestjs-prisma-kafkajs"),
    });

    expect(result).not.toBeNull();
    expect(result!.stack).toContain("node");
    expect(result!.stack).toContain("nestjs");
    expect(result!.stack).toContain("prisma");
    expect(result!.stack).toContain("kafkajs");

    // HTTP
    expect(result!.http).not.toBeNull();
    expect(result!.http!.framework).toBe("nestjs");
    expect(result!.http!.openapi_strategy).toBe("route1");
    expect(result!.http!.strategy_counts.route1).toBeGreaterThan(0);
    expect(result!.http!.strategy_counts.route2).toBe(0);
    expect(result!.http!.strategy_counts.route3).toBeGreaterThan(0);
    expect(result!.http!.evidence.length).toBeGreaterThan(0);

    // ORM
    expect(result!.orm).not.toBeNull();
    expect(result!.orm!.kind).toBe("prisma");
    expect(result!.orm!.schema_path).toBe("prisma/schema.prisma");

    // Messaging
    expect(result!.messaging).not.toBeNull();
    expect(result!.messaging!.client).toBe("kafkajs");
    expect(result!.messaging!.evidence.length).toBeGreaterThan(0);

    // type_hint
    expect(result!.type_hint).toBe("node-nestjs-prisma-kafkajs");
  });

  it("express-drizzle → express + drizzle detection", () => {
    const result = runDetection({
      rootDir: join(FIXTURES_DIR, "express-drizzle"),
    });

    expect(result).not.toBeNull();
    expect(result!.stack).toContain("node");
    expect(result!.stack).toContain("typescript");
    expect(result!.stack).toContain("express");
    expect(result!.stack).toContain("drizzle");

    expect(result!.http).not.toBeNull();
    expect(result!.http!.framework).toBe("express");
    expect(result!.http!.openapi_strategy).toBe("route3");

    expect(result!.orm).not.toBeNull();
    expect(result!.orm!.kind).toBe("drizzle");
    expect(result!.orm!.schema_path).not.toBeNull();

    expect(result!.messaging).toBeNull();
    expect(result!.type_hint).toBe("node-express-drizzle");
  });

  it("fastify-no-orm → fastify only, no ORM/messaging", () => {
    const result = runDetection({
      rootDir: join(FIXTURES_DIR, "fastify-no-orm"),
    });

    expect(result).not.toBeNull();
    expect(result!.stack).toContain("node");
    expect(result!.stack).toContain("typescript");
    expect(result!.stack).toContain("fastify");

    expect(result!.http).not.toBeNull();
    expect(result!.http!.framework).toBe("fastify");
    expect(result!.http!.openapi_strategy).toBe("route3");

    expect(result!.orm).toBeNull();
    expect(result!.messaging).toBeNull();
    expect(result!.type_hint).toBe("node-fastify");
  });

  it("hono-typeorm → hono + typeorm detection", () => {
    const result = runDetection({
      rootDir: join(FIXTURES_DIR, "hono-typeorm"),
    });

    expect(result).not.toBeNull();
    expect(result!.stack).toContain("node");
    expect(result!.stack).toContain("typescript");
    expect(result!.stack).toContain("hono");
    expect(result!.stack).toContain("typeorm");

    expect(result!.http).not.toBeNull();
    expect(result!.http!.framework).toBe("hono");

    expect(result!.orm).not.toBeNull();
    expect(result!.orm!.kind).toBe("typeorm");
    expect(result!.orm!.schema_path).toBeNull(); // TypeORM uses decorators

    expect(result!.messaging).toBeNull();
    expect(result!.type_hint).toBe("node-hono-typeorm");
  });

  it("no-framework → plain node, no http/orm/messaging", () => {
    const result = runDetection({
      rootDir: join(FIXTURES_DIR, "no-framework"),
    });

    expect(result).not.toBeNull();
    expect(result!.stack).toContain("node");
    expect(result!.stack).toContain("typescript");

    expect(result!.http).toBeNull();
    expect(result!.orm).toBeNull();
    expect(result!.messaging).toBeNull();
    expect(result!.type_hint).toBe("node-ts-no-framework");
  });

  it("per-strategy OpenAPI count reported even without route 2", () => {
    const result = runDetection({
      rootDir: join(FIXTURES_DIR, "express-drizzle"),
    });

    expect(result).not.toBeNull();
    expect(result!.http).not.toBeNull();
    expect(result!.http!.strategy_counts).toHaveProperty("route1");
    expect(result!.http!.strategy_counts).toHaveProperty("route2");
    expect(result!.http!.strategy_counts).toHaveProperty("route3");
    expect(result!.http!.strategy_counts.route2).toBe(0);
  });
});
