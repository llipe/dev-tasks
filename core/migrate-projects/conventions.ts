/**
 * The projects-tracking label conventions `migrate projects` enforces,
 * defined once (spec §16a A-87). github-ops' Labels section states the same
 * set in prose; PT-81 pins the two together.
 *
 * - Types (D-85): exactly one `type:` per issue from `TYPE_SET`, listed in
 *   tie-break order: when work fits several types, the first wins.
 * - Retired labels (D-91): removed from open issues, definitions kept.
 * - Default labels (D-100): GitHub's unprefixed `bug`, `documentation`,
 *   `enhancement`, plus `chore` and `story`, are neither retired nor a
 *   type; they only feed a suggestion.
 */

/** The eight types, in tie-break order: `security > bug > … > tech-debt`. */
export const TYPE_SET = [
  "security",
  "bug",
  "enhancement",
  "refactor",
  "test",
  "docs",
  "chore",
  "tech-debt",
] as const;

export type IssueType = (typeof TYPE_SET)[number];

/** Each type's definition, as github-ops' Labels table states it (S-019). */
export const TYPE_DEFINITIONS: Readonly<Record<IssueType, string>> = {
  security: "Security vulnerability, hardening, or compliance work",
  bug: "Behavior that differs from the spec or intent",
  enhancement: "New or changed behavior",
  refactor: "Code restructure, no behavior change",
  test: "Test-only work",
  docs: "Documentation changes",
  chore: "Maintenance, dependencies, tooling, or CI",
  "tech-debt": "Deferred engineering work that fits no other type",
};

/** Each type's colour, as github-ops' Labels table states it (S-019); PT-81 pins it. */
export const TYPE_COLORS: Readonly<Record<IssueType, string>> = {
  security: "B60205",
  bug: "D93F0B",
  enhancement: "0E8A16",
  refactor: "D4C5F9",
  test: "BFDADC",
  docs: "0075CA",
  chore: "FEF2C0",
  "tech-debt": "5319E7",
};

export interface LabelDefinition {
  /** Six hex digits, no `#`. */
  color: string;
  description: string;
}

/** The `level:` labels batch 1 creates when missing (A-71), as github-ops' table states them. */
export const LEVEL_DEFINITIONS = {
  "level: prd": { color: "3F51B5", description: "PRD tracking issue; a container for waves, not work" },
  "level: wave": {
    color: "5C6BC0",
    description: "Wave tracking issue; a container for stories, not work",
  },
  "level: story": { color: "7986CB", description: "Story issue; the unit of work" },
} as const satisfies Record<string, LabelDefinition>;

/**
 * The four priorities, with the D-84 and D-102 meanings batch 1 writes into
 * their descriptions (D-103): `critical` blocks a ship, `high` blocks none.
 */
export const PRIORITY_DEFINITIONS = {
  "priority: critical": {
    color: "B60205",
    description: "Blocks a wave, PRD, or release from shipping",
  },
  "priority: high": {
    color: "D93F0B",
    description: "Lands in the current wave or cycle; blocks no ship",
  },
  "priority: medium": { color: "FBCA04", description: "Lands in the next wave or cycle" },
  "priority: low": { color: "C5DEF5", description: "Backlog" },
} as const satisfies Record<string, LabelDefinition>;

/** GitHub refuses a label description longer than this. */
export const LABEL_DESCRIPTION_MAX = 100;

/** Prefixed to a retired label's description, once (D-91, A-82). */
export const RETIRED_DESCRIPTION_PREFIX = "Retired (D-91): ";

export const TYPE_LABEL_PREFIX = "type: ";

/** Retired `type:` labels: they count as no type (D-85, A-70). */
export const RETIRED_TYPE_LABELS = [
  "type: other",
  "type: prd",
  "type: wave",
  "type: story",
] as const;

/** Every retired label by exact name (D-91, D-07, D-15); `wave:` labels are matched by prefix. S-014 batch 5 removes them; PT-81 pins the list. */
export const RETIRED_LABELS = [
  ...RETIRED_TYPE_LABELS,
  "status: ready",
  "status: in-progress",
  "needs: decision",
  "needs: approval",
  "needs: merge",
] as const;

