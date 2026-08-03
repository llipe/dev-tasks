/**
 * Unit tests for core/extract/component.ts.
 * Tests: field-category routing, provenance assembly, field_hashes computation, reconcile integration.
 */

import { describe, it, expect } from "vitest";
import {
  FIELD_CATEGORIES,
  deriveFields,
  applyInference,
  applyPrompted,
  computeFieldHashes,
  assembleProvenance,
  deriveComponent,
  reconcileField,
  reconcileComponent,
  getMissingRequiredFields,
  type ExtractionInputs,
  type InferenceResult,
  type PromptedValues,
  type ConfirmationResult,
  type ComponentManifest,
} from "#core/extract/component.js";
import { hashContent } from "#core/distribution/hash.js";

// --- Helpers ---

function makeInputs(overrides: Partial<ExtractionInputs> = {}): ExtractionInputs {
  return {
    detection: {
      stack: ["node", "typescript", "express"],
      http: {
        framework: "express",
        openapi_strategy: "route3",
        strategy_counts: { route1: 0, route2: 0, route3: 5 },
        evidence: [],
      },
      orm: { kind: "prisma", schema_path: "prisma/schema.prisma" },
      messaging: null,
      type_hint: "node-express-prisma",
    },
    schemaResult: {
      tables: ["users", "orders", "products"],
      filePath: "docs/schema.md",
    },
    openApiResult: {
      endpoints: [
        { method: "GET", path: "/users" },
        { method: "POST", path: "/users" },
        { method: "GET", path: "/orders" },
      ],
      filePath: "docs/openapi.yaml",
    },
    asyncApiResult: {
      topics: [
        { name: "order-events", direction: "consumes" },
        { name: "notification-events", direction: "provides" },
      ],
      filePath: "docs/asyncapi.yaml",
    },
    repoName: "my-service",
    repoSha: "abc123def456",
    extractorVersion: "0.1.0",
    ...overrides,
  };
}

function makePrompted(overrides: Partial<PromptedValues> = {}): PromptedValues {
  return {
    owner: "platform-team",
    domain: "commerce",
    criticality: "high",
    lifecycle: "production",
    ...overrides,
  };
}

function makeConfirmed(overrides: Partial<ConfirmationResult> = {}): ConfirmationResult {
  return {
    description: true,
    aliases: true,
    subdomain: true,
    consumesCriticality: true,
    ...overrides,
  };
}

function makeInference(overrides: Partial<InferenceResult> = {}): InferenceResult {
  return {
    description: "A commerce service handling orders and payments",
    aliases: ["order-svc", "commerce-api"],
    subdomain: "order-management",
    consumesCriticality: { "order-events": "critical" },
    ...overrides,
  };
}

// --- Tests ---

describe("core/extract/component — FIELD_CATEGORIES", () => {
  it("classifies derivable fields correctly", () => {
    const derivable = [
      "name",
      "stack",
      "type",
      "provides",
      "datastores",
      "paths",
      "docs",
      "consumes",
    ];
    for (const field of derivable) {
      expect(FIELD_CATEGORIES[field]).toBe("derivable");
    }
  });

  it("classifies inferable fields correctly", () => {
    const inferable = ["description", "aliases", "subdomain"];
    for (const field of inferable) {
      expect(FIELD_CATEGORIES[field]).toBe("inferable");
    }
  });

  it("classifies non-derivable fields correctly", () => {
    const nonDerivable = ["owner", "domain", "criticality", "lifecycle"];
    for (const field of nonDerivable) {
      expect(FIELD_CATEGORIES[field]).toBe("non-derivable");
    }
  });
});

