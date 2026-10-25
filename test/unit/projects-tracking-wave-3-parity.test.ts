/**
 * Parity and static checks for the projects-tracking PRD, wave 3 (migration
 * of an existing repository). One `describe` block per changed prompt file,
 * each `it` reading the three platform tree copies and asserting a marker
 * line with `toContain`, section-scoped where a section must contain or lack
 * a line (D-34). Every pinned line is byte-identical across the trees
 * (S-019 AC-7, PT-66).
 *
 * Helpers are copied from `projects-tracking-parity.test.ts` so this file has
 * no cross-test import.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  TYPE_SET as CODE_TYPE_SET,
  TYPE_DEFINITIONS as CODE_TYPE_DEFINITIONS,
  TYPE_COLORS as CODE_TYPE_COLORS,
  LEVEL_DEFINITIONS as CODE_LEVEL_DEFINITIONS,
  PRIORITY_DEFINITIONS as CODE_PRIORITY_DEFINITIONS,
  PRD_STATES as CODE_PRD_STATES,
  RETIRED_TYPE_LABELS as CODE_RETIRED_TYPE_LABELS,
  RETIRED_LABELS as CODE_RETIRED_LABELS,
  RETIRED_LABEL_PREFIXES as CODE_RETIRED_LABEL_PREFIXES,
  DEFAULT_LABEL_SUGGESTIONS as CODE_DEFAULT_LABEL_SUGGESTIONS,
} from "#core/migrate-projects/conventions.js";
import { checkDocsStructure } from "#core/checks/docs-structure.js";

const ROOT = resolve(__dirname, "../..");

/** Strip platform-specific frontmatter (YAML between ---) for comparison */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

interface Section {
  heading: string;
  /** Number of `#` on the heading line; 0 for the preamble before the first heading. */
  level: number;
  text: string;
}

/**
 * Split the body into (heading, sectionText) pairs. Lines inside a ``` fence
 * are never headings: fenced templates carry `##` lines that belong to the
 * enclosing section.
 */
function splitIntoSections(body: string): Section[] {
  const lines = body.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentLevel = 0;
  let currentLines: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      currentLines.push(line);
      continue;
    }
    const headingMatch = inFence ? null : line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      sections.push({
        heading: currentHeading,
        level: currentLevel,
        text: currentLines.join("\n"),
      });
      currentLevel = headingMatch[1].length;
      currentHeading = headingMatch[2];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  sections.push({ heading: currentHeading, level: currentLevel, text: currentLines.join("\n") });
  return sections;
}

interface TreeCopy {
  tree: string;
  path: string;
  body: string;
  sections: Section[];
}

function loadTrees(paths: Record<string, string>): TreeCopy[] {
  return Object.entries(paths).map(([tree, path]) => {
    const body = stripFrontmatter(readFileSync(resolve(ROOT, path), "utf-8"));
    return { tree, path, body, sections: splitIntoSections(body) };
  });
}

/** Section `at` plus every following deeper section, heading lines kept. */
function collectSection(sections: Section[], at: number): string {
  const parts = [sections[at].text];
  for (let i = at + 1; i < sections.length && sections[i].level > sections[at].level; i++) {
    parts.push(`${"#".repeat(sections[i].level)} ${sections[i].heading}`, sections[i].text);
  }
  return parts.join("\n");
}

/** The first section whose heading contains `heading`, with its children. */
function sectionOf(copy: TreeCopy, heading: string): string {
  const at = copy.sections.findIndex((section) => section.heading.includes(heading));
  expect(at, `${copy.path}: no section with heading containing "${heading}"`).toBeGreaterThan(-1);
  return collectSection(copy.sections, at);
}

/** Collapse runs of spaces so a table row matches regardless of column padding. */
function squashSpaces(text: string): string {
  return text.replace(/[ \t]+/g, " ");
}

/** The one line of `text` containing `marker`; fails on zero or several matches. */
function lineWith(text: string, marker: string, label = "text"): string {
  const lines = text.split("\n").filter((line) => line.includes(marker));
  expect(lines.length, `${label}: expected exactly one line containing "${marker}"`).toBe(1);
  return lines[0];
}

/** Assert every tree's pinned line for `marker` is byte-identical (PT-66). */
function expectIdenticalLine(trees: TreeCopy[], heading: string, marker: string): void {
  const lines = trees.map((copy) => lineWith(sectionOf(copy, heading), marker, copy.path));
  for (const [i, line] of lines.entries()) {
    expect(line, `${trees[i].path}: "${marker}" line differs from ${trees[0].path}`).toBe(lines[0]);
  }
}

/** A table row whose first backticked label cell is `label`, padding squashed. */
function tableRow(section: string, label: string): string | undefined {
  return squashSpaces(section)
    .split("\n")
    .find((line) => line.startsWith("|") && line.includes(`| \`${label}\` |`));
}

const GITHUB_OPS_TREES = {
  claude: ".claude/agents/github-ops.md",
  github: ".github/agents/github-ops.agent.md",
  kiro: ".kiro/agents/github-ops.md",
};

const PRODUCT_ENGINEER_TREES = {
  claude: ".claude/commands/product-engineer.md",
  github: ".github/agents/product-engineer.agent.md",
  kiro: ".kiro/agents/product-engineer.md",
};

const PUBLISH_TREES = {
  claude: ".claude/skills/activity-publish-github/SKILL.md",
  github: ".github/skills/activity-publish-github/SKILL.md",
  kiro: ".kiro/skills/activity-publish-github/SKILL.md",
};

/** The D-85 type set in tie-break order, with its definitions (S-019 AC-1). */
const TYPE_SET: ReadonlyArray<readonly [string, string]> = [
  ["security", "Security vulnerability, hardening, or compliance work"],
  ["bug", "Behavior that differs from the spec or intent"],
  ["enhancement", "New or changed behavior"],
  ["refactor", "Code restructure, no behavior change"],
  ["test", "Test-only work"],
  ["docs", "Documentation changes"],
  ["chore", "Maintenance, dependencies, tooling, or CI"],
  ["tech-debt", "Deferred engineering work that fits no other type"],
];

