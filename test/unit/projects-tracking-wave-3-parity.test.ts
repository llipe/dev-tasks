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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

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
// F1 (D-98, A-56): the exact match is scoped to the story's PRD.
const PRD_SCOPE =
  ", among the rows of the PRD named in the story's `[PRD-<name>]` title prefix (D-98)";
// F2: the meaning-bearing phrases, not only the bold step labels.
const MEANING: ReadonlyArray<readonly [string, string]> = [
  ["narrative kept (M3)", "never instead of it"],
  ["fixed set (M7)", "`Status` from the fixed set"],
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
    const allowed = [NEVER_DONE, DONE_CITATION];
    for (const copy of trees) {
      const text = conversion(copy);
      expect(text, copy.path).toContain(`${NEVER_DONE}; ${DONE_CITATION}`);
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
