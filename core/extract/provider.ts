/**
 * Pluggable extraction provider interface and supporting types.
 * Spec §4.8 — providers declare capabilities and implement detection + extraction.
 */

/**
 * Capabilities a provider can declare.
 * Each maps to a specific extraction strategy.
 */
export type Capability =
  | "openapi_native" // Route 1: copy on-disk OpenAPI spec
  | "openapi_ast" // Route 3: AST-based route discovery
  | "db_introspection" // Direct DB schema introspection
  | "orm_ast" // ORM AST extraction (prisma/drizzle/typeorm)
  | "topic_ast" // Kafka topic AST extraction
  | "payload_typed"; // Typed message payload extraction

/**
 * OpenAPI strategy identifiers per the detection matrix.
 */
export type OpenApiStrategy = "route1" | "route2" | "route3";

/**
 * Evidence entry for a detection signal.
 */
export interface DetectionEvidence {
  /** What was detected (e.g. dependency name, file path, config key) */
  signal: string;
  /** Where it was found */
  location: string;
  /** Optional additional context */
  detail?: string;
}

/**
 * HTTP framework detection result.
 */
export interface HttpDetection {
  /** Detected framework (nestjs, express, fastify, hono) */
  framework: string;
  /** Which OpenAPI strategy applies based on detection signals */
  openapi_strategy: OpenApiStrategy;
  /** Per-strategy evidence count */
  strategy_counts: Record<OpenApiStrategy, number>;
  /** Evidence supporting the detection */
  evidence: DetectionEvidence[];
}

/**
 * ORM detection result.
 */
export interface OrmDetection {
  /** ORM kind (prisma, drizzle, typeorm) */
  kind: string;
  /** Path to schema file (e.g., prisma/schema.prisma) */
  schema_path: string | null;
}

/**
 * Messaging client detection result.
 */
export interface MessagingDetection {
  /** Client library (kafkajs, etc.) */
  client: string;
  /** Evidence supporting the detection */
  evidence: DetectionEvidence[];
}

/**
 * Result of a provider's detect() call.
 * Reports the full stack detection with evidence.
 */
export interface DetectionResult {
  /** Detected stack components (e.g. ["node", "typescript", "nestjs", "prisma", "kafkajs"]) */
  stack: string[];
  /** HTTP framework detection (null if none detected) */
  http: HttpDetection | null;
  /** ORM detection (null if none detected) */
  orm: OrmDetection | null;
  /** Messaging client detection (null if none detected) */
  messaging: MessagingDetection | null;
  /** Type hint for the provider combination (e.g. "node-nestjs-prisma-kafkajs") */
  type_hint: string;
}

/**
 * Context provided to a provider's detect() method.
 */
export interface RepoContext {
  /** Absolute path to the repository root */
  rootDir: string;
}

/**
 * Fields that require human input because the provider lacks the capability.
 */
export interface RequiresHumanEntry {
  /** Artifact that could not be produced */
  artifact: string;
  /** Reason it could not be produced */
  reason: string;
  /** Which capability was missing */
  missing_capability: Capability;
}

/**
 * Pluggable extraction provider interface.
 * Each provider targets a specific stack combination and declares its capabilities.
 */
export interface ExtractionProvider {
  /** Unique provider identifier (e.g. "node-ts") */
  id: string;

  /** Capabilities this provider can perform */
  capabilities: Capability[];

  /**
   * Detect whether this provider applies to the given repo.
   * Returns a DetectionResult if the provider matches, null otherwise.
   */
  detect(repo: RepoContext): DetectionResult | null;

  /**
   * Extract database schema (optional — only if orm_ast or db_introspection capability declared).
   */
  extractSchema?(repo: RepoContext): Promise<unknown>;

  /**
   * Extract OpenAPI specification (optional — only if openapi_native or openapi_ast capability declared).
   */
  extractOpenApi?(repo: RepoContext): Promise<unknown>;

  /**
   * Extract AsyncAPI specification (optional — only if topic_ast or payload_typed capability declared).
   */
  extractAsyncApi?(repo: RepoContext): Promise<unknown>;
}
