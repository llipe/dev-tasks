/**
 * Parity and static checks for the projects-tracking PRD, wave 1
 * (conventions and hierarchy). One `describe` block per changed prompt
 * file, each `it` reading the three platform tree copies and asserting a
 * marker sentence or table row with `toContain`, section-scoped where a
 * section must contain or lack a line (D-34).
 *
 * Helpers are copied from `skill-parity-init.test.ts` (`stripFrontmatter`)
 * and `claude-tool-declaration-parity.test.ts` (`splitIntoSections`) so
 * this file has no cross-test import.
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

/**
 * Split the body into (heading, sectionText) pairs so assertions can be
 * scoped to their nearest enclosing heading. The "preamble" before the
 * first heading is recorded under an empty heading string.
 */
function splitIntoSections(body: string): Array<{ heading: string; text: string }> {
  const lines = body.split("\n");
  const sections: Array<{ heading: string; text: string }> = [];
  let currentHeading = "";
  let currentLines: string[] = [];
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      sections.push({ heading: currentHeading, text: currentLines.join("\n") });
      currentHeading = headingMatch[1];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  sections.push({ heading: currentHeading, text: currentLines.join("\n") });
  return sections;
}

interface TreeCopy {
  tree: string;
  path: string;
  body: string;
  sections: Array<{ heading: string; text: string }>;
}

function loadTrees(paths: Record<string, string>): TreeCopy[] {
  return Object.entries(paths).map(([tree, path]) => {
    const body = stripFrontmatter(readFileSync(resolve(ROOT, path), "utf-8"));
    return { tree, path, body, sections: splitIntoSections(body) };
  });
}

/**
 * Select one section by heading text and, optionally, by a substring of its
 * body — github-ops has two `### Title Format` sections (issues and PRs), so
 * the issue table is the one whose text contains `PRD story` (A-15).
 */
function sectionOf(copy: TreeCopy, heading: string, containing?: string): string {
  const match = copy.sections.find(
    (s) => s.heading.includes(heading) && (containing === undefined || s.text.includes(containing)),
  );
  expect(match, `${copy.path}: no section with heading containing "${heading}"`).toBeDefined();
  return match!.text;
}

/**
 * Collapse runs of spaces so a table row can be matched on its cell names
 * regardless of the column padding prettier applies.
 */
function squashSpaces(text: string): string {
  return text.replace(/[ \t]+/g, " ");
}

// --- github-ops (S-001, #270) -------------------------------------------------

const GITHUB_OPS_TREES = {
  claude: ".claude/agents/github-ops.md",
  github: ".github/agents/github-ops.agent.md",
  kiro: ".kiro/agents/github-ops.md",
};

