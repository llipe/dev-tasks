/**
 * Edge-case tests for AsyncAPI extraction.
 * Tests: subscribe({ topics: [...] }), topic from config array, Buffer payload → low + unresolved,
 * producer with no consumers in same repo.
 */

import { describe, it, expect } from "vitest";
import { extractTopics } from "#core/extract/asyncapi/topics.js";
import { extractPayloads } from "#core/extract/asyncapi/payloads.js";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

function createFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "asyncapi-edge-"));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }
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

describe("edge cases — subscribe with topics array", () => {
  it("handles subscribe({ topics: [...] }) with mixed resolution", () => {
    const dir = createFixture({
      "src/consumer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'g1' });
async function consume() {
  await consumer.subscribe({
    topics: ['literal-topic', 'another-literal']
  });
}
`,
    });

    const result = extractTopics(dir);
    expect(result.topics.length).toBe(2);
    expect(result.topics[0].name).toBe("literal-topic");
    expect(result.topics[0].direction).toBe("consumes");
    expect(result.topics[1].name).toBe("another-literal");
    expect(result.topics[1].direction).toBe("consumes");
  });

  it("handles topic from config array with unresolvable entries", () => {
    const dir = createFixture({
      "src/consumer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'g1' });
const configTopics = getTopicsFromConfig();
function getTopicsFromConfig(): string[] { return []; }
async function consume() {
  await consumer.subscribe({ topic: configTopics[0] });
}
`,
    });

    const result = extractTopics(dir);
    // Should produce an unresolved entry since configTopics[0] is a computed expression
    expect(result.unresolved.length).toBeGreaterThanOrEqual(1);
    const lowTopic = result.topics.find((t) => t.resolution === "unresolvable");
    expect(lowTopic).toBeDefined();
    expect(lowTopic!.topic_confidence).toBe("low");
  });
});

describe("edge cases — Buffer payload", () => {
  it("classifies Buffer type annotation as opaque with unresolved", () => {
    const dir = createFixture({
      "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
async function publish(buf: Buffer) {
  await producer.send({
    topic: 'buffer-topic',
    messages: [{ value: buf }],
  });
}
`,
    });

    const result = extractPayloads(dir);
    const payload = result.payloads.find((p) => p.topic === "buffer-topic");
    expect(payload).toBeDefined();
    expect(payload!.source).toBe("opaque");
    expect(payload!.payload_confidence).toBe("low");
    expect(result.unresolved.length).toBeGreaterThanOrEqual(1);
    expect(result.unresolved[0].type).toBe("payload");
  });
});

describe("edge cases — producer with no consumers in same repo", () => {
  it("extracts producer topics even without matching consumers", () => {
    const dir = createFixture({
      "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
async function publish() {
  await producer.send({
    topic: 'orphan-producer-topic',
    messages: [{ value: 'data' }],
  });
}
`,
    });

    const result = extractTopics(dir);
    const topic = result.topics.find((t) => t.name === "orphan-producer-topic");
    expect(topic).toBeDefined();
    expect(topic!.direction).toBe("provides");

    // No consumer present
    const consumer = result.topics.find(
      (t) => t.name === "orphan-producer-topic" && t.direction === "consumes",
    );
    expect(consumer).toBeUndefined();
  });
});

describe("edge cases — multiple operations on same topic", () => {
  it("produces separate entries for producer and consumer on same topic", () => {
    const dir = createFixture({
      "src/app.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'g1' });
async function run() {
  await producer.send({ topic: 'shared-topic', messages: [{ value: 'msg' }] });
  await consumer.subscribe({ topic: 'shared-topic' });
}
`,
    });

    const result = extractTopics(dir);
    const provides = result.topics.find(
      (t) => t.name === "shared-topic" && t.direction === "provides",
    );
    const consumes = result.topics.find(
      (t) => t.name === "shared-topic" && t.direction === "consumes",
    );
    expect(provides).toBeDefined();
    expect(consumes).toBeDefined();
  });
});

describe("edge cases — empty or no kafkajs usage", () => {
  it("returns empty when no kafkajs patterns found", () => {
    const dir = createFixture({
      "src/app.ts": `
const x = 1;
export function hello() { return 'world'; }
`,
    });

    const topicResult = extractTopics(dir);
    const payloadResult = extractPayloads(dir);
    expect(topicResult.topics).toHaveLength(0);
    expect(topicResult.unresolved).toHaveLength(0);
    expect(payloadResult.payloads).toHaveLength(0);
    expect(payloadResult.unresolved).toHaveLength(0);
  });
});
