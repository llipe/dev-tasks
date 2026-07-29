/**
 * Shared types for ORM schema extraction results.
 * All extractors (Prisma, Drizzle, TypeORM) produce this uniform structure.
 */

/**
 * A column/field in a database table.
 */
export interface SchemaColumn {
  /** Column name */
  name: string;
  /** Column type (e.g., "Int", "String", "varchar(255)") */
  type: string;
  /** Whether the column is nullable */
  nullable: boolean;
  /** Whether the column is a primary key */
  primaryKey: boolean;
  /** Whether the column has a unique constraint */
  unique: boolean;
  /** Default value expression (if any) */
  defaultValue?: string;
  /** Additional attributes/decorators */
  attributes: string[];
}

/**
 * A foreign key relationship.
 */
export interface SchemaRelation {
  /** Name of the relation field */
  name: string;
  /** Type of relation (one-to-one, one-to-many, many-to-one, many-to-many) */
  type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
  /** Target table name */
  target: string;
  /** Fields in the source table (FK columns) */
  sourceFields: string[];
  /** Fields in the target table (referenced columns) */
  targetFields: string[];
}

/**
 * An index on a table.
 */
export interface SchemaIndex {
  /** Index name (if available) */
  name?: string;
  /** Columns included in the index */
  columns: string[];
  /** Whether this is a unique index */
  unique: boolean;
}

/**
 * An enum type definition.
 */
export interface SchemaEnum {
  /** Enum name */
  name: string;
  /** Enum values */
  values: string[];
}

/**
 * A database table extracted from ORM definitions.
 */
export interface SchemaTable {
  /** Table name */
  name: string;
  /** Columns/fields */
  columns: SchemaColumn[];
  /** Relations (foreign keys) */
  relations: SchemaRelation[];
  /** Indexes */
  indexes: SchemaIndex[];
  /** Optional description (added by LLM pass) */
  description?: string;
}

/**
 * Provenance source for the extraction.
 */
export type SchemaSource = "introspected" | "inferred";

/**
 * Confidence level for the extraction.
 */
export type SchemaConfidence = "high" | "medium" | "low";

/**
 * Full schema extraction result.
 */
export interface SchemaExtractionResult {
  /** Extracted tables */
  tables: SchemaTable[];
  /** Extracted enums */
  enums: SchemaEnum[];
  /** How the schema was obtained */
  source: SchemaSource;
  /** Confidence in the extraction accuracy */
  confidence: SchemaConfidence;
  /** ORM that produced the schema (or "information_schema" or "migration_inference") */
  orm: string;
}
