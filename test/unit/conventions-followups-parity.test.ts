/**
 * Parity checks for the conventions follow-ups #286, #287, #306 and #309,
 * plus the pre-hierarchy wave row in github-ops's PRD status comment.
 * Each `it` reads the three platform tree copies, asserts marker sentences
 * section-scoped, and pins the changed line identical across the trees.
 *
 * Helpers are copied from `projects-tracking-parity.test.ts` so this file
 * has no cross-test import.
 *
 * Decisions: D-73 (pre-hierarchy wave row, RD-12), D-75 (main-thread wave
 * comment header fill, RD-17), D-76 (github-ops carve-out and `chore`
 * branch type), D-78 (memo duplicate policy). Closing paths: RD-15.
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

/** Split into heading sections; lines inside a ``` fence are never headings. */
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

/** Section `at` plus every following deeper section, child headings kept. */
function collectSection(sections: Section[], at: number): string {
  const parts = [sections[at].text];
  for (let i = at + 1; i < sections.length && sections[i].level > sections[at].level; i++) {
    parts.push(`${"#".repeat(sections[i].level)} ${sections[i].heading}`, sections[i].text);
  }
  return parts.join("\n");
}

/** One section by heading text and, optionally, by a substring of its body. */
function sectionOf(copy: TreeCopy, heading: string, containing?: string): string {
  const candidates = copy.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.heading.includes(heading))
    .map(({ index }) => collectSection(copy.sections, index));
  const match = candidates.find((text) => containing === undefined || text.includes(containing));
  expect(match, `${copy.path}: no section with heading containing "${heading}"`).toBeDefined();
  return match!;
}

/** Collapse runs of spaces so a table row matches regardless of padding. */
function squashSpaces(text: string): string {
  return text.replace(/[ \t]+/g, " ");
}

/** The one line of `text` containing `marker`; fails on zero or several matches. */
function lineWith(text: string, marker: string, label = "text"): string {
  const lines = text.split("\n").filter((line) => line.includes(marker));
  expect(lines.length, `${label}: expected exactly one line containing "${marker}"`).toBe(1);
  return lines[0];
}

/** Assert every collected value is the same string across the trees. */
function expectIdentical(values: string[], label: string): void {
  expect(values.length, label).toBe(3);
  expect(new Set(values).size, `${label} differs across trees`).toBe(1);
}

// --- github-ops (#286, #306, #309, D-73) -------------------------------------

const GITHUB_OPS_TREES = {
  claude: ".claude/agents/github-ops.md",
  github: ".github/agents/github-ops.agent.md",
  kiro: ".kiro/agents/github-ops.md",
};

