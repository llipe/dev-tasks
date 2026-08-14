/**
 * Schema extraction orchestrator.
 * Detects ORM from S-005 detection, delegates to the right extractor,
 * and attaches `source: introspected`.
 *
 * Extraction strategy (ladder order):
 * 1. ORM detected → delegate to ORM-specific extractor (declared)
 * 2. --db-url provided → use information_schema reader (observed)
 * 3. No schema available → return null
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
 * Extract database schema from the repository.
 * Returns null if no schema can be determined.
 *
 * Extraction strategy (ladder order):
 * 1. ORM detected → delegate to ORM-specific extractor (declared)
 * 2. --db-url provided → use information_schema reader (observed)
 * 3. No schema available → return null
 */
export async function extractSchema(
  options: SchemaExtractOptions,
): Promise<SchemaExtractionResult | null> {
  const { rootDir, dbUrl } = options;

  // Step 1: Try ORM-based extraction (declared)
  const ormResult = tryOrmExtraction(rootDir);
  if (ormResult) {
    return ormResult;
  }

  // Step 2: Try information_schema reader (if --db-url provided) (observed)
  if (dbUrl) {
    const { extractFromInformationSchema } = await import("./orm/information-schema.js");
    return extractFromInformationSchema(dbUrl);
  }

  // Step 3: No schema available
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
