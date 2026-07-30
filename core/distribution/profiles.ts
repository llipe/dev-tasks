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