describe("github-ops", () => {
  const trees = loadTrees(GITHUB_OPS_TREES);

  // #286 — Multi-Line Body Formatting carries the `--body-file` method only.
  it("multi-line body: --body-file only, identical in all trees", () => {
    const sections: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Multi-Line Body Formatting");
      expect(section, copy.path).toContain("**`gh --body-file` only.**");
      expect(section, copy.path).toContain("#### Mandatory Verification After Write");
      // No inline form is offered as acceptable: git-guard blocks inline `--body`.
      expect(section, copy.path).not.toMatch(/`\$'\.\.\.'` quoting/);
      expect(section, copy.path).not.toMatch(/ANSI-C quoting \*\*MAY\*\*/);
      expect(section, copy.path).not.toContain("**`printf` piping**");
      expect(section, copy.path).not.toContain("in order of preference");
      expect(section, copy.path).toMatch(/Inline `--body` \*\*MUST NOT\*\* be used/);
      sections.push(section);
    }
    expectIdentical(sections, "Multi-Line Body Formatting section");
  });

  // #286 — the rule citation the other trees carry is in the Claude tree too.
  it("multi-line body: non-negotiable rule 8 in all trees", () => {
    const rules: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Non-Negotiable Rules");
      const rule = lineWith(section, "No shell-interpolated multi-line bodies", copy.path);
      expect(rule, copy.path).toMatch(/^8\. /);
      expect(rule, copy.path).toContain("#multi-line-body-formatting");
      rules.push(rule);
    }
    expectIdentical(rules, "non-negotiable rule 8");
  });

  // #306 / D-76 — a story or wave tracking issue is never closed by an agent.
  it("issue closure attribution carve-out", () => {
    const lines: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Issue Closure Attribution");
      const line = lineWith(section, "never closed by an agent", copy.path);
      for (const marker of [
        "story or wave tracking issue",
        "`Closes`",
        "base is the default branch",
        "D-22",
        "D-54",
        "D-76",
      ]) {
        expect(line, `${copy.path}: carve-out lacks ${marker}`).toContain(marker);
      }
      lines.push(line);
    }
    expectIdentical(lines, "closure carve-out");
  });

  // #306 / D-76 — the operations table row names the carve-out.
  it("command map close row carve-out", () => {
    const rows: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Command Map");
      const row = lineWith(section, "| Close issue with attribution", copy.path);
      expect(row, copy.path).toContain("never a story or wave issue");
      rows.push(squashSpaces(row));
    }
    expectIdentical(rows, "Close issue row");
  });

  // #306 / D-76 — `chore` is a general issue-keyed type; planner Phase 6's
  // close-out branch `chore/<plan-id>-closeout` is the one exception.
  it("chore branch type", () => {
    const rows: string[] = [];
    const rules: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Branch Naming");
      const row = section.split("\n").find((line) => /^\| `chore`\s+\|/.test(line));
      expect(row, `${copy.path}: no chore row`).toBeDefined();
      expect(row!, copy.path).toContain("tied to an issue");
      expect(row!, copy.path).toContain("`chore/306-github-ops-carve-outs`");
      rows.push(squashSpaces(row!));
      const rule = lineWith(section, "Branches of type `chore`", copy.path);
      for (const marker of [
        "`chore/<issue-number>-<short-description>`",
        "`chore/<plan-id>-closeout`",
        "Phase 6",
        "close-out",
        "no issue of its own",
        "D-76",
      ]) {
        expect(rule, `${copy.path}: chore rule lacks ${marker}`).toContain(marker);
      }
      // The general form carries no planner-only restriction.
      expect(rule, copy.path).not.toMatch(/Only the planner creates/);
      rules.push(rule);
    }
    expectIdentical(rows, "chore row");
    expectIdentical(rules, "chore rule");
  });

  // #309 / D-75 — Integration HEAD reads none when there is no integration branch.
  it("wave template Integration HEAD line", () => {
    const lines: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Status comment");
      const line = lineWith(section, "Integration HEAD:", copy.path);
      expect(line, copy.path).toBe("Integration HEAD: `<sha>` or none");
      lines.push(line);
    }
    expectIdentical(lines, "Integration HEAD line");
  });

  // D-73 / RD-12 — a wave that predates the hierarchy still gets a PRD row.
  it("PRD table: pre-hierarchy wave row", () => {
    const rules: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Status comment");
      const fence = (section.match(/```text\n[\s\S]*?```/g) ?? []).find((f) =>
        f.includes("| Wave "),
      );
      expect(fence, `${copy.path}: no PRD status template`).toBeDefined();
      const row = fence!.split("\n").find((line) => line.startsWith("| <id>"));
      expect(row, `${copy.path}: no PRD template row`).toBeDefined();
      expect(row!.split("|")[3].trim(), copy.path).toBe("#<issue> or —");
      const rule = lineWith(
        section,
        "predates the PRD and wave tracking-issue hierarchy",
        copy.path,
      );
      for (const marker of [
        "no wave issue",
        "still gets a row",
        "`—` in the `Wave issue` column",
        "`docs/roadmap.md`",
        "`shipped`",
        "D-73",
        "RD-12",
      ]) {
        expect(rule, `${copy.path}: pre-hierarchy rule lacks ${marker}`).toContain(marker);
      }
      // A separate line: the existing one-row-per-wave rule stays one line.
      expect(rule, copy.path).not.toContain("one row per wave");
      rules.push(rule);
    }
    expectIdentical(rules, "pre-hierarchy wave rule");
  });
});

// --- implement (#309, D-75) --------------------------------------------------

const IMPLEMENT_TREES = {
  claude: ".claude/skills/implement/SKILL.md",
  github: ".github/instructions/implement.instructions.md",
  kiro: ".kiro/steering/implement.md",
};

describe("implement", () => {
  const trees = loadTrees(IMPLEMENT_TREES);

  it("main-thread wave comment header fill", () => {
    const lines: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Wave Status Update (Main Thread Only)");
      const line = lineWith(section, "D-75", copy.path);
      for (const marker of [
        "`Current story` names this story",
        "`Last merged PR` and `Integration HEAD` keep the existing comment's values",
        "read `none` when creating",
        "`Gates` carries this story's gates",
      ]) {
        expect(line, `${copy.path}: header fill lacks ${marker}`).toContain(marker);
      }
      lines.push(line);
    }
    expectIdentical(lines, "header fill rule");
  });
});

// --- developer (#309, RD-15) -------------------------------------------------

const DEVELOPER_TREES = {
  claude: ".claude/agents/developer.md",
  github: ".github/agents/developer.agent.md",
  kiro: ".kiro/agents/developer.md",
};

