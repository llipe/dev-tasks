/**
 * Unit tests for TypeORM entity decorator extractor.
 * Tests parsing of @Entity, @Column, @PrimaryGeneratedColumn, @ManyToOne, etc.
 */

import { describe, it, expect } from "vitest";
import { extractTypeOrmSchema } from "../../core/extract/orm/typeorm.js";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("extractTypeOrmSchema", () => {
  const entityDir = resolve(FIXTURES_DIR, "hono-typeorm/src/entities");

  it("extracts all entities as tables", () => {
    const result = extractTypeOrmSchema(entityDir);
    const tableNames = result.tables.map((t) => t.name);
    expect(tableNames).toContain("User");
    expect(tableNames).toContain("Post");
    expect(tableNames).toContain("Category");
    expect(result.tables.length).toBe(3);
  });

  it("extracts column types correctly", () => {
    const result = extractTypeOrmSchema(entityDir);
    const userTable = result.tables.find((t) => t.name === "User")!;

    const idCol = userTable.columns.find((c) => c.name === "id")!;
    expect(idCol.primaryKey).toBe(true);
    expect(idCol.nullable).toBe(false);

    const emailCol = userTable.columns.find((c) => c.name === "email")!;
    expect(emailCol.type).toBe("varchar");
    expect(emailCol.unique).toBe(true);
    expect(emailCol.nullable).toBe(false);

    const nameCol = userTable.columns.find((c) => c.name === "name")!;
    expect(nameCol.nullable).toBe(true);
  });

  it("identifies primary keys (PrimaryGeneratedColumn)", () => {
    const result = extractTypeOrmSchema(entityDir);
    const postTable = result.tables.find((t) => t.name === "Post")!;
    const pkCols = postTable.columns.filter((c) => c.primaryKey);
    expect(pkCols.length).toBe(1);
    expect(pkCols[0].name).toBe("id");
  });

  it("detects nullable columns", () => {
    const result = extractTypeOrmSchema(entityDir);
    const postTable = result.tables.find((t) => t.name === "Post")!;

    const contentCol = postTable.columns.find((c) => c.name === "content")!;
    expect(contentCol.nullable).toBe(true);

    const titleCol = postTable.columns.find((c) => c.name === "title")!;
    expect(titleCol.nullable).toBe(false);
  });

  it("extracts ManyToOne relations", () => {
    const result = extractTypeOrmSchema(entityDir);
    const postTable = result.tables.find((t) => t.name === "Post")!;

    const authorRel = postTable.relations.find((r) => r.name === "author")!;
    expect(authorRel).toBeDefined();
    expect(authorRel.type).toBe("many-to-one");
    expect(authorRel.target).toBe("User");
  });

  it("extracts ManyToMany relations", () => {
    const result = extractTypeOrmSchema(entityDir);
    const postTable = result.tables.find((t) => t.name === "Post")!;

    const catRel = postTable.relations.find((r) => r.name === "categories")!;
    expect(catRel).toBeDefined();
    expect(catRel.type).toBe("many-to-many");
    expect(catRel.target).toBe("Category");
  });

  it("extracts unique constraints", () => {
    const result = extractTypeOrmSchema(entityDir);
    const categoryTable = result.tables.find((t) => t.name === "Category")!;
    const nameCol = categoryTable.columns.find((c) => c.name === "name")!;
    expect(nameCol.unique).toBe(true);
  });

  it("marks source as introspected with high confidence", () => {
    const result = extractTypeOrmSchema(entityDir);
    expect(result.source).toBe("introspected");
    expect(result.confidence).toBe("high");
    expect(result.orm).toBe("typeorm");
  });

  it("extracts enums from enum declarations in entity files", () => {
    const result = extractTypeOrmSchema(entityDir);
    expect(result.enums.length).toBeGreaterThanOrEqual(1);
    const roleEnum = result.enums.find((e) => e.name === "UserRole")!;
    expect(roleEnum).toBeDefined();
    expect(roleEnum.values).toContain("user");
    expect(roleEnum.values).toContain("admin");
  });
});
