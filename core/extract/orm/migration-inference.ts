/**
 * Migration-based schema inference fallback.
 * When no ORM and no --db-url is available, but SQL migrations exist,
 * uses an LLM provider to infer schema from migration SQL content.
 *
 * Marks results as: source: "inferred", confidence: "low"
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import type { SchemaExtractionResult } from "./types.js";
import type { LlmProvider } from "../schema.js";

/**
 * Find SQL migration files in known migration directories.
 * Returns concatenated SQL content or null if no migrations found.
 */
export function findMigrationSql(rootDir: string): string | null {
  const migrationDirs = [
    "migrations",
    "src/migrations",
    "db/migrations",
    "prisma/migrations",
    "drizzle",
    "database/migrations",
  ];

  for (const dir of migrationDirs) {
    const fullPath = join(rootDir, dir);
    try {
      const files = readdirSync(fullPath, { recursive: true }) as string[];
      const sqlFiles = files.filter((f) => extname(String(f)) === ".sql");

      if (sqlFiles.length > 0) {
        const contents = sqlFiles
          .map((f) => readFileSync(join(fullPath, String(f)), "utf-8"))
          .join("\n\n-- Next migration --\n\n");
        return contents;
      }
    } catch {
      // Directory doesn't exist, continue
    }
  }

  return null;
}

/**
 * Infer schema from SQL migrations using an LLM provider.
 * Returns the inferred schema or null if migrations weren't found.
 */
export async function inferSchemaFromMigrations(
  rootDir: string,
  llm: LlmProvider,
): Promise<SchemaExtractionResult | null> {
  const migrationSql = findMigrationSql(rootDir);
  if (!migrationSql) return null;

  const result = await llm.inferSchemaFromMigrations(migrationSql);

  // Ensure source/confidence are correct regardless of what LLM returns
  return {
    ...result,
    source: "inferred",
    confidence: "low",
    orm: "migration_inference",
  };
}

/**
 * Default/stub LLM provider for migration inference.
 * Returns an empty schema — actual implementations should override this.
 */
export const stubLlmProvider: LlmProvider = {
  async inferSchemaFromMigrations(_migrationContent: string): Promise<SchemaExtractionResult> {
    return {
      tables: [],
      enums: [],
      source: "inferred",
      confidence: "low",
      orm: "migration_inference",
    };
  },

  async describeSchema(schema: SchemaExtractionResult): Promise<SchemaExtractionResult> {
    return schema;
  },
};
