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

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
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
 * first heading is recorded under an empty heading string. Lines inside a
 * ``` fence are never headings: fenced templates (the wave issue body, the
 * status comment) carry `##` lines that belong to the enclosing section.
 */
interface Section {
  heading: string;
  /** Number of `#` on the heading line; 0 for the preamble before the first heading. */
  level: number;
  text: string;
}

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

/**
 * The text of section `at` plus every following section of a deeper level,
 * up to the next heading of equal or higher level; child heading lines are
 * kept so a span reads like the source.
 */
function collectSection(sections: Section[], at: number): string {
  const parts = [sections[at].text];
  for (let i = at + 1; i < sections.length && sections[i].level > sections[at].level; i++) {
    parts.push(`${"#".repeat(sections[i].level)} ${sections[i].heading}`, sections[i].text);
  }
  return parts.join("\n");
}

/**
 * Select one section by heading text and, optionally, by a substring of its
 * collected body — github-ops has two `### Title Format` sections (issues and
 * PRs), so the issue table is the one whose text contains `PRD story` (A-15).
 * Level-aware: a `##` section includes its `###` children (qa S-003 gate).
 */
function sectionOf(copy: TreeCopy, heading: string, containing?: string): string {
  const candidates = copy.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.heading.includes(heading))
    .map(({ index }) => collectSection(copy.sections, index));
  const match = candidates.find((text) => containing === undefined || text.includes(containing));
  expect(match, `${copy.path}: no section with heading containing "${heading}"`).toBeDefined();
  return match!;
}

/**
 * Collapse runs of spaces so a table row can be matched on its cell names
 * regardless of the column padding prettier applies.
 */
function squashSpaces(text: string): string {
  return text.replace(/[ \t]+/g, " ");
}

/**
 * The one line of `text` containing `marker`; fails on zero or several
 * matches so a marker sentence cannot drift into two places (RT-5, PT-47).
 */
function lineWith(text: string, marker: string, label = "text"): string {
  const lines = text.split("\n").filter((line) => line.includes(marker));
  expect(lines.length, `${label}: expected exactly one line containing "${marker}"`).toBe(1);
  return lines[0];
}

/** Assert each marker's first index in `text` is greater than the previous one's (RT-5). */
function inOrder(text: string, markers: string[], label = "text"): void {
  let previous = -1;
  for (const marker of markers) {
    const at = text.indexOf(marker);
    expect(at, `${label}: "${marker}" missing`).toBeGreaterThanOrEqual(0);
    expect(at, `${label}: "${marker}" is out of order`).toBeGreaterThan(previous);
    previous = at;
  }
}

/**
 * The sentence of `text` that contains `marker`: from the previous `. ` (or
 * the start) to the next period followed by whitespace or the end. Lets the
 * planner's step 13 lines differ per tree while an added sentence stays
 * identical (D-60, EC-50).
 */
function sentenceWith(text: string, marker: string, label = "text"): string {
  const at = text.indexOf(marker);
  expect(at, `${label}: "${marker}" missing`).toBeGreaterThanOrEqual(0);
  const start = text.lastIndexOf(". ", at);
  const end = text.slice(at).search(/\.(\s|$)/);
  return text.slice(start < 0 ? 0 : start + 2, end < 0 ? text.length : at + end + 1);
}

// --- helpers -----------------------------------------------------------------

