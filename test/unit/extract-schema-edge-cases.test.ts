/**
 * Edge-case tests for schema extraction.
 * Tests: no ORM + no --db-url; composite keys; self-referential FK; enum types.
 */

import { describe, it, expect } from "vitest";
import { parsePrismaContent } from "../../core/extract/orm/prisma.js";
import { parseDrizzleContent } from "../../core/extract/orm/drizzle.js";
import { extractSchema } from "../../core/extract/schema.js";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("edge cases - no ORM + no --db-url", () => {
  it("returns null when no ORM detected and no --db-url", async () => {
    const result = await extractSchema({
      rootDir: resolve(FIXTURES_DIR, "fastify-no-orm"),
    });
    expect(result).toBeNull();
  });
});

describe("edge cases - composite keys", () => {
  it("handles composite primary key in Prisma", () => {
    const schema = `
model PostTag {
  postId Int
  tagId  Int
  post   Post @relation(fields: [postId], references: [id])
  tag    Tag  @relation(fields: [tagId], references: [id])

  @@id([postId, tagId])
}

model Post {
  id Int @id @default(autoincrement())
}

model Tag {
  id Int @id @default(autoincrement())
}
`;
    const result = parsePrismaContent(schema);
    const postTag = result.tables.find((t) => t.name === "PostTag")!;
    expect(postTag.relations.length).toBe(2);
    expect(postTag.relations[0].target).toBe("Post");
    expect(postTag.relations[1].target).toBe("Tag");
  });

  it("handles composite keys in Drizzle (join table)", () => {
    const schema = `
import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";

export const postsTags = pgTable("posts_tags", {
  postId: integer("post_id").notNull(),
  tagId: integer("tag_id").notNull(),
});
`;
    const result = parseDrizzleContent(schema);
    const table = result.tables.find((t) => t.name === "posts_tags")!;
    expect(table.columns.length).toBe(2);
    expect(table.columns[0].name).toBe("postId");
    expect(table.columns[1].name).toBe("tagId");
  });
});

describe("edge cases - self-referential FK", () => {
  it("handles self-referential relation in Prisma", () => {
    const schema = `
model Employee {
  id        Int        @id @default(autoincrement())
  name      String
  managerId Int?
  manager   Employee?  @relation("ManagerSubordinates", fields: [managerId], references: [id])
  reports   Employee[] @relation("ManagerSubordinates")
}
`;
    const result = parsePrismaContent(schema);
    const employee = result.tables.find((t) => t.name === "Employee")!;
    expect(employee.relations.length).toBe(1);
    expect(employee.relations[0].target).toBe("Employee");
    expect(employee.relations[0].sourceFields).toEqual(["managerId"]);
    expect(employee.relations[0].targetFields).toEqual(["id"]);
  });

  it("handles self-referential FK in Drizzle", () => {
    const schema = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  managerId: integer("manager_id").references(() => employees.id),
});
`;
    const result = parseDrizzleContent(schema);
    const table = result.tables.find((t) => t.name === "employees")!;
    expect(table.relations.length).toBe(1);
    expect(table.relations[0].target).toBe("employees");
  });
});

describe("edge cases - enum types", () => {
  it("handles multiple enums in Prisma", () => {
    const schema = `
enum Status {
  ACTIVE
  INACTIVE
  PENDING
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model Task {
  id       Int      @id @default(autoincrement())
  status   Status   @default(ACTIVE)
  priority Priority @default(MEDIUM)
}
`;
    const result = parsePrismaContent(schema);
    expect(result.enums.length).toBe(2);
    expect(result.enums[0].name).toBe("Status");
    expect(result.enums[0].values).toEqual(["ACTIVE", "INACTIVE", "PENDING"]);
    expect(result.enums[1].name).toBe("Priority");
    expect(result.enums[1].values).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

    const task = result.tables.find((t) => t.name === "Task")!;
    const statusCol = task.columns.find((c) => c.name === "status")!;
    expect(statusCol.type).toBe("Status");
  });

  it("handles enums in Drizzle", () => {
    const schema = `
import { pgTable, serial, pgEnum } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["active", "inactive", "pending"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  status: statusEnum("status").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
});
`;
    const result = parseDrizzleContent(schema);
    expect(result.enums.length).toBe(2);
    expect(result.enums[0].name).toBe("status");
    expect(result.enums[0].values).toEqual(["active", "inactive", "pending"]);
    expect(result.enums[1].name).toBe("priority");
    expect(result.enums[1].values).toEqual(["low", "medium", "high"]);
  });
});
