/**
 * Unit tests for Prisma AST extractor.
 * Tests schema.prisma parsing: models, fields, types, nullability, attributes, relations, enums.
 */

import { describe, it, expect } from "vitest";
import { extractPrismaSchema } from "../../core/extract/orm/prisma.js";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("extractPrismaSchema", () => {
  const prismaFixture = resolve(FIXTURES_DIR, "nestjs-prisma-kafkajs/prisma/schema.prisma");

  it("extracts all models as tables", () => {
    const result = extractPrismaSchema(prismaFixture);
    const tableNames = result.tables.map((t) => t.name);
    expect(tableNames).toContain("User");
    expect(tableNames).toContain("Profile");
    expect(tableNames).toContain("Post");
    expect(tableNames).toContain("Category");
    expect(result.tables.length).toBe(4);
  });

  it("extracts enums", () => {
    const result = extractPrismaSchema(prismaFixture);
    expect(result.enums.length).toBe(1);
    expect(result.enums[0].name).toBe("Role");
    expect(result.enums[0].values).toEqual(["USER", "ADMIN", "MODERATOR"]);
  });

  it("extracts column types correctly", () => {
    const result = extractPrismaSchema(prismaFixture);
    const userTable = result.tables.find((t) => t.name === "User")!;

    const idCol = userTable.columns.find((c) => c.name === "id")!;
    expect(idCol.type).toBe("Int");
    expect(idCol.primaryKey).toBe(true);
    expect(idCol.nullable).toBe(false);

    const emailCol = userTable.columns.find((c) => c.name === "email")!;
    expect(emailCol.type).toBe("String");
    expect(emailCol.unique).toBe(true);
    expect(emailCol.nullable).toBe(false);

    const nameCol = userTable.columns.find((c) => c.name === "name")!;
    expect(nameCol.type).toBe("String");
    expect(nameCol.nullable).toBe(true);
  });

  it("identifies primary keys", () => {
    const result = extractPrismaSchema(prismaFixture);
    const postTable = result.tables.find((t) => t.name === "Post")!;
    const pkCols = postTable.columns.filter((c) => c.primaryKey);
    expect(pkCols.length).toBe(1);
    expect(pkCols[0].name).toBe("id");
  });

  it("identifies unique constraints", () => {
    const result = extractPrismaSchema(prismaFixture);
    const categoryTable = result.tables.find((t) => t.name === "Category")!;
    const nameCol = categoryTable.columns.find((c) => c.name === "name")!;
    expect(nameCol.unique).toBe(true);
  });

  it("detects nullable fields (marked with ?)", () => {
    const result = extractPrismaSchema(prismaFixture);
    const postTable = result.tables.find((t) => t.name === "Post")!;
    const contentCol = postTable.columns.find((c) => c.name === "content")!;
    expect(contentCol.nullable).toBe(true);

    const titleCol = postTable.columns.find((c) => c.name === "title")!;
    expect(titleCol.nullable).toBe(false);
  });

  it("extracts default values", () => {
    const result = extractPrismaSchema(prismaFixture);
    const postTable = result.tables.find((t) => t.name === "Post")!;
    const publishedCol = postTable.columns.find((c) => c.name === "published")!;
    expect(publishedCol.defaultValue).toBe("false");

    const userTable = result.tables.find((t) => t.name === "User")!;
    const roleCol = userTable.columns.find((c) => c.name === "role")!;
    expect(roleCol.defaultValue).toBe("USER");
  });

  it("extracts relations", () => {
    const result = extractPrismaSchema(prismaFixture);
    const postTable = result.tables.find((t) => t.name === "Post")!;

    const authorRelation = postTable.relations.find((r) => r.name === "author")!;
    expect(authorRelation.type).toBe("many-to-one");
    expect(authorRelation.target).toBe("User");
    expect(authorRelation.sourceFields).toEqual(["authorId"]);
    expect(authorRelation.targetFields).toEqual(["id"]);
  });

  it("extracts one-to-one relations", () => {
    const result = extractPrismaSchema(prismaFixture);
    const profileTable = result.tables.find((t) => t.name === "Profile")!;

    const userRelation = profileTable.relations.find((r) => r.name === "user")!;
    expect(userRelation.type).toBe("one-to-one");
    expect(userRelation.target).toBe("User");
    expect(userRelation.sourceFields).toEqual(["userId"]);
    expect(userRelation.targetFields).toEqual(["id"]);
  });

  it("extracts indexes", () => {
    const result = extractPrismaSchema(prismaFixture);
    const postTable = result.tables.find((t) => t.name === "Post")!;

    expect(postTable.indexes.length).toBeGreaterThanOrEqual(2);
    const authorIdx = postTable.indexes.find((i) => i.columns.includes("authorId"))!;
    expect(authorIdx).toBeDefined();
    expect(authorIdx.unique).toBe(false);

    const compositeIdx = postTable.indexes.find(
      (i) => i.columns.includes("title") && i.columns.includes("published"),
    )!;
    expect(compositeIdx).toBeDefined();
    expect(compositeIdx.columns).toEqual(["title", "published"]);
  });

  it("marks source as introspected with high confidence", () => {
    const result = extractPrismaSchema(prismaFixture);
    expect(result.source).toBe("introspected");
    expect(result.confidence).toBe("high");
    expect(result.orm).toBe("prisma");
  });

  it("handles enum-type fields", () => {
    const result = extractPrismaSchema(prismaFixture);
    const userTable = result.tables.find((t) => t.name === "User")!;
    const roleCol = userTable.columns.find((c) => c.name === "role")!;
    expect(roleCol.type).toBe("Role");
  });

  it("excludes relation fields from columns (list type like Post[])", () => {
    const result = extractPrismaSchema(prismaFixture);
    const userTable = result.tables.find((t) => t.name === "User")!;
    // posts, profile are relation fields — should not appear as columns
    const postsCol = userTable.columns.find((c) => c.name === "posts");
    expect(postsCol).toBeUndefined();
  });
});
