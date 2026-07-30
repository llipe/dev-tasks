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
