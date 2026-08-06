/**
 * Unit tests for OpenAPI breaking-change comparator.
 */
import { describe, it, expect } from "vitest";
import { diffOpenApi } from "../../core/verify/openapi-diff.js";

describe("diffOpenApi", () => {
  describe("path changes", () => {
    it("detects removed path as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: { "/users": { get: { responses: { "200": {} } } } },
      };
      const head = { openapi: "3.0.3", paths: {} };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "path-removed" }),
      );
    });

    it("detects added path as non-breaking", () => {
      const base = { openapi: "3.0.3", paths: {} };
      const head = {
        openapi: "3.0.3",
        paths: { "/health": { get: { responses: { "200": {} } } } },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "path-added" }),
      );
    });
  });

  describe("operation changes", () => {
    it("detects removed operation as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: { responses: { "200": {} } },
            delete: { responses: { "204": {} } },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: { "/users": { get: { responses: { "200": {} } } } },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "operation-removed" }),
      );
    });

    it("detects added operation as non-breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: { "/users": { get: { responses: { "200": {} } } } },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: { responses: { "200": {} } },
            post: { responses: { "201": {} } },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "operation-added" }),
      );
    });
  });

  describe("parameter changes", () => {
    it("detects new required parameter as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": { get: { parameters: [], responses: { "200": {} } } },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: {
              parameters: [
                { name: "tenant", in: "header", required: true, schema: { type: "string" } },
              ],
              responses: { "200": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "parameter-added-required" }),
      );
    });

    it("detects new optional parameter as non-breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": { get: { parameters: [], responses: { "200": {} } } },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: {
              parameters: [
                { name: "page", in: "query", required: false, schema: { type: "integer" } },
              ],
              responses: { "200": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "parameter-added-optional" }),
      );
    });

    it("detects parameter type change as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users/{id}": {
            get: {
              parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
              responses: { "200": {} },
            },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users/{id}": {
            get: {
              parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
              responses: { "200": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "parameter-type-changed" }),
      );
    });
  });

  describe("enum changes", () => {
    it("detects narrowed enum as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: {
              parameters: [
                {
                  name: "status",
                  in: "query",
                  required: false,
                  schema: { type: "string", enum: ["active", "inactive", "pending"] },
                },
              ],
              responses: { "200": {} },
            },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: {
              parameters: [
                {
                  name: "status",
                  in: "query",
                  required: false,
                  schema: { type: "string", enum: ["active", "inactive"] },
                },
              ],
              responses: { "200": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "enum-narrowed" }),
      );
    });

    it("detects widened enum as non-breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: {
              parameters: [
                {
                  name: "status",
                  in: "query",
                  required: false,
                  schema: { type: "string", enum: ["active", "inactive"] },
                },
              ],
              responses: { "200": {} },
            },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: {
              parameters: [
                {
                  name: "status",
                  in: "query",
                  required: false,
                  schema: { type: "string", enum: ["active", "inactive", "pending"] },
                },
              ],
              responses: { "200": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "enum-widened" }),
      );
    });
  });

  describe("request body changes", () => {
    it("detects new required field as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["name"],
                      properties: { name: { type: "string" } },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["name", "email"],
                      properties: {
                        name: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "field-added-required" }),
      );
    });

    it("detects new optional field as non-breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["name"],
                      properties: { name: { type: "string" } },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["name"],
                      properties: {
                        name: { type: "string" },
                        avatar: { type: "string" },
                      },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "field-added-optional" }),
      );
    });

    it("detects schema type change as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { age: { type: "integer" } },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { age: { type: "string" } },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "schema-type-changed" }),
      );
    });
  });

  describe("response changes", () => {
    it("detects removed response status as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            get: { responses: { "200": {}, "404": {} } },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": { get: { responses: { "200": {} } } },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "response-removed" }),
      );
    });

    it("detects added response status as non-breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": { get: { responses: { "200": {} } } },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": { get: { responses: { "200": {}, "429": {} } } },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(false);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "non-breaking", code: "response-added" }),
      );
    });
  });

  describe("no changes", () => {
    it("returns no findings for identical specs", () => {
      const spec = {
        openapi: "3.0.3",
        paths: {
          "/users": { get: { responses: { "200": {} } } },
        },
      };

      const result = diffOpenApi(spec, spec);
      expect(result.breaking).toBe(false);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe("field made required", () => {
    it("detects previously optional field made required as breaking", () => {
      const base = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["name"],
                      properties: {
                        name: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };
      const head = {
        openapi: "3.0.3",
        paths: {
          "/users": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["name", "email"],
                      properties: {
                        name: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                  },
                },
              },
              responses: { "201": {} },
            },
          },
        },
      };

      const result = diffOpenApi(base, head);
      expect(result.breaking).toBe(true);
      expect(result.findings).toContainEqual(
        expect.objectContaining({ kind: "breaking", code: "field-made-required" }),
      );
    });
  });
});