describe("helpers", () => {
  // qa-engineer S-001 gate: a `##` line inside a fenced block is template text,
  // not a heading — the wave body template (S-002) carries `## Artifacts` and
  // `## Stories` inside a fence, which must not cut the Process section short.
  it("splitIntoSections ignores headings inside code fences", () => {
    const body = [
      "## Process",
      "step one",
      "```markdown",
      "## Artifacts",
      "inside the fence",
      "```",
      "step two",
      "## Next",
      "after",
    ].join("\n");
    const sections = splitIntoSections(body);
    expect(sections.map((s) => s.heading)).toEqual(["", "Process", "Next"]);
    const process = sections.find((s) => s.heading === "Process")!;
    expect(process.text).toContain("## Artifacts");
    expect(process.text).toContain("step two");
  });

  // qa-engineer S-003 gate (6.1f): `sectionOf` is level-aware — a `##` section
  // includes its `###` children up to the next heading of equal or higher
  // level, so an assertion scoped to `## During Implementation` sees the text
  // under `### Status Comment` without a span workaround.
  it("sectionOf collects child headings of a deeper level", () => {
    const body = [
      "## During",
      "intro",
      "### Child",
      "child text",
      "#### Grandchild",
      "grandchild text",
      "## Before",
      "after",
    ].join("\n");
    const copy: TreeCopy = {
      tree: "fixture",
      path: "fixture.md",
      body,
      sections: splitIntoSections(body),
    };
    const during = sectionOf(copy, "During");
    expect(during).toContain("intro");
    expect(during).toContain("child text");
    expect(during).toContain("grandchild text");
    expect(during).not.toContain("after");
    // A `###` lookup stops at the next `###` or `##`, and includes its own `####`.
    const child = sectionOf(copy, "Child");
    expect(child).toContain("child text");
    expect(child).toContain("grandchild text");
    expect(child).not.toContain("intro");
    expect(child).not.toContain("after");
  });

  // RT-5 — wave 2 helper self-checks on deterministic fixtures.
  it("inOrder passes in order and fails when two markers are swapped", () => {
    const text = "alpha then beta then gamma";
    expect(() => inOrder(text, ["alpha", "beta", "gamma"])).not.toThrow();
    expect(() => inOrder(text, ["beta", "alpha"])).toThrow();
    expect(() => inOrder(text, ["alpha", "delta"])).toThrow();
  });

  it("lineWith fails on zero and on two matches", () => {
    const text = ["one marker", "two", "three marker"].join("\n");
    expect(() => lineWith(text, "absent")).toThrow();
    expect(() => lineWith(text, "marker")).toThrow();
    expect(lineWith(text, "two")).toBe("two");
  });

  it("sentenceWith returns only the sentence holding the marker", () => {
    const text = "First sentence. Then `git add -f file.md` and push. Last one.";
    expect(sentenceWith(text, "git add -f")).toBe("Then `git add -f file.md` and push.");
  });
});

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
      // 6.1b / fidelity-report-S-001 DR-1: the retirement reason follows FR-7
      // ("everywhere, Project or not": the linked PR shows the state natively),
      // not D-07's older wording that tied it to the Project's Status field.
      const retirement = copy.body
        .split("\n")
        .find((line) => line.includes("are retired from this taxonomy"));
      expect(retirement, `${copy.path}: no retirement rationale bullet`).toBeDefined();
      expect(retirement!, copy.path).toContain("Project or not");
      expect(retirement!, copy.path).toMatch(/linked pull request/);
      expect(retirement!, copy.path).not.toContain("Project's Status field carries that state");
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
      // 6.1e / fidelity-report-S-003 DR-3: FR-23 names `coverage_gate` and the
      // verifier verdict among the gates recorded, so the story template's
      // Gates cell carries both beside the five quality gates.
      const storyFence = fences.find((f) => f.includes("| Sub-tasks"));
      expect(storyFence, `${copy.path}: no fenced story status template`).toBeDefined();
      const gatesCell = storyFence!.split("\n").find((line) => line.includes("<done> of <total>"));
      expect(gatesCell, `${copy.path}: no story row in the template`).toBeDefined();
      for (const gate of [
        "test",
        "lint",
        "format",
        "typecheck",
        "audit",
        "coverage_gate",
        "fidelity",
      ]) {
        expect(gatesCell!, `${copy.path}: Gates cell lacks ${gate}`).toContain(gate);
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

// --- activity-publish-github (S-002, #271) -----------------------------------

const PUBLISH_TREES = {
  claude: ".claude/skills/activity-publish-github/SKILL.md",
  github: ".github/skills/activity-publish-github/SKILL.md",
  kiro: ".kiro/skills/activity-publish-github/SKILL.md",
};

const TRACKING_SEARCH =
  'gh issue list --label "level: prd" --search "[PRD-<name>] in:title" --state open';

describe("activity-publish-github", () => {
  // The `.github/` copy has no YAML frontmatter, so `stripFrontmatter` is a
  // no-op there and every assertion is `toContain`, never `toBe` (A-15, EC-12).
  const trees = loadTrees(PUBLISH_TREES);

  // PT-6 — S-002 AC-1; FR-9, D-16; PRD AC-6
  it("gh primary", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).toMatch(/`gh`[^\n]*primary/);
      expect(copy.body, copy.path).toMatch(/MCP[^\n]*optional/);
      expect(copy.body, copy.path).toContain("**MUST** be recorded in the publication report");
      expect(copy.body, copy.path).not.toContain("GitHub MCP **SHOULD** be used when available");
      // The github-ops delegation fallback sentence is unchanged.
      expect(copy.body, copy.path).toContain(
        "If `github-ops` delegation is unavailable in the current runtime",
      );
    }
  });

  // PT-7 / CT-11 — S-002 AC-2; FR-3, D-36; A-13 client-side filter
  it("find-or-create", () => {
    for (const copy of trees) {
      const process = sectionOf(copy, "Process");
      expect(process, copy.path).toContain(TRACKING_SEARCH);
      expect(process, copy.path).toContain('--label "level: wave"');
      expect(process, copy.path).toContain("Wave <id>:");
      expect(process, copy.path).toContain('startswith("[PRD-<name>]")');
      expect(process, copy.path).toMatch(/--jq[^\n]*startswith/);
      // The three outcomes, as text.
      expect(process, copy.path).toMatch(/one match[^\n]*reuse/i);
      expect(process, copy.path).toMatch(/zero[^\n]*create/i);
      expect(process, copy.path).toMatch(/more than one[^\n]*stop[^\n]*list/i);
      // The search runs before story creation: the find-or-create step comes first.
      expect(process.indexOf(TRACKING_SEARCH), copy.path).toBeLessThan(
        process.indexOf("one GitHub Issue per user story"),
      );
    }
  });

  // PT-8 — S-002 AC-2; FR-3
  it("no epic question", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).not.toContain("parent epic issue or project board association");
      const questions = sectionOf(copy, "Clarifying Questions");
      for (const line of questions.split("\n")) {
        expect(line, `${copy.path}: question still asks for an epic or board`).not.toMatch(
          /epic|project board/i,
        );
      }
    }
  });

  // PT-9 / CT-8 — S-002 AC-3; FR-4, D-14
  it("wave body template", () => {
    for (const copy of trees) {
      const fences = copy.body.match(/```[a-z]*\n[\s\S]*?```/g) ?? [];
      const fence = fences.find((f) => f.includes("Integration branch: TBD"));
      expect(fence, `${copy.path}: no fenced wave issue body template`).toBeDefined();
      expect(fence!, copy.path).toMatch(/^Scope:/m);
      expect(fence!, copy.path).toContain("## Artifacts");
      expect(fence!, copy.path).toContain("Task plan: pending");
      expect(fence!, copy.path).toContain("## Stories");
      // Two root-relative links: the spec and the story set.
      const links = fence!.match(/\]\(\/workstream\/[^)]+\)/g) ?? [];
      expect(links.length, `${copy.path}: expected two root-relative links`).toBeGreaterThanOrEqual(
        2,
      );
      // No checkboxes in the wave body; the story template's AC checkboxes
      // elsewhere in the file are untouched (EC-13).
      expect(fence!, copy.path).not.toContain("- [ ]");
    }
  });

  // 6.1c / fidelity-report-S-002 DR-2 (qa S-002 gap): the PRD tracking issue
  // has a body template so three zero-match publishes produce one shape, and
  // every story issue is labeled `level: story` (D-03).
  it("prd body template", () => {
    for (const copy of trees) {
      const fences = copy.body.match(/```[a-z]*\n[\s\S]*?```/g) ?? [];
      const fence = fences.find((f) => f.includes("## Waves"));
      expect(fence, `${copy.path}: no fenced PRD issue body template`).toBeDefined();
      expect(fence!, copy.path).toMatch(/^```markdown\n# <PRD title>/);
      expect(fence!, copy.path).toContain("](/docs/requirements/prd-<prd-name>.md)");
      expect(fence!, copy.path).toContain("](/docs/roadmap.md)");
      expect(fence!, copy.path).toMatch(/^- Wave <id>:/m);
      expect(fence!, copy.path).not.toContain("- [ ]");
      const process = sectionOf(copy, "Process");
      expect(process, copy.path).toMatch(/PRD issue body[^\n]*template/);
      expect(process, copy.path).toContain("labeled `level: story`");
    }
  });

  // 6.1d / fidelity-report-S-002 DR-4: the story-issue title form is referenced
  // from github-ops § Title Format, never restated (D-33), so no reader takes
  // `<prd-number or name>` for a third convention.
  it("story title pointer", () => {
    for (const copy of trees) {
      const stories = sectionOf(copy, "Story issues");
      const title = stories.split("\n").find((line) => line.startsWith("- **Title:**"));
      expect(title, `${copy.path}: no Title bullet under Story issues`).toBeDefined();
      expect(title!, copy.path).toContain("github-ops § Title Format");
      expect(copy.body, copy.path).not.toContain("[PRD-<prd-number or name>]");
      expect(copy.body, copy.path).not.toContain("Story [ID]: [Title]");
    }
  });

  // PT-10 — S-002 AC-4; FR-3, D-02
  it("sub-issue attach and verify", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).toContain("/sub_issues");
      expect(copy.body, copy.path).toContain("sub_issue_id");
      expect(copy.body, copy.path).toContain("--jq .id");
      expect(copy.body, copy.path).toContain("hierarchy: verified(<n> of <n>)");
      expect(copy.body, copy.path).toContain("failed(<reason>)");
      expect(copy.body, copy.path).toContain("if not already");
      // Every body goes through a file; git-guard blocks inline `--body`.
      expect(copy.body, copy.path).not.toContain('--body "');
      expect(copy.body, copy.path).toContain("--body-file");
    }
  });

  // PT-11 — S-002 AC-5; FR-3
  it("report fields", () => {
    for (const copy of trees) {
      const report = sectionOf(copy, "Output Structure");
      expect(report, copy.path).toMatch(/^- PRD issue:/m);
      expect(report, copy.path).toMatch(/^- Wave issue:/m);
      expect(report, copy.path).toMatch(/^- Hierarchy:/m);
      const final = sectionOf(copy, "Final Instructions");
      expect(final, copy.path).toContain("hierarchy");
    }
  });
});

// --- implement (S-003, #272) -------------------------------------------------

const IMPLEMENT_TREES = {
  claude: ".claude/skills/implement/SKILL.md",
  github: ".github/instructions/implement.instructions.md",
  kiro: ".kiro/steering/implement.md",
};

describe("implement", () => {
  // Frontmatter differs per tree (skill, `applyTo` instruction, `fileMatchPattern`
  // steering); the bodies are byte-identical and `memo-write-reliability.test.ts`
  // pins the `## Before Starting Work` … `## GitHub Execution Rules` span, which
  // contains every edit below (A-15, EC-19).
  const trees = loadTrees(IMPLEMENT_TREES);

  // PT-12 — S-003 AC-1; FR-23, D-25, D-38
  it("mandatory rule", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "During Implementation");
      expect(section, copy.path).toMatch(/\*\*MUST\*\* keep the story's status comment current/);
      expect(section, copy.path).toContain("Status comment");
      for (const event of [
        "first sub-task completion",
        "PR open",
        "each gate recorded",
        "on block",
      ]) {
        expect(section, `${copy.path}: event "${event}" missing`).toContain(event);
      }
      // The template is referenced, never restated (D-33): no fenced status table here.
      expect(copy.body, copy.path).not.toContain("| Sub-tasks ");
    }
  });

  // PT-13 — S-003 AC-1; FR-23; A-10 / EC-20 vocabulary
  it("old optional rule gone", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).not.toContain("**SHOULD** add brief issue or PR comments");
      expect(copy.body, copy.path).not.toMatch(/progress comments?/i);
      const final = sectionOf(copy, "Final Instructions");
      expect(final, copy.path).toContain("status comment");
    }
  });

  // PT-14 / CT-1 / CT-7 — S-003 AC-2; D-26, D-28, D-37; A-8 duplicate case (EC-15)
  it("procedure and report field", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "During Implementation");
      expect(section, copy.path).toContain("issues/{n}/comments --paginate");
      expect(section, copy.path).toContain('startswith("<!-- dev-tasks:status -->")');
      expect(section, copy.path).toContain("gh issue comment");
      expect(section, copy.path).toContain("--body-file");
      expect(section, copy.path).toContain("gh api -X PATCH");
      expect(section, copy.path).toContain("issues/comments/{id}");
      expect(section, copy.path).toContain("-F body=@");
      expect(section, copy.path).toContain(
        "status_comment: written | failed(<reason>) | skipped(no issue)",
      );
      expect(section, copy.path).toContain("failed(duplicate marker)");
      // EC-17: the marker is the first byte of the body file.
      expect(section, copy.path).toMatch(/first byte/);
      // Every body goes through a file; git-guard blocks inline `--body`.
      expect(copy.body, copy.path).not.toContain('--body "');
    }
  });

  // PT-15 / CT-7 — S-003 AC-3; FR-24, D-29; A-8 missing-comment case (EC-18)
  it("main-thread wave update", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "During Implementation");
      expect(section, copy.path).toContain("issues/{n}/parent");
      expect(section, copy.path).toContain("PR open");
      expect(section, copy.path).toContain("PR ready");
      expect(section, copy.path).toContain("404");
      expect(section, copy.path).toContain("wave_status: skipped(no parent)");
      expect(section, copy.path).toContain("wave_status: owned-by-planner");
      expect(section, copy.path).toContain("wave_status: written");
      // Parent found but the wave has no status comment yet: create it (A-8, EC-18).
      expect(section, copy.path).toContain("create it from the wave table");
    }
  });

  // PT-16 — S-003 AC-4; FR-23
  it("checklist rules unchanged", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "During Implementation");
      expect(section, copy.path).toContain("Mark it `[x]` in the GitHub Issue checklist.");
      expect(section, copy.path).toContain(
        "keep the local task list and the GitHub Issue checklist aligned at all times",
      );
      expect(section, copy.path).toContain(
        "you **MUST** reconcile immediately and report the reconciliation",
      );
    }
  });

  // S-003 AC-4; FR-23 — the lifecycle table's "During" row names the status comment.
  it("lifecycle row", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "GitHub Execution Rules Summary");
      const during = section.split("\n").find((line) => line.startsWith("| **During coding**"));
      expect(during, `${copy.path}: no During coding row`).toBeDefined();
      expect(during!, copy.path).toMatch(/status comment/i);
      // The "Before coding" row is unchanged (spec §8.3).
      expect(squashSpaces(section), copy.path).toContain(
        "| **Before coding** | Confirm issue open → Create branch (`github-ops`) → First commit → Open draft PR (`github-ops`) → Sync checklists",
      );
    }
  });
});

