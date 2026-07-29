/**
 * LLM description pass for schema extraction.
 * Adds semantic table/column descriptions over the extracted structure.
 *
 * IMPORTANT: This pass NEVER invents columns or modifies the schema structure.
 * It only adds `description` fields to existing tables.
 */

import type { SchemaExtractionResult } from "./types.js";
import type { LlmProvider } from "../schema.js";

/**
 * Add semantic descriptions to an extracted schema using an LLM provider.
 * Returns a new result with descriptions added — does not mutate the input.
 *
 * The LLM is given the table/column structure and asked to describe
 * each table's purpose. It must NOT invent columns or alter the schema.
 */
export async function addSchemaDescriptions(
  schema: SchemaExtractionResult,
  llm: LlmProvider,
): Promise<SchemaExtractionResult> {
  return llm.describeSchema(schema);
}

/**
 * Build a prompt context for the LLM to describe tables.
 * Exported for testing the prompt structure.
 */
export function buildDescriptionPrompt(schema: SchemaExtractionResult): string {
  const lines: string[] = [];

  lines.push(
    "Given the following database schema, provide a brief semantic description for each table.",
  );
  lines.push("Do NOT invent new columns or modify the structure. Only add descriptions.");
  lines.push("");
  lines.push("Schema:");
  lines.push("");

  for (const table of schema.tables) {
    lines.push(`Table: ${table.name}`);
    lines.push(
      `  Columns: ${table.columns.map((c) => `${c.name} (${c.type}${c.nullable ? ", nullable" : ""})`).join(", ")}`,
    );
    if (table.relations.length > 0) {
      lines.push(
        `  Relations: ${table.relations.map((r) => `${r.name} → ${r.target}`).join(", ")}`,
      );
    }
    lines.push("");
  }

  lines.push("Respond with a JSON object mapping table names to descriptions:");
  lines.push('{ "table_name": "description", ... }');

  return lines.join("\n");
}

/**
 * Stub LLM provider that generates simple descriptions based on table/column names.
 * Used in tests and as a fallback when no real LLM is configured.
 */
export const stubDescriptionProvider: LlmProvider = {
  async inferSchemaFromMigrations(_content: string): Promise<SchemaExtractionResult> {
    return {
      tables: [],
      enums: [],
      source: "inferred",
      confidence: "low",
      orm: "migration_inference",
    };
  },

  async describeSchema(schema: SchemaExtractionResult): Promise<SchemaExtractionResult> {
    // Simple heuristic descriptions based on table name
    const tables = schema.tables.map((table) => ({
      ...table,
      description: table.description ?? `Stores ${table.name} data`,
    }));

    return { ...schema, tables };
  },
};
