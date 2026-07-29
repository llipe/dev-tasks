/**
 * Schema extraction orchestrator.
 * Detects ORM from S-005 detection, delegates to the right extractor,
 * and attaches `source: introspected`.
 *
 * Fallback chain:
 * 1. ORM detected → delegate to ORM-specific extractor
 * 2. --db-url provided → use information_schema reader
 * 3. SQL migrations found → LLM inference (source: inferred, confidence: low)
 * 4. None of the above → return null
 */

import { resolve, join } from "node:path";
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
  /** Optional LLM provider for migration inference / descriptions */
  llm?: LlmProvider;
}

/**
 * LLM provider interface for schema inference and descriptions.
 * Consumers provide an implementation; tests use stubs.
 */
export interface LlmProvider {
  /** Infer schema from SQL migration content */
  inferSchemaFromMigrations(migrationContent: string): Promise<SchemaExtractionResult>;
  /** Generate semantic descriptions for tables */
  describeSchema(schema: SchemaExtractionResult): Promise<SchemaExtractionResult>;
}

/**
 * Extract database schema from the repository.
 * Returns null if no schema can be determined.
 */
export async function extractSchema(
  options: SchemaExtractOptions,
): Promise<SchemaExtractionResult | null> {
  const { rootDir, dbUrl, llm } = options;

  // Step 1: Try ORM-based extraction
  const ormResult = tryOrmExtraction(rootDir);
  if (ormResult) {
    return ormResult;
  }

  // Step 2: Try information_schema reader (if --db-url provided)
  if (dbUrl) {
    const { extractFromInformationSchema } = await import("./orm/information-schema.js");
    return extractFromInformationSchema(dbUrl);
  }

  // Step 3: Try LLM inference from SQL migrations
  if (llm) {
    const migrationContent = findMigrationContent(rootDir);
    if (migrationContent) {
      return llm.inferSchemaFromMigrations(migrationContent);
    }
  }

  // Step 4: No schema available
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

/**
 * Find SQL migration content for LLM inference.
 */
function findMigrationContent(rootDir: string): string | null {
  const migrationDirs = [
    "migrations",
    "src/migrations",
    "db/migrations",
    "prisma/migrations",
    "drizzle",
  ];

  for (const dir of migrationDirs) {
    const fullPath = join(rootDir, dir);
    if (existsSync(fullPath)) {
      // Would read .sql files from the directory
      // For now, return the dir path as indicator that migrations exist
      return fullPath;
    }
  }

  return null;
}