// --- developer (S-004, #273) -------------------------------------------------

const DEVELOPER_TREES = {
  claude: ".claude/agents/developer.md",
  github: ".github/agents/developer.agent.md",
  kiro: ".kiro/agents/developer.md",
};

describe("developer", () => {
  // The three copies differ in delegation wording (EC-25), so every assertion
  // is marker-only; no equality across trees. The `/developer` command
  // inherits through the collapse that `developer-command-collapse.test.ts`
  // pins (LT-4, S-004 AC-4), so `.claude/commands/developer.md` is not read here.
  const trees = loadTrees(DEVELOPER_TREES);

  function closeoutPayload(copy: TreeCopy): string {
    const span = copy.body.match(/BEGIN CLOSEOUT PAYLOAD[\s\S]*?END CLOSEOUT PAYLOAD/)?.[0];
    expect(span, `${copy.path}: no closeout payload`).toBeDefined();
    return span!;
  }

  // PT-19 / CT-7 — S-004 AC-1; FR-23, D-28, D-30. `wave_status` carries four
  // values: implement already emits `failed(<reason>)` when the wave comment
  // edit is refused (fidelity-report-S-003 DR-1), so the developer vocabulary
  // pins `written | failed(<reason>) | skipped(<reason>) | owned-by-planner`.
  it("report fields", () => {
    const syncLine = "checklist_sync: synced | mismatch-fixed | blocked";
    const statusLine = "status_comment: written | failed(<reason>) | skipped(<reason>)";
    const waveLine =
      "wave_status: written | failed(<reason>) | skipped(<reason>) | owned-by-planner";
    for (const copy of trees) {
      const lines = closeoutPayload(copy).split("\n");
      const indexOf = (needle: string): number => {
        const hits = lines.filter((line) => line.includes(needle));
        expect(hits.length, `${copy.path}: expected exactly one "${needle}"`).toBe(1);
        return lines.findIndex((line) => line.includes(needle));
      };
      const sync = indexOf(syncLine);
      const status = indexOf(statusLine);
      const wave = indexOf(waveLine);
      // Both new lines sit within three lines of `checklist_sync:` (D-30).
      expect(
        Math.abs(status - sync),
        `${copy.path}: status_comment not beside checklist_sync`,
      ).toBeLessThanOrEqual(3);
      expect(
        Math.abs(wave - sync),
        `${copy.path}: wave_status not beside checklist_sync`,
      ).toBeLessThanOrEqual(3);
      // EC-22 / D-28: the no-issue floor is named in the payload rules, and
      // the planner-run value is named so the subagent never omits the field.
      expect(copy.body, copy.path).toContain("skipped(no issue)");
      expect(copy.body, copy.path).toContain("wave_status: owned-by-planner");
    }
  });

  // PT-20 — S-004 AC-2; D-22 (FR-13 wording)
  it("close rule", () => {
    for (const copy of trees) {
      const rules = sectionOf(copy, "Non-Negotiable Operating Rules");
      expect(rules, copy.path).toContain(
        "You **MUST NOT** close the issue; GitHub closes it when the consolidated PR merges to main",
      );
      expect(copy.body, copy.path).not.toContain("close only after the PR is approved and merged");
    }
  });

  // PT-21 / CT-2 — S-004 AC-3; D-33, D-38
  it("pointer not copy", () => {
    const storyHeader = "| Sub-tasks | Current | Branch | PR | Gates | Blocker | Updated |";
    for (const copy of trees) {
      const rules = sectionOf(copy, "Non-Negotiable Operating Rules");
      const pointer = rules
        .split("\n")
        .find((line) => /status comment/i.test(line) && line.includes("implement"));
      expect(
        pointer,
        `${copy.path}: no rule line pointing to implement's status comment procedure`,
      ).toBeDefined();
      // The pointer names implement's section, so a reader can find the procedure.
      expect(pointer!, copy.path).toContain("Status Comment");
      // 6.1g / fidelity-report-S-004 DR-3: `implement` is a skill only on Claude;
      // on Copilot it is an instruction and on Kiro a steering file, so those
      // two copies call it "the `implement` procedure".
      if (copy.tree === "claude") {
        expect(pointer!, copy.path).toContain("the `implement` skill's");
      } else {
        expect(pointer!, copy.path).toContain("the `implement` procedure");
        expect(pointer!, copy.path).not.toContain("`implement` skill");
      }
      // Negative: the procedure and the template are never restated here.
      expect(copy.body, copy.path).not.toContain("gh api -X PATCH");
      expect(copy.body, copy.path).not.toContain("issues/comments/{id}");
      expect(copy.body, copy.path).not.toContain("--body-file");
      expect(squashSpaces(copy.body), copy.path).not.toContain(storyHeader);
      // A-10: "progress comment" is a forbidden synonym of "status comment".
      expect(copy.body, copy.path).not.toMatch(/progress comments?/i);
    }
  });
});

