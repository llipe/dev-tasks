import { describe, it, expect } from "vitest";
import type {
  Capability,
  ExtractionProvider,
  DetectionResult,
  RepoContext,
  RequiresHumanEntry,
} from "#core/extract/provider.js";

describe("ExtractionProvider interface and types", () => {
  describe("Capability type", () => {
    it("allows all valid capability values", () => {
      const capabilities: Capability[] = [
        "openapi_native",
        "openapi_ast",
        "db_introspection",
        "orm_ast",
        "topic_ast",
        "payload_typed",
      ];
      expect(capabilities).toHaveLength(6);
    });
  });

  describe("DetectionResult type", () => {
    it("includes stack, http, orm, messaging, and type_hint fields", () => {
      const result: DetectionResult = {
        stack: ["node", "typescript", "nestjs"],
        http: {
          framework: "nestjs",
          openapi_strategy: "route1",
          strategy_counts: { route1: 1, route2: 0, route3: 1 },
          evidence: [{ signal: "@nestjs/swagger", location: "package.json" }],
        },
        orm: {
          kind: "prisma",
          schema_path: "prisma/schema.prisma",
        },
        messaging: {
          client: "kafkajs",
          evidence: [{ signal: "kafkajs", location: "package.json" }],
        },
        type_hint: "node-nestjs-prisma-kafkajs",
      };

      expect(result.stack).toContain("node");
      expect(result.http?.framework).toBe("nestjs");
      expect(result.http?.openapi_strategy).toBe("route1");
      expect(result.http?.strategy_counts).toHaveProperty("route1");
      expect(result.http?.strategy_counts).toHaveProperty("route2");
      expect(result.http?.strategy_counts).toHaveProperty("route3");
      expect(result.orm?.kind).toBe("prisma");
      expect(result.orm?.schema_path).toBe("prisma/schema.prisma");
      expect(result.messaging?.client).toBe("kafkajs");
      expect(result.type_hint).toBe("node-nestjs-prisma-kafkajs");
    });

    it("allows null for optional sections", () => {
      const result: DetectionResult = {
        stack: ["node", "typescript"],
        http: null,
        orm: null,
        messaging: null,
        type_hint: "node-ts-no-framework",
      };

      expect(result.http).toBeNull();
      expect(result.orm).toBeNull();
      expect(result.messaging).toBeNull();
    });

    it("reports per-strategy OpenAPI count even without route 2", () => {
      const result: DetectionResult = {
        stack: ["node", "typescript", "express"],
        http: {
          framework: "express",
          openapi_strategy: "route3",
          strategy_counts: { route1: 0, route2: 0, route3: 15 },
          evidence: [{ signal: "express", location: "package.json" }],
        },
        orm: null,
        messaging: null,
        type_hint: "node-express",
      };

      expect(result.http!.strategy_counts.route2).toBe(0);
      expect(result.http!.strategy_counts.route3).toBe(15);
    });
  });

  describe("ExtractionProvider interface", () => {
    it("declares id, detect, capabilities, and optional extract methods", () => {
      const provider: ExtractionProvider = {
        id: "test-provider",
        capabilities: ["openapi_ast", "orm_ast"],
        detect(_repo: RepoContext): DetectionResult | null {
          return null;
        },
      };

      expect(provider.id).toBe("test-provider");
      expect(provider.capabilities).toContain("openapi_ast");
      expect(provider.detect({ rootDir: "/tmp" })).toBeNull();
      // Optional methods not present — that's valid
      expect(provider.extractSchema).toBeUndefined();
      expect(provider.extractOpenApi).toBeUndefined();
      expect(provider.extractAsyncApi).toBeUndefined();
    });

    it("allows optional extract methods to be defined", () => {
      const provider: ExtractionProvider = {
        id: "full-provider",
        capabilities: ["openapi_ast", "orm_ast", "topic_ast"],
        detect(_repo: RepoContext): DetectionResult | null {
          return {
            stack: ["node"],
            http: null,
            orm: null,
            messaging: null,
            type_hint: "node",
          };
        },
        async extractSchema(_repo: RepoContext) {
          return { tables: [] };
        },
        async extractOpenApi(_repo: RepoContext) {
          return { openapi: "3.1.0", paths: {} };
        },
        async extractAsyncApi(_repo: RepoContext) {
          return { asyncapi: "3.0.0", channels: {} };
        },
      };

      expect(provider.extractSchema).toBeDefined();
      expect(provider.extractOpenApi).toBeDefined();
      expect(provider.extractAsyncApi).toBeDefined();
    });
  });

  describe("RequiresHumanEntry type", () => {
    it("records missing capability information", () => {
      const entry: RequiresHumanEntry = {
        artifact: "openapi.yaml",
        reason: "No OpenAPI spec found and no route discovery capability",
        missing_capability: "openapi_native",
      };

      expect(entry.artifact).toBe("openapi.yaml");
      expect(entry.missing_capability).toBe("openapi_native");
    });
  });
});