describe("core/extract/component — deriveFields()", () => {
  it("derives stack from detection result", () => {
    const inputs = makeInputs();
    const result = deriveFields(inputs);
    expect(result.stack).toEqual(["node", "typescript", "express"]);
  });

  it("derives type from detection type_hint", () => {
    const inputs = makeInputs();
    const result = deriveFields(inputs);
    expect(result.type).toBe("node-express-prisma");
  });

  it("derives name from repoName", () => {
    const inputs = makeInputs({ repoName: "payment-gateway" });
    const result = deriveFields(inputs);
    expect(result.name).toBe("payment-gateway");
  });

  it("derives provides from OpenAPI endpoints", () => {
    const inputs = makeInputs();
    const result = deriveFields(inputs);
    expect(result.provides).toHaveLength(3);
    expect(result.provides![0]).toEqual({ path: "/users", method: "GET" });
  });

  it("derives datastores from schema tables", () => {
    const inputs = makeInputs();
    const result = deriveFields(inputs);
    expect(result.datastores).toEqual(["users", "orders", "products"]);
  });

  it("derives docs references from file paths", () => {
    const inputs = makeInputs();
    const result = deriveFields(inputs);
    expect(result.docs!.schema).toBe("docs/schema.md");
    expect(result.docs!.openapi).toBe("docs/openapi.yaml");
    expect(result.docs!.asyncapi).toBe("docs/asyncapi.yaml");
  });

  it("derives consumes from asyncapi consumes topics", () => {
    const inputs = makeInputs();
    const result = deriveFields(inputs);
    expect(result.consumes).toHaveLength(1);
    expect(result.consumes![0]).toEqual({ service: "order-events", protocol: "kafka" });
  });

  it("handles null detection gracefully", () => {
    const inputs = makeInputs({ detection: null });
    const result = deriveFields(inputs);
    expect(result.stack).toEqual([]);
    expect(result.type).toBe("unknown");
  });

  it("handles null extraction results gracefully", () => {
    const inputs = makeInputs({
      schemaResult: null,
      openApiResult: null,
      asyncApiResult: null,
    });
    const result = deriveFields(inputs);
    expect(result.provides).toEqual([]);
    expect(result.datastores).toEqual([]);
    expect(result.consumes).toEqual([]);
    expect(result.docs).toEqual({});
  });
});

describe("core/extract/component — applyInference()", () => {
  it("applies confirmed inferences", () => {
    const partial = deriveFields(makeInputs());
    const inference = makeInference();
    const confirmed = makeConfirmed();
    const result = applyInference(partial, inference, confirmed);

    expect(result.description).toBe("A commerce service handling orders and payments");
    expect(result.aliases).toEqual(["order-svc", "commerce-api"]);
    expect(result.subdomain).toBe("order-management");
  });

  it("does NOT apply unconfirmed description", () => {
    const partial = deriveFields(makeInputs());
    const inference = makeInference();
    const confirmed = makeConfirmed({ description: false });
    const result = applyInference(partial, inference, confirmed);

    expect(result.description).toBeUndefined();
  });

  it("does NOT apply unconfirmed aliases", () => {
    const partial = deriveFields(makeInputs());
    const inference = makeInference();
    const confirmed = makeConfirmed({ aliases: false });
    const result = applyInference(partial, inference, confirmed);

    expect(result.aliases).toBeUndefined();
  });

  it("does NOT apply unconfirmed subdomain", () => {
    const partial = deriveFields(makeInputs());
    const inference = makeInference();
    const confirmed = makeConfirmed({ subdomain: false });
    const result = applyInference(partial, inference, confirmed);

    expect(result.subdomain).toBeUndefined();
  });

  it("returns partial unchanged when inference is null", () => {
    const partial = deriveFields(makeInputs());
    const result = applyInference(partial, null, makeConfirmed());
    expect(result).toEqual(partial);
  });
});

describe("core/extract/component — applyPrompted()", () => {
  it("sets non-derivable fields from prompted values", () => {
    const partial = deriveFields(makeInputs());
    const prompted = makePrompted();
    const result = applyPrompted(partial, prompted);

    expect(result.owner).toBe("platform-team");
    expect(result.domain).toBe("commerce");
    expect(result.criticality).toBe("high");
    expect(result.lifecycle).toBe("production");
  });

  it("sets empty strings for unanswered prompts", () => {
    const partial = deriveFields(makeInputs());
    const prompted = makePrompted({ owner: "", domain: "", criticality: "", lifecycle: "" });
    const result = applyPrompted(partial, prompted);

    expect(result.owner).toBe("");
    expect(result.domain).toBe("");
    expect(result.criticality).toBe("");
    expect(result.lifecycle).toBe("");
  });
});