const TIE_BREAK = "`security > bug > enhancement > refactor > test > docs > chore > tech-debt`";
const TYPE_TAGS_LINE = `- Type tags: ${TYPE_SET.map(([type]) => `\`type: ${type}\``).join(", ")}`;
const EXACTLY_ONE = "exactly one `type:` per issue";
const OTHER_RETIRED = "`type: other` is retired";
const EC_158 = "both a bug and a security problem is `type: security`";

/** The D-84 priority scale (S-019 AC-2). */
const PRIORITY_SCALE: ReadonlyArray<readonly [string, string]> = [
  ["critical", "Blocks a wave, PRD, or release from shipping"],
  ["high", "Lands in the current wave or cycle"],
  ["medium", "Lands in the next wave or cycle"],
  ["low", "Backlog"],
];
const CRITICAL_RULE =
  "carries a native `blocked by` relation from the issue it blocks plus a `**Blocks:** #N — <reason>` body line";
const BLOCKS_ANY_PRIORITY =
  "ny issue that blocks another carries the `**Blocks:**` line whatever its priority";

const RETIRED_LIST = "- Retired labels, in full:";
const PRIORITY_SENTENCE =
  "`priority: high` lands in the current wave or cycle and blocks no ship; `priority: medium` lands in the next; `priority: low` is backlog";
const DEPENDENCY_READ_ROW = "| List what an issue blocks";

/** The dependency commands (S-019 AC-3, A-89, CT-40). */
const DEPENDENCY_POST =
  "`gh api -X POST repos/{o}/{r}/issues/{blocked}/dependencies/blocked_by -F issue_id=<blocker numeric id>`";
const DEPENDENCY_DELETE =
  "`gh api -X DELETE repos/{o}/{r}/issues/{blocked}/dependencies/blocked_by/{blocker numeric id}`";
const AGENT_MAY_WRITE = "ssue dependencies are issue data an agent may write, unlike the Project";

/** The three audit findings (S-019 AC-4, A-68, A-72). */
const AUDIT_CRITICAL = "**`critical` without a blocking relation:**";
const AUDIT_TYPES = "**Zero or several `type:` labels:**";
const AUDIT_RETIRED = "**Retired label on an open issue:**";
const AUDIT_NO_LINE = "**Blocking relation without its body line:**";
const AUDIT_EXEMPT = "Issues labeled `level: prd` or `level: wave`, and tracking issues";
const AUDIT_CLOSED_BLOCKED = "A relation to an issue that has since closed still exists";

/** product-engineer's aggregation queries (S-019 AC-5, D-83, A-86). */
const AGG_FOLLOW_UPS = "**Post-wave follow-ups:**";
const AGG_BUGS = "**Bugs to fix:**";
const AGG_BLOCKERS = "**Release blockers:**";

/** activity-publish-github's one-type rule (S-019 AC-6). */
const PUBLISH_ONE_TYPE =
  "exactly one `type:` label from the github-ops type set (`enhancement`, `bug`, `security`, `refactor`, `test`, `docs`, `chore`, `tech-debt`)";

// --- github-ops (S-019, #318) -------------------------------------------------

describe("github-ops", () => {
  const trees = loadTrees(GITHUB_OPS_TREES);

  // PT-55 to PT-59 — S-019 AC-1; FR-26, D-85
  it("type set", () => {
    for (const copy of trees) {
      const labels = sectionOf(copy, "Labels");
      expect(labels, copy.path).toContain(TYPE_TAGS_LINE);
      for (const [type, definition] of TYPE_SET) {
        const row = tableRow(labels, `type: ${type}`);
        expect(row, `${copy.path}: no table row for type: ${type}`).toBeDefined();
        expect(row!, `${copy.path}: type: ${type} definition`).toContain(`| ${definition} |`);
      }
      expect(lineWith(labels, EXACTLY_ONE, copy.path), copy.path).toContain(TIE_BREAK);
      // EC-158: `bug` plus `security` resolves to `security`.
      lineWith(labels, EC_158, copy.path);
      expect(lineWith(labels, OTHER_RETIRED, copy.path), copy.path).toContain("D-85");
      // tech-debt narrowed (PT-59 negative).
      expect(copy.body, copy.path).not.toContain(
        "Refactoring, cleanup, or deferred engineering improvements",
      );
      // PT-58 negative: no `type: other` row in the table.
      expect(tableRow(labels, "type: other"), `${copy.path}: type: other row`).toBeUndefined();
    }
    for (const marker of [TYPE_TAGS_LINE, EXACTLY_ONE, EC_158, OTHER_RETIRED]) {
      expectIdenticalLine(trees, "Labels", marker);
    }
  });

  // PT-60, PT-61 — S-019 AC-2; FR-26, D-84
  it("priority scale", () => {
    for (const copy of trees) {
      const labels = sectionOf(copy, "Labels");
      for (const [priority, meaning] of PRIORITY_SCALE) {
        const row = tableRow(labels, `priority: ${priority}`);
        expect(row, `${copy.path}: no table row for priority: ${priority}`).toBeDefined();
        expect(row!, `${copy.path}: priority: ${priority} meaning`).toContain(`| ${meaning}`);
      }
      expect(copy.body, copy.path).not.toContain("Must be addressed immediately");
      // D-102 (finding 5): `high` blocks no ship, but may block another issue.
      expect(copy.body, copy.path).not.toContain("blocks nothing");
      expect(tableRow(labels, "priority: high")!, copy.path).toContain("blocks no ship");
      expect(lineWith(labels, CRITICAL_RULE, copy.path), copy.path).toContain(
        "`priority: critical`",
      );
      // EC-159: a `high` issue that blocks another keeps `high` and carries the line.
      expect(lineWith(labels, BLOCKS_ANY_PRIORITY, copy.path), copy.path).toContain("keeps `high`");
      // A blocking link is never invented (S-019 business rule, D-84).
      expect(labels, copy.path).toContain("A blocking relation is never invented");
    }
    for (const marker of [
      CRITICAL_RULE,
      BLOCKS_ANY_PRIORITY,
      "A blocking relation is never invented",
    ]) {
      expectIdenticalLine(trees, "Labels", marker);
    }
  });

  // PT-62 / CT-40 — S-019 AC-3; D-22, D-83, A-89
  it("dependency commands", () => {
    for (const copy of trees) {
      const map = sectionOf(copy, "Command Map");
      expect(map, copy.path).toContain(DEPENDENCY_POST);
      expect(map, copy.path).toContain(DEPENDENCY_DELETE);
      expect(map, copy.path).toContain(AGENT_MAY_WRITE);
      // The rows take no body, so no inline or file body form is needed.
      for (const marker of [DEPENDENCY_POST, DEPENDENCY_DELETE]) {
        expect(lineWith(map, marker, copy.path), copy.path).not.toMatch(/--body\b/);
      }
    }
    for (const marker of [DEPENDENCY_POST, DEPENDENCY_DELETE, AGENT_MAY_WRITE]) {
      expectIdenticalLine(trees, "Command Map", marker);
    }
  });

  // PT-63 — S-019 AC-4; AC-16, A-68, A-72
  it("audit checks", () => {
    for (const copy of trees) {
      const audit = sectionOf(copy, "Audit Mode");
      for (const marker of [AUDIT_CRITICAL, AUDIT_TYPES, AUDIT_RETIRED, AUDIT_NO_LINE]) {
        expect(audit, `${copy.path}: audit check ${marker}`).toContain(marker);
      }
      // D-102 (finding 6): a relation without the body line is reported too.
      const noLine = lineWith(audit, AUDIT_NO_LINE, copy.path);
      expect(noLine, copy.path).toContain("`priority: critical`");
      expect(noLine, copy.path).toContain("`**Blocks:** #N — <reason>`");
      expect(noLine, copy.path).toContain("D-102");
      expect(audit, copy.path).toContain("four convention findings");
      expect(
        squashSpaces(audit),
        `${copy.path}: no Conventions row for the missing body line`,
      ).toMatch(/^\| \d+ \| \.\.\. \| `critical` relation without a `\*\*Blocks:\*\*` line \|/m);
      // A-72: the check reads what the issue blocks; EC-160 resolved by A-72.
      const critical = lineWith(audit, AUDIT_CRITICAL, copy.path);
      expect(critical, copy.path).toContain("dependencies/blocking");
      expect(critical, copy.path).toContain(AUDIT_CLOSED_BLOCKED);
      // A-68: containers are exempt from the type check.
      expect(lineWith(audit, AUDIT_TYPES, copy.path), copy.path).toContain(AUDIT_EXEMPT);
      // The report template carries a table for the findings.
      expect(audit, copy.path).toContain("## Conventions");
    }
    for (const marker of [AUDIT_CRITICAL, AUDIT_TYPES, AUDIT_RETIRED, AUDIT_NO_LINE]) {
      expectIdenticalLine(trees, "Audit Mode", marker);
    }
  });
});

