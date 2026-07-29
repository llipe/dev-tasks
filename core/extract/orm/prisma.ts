/**
 * Prisma schema.prisma AST extractor.
 * Parses schema.prisma using a line-based parser to extract:
 * - Models (tables), fields (columns), types, nullability, attributes
 * - Relations (FK references)
 * - Enums
 * - Indexes
 *
 * Does NOT require external Prisma parser — uses a deterministic line parser.
 */

import { readFileSync } from "node:fs";
import type {
  SchemaColumn,
  SchemaEnum,
  SchemaExtractionResult,
  SchemaIndex,
  SchemaRelation,
  SchemaTable,
} from "./types.js";

/** Prisma scalar types that map to DB columns */
const PRISMA_SCALAR_TYPES = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
]);

/**
 * Parse a schema.prisma file and extract the schema structure.
 * @param schemaPath Absolute path to schema.prisma
 * @returns SchemaExtractionResult with tables, enums, source, confidence, orm
 */
export function extractPrismaSchema(schemaPath: string): SchemaExtractionResult {
  const content = readFileSync(schemaPath, "utf-8");
  return parsePrismaContent(content);
}

/**
 * Parse Prisma schema content string.
 * Exported for testing with inline content.
 */
export function parsePrismaContent(content: string): SchemaExtractionResult {
  const lines = content.split("\n");
  const enums: SchemaEnum[] = [];
  const tables: SchemaTable[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Enum block
    const enumMatch = line.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      const enumDef = parseEnumBlock(lines, i, enumMatch[1]);
      enums.push(enumDef.result);
      i = enumDef.endLine + 1;
      continue;
    }

    // Model block
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      const enumNames = new Set(enums.map((e) => e.name));
      const modelDef = parseModelBlock(lines, i, modelMatch[1], enumNames);
      tables.push(modelDef.result);
      i = modelDef.endLine + 1;
      continue;
    }

    i++;
  }

  return {
    tables,
    enums,
    source: "introspected",
    confidence: "high",
    orm: "prisma",
  };
}

// --- Enum parsing ---

function parseEnumBlock(
  lines: string[],
  startLine: number,
  name: string,
): { result: SchemaEnum; endLine: number } {
  const values: string[] = [];
  let i = startLine + 1;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "}") break;
    if (line && !line.startsWith("//") && !line.startsWith("@@")) {
      const valueMatch = line.match(/^(\w+)/);
      if (valueMatch) {
        values.push(valueMatch[1]);
      }
    }
    i++;
  }

  return { result: { name, values }, endLine: i };
}

// --- Model parsing ---

function parseModelBlock(
  lines: string[],
  startLine: number,
  name: string,
  enumNames: Set<string>,
): { result: SchemaTable; endLine: number } {
  const columns: SchemaColumn[] = [];
  const relations: SchemaRelation[] = [];
  const indexes: SchemaIndex[] = [];

  let i = startLine + 1;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "}") break;

    // Skip empty lines and comments
    if (!line || line.startsWith("//")) {
      i++;
      continue;
    }

    // Block-level attributes (@@index, @@unique, @@id)
    if (line.startsWith("@@")) {
      const idx = parseBlockAttribute(line);
      if (idx) {
        indexes.push(idx);
      }
      i++;
      continue;
    }

    // Field line
    const parsed = parseFieldLine(line, enumNames);
    if (parsed) {
      if (parsed.kind === "column") {
        columns.push(parsed.column);
      } else if (parsed.kind === "relation") {
        relations.push(parsed.relation);
      }
      // "skip" kind: back-relations (Post[], Profile?) — ignore
    }

    i++;
  }

  // Refine relation types based on unique constraints
  refineRelationTypes(columns, relations);

  return {
    result: { name, columns, relations, indexes },
    endLine: i,
  };
}

// --- Field parsing ---

type FieldParseResult =
  | { kind: "column"; column: SchemaColumn }
  | { kind: "relation"; relation: SchemaRelation }
  | { kind: "skip" };