describe("core/extract/component — computeFieldHashes()", () => {
  it("computes SHA-256 hash for each non-empty field", () => {
    const component: Partial<ComponentManifest> = {
      name: "my-service",
      stack: ["node"],
      type: "api",
    };
    const hashes = computeFieldHashes(component);

    expect(hashes.name).toBe(hashContent(JSON.stringify("my-service")));
    expect(hashes.stack).toBe(hashContent(JSON.stringify(["node"])));
    expect(hashes.type).toBe(hashContent(JSON.stringify("api")));
  });

  it("skips _provenance field", () => {
    const component = {
      name: "my-service",
      _provenance: { extracted_at: "now" },
    } as unknown as Partial<ComponentManifest>;
    const hashes = computeFieldHashes(component);

    expect(hashes._provenance).toBeUndefined();
    expect(hashes.name).toBeDefined();
  });

  it("skips undefined and empty string values", () => {
    const component: Partial<ComponentManifest> = {
      name: "svc",
      description: "",
      owner: undefined as unknown as string,
    };
    const hashes = computeFieldHashes(component);

    expect(hashes.name).toBeDefined();
    expect(hashes.description).toBeUndefined();
    expect(hashes.owner).toBeUndefined();
  });

  it("produces deterministic hashes for same input", () => {
    const component: Partial<ComponentManifest> = { name: "test", stack: ["a", "b"] };
    const hashes1 = computeFieldHashes(component);
    const hashes2 = computeFieldHashes(component);
    expect(hashes1).toEqual(hashes2);
  });
});

describe("core/extract/component — assembleProvenance()", () => {
  it("includes extracted_at, extractor, repo_sha, detector", () => {
    const inputs = makeInputs();
    const component = deriveFields(inputs);
    const provenance = assembleProvenance(inputs, component, null, makeConfirmed(), makePrompted());

    expect(provenance.extracted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(provenance.extractor).toBe("0.1.0");
    expect(provenance.repo_sha).toBe("abc123def456");
    expect(provenance.detector).toEqual(inputs.detection);
  });

  it("includes field_hashes for all derived fields", () => {
    const inputs = makeInputs();
    const component = deriveFields(inputs);
    const provenance = assembleProvenance(inputs, component, null, makeConfirmed(), makePrompted());

    expect(provenance.field_hashes.name).toBeDefined();
    expect(provenance.field_hashes.stack).toBeDefined();
    expect(provenance.field_hashes.type).toBeDefined();
  });

  it("marks derivable fields as source: detected, confidence: high", () => {
    const inputs = makeInputs();
    const component = deriveFields(inputs);
    const provenance = assembleProvenance(inputs, component, null, makeConfirmed(), makePrompted());

    expect(provenance.fields.name).toEqual({ source: "detected", confidence: "high" });
    expect(provenance.fields.stack).toEqual({ source: "detected", confidence: "high" });
  });

  it("marks confirmed inferences with confirmed_by: human", () => {
    const inputs = makeInputs();
    const inference = makeInference();
    const confirmed = makeConfirmed();
    let component = deriveFields(inputs);
    component = applyInference(component, inference, confirmed);
    const provenance = assembleProvenance(inputs, component, inference, confirmed, makePrompted());

    expect(provenance.fields.description).toEqual({
      source: "inferred",
      confidence: "medium",
      confirmed_by: "human",
    });
    expect(provenance.fields.aliases).toEqual({
      source: "inferred",
      confidence: "medium",
      confirmed_by: "human",
    });
  });

  it("marks prompted fields as source: prompted, confidence: high", () => {
    const inputs = makeInputs();
    const component = applyPrompted(deriveFields(inputs), makePrompted());
    const provenance = assembleProvenance(inputs, component, null, makeConfirmed(), makePrompted());

    expect(provenance.fields.owner).toEqual({ source: "prompted", confidence: "high" });
    expect(provenance.fields.domain).toEqual({ source: "prompted", confidence: "high" });
  });

  it("does NOT include prompted fields when empty", () => {
    const inputs = makeInputs();
    const prompted = makePrompted({ owner: "", domain: "" });
    const component = applyPrompted(deriveFields(inputs), prompted);
    const provenance = assembleProvenance(inputs, component, null, makeConfirmed(), prompted);

    expect(provenance.fields.owner).toBeUndefined();
    expect(provenance.fields.domain).toBeUndefined();
  });
});

describe("core/extract/component — reconcileField()", () => {
  it("returns install when field does not exist (null localHash)", () => {
    expect(reconcileField(null, "origin", "new")).toBe("install");
  });

  it("returns skip when local equals new (already up to date)", () => {
    expect(reconcileField("abc", "origin", "abc")).toBe("skip");
  });

  it("returns overwrite when local equals origin but differs from new", () => {
    expect(reconcileField("origin", "origin", "new")).toBe("overwrite");
  });

  it("returns conflict when local differs from both origin and new", () => {
    expect(reconcileField("edited", "origin", "new")).toBe("conflict");
  });
});

describe("core/extract/component — reconcileComponent()", () => {
  it("reconciles all fields and returns action map", () => {
    const existingHashes = { name: "h1", stack: "h2", type: "h3" };
    const provenanceHashes = { name: "h1", stack: "h2", type: "h3" };
    const newHashes = { name: "h1", stack: "h2-new", type: "h3" };

    const actions = reconcileComponent(existingHashes, provenanceHashes, newHashes);

    expect(actions.name).toBe("skip"); // local == new
    expect(actions.stack).toBe("overwrite"); // local == origin, new differs
    expect(actions.type).toBe("skip"); // local == new
  });

  it("detects conflicts for user-edited fields", () => {
    const existingHashes = { name: "user-edited" };
    const provenanceHashes = { name: "original" };
    const newHashes = { name: "new-value" };

    const actions = reconcileComponent(existingHashes, provenanceHashes, newHashes);
    expect(actions.name).toBe("conflict");
  });

  it("installs new fields that don't exist on disk", () => {
    const existingHashes: Record<string, string> = {};
    const provenanceHashes: Record<string, string> = {};
    const newHashes = { newField: "hash" };

    const actions = reconcileComponent(existingHashes, provenanceHashes, newHashes);
    expect(actions.newField).toBe("install");
  });

  it("handles null existingFieldHashes (first extraction)", () => {
    const provenanceHashes = { name: "h1" };
    const newHashes = { name: "h1", stack: "h2" };

    const actions = reconcileComponent(null, provenanceHashes, newHashes);
    expect(actions.name).toBe("install");
    expect(actions.stack).toBe("install");
  });
});

describe("core/extract/component — getMissingRequiredFields()", () => {
  it("returns empty array when all required fields are present", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: null,
      prompted: makePrompted(),
      confirmed: makeConfirmed(),
    });
    expect(getMissingRequiredFields(component)).toEqual([]);
  });

  it("returns missing fields when prompted values are empty", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: null,
      prompted: makePrompted({ owner: "", lifecycle: "" }),
      confirmed: makeConfirmed(),
    });
    const missing = getMissingRequiredFields(component);
    expect(missing).toContain("owner");
    expect(missing).toContain("lifecycle");
    expect(missing).not.toContain("domain");
  });
});

