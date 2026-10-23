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

import { execFileSync } from "node:child_process";
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

// --- whole-body negatives (S-010 qa gate, carried into S-011) ----------------
//
// The parity checks above fail only when a change differs between trees. These
// matchers also catch a harmful sentence added identically to all three copies.

/**
 * Clauses of `text` in which an agent closes an issue or story. Code spans are
 * dropped first (`Closes #N` is the PR keyword, `gh issue close` has its own
 * negative), bold markers are dropped, and each line is split into clauses at
 * `. `, `; `, `: ` and ` — `. A clause is allowed when nobody, never, neither
 * or **MUST NOT** directly governs the closing verb ("never closes", not a
 * "never" elsewhere in the clause), when GitHub closes the issue, or when it
 * says how the keyword behaves (a comma list "closes only the first", a story
 * PR "closes nothing"); the confirmation that an issue reads `closed` never
 * matches, because `closed` is not the word `close`. With `pronouns`, a
 * pronoun object ("closes it", "close them") counts as closing too, for the
 * sections where "it" can only be an issue (Phase 6).
 */
const AGENT_CLOSES = /\b(close|closes)\b[^\n]*\b(issue|story)\b/i;
const PRONOUN_CLOSES = /\b(close|closes)\s+(it|them)\b/i;
const CLOSE_ALLOWED =
  /\b(nobody|never|neither|MUST NOT)\s+(close|closes)\b|\bGitHub closes\b|\bcloses (only the first|nothing)\b/i;

