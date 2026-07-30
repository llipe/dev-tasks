/**
 * Unit tests for AsyncAPI validation (core/extract/asyncapi/validate.ts).
 */

import { describe, it, expect } from "vitest";
import {
  validateAsyncApi,
  extractionResultToAsyncApiDocument,
} from "#core/extract/asyncapi/validate.js";
import type { AsyncApiDocument } from "#core/extract/asyncapi/types.js";
import type { AsyncApiExtractionResult } from "#core/extract/asyncapi/types.js";

describe("validateAsyncApi", () => {
  it("validates a valid AsyncAPI 2.6 document", () => {
    const doc: AsyncApiDocument = {
      asyncapi: "2.6.0",
      info: { title: "Test API", version: "1.0.0" },
      channels: {
        "order-events": {
          publish: {
            message: { payload: { type: "object" } },
          },
        },
      },
    };

    const result = validateAsyncApi(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates a valid AsyncAPI 3.0 document", () => {
    const doc: AsyncApiDocument = {
      asyncapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      channels: {
        "order-events": {
          address: "order-events",
          messages: {},
        },
      },
    };

    const result = validateAsyncApi(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails on missing asyncapi field", () => {
    const doc = {
      info: { title: "Test", version: "1.0.0" },
      channels: {},
    } as unknown as AsyncApiDocument;

    const result = validateAsyncApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("asyncapi"))).toBe(true);
  });

  it("fails on missing info field", () => {
    const doc = {
      asyncapi: "2.6.0",
      channels: {},
    } as unknown as AsyncApiDocument;

    const result = validateAsyncApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("info"))).toBe(true);
  });

  it("fails on missing channels field", () => {
    const doc = {
      asyncapi: "2.6.0",
      info: { title: "Test", version: "1.0.0" },
    } as unknown as AsyncApiDocument;

    const result = validateAsyncApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("channels"))).toBe(true);
  });

  it("fails on invalid asyncapi version", () => {
    const doc: AsyncApiDocument = {
      asyncapi: "1.0.0",
      info: { title: "Test", version: "1.0.0" },
      channels: {},
    };

    const result = validateAsyncApi(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("2.") || e.message.includes("3."))).toBe(
      true,
    );
  });
});

describe("extractionResultToAsyncApiDocument", () => {
  it("converts extraction result to a valid AsyncAPI document", () => {
    const result: AsyncApiExtractionResult = {
      asyncapi: "2.6.0",
      info: { title: "Kafka Topics", version: "1.0.0" },
      channels: [
        {
          name: "order-events",
          operations: [
            {
              action: "send",
              topic_confidence: "high",
              payload_confidence: "medium",
              message_schema: { type: "object", properties: { orderId: { type: "string" } } },
            },
          ],
        },
        {
          name: "user-updates",
          operations: [
            {
              action: "receive",
              topic_confidence: "high",
              payload_confidence: "low",
              message_schema: null,
            },
          ],
        },
      ],
      unresolved: [],
      source: "inferred",
      confidence: "high",
    };

    const doc = extractionResultToAsyncApiDocument(result);
    expect(doc.asyncapi).toBe("2.6.0");
    expect(doc.info.title).toBe("Kafka Topics");
    expect(doc.channels["order-events"]).toBeDefined();
    expect(doc.channels["user-updates"]).toBeDefined();

    const validation = validateAsyncApi(doc);
    expect(validation.valid).toBe(true);
  });
});
