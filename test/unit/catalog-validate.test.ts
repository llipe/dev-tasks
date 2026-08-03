/**
 * Unit tests for core/catalog/validate.ts — V01-V19 checks.
 * Each check tested in isolation with targeted fixtures.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { catalogValidate } from "#core/catalog/validate.js";
import { checkV02, checkV03 } from "#core/catalog/checks/v02-v03-identity.js";
import { checkV04 } from "#core/catalog/checks/v04-referential-integrity.js";
import { checkV05 } from "#core/catalog/checks/v05-domain-existence.js";
import { checkV08, checkV09, checkV10 } from "#core/catalog/checks/v08-v10-contracts.js";
import { checkV12 } from "#core/catalog/checks/v12-cycles.js";
import { checkV13 } from "#core/catalog/checks/v13-orphan-contracts.js";
import { checkV14, checkV15 } from "#core/catalog/checks/v14-v15-lifecycle.js";
import { checkV16 } from "#core/catalog/checks/v16-deprecated-consumers.js";
import { checkV17 } from "#core/catalog/checks/v17-low-confidence.js";
import { checkV18 } from "#core/catalog/checks/v18-low-payload.js";
import { checkV19 } from "#core/catalog/checks/v19-domain-membership.js";
import { checkV01WithDir } from "#core/catalog/checks/v01-schema.js";
import { checkV11WithDir } from "#core/catalog/checks/v11-manual-fields.js";
import { checkV06WithDir, checkV07WithDir } from "#core/catalog/checks/v06-v07-paths.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

const DEFAULT_OPTS = { strict: false };

/** Minimal valid index for testing */
function makeIndex(overrides: Partial<CatalogIndex> = {}): CatalogIndex {
  return {
    generated_at: "2026-01-01T00:00:00Z",
    generator: "test@1.0.0",
    components: [],
    contracts: {},
    domains: [],
    flows: [],
    extraction_quality: { total: { high: 0, medium: 0, low: 0 }, per_component: [] },
    errors: [],
    ...overrides,
  };
}

function makeComponent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    description: `${id} description`,
    repo: `https://github.com/acme/${id}`,
    type: "service",
    domain: "test",
    owner: "team",
    criticality: "tier-2",
    lifecycle: "production",
    stack: ["node"],
    aliases: [],
    provides: [],
    consumes: [],
    datastores: [],
    origin_sha: "abc123",
    ...overrides,
  };
}

describe("V02 — duplicate component id", () => {
  it("passes with unique ids", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a"), makeComponent("svc-b")] as CatalogIndex["components"],
    });
    const result = checkV02(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails with duplicate ids", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", { repo: "repo1" }),
        makeComponent("svc-a", { repo: "repo2" }),
      ] as CatalogIndex["components"],
    });
    const result = checkV02(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].entity).toBe("svc-a");
  });
});

describe("V03 — duplicate provides[].id within component", () => {
  it("passes with unique provides ids", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [
            { id: "api-a", kind: "openapi", source: "introspected" },
            { id: "api-b", kind: "openapi", source: "introspected" },
          ],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV03(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails with duplicate provides ids", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [
            { id: "api-a", kind: "openapi", source: "introspected" },
            { id: "api-a", kind: "asyncapi", source: "inferred" },
          ],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV03(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.violations[0].entity).toBe("svc-a");
  });
});

describe("V04 — referential integrity", () => {
  it("passes when all consumes resolve", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV04(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails when consumes references non-existent contract", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "api-x", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV04(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.violations[0].entity).toBe("svc-b");
    expect(result.violations[0].message).toContain("api-x");
  });
});

describe("V05 — domain existence", () => {
  it("passes when all domains are declared", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a", { domain: "platform" })] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a"] }],
    });
    const result = checkV05(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails when component references undeclared domain", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a", { domain: "ghost" })] as CatalogIndex["components"],
      domains: [{ name: "platform", components: [] }],
    });
    const result = checkV05(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.violations[0].message).toContain("ghost");
  });
});

describe("V08 — provides[].kind enum", () => {
  it("passes with valid kinds", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV08(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails with invalid kind", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "soap", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV08(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("soap");
  });
});

describe("V09 — provides[].source enum", () => {
  it("passes with valid source", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV09(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails with invalid source", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "guessed" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV09(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("guessed");
  });
});

