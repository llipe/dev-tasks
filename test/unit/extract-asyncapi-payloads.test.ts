/**
 * Unit tests for AsyncAPI payload classification (core/extract/asyncapi/payloads.ts).
 * Tests: typed send (generic/interface), inline object literal, opaque serialization.
 */

import { describe, it, expect } from "vitest";
import { extractPayloads } from "#core/extract/asyncapi/payloads.js";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

function createFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "asyncapi-payloads-"));
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

describe("extractPayloads", () => {
  describe("typed send → medium confidence", () => {
    it("classifies typed producer.send with interface in message value type", () => {
      const dir = createFixture({
        "src/producer.ts": `
import { Kafka } from 'kafkajs';

interface OrderEvent {
  orderId: string;
  amount: number;
  status: string;
}

const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();

async function publish(event: OrderEvent) {
  await producer.send({
    topic: 'order-events',
    messages: [{ value: JSON.stringify(event) }],
  });
}
`,
      });

      const result = extractPayloads(dir);
      expect(result.payloads.length).toBeGreaterThanOrEqual(1);
      const payload = result.payloads.find((p) => p.topic === "order-events");
      expect(payload).toBeDefined();
      expect(payload!.source).toBe("typed");
      expect(payload!.payload_confidence).toBe("medium");
      expect(payload!.schema).not.toBeNull();
    });
  });

  describe("inline object literal → low confidence", () => {
    it("classifies inline object in messages array", () => {
      const dir = createFixture({
        "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();

async function publish() {
  await producer.send({
    topic: 'inline-topic',
    messages: [{ value: JSON.stringify({ name: 'test', age: 25 }) }],
  });
}
`,
      });

      const result = extractPayloads(dir);
      expect(result.payloads.length).toBeGreaterThanOrEqual(1);
      const payload = result.payloads.find((p) => p.topic === "inline-topic");
      expect(payload).toBeDefined();
      expect(payload!.source).toBe("inline");
      expect(payload!.payload_confidence).toBe("low");
    });
  });

  describe("opaque serialization → low + unresolved", () => {
    it("classifies Buffer payload as opaque", () => {
      const dir = createFixture({
        "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();

async function publish(data: Buffer) {
  await producer.send({
    topic: 'binary-topic',
    messages: [{ value: data }],
  });
}
`,
      });

      const result = extractPayloads(dir);
      expect(result.payloads.length).toBeGreaterThanOrEqual(1);
      const payload = result.payloads.find((p) => p.topic === "binary-topic");
      expect(payload).toBeDefined();
      expect(payload!.source).toBe("opaque");
      expect(payload!.payload_confidence).toBe("low");
      expect(result.unresolved.length).toBeGreaterThanOrEqual(1);
    });

    it("classifies JSON.stringify(variable) without type info as opaque", () => {
      const dir = createFixture({
        "src/producer.ts": `
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();

async function publish(data: any) {
  await producer.send({
    topic: 'opaque-topic',
    messages: [{ value: JSON.stringify(data) }],
  });
}
`,
      });

      const result = extractPayloads(dir);
      const payload = result.payloads.find((p) => p.topic === "opaque-topic");
      expect(payload).toBeDefined();
      expect(payload!.source).toBe("opaque");
      expect(payload!.payload_confidence).toBe("low");
      expect(result.unresolved.length).toBeGreaterThanOrEqual(1);
    });
  });
});
