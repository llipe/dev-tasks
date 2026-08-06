/**
 * Unit tests for AsyncAPI breaking-change comparator.
 */
import { describe, it, expect } from "vitest";
import { diffAsyncApi } from "../../core/verify/asyncapi-diff.js";

describe("diffAsyncApi", () => {
  describe("channel changes", () => {
    it("detects removed channel as breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": { publish: { message: { payload: { type: "object" } } } },
          "orders/cancelled": { publish: { message: { payload: { type: "object" } } } },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": { publish: { message: { payload: { type: "object" } } } },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "channel-removed" }),
      );
    });

    it("detects added channel as non-breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": { publish: { message: { payload: { type: "object" } } } },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": { publish: { message: { payload: { type: "object" } } } },
          "orders/shipped": { publish: { message: { payload: { type: "object" } } } },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "channel-added" }),
      );
    });
  });

  describe("payload field changes", () => {
    it("detects new required field as breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id"],
                  properties: { order_id: { type: "string" } },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id", "total"],
                  properties: {
                    order_id: { type: "string" },
                    total: { type: "number" },
                  },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "field-added-required" }),
      );
    });

    it("detects new optional field as non-breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id"],
                  properties: { order_id: { type: "string" } },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id"],
                  properties: {
                    order_id: { type: "string" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "field-added-optional" }),
      );
    });

    it("detects field type change as breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: { customer_id: { type: "string" } },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: { customer_id: { type: "integer" } },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "field-type-changed" }),
      );
    });
  });

  describe("enum changes", () => {
    it("detects narrowed enum as breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["pending", "confirmed", "shipped"] },
                  },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["pending", "confirmed"] },
                  },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "enum-narrowed" }),
      );
    });

    it("detects widened enum as non-breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["pending", "confirmed"] },
                  },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["pending", "confirmed", "shipped"] },
                  },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "enum-widened" }),
      );
    });
  });

  describe("payload_confidence: low skip", () => {
    it("skips channels with x-payload-confidence: low", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/tracking": {
            "x-payload-confidence": "low",
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id"],
                  properties: { order_id: { type: "string" } },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/tracking": {
            "x-payload-confidence": "low",
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id", "carrier", "eta"],
                  properties: {
                    order_id: { type: "integer" },
                    carrier: { type: "string" },
                    eta: { type: "string" },
                  },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      // Should not report breaking because the channel is low-confidence
      expect(result.breaking).toBe(false);
      expect(result.findings).toHaveLength(0);
    });

    it("does NOT skip channels with x-payload-confidence: high", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            "x-payload-confidence": "high",
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id"],
                  properties: { order_id: { type: "string" } },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            "x-payload-confidence": "high",
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id", "total"],
                  properties: {
                    order_id: { type: "string" },
                    total: { type: "number" },
                  },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(true);
    });

    it("does NOT skip channels with x-payload-confidence: medium", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            "x-payload-confidence": "medium",
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: { order_id: { type: "string" } },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            "x-payload-confidence": "medium",
            publish: {
              message: {
                payload: {
                  type: "object",
                  properties: { order_id: { type: "integer" } },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(true);
    });
  });

  describe("no changes", () => {
    it("returns no findings for identical specs", () => {
      const spec = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id"],
                  properties: { order_id: { type: "string" } },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(spec, spec);
      expect(result.breaking).toBe(false);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe("field made required", () => {
    it("detects previously optional field made required as breaking", () => {
      const base = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id"],
                  properties: {
                    order_id: { type: "string" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
        },
      };
      const head = {
        asyncapi: "2.6.0",
        channels: {
          "orders/created": {
            publish: {
              message: {
                payload: {
                  type: "object",
                  required: ["order_id", "notes"],
                  properties: {
                    order_id: { type: "string" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
        },
      };

      const result = diffAsyncApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "field-made-required" }),
      );
    });
  });
});
