/**
 * Unit tests for Drizzle AST extractor.
 * Tests parsing of Drizzle table definitions via TypeScript Compiler API:
 * tables, columns, types, constraints, relations.
 */

import { describe, it, expect } from "vitest";
import { extractDrizzleSchema } from "../../core/extract/orm/drizzle.js";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("extractDrizzleSchema", () => {
  const drizzleFixture = resolve(FIXTURES_DIR, "express-drizzle/src/db/schema.ts");

  it("extracts all tables", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    const tableNames = result.tables.map((t) => t.name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("posts");
    expect(tableNames).toContain("categories");
    expect(tableNames).toContain("posts_to_categories");
    expect(result.tables.length).toBe(4);
  });

  it("extracts enums", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    expect(result.enums.length).toBe(1);
    expect(result.enums[0].name).toBe("role");
    expect(result.enums[0].values).toEqual(["user", "admin", "moderator"]);
  });

  it("extracts column types correctly", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    const usersTable = result.tables.find((t) => t.name === "users")!;

    const idCol = usersTable.columns.find((c) => c.name === "id")!;
    expect(idCol.type).toBe("serial");
    expect(idCol.primaryKey).toBe(true);
    expect(idCol.nullable).toBe(false);

    const emailCol = usersTable.columns.find((c) => c.name === "email")!;
    expect(emailCol.type).toBe("varchar");
    expect(emailCol.unique).toBe(true);
    expect(emailCol.nullable).toBe(false);

    const nameCol = usersTable.columns.find((c) => c.name === "name")!;
    expect(nameCol.type).toBe("text");
    expect(nameCol.nullable).toBe(true);
  });

  it("identifies primary keys", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    const postsTable = result.tables.find((t) => t.name === "posts")!;
    const pkCols = postsTable.columns.filter((c) => c.primaryKey);
    expect(pkCols.length).toBe(1);
    expect(pkCols[0].name).toBe("id");
  });

  it("detects nullable columns (no .notNull())", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    const postsTable = result.tables.find((t) => t.name === "posts")!;

    const contentCol = postsTable.columns.find((c) => c.name === "content")!;
    expect(contentCol.nullable).toBe(true);

    const titleCol = postsTable.columns.find((c) => c.name === "title")!;
    expect(titleCol.nullable).toBe(false);
  });

  it("extracts relations (references)", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    const postsTable = result.tables.find((t) => t.name === "posts")!;

    const authorRel = postsTable.relations.find((r) => r.name === "authorId")!;
    expect(authorRel).toBeDefined();
    expect(authorRel.target).toBe("users");
    expect(authorRel.sourceFields).toEqual(["authorId"]);
  });

  it("extracts composite FK (join table)", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    const joinTable = result.tables.find((t) => t.name === "posts_to_categories")!;

    expect(joinTable.relations.length).toBe(2);
    const postRel = joinTable.relations.find((r) => r.target === "posts")!;
    expect(postRel.sourceFields).toEqual(["postId"]);
    const catRel = joinTable.relations.find((r) => r.target === "categories")!;
    expect(catRel.sourceFields).toEqual(["categoryId"]);
  });

  it("marks source as introspected with high confidence", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    expect(result.source).toBe("introspected");
    expect(result.confidence).toBe("high");
    expect(result.orm).toBe("drizzle");
  });

  it("detects unique constraints", () => {
    const result = extractDrizzleSchema(drizzleFixture);
    const categoriesTable = result.tables.find((t) => t.name === "categories")!;
    const nameCol = categoriesTable.columns.find((c) => c.name === "name")!;
    expect(nameCol.unique).toBe(true);
  });
});