// PT-66 widened (S-019 audit finding 2): the remaining S-019 lines are
// byte-identical across the trees too.
describe("github-ops identity (finding 2)", () => {
  const trees = loadTrees(GITHUB_OPS_TREES);

  it("retired list, priority sentence and dependency read row", () => {
    expectIdenticalLine(trees, "Labels", RETIRED_LIST);
    expectIdenticalLine(trees, "Labels", PRIORITY_SENTENCE);
    expectIdenticalLine(trees, "Command Map", DEPENDENCY_READ_ROW);
  });

  it("Conventions report-template table", () => {
    const tables = trees.map((copy) => {
      const audit = sectionOf(copy, "Audit Mode");
      const start = audit.indexOf("## Conventions");
      const end = audit.indexOf("## Pull Requests", start);
      expect(start, `${copy.path}: no Conventions table`).toBeGreaterThan(-1);
      expect(end, `${copy.path}: Conventions table not followed by Pull Requests`).toBeGreaterThan(
        start,
      );
      return audit.slice(start, end);
    });
    for (const [i, table] of tables.entries()) {
      expect(table, `${trees[i].path}: Conventions table differs`).toBe(tables[0]);
    }
  });
});

// --- product-engineer (S-019, #318) -------------------------------------------

describe("product-engineer", () => {
  const trees = loadTrees(PRODUCT_ENGINEER_TREES);

  // PT-64 — S-019 AC-5; D-83, A-86
  it("aggregation", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Drift Reconciliation");
      expect(lineWith(section, AGG_FOLLOW_UPS, copy.path), copy.path).toContain(
        "`Follow-up to #N`",
      );
      const bugs = lineWith(section, AGG_BUGS, copy.path);
      expect(bugs, copy.path).toContain("`type: bug` without `level:`");
      expect(bugs, copy.path).toContain('--label "type: bug"');
      expect(lineWith(section, AGG_BLOCKERS, copy.path), copy.path).toContain(
        '--label "priority: critical"',
      );
    }
    for (const marker of [AGG_FOLLOW_UPS, AGG_BUGS, AGG_BLOCKERS]) {
      expectIdenticalLine(trees, "Drift Reconciliation", marker);
    }
    // Finding 4 (A-74): every query lifts gh's default 30-item cap.
    for (const copy of trees) {
      const section = sectionOf(copy, "Drift Reconciliation");
      for (const marker of [AGG_FOLLOW_UPS, AGG_BUGS, AGG_BLOCKERS]) {
        expect(lineWith(section, marker, copy.path), `${copy.path}: ${marker}`).toContain(
          "--limit 1000",
        );
      }
      // Finding 8: stories carry `level: story`, so the filter drops them too.
      expect(lineWith(section, AGG_BUGS, copy.path), copy.path).toContain(
        "so story and tracking issues never count",
      );
    }
  });
});

// --- activity-publish-github (S-019, #318) ------------------------------------

describe("activity-publish-github", () => {
  const trees = loadTrees(PUBLISH_TREES);

  // PT-65 — S-019 AC-6; FR-26, D-85
  it("one type", () => {
    for (const copy of trees) {
      const line = lineWith(copy.body, "**Map Stories to Issues:**", copy.path);
      expect(line, copy.path).toContain(PUBLISH_ONE_TYPE);
    }
    const lines = trees.map((copy) => lineWith(copy.body, "**Map Stories to Issues:**", copy.path));
    for (const line of lines) expect(line).toBe(lines[0]);
  });
});

// --- cross-file negatives (S-019 AC-7, PT-58, PT-67) ---------------------------