describe("developer", () => {
  const trees = loadTrees(DEVELOPER_TREES);

  it("rule 6 states both closing paths", () => {
    const rules: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Non-Negotiable Operating Rules");
      const rule = lineWith(section, "**Do not close the issue:**", copy.path);
      for (const marker of [
        // Pinned by projects-tracking-parity PT-20.
        "You **MUST NOT** close the issue; GitHub closes it when the consolidated PR merges to main",
        "under the `planner`",
        "single-issue work without a planner",
        "story PR",
        "default branch",
        "`Closes #<issue-number>`",
        "nobody closes it by hand",
        "closes nothing",
      ]) {
        expect(rule, `${copy.path}: rule 6 lacks ${marker}`).toContain(marker);
      }
      rules.push(rule);
    }
    expectIdentical(rules, "rule 6");
  });

  it("completion gate 12 states both closing paths", () => {
    const rules: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Completion Gate");
      const rule = lineWith(section, "close the GitHub Issue", copy.path);
      expect(rule, copy.path).toMatch(/^12\. /);
      for (const marker of [
        "nobody closes it by hand",
        "consolidated PR",
        "single-issue work without a planner",
        "story PR itself",
        "(rule 6)",
      ]) {
        expect(rule, `${copy.path}: gate 12 lacks ${marker}`).toContain(marker);
      }
      expect(rule, copy.path).not.toContain(
        "GitHub closes it when the consolidated PR merges to main (rule 6)",
      );
      rules.push(rule);
    }
    expectIdentical(rules, "completion gate 12");
  });
});

// --- memo duplicate policy (#287, D-78) --------------------------------------

const PRODUCT_ENGINEER_TREES = {
  claude: ".claude/commands/product-engineer.md",
  github: ".github/agents/product-engineer.agent.md",
  kiro: ".kiro/agents/product-engineer.md",
};

const MEMO_SKILL_TREES = {
  claude: ".claude/skills/memo-cli-usage/SKILL.md",
  github: ".github/skills/memo-cli-usage/SKILL.md",
  kiro: ".kiro/skills/memo-cli-usage/SKILL.md",
};

describe("memo duplicate policy", () => {
  it("product-engineer decision write-back uses create-new per decision", () => {
    const sections: string[] = [];
    for (const copy of loadTrees(PRODUCT_ENGINEER_TREES)) {
      const section = sectionOf(copy, "Decision Write-Back");
      const fence = section.match(/```bash\n[\s\S]*?```/)?.[0];
      expect(fence, `${copy.path}: no write-back example`).toBeDefined();
      expect(fence!, copy.path).toContain("--on-duplicate create-new");
      expect(fence!, copy.path).not.toContain("--on-duplicate consolidate");
      expect(section, copy.path).not.toContain(
        "`--on-duplicate consolidate` merges near-duplicates",
      );
      const rule = lineWith(section, "D-78", copy.path);
      for (const marker of [
        "`--on-duplicate create-new`",
        "`consolidate`",
        "restating or updating the same decision",
        "26 distinct decisions",
      ]) {
        expect(rule, `${copy.path}: write-back rule lacks ${marker}`).toContain(marker);
      }
      sections.push(section);
    }
    expectIdentical(sections, "Decision Write-Back section");
  });

  it("memo-cli-usage agent mode rules distinguish create-new from consolidate", () => {
    const rules: string[] = [];
    for (const copy of loadTrees(MEMO_SKILL_TREES)) {
      const section = sectionOf(copy, "Agent Mode Rules");
      expect(section, copy.path).not.toContain(
        "Always pass `--on-duplicate consolidate` for writes",
      );
      const rule = lineWith(section, "D-78", copy.path);
      for (const marker of [
        "`create-new`",
        "distinct decisions",
        "one entry per decision row",
        "`consolidate` only when restating or updating the same decision",
      ]) {
        expect(rule, `${copy.path}: agent mode rule lacks ${marker}`).toContain(marker);
      }
      // The developer's episodic intent/outcome writes stay on consolidate.
      expect(sectionOf(copy, "Intent Entry"), copy.path).toContain("--on-duplicate consolidate");
      expect(sectionOf(copy, "Outcome Entry"), copy.path).toContain("--on-duplicate consolidate");
      rules.push(rule);
    }
    expectIdentical(rules, "agent mode duplicate rule");
  });
});

// --- PR #315 audit follow-ups (F-1, F-2, F-4, F-5, F-6) ----------------------

const TECHNICAL_WRITER_TREES = {
  claude: ".claude/agents/technical-writer.md",
  github: ".github/agents/technical-writer.agent.md",
  kiro: ".kiro/agents/technical-writer.md",
};

const MEMO_REFERENCE_TREES = {
  claude: ".claude/skills/memo-cli-usage/REFERENCE.md",
  github: ".github/skills/memo-cli-usage/REFERENCE.md",
  kiro: ".kiro/skills/memo-cli-usage/REFERENCE.md",
};

