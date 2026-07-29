/**
 * Drizzle ORM schema extractor.
 * Parses Drizzle table definitions via TypeScript Compiler API to extract:
 * - Tables (pgTable/mysqlTable/sqliteTable calls)
 * - Columns (types, nullability, constraints)
 * - Relations (references)
 * - Enums (pgEnum)
 * - Indexes
 */

import { readFileSync } from "node:fs";
import ts from "typescript";
import type {
  SchemaColumn,
  SchemaEnum,
  SchemaExtractionResult,
  SchemaIndex,
  SchemaRelation,
  SchemaTable,
} from "./types.js";

/**
 * Extract schema from a Drizzle schema file.
 * @param schemaPath Absolute path to the Drizzle schema file (e.g., src/db/schema.ts)
 */
export function extractDrizzleSchema(schemaPath: string): SchemaExtractionResult {
  const content = readFileSync(schemaPath, "utf-8");
  return parseDrizzleContent(content);
}

/**
 * Parse Drizzle schema content string via TypeScript AST.
 */
export function parseDrizzleContent(content: string): SchemaExtractionResult {
  const sourceFile = ts.createSourceFile("schema.ts", content, ts.ScriptTarget.Latest, true);

  const tables: SchemaTable[] = [];
  const enums: SchemaEnum[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // Look for: export const X = pgTable("name", { ... })
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isCallExpression(decl.initializer)) {
          const call = decl.initializer;
          const fnName = getCallExpressionName(call);

          // Table definition
          if (fnName && isTableFn(fnName)) {
            const table = parseTableCall(call);
            if (table) tables.push(table);
          }

          // Enum definition
          if (fnName && isEnumFn(fnName)) {
            const enumDef = parseEnumCall(call);
            if (enumDef) enums.push(enumDef);
          }
        }
      }
    }
  });

  return {
    tables,
    enums,
    source: "introspected",
    confidence: "high",
    orm: "drizzle",
  };
}

// --- Helpers ---

function getCallExpressionName(call: ts.CallExpression): string | null {
  if (ts.isIdentifier(call.expression)) {
    return call.expression.text;
  }
  return null;
}

function isTableFn(name: string): boolean {
  return ["pgTable", "mysqlTable", "sqliteTable"].includes(name);
}

function isEnumFn(name: string): boolean {
  return ["pgEnum", "mysqlEnum"].includes(name);
}

// --- Enum parsing ---

function parseEnumCall(call: ts.CallExpression): SchemaEnum | null {
  // pgEnum("role", ["user", "admin", "moderator"])
  if (call.arguments.length < 2) return null;

  const nameArg = call.arguments[0];
  const valuesArg = call.arguments[1];

  const name = getStringLiteral(nameArg);
  if (!name) return null;

  const values: string[] = [];
  if (ts.isArrayLiteralExpression(valuesArg)) {
    for (const elem of valuesArg.elements) {
      const val = getStringLiteral(elem);
      if (val) values.push(val);
    }
  }

  return { name, values };
}

// --- Table parsing ---

function parseTableCall(call: ts.CallExpression): SchemaTable | null {
  // pgTable("table_name", { columns... }, (table) => ({ indexes... }))
  if (call.arguments.length < 2) return null;

  const nameArg = call.arguments[0];
  const columnsArg = call.arguments[1];
  const indexArg = call.arguments[2]; // optional

  const tableName = getStringLiteral(nameArg);
  if (!tableName) return null;

  const columns: SchemaColumn[] = [];
  const relations: SchemaRelation[] = [];
  const indexes: SchemaIndex[] = [];

  // Parse column definitions
  if (ts.isObjectLiteralExpression(columnsArg)) {
    for (const prop of columnsArg.properties) {
      if (ts.isPropertyAssignment(prop) && prop.name && ts.isIdentifier(prop.name)) {
        const fieldName = prop.name.text;
        const colDef = parseColumnDefinition(fieldName, prop.initializer, tableName, relations);
        if (colDef) columns.push(colDef);
      }
    }
  }

  // Parse index definitions (third argument, if present)
  if (indexArg && ts.isArrowFunction(indexArg)) {
    parseIndexDefinitions(indexArg, indexes);
  }

  return { name: tableName, columns, relations, indexes };
}

