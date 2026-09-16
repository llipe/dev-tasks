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
 * `.claude/settings.json` deliverability (issue #169, task 1.0).
 *
 * The file that wires the shipped Claude hook scripts was listed in
 * `bundle-manifest.json` `consumer_owned_paths` and never installed by any
 * profile, so a `--profile claude` consumer got two inert shell scripts with
 * nothing wiring them. `PROFILE_PATHS.claude` models directories only, so a
 * single templated file with a different source/target relative path
 * (`templates/claude/settings.json` -> `.claude/settings.json`) needs its own
 * registry, distinct from `ROOT_FILES` (unconditional overwrite): a
 * consumer's `permissions.allow` entries and any local hooks must survive
 * both `install` and `update`, so the correct semantics are install-if-absent.
 *
 * See docs/adr/ADR-006-claude-settings-ownership.md.
 */
describe("core/distribution/profiles — install-if-absent settings source (#169)", () => {
  it("exports INSTALL_IF_ABSENT_FILES", async () => {
    const mod = (await import("#core/distribution/profiles.js")) as Record<string, unknown>;
    expect(
      mod.INSTALL_IF_ABSENT_FILES,
      "profiles.ts must export INSTALL_IF_ABSENT_FILES so the Claude profile resolves a settings source",
    ).toBeDefined();
    expect(Array.isArray(mod.INSTALL_IF_ABSENT_FILES)).toBe(true);
  });

  it("resolves a settings source for the claude platform", async () => {
    const mod = (await import("#core/distribution/profiles.js")) as {
      INSTALL_IF_ABSENT_FILES: ReadonlyArray<{ source: string; target: string; platform: string }>;
    };
    const claudeSettings = mod.INSTALL_IF_ABSENT_FILES.find(
      (f) => f.target === ".claude/settings.json",
    );
    expect(
      claudeSettings,
      "no install-if-absent entry resolves .claude/settings.json for the claude platform",
    ).toBeDefined();
    expect(claudeSettings?.source).toBe("templates/claude/settings.json");
    expect(claudeSettings?.platform).toBe("claude");
  });

  it("keeps .claude/settings.json out of bundle-manifest.json consumer_owned_paths", async () => {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile("bundle-manifest.json", "utf-8");
    const parsed = JSON.parse(raw) as { consumer_owned_paths?: string[] };
    expect(
      parsed.consumer_owned_paths ?? [],
      ".claude/settings.json must not be consumer-owned — install-if-absent semantics deliver it instead",
    ).not.toContain(".claude/settings.json");
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
