/**
 * TypeORM entity decorator extractor.
 * Parses entity files via TypeScript Compiler API to extract:
 * - Entities (classes with @Entity decorator)
 * - Columns (@Column, @PrimaryGeneratedColumn, @CreateDateColumn, etc.)
 * - Relations (@ManyToOne, @OneToMany, @ManyToMany, @OneToOne)
 * - Enums (exported enum declarations)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import ts from "typescript";
import type {
  SchemaColumn,
  SchemaEnum,
  SchemaExtractionResult,
  SchemaRelation,
  SchemaTable,
} from "./types.js";

/**
 * Extract schema from a directory of TypeORM entity files.
 * @param entityDir Absolute path to the entities directory
 */
export function extractTypeOrmSchema(entityDir: string): SchemaExtractionResult {
  const files = readdirSync(entityDir).filter((f) => extname(f) === ".ts" && !f.endsWith(".d.ts"));

  const tables: SchemaTable[] = [];
  const enums: SchemaEnum[] = [];

  for (const file of files) {
    const filePath = join(entityDir, file);
    const content = readFileSync(filePath, "utf-8");
    const result = parseTypeOrmFile(content);
    tables.push(...result.tables);
    enums.push(...result.enums);
  }

  return {
    tables,
    enums,
    source: "introspected",
    confidence: "high",
    orm: "typeorm",
  };
}

/**
 * Parse a single TypeORM entity file.
 */
export function parseTypeOrmFile(content: string): {
  tables: SchemaTable[];
  enums: SchemaEnum[];
} {
  const sourceFile = ts.createSourceFile("entity.ts", content, ts.ScriptTarget.Latest, true);

  const tables: SchemaTable[] = [];
  const enums: SchemaEnum[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // Class with @Entity decorator
    if (ts.isClassDeclaration(node) && hasDecorator(node, "Entity")) {
      const table = parseEntityClass(node);
      if (table) tables.push(table);
    }

    // Enum declarations
    if (ts.isEnumDeclaration(node)) {
      const enumDef = parseEnumDeclaration(node);
      if (enumDef) enums.push(enumDef);
    }
  });

  return { tables, enums };
}

// --- Entity parsing ---

function parseEntityClass(node: ts.ClassDeclaration): SchemaTable | null {
  const name = node.name?.text;
  if (!name) return null;

  const columns: SchemaColumn[] = [];
  const relations: SchemaRelation[] = [];

  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member)) {
      const fieldName = member.name && ts.isIdentifier(member.name) ? member.name.text : null;
      if (!fieldName) continue;

      // Check for column decorators
      if (hasDecorator(member, "PrimaryGeneratedColumn")) {
        columns.push({
          name: fieldName,
          type: getColumnType(member, "PrimaryGeneratedColumn"),
          nullable: false,
          primaryKey: true,
          unique: false,
          attributes: ["@PrimaryGeneratedColumn"],
        });
      } else if (hasDecorator(member, "Column")) {
        const col = parseColumnDecorator(member, fieldName);
        if (col) columns.push(col);
      } else if (hasDecorator(member, "CreateDateColumn")) {
        columns.push({
          name: fieldName,
          type: "timestamp",
          nullable: false,
          primaryKey: false,
          unique: false,
          attributes: ["@CreateDateColumn"],
          defaultValue: "now()",
        });
      } else if (hasDecorator(member, "UpdateDateColumn")) {
        columns.push({
          name: fieldName,
          type: "timestamp",
          nullable: false,
          primaryKey: false,
          unique: false,
          attributes: ["@UpdateDateColumn"],
          defaultValue: "now()",
        });
      }

      // Check for relation decorators
      const relation = parseRelationDecorator(member, fieldName);
      if (relation) relations.push(relation);
    }
  }

  return { name, columns, relations, indexes: [] };
}

// --- Column parsing ---

