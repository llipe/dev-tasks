import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  detectFramework,
  detectOrm,
  detectMessaging,
  detectOpenApiStrategy,
  hasDep,
  hasDepPrefix,
  readPackageJson,
  type PackageDeps,
} from "#core/extract/providers/node-ts.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/extract");

describe("Node/TS provider — per-signal detectors", () => {
  describe("readPackageJson", () => {
    it("reads a valid package.json", () => {
      const deps = readPackageJson(join(FIXTURES_DIR, "nestjs-prisma-kafkajs"));
      expect(deps).not.toBeNull();
      expect(deps!.dependencies).toHaveProperty("@nestjs/core");
    });

    it("returns null when package.json does not exist", () => {
      const deps = readPackageJson("/nonexistent/path");
      expect(deps).toBeNull();
    });
  });

  describe("hasDep / hasDepPrefix", () => {
    const deps: PackageDeps = {
      dependencies: { express: "^4.18.0" },
      devDependencies: { typescript: "^5.0.0" },
    };

    it("detects dependency in dependencies", () => {
      expect(hasDep(deps, "express")).toBe(true);
    });

    it("detects dependency in devDependencies", () => {
      expect(hasDep(deps, "typescript")).toBe(true);
    });

    it("returns false for missing dependency", () => {
      expect(hasDep(deps, "fastify")).toBe(false);
    });

    it("detects dep prefix", () => {
      const nestDeps: PackageDeps = {
        dependencies: { "@nestjs/core": "^10.0.0" },
        devDependencies: {},
      };
      expect(hasDepPrefix(nestDeps, "@nestjs/")).toBe(true);
    });
  });

  describe("detectFramework", () => {
    it("detects NestJS via @nestjs/ prefix", () => {
      const deps: PackageDeps = {
        dependencies: { "@nestjs/core": "^10.0.0", "@nestjs/common": "^10.0.0" },
        devDependencies: {},
      };
      const result = detectFramework(deps);
      expect(result).not.toBeNull();
      expect(result!.framework).toBe("nestjs");
    });

    it("detects Express", () => {
      const deps: PackageDeps = {
        dependencies: { express: "^4.18.0" },
        devDependencies: {},
      };
      const result = detectFramework(deps);
      expect(result).not.toBeNull();
      expect(result!.framework).toBe("express");
    });

    it("detects Fastify", () => {
      const deps: PackageDeps = {
        dependencies: { fastify: "^4.0.0" },
        devDependencies: {},
      };
      const result = detectFramework(deps);
      expect(result).not.toBeNull();
      expect(result!.framework).toBe("fastify");
    });

    it("detects Hono", () => {
      const deps: PackageDeps = {
        dependencies: { hono: "^4.0.0" },
        devDependencies: {},
      };
      const result = detectFramework(deps);
      expect(result).not.toBeNull();
      expect(result!.framework).toBe("hono");
    });

    it("returns null for no framework", () => {
      const deps: PackageDeps = {
        dependencies: { lodash: "^4.17.0" },
        devDependencies: {},
      };
      const result = detectFramework(deps);
      expect(result).toBeNull();
    });

    it("prioritizes NestJS over Express when both present", () => {
      const deps: PackageDeps = {
        dependencies: {
          "@nestjs/core": "^10.0.0",
          express: "^4.18.0",
        },
        devDependencies: {},
      };
      const result = detectFramework(deps);
      expect(result!.framework).toBe("nestjs");
    });
  });

  describe("detectOrm", () => {
    it("detects Prisma via @prisma/client", () => {
      const deps: PackageDeps = {
        dependencies: { "@prisma/client": "^5.0.0" },
        devDependencies: { prisma: "^5.0.0" },
      };
      const result = detectOrm(deps, join(FIXTURES_DIR, "nestjs-prisma-kafkajs"));
      expect(result).not.toBeNull();
      expect(result!.kind).toBe("prisma");
      expect(result!.schemaPath).toBe("prisma/schema.prisma");
    });

    it("detects Drizzle via drizzle-orm", () => {
      const deps: PackageDeps = {
        dependencies: { "drizzle-orm": "^0.30.0" },
        devDependencies: { "drizzle-kit": "^0.21.0" },
      };
      const result = detectOrm(deps, join(FIXTURES_DIR, "express-drizzle"));
      expect(result).not.toBeNull();
      expect(result!.kind).toBe("drizzle");
      expect(result!.schemaPath).not.toBeNull();
    });

    it("detects TypeORM", () => {
      const deps: PackageDeps = {
        dependencies: { typeorm: "^0.3.0" },
        devDependencies: {},
      };
      const result = detectOrm(deps, join(FIXTURES_DIR, "hono-typeorm"));
      expect(result).not.toBeNull();
      expect(result!.kind).toBe("typeorm");
      expect(result!.schemaPath).toBeNull(); // TypeORM uses decorators
    });

    it("returns null when no ORM found", () => {
      const deps: PackageDeps = {
        dependencies: { fastify: "^4.0.0" },
        devDependencies: {},
      };
      const result = detectOrm(deps, join(FIXTURES_DIR, "fastify-no-orm"));
      expect(result).toBeNull();
    });
  });

  describe("detectMessaging", () => {
    it("detects kafkajs", () => {
      const deps: PackageDeps = {
        dependencies: { kafkajs: "^2.0.0" },
        devDependencies: {},
      };
      const result = detectMessaging(deps);
      expect(result).not.toBeNull();
      expect(result!.client).toBe("kafkajs");
    });

    it("returns null when no messaging client found", () => {
      const deps: PackageDeps = {
        dependencies: { express: "^4.18.0" },
        devDependencies: {},
      };
      const result = detectMessaging(deps);
      expect(result).toBeNull();
    });
  });

  describe("detectOpenApiStrategy", () => {
    it("detects route 1 for NestJS with @nestjs/swagger", () => {
      const deps: PackageDeps = {
        dependencies: { "@nestjs/swagger": "^7.0.0" },
        devDependencies: {},
      };
      const result = detectOpenApiStrategy(
        "nestjs",
        deps,
        join(FIXTURES_DIR, "nestjs-prisma-kafkajs"),
      );
      expect(result.strategy).toBe("route1");
      expect(result.counts.route1).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it("detects route 3 for Express without on-disk spec", () => {
      const deps: PackageDeps = {
        dependencies: { express: "^4.18.0" },
        devDependencies: {},
      };
      const result = detectOpenApiStrategy("express", deps, join(FIXTURES_DIR, "express-drizzle"));
      expect(result.strategy).toBe("route3");
      expect(result.counts.route3).toBeGreaterThan(0);
    });

    it("always reports route2 count as 0 (not yet implemented)", () => {
      const deps: PackageDeps = {
        dependencies: { fastify: "^4.0.0" },
        devDependencies: {},
      };
      const result = detectOpenApiStrategy("fastify", deps, join(FIXTURES_DIR, "fastify-no-orm"));
      expect(result.counts.route2).toBe(0);
    });
  });
});
