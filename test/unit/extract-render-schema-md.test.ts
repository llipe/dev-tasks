/**
 * Unit tests for schema-md renderer.
 * Tests rendering of tables, columns, PK/FK, indexes, and Mermaid ER diagram.
 */

import { describe, it, expect } from "vitest";
import { renderSchemaMd } from "../../core/extract/render/schema-md.js";
import type { SchemaExtractionResult } from "../../core/extract/orm/types.js";

const sampleSchema: SchemaExtractionResult = {
  tables: [
    {
      name: "users",
      description: "Application user accounts",
      columns: [
        {
          name: "id",
          type: "serial",
          nullable: false,
          primaryKey: true,
          unique: false,
          attributes: [],
        },
        {
          name: "email",
          type: "varchar",
          nullable: false,
          primaryKey: false,
          unique: true,
          attributes: [],
        },
        {
          name: "name",
          type: "text",
          nullable: true,
          primaryKey: false,
          unique: false,
          attributes: [],
        },
        {
          name: "role",
          type: "enum(user,admin)",
          nullable: false,
          primaryKey: false,
          unique: false,
          attributes: [],
          defaultValue: "user",
        },
      ],
      relations: [],
      indexes: [{ columns: ["email"], unique: true }],
    },
    {
      name: "posts",
      description: "Blog posts authored by users",
      columns: [
        {
          name: "id",
          type: "serial",
          nullable: false,
          primaryKey: true,
          unique: false,
          attributes: [],
        },
        {
          name: "title",
          type: "varchar",
          nullable: false,
          primaryKey: false,
          unique: false,
          attributes: [],
        },
        {
          name: "content",
          type: "text",
          nullable: true,
          primaryKey: false,
          unique: false,
          attributes: [],
        },
        {
          name: "published",
          type: "boolean",
          nullable: false,
          primaryKey: false,
          unique: false,
          attributes: [],
          defaultValue: "false",
        },
        {
          name: "author_id",
          type: "integer",
          nullable: false,
          primaryKey: false,
          unique: false,
          attributes: [],
        },
      ],
      relations: [
        {
          name: "author",
          type: "many-to-one",
          target: "users",
          sourceFields: ["author_id"],
          targetFields: ["id"],
        },
      ],
      indexes: [
        { columns: ["author_id"], unique: false },
        { columns: ["title", "published"], unique: false },
      ],
    },
  ],
  enums: [{ name: "UserRole", values: ["user", "admin", "moderator"] }],
  source: "introspected",
  confidence: "high",
  orm: "prisma",
};

describe("renderSchemaMd", () => {
  it("renders a non-empty markdown string", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md.length).toBeGreaterThan(0);
  });

  it("includes table names as headers", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("## users");
    expect(md).toContain("## posts");
  });

  it("includes table descriptions", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("Application user accounts");
    expect(md).toContain("Blog posts authored by users");
  });

  it("includes column table with type and nullability", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("| id |");
    expect(md).toContain("serial");
    expect(md).toContain("varchar");
    // Nullability indicator
    expect(md).toContain("YES");
    expect(md).toContain("NO");
  });

  it("marks primary keys", () => {
    const md = renderSchemaMd(sampleSchema);
    // PK should be indicated in the rendered output
    expect(md).toContain("PK");
  });

  it("includes foreign key information", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("author_id");
    expect(md).toContain("users");
    expect(md).toContain("FK");
  });

  it("includes indexes section", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("email");
    expect(md).toContain("author_id");
  });

  it("includes Mermaid ER diagram", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("```mermaid");
    expect(md).toContain("erDiagram");
    expect(md).toContain("users");
    expect(md).toContain("posts");
  });

  it("Mermaid diagram shows relationships", () => {
    const md = renderSchemaMd(sampleSchema);
    // posts many-to-one users
    expect(md).toMatch(/posts.*\|.*users|users.*\|.*posts/);
  });

  it("includes enums section", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("UserRole");
    expect(md).toContain("user");
    expect(md).toContain("admin");
    expect(md).toContain("moderator");
  });

  it("includes provenance metadata", () => {
    const md = renderSchemaMd(sampleSchema);
    expect(md).toContain("introspected");
    expect(md).toContain("prisma");
  });
});
