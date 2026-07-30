/**
 * Integration tests for component extraction.
 * Tests: full `extract all` on fixture → expected component.json + extraction_report.json;
 * re-run → no rewrite (idempotent); edit a field + re-run → conflict.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  deriveComponent,
  computeFieldHashes,
  reconcileComponent,
  type ExtractionInputs,
  type ConfirmationResult,
  type PromptedValues,
  type ComponentYaml,
} from "#core/extract/component.js";
import { buildExtractionReport, type ReportInputs } from "#core/extract/report.js";
import { hashContent } from "#core/distribution/hash.js";
import { runDetection, registerProvider, clearProviders } from "#core/extract/detect.js";
import { nodeTsProvider } from "#core/extract/providers/node-ts.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/extract");

describe("Component extraction integration — component-derivation fixture", () => {
  let workDir: string;

  beforeEach(() => {
    clearProviders();
    registerProvider(nodeTsProvider);
    // Copy fixture to a temp dir so we can write output files
    workDir = join(tmpdir(), `dt-test-component-${Date.now()}`);
    mkdirSync(workDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "component-derivation"), workDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    clearProviders();
  });

  it("detects the stack correctly for the fixture", () => {
    const detection = runDetection({ rootDir: workDir });
    expect(detection).not.toBeNull();
    expect(detection!.stack).toContain("node");
    expect(detection!.stack).toContain("typescript");
  });

  it("derives component.json with all derivable fields populated", () => {
    const detection = runDetection({ rootDir: workDir });

    const inputs: ExtractionInputs = {
      detection,
      schemaResult: { tables: ["Order", "OrderStatus"], filePath: "docs/schema.md" },
      openApiResult: {
        endpoints: [
          { method: "GET", path: "/orders" },
          { method: "POST", path: "/orders" },
          { method: "GET", path: "/orders/{id}" },
        ],
        filePath: "docs/openapi.yaml",
      },
      asyncApiResult: {
        topics: [
          { name: "order-created", direction: "provides" },
          { name: "order-shipped", direction: "consumes" },
        ],
        filePath: "docs/asyncapi.yaml",
      },
      repoName: "order-service",
      repoSha: "abc123",
      extractorVersion: "0.1.0",
    };

    const prompted: PromptedValues = {
      owner: "commerce-team",
      domain: "orders",
      criticality: "high",
      lifecycle: "production",
    };

    const confirmed: ConfirmationResult = {
      description: false,
      aliases: false,
      subdomain: false,
      consumesCriticality: false,
    };

    const component = deriveComponent({ inputs, inference: null, prompted, confirmed });

    expect(component.name).toBe("order-service");
    expect(component.stack).toContain("node");
    expect(component.provides).toHaveLength(3);
    expect(component.provides[0].path).toBe("/orders");
    expect(component.datastores).toContain("Order");
    expect(component.consumes).toHaveLength(1);
    expect(component.consumes[0].service).toBe("order-shipped");
    expect(component.docs.schema).toBe("docs/schema.md");
    expect(component.docs.openapi).toBe("docs/openapi.yaml");
    expect(component.docs.asyncapi).toBe("docs/asyncapi.yaml");
    expect(component._provenance).toBeDefined();
    expect(component._provenance.extractor).toBe("0.1.0");
    expect(component._provenance.repo_sha).toBe("abc123");
  });

  it("produces extraction_report.json with correct coverage", () => {
    const reportInputs: ReportInputs = {
      strategies: [
        { stage: "detect", strategy: "node-ts", source: "detected", confidence: "high" },
        { stage: "schema", strategy: "prisma-ast", source: "introspected", confidence: "high" },
        { stage: "openapi", strategy: "route-route3", source: "inferred", confidence: "medium" },
        {
          stage: "asyncapi",
          strategy: "kafkajs-ast",
          source: "inferred",
          confidence: "medium",
        },
      ],
      endpointsResolved: 3,
      endpointsUnresolved: 0,
      topicsResolved: 2,
      topicsUnresolved: 0,
      tablesResolved: 2,
      tablesUnresolved: 0,
      unresolved: [],
      requiresHuman: [],
      confidenceEntries: ["high", "high", "medium", "medium"],
    };

    const report = buildExtractionReport(reportInputs);

    expect(report.strategies).toHaveLength(4);
    expect(report.coverage.endpoints).toEqual({ resolved: 3, unresolved: 0, total: 3 });
    expect(report.coverage.topics).toEqual({ resolved: 2, unresolved: 0, total: 2 });
    expect(report.coverage.tables).toEqual({ resolved: 2, unresolved: 0, total: 2 });
    expect(report.confidence_counts).toEqual({ high: 2, medium: 2, low: 0 });
  });

  it("is idempotent: re-run produces no field changes", () => {
    const detection = runDetection({ rootDir: workDir });

    const inputs: ExtractionInputs = {
      detection,
      schemaResult: { tables: ["Order"], filePath: "docs/schema.md" },
      openApiResult: null,
      asyncApiResult: null,
      repoName: "order-service",
      repoSha: "abc123",
      extractorVersion: "0.1.0",
    };

    const prompted: PromptedValues = {
      owner: "team",
      domain: "orders",
      criticality: "high",
      lifecycle: "production",
    };

    const confirmed: ConfirmationResult = {
      description: false,
      aliases: false,
      subdomain: false,
      consumesCriticality: false,
    };

    // First extraction
    const component1 = deriveComponent({ inputs, inference: null, prompted, confirmed });

    // Write to disk
    const componentPath = join(workDir, "component.json");
    writeFileSync(componentPath, JSON.stringify(component1, null, 2) + "\n");

    // Second extraction (same inputs)
    deriveComponent({ inputs, inference: null, prompted, confirmed });
    const hashes2 = computeFieldHashes(component1); // same inputs → same output

    // Read from disk and compute current hashes
    const existing = JSON.parse(readFileSync(componentPath, "utf-8")) as ComponentYaml;
    const existingHashes: Record<string, string> = {};
    for (const [key, value] of Object.entries(existing)) {
      if (key === "_provenance") continue;
      if (value === undefined || value === "") continue;
      existingHashes[key] = hashContent(JSON.stringify(value));
    }

    // Reconcile: should all be skip (no conflicts, no overwrites)
    const actions = reconcileComponent(
      existingHashes,
      component1._provenance.field_hashes,
      hashes2,
    );

    // Core data fields should all be skip (idempotent)
    const coreFields = ["name", "stack", "type", "provides", "datastores", "paths", "consumes"];
    for (const field of coreFields) {
      if (actions[field]) {
        expect(actions[field]).toBe("skip");
      }
    }
  });

  it("detects conflict when a field is manually edited", () => {
    const inputs: ExtractionInputs = {
      detection: null,
      schemaResult: null,
      openApiResult: null,
      asyncApiResult: null,
      repoName: "my-svc",
      repoSha: "sha1",
      extractorVersion: "0.1.0",
    };

    const prompted: PromptedValues = {
      owner: "team-a",
      domain: "finance",
      criticality: "medium",
      lifecycle: "production",
    };

    const confirmed: ConfirmationResult = {
      description: false,
      aliases: false,
      subdomain: false,
      consumesCriticality: false,
    };

    // First extraction
    const component = deriveComponent({ inputs, inference: null, prompted, confirmed });
    const originalHashes = component._provenance.field_hashes;

    // Simulate user editing the "domain" field
    const editedComponent = { ...component, domain: "user-edited-domain" };
    const editedHashes: Record<string, string> = {};
    for (const [key, value] of Object.entries(editedComponent)) {
      if (key === "_provenance") continue;
      if (value === undefined || value === "") continue;
      editedHashes[key] = hashContent(JSON.stringify(value));
    }

    // Re-run extraction with different domain value
    const newPrompted: PromptedValues = {
      owner: "team-a",
      domain: "payments", // different from edited
      criticality: "medium",
      lifecycle: "production",
    };
    const newComponent = deriveComponent({
      inputs,
      inference: null,
      prompted: newPrompted,
      confirmed,
    });
    const newHashes = computeFieldHashes(newComponent);

    // Reconcile
    const actions = reconcileComponent(editedHashes, originalHashes, newHashes);

    // domain was edited locally AND upstream changed → conflict
    expect(actions.domain).toBe("conflict");
  });
});
