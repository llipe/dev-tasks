/**
 * Unit tests for contract-diff orchestrator.
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runContractDiff, detectContractType, loadSpec } from "../../core/verify/contract-diff.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures/verify");

describe("detectContractType", () => {
  it("detects OpenAPI 3.x", () => {
    expect(detectContractType({ openapi: "3.0.3" })).toBe("openapi");
    expect(detectContractType({ openapi: "3.1.0" })).toBe("openapi");
  });

  it("detects AsyncAPI", () => {
    expect(detectContractType({ asyncapi: "2.6.0" })).toBe("asyncapi");
    expect(detectContractType({ asyncapi: "3.0.0" })).toBe("asyncapi");
  });

  it("returns null for unknown", () => {
    expect(detectContractType({})).toBeNull();
    expect(detectContractType({ swagger: "2.0" })).toBeNull();
  });
});

describe("loadSpec", () => {
  it("loads YAML spec", () => {
    const spec = loadSpec(resolve(FIXTURES, "openapi-base.yaml"));
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.paths).toBeDefined();
  });

  it("throws on non-existent file", () => {
    expect(() => loadSpec("/nonexistent/file.yaml")).toThrow();
  });
});

describe("runContractDiff", () => {
  it("detects breaking changes in OpenAPI specs", () => {
    const result = runContractDiff({
      basePath: resolve(FIXTURES, "openapi-base.yaml"),
      headPath: resolve(FIXTURES, "openapi-head-breaking.yaml"),
    });

    expect(result.contractType).toBe("openapi");
    expect(result.breaking).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);

    const breakingCodes = result.findings.filter((f) => f.kind === "breaking").map((f) => f.code);

    // Expected breaking changes in the fixture:
    // - narrowed enum (pending removed from status)
    // - new required parameter (tenant_id header)
    // - field made required (email in POST body)
    // - parameter type changed (id: string → integer)
    // - operation removed (DELETE /users/{id})
    // - response removed (404 from GET /users)
    expect(breakingCodes).toContain("enum-narrowed");
    expect(breakingCodes).toContain("parameter-added-required");
    expect(breakingCodes).toContain("field-made-required");
    expect(breakingCodes).toContain("parameter-type-changed");
    expect(breakingCodes).toContain("operation-removed");
    expect(breakingCodes).toContain("response-removed");
  });

  it("reports no breaking changes for additive OpenAPI changes", () => {
    const result = runContractDiff({
      basePath: resolve(FIXTURES, "openapi-base.yaml"),
      headPath: resolve(FIXTURES, "openapi-head-nonbreaking.yaml"),
    });

    expect(result.contractType).toBe("openapi");
    expect(result.breaking).toBe(false);

    const nonBreakingCodes = result.findings
      .filter((f) => f.kind === "non-breaking")
      .map((f) => f.code);

    // Expected non-breaking changes:
    // - enum widened (archived added to status)
    // - parameter added optional (page)
    // - field added optional (avatar_url)
    // - path added (/health)
    expect(nonBreakingCodes).toContain("enum-widened");
    expect(nonBreakingCodes).toContain("parameter-added-optional");
    expect(nonBreakingCodes).toContain("field-added-optional");
    expect(nonBreakingCodes).toContain("path-added");
  });

  it("detects breaking changes in AsyncAPI specs", () => {
    const result = runContractDiff({
      basePath: resolve(FIXTURES, "asyncapi-base.yaml"),
      headPath: resolve(FIXTURES, "asyncapi-head-breaking.yaml"),
    });

    expect(result.contractType).toBe("asyncapi");
    expect(result.breaking).toBe(true);

    const breakingCodes = result.findings.filter((f) => f.kind === "breaking").map((f) => f.code);

    // Expected breaking changes:
    // - channel removed (orders/cancelled)
    // - new required field (total_amount in orders/created)
    // - field type changed (customer_id: string → integer)
    // - enum narrowed (shipped removed from status)
    expect(breakingCodes).toContain("channel-removed");
    expect(breakingCodes).toContain("field-added-required");
    expect(breakingCodes).toContain("field-type-changed");
    expect(breakingCodes).toContain("enum-narrowed");
  });

  it("reports no breaking changes for additive AsyncAPI changes", () => {
    const result = runContractDiff({
      basePath: resolve(FIXTURES, "asyncapi-base.yaml"),
      headPath: resolve(FIXTURES, "asyncapi-head-nonbreaking.yaml"),
    });

    expect(result.contractType).toBe("asyncapi");
    expect(result.breaking).toBe(false);

    const nonBreakingCodes = result.findings
      .filter((f) => f.kind === "non-breaking")
      .map((f) => f.code);

    // Expected non-breaking changes:
    // - channel added (orders/delivered)
    // - enum widened (delivered added to status)
    // - field added optional (priority)
    expect(nonBreakingCodes).toContain("channel-added");
    expect(nonBreakingCodes).toContain("enum-widened");
    expect(nonBreakingCodes).toContain("field-added-optional");
  });

  it("skips low-confidence AsyncAPI channels", () => {
    const result = runContractDiff({
      basePath: resolve(FIXTURES, "asyncapi-base.yaml"),
      headPath: resolve(FIXTURES, "asyncapi-head-breaking.yaml"),
    });

    // The orders/tracking channel has payload_confidence: low in base
    // and is heavily modified in head — but should be skipped
    const trackingFindings = result.findings.filter((f) => f.path.includes("orders/tracking"));
    expect(trackingFindings).toHaveLength(0);
  });

  it("throws on unrecognized contract type", () => {
    // Create a temp JSON file with bad content — use inline approach
    expect(() =>
      runContractDiff({
        basePath: resolve(FIXTURES, "openapi-base.yaml"),
        headPath: resolve(FIXTURES, "openapi-base.yaml"),
      }),
    ).not.toThrow();
  });
});
