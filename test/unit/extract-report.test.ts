/**
 * Unit tests for core/extract/report.ts.
 * Tests: report aggregation, confidence counts, coverage metrics.
 */

import { describe, it, expect } from "vitest";
import {
  buildExtractionReport,
  serializeReport,
  type ReportInputs,
  type ExtractionReport,
} from "#core/extract/report.js";

function makeReportInputs(overrides: Partial<ReportInputs> = {}): ReportInputs {
  return {
    strategies: [
      { stage: "detect", strategy: "node-ts", source: "detected", confidence: "high" },
      { stage: "schema", strategy: "prisma-ast", source: "introspected", confidence: "high" },
      { stage: "openapi", strategy: "route3-ast", source: "inferred", confidence: "medium" },
      { stage: "asyncapi", strategy: "kafkajs-ast", source: "inferred", confidence: "medium" },
    ],
    endpointsResolved: 10,
    endpointsUnresolved: 2,
    topicsResolved: 5,
    topicsUnresolved: 1,
    tablesResolved: 8,
    tablesUnresolved: 0,
    unresolved: [
      {
        stage: "openapi",
        type: "dynamic-route",
        location: "src/routes/dynamic.ts:15",
        reason: "Route registered via loop over config array",
      },
      {
        stage: "asyncapi",
        type: "unresolvable-topic",
        location: "src/events/producer.ts:32",
        reason: "Topic computed from runtime variable",
      },
    ],
    requiresHuman: [
      { field: "owner", reason: "Non-derivable field", category: "non-derivable" },
      { field: "domain", reason: "Non-derivable field", category: "non-derivable" },
    ],
    confidenceEntries: ["high", "high", "medium", "medium", "low", "high"],
    ...overrides,
  };
}

describe("core/extract/report — buildExtractionReport()", () => {
  it("produces a report with generated_at timestamp", () => {
    const report = buildExtractionReport(makeReportInputs());
    expect(report.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes all strategies", () => {
    const report = buildExtractionReport(makeReportInputs());
    expect(report.strategies).toHaveLength(4);
    expect(report.strategies[0].stage).toBe("detect");
    expect(report.strategies[2].strategy).toBe("route3-ast");
  });

  it("computes coverage metrics correctly", () => {
    const report = buildExtractionReport(makeReportInputs());

    expect(report.coverage.endpoints).toEqual({ resolved: 10, unresolved: 2, total: 12 });
    expect(report.coverage.topics).toEqual({ resolved: 5, unresolved: 1, total: 6 });
    expect(report.coverage.tables).toEqual({ resolved: 8, unresolved: 0, total: 8 });
  });

  it("counts confidence levels correctly", () => {
    const report = buildExtractionReport(makeReportInputs());
    expect(report.confidence_counts).toEqual({ high: 3, medium: 2, low: 1 });
  });

  it("includes unresolved items", () => {
    const report = buildExtractionReport(makeReportInputs());
    expect(report.unresolved).toHaveLength(2);
    expect(report.unresolved[0].stage).toBe("openapi");
    expect(report.unresolved[1].type).toBe("unresolvable-topic");
  });

  it("includes requires_human items", () => {
    const report = buildExtractionReport(makeReportInputs());
    expect(report.requires_human).toHaveLength(2);
    expect(report.requires_human[0].field).toBe("owner");
    expect(report.requires_human[0].category).toBe("non-derivable");
  });

  it("handles zero coverage gracefully", () => {
    const report = buildExtractionReport(
      makeReportInputs({
        endpointsResolved: 0,
        endpointsUnresolved: 0,
        topicsResolved: 0,
        topicsUnresolved: 0,
        tablesResolved: 0,
        tablesUnresolved: 0,
      }),
    );
    expect(report.coverage.endpoints.total).toBe(0);
    expect(report.coverage.topics.total).toBe(0);
    expect(report.coverage.tables.total).toBe(0);
  });

  it("handles empty confidence entries", () => {
    const report = buildExtractionReport(makeReportInputs({ confidenceEntries: [] }));
    expect(report.confidence_counts).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it("handles all-low-confidence entries", () => {
    const report = buildExtractionReport(
      makeReportInputs({ confidenceEntries: ["low", "low", "low"] }),
    );
    expect(report.confidence_counts).toEqual({ high: 0, medium: 0, low: 3 });
  });
});

describe("core/extract/report — serializeReport()", () => {
  it("produces valid JSON", () => {
    const report = buildExtractionReport(makeReportInputs());
    const json = serializeReport(report);
    const parsed = JSON.parse(json) as ExtractionReport;
    expect(parsed.strategies).toEqual(report.strategies);
    expect(parsed.coverage).toEqual(report.coverage);
  });

  it("uses pretty-print format (2 space indent)", () => {
    const report = buildExtractionReport(makeReportInputs());
    const json = serializeReport(report);
    // Pretty-printed JSON has newlines and indentation
    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });
});
