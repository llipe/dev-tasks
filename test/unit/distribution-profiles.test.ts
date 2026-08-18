import { describe, it, expect } from "vitest";
import {
  resolveProfile,
  isValidProfile,
  VALID_PROFILES,
  PROFILE_PATHS,
} from "#core/distribution/profiles.js";

describe("core/distribution/profiles", () => {
  describe("resolveProfile()", () => {
    it("resolves 'copilot' to ['copilot']", () => {
      expect(resolveProfile("copilot")).toEqual(["copilot"]);
    });

    it("resolves 'claude' to ['claude']", () => {
      expect(resolveProfile("claude")).toEqual(["claude"]);
    });

    it("resolves 'kiro' to ['kiro']", () => {
      expect(resolveProfile("kiro")).toEqual(["kiro"]);
    });

    it("resolves 'both' to ['copilot', 'claude']", () => {
      expect(resolveProfile("both")).toEqual(["copilot", "claude"]);
    });

    it("resolves 'all' to ['copilot', 'claude', 'kiro']", () => {
      expect(resolveProfile("all")).toEqual(["copilot", "claude", "kiro"]);
    });
  });

  describe("isValidProfile()", () => {
    it("returns true for all valid profiles", () => {
      for (const p of VALID_PROFILES) {
        expect(isValidProfile(p)).toBe(true);
      }
    });

    it("returns false for invalid profile strings", () => {
      expect(isValidProfile("invalid")).toBe(false);
      expect(isValidProfile("")).toBe(false);
      expect(isValidProfile("github")).toBe(false);
      expect(isValidProfile("Copilot")).toBe(false);
    });
  });

  describe("PROFILE_PATHS", () => {
    it("copilot has 4 managed path entries", () => {
      expect(PROFILE_PATHS.copilot).toHaveLength(4);
    });

    it("claude has 4 managed path entries", () => {
      expect(PROFILE_PATHS.claude).toHaveLength(4);
    });

    it("kiro has 4 managed path entries", () => {
      expect(PROFILE_PATHS.kiro).toHaveLength(4);
    });

    it("copilot paths start with .github/", () => {
      for (const p of PROFILE_PATHS.copilot) {
        expect(p.source).toMatch(/^\.github\//);
        expect(p.target).toMatch(/^\.github\//);
      }
    });

    it("claude paths start with .claude/", () => {
      for (const p of PROFILE_PATHS.claude) {
        expect(p.source).toMatch(/^\.claude\//);
        expect(p.target).toMatch(/^\.claude\//);
      }
    });

    it("kiro paths start with .kiro/", () => {
      for (const p of PROFILE_PATHS.kiro) {
        expect(p.source).toMatch(/^\.kiro\//);
        expect(p.target).toMatch(/^\.kiro\//);
      }
    });

    it("source and target are identical for all entries", () => {
      for (const platform of ["copilot", "claude", "kiro"] as const) {
        for (const p of PROFILE_PATHS[platform]) {
          expect(p.source).toBe(p.target);
        }
      }
    });
  });

  describe("VALID_PROFILES", () => {
    it("contains exactly the five expected profiles", () => {
      expect(VALID_PROFILES).toEqual(["copilot", "claude", "kiro", "both", "all"]);
    });
  });
});

/**
 * Root-file (platform-agnostic) distribution — issue #123 AC-10.
 *
 * `PROFILE_PATHS` only models platform directories, so a repo-root contract file
 * like `TESTING.md` fits neither shape: it belongs to no platform and must be
 * installed exactly once regardless of how many platforms a profile resolves to.
 * `/DESIGN.md` sidesteps this by not being distributed at all, so there is no
 * existing precedent — these assertions define the contract.
 *
 * Test plan mapping (workstream/test-plan-123.md): SC-27, SC-28, CT-7.
 */
describe("core/distribution/profiles — ROOT_FILES (AC-10)", () => {
  it("exports a ROOT_FILES list", async () => {
    const mod = (await import("#core/distribution/profiles.js")) as Record<string, unknown>;
    expect(
      mod.ROOT_FILES,
      "profiles.ts must export ROOT_FILES for platform-agnostic files",
    ).toBeDefined();
    expect(Array.isArray(mod.ROOT_FILES)).toBe(true);
  });

  it("includes TESTING.md", async () => {
    const mod = (await import("#core/distribution/profiles.js")) as Record<string, unknown>;
    const rootFiles = (mod.ROOT_FILES ?? []) as readonly string[];
    expect(rootFiles).toContain("TESTING.md");
  });

  it("lists no platform-directory paths — root files live at the repo root", async () => {
    const mod = (await import("#core/distribution/profiles.js")) as Record<string, unknown>;
    const rootFiles = (mod.ROOT_FILES ?? []) as readonly string[];
    expect(
      rootFiles.length,
      "ROOT_FILES is empty — this assertion would pass vacuously",
    ).toBeGreaterThan(0);
    for (const relPath of rootFiles) {
      expect(relPath, `${relPath} is a platform path, not a root file`).not.toMatch(
        /^\.(github|claude|kiro)\//,
      );
      expect(relPath, `${relPath} must not be nested`).not.toContain("/");
    }
  });

  it("keeps root files out of every platform's PROFILE_PATHS", async () => {
    const mod = (await import("#core/distribution/profiles.js")) as Record<string, unknown>;
    const rootFiles = (mod.ROOT_FILES ?? []) as readonly string[];
    expect(
      rootFiles.length,
      "ROOT_FILES is empty — this assertion would pass vacuously",
    ).toBeGreaterThan(0);
    for (const platform of ["copilot", "claude", "kiro"] as const) {
      for (const p of PROFILE_PATHS[platform]) {
        expect(rootFiles).not.toContain(p.source);
      }
    }
  });
});
