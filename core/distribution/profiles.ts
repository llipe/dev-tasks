/**
 * Profile-to-paths mapping for managed file distribution.
 * Maps each platform profile to its source/target directory structure.
 */

/** Supported platform profiles. */
export type Profile = "copilot" | "claude" | "kiro" | "both" | "all";

/** Individual platform identifiers (excludes composite profiles). */
export type Platform = "copilot" | "claude" | "kiro";

/** A managed directory path entry within a platform. */
export interface ManagedPath {
  /** Relative path inside the package (source). */
  source: string;
  /** Relative path in the consumer repo (target — same as source for platform dirs). */
  target: string;
  /** Whether to recurse into subdirectories. */
  recursive: boolean;
}

/** Profile-to-paths mapping for each individual platform. */
export const PROFILE_PATHS: Record<Platform, ManagedPath[]> = {
  copilot: [
    { source: ".github/agents", target: ".github/agents", recursive: false },
    { source: ".github/skills", target: ".github/skills", recursive: true },
    { source: ".github/instructions", target: ".github/instructions", recursive: true },
    { source: ".github/prompts", target: ".github/prompts", recursive: false },
  ],
  claude: [
    { source: ".claude/agents", target: ".claude/agents", recursive: false },
    { source: ".claude/skills", target: ".claude/skills", recursive: true },
    { source: ".claude/commands", target: ".claude/commands", recursive: false },
    { source: ".claude/hooks", target: ".claude/hooks", recursive: true },
  ],
  kiro: [
    { source: ".kiro/agents", target: ".kiro/agents", recursive: false },
    { source: ".kiro/skills", target: ".kiro/skills", recursive: true },
    { source: ".kiro/steering", target: ".kiro/steering", recursive: false },
    { source: ".kiro/hooks", target: ".kiro/hooks", recursive: true },
  ],
};

/**
 * Repo-root files that belong to no platform.
 *
 * These are canonical contract documents installed once per run regardless of
 * how many platforms the profile resolves to. They are also listed in
 * `consumer_owned_paths` in `bundle-manifest.json`, so `dev-tasks update` never
 * overwrites a version the consumer has filled in.
 *
 * Entries MUST be bare filenames at the repository root — a nested or
 * platform-prefixed path belongs in `PROFILE_PATHS` instead.
 */
export const ROOT_FILES: readonly string[] = ["DESIGN.md", "TESTING.md"] as const;

/**
 * Manifest `profile` tag for root files.
 *
 * Platform-agnostic files cannot be tagged with a single platform: manifest
 * merging replaces entries whose profile is in the installed set, so a root file
 * tagged `kiro` would be dropped when installing `copilot` and duplicated when
 * installing `all`. A dedicated tag keeps it to exactly one entry.
 */
export const ROOT_PROFILE_TAG = "root";

/**
 * Tag for an install-if-absent file that belongs to no platform.
 *
 * Reuses `ROOT_PROFILE_TAG` rather than introducing a third delivery
 * category: the problem is identical to the one that tag already solves
 * — a file tagged with a single platform is dropped when another profile
 * is installed and duplicated when several are. A runbook belongs to the
 * repository, not to Copilot or Claude or Kiro.
 */
export type AgnosticTag = typeof ROOT_PROFILE_TAG;

/** An install-if-absent file entry: source path in the package, target path in the consumer repo. */
export interface InstallIfAbsentFile {
  /** Relative path inside the package (source). */
  source: string;
  /** Relative path in the consumer repo (target). */
  target: string;
  /**
   * Platform this file belongs to, or `ROOT_PROFILE_TAG` when it belongs
   * to none. An agnostic entry is delivered once per run whatever the
   * profile resolves to.
   */
  platform: Platform | AgnosticTag;
}

/**
 * Files delivered with install-if-absent semantics: written when the target
 * is missing, never overwritten once present — distinct from `ROOT_FILES`
 * (unconditional overwrite on every `install`) and from the standard
 * managed-directory files under `PROFILE_PATHS` (always re-synced).
 *
 * `.claude/settings.json` wires the shipped Claude hook scripts and carries a
 * consumer's `permissions.allow` entries and any local hooks; those must
 * survive `install` and `update`, so the file is delivered once and then
 * fully consumer-owned. See docs/adr/ADR-006-claude-settings-ownership.md.
 *
 * Source and target intentionally differ here (`templates/claude/settings.json`
 * -> `.claude/settings.json`) — the one respect in which this category is not
 * a bare-directory mirror like `PROFILE_PATHS`.
 *
 * `CLAUDE.md` and `AGENTS.md` are root-level project memory a consumer fills
 * in with their own content (see issue #171): unlike `ROOT_FILES`, which
 * overwrite unconditionally every run, these must be delivered on a fresh
 * install (so Claude Code loads project memory on the first turn) but never
 * touched again once the consumer's copy exists — the same rationale as
 * `.claude/settings.json`. `AGENTS.md` is tagged `claude` here (not a
 * separate platform) because it ships specifically to satisfy the Claude
 * profile's project-memory requirement; Copilot and Kiro carry equivalent
 * always-on guidance through their own managed paths.
 */
export const INSTALL_IF_ABSENT_FILES: readonly InstallIfAbsentFile[] = [
  { source: "templates/claude/settings.json", target: ".claude/settings.json", platform: "claude" },
  { source: "CLAUDE.md.template", target: "CLAUDE.md", platform: "claude" },
  { source: "AGENTS.md.template", target: "AGENTS.md", platform: "claude" },
  {
    source: "templates/runbooks/README.md",
    target: "docs/runbooks/README.md",
    platform: ROOT_PROFILE_TAG,
  },
  {
    source: "templates/runbooks/runbook-template.md",
    target: "docs/runbooks/runbook-template.md",
    platform: ROOT_PROFILE_TAG,
  },
  {
    source: "templates/domain/ubiquitous-language.md",
    target: "docs/domain/ubiquitous-language.md",
    platform: ROOT_PROFILE_TAG,
  },
] as const;

/** Valid profile values for CLI validation. */
export const VALID_PROFILES: readonly Profile[] = [
  "copilot",
  "claude",
  "kiro",
  "both",
  "all",
] as const;

/**
 * Resolve a composite profile name to its constituent platform list.
 */
export function resolveProfile(profile: Profile): Platform[] {
  switch (profile) {
    case "copilot":
      return ["copilot"];
    case "claude":
      return ["claude"];
    case "kiro":
      return ["kiro"];
    case "both":
      return ["copilot", "claude"];
    case "all":
      return ["copilot", "claude", "kiro"];
  }
}

/**
 * Validate whether a string is a valid profile.
 */
export function isValidProfile(value: string): value is Profile {
  return VALID_PROFILES.includes(value as Profile);
}
