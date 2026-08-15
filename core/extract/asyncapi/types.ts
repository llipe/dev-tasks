/**
 * Shared types for AsyncAPI extraction results.
 */

/**
 * Confidence level for topic or payload resolution.
 */
export type AsyncApiConfidence = "high" | "medium" | "low";

/**
 * Direction of a topic interaction.
 */
export type TopicDirection = "provides" | "consumes";

/**
 * Source of how the topic name was resolved.
 */
export type TopicResolutionSource = "literal" | "constant" | "template" | "unresolvable";

/**
 * Payload classification source.
 */
export type PayloadSource = "typed" | "inline" | "opaque";

/**
 * A resolved topic with confidence and direction.
 */
export interface ResolvedTopic {
  /** The topic name (resolved value or pattern) */
  name: string;
  /** Direction: provides (producer) or consumes (consumer) */
  direction: TopicDirection;
  /** How the topic was resolved */
  resolution: TopicResolutionSource;
  /** Confidence level */
  topic_confidence: AsyncApiConfidence;
  /** Source file where the topic was found */
  file: string;
  /** Line number in the source file */
  line: number;
  /** For template literals: the pattern with variable placeholders */
  pattern?: string;
  /** For template literals: variable names used */
  variables?: string[];
}

/**
 * An unresolved topic or payload entry.
 */
export interface UnresolvedEntry {
  /** Source file */
  file: string;
  /** Line number */
  line: number;
  /** Reason it could not be resolved */
  reason: string;
  /** Code snippet showing the unresolvable expression */
  snippet: string;
  /** Type of unresolved entry */
  type: "topic" | "payload";
}

/**
 * A resolved payload schema with confidence.
 */
export interface ResolvedPayload {
  /** Associated topic name (if determinable) */
  topic: string | null;
  /** Source of the classification */
  source: PayloadSource;
  /** Confidence level */
  payload_confidence: AsyncApiConfidence;
  /** Derived JSON schema (if available) */
  schema: Record<string, unknown> | null;
  /** Source file */
  file: string;
  /** Line number */
  line: number;
}

/**
 * A channel in the AsyncAPI document with separate confidence fields.
 */
export interface AsyncApiChannel {
  /** Channel name (topic) */
  name: string;
  /** Operations on this channel */
  operations: AsyncApiOperation[];
}

/**
 * An operation on an AsyncAPI channel.
 */
export interface AsyncApiOperation {
  /** Operation action: send or receive */
  action: "send" | "receive";
  /** Topic confidence */
  topic_confidence: AsyncApiConfidence;
  /** Payload confidence */
  payload_confidence: AsyncApiConfidence;
  /** Message schema (if available) */
  message_schema: Record<string, unknown> | null;
}

/**
 * Full AsyncAPI extraction result.
 */
export interface AsyncApiExtractionResult {
  /** AsyncAPI specification version */
  asyncapi: string;
  /** API info */
  info: {
    title: string;
    version: string;
    description?: string;
  };
  /** Channels (topics) with operations */
  channels: AsyncApiChannel[];
  /** Topics that could not be resolved */
  unresolved: UnresolvedEntry[];
  /** Source type */
  source: "inferred" | "declared";
  /** Overall confidence (lowest of all channels) */
  confidence: AsyncApiConfidence;
}

/**
 * AsyncAPI document structure (for validation / output).
 */
export interface AsyncApiDocument {
  asyncapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  channels: Record<string, unknown>;
  operations?: Record<string, unknown>;
}