describe("github-ops", () => {
  const trees = loadTrees(GITHUB_OPS_TREES);

  // PT-1 / CT-5 — S-001 AC-1; FR-1, D-04, D-32
  it("title forms", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Title Format", "PRD story");
      expect(section, copy.path).toMatch(
        /^\| PRD tracking issue\s+\| `\[PRD-<name>\] <PRD title>`/m,
      );
      expect(section, copy.path).toMatch(
        /^\| Wave tracking issue\s+\| `\[PRD-<name>\] Wave <id>: <title>`/m,
      );
      const idSentence = section
        .split("\n")
        .find((line) => line.includes("Phase/Wave") && line.includes("docs/roadmap.md"));
      expect(idSentence, `${copy.path}: no sentence deriving <id> from the roadmap`).toBeDefined();
      // The story form is unchanged.
      expect(section, copy.path).toMatch(
        /^\| PRD story\s+\| `\[PRD-<name>\] Story <ID>: <Title>`/m,
      );
    }
  });

  // PT-2 / CT-6 — S-001 AC-2; FR-2, FR-7, D-03, D-05
  it("level labels and exemption", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Standardized Main Issue Tags");
      expect(section, copy.path).toContain("**Level**");
      for (const label of ["level: prd", "level: wave", "level: story", "status: deferred"]) {
        const row = new RegExp(`^\\|.*\`${label}\`\\s*\\|\\s*\`#[0-9A-F]{6}\``, "m");
        expect(section, `${copy.path}: no colored row for ${label}`).toMatch(row);
      }
      const ruleLine = section
        .split("\n")
        .find((line) => line.includes("at least one `type:` label and one `priority:` label"));
      expect(ruleLine, `${copy.path}: type/priority rule line missing`).toBeDefined();
      expect(ruleLine, copy.path).toContain("except issues labeled `level: prd` or `level: wave`");
    }
  });

  // PT-3 — S-001 AC-2, AC-5; FR-7, D-07, D-31
  it("no stage labels", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Standardized Main Issue Tags");
      // Row-scoped (`^|`), so a prose note that the labels were retired cannot false-fail (EC-3).
      expect(section, copy.path).not.toMatch(/^\|.*`status: ready`/m);
      expect(section, copy.path).not.toMatch(/^\|.*`status: in-progress`/m);
      // The flags stay.
      expect(section, copy.path).toMatch(/^\|.*`status: blocked`/m);
      expect(section, copy.path).toMatch(/^\|.*`status: needs-refinement`/m);
      // Wave 1 retires the rows from the taxonomy only; existing issues are untouched (D-31).
      expect(copy.body, copy.path).not.toMatch(/remove .*status: ready/i);
    }
  });

  // PT-4 / CT-1 to CT-4 — S-001 AC-3; FR-23, D-12, D-25, D-26, D-33, D-37
  it("status comment subsection", () => {
    const storyHeader = "| Sub-tasks | Current | Branch | PR | Gates | Blocker | Updated |";
    const waveHeader = "| Story | State | PR | Sub-task |";
    const prdHeader = "| Wave | State | Wave issue |";
    for (const copy of trees) {
      const section = sectionOf(copy, "Status comment");
      const squashed = squashSpaces(section);
      expect(section, copy.path).toContain("<!-- dev-tasks:status -->");
      expect(section, copy.path).toContain("🔄 Update:");
      expect(section, copy.path).toContain("Refs #<issue>");
      expect(squashed, copy.path).toContain(storyHeader);
      expect(squashed, copy.path).toContain(waveHeader);
      expect(squashed, copy.path).toContain(prdHeader);
      for (const label of ["Current story", "Last merged PR", "Integration HEAD", "Gates"]) {
        expect(section, `${copy.path}: wave summary line "${label}" missing`).toContain(label);
      }
      expect(section, copy.path).toContain("gh api -X PATCH");
      expect(section, copy.path).toContain("exactly one");
      expect(section, copy.path).toContain("append-only");
      // CT-1: every fenced template starts with the marker on line one, no leading
      // whitespace, and the `🔄 Update:` line with `Refs #<issue>` on line two.
      const fences = section.match(/```text\n[\s\S]*?```/g) ?? [];
      expect(fences.length, `${copy.path}: no fenced status-comment template`).toBeGreaterThan(0);
      for (const fence of fences) {
        expect(fence, copy.path).toMatch(
          /^```text\n<!-- dev-tasks:status -->\n🔄 Update:[^\n]*Refs #<issue>/,
        );
      }
      // A-10: "progress comment" is a forbidden synonym of "status comment".
      expect(copy.body, copy.path).not.toMatch(/progress comments?/i);
    }
  });

  // PT-5 — S-001 AC-4; D-16, D-41
  it("gh primary", () => {
    const identity =
      "GitHub operations **MUST** run through the `gh` CLI (over Bash). If a GitHub MCP server is configured in this session, you **MAY** use it instead; whichever method is used **MUST** be noted in the operation summary.";
    for (const copy of trees) {
      expect(copy.body, copy.path).toContain("`gh` CLI is the primary execution path");
      expect(copy.body, copy.path).toContain(identity);
      // A-3 / D-41: no passage still makes MCP primary.
      expect(copy.body, copy.path).not.toContain("run through GitHub MCP when available");
      expect(copy.body, copy.path).not.toContain("(Fallback When MCP Is Unavailable)");
      expect(copy.body, copy.path).not.toMatch(/falling back to `gh`/);
      expect(copy.body, copy.path).not.toMatch(/\*\*MCP first\.\*\*/);
      expect(copy.body, copy.path).not.toMatch(/required path whenever MCP/);
    }
  });
});