describe("S-019 negatives", () => {
  const all = [
    ...loadTrees(GITHUB_OPS_TREES),
    ...loadTrees(PRODUCT_ENGINEER_TREES),
    ...loadTrees(PUBLISH_TREES),
  ];

  // PT-58 — no copy still lists `type: other` as a valid choice.
  it("type: other appears only as retired", () => {
    for (const copy of all) {
      for (const line of copy.body.split("\n").filter((l) => l.includes("type: other"))) {
        expect(line, `${copy.path}: type: other offered as a choice`).toMatch(/retired/i);
        expect(line.startsWith("|"), `${copy.path}: type: other in a table row`).toBe(false);
      }
    }
  });

  // PT-67 — no `role:` label category (D-83); `needs:` labels stay retired (D-15).
  it("no role labels and needs labels stay retired", () => {
    for (const copy of all) {
      expect(copy.body, `${copy.path} introduces a role: label`).not.toMatch(/`role:/);
      for (const line of copy.body.split("\n").filter((l) => /`needs: /.test(l))) {
        expect(line, `${copy.path}: a needs: label offered as a choice`).toMatch(/retired/i);
      }
    }
  });
});

// --- product-engineer roadmap conversion (S-016, #319) -----------------------

const CONVERSION = "Roadmap Conversion (before migration)";
const CONVERSION_STEPS = [
  "**Draft the canonical table**",
  "one row per PRD phase or wave",
  "**Keep the existing narrative verbatim below the table**",
  "**Flag every translated Status for the user:**",
  "**Ship it as its own docs PR before migration runs:**",
] as const;
const PARTIAL_TABLE =
  "A partial table, the canonical header with at least one row, already counts as canonical";
const PAUSED = 'a narrative "paused" translates to `Not started` and is flagged';
const TWO_SECTIONS = "Two narrative sections that describe one wave give one row citing both";
const PLAN_REFUSES =
  "`dev-tasks migrate projects --plan` refuses to run without the canonical table";
const EXACT_MATCH = "maps `phase: X` only to a row whose `Phase/Wave` cell equals `X` exactly";
const NO_STATE_FILE_EDIT = "Migration edits no `workstream/planner-state-*.md` file";
const PLANNER_RESUME = "the planner's resume adds the missing `Wave issue:` line";
const NEVER_DONE = "A Status without merged evidence is never upgraded to `Done` by the conversion";
const DONE_CITATION = "a `Done` row cites the merged PR or closed issue behind it.";
// D-104 (verifier F3): a cited PR or issue is confirmed on GitHub first.
const DONE_CONFIRM =
  "Before writing `Done`, confirm on GitHub that the cited PR merged or the issue closed (`gh pr view <n> --json state` / `gh issue view <n> --json state`)";
const DONE_FALLBACK = "otherwise keep the translated Status and flag it (D-104).";
const NEVER_DONE_BULLET = "Never mark a row `Done` yourself";
const FIRST_EXCEPTION = "The first exception is a row the planner's close-out left `In progress`";
const SECOND_EXCEPTION =
  "The second exception is the roadmap conversion below, which writes `Done` only on merged evidence it confirmed on GitHub (D-104).";
// F1 (D-98, A-56): the exact match is scoped to the story's PRD.
const PRD_SCOPE =
  ", among the rows of the PRD named in the story's `[PRD-<name>]` title prefix (D-98)";
// F2: the meaning-bearing phrases, not only the bold step labels.
const MEANING: ReadonlyArray<readonly [string, string]> = [
  ["narrative kept (M3)", "never instead of it"],
  ["fixed set (M7)", "`Status` from the fixed set"],
  [
    "original word kept for the user (M9)",
    ", with the original word, for the user to confirm or correct",
  ],
  ["user approval (M4)", "the user approves the draft"],
  ["own PR (M5)", "never inside the migration's own PR"],
  ["unmapped, never fuzzy (M6)", "is listed as unmapped for the user, never fuzzy-matched"],
  [
    "state files listed as information (M8)",
    "`--plan` lists each active state file that lacks a `Wave issue:` line as information",
  ],
];

describe("product-engineer roadmap conversion (S-016)", () => {
  const trees = loadTrees(PRODUCT_ENGINEER_TREES);
  const conversion = (copy: TreeCopy): string => sectionOf(copy, CONVERSION);

  // The conversion step sits inside Roadmap Maintenance (A-86), never in
  // Drift Reconciliation, so roadmap-parity's section identity covers it.
  it("lives under Roadmap Maintenance", () => {
    for (const copy of trees) {
      const at = copy.sections.findIndex((s) => s.heading === CONVERSION);
      expect(at, `${copy.path}: no ${CONVERSION} heading`).toBeGreaterThan(-1);
      expect(copy.sections[at].level, copy.path).toBe(3);
      const parent = copy.sections
        .slice(0, at)
        .reverse()
        .find((s) => s.level === 2);
      expect(parent?.heading, copy.path).toBe("Roadmap Maintenance");
    }
  });

  // PT-68 — S-016 AC-1; FR-21, D-86. Steps in order.
  it("roadmap conversion", () => {
    for (const copy of trees) {
      const text = conversion(copy);
      let last = -1;
      for (const step of CONVERSION_STEPS) {
        const at = text.indexOf(step);
        expect(at, `${copy.path}: missing "${step}"`).toBeGreaterThan(-1);
        expect(at, `${copy.path}: "${step}" out of order`).toBeGreaterThan(last);
        last = at;
      }
      // Edge cases EC-161 (A-59), EC-162, EC-163.
      for (const marker of [PARTIAL_TABLE, PAUSED, TWO_SECTIONS]) {
        expect(text, `${copy.path}: missing "${marker}"`).toContain(marker);
      }
      for (const [what, phrase] of MEANING) {
        expect(text, `${copy.path}: ${what} lost "${phrase}"`).toContain(phrase);
      }
    }
  });

  // PT-69 — S-016 AC-2; D-86
  it("migration dependency", () => {
    for (const copy of trees) {
      const text = conversion(copy);
      expect(text, copy.path).toContain(PLAN_REFUSES);
      expect(text, copy.path).toContain(EXACT_MATCH);
      expect(text, copy.path).toContain(EXACT_MATCH + PRD_SCOPE);
    }
  });

  // PT-70 — S-016 AC-3; D-89, D-99
  it("state files", () => {
    for (const copy of trees) {
      const line = lineWith(conversion(copy), NO_STATE_FILE_EDIT, copy.path);
      expect(line, copy.path).toContain(PLANNER_RESUME);
    }
  });

  // PT-72 — S-016 BR: no Done from narrative alone. Sentence-based and
  // case-insensitive (F2, probes M1 and M2): every sentence or clause naming
  // done, with or without backticks, must be one of the two allowed ones.
  it("never upgrades a status to Done without merged evidence", () => {
    const allowed = [NEVER_DONE, DONE_CITATION, DONE_CONFIRM];
    for (const copy of trees) {
      const text = conversion(copy);
      expect(text, copy.path).toContain(`${NEVER_DONE}; ${DONE_CITATION}`);
      expect(text, copy.path).toContain(`${DONE_CITATION} ${DONE_CONFIRM}; ${DONE_FALLBACK}`);
      const clauses = text
        .split(/\n|;\s+|(?<=[.!?])\s+/)
        .map((c) => c.trim())
        .filter((c) => /\bdone\b/i.test(c));
      for (const clause of clauses) {
        expect(
          allowed,
          `${copy.path}: a sentence lets the conversion set Done: ${clause}`,
        ).toContain(clause);
      }
    }
  });

  // D-104: Roadmap Maintenance's never-Done bullet names the conversion as
  // its second exception, only on confirmed merged evidence.
  it("names the conversion as the second exception to never marking Done", () => {
    for (const copy of trees) {
      const line = lineWith(sectionOf(copy, "Roadmap Maintenance"), NEVER_DONE_BULLET, copy.path);
      expect(line, copy.path).toContain(FIRST_EXCEPTION);
      expect(line, copy.path).toContain(SECOND_EXCEPTION);
      expect(line, copy.path).not.toContain("The one exception");
    }
    expectIdenticalLine(trees, "Roadmap Maintenance", NEVER_DONE_BULLET);
  });

  // PT-71 — S-016 AC-4: the whole subsection is byte-identical across trees.
  it("is byte-identical across the three trees", () => {
    const texts = trees.map(conversion);
    for (const [i, text] of texts.entries()) {
      expect(text, `${trees[i].path}: ${CONVERSION} differs`).toBe(texts[0]);
    }
    for (const marker of [...CONVERSION_STEPS, PLAN_REFUSES, NO_STATE_FILE_EDIT, NEVER_DONE]) {
      expectIdenticalLine(trees, CONVERSION, marker);
    }
  });
});