export const RETIRED_LABEL_PREFIXES = ["wave:"] as const;

export const LEVEL_LABELS = {
  prd: "level: prd",
  wave: "level: wave",
  story: "level: story",
} as const;

export const PRIORITY_LABEL_PREFIX = "priority: ";
export const PRIORITY_CRITICAL = "priority: critical";
export const PRIORITY_HIGH = "priority: high";

/** True for a retired label (D-91): an exact name, or a `wave:` label. */
export function isRetiredLabel(name: string): boolean {
  return (
    (RETIRED_LABELS as readonly string[]).includes(name) ||
    RETIRED_LABEL_PREFIXES.some((p) => name.startsWith(p))
  );
}

/** Conventional Commits title prefix to type (D-85). `perf`, `style`, `revert` give none. */
export const CONVENTIONAL_COMMIT_SUGGESTIONS: Readonly<Record<string, IssueType>> = {
  fix: "bug",
  feat: "enhancement",
  test: "test",
  docs: "docs",
  refactor: "refactor",
  chore: "chore",
  ci: "chore",
  build: "chore",
};

/** Default and unprefixed labels to type (D-100); `null` means no suggestion. */
export const DEFAULT_LABEL_SUGGESTIONS: Readonly<Record<string, IssueType | null>> = {
  bug: "bug",
  documentation: "docs",
  enhancement: "enhancement",
  chore: "chore",
  story: null,
};

/** The issue's labels that are members of the type set, as type names. */
export function validTypes(labels: readonly string[]): IssueType[] {
  return TYPE_SET.filter((t) => labels.includes(`${TYPE_LABEL_PREFIX}${t}`));
}

/** The first of `types` in tie-break order, or `null` for none. */
export function tieBreakWinner(types: readonly IssueType[]): IssueType | null {
  return TYPE_SET.find((t) => types.includes(t)) ?? null;
}

/** Leading `[PRD-<name>] ` prefix, which carries no type information. */
const PRD_PREFIX = /^\[PRD-[^\]]+\]\s*/;
/** `fix:`, `fix(scope):`, `fix!:`, matched case-insensitively as Conventional Commits allows. */
const CC_PREFIX = /^([A-Za-z]+)(?:\([^)]*\))?!?:/;
/** `[chore] …`, the bracket form seen in the wild (A-69). */
const BRACKET_PREFIX = /^\[([A-Za-z-]+)\]/;

function fromWord(word: string): IssueType | null {
  const w = word.toLowerCase();
  if (Object.hasOwn(CONVENTIONAL_COMMIT_SUGGESTIONS, w)) return CONVENTIONAL_COMMIT_SUGGESTIONS[w];
  return (TYPE_SET as readonly string[]).includes(w) ? (w as IssueType) : null;
}

/**
 * The suggested type for an issue on "needs a type" (D-85, D-100, A-69).
 * Several valid types: the tie-break winner among them. Otherwise, in order:
 * the Conventional Commits title prefix (scoped and breaking forms), a
 * `[type]` bracket prefix, then a default unprefixed label; a prefix with
 * no type (`perf:`) falls through to the next rule. `null` when
 * nothing applies: a type is never guessed beyond these rules.
 */
export function suggestType(title: string, labels: readonly string[]): IssueType | null {
  const present = validTypes(labels);
  if (present.length > 1) return tieBreakWinner(present);
  const rest = title.replace(PRD_PREFIX, "");
  const cc = rest.match(CC_PREFIX);
  if (cc && Object.hasOwn(CONVENTIONAL_COMMIT_SUGGESTIONS, cc[1].toLowerCase())) {
    return CONVENTIONAL_COMMIT_SUGGESTIONS[cc[1].toLowerCase()];
  }
  const bracket = rest.match(BRACKET_PREFIX);
  if (bracket) {
    const t = fromWord(bracket[1]);
    if (t !== null) return t;
  }
  for (const label of labels) {
    if (Object.hasOwn(DEFAULT_LABEL_SUGGESTIONS, label)) {
      const t = DEFAULT_LABEL_SUGGESTIONS[label];
      if (t !== null) return t;
    }
  }
  return null;
}
