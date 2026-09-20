/**
 * Unit tests for repository-shape detection and package-map drift
 * (S-005; PRD FR-59, AC-29).
 *
 * "Multi-repo" retired with `dt` (D-16). Shape is the replacement: a
 * repository is single-package or a monorepo, recorded once in
 * `docs/tech.md` and read by every later phase.
 *
 * Two things are deliberately asymmetric and are asserted as such:
 * only `pnpm-workspace.yaml` and `package.json` `workspaces` are parsed
 * for a package list; `turbo.json`, `nx.json`, `lerna.json`, and
 * `[tool.uv.workspace]` are presence-only signals. Parsing four more
 * formats would be four more untested parsers for the same answer.
 *
 * Drift is checked in both directions, because only one direction is
 * obvious: a package with no row is the case people think of, and a row
 * for a package somebody deleted is the case that rots quietly.
 */
import { describe, it, expect } from "vitest";
import { join } from "node:path";

import {
  detectWorkspace,
  findPackageMapDrift,
  type WorkspaceShape,
} from "../../core/distribution/workspace.js";

const FIXTURES = join(import.meta.dirname, "../fixtures");
const REPO_ROOT = join(import.meta.dirname, "../..");

function fixture(name: string): string {
  return join(FIXTURES, name);
}

describe("detectWorkspace", () => {
  it("reports single-package shape when no signal is present", () => {
    const ws = detectWorkspace(fixture("workspace-single"));
    expect(ws.shape).toBe<WorkspaceShape>("single-package");
    expect(ws.signals).toEqual([]);
  });

  it("records one row for the root in a single-package repository (AC-3)", () => {
    // The table shape is identical in both cases, so a reader never has
    // to ask which kind of repository they are looking at.
    const ws = detectWorkspace(fixture("workspace-single"));
    expect(ws.packages).toHaveLength(1);
    expect(ws.packages[0]).toMatchObject({ name: "single-app", path: "." });
  });

  it("lists the canonical scripts a package actually has, in map-column order", () => {
    // Not alphabetical: the order is the one the package map's column
    // uses, so a row can be written straight from this list.
    const ws = detectWorkspace(fixture("workspace-single"));
    expect(ws.packages[0].scripts).toEqual(["lint", "typecheck", "test"]);
  });

  it("enumerates packages from pnpm-workspace.yaml globs (AC-1)", () => {
    const ws = detectWorkspace(fixture("workspace-mono"));
    expect(ws.shape).toBe<WorkspaceShape>("monorepo");
    expect(ws.packages.map((p) => p.name).sort()).toEqual(["@mono/core", "@mono/web"]);
    expect(ws.packages.map((p) => p.path).sort()).toEqual(["apps/web", "packages/core"]);
  });

  it("ignores a directory the glob matches that holds no package.json", () => {
    const ws = detectWorkspace(fixture("workspace-mono"));
    expect(ws.packages.some((p) => p.path.includes("not-a-package"))).toBe(false);
  });

  it("enumerates packages from package.json workspaces (AC-1)", () => {
    const ws = detectWorkspace(fixture("workspace-npm"));
    expect(ws.shape).toBe<WorkspaceShape>("monorepo");
    expect(ws.packages.map((p) => p.name)).toEqual(["@npm/util"]);
  });

  it("enumerates packages from the Yarn object form of workspaces (AC-1)", () => {
    // npm and pnpm use the array form; Yarn classic uses an object with
    // a `packages` key. Reading only the array form does not fail loudly
    // — it reports single-package for a monorepo, so doctor's check goes
    // green while every real package is invisible.
    const ws = detectWorkspace(fixture("workspace-yarn-object"));
    expect(ws.shape).toBe<WorkspaceShape>("monorepo");
    expect(ws.signals).toEqual(["package.json"]);
    expect(ws.packages.map((p) => p.name)).toEqual(["@yarn/util"]);
  });

  it("records every signal it found, not just the one it parsed", () => {
    const ws = detectWorkspace(fixture("workspace-mono"));
    expect(ws.signals.sort()).toEqual(["pnpm-workspace.yaml", "turbo.json"]);
  });

  it("treats nx.json as a signal without parsing a package list (AC-1)", () => {
    const ws = detectWorkspace(fixture("workspace-nx"));
    expect(ws.shape).toBe<WorkspaceShape>("monorepo");
    expect(ws.signals).toEqual(["nx.json"]);
    expect(ws.packages).toEqual([]);
  });

  it("treats [tool.uv.workspace] as a signal (AC-1)", () => {
    const ws = detectWorkspace(fixture("workspace-uv"));
    expect(ws.shape).toBe<WorkspaceShape>("monorepo");
    expect(ws.signals).toEqual(["pyproject.toml"]);
  });

  describe("edge cases", () => {
    it("an empty pnpm-workspace.yaml is still a monorepo signal with no packages", () => {
      const ws = detectWorkspace(fixture("workspace-empty"));
      expect(ws.shape).toBe<WorkspaceShape>("monorepo");
      expect(ws.packages).toEqual([]);
    });

    it("a glob matching zero directories yields no packages and does not throw", () => {
      const ws = detectWorkspace(fixture("workspace-zero-match"));
      expect(ws.packages).toEqual([]);
    });

    it("a package with no name is reported by its path", () => {
      // Dropping it would hide a real package from the map; inventing a
      // name would put something in docs/tech.md that nothing matches.
      const ws = detectWorkspace(fixture("workspace-unnamed"));
      expect(ws.packages).toHaveLength(1);
      expect(ws.packages[0]).toMatchObject({ name: null, path: "packages/anon" });
    });

    it("stops a deep glob at a package boundary", () => {
      // packages/** would otherwise descend into a matched package and
      // turn its vendored package.json into a phantom map row.
      const ws = detectWorkspace(fixture("workspace-deep"));
      const paths = ws.packages.map((p) => p.path).sort();
      expect(paths).toContain("packages/real");
      expect(paths).not.toContain("packages/real/vendor");
      // A nested package under a directory that is NOT itself a package
      // is still found — the stop is at packages, not at depth 1.
      expect(paths).toContain("packages/group/nested");
    });

    it("stops reading pnpm patterns at the next top-level key", () => {
      const ws = detectWorkspace(fixture("workspace-trailing-key"));
      expect(ws.packages.map((p) => p.name)).toEqual(["@trailing/one"]);
    });

    it("a pyproject.toml without [tool.uv.workspace] stays single-package", () => {
      // The false positive that would flip every Python repository.
      const ws = detectWorkspace(fixture("workspace-plain-python"));
      expect(ws.shape).toBe<WorkspaceShape>("single-package");
      expect(ws.signals).toEqual([]);
    });

    it("a repository that does not exist reports single-package, not a crash", () => {
      const ws = detectWorkspace(join(FIXTURES, "does-not-exist"));
      expect(ws.shape).toBe<WorkspaceShape>("single-package");
      expect(ws.packages).toEqual([]);
    });
  });

  describe("this repository", () => {
    it("is single-package and records one row (business rule)", () => {
      // dev-tasks has no workspace signal. This story does not turn it
      // into a monorepo; it records the shape it already has.
      const ws = detectWorkspace(REPO_ROOT);
      expect(ws.shape).toBe<WorkspaceShape>("single-package");
      expect(ws.packages.map((p) => p.path)).toEqual(["."]);
    });
  });
});

