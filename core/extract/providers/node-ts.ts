/**
 * Node/TypeScript extraction provider.
 * Inspects package.json deps, directory structure, and config files to detect:
 * - HTTP framework (nestjs, express, fastify, hono)
 * - ORM (prisma, drizzle, typeorm)
 * - Messaging (kafkajs)
 *
 * Reports openapi_strategy per the detection matrix (route 1/2/3)
 * and per-strategy evidence count.
 *
 * Deterministic: pure config/file inspection, no LLM.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Capability,
  DetectionEvidence,
  DetectionResult,
  ExtractionProvider,
  HttpDetection,
  MessagingDetection,
  OpenApiStrategy,
  OrmDetection,
  RepoContext,
} from "../provider.js";

// --- Signal detection functions (exported for unit testing) ---

export interface PackageDeps {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * Read and parse package.json from the given directory.
 * Returns null if not found or invalid JSON.
 */
export function readPackageJson(rootDir: string): PackageDeps | null {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return {
      dependencies: (pkg.dependencies as Record<string, string>) ?? {},
      devDependencies: (pkg.devDependencies as Record<string, string>) ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Check if a dependency exists in either dependencies or devDependencies.
 */
export function hasDep(deps: PackageDeps, name: string): boolean {
  return name in deps.dependencies || name in deps.devDependencies;
}

/**
 * Check if any dependency matching a prefix exists.
 */
export function hasDepPrefix(deps: PackageDeps, prefix: string): boolean {
  const allDeps = { ...deps.dependencies, ...deps.devDependencies };
  return Object.keys(allDeps).some((k) => k.startsWith(prefix));
}

// --- Framework detection ---

export interface FrameworkSignal {
  framework: string;
  dep: string;
  location: string;
}

/**
 * Detect HTTP framework from package.json dependencies.
 */
export function detectFramework(deps: PackageDeps): FrameworkSignal | null {
  // Priority order: nestjs > fastify > hono > express
  if (hasDepPrefix(deps, "@nestjs/")) {
    return {
      framework: "nestjs",
      dep: "@nestjs/core",
      location: "package.json",
    };
  }
  if (hasDep(deps, "fastify")) {
    return {
      framework: "fastify",
      dep: "fastify",
      location: "package.json",
    };
  }
  if (hasDep(deps, "hono")) {
    return {
      framework: "hono",
      dep: "hono",
      location: "package.json",
    };
  }
  if (hasDep(deps, "express")) {
    return {
      framework: "express",
      dep: "express",
      location: "package.json",
    };
  }
  return null;
}

// --- ORM detection ---

export interface OrmSignal {
  kind: string;
  dep: string;
  schemaPath: string | null;
}

/**
 * Detect ORM from package.json dependencies and config file presence.
 */
export function detectOrm(deps: PackageDeps, rootDir: string): OrmSignal | null {
  // Check Prisma
  if (hasDep(deps, "@prisma/client") || hasDep(deps, "prisma")) {
    const schemaPath = findPrismaSchema(rootDir);
    return {
      kind: "prisma",
      dep: "@prisma/client",
      schemaPath,
    };
  }

  // Check Drizzle
  if (hasDep(deps, "drizzle-orm") || hasDep(deps, "drizzle-kit")) {
    const schemaPath = findDrizzleSchema(rootDir);
    return {
      kind: "drizzle",
      dep: "drizzle-orm",
      schemaPath,
    };
  }

  // Check TypeORM
  if (hasDep(deps, "typeorm")) {
    return {
      kind: "typeorm",
      dep: "typeorm",
      schemaPath: null, // TypeORM uses decorator-based entities
    };
  }

  return null;
}

/**
 * Find Prisma schema file.
 */
function findPrismaSchema(rootDir: string): string | null {
  const candidates = ["prisma/schema.prisma", "schema.prisma", "src/prisma/schema.prisma"];
  for (const candidate of candidates) {
    if (existsSync(join(rootDir, candidate))) {
      return candidate;
    }
  }
  return null;
}

/**
 * Find Drizzle schema path from config or conventions.
 */
function findDrizzleSchema(rootDir: string): string | null {
  // Check drizzle.config.ts/js existence
  const configCandidates = ["drizzle.config.ts", "drizzle.config.js", "drizzle.config.mjs"];
  for (const candidate of configCandidates) {
    if (existsSync(join(rootDir, candidate))) {
      return candidate;
    }
  }

  // Check common schema locations
  const schemaCandidates = ["src/db/schema.ts", "src/schema.ts", "db/schema.ts"];
  for (const candidate of schemaCandidates) {
    if (existsSync(join(rootDir, candidate))) {
      return candidate;
    }
  }

  return null;
}

// --- Messaging detection ---

export interface MessagingSignal {
  client: string;
  dep: string;
}

/**
 * Detect messaging client from package.json dependencies.
 */
export function detectMessaging(deps: PackageDeps): MessagingSignal | null {
  if (hasDep(deps, "kafkajs")) {
    return { client: "kafkajs", dep: "kafkajs" };
  }
  return null;
}

// --- OpenAPI strategy detection ---

/**
 * Determine OpenAPI strategy based on framework detection and available signals.
 */
export function detectOpenApiStrategy(
  framework: string,
  deps: PackageDeps,
  rootDir: string,
): {
  strategy: OpenApiStrategy;
  counts: Record<OpenApiStrategy, number>;
  evidence: DetectionEvidence[];
} {
  const counts: Record<OpenApiStrategy, number> = { route1: 0, route2: 0, route3: 0 };
  const evidence: DetectionEvidence[] = [];

  // Route 1: check for on-disk OpenAPI spec
  const openapiFiles = [
    "openapi.yaml",
    "openapi.yml",
    "openapi.json",
    "swagger.yaml",
    "swagger.yml",
    "swagger.json",
    "api/openapi.yaml",
    "api/openapi.yml",
    "api/openapi.json",
    "docs/openapi.yaml",
    "docs/openapi.yml",
    "docs/openapi.json",
    "docs/api/openapi.yaml",
    "docs/api/openapi.yml",
    "docs/api/openapi.json",
    "spec/openapi.yaml",
    "spec/openapi.yml",
    "spec/openapi.json",
  ];
  for (const file of openapiFiles) {
    if (existsSync(join(rootDir, file))) {
      counts.route1++;
      evidence.push({
        signal: "openapi_spec_file",
        location: file,
        detail: "On-disk OpenAPI specification found",
      });
    }
  }

  // Route 1 also: NestJS + @nestjs/swagger → can generate spec at build time
  if (framework === "nestjs" && hasDep(deps, "@nestjs/swagger")) {
    counts.route1++;
    evidence.push({
      signal: "@nestjs/swagger",
      location: "package.json",
      detail: "NestJS Swagger module — spec available at runtime/build",
    });
  }

  // Route 3: AST-based route discovery (always available for known frameworks)
  if (framework) {
    counts.route3++;
    evidence.push({
      signal: `${framework}_routes`,
      location: "source files",
      detail: `AST route discovery available for ${framework}`,
    });
  }

  // Determine primary strategy
  let strategy: OpenApiStrategy;
  if (counts.route1 > 0) {
    strategy = "route1";
  } else if (counts.route3 > 0) {
    strategy = "route3";
  } else {
    strategy = "route3"; // Default for known frameworks
  }

  return { strategy, counts, evidence };
}

// --- Provider implementation ---

/**
 * Node/TypeScript extraction provider.
 */
export const nodeTsProvider: ExtractionProvider = {
  id: "node-ts",

  capabilities: [
    "openapi_native",
    "openapi_ast",
    "orm_ast",
    "topic_ast",
    "payload_typed",
  ] as Capability[],

  detect(repo: RepoContext): DetectionResult | null {
    const deps = readPackageJson(repo.rootDir);
    if (!deps) {
      return null;
    }

    // Must have TypeScript or be a Node project
    const isNode =
      hasDep(deps, "typescript") ||
      hasDepPrefix(deps, "@types/") ||
      Object.keys(deps.dependencies).length > 0 ||
      Object.keys(deps.devDependencies).length > 0;

    if (!isNode) {
      return null;
    }

    // Detect stack components
    const frameworkSignal = detectFramework(deps);
    const ormSignal = detectOrm(deps, repo.rootDir);
    const messagingSignal = detectMessaging(deps);

    // If no framework, ORM, or messaging, this is a plain Node project — still valid
    const stack: string[] = ["node"];
    if (hasDep(deps, "typescript") || hasDepPrefix(deps, "@types/")) {
      stack.push("typescript");
    }

    // Build detection sections
    let http: HttpDetection | null = null;
    if (frameworkSignal) {
      stack.push(frameworkSignal.framework);
      const openApiDetection = detectOpenApiStrategy(frameworkSignal.framework, deps, repo.rootDir);
      http = {
        framework: frameworkSignal.framework,
        openapi_strategy: openApiDetection.strategy,
        strategy_counts: openApiDetection.counts,
        evidence: [
          {
            signal: frameworkSignal.dep,
            location: frameworkSignal.location,
          },
          ...openApiDetection.evidence,
        ],
      };
    }

    let orm: OrmDetection | null = null;
    if (ormSignal) {
      stack.push(ormSignal.kind);
      orm = {
        kind: ormSignal.kind,
        schema_path: ormSignal.schemaPath,
      };
    }

    let messaging: MessagingDetection | null = null;
    if (messagingSignal) {
      stack.push(messagingSignal.client);
      messaging = {
        client: messagingSignal.client,
        evidence: [
          {
            signal: messagingSignal.dep,
            location: "package.json",
          },
        ],
      };
    }

    // Build type_hint
    const hintParts = ["node"];
    if (frameworkSignal) hintParts.push(frameworkSignal.framework);
    if (ormSignal) hintParts.push(ormSignal.kind);
    if (messagingSignal) hintParts.push(messagingSignal.client);
    if (hintParts.length === 1) hintParts.push("ts-no-framework");
    const type_hint = hintParts.join("-");

    return {
      stack,
      http,
      orm,
      messaging,
      type_hint,
    };
  },
};
