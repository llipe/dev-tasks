/**
 * Unit tests for information_schema reader.
 * Uses the clientFactory parameter — does NOT require a real database.
 */

import { describe, it, expect, vi } from "vitest";
import {
  extractFromInformationSchema,
  type PgClient,
} from "../../core/extract/orm/information-schema.js";

function createMockClient(): PgClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockImplementation((text: string) => {
      if (text.includes("information_schema.tables")) {
        return Promise.resolve({
          rows: [{ table_name: "users" }, { table_name: "posts" }],
        });
      }
      if (text.includes("information_schema.columns")) {
        return Promise.resolve({
          rows: [
            {
              column_name: "id",
              data_type: "integer",
              is_nullable: "NO",
              column_default: "nextval('users_id_seq'::regclass)",
              is_pk: true,
              is_unique: false,
            },
            {
              column_name: "email",
              data_type: "character varying",
              is_nullable: "NO",
              column_default: null,
              is_pk: false,
              is_unique: true,
            },
            {
              column_name: "name",
              data_type: "text",
              is_nullable: "YES",
              column_default: null,
              is_pk: false,
              is_unique: false,
            },
          ],
        });
      }
      if (text.includes("FOREIGN KEY")) {
        return Promise.resolve({
          rows: [
            {
              column_name: "author_id",
              foreign_table_name: "users",
              foreign_column_name: "id",
              constraint_name: "posts_author_id_fkey",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

describe("extractFromInformationSchema", () => {
  it("extracts tables from information_schema", async () => {
    const mockClient = createMockClient();
    const factory = () => mockClient;

    const result = await extractFromInformationSchema(
      "postgresql://localhost:5432/testdb",
      factory,
    );

    expect(result.source).toBe("introspected");
    expect(result.confidence).toBe("high");
    expect(result.orm).toBe("information_schema");
    expect(result.tables.length).toBe(2);
    expect(result.tables[0].name).toBe("users");
    expect(result.tables[1].name).toBe("posts");
  });

  it("extracts columns with types and constraints", async () => {
    const mockClient = createMockClient();
    const factory = () => mockClient;

    const result = await extractFromInformationSchema(
      "postgresql://localhost:5432/testdb",
      factory,
    );
    const usersTable = result.tables[0];

    expect(usersTable.name).toBe("users");
    expect(usersTable.columns.length).toBe(3);

    const idCol = usersTable.columns.find((c) => c.name === "id")!;
    expect(idCol.primaryKey).toBe(true);
    expect(idCol.nullable).toBe(false);

    const emailCol = usersTable.columns.find((c) => c.name === "email")!;
    expect(emailCol.unique).toBe(true);
    expect(emailCol.nullable).toBe(false);

    const nameCol = usersTable.columns.find((c) => c.name === "name")!;
    expect(nameCol.nullable).toBe(true);
  });

  it("extracts foreign key relations", async () => {
    const mockClient = createMockClient();
    const factory = () => mockClient;

    const result = await extractFromInformationSchema(
      "postgresql://localhost:5432/testdb",
      factory,
    );
    // Both tables will have FK results from mock
    const postsTable = result.tables[1];
    expect(postsTable.relations.length).toBe(1);
    expect(postsTable.relations[0].target).toBe("users");
    expect(postsTable.relations[0].sourceFields).toEqual(["author_id"]);
    expect(postsTable.relations[0].targetFields).toEqual(["id"]);
  });

  it("calls connect and end on client", async () => {
    const mockClient = createMockClient();
    const factory = () => mockClient;

    await extractFromInformationSchema("postgresql://localhost:5432/testdb", factory);

    expect(mockClient.connect).toHaveBeenCalledOnce();
    expect(mockClient.end).toHaveBeenCalledOnce();
  });

  it("throws when pg is not available and no factory provided", async () => {
    await expect(
      extractFromInformationSchema("postgresql://localhost:5432/testdb"),
    ).rejects.toThrow("The 'pg' package is required");
  });
});