function agentClosingClauses(text: string, pronouns = false): string[] {
  const found: string[] = [];
  for (const line of text.split("\n")) {
    const plain = line.replace(/`[^`]*`/g, "").replace(/\*\*/g, "");
    for (const clause of plain.split(/[.;:]\s+|\s—\s/)) {
      const closes = AGENT_CLOSES.test(clause) || (pronouns && PRONOUN_CLOSES.test(clause));
      if (closes && !CLOSE_ALLOWED.test(clause)) found.push(clause.trim());
    }
  }
  return found;
}

/**
 * Clauses of `text` that write to `main`: a push, commit, merge or write verb
 * aimed `to`, `on` or `into` `main` within one clause (split at `. `, `; `,
 * `, `, `: ` and ` — `). Opening a PR to `main` is not a write (S-011 qa gate).
 */
const MAIN_WRITE =
  /\b(push|pushes|pushed|commit|commits|committed|merge|merges|merged|write|writes|written)\b[^\n]*\b(to|on|into)\s+`?main\b/i;

function mainWriteClauses(text: string): string[] {
  return text
    .split(/[.;,:]\s+|\s—\s/)
    .filter((clause) => MAIN_WRITE.test(clause))
    .map((clause) => clause.trim());
}

/** Deleting the integration branch in any wording or command (S-011 qa gate). */
const DELETES_INTEGRATION =
  /\b(delete|deletes|deleting|deleted|remove|removes|removing)\b[^\n]*\bintegration branch\b|git branch -[dD]\b|git push origin --delete\b/i;

/** The wave closes only when every story merged; no wording widens that (S-010 qa gate). */
const WAVE_CLOSES_ANYWAY = /Closes #<wave>[^\n]*(even|regardless|always)/;

/** A Project write in plain words, case-insensitive so `projectItems` counts too (D-23). */
const PROJECT_WRITE_WORDS = /\b(move|set|update|edit)\b[^\n]*Project/i;

/** Another closing keyword in place of `Closes` (D-56). */
const OTHER_CLOSING_KEYWORD = /\b(Fixes|Resolves)\b #/;

/**
 * Whether `line` asks for the Project token scope in any wording: a `gh auth`
 * call or a `-s project` / `--scopes` flag anywhere, or a clause that names a
 * scope with a request verb and no negation (D-24, D-68).
 */
function asksForScope(line: string): boolean {
  if (/gh auth\b|-s project\b|--scopes?\b/.test(line)) return true;
  return line
    .split(/[.;,:]\s+|\s—\s/)
    .some(
      (clause) =>
        /\bscopes?\b/i.test(clause) &&
        /\b(ask|asks|request|requests|need|needs|needed|require|requires|grant|add|refresh)\b/i.test(
          clause,
        ) &&
        !/\b(no|never|not|nor|without)\b/i.test(clause),
    );
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

/** The `State` cell of github-ops's wave status template row (A-20, D-63). */
function waveStateCell(copy: TreeCopy): string {
  const section = sectionOf(copy, "Status comment");
  const fence = (section.match(/```text\n[\s\S]*?```/g) ?? []).find((f) =>
    f.includes("Integration HEAD"),
  );
  expect(fence, `${copy.path}: no wave status template`).toBeDefined();
  const row = fence!.split("\n").find((line) => line.startsWith("| <story id>"));
  expect(row, `${copy.path}: no wave template row`).toBeDefined();
  return row!.split("|")[2].trim();
}

/** The `State` cell of github-ops's PRD status template row (A-21, D-63). */
function prdStateCell(copy: TreeCopy): string {
  const section = sectionOf(copy, "Status comment");
  const fence = (section.match(/```text\n[\s\S]*?```/g) ?? []).find((f) => f.includes("| Wave "));
  expect(fence, `${copy.path}: no PRD status template`).toBeDefined();
  const row = fence!.split("\n").find((line) => line.startsWith("| <id>"));
  expect(row, `${copy.path}: no PRD template row`).toBeDefined();
  return row!.split("|")[2].trim();
}

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

  // PT-4 extension — S-009 2.2a; A-20, D-63: one state vocabulary with the planner.
  it("wave table states", () => {
    const cells = trees.map(waveStateCell);
    for (const cell of cells) {
      expect(cell).toBe(
        "<pending, in progress (sub-task n of m), PR open, merged into integration or blocked>",
      );
    }
  });

  // CT-16 / PT-4 extension — S-018 6.2a; A-21, A-36 (EC-93), D-63: the PRD table
  // carries every state publish and the planner write, and one row per wave.
  it("PRD table states", () => {
    const rules: string[] = [];
    for (const copy of trees) {
      expect(prdStateCell(copy), copy.path).toBe(
        "<published, in progress, consolidated PR #n open or shipped>",
      );
      const section = sectionOf(copy, "Status comment");
      const rule = lineWith(section, "one row per wave", copy.path);
      expect(rule, copy.path).toMatch(/edited in place[^\n]*never[^\n]*second/);
      rules.push(rule);
    }
    expect(new Set(rules).size, "PRD row rule differs across trees").toBe(1);
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

  // PT-48 / CT-23 — S-010 AC-4; D-56, D-67
  it("consolidated PR Why rule", () => {
    const lines: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Pull Request Conventions");
      expect(section, copy.path).toContain(
        "The `## Why` section **MUST** reference the appropriate issue",
      );
      const line = lineWith(section, "A consolidated PR", copy.path);
      for (const marker of [
        "consolidated PR",
        "default branch",
        "Closes #<number>",
        "every story issue",
        "wave tracking issue",
        "`Refs` is for everything else",
      ]) {
        expect(line, `${copy.path}: Why rule lacks ${marker}`).toContain(marker);
      }
      // S-010 qa gate: no other closing keyword in place of `Closes`.
      expect(line, copy.path).not.toMatch(OTHER_CLOSING_KEYWORD);
      lines.push(line);
    }
    expect(new Set(lines).size, "consolidated PR Why rule differs across trees").toBe(1);
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

// --- activity-publish-github extension (S-018, #296) ------------------------

const PRD_STATUS_VALUES = "prd_status: written | failed(<reason>) | skipped(no PRD issue)";

describe("activity-publish-github PRD status comment", () => {
  const trees = loadTrees(PUBLISH_TREES);

  // PT-50 / CT-16 — S-018 AC-1; FR-25, D-25, D-26, D-33; A-36 (EC-92, EC-93)
  it("PRD status comment", () => {
    const steps: string[] = [];
    const cell = prdStateCell(loadTrees(GITHUB_OPS_TREES)[0]);
    expect(cell, "github-ops PRD table lacks published").toContain("published");
    for (const copy of trees) {
      const process = sectionOf(copy, "Process");
      inOrder(
        process,
        [
          "**Attach and Verify the Hierarchy:**",
          "**Write the PRD Status Comment:**",
          "**Save Output.**",
        ],
        copy.path,
      );
      const step = lineWith(process, "**Write the PRD Status Comment:**", copy.path);
      for (const marker of [
        "After the hierarchy is verified",
        "github-ops § Status comment",
        "PRD table",
        "implement § Status Comment",
        "create or edit",
        "`published`",
        "never added a second time",
        "`PRD issue` line",
        "`level: prd` search",
        "skip the write",
        PRD_STATUS_VALUES,
        "never stops the publication",
      ]) {
        expect(step, `${copy.path}: PRD status step lacks ${marker}`).toContain(marker);
      }
      // D-33: the table is referenced, never restated.
      expect(squashSpaces(copy.body), copy.path).not.toContain("| Wave | State | Wave issue |");
      const report = sectionOf(copy, "Output Structure");
      const tracking = report.slice(
        report.indexOf("## Tracking Issues"),
        report.indexOf("## Created Issues"),
      );
      expect(tracking, copy.path).toContain(`- ${PRD_STATUS_VALUES}`);
      const final = sectionOf(copy, "Final Instructions");
      expect(final, copy.path).toMatch(
        /PRD issue's status comment[^\n]*`published`[^\n]*prd_status/,
      );
      steps.push(step);
    }
    expect(new Set(steps).size, "PRD status step differs across trees").toBe(1);
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

  // PT-49 — S-010 AC-5; D-22, D-50, D-54; A-43; EC-69, EC-71
  it("nobody closes", () => {
    const sentences: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Before Closing");
      const rule = lineWith(section, "Nobody closes the GitHub Issue", copy.path);
      for (const marker of [
        "`Closes #N`",
        "default branch",
        "consolidated PR",
        "story PR itself",
      ]) {
        expect(rule, `${copy.path}: nobody-closes rule lacks ${marker}`).toContain(marker);
      }
      expect(rule, copy.path).toContain("main-thread run");
      const lifecycle = sectionOf(copy, "GitHub Execution Rules Summary")
        .split("\n")
        .find((line) => line.startsWith("| **Before closing**"));
      expect(lifecycle, `${copy.path}: no Before closing row`).toBeDefined();
      expect(lifecycle!, copy.path).not.toContain("Then close issue");
      expect(lifecycle!, copy.path).toContain("GitHub closes the issue");
      expect(sectionOf(copy, "Final Instructions"), copy.path).toMatch(
        /^5\. .*(nobody|never)[^\n]*close/m,
      );
      for (const old of [
        "You **MUST NOT** close the GitHub Issue until the PR is approved **AND** merged.",
        "You **MUST NOT** close the issue while the PR is still in draft or pending review.",
        "You **MUST NOT** close a GitHub Issue without confirming the PR has been reviewed, approved, and merged.",
        "Then close issue",
      ]) {
        expect(copy.body, `${copy.path}: old close wording "${old}"`).not.toContain(old);
      }
      // EC-71: story PRs still carry `Closes #N`; GitHub ignores it on a non-default base.
      expect(copy.body, copy.path).toContain(
        "PR description **MUST** include `Closes #<issue-number>`",
      );
      sentences.push(rule);
    }
    expect(new Set(sentences).size, "nobody-closes rule differs across trees").toBe(1);
  });

  // S-010 qa gate, carried into S-011: an agent closing an issue, added identically to all trees.
  it("no agent closes (whole body)", () => {
    for (const copy of trees) {
      expect(agentClosingClauses(copy.body), `${copy.path}: an agent closes an issue`).toEqual([]);
      for (const [index, line] of copy.body.split("\n").entries()) {
        expect(line, `${copy.path}:${index + 1} closes the wave anyway`).not.toMatch(
          WAVE_CLOSES_ANYWAY,
        );
      }
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
 * Extensions the guard reads under `GUARDED_ROOTS` (D-77, amending D-44 and
 * D-49): hooks (`.sh`), workflows (`.yml`, `.yaml`) and settings (`.json`)
 * can carry a `gh project item-edit` as easily as a prompt can.
 */
const GUARDED_EXTENSIONS = [".md", ".sh", ".yml", ".yaml", ".json"] as const;

/**
 * `templates/` ships to consumers verbatim, so every file under it is walked,
 * whatever its extension (D-77); binaries are skipped by content, not name.
 */
const GUARDED_ALL_FILES_ROOT = "templates/";

/**
 * Project Status is never written by an agent (D-23). The only `gh project`
 * verbs that may appear anywhere are the runbook's setup and read verbs
 * (`create`, `field-delete`, `view`, `field-list`); the two item writes are
 * forbidden in every file the walk reaches. Hoisted above the activity-init
 * block because PT-25 reuses it for the runbook's own line-scoped negative.
 */
const PROJECT_WRITE = /gh\s+project\s+item-(edit|add)\b/;

/**
 * Files that legitimately carry a Project write string, each with the reason.
 * Empty on purpose: when the widened walk (D-77) first ran it found no hit.
 * An entry here is a reviewed exception (a guard that blocks the command, a
 * test fixture), never a way to silence a real Project write in a shipped
 * prompt or template: that is a bug to fix, not to allowlist.
 */
const PROJECT_WRITE_ALLOWLIST: ReadonlyMap<string, string> = new Map<string, string>([]);

/**
 * True when the guard reads `path` (repo-relative, forward slashes): any file
 * under `templates/`, or a guarded extension under a guarded root outside
 * `docs/requirements/` (D-44, D-49, D-77).
 */
function isGuardedPath(path: string): boolean {
  if (path.startsWith(GUARDED_ALL_FILES_ROOT)) return true;
  if (path.startsWith(GUARD_EXCLUDED_PREFIX)) return false;
  if (!GUARDED_ROOTS.some((root) => path.startsWith(`${root}/`))) return false;
  return GUARDED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Every tracked file in the repository, from `git ls-files`, so untracked
 * noise (`node_modules/`, `.git/`, `.claude/worktrees/`, anything gitignored)
 * never enters the walk (D-77).
 */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf-8" })
    .split("\0")
    .filter((path) => path.length > 0)
    .sort();
}

/** A file is treated as binary when its first 8 KiB holds a NUL byte. */
function isBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 8192).includes(0);
}

/**
 * The guard walk (D-77): every tracked file the guard reads, as a
 * repo-relative path, sorted. Binary files are dropped.
 */
function guardedFiles(): string[] {
  return trackedFiles()
    .filter(isGuardedPath)
    .filter((path) => !isBinary(readFileSync(resolve(ROOT, path))));
}

/** Every tracked `.md` under `root`, as a repo-relative path, sorted. */
function markdownFiles(root: string): string[] {
  return trackedFiles()
    .filter((path) => path.startsWith(`${root}/`) && path.endsWith(".md"))
    .filter((path) => !path.startsWith(GUARD_EXCLUDED_PREFIX));
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

  // PT-28c — #284; D-77. The widened walk reaches a hook, a workflow, a
  // settings file and every templates/ file, and still skips docs/requirements/
  // and files outside the guarded roots.
  it("walk scope covers every guarded extension and templates/", () => {
    const walked = [
      ".claude/hooks/git-guard.sh",
      ".github/workflows/ci.yml",
      ".kiro/hooks/git-guard.yaml",
      ".claude/settings.json",
      "docs/runbooks/runbook-configure-github-project.md",
      "templates/scripts/deploy.sh",
      "templates/workflows/deploy-dev.yml",
      "templates/infra/redaction-patterns.txt",
    ];
    const skipped = [
      "docs/requirements/prd-projects-tracking.md",
      "docs/requirements/notes.sh",
      "workstream/decisions-projects-tracking.md",
      "test/unit/projects-tracking-parity.test.ts",
      ".claude/agents/logo.png",
      "README.md",
    ];
    for (const path of walked) expect(isGuardedPath(path), `walk skips ${path}`).toBe(true);
    for (const path of skipped) expect(isGuardedPath(path), `walk reads ${path}`).toBe(false);
    const files = guardedFiles();
    // No `.yaml` is tracked under the four roots today (only templates/infra/
    // environments.yaml), so presence is asserted for the four that are.
    for (const ext of [".md", ".sh", ".yml", ".json"]) {
      expect(
        files.some((f) => !f.startsWith(GUARDED_ALL_FILES_ROOT) && f.endsWith(ext)),
        `walk found no ${ext} file`,
      ).toBe(true);
    }
    expect(files.some((f) => f.startsWith(GUARDED_ALL_FILES_ROOT))).toBe(true);
    expect(files.some((f) => f.startsWith(GUARD_EXCLUDED_PREFIX))).toBe(false);
  });

  // PT-28d — #284; D-77. A Project write on a shell or a YAML line is caught.
  it("matcher catches a .sh and a .yml line", () => {
    const shellLine = 'gh project item-edit --id "$ITEM" --field-id "$FIELD" --project-id "$PID"';
    const yamlLine =
      "        run: gh project item-add 5 --owner llipe --url ${{ github.event.issue.html_url }}";
    expect(shellLine, "matcher misses a .sh line").toMatch(PROJECT_WRITE);
    expect(yamlLine, "matcher misses a .yml line").toMatch(PROJECT_WRITE);
  });

  // PT-28 — S-006 AC-1; PRD AC-3a; FR-6; D-23, D-44, D-49, D-77. Line-scoped so
  // the failure names the file and line; a code fence quoting the command fails
  // too (EC-34). D-77 widens the walk from `.md` only to `.sh`, `.yml`, `.yaml`
  // and `.json` under the four roots plus every file under `templates/`;
  // `docs/requirements/` stays excluded (D-49).
  it("no gh project writes in any tree", () => {
    const files = guardedFiles();
    for (const root of [...GUARDED_ROOTS, "templates"]) {
      expect(
        files.some((f) => f.startsWith(`${root}/`)),
        `${root}: walk found no files`,
      ).toBe(true);
    }
    for (const file of files) {
      if (PROJECT_WRITE_ALLOWLIST.has(file)) continue;
      const lines = readFileSync(resolve(ROOT, file), "utf-8").split("\n");
      for (const [index, line] of lines.entries()) {
        expect(line, `${file}:${index + 1} writes a Project item`).not.toMatch(PROJECT_WRITE);
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

  // PT-32 — S-018 AC-3 (`plan` half); FR-25; EC-94
  it("artifacts task plan line", () => {
    const steps: string[] = [];
    for (const copy of trees) {
      const process = sectionOf(copy, "Process");
      inOrder(process, ["**Save Output.**", "**Set the Task Plan Line:**"], copy.path);
      const step = lineWith(process, "**Set the Task Plan Line:**", copy.path);
      for (const marker of [
        "When the plan header reads `Wave issue: #N`",
        "wave issue body",
        "`Task plan:`",
        "`## Artifacts`",
        "gh issue view <N> --json body --jq .body",
        "gh issue edit <N> --body-file <path>",
        "`Wave issue: none`",
        "`pending`",
      ]) {
        expect(step, `${copy.path}: Task plan step lacks ${marker}`).toContain(marker);
      }
      expect(copy.body, copy.path).not.toContain('--body "');
      expect(sectionOf(copy, "Final Instructions"), copy.path).toMatch(
        /wave issue[^\n]*`Task plan:`/,
      );
      steps.push(step);
    }
    expect(new Set(steps).size, "Task plan step differs across trees").toBe(1);
  });
});

// --- planner (S-008, #291) ---------------------------------------------------

const PLANNER_TREES = {
  claude: ".claude/commands/planner.md", // a command on Claude, an agent elsewhere
  github: ".github/agents/planner.agent.md",
  kiro: ".kiro/agents/planner.md",
};

/** CT-18 / D-64: the wave's story issues and their states, the roadmap's primary source. */
const ROADMAP_SUB_ISSUES =
  "gh api repos/{o}/{r}/issues/{wave}/sub_issues --jq '.[] | {number,state}'";
/** CT-18 / D-55: the title search, kept as the no-wave-issue fallback (D-64). */
const ROADMAP_ISSUE_SEARCH =
  'gh issue list --search "[PRD-<name>] in:title" --state all --json number,state';
/** CT-18 / D-55: the story PRs merged into the integration branch. */
const ROADMAP_STORY_PRS = "gh pr list --base <integration branch> --state merged --json number";

/** S-009 qa M4: a per-merge comment in any wording or case. */
const PER_MERGE_COMMENT = /\bpost\b[^\n]*\bcomment\b/i;

/** CT-22: the D-36 wave search, byte-identical to activity-publish-github's. */
const WAVE_SEARCH =
  'gh issue list --label "level: wave" --search "[PRD-<name>] Wave <id>: in:title" --state open --json number,title --jq \'map(select(.title | startswith("[PRD-<name>] Wave <id>:")))\'';

/** A-29 / D-69: the PRD issue is the wave issue's parent. */
const PRD_PARENT = "gh api repos/{o}/{r}/issues/{wave}/parent --jq .number";
/** D-36: the PRD search, byte-identical to activity-publish-github's. */
const PRD_SEARCH =
  'gh issue list --label "level: prd" --search "[PRD-<name>] in:title" --state open --json number,title --jq \'map(select(.title | startswith("[PRD-<name>]")))\'';

/** The Phase 3 span, from its heading to the first `---` (LT-11). */
function phase3Of(copy: TreeCopy): string {
  const match = copy.body.match(/## Phase 3 - Pre-flight[\s\S]*?\n---\n/);
  expect(match, `${copy.path}: no Phase 3 span`).not.toBeNull();
  return match![0];
}

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
      // S-008 qa gate G1: anchor on the step markers inside the resolution list, not on
      // the intro sentence's own `Wave issue:` mention, so swapping steps 1 and 2 fails.
      const order = text.indexOf("Resolve in this order:");
      expect(order, `${copy.path}: no "Resolve in this order:" list`).toBeGreaterThanOrEqual(0);
      const steps = text.slice(order);
      inOrder(
        steps,
        [
          "1. **Plan header.**",
          "`Wave issue:`",
          "2. **Search.**",
          WAVE_SEARCH,
          "3. **Skip.**",
          "wave_status: skipped(no wave issue)",
        ],
        copy.path,
      );
      expect(text, copy.path).toMatch(/[Mm]ore than one[^\n]*stop/);
      // EC-41: header `none` with one search match — the search wins and is recorded.
      expect(text, copy.path).toMatch(/`Wave issue: none`[^\n]*search[^\n]*record/);
      // S-008 qa gate G2: scoped to the Phase 0 span; S-009 uses the same value in the
      // Wave Status Comment section and the Decisions Log template.
      const phase0Of = (c: TreeCopy): string =>
        c.body.match(/## Phase 0 - Discover Task Source[\s\S]*?\n---\n/)![0];
      expect(lineWith(text, "wave_status: skipped(no wave issue)", copy.path)).toBe(
        lineWith(phase0Of(trees[0]), "wave_status: skipped(no wave issue)", trees[0].path),
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
      expect(lineWith(copy.body, "git add -f", copy.path)).toBe(step);
      sentences.push(sentenceWith(step, "git add -f", copy.path));
    }
    expect(new Set(sentences).size, "checkpoint sentence differs across trees").toBe(1);
  });

  // PT-36 / CT-15 — S-009 AC-1; FR-12, D-25, D-26, D-33, D-53, D-70 (A-30, A-40)
  it("wave status comment events", () => {
    const waveSections: string[] = [];
    const cell = waveStateCell(loadTrees(GITHUB_OPS_TREES)[0]);
    for (const copy of trees) {
      // D-33: referenced by name, never restated.
      expect(copy.body, copy.path).toContain("implement § Status Comment");
      expect(copy.body, copy.path).toContain("github-ops § Status comment");
      expect(squashSpaces(copy.body), copy.path).not.toContain("| Story | State | PR | Sub-task |");
      const section = sectionOf(copy, "Wave Status Comment");
      inOrder(
        section,
        [
          "**Run start**",
          "**Resume**",
          "**Story start**",
          "**Developer closeout**",
          "**Merge**",
          "**Block**",
          "**Rollup**",
          "**Consolidated PR open**",
          "**Close-out**",
        ],
        copy.path,
      );
      // CT-15 / A-20: every state the planner writes is in github-ops's wave table cell.
      for (const state of [
        "pending",
        "in progress (sub-task n of m)",
        "PR open",
        "merged into integration",
        "blocked",
      ]) {
        expect(section, `${copy.path}: planner does not write "${state}"`).toContain(
          `\`${state}\``,
        );
        expect(cell, `github-ops wave table lacks "${state}"`).toContain(state);
      }
      waveSections.push(section);
      // A-30 / D-70: run start is after pre-flight, not at the end of Phase 0.
      const phase3 = copy.body.match(/## Phase 3 - Pre-flight[\s\S]*?\n---\n/);
      expect(phase3, `${copy.path}: no Phase 3 span`).not.toBeNull();
      expect(phase3![0], copy.path).toMatch(/create the wave status comment/);
      const phase0 = copy.body.match(/## Phase 0 - Discover Task Source[\s\S]*?\n---\n/)![0];
      expect(phase0, copy.path).not.toContain("wave status comment");
      // Resume edits, never creates.
      const resume = copy.sections.find((s) => s.heading.includes("Resume Detection"));
      expect(resume!.text, copy.path).toMatch(/edit the wave status comment[^\n]*never create/);
      const handoff = sectionOf(copy, "Per-story handoff");
      expect(handoff, copy.path).toMatch(/wave status comment[^\n]*story start[^\n]*closeout/);
      expect(step13(copy), copy.path).toContain("edit the wave status comment");
      const blocked = sectionOf(copy, "Error Handling")
        .split("\n")
        .find((line) => line.startsWith("| Story returns blocked"));
      expect(blocked, `${copy.path}: no "Story returns blocked" row`).toBeDefined();
      expect(blocked!, copy.path).toContain("wave status comment");
      // A-40: PR open and close-out edit the same comment.
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      expect(lineWith(phase5, "Open one consolidated PR", copy.path), copy.path).toContain(
        "wave status comment",
      );
      // Verifier S-009 DR-5: the close-out event points at Phase 6, matched by text, not by number.
      expect(lineWith(section, "**Close-out**", copy.path), copy.path).toContain("Phase 6");
      expect(lineWith(section, "**Close-out**", copy.path), copy.path).not.toContain("Phase 5");
      expect(sectionOf(copy, "Phase 6 - Close-out"), copy.path).toContain(
        "edit the wave status comment",
      );
    }
    expect(new Set(waveSections).size, "Wave Status Comment section differs across trees").toBe(1);
  });

  // PT-37 — S-009 AC-2; D-53 (A-31, A-32, A-45)
  it("no per-merge comment", () => {
    const invariants: string[] = [];
    for (const copy of trees) {
      expect(copy.body, copy.path).not.toContain(
        "post a GitHub Issue comment on the plan/milestone issue",
      );
      // A-31: Phase 5 step 3's rollup summary no longer goes to that issue either.
      expect(copy.body, copy.path).not.toContain("plan/milestone issue");
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      expect(phase5.match(/^3\. .*$/m)![0], copy.path).toContain("wave status comment");
      const section = sectionOf(copy, "Invariants");
      expect(section, copy.path).not.toContain("post a GitHub comment with status");
      const line = lineWith(section, "edit the wave status comment", copy.path);
      // A-32: one rewrite covers both halves.
      expect(line, copy.path).toContain("commit the state file");
      invariants.push(line);
    }
    expect(new Set(invariants).size, "Invariant line differs across trees").toBe(1);
  });

  // PT-38 — S-009 AC-3; D-53, spec §9
  it("wave_status report values", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Wave Status Comment");
      for (const marker of [
        "wave_status: skipped(no wave issue)",
        "wave_status: failed(<reason>)",
        "failed(duplicate marker)",
        "Decisions Log",
        "run summary",
      ]) {
        expect(section, `${copy.path}: Wave Status Comment lacks ${marker}`).toContain(marker);
      }
      expect(section, copy.path).toMatch(/never blocks?[^\n]*merge/);
      const decisions = sectionOf(copy, "State File Format").match(
        /## Decisions Log\n\n([\s\S]*?)\n```/,
      );
      expect(decisions, `${copy.path}: no Decisions Log in the state template`).not.toBeNull();
      expect(decisions![1], copy.path).toContain("wave_status:");
      expect(sectionOf(copy, "Output Contract"), copy.path).toContain("`wave_status`");
    }
  });

  // S-009 gate hardening (qa M4, M8, M10, M11, M12, M17; verifier DR-3), carried into S-010.
  it("wave status comment timing and wording pins", () => {
    const blockedRows: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Wave Status Comment");
      // M12: run start is in Phase 3 (D-70).
      expect(lineWith(section, "**Run start**", copy.path), copy.path).toContain("Phase 3");
      // M10 / M11: the timing phrases are pinned, not only the event names.
      expect(lineWith(section, "**Story start**", copy.path), copy.path).toContain(
        "before each developer handoff",
      );
      expect(lineWith(section, "**Merge**", copy.path), copy.path).toContain(
        "after the checkpoint push",
      );
      // M17: the closeout event keeps the gates cell.
      expect(lineWith(section, "**Developer closeout**", copy.path), copy.path).toContain(
        "`Gates` carries the payload's quality gates",
      );
      // M4: a reworded per-merge comment is rejected too, not only the old sentence.
      const perMergeComment = PER_MERGE_COMMENT;
      for (const line of sectionOf(copy, "Invariants").split("\n")) {
        expect(line, `${copy.path}: Invariants posts a comment`).not.toMatch(perMergeComment);
      }
      expect(step13(copy), `${copy.path}: step 13 posts a comment`).not.toMatch(perMergeComment);
      // DR-3: the list in step 13 reads "…, and update the `Last updated` timestamp".
      expect(step13(copy), copy.path).toContain(
        "update `Current Position` to the next pending story, and update the `Last updated` timestamp.",
      );
      // M8: the blocked row is the same text in every tree (padding aside).
      const blocked = sectionOf(copy, "Error Handling")
        .split("\n")
        .find((line) => line.startsWith("| Story returns blocked"));
      expect(blocked, `${copy.path}: no "Story returns blocked" row`).toBeDefined();
      blockedRows.push(squashSpaces(blocked!).trim());
    }
    expect(new Set(blockedRows).size, "Story returns blocked row differs across trees").toBe(1);
  });

  // PT-39 — S-010 AC-1; FR-13, D-22, D-54
  it("never closes", () => {
    const sentences: string[] = [];
    for (const copy of trees) {
      const section = sectionOf(copy, "Merge management rule");
      expect(section, copy.path).toContain("never closes a story issue");
      expect(section, copy.path).toContain("consolidated PR merges to main");
      for (const [index, line] of copy.body.split("\n").entries()) {
        expect(line, `${copy.path}:${index + 1} closes an issue`).not.toMatch(/gh issue close/);
      }
      sentences.push(lineWith(section, "never closes a story issue", copy.path));
    }
    expect(new Set(sentences).size, "never-closes line differs across trees").toBe(1);
  });

  // PT-40 / CT-17 — S-010 AC-2; FR-15, D-56, D-67; A-34, A-35, A-47; EC-62, EC-63, EC-64
  it("consolidated PR Closes lines", () => {
    const rules: string[] = [];
    for (const copy of trees) {
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      for (const marker of ["Closes #N", "Closes #<wave>", "state table", "✅ Merged", "Refs #N"]) {
        expect(phase5, `${copy.path}: Phase 5 lacks ${marker}`).toContain(marker);
      }
      const rule = lineWith(phase5, "**Closes lines.**", copy.path);
      // A-35: under `## Why`, as github-ops's template names it.
      expect(rule, copy.path).toContain("`## Why`");
      // A-34: the wave closes only when every story merged.
      expect(rule, copy.path).toMatch(/`Closes #<wave>`[^\n]*only when every story[^\n]*merged/);
      // EC-63: an unmerged story gets `Refs` with the reason.
      expect(rule, copy.path).toMatch(/`Refs #N` with the reason[^\n]*not merged/);
      // EC-62: the no-wave case.
      expect(rule, copy.path).toContain("`Wave issue: none`");
      expect(rule, copy.path).toContain("no `Closes #<wave>` line");
      // EC-64: one keyword per issue.
      expect(rule, copy.path).toContain("one keyword per issue");
      expect(rule, copy.path).toContain("closes only the first");
      // The step 7 sub-bullet keeps the numbering that PT-36, PT-44 and roadmap-parity read (A-33).
      inOrder(phase5, ["7. Open one consolidated PR", "**Closes lines.**", "8. **Do NOT merge.**"]);
      const include = phase5.slice(phase5.indexOf("Consolidated PR should include"));
      expect(include, `${copy.path}: include list lacks Closes`).toMatch(/^- [^\n]*`Closes #N`/m);
      rules.push(rule);
    }
    expect(new Set(rules).size, "Closes rule differs across trees").toBe(1);
  });

  // PT-41 — S-010 AC-3; #285-AC3, D-50, D-68; A-37; EC-65, EC-66, EC-67
  it("DF-5 observation", () => {
    const rules: string[] = [];
    for (const copy of trees) {
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      const rule = lineWith(phase5, "**Project Status observation (read only).**", copy.path);
      for (const marker of [
        "project_observation: observed | not observed(<reason>)",
        "not observed(no project)",
        "In progress at consolidated PR open",
        "TESTING.md",
        "read only",
        "gh issue view <n> --json projectItems",
        "automation pending at <time>",
      ]) {
        expect(rule, `${copy.path}: observation lacks ${marker}`).toContain(marker);
      }
      // D-68: no Project number, no write, no scope request.
      expect(rule, copy.path).not.toMatch(PROJECT_WRITE);
      expect(rule, copy.path).not.toContain("gh project item-list");
      expect(rule, copy.path).not.toContain("gh auth refresh");
      inOrder(phase5, ["**Closes lines.**", "**Project Status observation (read only).**"]);
      const include = phase5.slice(phase5.indexOf("Consolidated PR should include"));
      expect(include, copy.path).toContain("project_observation");
      rules.push(rule);
    }
    expect(new Set(rules).size, "observation rule differs across trees").toBe(1);
  });
  // PT-42 / CT-18 — S-011 AC-1; FR-14, D-13, D-55, D-64, D-65; A-22, A-23; LT-11
  it("roadmap commands", () => {
    const steps: string[] = [];
    for (const copy of trees) {
      const all = copy.body.match(/^\d+\. \*\*Roadmap update \(mandatory\)\.\*\*.*$/gm) ?? [];
      expect(all, `${copy.path}: expected one roadmap step line`).toHaveLength(1);
      const step = all[0]!;
      for (const marker of [
        ROADMAP_SUB_ISSUES,
        ROADMAP_ISSUE_SEARCH,
        ROADMAP_STORY_PRS,
        "`In progress`",
        "consolidated PR to `main`",
        "verbatim",
        "Roadmap section",
        "`Wave issue: none`",
        "never from memory",
      ]) {
        expect(step, `${copy.path}: roadmap step lacks ${marker}`).toContain(marker);
      }
      // D-64: the wave's sub-issues first; the title search only as the no-wave fallback.
      inOrder(step, [ROADMAP_SUB_ISSUES, "`Wave issue: none`", ROADMAP_ISSUE_SEARCH], copy.path);
      // A-22: the fallback search is kept to this run's stories.
      expect(step, copy.path).toMatch(/fall back[^\n]*state table/);
      // Only Phase 6 sets `Done`, after the merge (D-55, D-61).
      expect(step, copy.path).not.toContain("(`Done` when every story in the phase/wave merged");
      expect(step, copy.path).toContain("only Phase 6 sets `Done`");
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      const include = phase5.slice(phase5.indexOf("Consolidated PR should include"));
      expect(lineWith(include, "docs/roadmap.md", copy.path), copy.path).toContain("verbatim");
      steps.push(step);
    }
    expect(new Set(steps).size, "roadmap step differs across trees").toBe(1);
  });

  // PT-43 / CT-19 — S-011 AC-2; D-55, D-58, D-61, D-66; A-24, A-36 (EC-74), A-41, A-46
  it("phase 6 steps", () => {
    const sections: string[] = [];
    const branchStates: string[] = [];
    for (const copy of trees) {
      const headings = copy.sections.map((s) => s.heading);
      const phase5At = headings.indexOf("Phase 5 - Consolidated Pull Request");
      const phase6At = headings.indexOf("Phase 6 - Close-out");
      expect(phase6At, `${copy.path}: no ## Phase 6 - Close-out`).toBeGreaterThan(phase5At);
      expect(copy.sections[phase6At].level, copy.path).toBe(2);
      expect(headings.indexOf("Roadmap Maintenance"), copy.path).toBeGreaterThan(phase6At);
      const section = sectionOf(copy, "Phase 6 - Close-out");
      // LT-9's extractor takes the first `13. ` line in the file; Phase 6 must not offer one.
      expect(section, copy.path).not.toMatch(/^13\. /m);
      const numbered = section.match(/^\d+\. .*$/gm) ?? [];
      expect(
        numbered.map((line) => Number(line.split(".")[0])),
        `${copy.path}: Phase 6 steps are not numbered 1 to 12`,
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      // D-66: reads first, then the close-out branch, then the writes, the PR, and the delete last.
      const heads = [
        "1. **Verify the merge.**",
        "2. **Pull main.**",
        "3. **Confirm the issues closed.**",
        "4. **Read the story PRs.**",
        "5. **Read the Project Status (read only).**",
        "6. **Create the close-out branch.**",
        "7. **Roadmap row.**",
        "8. **Archive the state file.**",
        "9. **Record the Done observation.**",
        "10. **Status comments.**",
        "11. **Open one `chore(roadmap)` PR to `main`.**",
        "12. **Delete the integration branch, last.**",
      ];
      inOrder(section, heads, copy.path);
      const step = (n: number): string => lineWith(section, heads[n - 1], copy.path);
      const expectations: [number, string[]][] = [
        [1, ["gh pr view <n> --json state,mergedAt", "`MERGED`", "stop", "write nothing"]],
        [2, ["`main`", "pull"]],
        [3, [ROADMAP_SUB_ISSUES, "`Wave issue: none`", "closed", "reported", "never"]],
        [4, [ROADMAP_STORY_PRS, "still exists"]],
        [
          5,
          [
            "gh issue view <n> --json projectItems",
            "`Done`",
            "not observed(no project)",
            "not observed(<reason>)",
            "never written",
          ],
        ],
        [6, ["chore/<plan-id>-closeout", "never on `main`"]],
        [
          7,
          [
            "docs/roadmap.md",
            "`Done`",
            "`—`",
            "consolidated PR",
            "never from memory",
            "product-engineer",
          ],
        ],
        [
          8,
          [
            "workstream/planner-state-<plan-id>.md",
            "workstream/archive/planner-state-<plan-id>-archived.md",
          ],
        ],
        [9, ["TESTING.md", "DF-5", "project_observation"]],
        [10, ["PRD issue", "status comment", "`shipped`", "edit the wave status comment"]],
        [11, ["chore(roadmap)", "`main`", "user", "never merges"]],
        [
          12,
          [
            "Delete the integration branch",
            "locally",
            "remotely",
            "after the close-out PR is open",
          ],
        ],
      ];
      for (const [n, markers] of expectations) {
        for (const marker of markers) {
          expect(step(n), `${copy.path}: Phase 6 step ${n} lacks ${marker}`).toContain(marker);
        }
      }
      // A-41 / D-66: any session, entered from the merged PR number and the plan id.
      const intro = section.slice(0, section.indexOf(heads[0]));
      for (const marker of ["any session", "fresh", "plan id", "PR number"]) {
        expect(intro, `${copy.path}: Phase 6 entry lacks ${marker}`).toContain(marker);
      }
      // EC-74: an issue still open after the merge is reported, never closed by hand.
      expect(step(3), copy.path).toMatch(/still open after the merge[^\n]*reported/);
      // Verifier S-011 DR-3: `Done` only when every story merged and the wave issue closed;
      // otherwise `In progress`, the unmerged stories named, and the PR body says so (FR-14).
      inOrder(
        step(7),
        [
          "every story in the state table reads `✅ Merged`",
          "the wave issue, when there is one, reads closed",
          "set `Status` to `Done` and `What's missing` to `—`",
          "Otherwise",
          "keep `Status` at `In progress`",
          "list the unmerged stories in `What's missing`",
          "say so in the close-out PR body",
        ],
        copy.path,
      );
      expect(step(7), copy.path).not.toMatch(/^7\. [^\n]*`Status` to `Done`;/);
      // Verifier S-011 DR-8: comment edits are API writes, not branch writes.
      expect(intro, copy.path).toContain(
        "step 10 edits GitHub comments through the API, which touches no branch",
      );
      expect(intro, copy.path).not.toContain("steps 6 to 11 write");
      expect(step(6), copy.path).toContain("every file change in steps 7 to 9");
      expect(step(6), copy.path).not.toContain("steps 7 to 11");
      // qa EC-86: Phase 0.5 and Phase 6 archive to the same path.
      expect(step(8), copy.path).toContain("the same path Phase 0.5 uses");
      const resume = copy.sections.find((s) => s.heading.includes("Resume Detection"));
      expect(lineWith(resume!.text, "If declined", copy.path), copy.path).toContain(
        "workstream/archive/planner-state-<plan-id>-archived.md",
      );
      expect(resume!.text, copy.path).not.toContain("rename with `-archived` suffix");
      // Verifier S-011 DR-4: the integration-branch end state holds at the Phase 5 handoff only.
      const branchState = lineWith(
        sectionOf(copy, "Invariants"),
        "final user-facing local branch state",
        copy.path,
      );
      for (const marker of [
        "At the Phase 5 handoff",
        "integration branch for the current run",
        "After Phase 6",
        "`main`",
        "close-out branch until its PR is open",
      ]) {
        expect(branchState, `${copy.path}: branch invariant lacks ${marker}`).toContain(marker);
      }
      branchStates.push(branchState);
      sections.push(section);
    }
    expect(new Set(sections).size, "Phase 6 section differs across trees").toBe(1);
    expect(new Set(branchStates).size, "branch invariant differs across trees").toBe(1);
  });

  // PT-44 — S-011 AC-3; D-61; A-33, A-41, A-42
  it("run completes at phase 6", () => {
    const invariants: string[] = [];
    for (const copy of trees) {
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      // Matched by text, never by step number (A-33).
      expect(
        lineWith(phase5, "Wait for the user to approve and merge", copy.path),
        copy.path,
      ).toContain("then run Phase 6");
      // A-42: the post-merge directive asks for Phase 6, not for a branch deletion.
      const followUp = lineWith(phase5, "post-merge follow-up action", copy.path);
      expect(followUp, copy.path).toContain("Phase 6");
      expect(followUp, copy.path).not.toContain("delete integration branch");
      const invariant = lineWith(
        sectionOf(copy, "Invariants"),
        "complete only after Phase 6",
        copy.path,
      );
      invariants.push(invariant);
      expect(sectionOf(copy, "Output Contract"), copy.path).toContain("Phase 6");
      expect(
        lineWith(sectionOf(copy, "Output Contract"), "Phase 6", copy.path),
        copy.path,
      ).toContain("complete only after Phase 6");
      // A-41: a resumed session with every story merged offers Phase 6, not a resume.
      const resume = copy.sections.find((s) => s.heading.includes("Resume Detection"));
      expect(resume!.text, copy.path).toMatch(/every story[^\n]*`✅ Merged`[^\n]*Phase 6/);
      expect(sectionOf(copy, "Roadmap Maintenance"), copy.path).toContain("Phase 6");
    }
    expect(new Set(invariants).size, "completion invariant differs across trees").toBe(1);
  });

  // PT-45 extension — S-018 6.3a; A-29, D-69: the PRD issue is the wave issue's parent.
  it("PRD issue resolution", () => {
    const sections: string[] = [];
    for (const copy of trees) {
      const phase0 = copy.body.match(/## Phase 0 - Discover Task Source[\s\S]*?\n---\n/)![0];
      inOrder(
        phase0,
        ["### Wave Issue Resolution", "### PRD Issue Resolution", "Confirm source and story count"],
        copy.path,
      );
      const section = sectionOf(copy, "PRD Issue Resolution");
      inOrder(section, [PRD_PARENT, "`404`", PRD_SEARCH, "`PRD issue: none`"], copy.path);
      for (const marker of ["`PRD issue: #N | none`", "Run Info", "more than one", "stop"]) {
        expect(section, `${copy.path}: PRD Issue Resolution lacks ${marker}`).toContain(marker);
      }
      const format = sectionOf(copy, "State File Format");
      expect(format.split("\n"), copy.path).toContain("- PRD issue: #N | none");
      const resume = copy.sections.find((s) => s.heading.includes("Resume Detection"));
      expect(lineWith(resume!.text, "`PRD issue`", copy.path), copy.path).toContain(
        "PRD Issue Resolution",
      );
      sections.push(section);
    }
    // The planner's fallback is publish's search, byte for byte (CT-22).
    for (const copy of loadTrees(PUBLISH_TREES)) {
      expect(copy.body, copy.path).toContain(PRD_SEARCH);
    }
    expect(new Set(sections).size, "PRD Issue Resolution differs across trees").toBe(1);
  });

  // PT-45 / CT-16 — S-018 AC-2; FR-25, D-25, D-26, D-33, D-61, D-70; EC-92, EC-93
  it("PRD status comment events", () => {
    const sections: string[] = [];
    const lines: string[] = [];
    const cell = prdStateCell(loadTrees(GITHUB_OPS_TREES)[0]);
    for (const copy of trees) {
      // D-33: the PRD table is referenced, never restated.
      expect(squashSpaces(copy.body), copy.path).not.toContain("| Wave | State | Wave issue |");
      const section = sectionOf(copy, "PRD Status Comment");
      for (const marker of [
        "github-ops § Status comment",
        "PRD table",
        "implement § Status Comment",
        PRD_STATUS_VALUES,
        "failed(duplicate marker)",
        "Decisions Log",
        "run summary",
        "never adding a second",
        "`published`",
      ]) {
        expect(section, `${copy.path}: PRD Status Comment lacks ${marker}`).toContain(marker);
      }
      // Tight event order: each event names its phase, then its state.
      inOrder(
        section,
        [
          "1. **Run start**",
          "Phase 3",
          "`in progress`",
          "2. **Consolidated PR open**",
          "Phase 5 step 7",
          "`consolidated PR #n open`",
          "3. **Close-out**",
          "Phase 6",
          "`shipped`",
        ],
        copy.path,
      );
      for (const state of ["in progress", "consolidated PR #n open", "shipped"]) {
        expect(cell, `github-ops PRD table lacks "${state}"`).toContain(state);
      }
      expect(lineWith(section, "never blocks", copy.path), copy.path).toContain(
        "A PRD status comment write never blocks a merge gate, a story, the consolidated PR handoff or the close-out PR.",
      );
      // Each event lands in its phase.
      const run = lineWith(phase3Of(copy), "PRD status comment", copy.path);
      expect(run, copy.path).toContain("this wave's row reads `in progress`");
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      const open = lineWith(phase5, "7. Open one consolidated PR", copy.path);
      inOrder(
        open,
        ["wave status comment", "PRD status comment", "row reads `consolidated PR #n open`"],
        copy.path,
      );
      const step10 = lineWith(sectionOf(copy, "Phase 6 - Close-out"), "10. **Status comments.**");
      inOrder(
        step10,
        [
          "PRD issue's status comment",
          "row reads `shipped`",
          "prd_status",
          "edit the wave status comment",
        ],
        copy.path,
      );
      // Across the body: run start, then PR open, then close-out.
      inOrder(
        copy.body,
        [
          "## Phase 3 - Pre-flight",
          "this wave's row reads `in progress`",
          "## Phase 5 - Consolidated Pull Request",
          "row reads `consolidated PR #n open`",
          "## Phase 6 - Close-out",
          "row reads `shipped`",
        ],
        copy.path,
      );
      // The state file records every value; the Output Contract reports it.
      const decisions = sectionOf(copy, "State File Format").match(
        /## Decisions Log\n\n([\s\S]*?)\n```/,
      );
      expect(decisions![1], copy.path).toContain("- prd_status: written | failed(<reason>)");
      expect(sectionOf(copy, "Output Contract"), copy.path).toContain("`prd_status`");
      sections.push(section);
      lines.push(run, open, step10);
    }
    expect(new Set(sections).size, "PRD Status Comment differs across trees").toBe(1);
    expect(new Set(lines).size, "PRD event lines differ across trees").toBe(3);
  });

  // PT-46 — S-018 AC-3 (planner half); FR-25, D-69; A-39 (EC-94, EC-99)
  it("artifacts fidelity report line", () => {
    const lines: string[] = [];
    for (const copy of trees) {
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      inOrder(
        phase5,
        ["3. Invoke `verifier`", "**Fidelity report line.**", "4. Invoke `technical-writer`"],
        copy.path,
      );
      const line = lineWith(phase5, "**Fidelity report line.**", copy.path);
      for (const marker of [
        "`Fidelity report:`",
        "`## Artifacts`",
        "fidelity report",
        "wave issue body",
        "gh issue view <wave> --json body --jq .body",
        "gh issue edit <wave> --body-file <path>",
        "after `Task plan:`",
        "`Wave issue: none`",
        "`pending`",
      ]) {
        expect(line, `${copy.path}: fidelity report line lacks ${marker}`).toContain(marker);
      }
      const branch = lineWith(phase3Of(copy), "`Integration branch:`", copy.path);
      for (const marker of [
        "wave issue body",
        "gh issue edit <wave> --body-file <path>",
        "`Wave issue: none`",
      ]) {
        expect(branch, `${copy.path}: Integration branch line lacks ${marker}`).toContain(marker);
      }
      expect(copy.body, copy.path).not.toContain('--body "');
      lines.push(line, branch);
    }
    expect(new Set(lines).size, "Artifacts lines differ across trees").toBe(2);
  });

  // S-011 qa gate, final hardening round: Phase 6 writes nothing to `main` and deletes the
  // integration branch only in step 12, from `main`.
  it("phase 6 write targets", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Phase 6 - Close-out");
      const first = section.indexOf("1. **Verify the merge.**");
      const last = section.indexOf("12. **Delete the integration branch, last.**");
      expect(first, copy.path).toBeGreaterThanOrEqual(0);
      expect(last, copy.path).toBeGreaterThan(first);
      const steps = section.slice(first, last);
      for (const line of steps.split("\n")) {
        expect(mainWriteClauses(line), `${copy.path}: Phase 6 writes to main: ${line}`).toEqual([]);
        expect(line, `${copy.path}: deletes the integration branch before step 12`).not.toMatch(
          DELETES_INTEGRATION,
        );
      }
      const step12 = lineWith(section, "12. **Delete the integration branch, last.**", copy.path);
      inOrder(
        step12,
        [
          "after the close-out PR is open",
          "check out `main`",
          "git branch -d <integration branch>",
          "git push origin --delete <integration branch>",
        ],
        copy.path,
      );
    }
  });

  // S-011 qa gate, final hardening round: only Phase 6 sets `Done`.
  it("phase 5 never sets Done", () => {
    const sentence = "only Phase 6 sets `Done`";
    for (const copy of trees) {
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      expect(phase5.split(sentence).length - 1, `${copy.path}: "${sentence}" count`).toBe(1);
      expect(phase5.replace(sentence, ""), `${copy.path}: Phase 5 names Done`).not.toMatch(
        /\bDone\b/,
      );
    }
  });

  // S-011 qa gate, final hardening round: wording pins and three-tree identity.
  it("close-out wording pins", () => {
    const thenRun: string[] = [];
    const offers: string[] = [];
    const outputs: string[] = [];
    for (const copy of trees) {
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      const phase6 = sectionOf(copy, "Phase 6 - Close-out");
      expect(lineWith(phase6, "7. **Roadmap row.**", copy.path), copy.path).toContain(
        "never invent one",
      );
      expect(lineWith(sectionOf(copy, "Wave Status Comment"), "never blocks", copy.path)).toContain(
        "A wave status comment write never blocks a merge gate, a story, or the consolidated PR handoff.",
      );
      expect(lineWith(phase6, "10. **Status comments.**", copy.path), copy.path).toContain(
        "never blocks the close-out PR",
      );
      // The completion sentence, in each place that states it.
      expect(
        lineWith(sectionOf(copy, "Invariants"), "complete only after Phase 6", copy.path),
      ).toMatch(/^- The run is complete only after Phase 6 - Close-out:/);
      const output = lineWith(sectionOf(copy, "Output Contract"), "Phase 6", copy.path);
      expect(output, copy.path).toContain("the run is complete only after Phase 6");
      expect(lineWith(phase6, "12. **Delete", copy.path), copy.path).toContain(
        "The run is complete only after this step.",
      );
      const run = lineWith(phase5, "then run Phase 6", copy.path);
      expect(run, copy.path).toContain("the run is not complete until Phase 6 has run");
      // Phase 0.5 offers Phase 6, not a resume, when every story merged; before the resume question.
      const resume = copy.sections.find((s) => s.heading.includes("Resume Detection"))!.text;
      const offer = lineWith(resume, "do not ask to resume", copy.path);
      for (const marker of [
        "every story reads `✅ Merged`",
        "the user reports the consolidated PR merged",
        "run Phase 6",
        "PR number",
      ]) {
        expect(offer, `${copy.path}: Phase 6 offer lacks ${marker}`).toContain(marker);
      }
      inOrder(resume, ["do not ask to resume", 'Ask: **"Resume from story'], copy.path);
      thenRun.push(run);
      offers.push(offer);
      outputs.push(output);
    }
    expect(new Set(thenRun).size, "Phase 5 then-run-Phase-6 line differs across trees").toBe(1);
    expect(new Set(offers).size, "Phase 0.5 Phase 6 offer differs across trees").toBe(1);
    expect(new Set(outputs).size, "Output Contract Phase 6 line differs across trees").toBe(1);
  });

  // S-010 qa gate, carried into S-011: harmful sentences added identically to all three trees.
  it("whole-body negatives", () => {
    for (const copy of trees) {
      expect(agentClosingClauses(copy.body), `${copy.path}: an agent closes an issue`).toEqual([]);
      for (const [index, line] of copy.body.split("\n").entries()) {
        expect(line, `${copy.path}:${index + 1} closes the wave anyway`).not.toMatch(
          WAVE_CLOSES_ANYWAY,
        );
      }
      const phase5 = sectionOf(copy, "Phase 5 - Consolidated Pull Request");
      const phase6 = sectionOf(copy, "Phase 6 - Close-out");
      // Final hardening round: in Phase 6, "closes it" is an agent closing an issue.
      expect(agentClosingClauses(phase6, true), `${copy.path}: Phase 6 closes it`).toEqual([]);
      for (const line of [
        lineWith(phase5, "**Project Status observation (read only).**", copy.path),
        lineWith(phase6, "**Read the Project Status (read only).**", copy.path),
      ]) {
        expect(line, `${copy.path}: Project write in plain words`).not.toMatch(PROJECT_WRITE_WORDS);
        expect(asksForScope(line), `${copy.path}: asks for the project scope: ${line}`).toBe(false);
      }
      for (const [name, text] of [
        ["Phase 5", phase5],
        ["Phase 6", phase6],
      ]) {
        expect(text, `${copy.path}: ${name} uses another closing keyword`).not.toMatch(
          OTHER_CLOSING_KEYWORD,
        );
      }
    }
  });

  // Mutation check for the matchers above: each catches its harmful form and passes the allowed ones.
  it("whole-body negative matchers self-check", () => {
    for (const harmful of [
      "The planner closes each story issue after the merge.",
      "Close the wave issue by hand once the PR merged.",
      "Then the developer closes the story.",
      "When the PR merges, close every open issue; GitHub may lag.",
      // Final hardening round: "never" must govern the closing verb itself.
      "The planner closes each story issue and never asks the user.",
      "Close the wave issue by hand, never waiting for GitHub.",
    ]) {
      expect(agentClosingClauses(harmful), `misses "${harmful}"`).not.toEqual([]);
    }
    for (const harmful of [
      "A story still open is reported, and the planner closes it by hand.",
      "Close them once the PR merged.",
    ]) {
      expect(agentClosingClauses(harmful, true), `misses "${harmful}"`).not.toEqual([]);
      expect(agentClosingClauses(harmful), `pronoun flagged outside Phase 6: "${harmful}"`).toEqual(
        [],
      );
    }
    expect(agentClosingClauses("Phase 6 never closes it by hand.", true)).toEqual([]);
    for (const harmful of [
      "commit the roadmap row on `main`",
      "push the archive to main",
      "then merge it into `main` yourself",
    ]) {
      expect(mainWriteClauses(harmful), `misses "${harmful}"`).not.toEqual([]);
    }
    for (const allowed of [
      "open one PR to `main` with the same title",
      "Check out `main` and pull it",
      "is committed on this branch, never on `main`",
    ]) {
      expect(mainWriteClauses(allowed), `wrongly flags "${allowed}"`).toEqual([]);
    }
    for (const harmful of [
      "delete the integration branch now",
      "run git branch -D <integration branch>",
      "git push origin --delete <integration branch>",
      "remove the remote integration branch",
    ]) {
      expect(harmful, `misses "${harmful}"`).toMatch(DELETES_INTEGRATION);
    }
    expect("while the integration branch still exists").not.toMatch(DELETES_INTEGRATION);
    for (const allowed of [
      "The planner never closes a story issue or the wave issue, and neither does any agent it delegates to.",
      "12. Nobody closes the GitHub Issue: not the implementing agent, not the `planner`.",
      "You **MUST NOT** close the issue by hand at any point, before or after the merge.",
      "→ Merged → GitHub closes the issue (`Closes #N` on a default-branch PR) |",
      "Confirm every story issue and the wave issue reads closed.",
      "- `Closes #N` for every merged story and `Closes #<wave>` when every story merged",
      "a comma list such as `Closes #1, #2` closes only the first issue",
    ]) {
      expect(agentClosingClauses(allowed), `wrongly flags "${allowed}"`).toEqual([]);
    }
    expect("`Closes #<wave>` even when a story is blocked").toMatch(WAVE_CLOSES_ANYWAY);
    expect("`Closes #<wave>` regardless of blocked stories").toMatch(WAVE_CLOSES_ANYWAY);
    expect("`Closes #<wave>` for the wave issue only when every story merged").not.toMatch(
      WAVE_CLOSES_ANYWAY,
    );
    for (const harmful of [
      "then move the item to Done on the Project board",
      "set the story's Status on the Project",
      "update its projectItems status",
      "Edit the Project item",
    ]) {
      expect(harmful, `misses "${harmful}"`).toMatch(PROJECT_WRITE_WORDS);
    }
    expect("read the Project Status with gh issue view").not.toMatch(PROJECT_WRITE_WORDS);
    for (const harmful of [
      "ask the user for the project scope first",
      "run gh auth refresh -s project",
      "the read requires the project token scope",
      "request the read:project scope",
    ]) {
      expect(asksForScope(harmful), `misses "${harmful}"`).toBe(true);
    }
    for (const allowed of [
      "so no Project number and no extra token scope is needed",
      "a refused read records not observed(<reason>) and never asks for more access",
    ]) {
      expect(asksForScope(allowed), `wrongly flags "${allowed}"`).toBe(false);
    }
    expect("Fixes #12").toMatch(OTHER_CLOSING_KEYWORD);
    expect("Resolves #12").toMatch(OTHER_CLOSING_KEYWORD);
    expect("Closes #12").not.toMatch(OTHER_CLOSING_KEYWORD);
    // The S-009 M4 matcher is case-insensitive.
    expect("Post a GitHub Comment after every merge").toMatch(PER_MERGE_COMMENT);
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

// --- verifier (S-012, #295) ---------------------------------------------------
//
// The Roadmap-Mismatch Finding compares the roadmap row with the wave tracking
// issue and its sub-issues when one exists, and with the merged story PRs
// otherwise (FR-16, D-57). Section byte-identity across trees is LT-11
// (`roadmap-parity.test.ts`); these checks pin the content.

const VERIFIER_TREES = {
  claude: ".claude/agents/verifier.md",
  github: ".github/agents/verifier.agent.md",
  kiro: ".kiro/agents/verifier.md",
};

/** The numbered trigger line starting `${n}. ` inside the finding section. */
function triggerLine(section: string, n: number, label: string): string {
  const lines = section.split("\n").filter((line) => line.startsWith(`${n}. `));
  expect(lines.length, `${label}: expected exactly one trigger line "${n}. "`).toBe(1);
  return lines[0];
}

describe("verifier", () => {
  const trees = loadTrees(VERIFIER_TREES);

  // PT-51 (S-012 AC-1, D-57).
  it("sub-issue comparison", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Roadmap-Mismatch Finding");
      const one = triggerLine(section, 1, copy.path);
      expect(one, copy.path).toContain("sub-issue");
      expect(one, copy.path).toContain("`state`");
      // DR-1: complete only when every sub-issue and the wave issue itself read closed (planner Phase 6 step 7).
      expect(one, copy.path).toContain("every sub-issue's `state` reads `closed`");
      expect(one, copy.path).toContain("the wave issue itself reads `closed`");
      expect(one, copy.path).not.toMatch(/\bany sub-issue/);
      // qa gate: trigger 2 names an open sub-issue.
      expect(triggerLine(section, 2, copy.path), copy.path).toContain("a sub-issue still `open`");
      expect(triggerLine(section, 4, copy.path), copy.path).toContain("sub-issue numbers");
      expect(section, copy.path).toContain("GET /repos/{o}/{r}/issues/{wave}/sub_issues");
      expect(section, copy.path).toContain(
        "gh api --paginate repos/{o}/{r}/issues/{wave}/sub_issues --jq '.[] | {number,state}'",
      );
      // D-36 search: `level: wave` label, title prefix, client-side `startswith`.
      expect(section, copy.path).toContain('--label "level: wave"');
      expect(section, copy.path).toContain('startswith("[PRD-<name>] Wave <id>:")');
      expect(section, copy.path).toContain("D-36");
      // DR-3: the verifier searches every state, with the reason stated, so an edit back to `open` fails.
      expect(section, copy.path).toContain(
        'gh issue list --label "level: wave" --search "[PRD-<name>] Wave <id>: in:title" --state all',
      );
      expect(section, copy.path).not.toContain('Wave <id>: in:title" --state open');
      expect(lineWith(section, "uses `--state all` because", copy.path), copy.path).toMatch(
        /after the wave ships[^\n]*closed wave issue[^\n]*`--state open`[^\n]*active wave/,
      );
      // qa gate: the report names what it read.
      expect(section, copy.path).toContain(
        'Name in the finding, or in its "no finding" line, the wave issue and the sub-issue states you read, or that you used the fallback.',
      );
    }
  });

  // PT-52 (S-012 AC-1): merged PRs stay the fallback.
  it("fallback", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Roadmap-Mismatch Finding");
      expect(section, copy.path).toMatch(/without a wave issue[^.\n]*merged/i);
      expect(section, copy.path).toContain("gh pr list --base <integration branch> --state merged");
    }
  });

  // 5.2a (A-36, EC-87, EC-88): one sentence per edge case.
  it("edge cases", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Roadmap-Mismatch Finding");
      const two = lineWith(section, "more than one wave issue", copy.path);
      expect(two, copy.path).toContain("compare with neither");
      expect(two, copy.path).toContain("never pick one silently");
      const zero = lineWith(section, "zero sub-issues", copy.path);
      expect(zero, copy.path).toContain("fall back to the merged story PRs");
      expect(zero, copy.path).toContain("note");
    }
  });

  // PT-53 (S-012 AC-2): advisory and routing unchanged.
  it("advisory unchanged", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Roadmap-Mismatch Finding");
      expect(section, copy.path).toContain("non-blocking to PR readiness and to issue completion");
      expect(section, copy.path).toContain("Never hold a PR on it");
      expect(section, copy.path).toContain("activity-drift-reconciliation");
      expect(section, copy.path).toContain(
        "**Not a finding:** rows for PRDs outside the audited scope; a row left `In progress` while some of its stories are still open.",
      );
      // qa gate: no blocking or holding wording beyond the two advisory phrases.
      const rest = section.replace(/non-blocking/g, "").replace(/Never hold/g, "");
      expect(rest, copy.path).not.toMatch(/\b(block|hold)/i);
    }
  });
});