// --- core/migrate-projects (S-013, #320) ---------------------------------------

// PT-81 — A-87, D-85 (deferred from S-019): the type set is defined once in
// code, and the code agrees with github-ops' Labels section. Read from the
// prompt here, not from this file's own TYPE_SET, so the pin compares the
// two sources the agents and the CLI actually use.
const RETIRED_LINE = "- Retired labels, in full: ";

/**
 * github-ops' retired list as exact names plus `wave:`-style prefixes. The
 * sentence after the list (GitHub's default labels, D-100) is not part of it.
 */
function retiredFromPrompt(labelsSection: string): { names: string[]; prefixes: string[] } {
  const line = labelsSection.split("\n").find((l) => l.startsWith(RETIRED_LINE));
  if (line === undefined) throw new Error("no Retired labels line");
  const list = line.slice(RETIRED_LINE.length).split(". GitHub's default")[0];
  const prefixes = [...list.matchAll(/every `([^`]+)` label/g)].map((m) => m[1]);
  const names = [...list.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    .filter((n) => !prefixes.includes(n));
  return { names, prefixes };
}

function retiredDiff(
  prompt: { names: string[]; prefixes: string[] },
  codeNames: readonly string[],
  codePrefixes: readonly string[],
): { onlyInPrompt: string[]; onlyInCode: string[] } {
  const p = new Set([...prompt.names, ...prompt.prefixes.map((x) => `${x}*`)]);
  const c = new Set([...codeNames, ...codePrefixes.map((x) => `${x}*`)]);
  return {
    onlyInPrompt: [...p].filter((x) => !c.has(x)).sort(),
    onlyInCode: [...c].filter((x) => !p.has(x)).sort(),
  };
}

describe("conventions.ts matches github-ops (PT-81)", () => {
  const labels = sectionOf(loadTrees(GITHUB_OPS_TREES)[0], "Labels");

  it("the type set and its tie-break order", () => {
    const tags = labels.split("\n").find((l) => l.startsWith("- Type tags: "));
    expect(tags, "no Type tags line").toBeDefined();
    const fromPrompt = [...tags!.matchAll(/`type: ([a-z-]+)`/g)].map((m) => m[1]);
    expect([...CODE_TYPE_SET]).toEqual(fromPrompt);
    const tieBreak = labels.match(/`((?:[a-z-]+ > )+[a-z-]+)`/);
    expect(tieBreak, "no tie-break literal").not.toBeNull();
    expect(CODE_TYPE_SET.join(" > ")).toBe(tieBreak![1]);
  });

  it("each type's definition", () => {
    for (const type of CODE_TYPE_SET) {
      const row = tableRow(labels, `type: ${type}`);
      expect(row, `no row for type: ${type}`).toBeDefined();
      expect(row!).toContain(`| ${CODE_TYPE_DEFINITIONS[type]} |`);
    }
  });

  // S-014 (A-71, D-103): batch 1 creates and describes labels from code, so
  // the colours and descriptions it writes are github-ops' table, once.
  it("each type colour, and each level and priority colour and description (A-71, D-103)", () => {
    for (const type of CODE_TYPE_SET) {
      expect(tableRow(labels, `type: ${type}`)!).toContain(`| \`#${CODE_TYPE_COLORS[type]}\` |`);
    }
    const defs = { ...CODE_LEVEL_DEFINITIONS, ...CODE_PRIORITY_DEFINITIONS };
    expect(Object.keys(defs).sort()).toEqual([
      "level: prd",
      "level: story",
      "level: wave",
      "priority: critical",
      "priority: high",
      "priority: low",
      "priority: medium",
    ]);
    for (const [name, d] of Object.entries(defs)) {
      const row = tableRow(labels, name);
      expect(row, `no row for ${name}`).toBeDefined();
      expect(row!).toContain(`| \`#${d.color}\` | ${d.description} |`);
      expect(d.description.length, name).toBeLessThanOrEqual(100);
    }
  });

  // D-107 (verifier F-1 on PR #329): batch 6 writes only github-ops' PRD
  // States, and the vocabulary names `not started` for an unpublished wave.
  it("the PRD State vocabulary, in every tree (D-107)", () => {
    const cells = loadTrees(GITHUB_OPS_TREES).map((copy) => {
      const section = sectionOf(copy, "Status comment");
      const row = section.split("\n").find((l) => l.startsWith("| <id> |"));
      expect(row, copy.path).toBeDefined();
      return row!.split("|")[2].trim();
    });
    for (const cell of cells) {
      const states = cell
        .replace(/^<|>$/g, "")
        .split(/, | or /)
        .map((x) => x.trim());
      expect(states).toEqual([...CODE_PRD_STATES]);
    }
    for (const copy of loadTrees(GITHUB_OPS_TREES)) {
      expect(sectionOf(copy, "Status comment"), copy.path).toContain(
        "A roadmap wave not yet published reads `not started`, with `—` in the `Wave issue` column (D-107).",
      );
    }
  });

  // F-7 (verifier audit on PR #328): compared both ways, by exact name.
  it("the retired labels, both ways, by exact name (D-91)", () => {
    const fromPrompt = retiredFromPrompt(labels);
    expect(retiredDiff(fromPrompt, CODE_RETIRED_LABELS, CODE_RETIRED_LABEL_PREFIXES)).toEqual({
      onlyInPrompt: [],
      onlyInCode: [],
    });
    for (const name of CODE_RETIRED_TYPE_LABELS) expect(fromPrompt.names).toContain(name);
  });

  it("the two-way comparison catches a label dropped from either side", () => {
    const fromPrompt = retiredFromPrompt(labels);
    const dropped = CODE_RETIRED_LABELS.filter((n) => n !== "needs: merge");
    expect(retiredDiff(fromPrompt, dropped, CODE_RETIRED_LABEL_PREFIXES).onlyInPrompt).toEqual([
      "needs: merge",
    ]);
    const extra = [...CODE_RETIRED_LABELS, "needs: review"];
    expect(retiredDiff(fromPrompt, extra, CODE_RETIRED_LABEL_PREFIXES).onlyInCode).toEqual([
      "needs: review",
    ]);
    expect(retiredDiff(fromPrompt, CODE_RETIRED_LABELS, []).onlyInPrompt).toEqual(["wave:*"]);
  });

  it("the default labels are neither retired nor a type (D-100)", () => {
    const retired = labels.split("\n").find((l) => l.startsWith(RETIRED_LINE))!;
    for (const name of ["bug", "documentation", "enhancement"]) {
      expect(Object.keys(CODE_DEFAULT_LABEL_SUGGESTIONS)).toContain(name);
      expect(retired).toContain(`\`${name}\``);
      expect(retiredFromPrompt(labels).names).not.toContain(name);
    }
  });
});