describe("V10 — consumes[].criticality enum", () => {
  it("passes with valid criticality", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV10(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails with invalid criticality", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          consumes: [{ contract: "api-a", criticality: "critical" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV10(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("critical");
  });
});

describe("V12 — undeclared cycles", () => {
  it("passes with no cycles", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV12(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("warns on undeclared cycle (default mode)", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV12(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.violations).toHaveLength(1);
  });

  it("errors on undeclared cycle under --strict", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV12(index, { strict: true });
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("passes when cycle is in allowed_cycles", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV12(index, {
      strict: false,
      allowedCycles: [["svc-a", "svc-b"]],
    });
    expect(result.passed).toBe(true);
  });
});

describe("V13 — orphan contracts", () => {
  it("passes when all provides have consumers", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV13(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("warns on provides with no consumers", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b"),
      ] as CatalogIndex["components"],
    });
    const result = checkV13(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.violations[0].message).toContain("api-a");
  });
});

describe("V14 — lifecycle enum", () => {
  it("passes with valid lifecycle", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", { lifecycle: "production" }),
      ] as CatalogIndex["components"],
    });
    const result = checkV14(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails with invalid lifecycle", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a", { lifecycle: "retired" })] as CatalogIndex["components"],
    });
    const result = checkV14(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("retired");
  });
});

describe("V15 — criticality enum", () => {
  it("passes with valid criticality", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a", { criticality: "tier-1" })] as CatalogIndex["components"],
    });
    const result = checkV15(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails with invalid criticality", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", { criticality: "critical" }),
      ] as CatalogIndex["components"],
    });
    const result = checkV15(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("critical");
  });
});

describe("V16 — deprecated lifecycle with active consumers", () => {
  it("passes when no deprecated components have consumers", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          lifecycle: "production",
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV16(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("warns when deprecated component has active consumers", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          lifecycle: "deprecated",
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV16(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.violations[0].entity).toBe("svc-b");
  });
});

describe("V17 — low-confidence component", () => {
  it("passes when low ratio ≤ 30%", () => {
    const index = makeIndex({
      extraction_quality: {
        total: { high: 7, medium: 2, low: 1 },
        per_component: [
          { component_id: "svc-a", counts: { high: 7, medium: 2, low: 1 }, unresolved: 0 },
        ],
      },
    });
    const result = checkV17(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("warns when >30% of fields are low", () => {
    const index = makeIndex({
      extraction_quality: {
        total: { high: 1, medium: 1, low: 3 },
        per_component: [
          { component_id: "svc-a", counts: { high: 1, medium: 1, low: 3 }, unresolved: 0 },
        ],
      },
    });
    const result = checkV17(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.violations[0].entity).toBe("svc-a");
  });
});

describe("V18 — low-payload contracts with consumers", () => {
  it("passes when no low-payload contracts have consumers", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [
            { id: "evt-a", kind: "asyncapi", source: "generated", payload_confidence: "high" },
          ],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "evt-a", criticality: "soft" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV18(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("warns when low-payload contract has consumers", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [
            { id: "evt-a", kind: "asyncapi", source: "partial", payload_confidence: "low" },
          ],
        }),
        makeComponent("svc-b", {
          consumes: [{ contract: "evt-a", criticality: "soft" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV18(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.violations[0].message).toContain("evt-a");
  });
});

describe("V19 — domain membership consistency", () => {
  it("passes when domain membership is consistent", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a", { domain: "platform" })] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a"] }],
    });
    const result = checkV19(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });

  it("fails when domains list references non-existent component", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a", { domain: "platform" })] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a", "ghost-svc"] }],
    });
    const result = checkV19(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("ghost-svc");
  });

  it("fails when component not listed in any domain", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", { domain: "platform" }),
        makeComponent("svc-b", { domain: "platform" }),
      ] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a"] }],
    });
    const result = checkV19(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.entity === "svc-b")).toBe(true);
  });

  it("fails when component domain doesn't match listing", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a", { domain: "payments" })] as CatalogIndex["components"],
      domains: [
        { name: "platform", components: ["svc-a"] },
        { name: "payments", components: [] },
      ],
    });
    const result = checkV19(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("payments");
    expect(result.violations[0].message).toContain("platform");
  });
});