/** The first ```bash fence in `text`. */
function firstBashFence(text: string, label: string): string {
  const fence = text.match(/```bash\n[\s\S]*?```/)?.[0];
  expect(fence, `${label}: no bash fence`).toBeDefined();
  return fence!;
}

describe("audit follow-ups", () => {
  // F-1 — the Command Map offers no inline body form git-guard would block.
  it("github-ops command map uses --body-file, never inline --body or --comment", () => {
    const tables: string[] = [];
    for (const copy of loadTrees(GITHUB_OPS_TREES)) {
      const section = sectionOf(copy, "Command Map");
      const table = section
        .split("\n")
        .filter((line) => line.startsWith("|"))
        .join("\n");
      expect(table, copy.path).not.toContain('--body "');
      expect(table, copy.path).not.toContain('--comment "');
      for (const op of [
        "| Create issue ",
        "| Update issue ",
        "| Comment on issue ",
        "| Create PR ",
        "| Update PR ",
        "| Comment on PR ",
        "| Review a PR ",
      ]) {
        expect(lineWith(table, op, copy.path), `${copy.path}: ${op}`).toContain(
          "--body-file <path>",
        );
      }
      const close = lineWith(table, "| Close issue with attribution", copy.path);
      expect(close, copy.path).toContain("never a story or wave issue");
      expect(close, copy.path).toContain("`gh issue comment <number> --body-file <path>`");
      expect(close, copy.path).toContain("`gh issue close <number>`");
      tables.push(squashSpaces(table));
    }
    expectIdentical(tables, "Command Map table");
  });

  // F-5 — chore PRs have a merge rule of their own.
  it("github-ops branch-type merge rules cover chore", () => {
    const rules: string[] = [];
    for (const copy of loadTrees(GITHUB_OPS_TREES)) {
      const section = sectionOf(copy, "Branch-Type Merge Rules");
      const rule = lineWith(section, "- Chore PRs", copy.path);
      for (const marker of ["default branch", "merge commit", "only the user may merge them"]) {
        expect(rule, `${copy.path}: chore merge rule lacks ${marker}`).toContain(marker);
      }
      rules.push(rule);
    }
    expectIdentical(rules, "chore merge rule");
  });

  // F-2 / D-78 — each ADR is a distinct decision.
  it("technical-writer ADR write uses create-new", () => {
    const lines: string[] = [];
    for (const copy of loadTrees(TECHNICAL_WRITER_TREES)) {
      const fence = firstBashFence(sectionOf(copy, "Write Template"), copy.path);
      expect(fence, copy.path).not.toContain("--on-duplicate consolidate");
      lines.push(lineWith(fence, "--on-duplicate", copy.path).trim());
    }
    expectIdentical(lines, "technical-writer --on-duplicate line");
    expect(lines[0]).toBe("--on-duplicate create-new \\");
  });

  // F-4 / D-78 — the decision examples pass create-new; the rule's consolidate
  // example is an amendment of the same decision.
  it("memo-cli-usage decision examples and rule", () => {
    const rules: string[] = [];
    for (const copy of loadTrees(MEMO_SKILL_TREES)) {
      const fence = firstBashFence(sectionOf(copy, "Decision/ADR Entry"), copy.path);
      expect(fence, copy.path).toContain("--on-duplicate create-new");
      const rule = lineWith(sectionOf(copy, "Agent Mode Rules"), "D-78", copy.path);
      expect(rule, copy.path).not.toContain("intent and outcome entries");
      for (const marker of ["amendment", "same story and commit", "correct"]) {
        expect(rule, `${copy.path}: rule lacks ${marker}`).toContain(marker);
      }
      rules.push(rule);
    }
    expectIdentical(rules, "memo-cli-usage D-78 rule");
    for (const copy of loadTrees(MEMO_REFERENCE_TREES)) {
      const fence = firstBashFence(sectionOf(copy, "Record a Decision"), copy.path);
      expect(fence, copy.path).toContain("--on-duplicate create-new");
    }
  });

  // F-6 / D-75 — the header-fill bullet is nested under the `200` bullet.
  it("implement header-fill bullet nests under 200", () => {
    for (const copy of loadTrees(IMPLEMENT_TREES)) {
      const lines = sectionOf(copy, "Wave Status Update (Main Thread Only)").split("\n");
      const at = lines.findIndex((line) => line.includes("D-75"));
      expect(at, copy.path).toBeGreaterThan(0);
      expect(lines[at], copy.path).toMatch(/^ {4}- Header lines on this path/);
      expect(lines[at - 1], copy.path).toMatch(/^ {2}- `200` → /);
    }
  });
});