// PT-80 — A-60, D-81, D-22: no Project write from the migration module,
// `apply.ts` (S-015) included: it prints batch 7's steps from the plan file
// and never names a Project command itself. Only
// S-014's `plan.ts` carries the batch 7 strings, only inside its batch 7
// builder (`projectCleanupSteps`), and only the read query and the delete
// template it prints for the user (D-97); no file may build a `project` argv
// for the runner, and the CLI never runs a `gh project` call.
/** GraphQL ProjectV2 types and mutations, and REST `/projects` paths (F-8). */
const PROJECT_API = /ProjectV2|projectV2|\/projects\b/;

/** The line range of `projectCleanupSteps` in plan.ts: its signature to its closing brace. */
function batchSevenBuilder(lines: string[]): { start: number; end: number } {
  const start = lines.findIndex((l) => l.startsWith("export function projectCleanupSteps("));
  if (start === -1) throw new Error("plan.ts has no projectCleanupSteps");
  const end = lines.findIndex((l, i) => i > start && l === "}");
  return { start, end };
}

describe("no Project calls in core/migrate-projects (PT-80)", () => {
  const DIR = "core/migrate-projects";
  const files = readdirSync(resolve(ROOT, DIR)).filter((f) => f.endsWith(".ts"));
  const PRINTED_ONLY = new Map([["plan.ts", /^(item-list|item-delete)$/]]);

  it("the Project API pattern catches GraphQL and REST forms, not the command name", () => {
    for (const probe of [
      'gh api graphql -f query="mutation { addProjectV2ItemById(input: $i) { item { id } } }"',
      "deleteProjectV2Item",
      "projectV2(number: 5)",
      "repos/o/r/projects",
      "users/o/projects?per_page=100",
    ]) {
      expect(probe, probe).toMatch(PROJECT_API);
    }
    for (const ok of [
      "migrate projects --plan",
      "workstream/migration-projects.md",
      "projects-tracking",
    ]) {
      expect(ok, ok).not.toMatch(PROJECT_API);
    }
  });

  it("the builder range catches a batch 7 string anywhere else in plan.ts", () => {
    const probe = [
      "const x = `gh project item-list 1`;",
      "export function projectCleanupSteps(owner: string): string[] {",
      "  return [`gh project item-delete <n> --owner ${owner} --id <item-id>`];",
      "}",
    ];
    const { start, end } = batchSevenBuilder(probe);
    const outside = probe
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) => /\bgh\s+project\b/.test(l) && !(i > start && i < end));
    expect(outside.map((o) => o.i)).toEqual([0]);
  });

  it("the walk finds the module", () => {
    for (const f of [
      "gh.ts",
      "snapshot.ts",
      "classify.ts",
      "planfile.ts",
      "conventions.ts",
      "index.ts",
      "roadmap.ts",
      "map.ts",
      "answers.ts",
      "plan.ts",
      // S-015: the writer is walked too; it may print batch 7, never name it.
      "apply.ts",
      "summary.ts",
    ]) {
      expect(files).toContain(f);
    }
  });

  it("no `gh project` string outside plan.ts's printed batch 7, and no `project` argv", () => {
    expect(files).toContain("plan.ts");
    for (const file of files) {
      const lines = readFileSync(resolve(ROOT, DIR, file), "utf-8").split("\n");
      const builder = file === "plan.ts" ? batchSevenBuilder(lines) : null;
      for (const [index, line] of lines.entries()) {
        const where = `${DIR}/${file}:${index + 1}`;
        // A-60: only inside the batch 7 builder, and only the two printed commands.
        if (/\bgh\s+project\b/.test(line)) {
          expect(
            builder !== null && index > builder.start && index < builder.end,
            `${where} names gh project outside the batch 7 builder`,
          ).toBe(true);
        }
        expect(line, `${where} builds a project argv`).not.toMatch(/["'`]project["'`]/);
        // F-8: a GraphQL ProjectV2 mutation or a REST `/projects` path is a Project call too.
        expect(line, `${where} names a Project API`).not.toMatch(PROJECT_API);
        for (const m of line.matchAll(/\bgh\s+project\s+([a-z-]+)/g)) {
          const allowed = PRINTED_ONLY.get(file);
          expect(
            allowed !== undefined && allowed.test(m[1]),
            `${where} names gh project ${m[1]}`,
          ).toBe(true);
        }
      }
    }
  });
});

