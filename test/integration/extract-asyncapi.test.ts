/**
 * Integration tests for AsyncAPI extraction.
 * Tests end-to-end extraction on fixture repos → expected topic inventory + confidence + validation.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { extractTopics } from "#core/extract/asyncapi/topics.js";
import { extractPayloads } from "#core/extract/asyncapi/payloads.js";
import {
  validateAsyncApi,
  extractionResultToAsyncApiDocument,
} from "#core/extract/asyncapi/validate.js";
import type {
  AsyncApiExtractionResult,
  AsyncApiChannel,
  UnresolvedEntry,
} from "#core/extract/asyncapi/types.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/extract");

function buildExtractionResult(rootDir: string): AsyncApiExtractionResult {
  const topicResult = extractTopics(rootDir);
  const payloadResult = extractPayloads(rootDir);

  const channelMap = new Map<string, AsyncApiChannel>();
  for (const topic of topicResult.topics) {
    if (!channelMap.has(topic.name)) {
      channelMap.set(topic.name, { name: topic.name, operations: [] });
    }
    const channel = channelMap.get(topic.name)!;
    const matchingPayload = payloadResult.payloads.find((p) => p.topic === topic.name);
    channel.operations.push({
      action: topic.direction === "provides" ? "send" : "receive",
      topic_confidence: topic.topic_confidence,
      payload_confidence: matchingPayload?.payload_confidence ?? "low",
      message_schema: matchingPayload?.schema ?? null,
    });
  }

  const channels = Array.from(channelMap.values());
  const unresolved: UnresolvedEntry[] = [...topicResult.unresolved, ...payloadResult.unresolved];

  return {
    asyncapi: "2.6.0",
    info: { title: "Kafka Topics", version: "1.0.0" },
    channels,
    unresolved,
    source: "inferred",
    confidence: "low",
  };
}

describe("AsyncAPI integration — kafkajs-string-topics fixture", () => {
  const fixtureDir = join(FIXTURES_DIR, "kafkajs-string-topics");

  it("extracts all string-literal topics with high confidence", () => {
    const topicResult = extractTopics(fixtureDir);

    // Should find: order-events (provide + consume), payment-events (sendBatch + consume),
    // shipping-events (consume), notification-events (sendBatch)
    expect(topicResult.topics.length).toBeGreaterThanOrEqual(5);

    const orderProvides = topicResult.topics.find(
      (t) => t.name === "order-events" && t.direction === "provides",
    );
    expect(orderProvides).toBeDefined();
    expect(orderProvides!.topic_confidence).toBe("high");

    const orderConsumes = topicResult.topics.find(
      (t) => t.name === "order-events" && t.direction === "consumes",
    );
    expect(orderConsumes).toBeDefined();

    const paymentBatch = topicResult.topics.find(
      (t) => t.name === "payment-events" && t.direction === "provides",
    );
    expect(paymentBatch).toBeDefined();
    expect(paymentBatch!.topic_confidence).toBe("high");
  });

  it("produces a valid AsyncAPI document", () => {
    const result = buildExtractionResult(fixtureDir);
    const doc = extractionResultToAsyncApiDocument(result);
    const validation = validateAsyncApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("AsyncAPI integration — kafkajs-config-env fixture", () => {
  const fixtureDir = join(FIXTURES_DIR, "kafkajs-config-env");

  it("resolves constant and enum topics with high confidence", () => {
    const topicResult = extractTopics(fixtureDir);

    const orderTopic = topicResult.topics.find((t) => t.name === "orders");
    expect(orderTopic).toBeDefined();
    expect(orderTopic!.resolution).toBe("constant");
    expect(orderTopic!.topic_confidence).toBe("high");

    const userTopic = topicResult.topics.find((t) => t.name === "user-created");
    expect(userTopic).toBeDefined();
    expect(userTopic!.resolution).toBe("constant");
    expect(userTopic!.topic_confidence).toBe("high");
  });

  it("resolves template literal with env var at medium confidence", () => {
    const topicResult = extractTopics(fixtureDir);
    const templateTopic = topicResult.topics.find((t) => t.resolution === "template");
    expect(templateTopic).toBeDefined();
    expect(templateTopic!.topic_confidence).toBe("medium");
    expect(templateTopic!.variables).toBeDefined();
    expect(templateTopic!.variables!.length).toBeGreaterThan(0);
  });

  it("produces a valid AsyncAPI document", () => {
    const result = buildExtractionResult(fixtureDir);
    const doc = extractionResultToAsyncApiDocument(result);
    const validation = validateAsyncApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("AsyncAPI integration — kafkajs-typed-payloads fixture", () => {
  const fixtureDir = join(FIXTURES_DIR, "kafkajs-typed-payloads");

  it("classifies typed payloads at medium confidence with schemas", () => {
    const payloadResult = extractPayloads(fixtureDir);

    const orderPayload = payloadResult.payloads.find((p) => p.topic === "order-events");
    expect(orderPayload).toBeDefined();
    expect(orderPayload!.source).toBe("typed");
    expect(orderPayload!.payload_confidence).toBe("medium");
    expect(orderPayload!.schema).not.toBeNull();
    expect((orderPayload!.schema as Record<string, unknown>).properties).toBeDefined();

    const userPayload = payloadResult.payloads.find((p) => p.topic === "user-events");
    expect(userPayload).toBeDefined();
    expect(userPayload!.source).toBe("typed");
    expect(userPayload!.payload_confidence).toBe("medium");
  });

  it("has separate topic_confidence and payload_confidence per channel", () => {
    const result = buildExtractionResult(fixtureDir);
    for (const channel of result.channels) {
      for (const op of channel.operations) {
        // topic_confidence and payload_confidence are tracked separately
        expect(op.topic_confidence).toBeDefined();
        expect(op.payload_confidence).toBeDefined();
        // They can differ
        expect(typeof op.topic_confidence).toBe("string");
        expect(typeof op.payload_confidence).toBe("string");
      }
    }
  });

  it("produces a valid AsyncAPI document", () => {
    const result = buildExtractionResult(fixtureDir);
    const doc = extractionResultToAsyncApiDocument(result);
    const validation = validateAsyncApi(doc);
    expect(validation.valid).toBe(true);
  });
});

describe("AsyncAPI integration — kafkajs-opaque-payloads fixture", () => {
  const fixtureDir = join(FIXTURES_DIR, "kafkajs-opaque-payloads");

  it("classifies Buffer and untyped payloads as opaque with unresolved entries", () => {
    const payloadResult = extractPayloads(fixtureDir);

    const binaryPayload = payloadResult.payloads.find((p) => p.topic === "binary-events");
    expect(binaryPayload).toBeDefined();
    expect(binaryPayload!.source).toBe("opaque");
    expect(binaryPayload!.payload_confidence).toBe("low");

    const dynamicPayload = payloadResult.payloads.find((p) => p.topic === "dynamic-events");
    expect(dynamicPayload).toBeDefined();
    expect(dynamicPayload!.source).toBe("opaque");
    expect(dynamicPayload!.payload_confidence).toBe("low");

    // Should have unresolved entries for opaque payloads
    expect(payloadResult.unresolved.length).toBeGreaterThanOrEqual(2);
  });

  it("handles producer with no consumers (orphan topic) in same repo", () => {
    const topicResult = extractTopics(fixtureDir);
    const orphan = topicResult.topics.find((t) => t.name === "orphan-topic");
    expect(orphan).toBeDefined();
    expect(orphan!.direction).toBe("provides");

    // No consumer for this topic
    const orphanConsumer = topicResult.topics.find(
      (t) => t.name === "orphan-topic" && t.direction === "consumes",
    );
    expect(orphanConsumer).toBeUndefined();
  });

  it("produces a valid AsyncAPI document even with opaque payloads", () => {
    const result = buildExtractionResult(fixtureDir);
    const doc = extractionResultToAsyncApiDocument(result);
    const validation = validateAsyncApi(doc);
    expect(validation.valid).toBe(true);
  });
});