// --- Project-write guard declarations (S-006, #275) -------------------------

/**
 * The roots the guard walks: the three platform trees plus `docs/` (D-44), so
 * the runbook cannot carry a Project write either. Nothing under a root is
 * excluded except `docs/requirements/`: a PRD states the prohibition by
 * quoting the command it forbids (prd-projects-tracking goal 2, AC-3), and it
 * is requirements prose, not a procedure an agent executes.
 */
const GUARDED_ROOTS = [".claude", ".github", ".kiro", "docs"] as const;
const GUARD_EXCLUDED_PREFIX = "docs/requirements/";

/**
 * Project Status is never written by an agent (D-23). The only `gh project`
 * verbs that may appear anywhere are the runbook's setup and read verbs
 * (`create`, `field-delete`, `view`, `field-list`); the two item writes are
 * forbidden in every file the walk reaches. Hoisted above the activity-init
 * block because PT-25 reuses it for the runbook's own line-scoped negative.
 */
const PROJECT_WRITE = /gh\s+project\s+item-(edit|add)\b/;

/** Every `.md` under `root`, recursive, as a root-relative path, sorted. */
function markdownFiles(root: string): string[] {
  return readdirSync(resolve(ROOT, root), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter((path) => !path.startsWith(GUARD_EXCLUDED_PREFIX))
    .sort();
}

// --- activity-init (S-005, #274) ---------------------------------------------

const INIT_TREES = {
  claude: ".claude/skills/activity-init/SKILL.md",
  github: ".github/skills/activity-init/SKILL.md",
  kiro: ".kiro/skills/activity-init/SKILL.md",
};

const INIT_HEADING = "Repository Setup — GitHub Project (Recommended)";
const RUNBOOK_PATH = "docs/runbooks/runbook-configure-github-project.md";

/** PRD AC-5: no step changes a default automation. */
const AUTOMATION_TOGGLE =
  /(turn off|disable|enable|switch on|switch off)[^\n]*(workflow|automation)/i;

describe("activity-init", () => {
  const trees = loadTrees(INIT_TREES);

  // PT-23 — S-005 AC-1, AC-6; FR-8, D-10, D-40
  it("init subsection", () => {
    for (const copy of trees) {
      const headings = copy.sections.map((s) => s.heading);
      const at = headings.indexOf(INIT_HEADING);
      expect(at, `${copy.path}: no "${INIT_HEADING}" section`).toBeGreaterThan(-1);
      // Placement: after Branch Protection, before Document Changelog Convention (spec §8.4).
      expect(headings[at - 1], copy.path).toBe("Repository Setup — Branch Protection (Required)");
      expect(headings[at + 1], copy.path).toBe("Document Changelog Convention");
      // A `## ` sibling, not a `### ` child (D-40): the raw body carries the `## ` line.
      expect(copy.body, copy.path).toContain(`\n## ${INIT_HEADING}\n`);

      const text = sectionOf(copy, INIT_HEADING);
      expect(text, copy.path).toContain(RUNBOOK_PATH);
      // At most four sentences, counted after inline code spans and link
      // targets are removed so a path's dots do not count (EC-29).
      const prose = text.replace(/`[^`]*`/g, "").replace(/\]\([^)]*\)/g, "]");
      const terminators = prose.match(/[.!?](\s|$)/g) ?? [];
      expect(
        terminators.length,
        `${copy.path}: subsection has more than four sentences`,
      ).toBeLessThanOrEqual(4);
      expect(terminators.length, `${copy.path}: subsection is empty`).toBeGreaterThan(0);
      // No numbered step: the 54-step pin in skill-parity-init stays (A-1).
      expect(text, copy.path).not.toMatch(/^[0-9]+\. /m);
      // 6.1j / D-46, D-47: the subsection names no template and no reopened
      // workflow, since either template is accepted and no such default exists.
      expect(text, copy.path).not.toContain("Board template");
      expect(text, copy.path).not.toContain("Item reopened");
    }
  });

  // PT-25 / CT-10 — S-005 AC-2, AC-3; FR-8, PRD AC-5; D-10, D-22, D-23, D-35, D-43, D-44
  it("runbook steps", () => {
    const content = readFileSync(resolve(ROOT, RUNBOOK_PATH), "utf-8");
    const sections = splitIntoSections(stripFrontmatter(content));
    const section = (heading: string): string => {
      const match = sections.find((s) => s.heading === heading);
      expect(match, `${RUNBOOK_PATH}: no "${heading}" section`).toBeDefined();
      return match!.text;
    };

    // CT-10: frontmatter in the quoted inline form the runbook-set parser reads (EC-31).
    expect(content).toMatch(/^---\nname: runbook-configure-github-project\n/);
    expect(content).toMatch(/^owner: product-engineer$/m);
    expect(content).toMatch(/^last_verified: \d{4}-\d{2}-\d{2}$/m);
    expect(content).toMatch(/^related: \["docs\/requirements\/prd-projects-tracking\.md"\]$/m);

    // 6.1h — D-45 to D-48, read from the Project 5 exercise on 2026-10-21:
    // either template is accepted and both Status sets are named (D-46); the
    // seven shipped workflows are listed and "Item reopened" is not one of
    // them (D-47); the Team planning template's extra fields are kept, so
    // the field cleanup is an optional note, never a required step (D-48).
    const steps = section("Steps");
    for (const marker of [
      "gh auth refresh -s project",
      "Board",
      "Team planning",
      "Todo, In Progress, Done",
      "Backlog, Ready, In progress, In review, Done",
      "is:issue",
      "Auto-add to project",
      "Auto-add sub-issues to project",
      "Auto-close issue",
      "Item added to project",
      "Item closed",
      "Pull request linked to issue",
      "Pull request merged",
      "Parent issue",
      'label:"status: blocked"',
      "level:",
    ]) {
      expect(steps, `Steps lacks "${marker}"`).toContain(marker);
    }
    expect(content).not.toContain("Item reopened");
    expect(steps).toMatch(/optional/i);
    expect(steps).not.toMatch(/^\d+\. Delete/m);
    // Verification uses the two read verbs (D-10) and records the exercise.
    const verification = section("Verification");
    expect(verification).toContain("gh project view");
    expect(verification).toContain("gh project field-list");
    expect(verification).toContain("Project 5");
    expect(verification).toContain("2026-10-21");
    expect(verification).toContain("is:issue");
    expect(verification).toMatch(/seven/i);
    expect(content).toMatch(/^last_verified: 2026-10-21$/m);

    // D-45: Auto-close issue ships enabled and is left as shipped; since no
    // agent writes Status it can only fire on a human's Status change. The
    // exercise records the exact names shown on the Workflows page.
    expect(content).toContain("Auto-close issue");
    expect(content).toMatch(/ships enabled/);
    expect(content).not.toMatch(/off by\s+default/);
    expect(content).toMatch(/Workflows page/);

    // Edge cases: the repository setting that enables Projects (EC-26) and
    // `--owner` for user versus organization projects (EC-27).
    const preconditions = section("Preconditions");
    expect(preconditions).toMatch(/Projects/);
    expect(preconditions).toMatch(/Settings/);
    expect(content).toContain("--owner");

    // Negatives: no Project write anywhere (D-23, D-44); no step toggles a
    // default automation (PRD AC-5).
    for (const [index, line] of content.split("\n").entries()) {
      expect(line, `${RUNBOOK_PATH}:${index + 1} writes a Project item`).not.toMatch(PROJECT_WRITE);
    }
    for (const [index, line] of steps.split("\n").entries()) {
      expect(line, `${RUNBOOK_PATH} Steps line ${index + 1} toggles an automation`).not.toMatch(
        AUTOMATION_TOGGLE,
      );
    }
  });
});

// --- no Project writes (S-006, #275) -----------------------------------------

describe("no Project writes", () => {
  // PT-29 / RT-1 — S-006 AC-1: the enumerated matcher table. Deterministic by
  // construction; every `gh`, whitespace, `project`, whitespace, `item-edit`
  // or `item-add` string matches, and every `gh project <read verb>` does not.
  it("matcher self-check", () => {
    const mustMatch = [
      "gh project item-edit --id X",
      "`gh project item-add`",
      "run gh  project item-edit",
      "gh project item-edit\n",
      "gh project item-add --owner llipe --url https://github.com/llipe/dev-tasks/issues/1",
    ];
    const mustNotMatch = [
      "gh project view",
      "gh project field-list",
      "gh project item-list",
      "gh project list",
      "Item added to project",
      "gh project create",
    ];
    for (const fixture of mustMatch) {
      expect(fixture, `matcher misses "${fixture}"`).toMatch(PROJECT_WRITE);
    }
    for (const fixture of mustNotMatch) {
      expect(fixture, `matcher wrongly catches "${fixture}"`).not.toMatch(PROJECT_WRITE);
    }
  });

  // PT-28 — S-006 AC-1; PRD AC-3a; FR-6; D-23, D-44. Line-scoped so the failure
  // names the file and line; a code fence quoting the command fails too (EC-34).
  it("no gh project writes in any tree", () => {
    for (const root of GUARDED_ROOTS) {
      const files = markdownFiles(root);
      expect(files.length, `${root}: walk found no markdown files`).toBeGreaterThan(0);
      for (const file of files) {
        const lines = readFileSync(resolve(ROOT, file), "utf-8").split("\n");
        for (const [index, line] of lines.entries()) {
          expect(line, `${file}:${index + 1} writes a Project item`).not.toMatch(PROJECT_WRITE);
        }
      }
    }
  });

  // PT-28b — PRD goal 5; D-23, D-24: no agent needs the Project's identity or
  // the `project` token scope, and setup verbs live only in the runbook under
  // `docs/`, never in a prompt tree (EC-38 widens the negative now so wave 3
  // must consciously relax it with a decision).
  it("no project scope or project id in any tree", () => {
    const setupVerb = /gh\s+project\s+(edit|create|delete|field-create|item-delete|item-archive)\b/;
    for (const root of GUARDED_ROOTS.filter((r) => r !== "docs")) {
      for (const file of markdownFiles(root)) {
        const content = readFileSync(resolve(ROOT, file), "utf-8");
        expect(content, `${file} asks for the project token scope`).not.toContain(
          "gh auth refresh -s project",
        );
        expect(content, `${file} carries a Project setup verb`).not.toMatch(setupVerb);
      }
    }
  });
});

// --- plan (S-008, #291) ------------------------------------------------------

const PLAN_TREES = {
  claude: ".claude/skills/plan/SKILL.md",
  github: ".github/instructions/plan.instructions.md",
  kiro: ".kiro/steering/plan.md",
};

describe("plan", () => {
  const trees = loadTrees(PLAN_TREES);

  // PT-31 / CT-14 — S-008 AC-1; D-59, D-62 (A-19)
  it("wave issue header", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Output Format");
      const fence = section.match(/```markdown\n([\s\S]*?)\n```/);
      expect(fence, `${copy.path}: no Output Format template fence`).not.toBeNull();
      const lines = fence![1].split("\n");
      const source = lines.findIndex((line) => line.startsWith("Source:"));
      expect(source, `${copy.path}: template has no Source: line`).toBeGreaterThanOrEqual(0);
      expect(lines[source + 1], `${copy.path}: Wave issue must follow Source:`).toBe(
        "Wave issue: #N",
      );
      expect(copy.body, copy.path).toContain("Wave issue: none");
      expect(copy.body, copy.path).toMatch(/planner[^\n]*search/);
      expect(copy.body, copy.path).toMatch(/publication report's `Wave issue` line/);
      // Bold would break CT-14's `^Wave issue: (#\d+|none)$`.
      expect(copy.body, copy.path).not.toContain("**Wave issue");
    }
  });
});

// --- planner (S-008, #291) ---------------------------------------------------

const PLANNER_TREES = {
  claude: ".claude/commands/planner.md", // a command on Claude, an agent elsewhere
  github: ".github/agents/planner.agent.md",
  kiro: ".kiro/agents/planner.md",
};

/** CT-22: the D-36 wave search, byte-identical to activity-publish-github's. */
const WAVE_SEARCH =
  'gh issue list --label "level: wave" --search "[PRD-<name>] Wave <id>: in:title" --state open --json number,title --jq \'map(select(.title | startswith("[PRD-<name>] Wave <id>:")))\'';

/** Step 13 of the merge rule: one line (LT-9), from `13. ` to the line end. */
function step13(copy: TreeCopy): string {
  const section = sectionOf(copy, "Merge management rule");
  const match = section.match(/^13\. .*$/m);
  expect(match, `${copy.path}: merge rule has no step 13`).not.toBeNull();
  return match![0];
}

describe("planner", () => {
  const trees = loadTrees(PLANNER_TREES);

  // PT-33 / CT-22 — S-008 AC-2; D-36, D-59; A-36 (EC-41, EC-42)
  it("wave issue discovery", () => {
    for (const copy of trees) {
      // LT-11 reads Phase 0 up to its first `---`; the resolution must sit inside that span.
      const phase0 = copy.body.match(/## Phase 0 - Discover Task Source[\s\S]*?\n---\n/);
      expect(phase0, `${copy.path}: no Phase 0 span`).not.toBeNull();
      const text = phase0![0];
      inOrder(
        text,
        ["Wave issue:", WAVE_SEARCH, "wave_status: skipped(no wave issue)"],
        copy.path,
      );
      expect(text, copy.path).toMatch(/[Mm]ore than one[^\n]*stop/);
      // EC-41: header `none` with one search match — the search wins and is recorded.
      expect(text, copy.path).toMatch(/`Wave issue: none`[^\n]*search[^\n]*record/);
      expect(lineWith(copy.body, "wave_status: skipped(no wave issue)", copy.path)).toBe(
        lineWith(trees[0].body, "wave_status: skipped(no wave issue)", trees[0].path),
      );
    }
    // The planner's literal is publish's literal (CT-22).
    for (const copy of loadTrees(PUBLISH_TREES)) {
      expect(copy.body, copy.path).toContain(WAVE_SEARCH);
    }
  });

  // PT-34 / CT-13 — S-008 AC-3; FR-11, D-59
  it("state file and handoff carry the wave issue", () => {
    const handoffLines: string[] = [];
    for (const copy of trees) {
      const format = sectionOf(copy, "State File Format");
      const lines = format.split("\n");
      const repository = lines.indexOf("- Repository: <owner/repo>");
      expect(repository, `${copy.path}: no Repository line in Run Info`).toBeGreaterThanOrEqual(0);
      expect(lines[repository + 1], copy.path).toBe("- Wave issue: #N | none");
      expect(lines[repository + 2], copy.path).toMatch(/^- Started:/);
      // The resume steps themselves, not the State File Format child section.
      const resume = copy.sections.find((s) => s.heading.includes("Resume Detection"));
      expect(resume, `${copy.path}: no Resume Detection section`).toBeDefined();
      expect(resume!.text, copy.path).toContain("`Wave issue`");
      const handoff = copy.body.match(/Handoff template:\s*\n+````markdown\n([\s\S]*?)\n````/);
      expect(handoff, `${copy.path}: no handoff template`).not.toBeNull();
      const waveLines = handoff![1].split("\n").filter((line) => line.startsWith("Wave issue:"));
      expect(waveLines, copy.path).toHaveLength(1);
      handoffLines.push(waveLines[0]);
    }
    expect(new Set(handoffLines).size, "handoff Wave issue line differs across trees").toBe(1);
  });

  // PT-35 / CT-21 — S-008 AC-4; FR-11, D-52; A-36 (EC-45); EC-50
  it("checkpoint commit", () => {
    const sentences: string[] = [];
    for (const copy of trees) {
      const step = step13(copy);
      for (const marker of [
        "git add -f workstream/planner-state-<plan-id>.md",
        "chore(planner): checkpoint after <story> merge",
        "push",
        "integration branch",
      ]) {
        expect(step, `${copy.path}: step 13 lacks ${marker}`).toContain(marker);
      }
      // Commit only after the merge is verified; `.github`'s step 13 has no verification (EC-50).
      if (copy.tree !== "github") {
        inOrder(step, ["gh pr view", "git add -f"], copy.path);
      }
      // EC-45: push rejected → report, retry once, then blocked.
      expect(step, copy.path).toMatch(/push is rejected[^\n]*retry[^\n]*once[^\n]*blocked/);
      // A-45: S-009 removes the per-merge comment sentence, not S-008.
      expect(step, copy.path).toContain("post a GitHub Issue comment on the plan/milestone issue");
      expect(lineWith(copy.body, "git add -f", copy.path)).toBe(step);
      sentences.push(sentenceWith(step, "git add -f", copy.path));
    }
    expect(new Set(sentences).size, "checkpoint sentence differs across trees").toBe(1);
  });
});

// --- TESTING.md dogfood table (S-006, #275) ----------------------------------

describe("TESTING.md", () => {
  // PT-30 / CT-12 — S-006 AC-2, AC-3; D-39, D-42; A-12, A-16. Behavioural
  // criteria are verified by dogfood and recorded here with the satisfying
  // issue number, `n/a (pre-rule)` for the two stories that ran before
  // S-003's rule existed, or `pending` until the event happens.
  it("dogfood table", () => {
    const content = readFileSync(resolve(ROOT, "TESTING.md"), "utf-8");
    // S-006 bumped the version from 1.0; later changelog rows bump it again, so pin a floor, not a value.
    expect(content).toMatch(/^version: [1-9]\d*\.\d+$/m);
    expect(content).not.toMatch(/^version: 1\.0$/m);
    const sections = splitIntoSections(stripFrontmatter(content));
    const dogfood = sections.find((s) => /Dogfood checks/.test(s.heading));
    expect(dogfood, "TESTING.md: no Dogfood checks section").toBeDefined();
    const rows = dogfood!.text.split("\n").filter((line) => line.startsWith("|"));
    expect(squashSpaces(rows[0] ?? "")).toMatch(/^\| Criterion \|.* Issue \|.* Status \|$/);
    const table = rows.join("\n");
    // PT-54 (A-38): the PRD AC-1 row reads `pending` until the wave 2 publish is recorded, then `observed`.
    expect(table).toMatch(/^\|[^\n]*PRD AC-1[^\n]*(pending|observed)/m);
    for (const [story, evidence] of [
      ["S-001", "#270"],
      ["S-002", "#271"],
      ["S-003", "#272"],
      ["S-004", "#273"],
      ["S-005", "#274"],
      ["S-006", "#275"],
    ]) {
      const row = rows.find((line) => line.includes("PRD AC-3") && line.includes(story));
      expect(row, `TESTING.md: no PRD AC-3 row for ${story}`).toBeDefined();
      expect(row!, story).toContain(evidence);
      if (story === "S-001" || story === "S-002") {
        expect(row!, story).toContain("n/a (pre-rule)");
      } else {
        expect(row!, story).toMatch(/observed/);
      }
    }
    expect(table).toMatch(/^\|[^\n]*FR-24[^\n]*pending/m);
    expect(table).toMatch(/^\|[^\n]*D-36[^\n]*pending/m);
    expect(table).toMatch(/^\|[^\n]*DF-4[^\n]*Project 5[^\n]*D-48/m);
    const changelog = sections.find((s) => s.heading === "Changelog");
    expect(changelog, "TESTING.md: no Changelog section").toBeDefined();
    expect(changelog!.text).toMatch(/^\| 1\.1 +\| \d{4}-\d{2}-\d{2} +\|[^\n]*Dogfood/m);
    // A-38 (S-008 task 1.10a): changelog rows live under `## Changelog`, never in the Test Layers table.
    expect(changelog!.text).toMatch(/^\| 1\.2 +\| \d{4}-\d{2}-\d{2} +\|/m);
    expect(changelog!.text).toMatch(/^\| 1\.3 +\| \d{4}-\d{2}-\d{2} +\|/m);
    const layers = sections.find((s) => s.heading === "Test Layers");
    expect(layers, "TESTING.md: no Test Layers section").toBeDefined();
    expect(layers!.text).not.toMatch(/^\| [\d.]+ +\| \d{4}-\d{2}-\d{2} +\|/m);
  });
});