function parseColumnDecorator(
  member: ts.PropertyDeclaration,
  fieldName: string,
): SchemaColumn | null {
  const decorator = getDecorator(member, "Column");
  if (!decorator) return null;

  let type = "varchar";
  let nullable = false;
  let unique = false;
  let defaultValue: string | undefined;

  // Parse decorator arguments: @Column({ type: "varchar", nullable: true, unique: true })
  const args = getDecoratorArguments(decorator);
  if (args.length > 0) {
    const firstArg = args[0];
    if (ts.isObjectLiteralExpression(firstArg)) {
      for (const prop of firstArg.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
        const propName = prop.name.text;

        if (propName === "type") {
          const val = getStringLiteral(prop.initializer);
          if (val) type = val;
        } else if (propName === "nullable") {
          nullable = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
        } else if (propName === "unique") {
          unique = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
        } else if (propName === "default") {
          defaultValue = prop.initializer.getText();
        }
      }
    } else if (ts.isStringLiteral(firstArg)) {
      // @Column("varchar") shorthand
      type = firstArg.text;
    }
  }

  return {
    name: fieldName,
    type,
    nullable,
    primaryKey: false,
    unique,
    attributes: ["@Column"],
    defaultValue,
  };
}

function getColumnType(member: ts.PropertyDeclaration, decoratorName: string): string {
  const decorator = getDecorator(member, decoratorName);
  if (!decorator) return "integer";

  const args = getDecoratorArguments(decorator);
  if (args.length > 0 && ts.isStringLiteral(args[0])) {
    return args[0].text; // e.g., "uuid"
  }
  return "integer"; // Default for PrimaryGeneratedColumn
}

// --- Relation parsing ---

const RELATION_DECORATORS: Record<string, SchemaRelation["type"]> = {
  ManyToOne: "many-to-one",
  OneToMany: "one-to-many",
  ManyToMany: "many-to-many",
  OneToOne: "one-to-one",
};

function parseRelationDecorator(
  member: ts.PropertyDeclaration,
  fieldName: string,
): SchemaRelation | null {
  for (const [decoratorName, relationType] of Object.entries(RELATION_DECORATORS)) {
    const decorator = getDecorator(member, decoratorName);
    if (!decorator) continue;

    // Skip OneToMany — it's the back-side of a relation, doesn't create a FK
    if (decoratorName === "OneToMany") return null;

    const args = getDecoratorArguments(decorator);
    const target = extractRelationTarget(args);

    if (target) {
      return {
        name: fieldName,
        type: relationType,
        target,
        sourceFields: [],
        targetFields: [],
      };
    }
  }
  return null;
}

function extractRelationTarget(args: readonly ts.Expression[]): string | null {
  // First arg is typically () => TargetEntity
  if (args.length === 0) return null;
  const firstArg = args[0];

  if (ts.isArrowFunction(firstArg)) {
    const body = firstArg.body;
    if (ts.isIdentifier(body)) {
      return body.text;
    }
  }
  return null;
}

// --- Enum parsing ---

function parseEnumDeclaration(node: ts.EnumDeclaration): SchemaEnum | null {
  const name = node.name.text;
  const values: string[] = [];

  for (const member of node.members) {
    if (member.initializer && ts.isStringLiteral(member.initializer)) {
      values.push(member.initializer.text);
    } else if (ts.isIdentifier(member.name)) {
      values.push(member.name.text);
    }
  }

  return { name, values };
}

// --- Decorator utilities ---

function hasDecorator(node: ts.ClassDeclaration | ts.PropertyDeclaration, name: string): boolean {
  return getDecorator(node, name) !== null;
}

function getDecorator(
  node: ts.ClassDeclaration | ts.PropertyDeclaration,
  name: string,
): ts.Decorator | null {
  const modifiers = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
  if (!modifiers) return null;

  for (const mod of modifiers) {
    if (ts.isDecorator(mod)) {
      const expr = mod.expression;
      // @Entity or @Entity()
      if (ts.isIdentifier(expr) && expr.text === name) {
        return mod;
      }
      if (
        ts.isCallExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === name
      ) {
        return mod;
      }
    }
  }
  return null;
}

function getDecoratorArguments(decorator: ts.Decorator): readonly ts.Expression[] {
  const expr = decorator.expression;
  if (ts.isCallExpression(expr)) {
    return expr.arguments;
  }
  return [];
}

// --- Utilities ---

function getStringLiteral(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}
