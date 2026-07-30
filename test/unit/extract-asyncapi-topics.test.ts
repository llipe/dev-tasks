/**
 * Unit tests for AsyncAPI topic extraction (core/extract/asyncapi/topics.ts).
 * Tests: producer.send, producer.sendBatch, consumer.subscribe with single/array topics,
 * topic resolution: string literal, module constant/enum, template literal, unresolvable.
 */

import { describe, it, expect } from "vitest";
import { extractTopics } from "#core/extract/asyncapi/topics.js";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

function createFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "asyncapi-topics-"));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }
  // Write a minimal tsconfig.json
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["**/*.ts"],
    }),
    "utf-8",
  );
  return dir;
}

describe("extractTopics", () => {
  describe("producer.send → provides", () => {
    it("extracts a string literal topic from producer.send", () => {
      const dir = createFixture({
        "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
async function publish() {
  await producer.send({ topic: 'order-events', messages: [{ value: 'test' }] });
}
`,
      });

      const result = extractTopics(dir);
      expect(result.topics.length).toBeGreaterThanOrEqual(1);

      const topic = result.topics.find((t) => t.name === "order-events");
      expect(topic).toBeDefined();
      expect(topic!.direction).toBe("provides");
      expect(topic!.resolution).toBe("literal");
      expect(topic!.topic_confidence).toBe("high");
    });

    it("extracts topic from producer.sendBatch → provides", () => {
      const dir = createFixture({
        "src/batch-producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
async function publishBatch() {
  await producer.sendBatch({
    topicMessages: [
      { topic: 'batch-topic-1', messages: [{ value: 'a' }] },
      { topic: 'batch-topic-2', messages: [{ value: 'b' }] },
    ]
  });
}
`,
      });

      const result = extractTopics(dir);
      const t1 = result.topics.find((t) => t.name === "batch-topic-1");
      const t2 = result.topics.find((t) => t.name === "batch-topic-2");
      expect(t1).toBeDefined();
      expect(t1!.direction).toBe("provides");
      expect(t1!.topic_confidence).toBe("high");
      expect(t2).toBeDefined();
      expect(t2!.direction).toBe("provides");
    });
  });

  describe("consumer.subscribe → consumes", () => {
    it("extracts single topic from consumer.subscribe({ topic: X })", () => {
      const dir = createFixture({
        "src/consumer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'my-group' });
async function consume() {
  await consumer.subscribe({ topic: 'user-updates' });
}
`,
      });

      const result = extractTopics(dir);
      const topic = result.topics.find((t) => t.name === "user-updates");
      expect(topic).toBeDefined();
      expect(topic!.direction).toBe("consumes");
      expect(topic!.resolution).toBe("literal");
      expect(topic!.topic_confidence).toBe("high");
    });

    it("extracts multiple topics from consumer.subscribe({ topics: [X, Y] })", () => {
      const dir = createFixture({
        "src/multi-consumer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'my-group' });
async function consume() {
  await consumer.subscribe({ topics: ['topic-a', 'topic-b', 'topic-c'] });
}
`,
      });

      const result = extractTopics(dir);
      const topicA = result.topics.find((t) => t.name === "topic-a");
      const topicB = result.topics.find((t) => t.name === "topic-b");
      const topicC = result.topics.find((t) => t.name === "topic-c");
      expect(topicA).toBeDefined();
      expect(topicA!.direction).toBe("consumes");
      expect(topicB).toBeDefined();
      expect(topicB!.direction).toBe("consumes");
      expect(topicC).toBeDefined();
      expect(topicC!.direction).toBe("consumes");
    });
  });

  describe("topic resolution — constants and enums", () => {
    it("resolves module constant → high confidence", () => {
      const dir = createFixture({
        "src/topics.ts": `
export const ORDER_TOPIC = 'orders';
`,
        "src/producer.ts": `
import { Kafka } from 'kafkajs';
import { ORDER_TOPIC } from './topics';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
async function publish() {
  await producer.send({ topic: ORDER_TOPIC, messages: [] });
}
`,
      });

      const result = extractTopics(dir);
      const topic = result.topics.find((t) => t.name === "orders");
      expect(topic).toBeDefined();
      expect(topic!.direction).toBe("provides");
      expect(topic!.resolution).toBe("constant");
      expect(topic!.topic_confidence).toBe("high");
    });

    it("resolves enum member → high confidence", () => {
      const dir = createFixture({
        "src/topics.ts": `
export enum Topics {
  USER_EVENTS = 'user-events',
  ORDER_EVENTS = 'order-events',
}
`,
        "src/consumer.ts": `
import { Kafka } from 'kafkajs';
import { Topics } from './topics';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'g1' });
async function consume() {
  await consumer.subscribe({ topic: Topics.USER_EVENTS });
}
`,
      });

      const result = extractTopics(dir);
      const topic = result.topics.find((t) => t.name === "user-events");
      expect(topic).toBeDefined();
      expect(topic!.direction).toBe("consumes");
      expect(topic!.resolution).toBe("constant");
      expect(topic!.topic_confidence).toBe("high");
    });
  });

  describe("topic resolution — template literals", () => {
    it("resolves template literal with env var → medium confidence", () => {
      const dir = createFixture({
        "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
const prefix = process.env.TOPIC_PREFIX;
async function publish() {
  await producer.send({ topic: \`\${prefix}-orders\`, messages: [] });
}
`,
      });

      const result = extractTopics(dir);
      expect(result.topics.length).toBeGreaterThanOrEqual(1);
      const topic = result.topics.find((t) => t.resolution === "template");
      expect(topic).toBeDefined();
      expect(topic!.topic_confidence).toBe("medium");
      expect(topic!.direction).toBe("provides");
      expect(topic!.pattern).toBeDefined();
      expect(topic!.variables).toBeDefined();
      expect(topic!.variables!.length).toBeGreaterThan(0);
    });
  });

  describe("topic resolution — unresolvable", () => {
    it("marks unresolvable expression → low + unresolved[]", () => {
      const dir = createFixture({
        "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
function getTopicFromConfig(config: any): string { return config.topic; }
async function publish(config: any) {
  await producer.send({ topic: getTopicFromConfig(config), messages: [] });
}
`,
      });

      const result = extractTopics(dir);
      // Should have an unresolved entry
      expect(result.unresolved.length).toBeGreaterThanOrEqual(1);
      const entry = result.unresolved[0];
      expect(entry.type).toBe("topic");
      expect(entry.reason).toContain("unresolvable");

      // Also produces a low-confidence topic
      const lowTopic = result.topics.find((t) => t.resolution === "unresolvable");
      expect(lowTopic).toBeDefined();
      expect(lowTopic!.topic_confidence).toBe("low");
    });
  });
});