describe("findPackageMapDrift", () => {
  it("reports nothing when the map matches the workspace", () => {
    expect(findPackageMapDrift(fixture("workspace-mono"))).toEqual([]);
  });

  it("reports nothing for a single-package repository with its one row", () => {
    expect(findPackageMapDrift(fixture("workspace-single"))).toEqual([]);
  });

  it("reports a package on disk with no row in the map (AC-6)", () => {
    // workspace-npm has a package map with a header and no rows yet.
    const drift = findPackageMapDrift(fixture("workspace-npm"));
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ kind: "missing-row" });
    expect(drift[0].message).toContain("@npm/util");
  });

  it("reports a row with no package on disk (AC-6)", () => {
    // The direction that rots quietly: somebody deletes a package and
    // the map keeps describing it.
    // This fixture drifts both ways at once: a row for packages/gone,
    // and packages/anon on disk with no row.
    const drift = findPackageMapDrift(fixture("workspace-unnamed"));
    expect(drift.map((d) => d.kind).sort()).toEqual(["missing-package", "missing-row"]);
    expect(drift.find((d) => d.kind === "missing-package")?.message).toContain("packages/gone");
  });

  it("reports nothing when there is no package map at all", () => {
    // A repository that has not run activity-init yet is not in drift.
    // Warning about an absent map would fire on every fresh install.
    expect(findPackageMapDrift(fixture("workspace-nx"))).toEqual([]);
  });

  it("reports nothing for this repository", () => {
    expect(findPackageMapDrift(REPO_ROOT)).toEqual([]);
  });
});
