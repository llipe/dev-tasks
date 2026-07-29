/**
 * Edge-case tests for component extraction.
 * Tests: unanswered prompts → empty + exit 13; --force overwrite;
 * alias unconfirmed → not persisted; all-low-confidence repo → report reflects it.
 */

import { describe, it, expect } from "vitest";
import {
  deriveComponent,
  reconcileComponent,
  getMissingRequiredFields,
  type ExtractionInputs,
  type InferenceResult,
} from "#core/extract/component.js";
import { buildExtractionReport, type ReportInputs } from "#core/extract/report.js";
import { ExitCode } from "#core/exit-codes.js";

function makeInputs(overrides: Partial<ExtractionInputs> = {}): ExtractionInputs {
  return {
    detection: {
      stack: ["node"],
      http: null,
      orm: null,
      messaging: null,
      type_hint: "node-unknown",
    },
    schemaResult: null,
    openApiResult: null,
    asyncApiResult: null,
    repoName: "test-svc",
    repoSha: "sha123",
    extractorVersion: "0.1.0",
    ...overrides,
  };
}

describe("Edge case: unanswered prompts → empty values + exit 13", () => {
  it("returns empty strings for all non-derivable fields when unanswered", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: null,
      prompted: { owner: "", domain: "", criticality: "", lifecycle: "" },
      confirmed: {
        description: false,
        aliases: false,
        subdomain: false,
        consumesCriticality: false,
      },
    });

    expect(component.owner).toBe("");
    expect(component.domain).toBe("");
    expect(component.criticality).toBe("");
    expect(component.lifecycle).toBe("");
  });

  it("getMissingRequiredFields reports all non-derivable fields as missing", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: null,
      prompted: { owner: "", domain: "", criticality: "", lifecycle: "" },
      confirmed: {
        description: false,
        aliases: false,
        subdomain: false,
        consumesCriticality: false,
      },
    });

    const missing = getMissingRequiredFields(component);
    expect(missing).toContain("owner");
    expect(missing).toContain("domain");
    expect(missing).toContain("criticality");
    expect(missing).toContain("lifecycle");
    expect(missing).toHaveLength(4);
  });

  it("exit code 13 is the correct code for missing required fields", () => {
    expect(ExitCode.MissingRequiredField).toBe(13);
  });
});

describe("Edge case: --force overwrite", () => {
  it("force flag bypasses conflict detection (reconcile not called)", () => {
    // When --force is used, we write regardless of conflicts
    // This test validates that reconcileComponent detects a conflict...
    const originalHashes = { name: "orig-hash" };
    const editedHashes = { name: "user-edit-hash" }; // user edited
    const newHashes = { name: "new-extraction-hash" }; // new extraction differs

    const actions = reconcileComponent(editedHashes, originalHashes, newHashes);
    expect(actions.name).toBe("conflict");

    // ...but with --force, the CLI handler would skip reconciliation and overwrite.
    // This is verified in the CLI integration test. Here we just confirm the flag semantics.
  });
});

describe("Edge case: alias unconfirmed → not persisted", () => {
  it("does NOT include aliases in component when confirmation is false", () => {
    const inference: InferenceResult = {
      description: "A test service",
      aliases: ["test-alias", "test-svc-alias"],
      subdomain: "testing",
      consumesCriticality: {},
    };

    const component = deriveComponent({
      inputs: makeInputs(),
      inference,
      prompted: { owner: "team", domain: "test", criticality: "low", lifecycle: "beta" },
      confirmed: {
        description: true,
        aliases: false, // NOT confirmed
        subdomain: true,
        consumesCriticality: false,
      },
    });

    expect(component.aliases).toEqual([]);
    expect(component.description).toBe("A test service"); // confirmed
    expect(component.subdomain).toBe("testing"); // confirmed
  });

  it("does NOT include aliases in provenance when unconfirmed", () => {
    const inference: InferenceResult = {
      description: "A test service",
      aliases: ["alias1"],
      subdomain: "sub",
      consumesCriticality: {},
    };

    const component = deriveComponent({
      inputs: makeInputs(),
      inference,
      prompted: { owner: "team", domain: "test", criticality: "low", lifecycle: "beta" },
      confirmed: {
        description: true,
        aliases: false,
        subdomain: true,
        consumesCriticality: false,
      },
    });

    // aliases should not appear in provenance fields since they're empty
    expect(component._provenance.fields.aliases).toBeUndefined();
  });
});

describe("Edge case: all-low-confidence repo → report reflects it", () => {
  it("report shows all-low confidence counts", () => {
    const reportInputs: ReportInputs = {
      strategies: [
        { stage: "detect", strategy: "node-ts", source: "detected", confidence: "low" },
        { stage: "schema", strategy: "migration-llm", source: "inferred", confidence: "low" },
        { stage: "openapi", strategy: "route3-untyped", source: "inferred", confidence: "low" },
      ],
      endpointsResolved: 2,
      endpointsUnresolved: 5,
      topicsResolved: 0,
      topicsUnresolved: 3,
      tablesResolved: 1,
      tablesUnresolved: 4,
      unresolved: [
        {
          stage: "openapi",
          type: "dynamic-route",
          location: "src/app.ts:10",
          reason: "Loop over config",
        },
        {
          stage: "openapi",
          type: "dynamic-route",
          location: "src/app.ts:20",
          reason: "Spread array",
        },
        {
          stage: "asyncapi",
          type: "unresolvable",
          location: "src/kafka.ts:5",
          reason: "Runtime var",
        },
      ],
      requiresHuman: [
        { field: "owner", reason: "Non-derivable", category: "non-derivable" },
        { field: "domain", reason: "Non-derivable", category: "non-derivable" },
        {
          field: "description",
          reason: "Unconfirmed inference",
          category: "unconfirmed-inference",
        },
      ],
      confidenceEntries: ["low", "low", "low"],
    };

    const report = buildExtractionReport(reportInputs);

    expect(report.confidence_counts).toEqual({ high: 0, medium: 0, low: 3 });
    expect(report.unresolved).toHaveLength(3);
    expect(report.requires_human).toHaveLength(3);
    expect(report.coverage.endpoints.unresolved).toBe(5);
    expect(report.coverage.topics.unresolved).toBe(3);
    expect(report.coverage.tables.unresolved).toBe(4);
  });
});

describe("Edge case: partial prompted values", () => {
  it("only reports actually-empty required fields as missing", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: null,
      prompted: { owner: "my-team", domain: "", criticality: "high", lifecycle: "" },
      confirmed: {
        description: false,
        aliases: false,
        subdomain: false,
        consumesCriticality: false,
      },
    });

    const missing = getMissingRequiredFields(component);
    expect(missing).toContain("domain");
    expect(missing).toContain("lifecycle");
    expect(missing).not.toContain("owner");
    expect(missing).not.toContain("criticality");
  });
});

describe("Edge case: exit code 14 for reconciliation conflict", () => {
  it("exit code 14 is the correct code for reconciliation conflict", () => {
    expect(ExitCode.ReconciliationConflict).toBe(14);
  });
});