describe("core/extract/component — deriveComponent() full pipeline", () => {
  it("assembles a complete ComponentManifest with all fields", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: makeInference(),
      prompted: makePrompted(),
      confirmed: makeConfirmed(),
    });

    expect(component.name).toBe("my-service");
    expect(component.stack).toEqual(["node", "typescript", "express"]);
    expect(component.type).toBe("node-express-prisma");
    expect(component.description).toBe("A commerce service handling orders and payments");
    expect(component.aliases).toEqual(["order-svc", "commerce-api"]);
    expect(component.owner).toBe("platform-team");
    expect(component.domain).toBe("commerce");
    expect(component.subdomain).toBe("order-management");
    expect(component.criticality).toBe("high");
    expect(component.lifecycle).toBe("production");
    expect(component.provides).toHaveLength(3);
    expect(component.datastores).toEqual(["users", "orders", "products"]);
    expect(component._provenance).toBeDefined();
    expect(component._provenance.field_hashes).toBeDefined();
  });

  it("defaults inferable fields to empty when no inference provided", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: null,
      prompted: makePrompted(),
      confirmed: makeConfirmed(),
    });

    expect(component.description).toBe("");
    expect(component.aliases).toEqual([]);
    expect(component.subdomain).toBe("");
  });

  it("does NOT persist unconfirmed aliases", () => {
    const component = deriveComponent({
      inputs: makeInputs(),
      inference: makeInference(),
      prompted: makePrompted(),
      confirmed: makeConfirmed({ aliases: false }),
    });

    expect(component.aliases).toEqual([]);
  });
});
