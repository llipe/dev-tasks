/**
 * AsyncAPI Declared Rung: On-disk AsyncAPI spec detection.
 *
 * Detects an existing asyncapi.yaml/asyncapi.json in the repository.
 * If found, reads and validates it as the authoritative source.
 * Returns confidence: high, rung: declared.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AsyncApiExtractionResult, AsyncApiChannel } from "./types.js";

/** File names to search for an on-disk AsyncAPI spec. */
const ASYNCAPI_CANDIDATES = [
  "asyncapi.yaml",
  "asyncapi.yml",
  "asyncapi.json",
  "docs/asyncapi.yaml",
  "docs/asyncapi.yml",
  "docs/asyncapi.json",
  "api/asyncapi.yaml",
  "api/asyncapi.yml",
  "api/asyncapi.json",
  "spec/asyncapi.yaml",
  "spec/asyncapi.yml",
  "spec/asyncapi.json",
];

/**
 * Detect an on-disk AsyncAPI specification.
 * Returns the path if found, null otherwise.
 */
export function detectOnDiskAsyncApiSpec(rootDir: string): string | null {
  for (const candidate of ASYNCAPI_CANDIDATES) {
    const fullPath = resolve(rootDir, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Extract AsyncAPI channels from an on-disk specification.
 * Returns null if no spec is found.
 */
export function extractAsyncApiDeclared(rootDir: string): AsyncApiExtractionResult | null {
  const specPath = detectOnDiskAsyncApiSpec(rootDir);
  if (!specPath) return null;

  let content: string;
  try {
    content = readFileSync(specPath, "utf-8");
  } catch {
    return null;
  }

  // Parse (JSON or basic YAML)
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(content) as Record<string, unknown>;
  } catch {
    // Try basic YAML parsing
    doc = parseBasicYaml(content);
  }

  // Extract channels
  const channels = extractChannelsFromDoc(doc);
  if (channels.length === 0) return null;

  return {
    asyncapi: (doc.asyncapi as string) ?? "2.6.0",
    info: {
      title: ((doc.info as Record<string, unknown>)?.title as string) ?? "API",
      version: ((doc.info as Record<string, unknown>)?.version as string) ?? "1.0.0",
    },
    channels,
    unresolved: [],
    source: "declared",
    confidence: "high",
  };
}

/**
 * Extract channels from an AsyncAPI document object.
 */
function extractChannelsFromDoc(doc: Record<string, unknown>): AsyncApiChannel[] {
  const channelsObj = doc.channels as Record<string, unknown> | undefined;
  if (!channelsObj || typeof channelsObj !== "object") return [];

  const channels: AsyncApiChannel[] = [];

  for (const [name, channelDef] of Object.entries(channelsObj)) {
    if (!channelDef || typeof channelDef !== "object") continue;
    const ch = channelDef as Record<string, unknown>;

    const hasPublish = !!ch.publish;
    const hasSubscribe = !!ch.subscribe;

    const operations: AsyncApiChannel["operations"] = [];
    if (hasPublish) {
      operations.push({
        action: "send",
        topic_confidence: "high",
        payload_confidence:
          ch.publish && (ch.publish as Record<string, unknown>).message ? "high" : "low",
        message_schema: extractMessageSchema(ch.publish as Record<string, unknown>),
      });
    }
    if (hasSubscribe) {
      operations.push({
        action: "receive",
        topic_confidence: "high",
        payload_confidence:
          ch.subscribe && (ch.subscribe as Record<string, unknown>).message ? "high" : "low",
        message_schema: extractMessageSchema(ch.subscribe as Record<string, unknown>),
      });
    }
    if (!hasPublish && !hasSubscribe) {
      // Default operation if channel has no publish/subscribe (AsyncAPI 3.x style)
      operations.push({
        action: "receive",
        topic_confidence: "high",
        payload_confidence: "low",
        message_schema: null,
      });
    }

    channels.push({ name, operations });
  }

  return channels;
}

/**
 * Extract message schema from an operation definition.
 */
function extractMessageSchema(
  operation: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!operation) return null;
  const message = operation.message as Record<string, unknown> | undefined;
  if (!message) return null;
  const payload = message.payload as Record<string, unknown> | undefined;
  return payload ?? null;
}

/**
 * Minimal YAML parser for AsyncAPI specs — handles basic key-value pairs.
 */
function parseBasicYaml(content: string): Record<string, unknown> {
  try {
    // Try JSON first in case it's actually JSON with wrong extension
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    // Basic YAML parsing — extract asyncapi version and channels
    const result: Record<string, unknown> = {};
    const lines = content.split("\n");

    for (const line of lines) {
      const versionMatch = line.match(/^asyncapi:\s*['"]?([^'"]+)['"]?\s*$/);
      if (versionMatch) {
        result.asyncapi = versionMatch[1];
      }
    }

    // Extract channels section
    const channelsMatch = content.match(/^channels:\s*\n((?:\s+.+\n?)*)/m);
    if (channelsMatch) {
      const channels: Record<string, unknown> = {};
      const channelLines = channelsMatch[1].split("\n");
      for (const line of channelLines) {
        const nameMatch = line.match(/^\s{2}([a-zA-Z0-9_./-]+):\s*$/);
        if (nameMatch) {
          channels[nameMatch[1]] = {};
        }
      }
      result.channels = channels;
    }

    return result;
  }
}
