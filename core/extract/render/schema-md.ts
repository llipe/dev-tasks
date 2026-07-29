/**
 * schema.md renderer.
 * Renders extracted schema as a Markdown document with:
 * - Table listings with columns (type + nullability + constraints)
 * - PK/FK indicators
 * - Indexes
 * - Mermaid ER diagram
 * - Enums
 * - Provenance metadata
 */

import type { SchemaExtractionResult, SchemaTable, SchemaRelation } from "../orm/types.js";

/**
 * Render a schema extraction result as a Markdown document.
 */
export function renderSchemaMd(schema: SchemaExtractionResult): string {
  const lines: string[] = [];

  lines.push("# Database Schema");
  lines.push("");
  lines.push(
    `> Source: \`${schema.source}\` | ORM: \`${schema.orm}\` | Confidence: \`${schema.confidence}\``,
  );
  lines.push("");

  // Mermaid ER diagram
  lines.push("## Entity Relationship Diagram");
  lines.push("");
  lines.push(renderMermaidDiagram(schema));
  lines.push("");

  // Tables
  for (const table of schema.tables) {
    lines.push(renderTable(table));
    lines.push("");
  }

  // Enums
  if (schema.enums.length > 0) {
    lines.push("## Enums");
    lines.push("");
    for (const enumDef of schema.enums) {
      lines.push(`### ${enumDef.name}`);
      lines.push("");
      lines.push(`Values: \`${enumDef.values.join("`, `")}\``);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// --- Table rendering ---

function renderTable(table: SchemaTable): string {
  const lines: string[] = [];

  lines.push(`## ${table.name}`);
  lines.push("");

  if (table.description) {
    lines.push(table.description);
    lines.push("");
  }

  // Columns table
  lines.push("| Column | Type | Nullable | Key | Default |");
  lines.push("|--------|------|----------|-----|---------|");

  for (const col of table.columns) {
    const key = getKeyIndicator(col.name, col.primaryKey, col.unique, table.relations);
    const nullable = col.nullable ? "YES" : "NO";
    const defaultVal = col.defaultValue ?? "";
    lines.push(`| ${col.name} | ${col.type} | ${nullable} | ${key} | ${defaultVal} |`);
  }

  lines.push("");

  // Relations
  if (table.relations.length > 0) {
    lines.push("**Relations:**");
    lines.push("");
    for (const rel of table.relations) {
      const fields =
        rel.sourceFields.length > 0
          ? ` (${rel.sourceFields.join(", ")} → ${rel.target}.${rel.targetFields.join(", ")})`
          : ` → ${rel.target}`;
      lines.push(`- \`${rel.name}\`: ${rel.type}${fields}`);
    }
    lines.push("");
  }

  // Indexes
  if (table.indexes.length > 0) {
    lines.push("**Indexes:**");
    lines.push("");
    for (const idx of table.indexes) {
      const uniqueLabel = idx.unique ? " (unique)" : "";
      const name = idx.name ? `\`${idx.name}\`` : "";
      lines.push(`- ${name} [${idx.columns.join(", ")}]${uniqueLabel}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function getKeyIndicator(
  colName: string,
  isPk: boolean,
  isUnique: boolean,
  relations: SchemaRelation[],
): string {
  const parts: string[] = [];
  if (isPk) parts.push("PK");

  // Check if this column is a FK source
  const isFk = relations.some((r) => r.sourceFields.includes(colName));
  if (isFk) parts.push("FK");

  if (isUnique && !isPk) parts.push("UQ");

  return parts.join(", ");
}

// --- Mermaid diagram ---

function renderMermaidDiagram(schema: SchemaExtractionResult): string {
  const lines: string[] = [];

  lines.push("```mermaid");
  lines.push("erDiagram");

  // Render tables with their columns
  for (const table of schema.tables) {
    lines.push(`    ${sanitizeMermaidName(table.name)} {`);
    for (const col of table.columns) {
      const pk = col.primaryKey ? " PK" : "";
      const fk = table.relations.some((r) => r.sourceFields.includes(col.name)) ? " FK" : "";
      lines.push(`        ${col.type} ${col.name}${pk}${fk}`);
    }
    lines.push("    }");
  }

  // Render relationships
  for (const table of schema.tables) {
    for (const rel of table.relations) {
      const mermaidRel = getMermaidRelation(rel.type);
      lines.push(
        `    ${sanitizeMermaidName(table.name)} ${mermaidRel} ${sanitizeMermaidName(rel.target)} : "${rel.name}"`,
      );
    }
  }

  lines.push("```");

  return lines.join("\n");
}

function getMermaidRelation(type: SchemaRelation["type"]): string {
  switch (type) {
    case "one-to-one":
      return "||--||";
    case "one-to-many":
      return "||--o{";
    case "many-to-one":
      return "}o--||";
    case "many-to-many":
      return "}o--o{";
  }
}

function sanitizeMermaidName(name: string): string {
  // Mermaid doesn't like special characters in entity names
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