function parseColumnDefinition(
  fieldName: string,
  expr: ts.Expression,
  tableName: string,
  relations: SchemaRelation[],
): SchemaColumn | null {
  // Column definitions are chained method calls:
  // serial("id").primaryKey()
  // varchar("email", { length: 255 }).notNull().unique()
  // integer("author_id").notNull().references(() => users.id)

  const chain = flattenMethodChain(expr);
  if (chain.length === 0) return null;

  // First call is the type function
  const typeCall = chain[0];
  const colType = typeCall.name;

  // Determine nullability (default: nullable unless .notNull() is in chain)
  const hasNotNull = chain.some((c) => c.name === "notNull");
  const hasPrimaryKey = chain.some((c) => c.name === "primaryKey");
  const hasUnique = chain.some((c) => c.name === "unique");

  // Check for references (FK)
  const refCall = chain.find((c) => c.name === "references");
  if (refCall) {
    const targetTable = extractReferenceTarget(refCall.node);
    if (targetTable) {
      relations.push({
        name: fieldName,
        type: "many-to-one",
        target: targetTable,
        sourceFields: [fieldName],
        targetFields: ["id"], // Convention: references target's .id
      });
    }
  }

  // Check for default
  const defaultCall = chain.find((c) => c.name === "default" || c.name === "defaultNow");
  let defaultValue: string | undefined;
  if (defaultCall) {
    if (defaultCall.name === "defaultNow") {
      defaultValue = "now()";
    } else if (defaultCall.node && ts.isCallExpression(defaultCall.node)) {
      const firstArg = defaultCall.node.arguments[0];
      if (firstArg) {
        defaultValue = firstArg.getText();
      }
    }
  }

  // Primary keys are implicitly not null
  const nullable = hasPrimaryKey ? false : !hasNotNull;

  return {
    name: fieldName,
    type: colType,
    nullable,
    primaryKey: hasPrimaryKey,
    unique: hasUnique,
    attributes: [],
    defaultValue,
  };
}

interface ChainLink {
  name: string;
  node?: ts.CallExpression;
}

function flattenMethodChain(expr: ts.Expression): ChainLink[] {
  const chain: ChainLink[] = [];

  let current: ts.Expression = expr;
  while (true) {
    if (ts.isCallExpression(current)) {
      const callExpr = current;
      if (ts.isPropertyAccessExpression(callExpr.expression)) {
        const methodName = callExpr.expression.name.text;
        chain.unshift({ name: methodName, node: callExpr });
        current = callExpr.expression.expression;
      } else if (ts.isIdentifier(callExpr.expression)) {
        // This is the base type call (e.g., serial("id"))
        chain.unshift({ name: callExpr.expression.text, node: callExpr });
        break;
      } else {
        break;
      }
    } else if (ts.isPropertyAccessExpression(current)) {
      // Property access without call (shouldn't happen in valid Drizzle schema)
      chain.unshift({ name: current.name.text });
      current = current.expression;
    } else {
      break;
    }
  }

  return chain;
}

function extractReferenceTarget(node?: ts.CallExpression): string | null {
  // .references(() => users.id)
  if (!node || node.arguments.length === 0) return null;

  const arg = node.arguments[0];
  if (ts.isArrowFunction(arg)) {
    const body = arg.body;
    if (ts.isPropertyAccessExpression(body)) {
      // body is `users.id` — we want "users"
      if (ts.isIdentifier(body.expression)) {
        return body.expression.text;
      }
    }
  }
  return null;
}

// --- Index parsing ---

function parseIndexDefinitions(arrowFn: ts.ArrowFunction, indexes: SchemaIndex[]): void {
  // (table) => ({ emailIdx: uniqueIndex("name").on(table.email) })
  const body = arrowFn.body;
  if (!ts.isParenthesizedExpression(body) && !ts.isObjectLiteralExpression(body)) {
    // Could be: (table) => ({ ... })
    if (ts.isParenthesizedExpression(body) && ts.isObjectLiteralExpression(body.expression)) {
      parseIndexObject(body.expression, indexes);
    }
    return;
  }

  if (ts.isObjectLiteralExpression(body)) {
    parseIndexObject(body, indexes);
  } else if (ts.isParenthesizedExpression(body) && ts.isObjectLiteralExpression(body.expression)) {
    parseIndexObject(body.expression, indexes);
  }
}

function parseIndexObject(obj: ts.ObjectLiteralExpression, indexes: SchemaIndex[]): void {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const idx = parseIndexExpression(prop.initializer);
      if (idx) indexes.push(idx);
    }
  }
}

function parseIndexExpression(expr: ts.Expression): SchemaIndex | null {
  // index("name").on(table.col) or uniqueIndex("name").on(table.col)
  const chain = flattenMethodChain(expr);
  const baseCall = chain[0];
  if (!baseCall) return null;

  const isUnique = baseCall.name === "uniqueIndex";
  const onCall = chain.find((c) => c.name === "on");

  const columns: string[] = [];
  if (onCall?.node) {
    for (const arg of onCall.node.arguments) {
      if (ts.isPropertyAccessExpression(arg)) {
        columns.push(arg.name.text);
      }
    }
  }

  if (columns.length === 0) return null;

  // Get index name from base call
  let name: string | undefined;
  if (baseCall.node && baseCall.node.arguments.length > 0) {
    name = getStringLiteral(baseCall.node.arguments[0]) ?? undefined;
  }

  return { name, columns, unique: isUnique };
}

// --- Utilities ---

function getStringLiteral(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}