// --- github-ops migration mode and the runbook (S-017, #323) -----------------

const MIGRATION_MODE = "Migration Mode";
const RUNBOOK_SLUG = "runbook-migrate-to-projects-tracking";
const RUNBOOK_PATH = `docs/runbooks/${RUNBOOK_SLUG}.md`;

/** The migration mode with its heading line, so a renamed heading fails too. */
function migrationMode(copy: TreeCopy): string {
  return `## ${MIGRATION_MODE}\n${sectionOf(copy, MIGRATION_MODE)}`;
}

/** Assert each marker occurs in `text`, each after the one before it. */
function expectInOrder(text: string, markers: readonly string[], label: string): void {
  let cursor = -1;
  for (const marker of markers) {
    const at = text.indexOf(marker, cursor + 1);
    expect(at, `${label}: "${marker}" missing or out of order`).toBeGreaterThan(cursor);
    cursor = at;
  }
}

/** PT-73: the eight steps of the conversation, in order (D-79, A-50, D-93). */
const MODE_STEPS = [
  "1. Run `dev-tasks migrate projects --plan`.",
  "2. Present each review item as one question with a recommendation",
  "3. Write each answer into the plan file",
  "4. Run `dev-tasks migrate projects --plan` again.",
  "5. Ask the user for explicit approval",
  "6. Set the header line to exactly `Approved: yes`",
  "7. Run `dev-tasks migrate projects --apply`.",
  "8. Hand the Project batch to the user",
  "9. Commit the plan file and open the chore PR:",
] as const;

/** PT-74: the two prohibitions (D-80, D-81, D-22). */
const NEVER_APPLY =
  "`github-ops` **MUST NOT** run `--apply` without the user's explicit approval of the current plan file (D-80).";
const NEVER_PROJECT =
  "`github-ops` **MUST NOT** write the Project, in this mode or any other: the user runs batch 7 (D-22, D-81).";
const DECLINED = "A declined approval writes nothing and keeps the plan file.";
const STANDALONE = "An unmapped issue answered `standalone` gets no hierarchy write.";
const RERUN_RESETS = "resets `Approved: no`";

/** Phrasings that let an agent infer approval (PT-74 negative). */
const IMPLIED_APPROVAL =
  /does not object|doesn't object|no objection|unless the user|assume[sd]? (the user )?approv|implied approval|implicit approval is enough|silence (means|counts as) approval/i;

/** CT-39: the CLI names the mode uses, exactly as the CLI defines them. */
const CLI_NAMES = [
  "--plan",
  "--apply",
  "--plan-file",
  "--out",
  "workstream/migration-projects.md",
  "`Approved: yes`",
  "`gh auth login`",
] as const;

describe("github-ops > migration mode (S-017 AC-2, PT-73, PT-74, PT-78, CT-39)", () => {
  const trees = loadTrees(GITHUB_OPS_TREES);

  it("the steps, in order, in every tree (PT-73)", () => {
    for (const copy of trees) expectInOrder(migrationMode(copy), MODE_STEPS, copy.path);
  });

  it("re-runs --plan after the answers, before approval (A-50)", () => {
    for (const copy of trees) {
      const mode = migrationMode(copy);
      expect(mode, copy.path).toContain(RERUN_RESETS);
      expect(mode, copy.path).toContain("`--apply` never turns an answer into a write (A-50).");
    }
  });

  it("never applies without explicit approval, never writes the Project (PT-74)", () => {
    for (const copy of trees) {
      const mode = migrationMode(copy);
      for (const rule of [NEVER_APPLY, NEVER_PROJECT, DECLINED, STANDALONE]) {
        expect(mode, `${copy.path}: ${rule}`).toContain(rule);
      }
    }
  });

  it("no sentence lets the agent infer approval (PT-74 negative)", () => {
    for (const copy of trees) {
      expect(migrationMode(copy), copy.path).not.toMatch(IMPLIED_APPROVAL);
    }
    for (const probe of [
      "Proceed if the user does not object.",
      "With no objection, run --apply.",
      "Assume approval after a minute.",
    ]) {
      expect(probe, probe).toMatch(IMPLIED_APPROVAL);
    }
  });

  it("names the CLI flags, the file and the exits it reacts to (CT-39)", () => {
    for (const copy of trees) {
      const mode = migrationMode(copy);
      for (const name of CLI_NAMES) expect(mode, `${copy.path}: ${name}`).toContain(name);
      for (const exit of ["`0`", "`1`", "`2`", "`11`", "`14`"]) {
        expect(mode, `${copy.path}: exit ${exit}`).toContain(`Exit ${exit}`);
      }
    }
  });

  it("points to the runbook and the plan's batch 7 without quoting a Project command (A-61)", () => {
    for (const copy of trees) {
      const mode = migrationMode(copy);
      expect(mode, copy.path).toContain(`\`${RUNBOOK_PATH}\``);
      expect(mode, copy.path).toContain("batch 7");
      expect(mode, copy.path).not.toMatch(/gh\s+project|item-(delete|list|edit|add|archive)/);
    }
  });

  it("commits the plan file with git add -f on the chore branch (D-93)", () => {
    for (const copy of trees) {
      const mode = migrationMode(copy);
      expect(mode, copy.path).toContain("`git add -f workstream/migration-projects.md`");
      expect(mode, copy.path).toContain("`chore/<issue-number>-projects-migration`");
    }
  });

  it("is listed under When to Invoke", () => {
    for (const copy of trees) {
      expect(sectionOf(copy, "When to Invoke"), copy.path).toContain(
        "Migrate an existing repository to the projects-tracking conventions ([Migration Mode](#migration-mode))",
      );
    }
  });

  // PT-78 — the whole section is byte-identical across the three trees.
  it("is byte-identical across the three trees (PT-78)", () => {
    const texts = trees.map(migrationMode);
    for (const [i, text] of texts.entries()) {
      expect(text, `${trees[i].path}: ${MIGRATION_MODE} differs`).toBe(texts[0]);
    }
  });
});

