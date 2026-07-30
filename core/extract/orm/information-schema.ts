/**
 * information_schema reader.
 * Connects to a PostgreSQL database via --db-url and queries
 * tables/columns/constraints from information_schema.
 *
 * This is optional and only activated when --db-url is provided.
 * Uses the `pg` client (optional peer dependency).
 */

import type { SchemaColumn, SchemaExtractionResult, SchemaRelation, SchemaTable } from "./types.js";

// --- pg client interface (to avoid requiring @types/pg) ---

export interface PgClient {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

/** Factory that creates a PgClient given a connection string */
export type PgClientFactory = (connectionString: string) => PgClient;

/**
 * Extract schema from a PostgreSQL database via information_schema.
 * @param dbUrl PostgreSQL connection string
 * @param clientFactory Optional factory for creating the PgClient (for testing).
 *   If not provided, dynamically imports the `pg` package.
 */
export async function extractFromInformationSchema(
  dbUrl: string,
  clientFactory?: PgClientFactory,
): Promise<SchemaExtractionResult> {
  let client: PgClient;

  if (clientFactory) {
    client = clientFactory(dbUrl);
  } else {
    // Dynamic import of pg to keep it optional
    let Client: new (config: { connectionString: string }) => PgClient;
    try {
      const pg = await (Function('return import("pg")')() as Promise<Record<string, unknown>>);
      Client =
        ((pg.default as Record<string, unknown>)?.Client as typeof Client) ??
        (pg.Client as typeof Client);
    } catch {
      throw new Error(
        "The 'pg' package is required for --db-url support. Install it with: pnpm add pg",
      );
    }
    client = new Client({ connectionString: dbUrl });
  }

  try {
    await client.connect();

    const tables = await queryTables(client);
    const result: SchemaExtractionResult = {
      tables,
      enums: [], // Could query pg_enum but keeping it simple
      source: "introspected",
      confidence: "high",
      orm: "information_schema",
    };

    return result;
  } finally {
    await client.end();
  }
}

// --- Query helpers ---

async function queryTables(client: PgClient): Promise<SchemaTable[]> {
  // Get all user tables
  const tablesResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tables: SchemaTable[] = [];

  for (const row of tablesResult.rows) {
    const tableName = row.table_name as string;
    const columns = await queryColumns(client, tableName);
    const relations = await queryForeignKeys(client, tableName);

    tables.push({
      name: tableName,
      columns,
      relations,
      indexes: [],
    });
  }

  return tables;
}

async function queryColumns(client: PgClient, tableName: string): Promise<SchemaColumn[]> {
  const result = await client.query(
    `
    SELECT
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_pk,
      CASE WHEN tc.constraint_type = 'UNIQUE' THEN true ELSE false END as is_unique
    FROM information_schema.columns c
    LEFT JOIN information_schema.key_column_usage kcu
      ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
    LEFT JOIN information_schema.table_constraints tc
      ON kcu.constraint_name = tc.constraint_name AND tc.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.table_name = $1
    ORDER BY c.ordinal_position
  `,
    [tableName],
  );

  const columns: SchemaColumn[] = [];
  const seen = new Set<string>();

  for (const row of result.rows) {
    const colName = row.column_name as string;
    if (seen.has(colName)) continue; // Deduplicate due to multiple constraints
    seen.add(colName);

    columns.push({
      name: colName,
      type: row.data_type as string,
      nullable: (row.is_nullable as string) === "YES",
      primaryKey: row.is_pk === true,
      unique: row.is_unique === true,
      attributes: [],
      defaultValue: (row.column_default as string) ?? undefined,
    });
  }

  return columns;
}

async function queryForeignKeys(client: PgClient, tableName: string): Promise<SchemaRelation[]> {
  const result = await client.query(
    `
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
  `,
    [tableName],
  );

  const relations: SchemaRelation[] = [];
  const seen = new Set<string>();

  for (const row of result.rows) {
    const constraintName = row.constraint_name as string;
    if (seen.has(constraintName)) continue;
    seen.add(constraintName);

    relations.push({
      name: constraintName,
      type: "many-to-one",
      target: row.foreign_table_name as string,
      sourceFields: [row.column_name as string],
      targetFields: [row.foreign_column_name as string],
    });
  }

  return relations;
}
