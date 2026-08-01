/**
 * Unit tests for core/catalog/validate-component.ts.
 * Schema accepts all valid fixtures; rejects each invalid fixture with the expected error.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import {
  validateArtifact,
  validateArtifactFile,
  validateComponentFile,
  resolveSchemaPath,
  type ArtifactKind,
} from "#core/catalog/validate-component.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/schemas");

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, relativePath), "utf-8"));
}

describe("resolveSchemaPath", () => {
  it("resolves all three schema files", () => {
    const kinds: ArtifactKind[] = ["component", "flow", "scope-output"];
    for (const kind of kinds) {
      const path = resolveSchemaPath(kind);
      expect(path).toMatch(/schemas\/.*\.schema\.json$/);
    }
  });
});

describe("validateArtifact — valid fixtures", () => {
  it("accepts a valid component.json", () => {
    const data = readJson("valid/component.json");
    const result = validateArtifact("component", data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid flow definition", () => {
    const data = readJson("valid/flow.json");
    const result = validateArtifact("flow", data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid scope-output", () => {
    const data = readJson("valid/scope-output.json");
    const result = validateArtifact("scope-output", data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("validateArtifactFile — valid fixtures (file-based)", () => {
  it("accepts component.json via file path", () => {
    const result = validateArtifactFile("component", join(FIXTURES_DIR, "valid/component.json"));
    expect(result.valid).toBe(true);
  });

  it("validateComponentFile convenience wrapper works", () => {
    const result = validateComponentFile(join(FIXTURES_DIR, "valid/component.json"));
    expect(result.valid).toBe(true);
  });
});

describe("validateArtifactFile — invalid component fixtures", () => {
  it("rejects bad id pattern", () => {
    const result = validateArtifactFile(
      "component",
      join(FIXTURES_DIR, "invalid/component-bad-id.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/id" && e.keyword === "pattern")).toBe(true);
  });

  it("rejects missing manual field (owner)", () => {
    const result = validateArtifactFile(
      "component",
      join(FIXTURES_DIR, "invalid/component-missing-manual-field.json"),
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.keyword === "required" && e.params.missingProperty === "owner"),
    ).toBe(true);
  });

  it("rejects empty manual field (owner: '')", () => {
    const result = validateArtifactFile(
      "component",
      join(FIXTURES_DIR, "invalid/component-empty-manual-field.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/owner")).toBe(true);
  });

  it("rejects wrong enum value for type", () => {
    const result = validateArtifactFile(
      "component",
      join(FIXTURES_DIR, "invalid/component-wrong-enum.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/type" && e.keyword === "enum")).toBe(true);
  });

  it("rejects unknown top-level key (additionalProperties)", () => {
    const result = validateArtifactFile(
      "component",
      join(FIXTURES_DIR, "invalid/component-unknown-key.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "additionalProperties")).toBe(true);
  });
});

describe("validateArtifactFile — invalid flow fixtures", () => {
  it("rejects bad id pattern", () => {
    const result = validateArtifactFile("flow", join(FIXTURES_DIR, "invalid/flow-bad-id.json"));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/id" && e.keyword === "pattern")).toBe(true);
  });

  it("rejects unknown top-level key", () => {
    const result = validateArtifactFile(
      "flow",
      join(FIXTURES_DIR, "invalid/flow-unknown-key.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "additionalProperties")).toBe(true);
  });
});

describe("validateArtifactFile — invalid scope-output fixtures", () => {
  it("rejects wrong enum value for confidence", () => {
    const result = validateArtifactFile(
      "scope-output",
      join(FIXTURES_DIR, "invalid/scope-output-bad-confidence.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/confidence" && e.keyword === "enum")).toBe(true);
  });

  it("rejects unknown top-level key", () => {
    const result = validateArtifactFile(
      "scope-output",
      join(FIXTURES_DIR, "invalid/scope-output-unknown-key.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "additionalProperties")).toBe(true);
  });
});

describe("validateArtifactFile — malformed JSON", () => {
  it("returns a structured error instead of throwing when JSON is malformed", () => {
    const tmpPath = join(FIXTURES_DIR, "invalid/.tmp-malformed.json");
    writeFileSync(tmpPath, "{ not valid json ", "utf-8");
    try {
      const result = validateArtifactFile("component", tmpPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.keyword).toBe("parse");
    } finally {
      rmSync(tmpPath, { force: true });
    }
  });
});
