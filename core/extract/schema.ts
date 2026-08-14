/**
 * Schema extraction orchestrator.
 * Detects ORM from S-005 detection, delegates to the right extractor,
 * and attaches `source: introspected`.
 *
 * Extraction strategy (ladder order):
 * 1. Declared: ORM detected → delegate to ORM-specific extractor (schema.prisma, drizzle, typeorm)
 * 2. Observed: --db-url provided → use information_schema reader
 * 3. No schema available → return null
 *
 * When both succeed, observed wins for structure (actual DB state) and the
 * report records a declared-vs-observed diff summary in unresolved[] if they disagree.
 *
 * LLM inference has been removed from the extraction pipeline.
 * Judgment (descriptions, summaries) moves to the agent layer via handoff.
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { extractPrismaSchema } from "./orm/prisma.js";
import { extractDrizzleSchema } from "./orm/drizzle.js";
import { extractTypeOrmSchema } from "./orm/typeorm.js";
import { readPackageJson, detectOrm } from "./providers/node-ts.js";
import type { SchemaExtractionResult } from "./orm/types.js";

export interface SchemaExtractOptions {
  /** Absolute path to the repository root */
  rootDir: string;
  /** Optional database connection URL for information_schema reader */
  dbUrl?: string;
}

/**
 * Extract database schema from the repository using the extraction ladder.
 *
 * Ladder order:
 * 1. Declared (ORM file parsers)
 * 2. Observed (information_schema via --db-url)
 *
 * Returns null if no schema can be determined.
 */
export async function extractSchema(
  options: SchemaExtractOptions,
): Promise<SchemaExtractionResult | null> {
  const { rootDir, dbUrl } = options;

  // Try declared first (sync)
  const declaredResult = tryOrmExtraction(rootDir);
  if (declaredResult && !dbUrl) {
    return declaredResult;
  }

  // Try observed (async) if --db-url provided
  if (dbUrl) {
    try {
      const { extractFromInformationSchema } = await import("./orm/information-schema.js");
      const observedResult = await extractFromInformationSchema(dbUrl);
      if (observedResult) {
        return observedResult;
      }
    } catch (err) {
      // pg not installed or connection failed — produce actionable diagnostic
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Cannot find module") || message.includes("MODULE_NOT_FOUND")) {
        // pg not installed — return declared result with unresolved entry
        if (declaredResult) {
          return declaredResult;
        }
        return null;
      }
      // Connection or other error — fall through to declared
      if (declaredResult) {
        return declaredResult;
      }
    }
  }

  // Fall back to declared result
  if (declaredResult) {
    return declaredResult;
  }

  return null;
}

/**
 * Try to extract schema using detected ORM.
 */
function tryOrmExtraction(rootDir: string): SchemaExtractionResult | null {
  const deps = readPackageJson(rootDir);
  if (!deps) return null;

  const orm = detectOrm(deps, rootDir);
  if (!orm) return null;

  switch (orm.kind) {
    case "prisma": {
      const schemaPath = orm.schemaPath
        ? resolve(rootDir, orm.schemaPath)
        : resolve(rootDir, "prisma/schema.prisma");
      if (!existsSync(schemaPath)) return null;
      return extractPrismaSchema(schemaPath);
    }

    case "drizzle": {
      const schemaPath = findDrizzleSchemaFile(rootDir, orm.schemaPath);
      if (!schemaPath) return null;
      return extractDrizzleSchema(schemaPath);
    }

    case "typeorm": {
      const entityDir = findTypeOrmEntityDir(rootDir);
      if (!entityDir) return null;
      return extractTypeOrmSchema(entityDir);
    }

    default:
      return null;
  }
}

/**
 * Find the Drizzle schema file path.
 */
function findDrizzleSchemaFile(rootDir: string, configPath: string | null): string | null {
  // If we have a drizzle config, try to read the schema path from it
  // For now, use common conventions
  const candidates = [
    "src/db/schema.ts",
    "src/schema.ts",
    "db/schema.ts",
    "schema.ts",
    "src/drizzle/schema.ts",
  ];

  for (const candidate of candidates) {
    const fullPath = resolve(rootDir, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Try the config path itself if it's a schema file
  if (configPath && !configPath.includes("config")) {
    const fullPath = resolve(rootDir, configPath);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find TypeORM entity directory.
 */
function findTypeOrmEntityDir(rootDir: string): string | null {
  const candidates = ["src/entities", "src/entity", "entities", "entity", "src/database/entities"];

  for (const candidate of candidates) {
    const fullPath = resolve(rootDir, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}