describe("V01 — schema validation with catalogDir", () => {
  const tmpDir = join(tmpdir(), "dt-v01-test-" + Date.now());
  const componentsDir = join(tmpDir, "components");

  it("passes with valid component manifest", () => {
    mkdirSync(componentsDir, { recursive: true });
    const validManifest = {
      schemaVersion: "1.0.0",
      id: "svc-a",
      name: "Svc A",
      description: "A service",
      repo: "https://github.com/acme/svc-a",
      type: "service",
      domain: "test",
      owner: "team",
      criticality: "tier-2",
      lifecycle: "production",
      stack: ["node"],
      aliases: [],
      provides: [],
      consumes: [],
      datastores: [],
      docs: { architecture: "docs/arch.md", schema: "docs/schema.md" },
      paths: { source: ["src/"] },
      _provenance: {
        extracted_at: "2026-01-01T00:00:00Z",
        extractor: "1.0.0",
        repo_sha: "abc123",
        fields: {},
        field_hashes: {},
      },
    };
    writeFileSync(join(componentsDir, "svc-a.json"), JSON.stringify(validManifest));

    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    const result = checkV01WithDir(index, tmpDir);
    expect(result.passed).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails with invalid component manifest", () => {
    mkdirSync(componentsDir, { recursive: true });
    // Missing required fields
    const invalidManifest = { id: "svc-a", name: "Svc A" };
    writeFileSync(join(componentsDir, "svc-a.json"), JSON.stringify(invalidManifest));

    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    const result = checkV01WithDir(index, tmpDir);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("V11 — non-empty manual fields with catalogDir", () => {
  const tmpDir = join(tmpdir(), "dt-v11-test-" + Date.now());
  const componentsDir = join(tmpDir, "components");

  it("passes when manual fields are non-empty", () => {
    mkdirSync(componentsDir, { recursive: true });
    const manifest = {
      schemaVersion: "1.0.0",
      id: "svc-a",
      name: "Svc A",
      owner: "team-a",
      aliases: ["svc"],
      _provenance: {
        extracted_at: "2026-01-01T00:00:00Z",
        extractor: "1.0.0",
        repo_sha: "abc",
        fields: {
          owner: { source: "manual", confidence: "high" },
          aliases: { source: "manual", confidence: "high" },
        },
        field_hashes: {},
      },
    };
    writeFileSync(join(componentsDir, "svc-a.json"), JSON.stringify(manifest));

    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    const result = checkV11WithDir(index, tmpDir);
    expect(result.passed).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails when manual field is empty string", () => {
    mkdirSync(componentsDir, { recursive: true });
    const manifest = {
      schemaVersion: "1.0.0",
      id: "svc-a",
      name: "Svc A",
      owner: "",
      _provenance: {
        extracted_at: "2026-01-01T00:00:00Z",
        extractor: "1.0.0",
        repo_sha: "abc",
        fields: {
          owner: { source: "manual", confidence: "high" },
        },
        field_hashes: {},
      },
    };
    writeFileSync(join(componentsDir, "svc-a.json"), JSON.stringify(manifest));

    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    const result = checkV11WithDir(index, tmpDir);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.violations[0].message).toContain("owner");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("V06/V07 — docs and paths with catalogDir", () => {
  const tmpDir = join(tmpdir(), "dt-v0607-test-" + Date.now());
  const componentsDir = join(tmpDir, "components");

  it("V06 fails when docs.architecture is empty", () => {
    mkdirSync(componentsDir, { recursive: true });
    const manifest = { docs: { architecture: "", schema: "docs/schema.md" } };
    writeFileSync(join(componentsDir, "svc-a.json"), JSON.stringify(manifest));

    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    const result = checkV06WithDir(index, tmpDir);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("architecture");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("V07 fails when paths.source is empty array", () => {
    mkdirSync(componentsDir, { recursive: true });
    const manifest = { paths: { source: [] } };
    writeFileSync(join(componentsDir, "svc-a.json"), JSON.stringify(manifest));

    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    const result = checkV07WithDir(index, tmpDir);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("paths.source");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("catalogValidate — full orchestrator", () => {
  it("returns passed for a valid catalog", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          domain: "platform",
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("svc-b", {
          domain: "platform",
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a", "svc-b"] }],
      extraction_quality: {
        total: { high: 6, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
          { component_id: "svc-b", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });
    const report = catalogValidate(index, { strict: false });
    expect(report.passed).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it("returns failed with errors for V04 violation", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          domain: "platform",
          consumes: [{ contract: "ghost-api", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a"] }],
      extraction_quality: {
        total: { high: 3, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });
    const report = catalogValidate(index, { strict: false });
    expect(report.passed).toBe(false);
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it("exit logic: warnings do not cause failure", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          domain: "platform",
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a"] }],
      extraction_quality: {
        total: { high: 3, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });
    // V13 will warn (orphan contract) but not fail
    const report = catalogValidate(index, { strict: false });
    expect(report.passed).toBe(true);
    expect(report.warningCount).toBeGreaterThan(0);
  });
});

/* ─── Edge-Case Tests (sub-task 3.20) ──────────────────────────────── */

describe("Edge case: cycle with allowed_cycles", () => {
  it("three-node cycle is detected", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-c", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
        makeComponent("svc-c", {
          provides: [{ id: "api-c", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV12(index, { strict: false });
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain("cycle");
  });

  it("three-node cycle allowed via allowedCycles passes", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-c", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
        makeComponent("svc-c", {
          provides: [{ id: "api-c", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV12(index, {
      strict: false,
      allowedCycles: [["svc-a", "svc-b", "svc-c"]],
    });
    expect(result.passed).toBe(true);
  });

  it("partial allowed_cycles does not suppress an unmatched cycle", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    // Allow a different cycle (svc-x, svc-y) which doesn't match
    const result = checkV12(index, {
      strict: false,
      allowedCycles: [["svc-x", "svc-y"]],
    });
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
  });
});

describe("Edge case: deprecated with active consumers (V16)", () => {
  it("decommissioned component with consumers triggers warning", () => {
    const index = makeIndex({
      components: [
        makeComponent("old-svc", {
          lifecycle: "decommissioned",
          provides: [{ id: "old-api", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("consumer-a", {
          consumes: [{ contract: "old-api", criticality: "hard" }],
        }),
        makeComponent("consumer-b", {
          consumes: [{ contract: "old-api", criticality: "soft" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV16(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].message).toContain("decommissioned");
  });

  it("beta lifecycle with consumers does not trigger V16", () => {
    const index = makeIndex({
      components: [
        makeComponent("beta-svc", {
          lifecycle: "beta",
          provides: [{ id: "beta-api", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("consumer", {
          consumes: [{ contract: "beta-api", criticality: "soft" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV16(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });
});

describe("Edge case: contract with no consumers (V13)", () => {
  it("multiple orphan contracts reported individually", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          provides: [
            { id: "orphan-1", kind: "openapi", source: "introspected" },
            { id: "orphan-2", kind: "asyncapi", source: "generated" },
          ],
        }),
      ] as CatalogIndex["components"],
    });
    const result = checkV13(index, DEFAULT_OPTS);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].message).toContain("orphan-1");
    expect(result.violations[1].message).toContain("orphan-2");
  });

  it("component with no provides does not trigger V13", () => {
    const index = makeIndex({
      components: [makeComponent("no-provides")] as CatalogIndex["components"],
    });
    const result = checkV13(index, DEFAULT_OPTS);
    expect(result.passed).toBe(true);
  });
});

describe("Edge case: --strict promotes V12 to error in aggregation", () => {
  it("cycle under strict causes overall report failure", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          domain: "platform",
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          domain: "platform",
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a", "svc-b"] }],
      extraction_quality: {
        total: { high: 6, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
          { component_id: "svc-b", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });
    const report = catalogValidate(index, { strict: true });
    expect(report.passed).toBe(false);
    expect(report.errorCount).toBeGreaterThan(0);
    const v12 = report.checks.find((c) => c.check === "V12");
    expect(v12?.severity).toBe("error");
  });

  it("cycle under non-strict does NOT cause overall report failure", () => {
    const index = makeIndex({
      components: [
        makeComponent("svc-a", {
          domain: "platform",
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
        }),
        makeComponent("svc-b", {
          domain: "platform",
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
      domains: [{ name: "platform", components: ["svc-a", "svc-b"] }],
      extraction_quality: {
        total: { high: 6, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
          { component_id: "svc-b", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });
    const report = catalogValidate(index, { strict: false });
    expect(report.passed).toBe(true);
    expect(report.warningCount).toBeGreaterThan(0);
  });
});
