/**
 * Unit tests for core/catalog/build.ts.
 * Tests: inverted consumer index construction, extraction-quality tallying,
 * idempotency (no-write on no-change), deterministic YAML output.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  buildContractsMap,
  tallyExtractionQuality,
  serializeIndex,
  isIndexUnchanged,
  parseRegistry,
  generateIndex,
  catalogBuild,
} from "#core/catalog/build.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/catalog");

// Helper to create a minimal fetched manifest structure
function makeFetched(
  id: string,
  provides: Array<{ id: string; kind: string; source: string }>,
  consumes: Array<{ contract: string }>,
  fields: Record<string, { source: string; confidence: string }> = {},
  domain = "test",
) {
  return {
    entry: { id, repo: `/fake/${id}` },
    manifest: {
      schemaVersion: "1.0.0",
      id,
      name: id,
      description: `${id} description`,
      repo: `https://github.com/acme/${id}`,
      type: "service" as const,
      domain,
      owner: "team",
      criticality: "tier-2" as const,
      lifecycle: "production" as const,
      stack: ["node"],
      aliases: [],
      provides: provides.map((p) => ({ ...p, path: "openapi.yaml" })),
      consumes: consumes.map((c) => ({
        ...c,
        criticality: "hard" as const,
        source: "introspected" as const,
      })),
      datastores: [],
      docs: { architecture: "docs/arch.md", schema: "docs/schema.md" },
      paths: { source: ["src/"] },
      _provenance: {
        extracted_at: "2026-01-01T00:00:00Z",
        extractor: "0.6.7",
        repo_sha: "abc123",
        fields,
        field_hashes: {},
      },
    },
    origin_sha: "abc123",
  };
}

describe("buildContractsMap — inverted consumer index", () => {
  it("maps provided contracts to their consumers", () => {
    const manifests = [
      makeFetched("svc-a", [{ id: "api-a", kind: "openapi", source: "introspected" }], []),
      makeFetched("svc-b", [], [{ contract: "api-a" }]),
      makeFetched("svc-c", [], [{ contract: "api-a" }]),
    ];

    const contracts = buildContractsMap(manifests);

    expect(contracts["api-a"]).toBeDefined();
    expect(contracts["api-a"].provider).toBe("svc-a");
    expect(contracts["api-a"].kind).toBe("openapi");
    expect(contracts["api-a"].consumers).toEqual(["svc-b", "svc-c"]);
  });

  it("records unknown provider when contract not found in provides", () => {
    const manifests = [makeFetched("svc-x", [], [{ contract: "missing-api" }])];

    const contracts = buildContractsMap(manifests);

    expect(contracts["missing-api"]).toBeDefined();
    expect(contracts["missing-api"].provider).toBe("unknown");
    expect(contracts["missing-api"].consumers).toEqual(["svc-x"]);
  });

  it("deduplicates consumers", () => {
    const manifests = [
      makeFetched("svc-a", [{ id: "api-a", kind: "openapi", source: "introspected" }], []),
      makeFetched("svc-b", [], [{ contract: "api-a" }, { contract: "api-a" }]),
    ];

    const contracts = buildContractsMap(manifests);
    expect(contracts["api-a"].consumers).toEqual(["svc-b"]);
  });

  it("sorts consumers alphabetically for determinism", () => {
    const manifests = [
      makeFetched("svc-a", [{ id: "api-a", kind: "openapi", source: "introspected" }], []),
      makeFetched("svc-z", [], [{ contract: "api-a" }]),
      makeFetched("svc-m", [], [{ contract: "api-a" }]),
      makeFetched("svc-b", [], [{ contract: "api-a" }]),
    ];

    const contracts = buildContractsMap(manifests);
    expect(contracts["api-a"].consumers).toEqual(["svc-b", "svc-m", "svc-z"]);
  });
});

describe("tallyExtractionQuality", () => {
  it("counts high/medium/low fields correctly", () => {
    const manifests = [
      makeFetched("svc-a", [], [], {
        name: { source: "introspected", confidence: "high" },
        owner: { source: "manual", confidence: "high" },
        aliases: { source: "inferred", confidence: "medium" },
      }),
      makeFetched("svc-b", [], [], {
        name: { source: "introspected", confidence: "high" },
        owner: { source: "inferred", confidence: "low" },
      }),
    ];

    const quality = tallyExtractionQuality(manifests);

    expect(quality.total).toEqual({ high: 3, medium: 1, low: 1 });
    expect(quality.per_component).toHaveLength(2);

    const svcA = quality.per_component.find((c) => c.component_id === "svc-a");
    expect(svcA?.counts).toEqual({ high: 2, medium: 1, low: 0 });
    expect(svcA?.unresolved).toBe(0);
  });

  it("counts unresolved for unknown confidence values", () => {
    const manifests = [
      makeFetched("svc-a", [], [], {
        name: { source: "introspected", confidence: "unknown" as string },
      }),
    ];

    const quality = tallyExtractionQuality(manifests);
    expect(quality.per_component[0].unresolved).toBe(1);
  });

  it("sorts per_component alphabetically", () => {
    const manifests = [makeFetched("zebra", [], [], {}), makeFetched("alpha", [], [], {})];

    const quality = tallyExtractionQuality(manifests);
    expect(quality.per_component[0].component_id).toBe("alpha");
    expect(quality.per_component[1].component_id).toBe("zebra");
  });
});

describe("serializeIndex — deterministic YAML", () => {
  it("produces identical output on repeated calls with same input", () => {
    const manifests = [
      makeFetched("svc-b", [{ id: "api-b", kind: "openapi", source: "introspected" }], []),
      makeFetched(
        "svc-a",
        [{ id: "api-a", kind: "openapi", source: "introspected" }],
        [{ contract: "api-b" }],
      ),
    ];

    const index1 = generateIndex(manifests, "/fake/catalog", "2026-01-01T00:00:00Z");
    const index2 = generateIndex(manifests, "/fake/catalog", "2026-01-01T00:00:00Z");

    const yaml1 = serializeIndex(index1);
    const yaml2 = serializeIndex(index2);

    expect(yaml1).toBe(yaml2);
    expect(yaml1.length).toBeGreaterThan(0);
  });

  it("sorts components alphabetically by id", () => {
    const manifests = [
      makeFetched("z-service", [], []),
      makeFetched("a-service", [], []),
      makeFetched("m-service", [], []),
    ];

    const index = generateIndex(manifests, "/fake/catalog", "2026-01-01T00:00:00Z");
    expect(index.components[0].id).toBe("a-service");
    expect(index.components[1].id).toBe("m-service");
    expect(index.components[2].id).toBe("z-service");
  });
});

describe("isIndexUnchanged — idempotency", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `catalog-build-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false when file does not exist", () => {
    const result = isIndexUnchanged(join(tmpDir, "index.yaml"), "content");
    expect(result).toBe(false);
  });

  it("returns true when content is identical", () => {
    const indexPath = join(tmpDir, "index.yaml");
    writeFileSync(indexPath, "some content", "utf-8");
    expect(isIndexUnchanged(indexPath, "some content")).toBe(true);
  });

  it("returns false when content differs", () => {
    const indexPath = join(tmpDir, "index.yaml");
    writeFileSync(indexPath, "old content", "utf-8");
    expect(isIndexUnchanged(indexPath, "new content")).toBe(false);
  });
});

describe("parseRegistry", () => {
  it("parses a valid registry.yaml", () => {
    const registry = parseRegistry(join(FIXTURES_DIR, "registry.yaml"));
    expect(registry.entries.length).toBeGreaterThan(0);
    expect(registry.entries[0].id).toBe("payment-service");
    expect(registry.entries[0].repo).toBe("./repos/payment-service");
  });

  it("returns empty entries for an empty registry", () => {
    const registry = parseRegistry(join(FIXTURES_DIR, "registry-empty.yaml"));
    expect(registry.entries).toEqual([]);
  });
});

describe("catalogBuild — full integration (unit-level)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `catalog-build-full-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("builds index from fixture registry", async () => {
    const result = await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry.yaml"),
      catalogDir: join(tmpDir, "catalog"),
    });

    // Should have 20 components (broken-repo fails)
    expect(result.index.components.length).toBe(20);
    expect(result.errors.length).toBe(1); // broken-repo
    expect(result.written).toBe(true);

    // Index file should exist
    const indexPath = join(tmpDir, "catalog", "index.yaml");
    expect(existsSync(indexPath)).toBe(true);
  });

  it("is idempotent — no write on second run", async () => {
    const catalogDir = join(tmpDir, "catalog");

    // First run
    const result1 = await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry.yaml"),
      catalogDir,
    });
    expect(result1.written).toBe(true);

    // Second run (same input)
    const result2 = await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry.yaml"),
      catalogDir,
    });
    expect(result2.written).toBe(false);
  });

  it("detects duplicate ids and records error", async () => {
    const result = await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry-duplicates.yaml"),
      catalogDir: join(tmpDir, "catalog"),
    });

    const dupError = result.errors.find((e) => e.error.includes("Duplicate component id"));
    expect(dupError).toBeDefined();
  });

  it("generates empty index for empty registry", async () => {
    const result = await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry-empty.yaml"),
      catalogDir: join(tmpDir, "catalog"),
    });

    expect(result.index.components).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.written).toBe(true);
  });
});
