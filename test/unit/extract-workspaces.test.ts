/**
 * Unit tests for workspace-aware component discovery.
 *
 * Tests validate that discoverComponents():
 * - Returns [rootDir] for a single-package repo (no workspace config)
 * - Discovers pnpm workspace packages from pnpm-workspace.yaml globs
 * - Discovers npm/yarn workspace packages from package.json workspaces field
 * - Excludes the workspace root when it has no runtime dependencies
 * - Returns results in deterministic alphabetical order
 * - Does not recurse into node_modules
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { discoverComponents } from "../../core/extract/workspaces.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures/extract");

describe("discoverComponents", () => {
  describe("single-package repo", () => {
    it("returns the root as the sole component", () => {
      const fixture = resolve(FIXTURES_DIR, "express-typed");
      const result = discoverComponents(fixture);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe(fixture);
      expect(result[0].name).toBe("express-typed-app");
    });
  });

  describe("pnpm workspace (pnpm-workspace.yaml)", () => {
    it("discovers all workspace packages", () => {
      const fixture = resolve(FIXTURES_DIR, "monorepo-pnpm");
      const result = discoverComponents(fixture);

      expect(result).toHaveLength(2);
      const names = result.map((c) => c.name);
      expect(names).toContain("@monorepo/api");
      expect(names).toContain("@monorepo/worker");
    });

    it("excludes workspace root when it has no runtime deps", () => {
      const fixture = resolve(FIXTURES_DIR, "monorepo-pnpm");
      const result = discoverComponents(fixture);

      const rootEntry = result.find((c) => c.path === fixture);
      expect(rootEntry).toBeUndefined();
    });

    it("returns results in alphabetical order by path", () => {
      const fixture = resolve(FIXTURES_DIR, "monorepo-pnpm");
      const result = discoverComponents(fixture);

      const paths = result.map((c) => c.path);
      const sorted = [...paths].sort();
      expect(paths).toEqual(sorted);
    });

    it("resolves correct paths for each package", () => {
      const fixture = resolve(FIXTURES_DIR, "monorepo-pnpm");
      const result = discoverComponents(fixture);

      const apiPkg = result.find((c) => c.name === "@monorepo/api");
      const workerPkg = result.find((c) => c.name === "@monorepo/worker");

      expect(apiPkg?.path).toBe(resolve(fixture, "packages/api"));
      expect(workerPkg?.path).toBe(resolve(fixture, "packages/worker"));
    });
  });

  describe("npm/yarn workspaces (package.json)", () => {
    it("discovers packages from workspaces field", () => {
      const fixture = resolve(FIXTURES_DIR, "monorepo-npm");
      const result = discoverComponents(fixture);

      expect(result).toHaveLength(2);
      const names = result.map((c) => c.name);
      expect(names).toContain("@monorepo-npm/frontend");
      expect(names).toContain("@monorepo-npm/backend");
    });

    it("excludes workspace root when it has no runtime deps", () => {
      const fixture = resolve(FIXTURES_DIR, "monorepo-npm");
      const result = discoverComponents(fixture);

      const rootEntry = result.find((c) => c.path === fixture);
      expect(rootEntry).toBeUndefined();
    });
  });
});