// PT-79 — A-61: no prompt-tree file names the Project item commands, so
// PT-28b holds while the mode hands batch 7 to the user.
describe("no Project item command in a prompt tree (PT-79)", () => {
  const ITEM_COMMAND = /gh\s+project\s+item-(delete|list)\b/;

  it("the pattern catches both commands", () => {
    expect("gh project item-delete 5 --owner o --id X").toMatch(ITEM_COMMAND);
    expect("gh  project item-list 5").toMatch(ITEM_COMMAND);
    expect("the Project batch").not.toMatch(ITEM_COMMAND);
  });

  it("holds for every tracked file under .claude, .github and .kiro", () => {
    const files = trackedUnder([".claude/", ".github/", ".kiro/"]);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(resolve(ROOT, file), "utf-8");
      expect(content, `${file} names a Project item command`).not.toMatch(ITEM_COMMAND);
    }
  });
});

/** Tracked text files under the given prefixes (`git ls-files`). */
function trackedUnder(prefixes: readonly string[]): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf-8" })
    .split("\0")
    .filter((f) => f.length > 0 && prefixes.some((p) => f.startsWith(p)))
    .filter((f) => /\.(md|sh|ya?ml|json|ts)$/.test(f));
}

/** The text between `## <heading>` and the next `## ` heading. */
function runbookSection(content: string, heading: string): string {
  const start = content.indexOf(`\n## ${heading}\n`);
  expect(start, `runbook has no "## ${heading}"`).toBeGreaterThan(-1);
  const rest = content.slice(start + heading.length + 5);
  const next = rest.search(/\n## /);
  return oneLine(next === -1 ? rest : rest.slice(0, next));
}

/** Prose wraps at any space: compare with every whitespace run as one space. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** PT-75: AC-1's steps, in order, under `## Steps` (A-62). */
const RUNBOOK_STEPS = [
  "### 1. Check the roadmap",
  "Roadmap Conversion (before migration)",
  "### 2. Generate the plan",
  "dev-tasks migrate projects --plan",
  "### 3. Answer the review lists",
  "standalone",
  "### 4. Re-run the plan",
  "resets `Approved: no`",
  "### 5. Approve",
  "Approved: yes",
  "### 6. Apply",
  "dev-tasks migrate projects --apply",
  "### 7. Run the Project cleanup batch",
  "gh project item-list <n> --owner <owner> --limit 500 --format json",
  "gh project item-delete <n> --owner <owner> --id <item-id>",
  "Workflows page",
  "### 8. Commit the plan file and open a PR",
  "chore/<issue-number>-projects-migration",
  "git add -f workstream/migration-projects.md",
  "gh pr create",
] as const;

describe("docs > runbook sections (S-017 AC-1, PT-75)", () => {
  const exists = existsSync(resolve(ROOT, RUNBOOK_PATH));
  const content = exists ? readFileSync(resolve(ROOT, RUNBOOK_PATH), "utf-8") : "";

  it("exists, with the five frontmatter keys", () => {
    expect(exists, `${RUNBOOK_PATH} is missing`).toBe(true);
    const block = content.match(/^---\n([\s\S]*?)\n---\n/);
    expect(block, "no frontmatter").not.toBeNull();
    for (const key of ["name", "trigger", "owner", "last_verified", "related"]) {
      expect(block![1], `frontmatter key ${key}`).toMatch(new RegExp(`^${key}:`, "m"));
    }
    expect(block![1]).toContain(`name: ${RUNBOOK_SLUG}`);
  });

  it("carries AC-1's steps, in order, inside ## Steps", () => {
    expectInOrder(runbookSection(content, "Steps"), RUNBOOK_STEPS, RUNBOOK_PATH);
  });

  it("states --apply's exits 0, 1, 2, 11 and 14 and the lost-write-back recovery", () => {
    const steps = runbookSection(content, "Steps");
    for (const exit of ["`0`", "`1`", "`2`", "`11`", "`14`"]) {
      expect(steps, `exit ${exit}`).toMatch(new RegExp(`\\| ${exit} \\|`));
    }
    expect(steps).toContain("lost first write-back");
  });

  it("verifies by re-planning to a scratch path (A-65, DF-27)", () => {
    const verification = runbookSection(content, "Verification");
    expect(verification).toContain("--plan --out");
    expect(verification).toContain("skipped(already applied)");
  });

  it("rolls back by hand from the plan file, deleting nothing", () => {
    const rollback = runbookSection(content, "Rollback");
    for (const marker of [
      "by hand",
      "workstream/migration-projects.md",
      "sub-issue",
      "gh issue close",
      "Nothing is ever deleted",
    ]) {
      expect(rollback, marker).toContain(marker);
    }
  });

  it("states the S-017 edge cases (EC-164, EC-165, EC-166)", () => {
    for (const marker of [
      "answered `standalone`",
      "Declining approval writes nothing",
      "An interrupted `--apply`",
    ]) {
      expect(oneLine(content), marker).toContain(marker);
    }
  });
});

describe("docs > runbook indexed and sole item-delete file (S-017 AC-4, AC-5, PT-76, PT-77)", () => {
  it("docs/runbooks/README.md links the runbook (PT-76)", () => {
    const index = readFileSync(resolve(ROOT, "docs/runbooks/README.md"), "utf-8");
    expect(index).toContain(`](${RUNBOOK_SLUG}.md)`);
  });

  it("docs-structure reports nothing for it (PT-76)", () => {
    const failures = checkDocsStructure(ROOT).failures.filter((f) =>
      f.message.includes(RUNBOOK_SLUG),
    );
    expect(failures).toEqual([]);
  });

  it("only the runbook names gh project item-delete under docs/ (PT-77)", () => {
    const naming = trackedUnder(["docs/"]).filter((file) =>
      /gh\s+project\s+item-delete\b/.test(readFileSync(resolve(ROOT, file), "utf-8")),
    );
    expect(naming).toEqual([RUNBOOK_PATH]);
  });
});