function parseFieldLine(line: string, enumNames: Set<string>): FieldParseResult | null {
  // Pattern: fieldName Type? @attribute1 @attribute2 ...
  // Also: fieldName Type[] (list relations)
  // Also: fieldName Type @relation(fields: [...], references: [...])
  const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?)?(\[\])?\s*(.*)?$/);
  if (!fieldMatch) return null;

  const [, fieldName, baseType, nullable, isList, restOfLine] = fieldMatch;
  const attributes = restOfLine?.trim() ?? "";

  // List type (Post[]) → back-relation, skip
  if (isList) {
    return { kind: "skip" };
  }

  const isScalar = PRISMA_SCALAR_TYPES.has(baseType) || enumNames.has(baseType);
  const hasRelationAttr = attributes.includes("@relation");

  // Non-scalar without @relation → back-relation (e.g., profile Profile? on User)
  if (!isScalar && !hasRelationAttr) {
    return { kind: "skip" };
  }

  // Explicit @relation field → parse as relation
  if (hasRelationAttr) {
    const relation = parseRelationAttribute(fieldName, baseType, attributes);
    if (relation) {
      return { kind: "relation", relation };
    }
    // Could not parse @relation → skip
    return { kind: "skip" };
  }

  // Regular scalar column
  const column: SchemaColumn = {
    name: fieldName,
    type: baseType,
    nullable: nullable === "?",
    primaryKey: attributes.includes("@id"),
    unique: attributes.includes("@unique"),
    attributes: extractAttributes(attributes),
  };

  // Extract default value
  const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
  if (defaultMatch) {
    column.defaultValue = cleanDefaultValue(defaultMatch[1]);
  }

  return { kind: "column", column };
}

function parseRelationAttribute(
  fieldName: string,
  targetType: string,
  attributes: string,
): SchemaRelation | null {
  // Handle named relations: @relation("Name", fields: [...], references: [...])
  // and unnamed: @relation(fields: [...], references: [...])
  const relationMatch = attributes.match(
    /@relation\([^)]*fields:\s*\[([^\]]+)]\s*,\s*references:\s*\[([^\]]+)]/,
  );
  if (!relationMatch) return null;

  const sourceFields = relationMatch[1].split(",").map((f) => f.trim());
  const targetFields = relationMatch[2].split(",").map((f) => f.trim());

  return {
    name: fieldName,
    type: "many-to-one", // Default; refined later by refineRelationTypes
    target: targetType,
    sourceFields,
    targetFields,
  };
}

// --- Post-processing ---

/**
 * Refine relation types: if all FK columns have @unique, it's one-to-one.
 */
function refineRelationTypes(columns: SchemaColumn[], relations: SchemaRelation[]): void {
  const uniqueColumns = new Set(columns.filter((c) => c.unique).map((c) => c.name));

  for (const rel of relations) {
    if (rel.sourceFields.every((f) => uniqueColumns.has(f))) {
      rel.type = "one-to-one";
    }
  }
}

// --- Utilities ---

function parseBlockAttribute(line: string): SchemaIndex | null {
  // @@index([col1, col2])
  const indexMatch = line.match(/@@index\(\[([^\]]+)]\)/);
  if (indexMatch) {
    const columns = indexMatch[1].split(",").map((c) => c.trim());
    return { columns, unique: false };
  }

  // @@unique([col1, col2])
  const uniqueMatch = line.match(/@@unique\(\[([^\]]+)]\)/);
  if (uniqueMatch) {
    const columns = uniqueMatch[1].split(",").map((c) => c.trim());
    return { columns, unique: true };
  }

  return null;
}

function extractAttributes(attrStr: string): string[] {
  const attrs: string[] = [];
  const matches = attrStr.matchAll(/@(\w+(?:\([^)]*\))?)/g);
  for (const match of matches) {
    attrs.push(`@${match[1]}`);
  }
  return attrs;
}

function cleanDefaultValue(raw: string): string {
  // Keep function calls like autoincrement(), now() as-is
  // For enum defaults, return just the value name
  return raw;
}
