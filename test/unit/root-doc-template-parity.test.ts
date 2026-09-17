/**
 * Holistic content parity between the root runtime docs (`CLAUDE.md`,
 * `AGENTS.md`) and the templates that are the actual consumer-facing
 * artifact (`CLAUDE.md.template`, `AGENTS.md.template`, delivered verbatim
 * by `deliverInstallIfAbsentFiles()` per `core/distribution/profiles.ts`).
 *
 * Issue #191: the templates drifted from the root docs because narrower
 * parity tests (`qa-testing-standard.test.ts`, `infra-engineer-parity.test.ts`,
 * `nextjs-claude-parity-claim.test.ts`) only assert specific known strings,
 * so a class of drift — an added enforcement bullet, a renamed/removed
 * skill, a rewritten registry table — could land in the root doc without
 * ever being mirrored into the template, and nothing would catch it.
 *
 * This test derives its expectations from the root docs' own structure
 * (headings, markdown-table first-column entries, and the top-level bullets
 * under "General Agent Guidelines") rather than hardcoding today's specific
 * content, so it keeps catching drift as both files evolve.
 *
 * Two intentionally different strictness levels:
 *  - Headings: root headings MUST all appear in the template (the template
 *    MAY carry additional, template-specific framing/sections without
 *    failing this test).
 *  - Table-derived registry entries (Agents/Skills/Instructions/Hooks/
 *    Commands/File Organization/Contracts/Taxonomy tables) and the
 *    "General Agent Guidelines" bullet list: these are the actual
 *    enforcement contract, not framing, so root and template MUST match
 *    exactly (same set of entries/bullets).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

/** Every markdown heading line (`#` through `######`), normalized. */
function extractHeadings(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^#{1,6}\s+\S/.test(line))
    .map((line) => line.trim().replace(/\s+/g, " "));
}

/** Strip markdown emphasis/code markers from a table-cell value. */
function stripMarkup(cell: string): string {
  return cell
    .trim()
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^`(.+)`$/, "$1")
    .trim();
}

/** True if a pipe-table line is the header/separator (all `-`, `:`, `|`, spaces). */
function isSeparatorRow(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line.trim());
}

/**
 * Extract the first-column value of every data row across every markdown
 * pipe-table in the document. Header rows and separator rows are excluded.
 * This generically covers Agents/Skills/Instructions/Hooks/Commands/File
 * Organization/Contracts/Taxonomy tables without hardcoding table identity.
 */
function extractTableFirstColumnEntries(content: string): string[] {
  const lines = content.split("\n");
  const entries: string[] = [];
  let sawHeaderForBlock = false;
  let previousWasTableLine = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const isTableLine = line.startsWith("|");

    if (!isTableLine) {
      previousWasTableLine = false;
      sawHeaderForBlock = false;
      continue;
    }

    if (isSeparatorRow(line)) {
      // The row immediately preceding a separator row was the header.
      previousWasTableLine = true;
      sawHeaderForBlock = true;
      continue;
    }

    if (!previousWasTableLine || !sawHeaderForBlock) {
      // First row of a table block (the header row itself) — skip it, but
      // mark that we're inside a table so the following separator confirms it.
      previousWasTableLine = true;
      continue;
    }

    const firstCell = line.split("|")[1] ?? "";
    const value = stripMarkup(firstCell);
    if (value.length > 0) {
      entries.push(value);
    }
    previousWasTableLine = true;
  }

  return entries;
}

/**
 * Extract the top-level bullet list (`- ...` at column 0) under a named
 * `##`-level heading, up to the next heading of the same or higher level.
 */
function extractBulletsUnderHeading(content: string, headingText: string): string[] {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => line.trim().startsWith(headingText));
  if (startIndex === -1) return [];

  const headingLevel = (lines[startIndex].match(/^#+/) ?? [""])[0].length;
  const bullets: string[] = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#+)\s/);
    if (headingMatch && headingMatch[1].length <= headingLevel) break;
    if (/^-\s+\S/.test(line)) {
      bullets.push(line.trim().replace(/\s+/g, " "));
    }
  }

  return bullets;
}

function assertSetEquals(
  actual: string[],
  expected: string[],
  label: string,
  actualLabel: string,
  expectedLabel: string,
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((v) => !actualSet.has(v));
  const extra = [...actualSet].filter((v) => !expectedSet.has(v));

  expect(
    missing,
    `${label}: present in ${expectedLabel} but missing from ${actualLabel}:\n${missing.join("\n")}`,
  ).toEqual([]);
  expect(
    extra,
    `${label}: present in ${actualLabel} but absent from ${expectedLabel} (stale/removed content):\n${extra.join("\n")}`,
  ).toEqual([]);
}

function assertSubset(
  subsetCandidates: string[],
  supersetCandidates: string[],
  label: string,
): void {
  const supersetSet = new Set(supersetCandidates);
  const missing = subsetCandidates.filter((v) => !supersetSet.has(v));
  expect(missing, `${label}: missing from template:\n${missing.join("\n")}`).toEqual([]);
}

const PAIRS = [
  {
    root: "CLAUDE.md",
    template: "CLAUDE.md.template",
    guidelinesHeading: "## General Agent Guidelines",
  },
  {
    root: "AGENTS.md",
    template: "AGENTS.md.template",
    guidelinesHeading: "## General Agent Guidelines",
  },
] as const;

for (const pair of PAIRS) {
  describe(`holistic parity — ${pair.root} vs ${pair.template}`, () => {
    const rootContent = read(pair.root);
    const templateContent = read(pair.template);

    it(`every heading in ${pair.root} appears in ${pair.template}`, () => {
      assertSubset(
        extractHeadings(rootContent),
        extractHeadings(templateContent),
        `${pair.root} headings`,
      );
    });

    it(`table-derived registry entries match exactly between ${pair.root} and ${pair.template}`, () => {
      assertSetEquals(
        extractTableFirstColumnEntries(templateContent),
        extractTableFirstColumnEntries(rootContent),
        "table entries",
        pair.template,
        pair.root,
      );
    });

    it(`"General Agent Guidelines" bullets match exactly between ${pair.root} and ${pair.template}`, () => {
      const rootBullets = extractBulletsUnderHeading(rootContent, pair.guidelinesHeading);
      const templateBullets = extractBulletsUnderHeading(templateContent, pair.guidelinesHeading);

      expect(
        rootBullets.length,
        `${pair.root} "General Agent Guidelines" section has no bullets — check the heading text`,
      ).toBeGreaterThan(0);

      assertSetEquals(
        templateBullets,
        rootBullets,
        "General Agent Guidelines bullets",
        pair.template,
        pair.root,
      );
    });
  });
}

describe("AGENTS.md.template does not reference removed skills", () => {
  it("does not mention webapp-mockup (replaced by ux-scaffold)", () => {
    expect(read("AGENTS.md.template")).not.toMatch(/webapp-mockup/i);
  });

  it("references ux-scaffold, its replacement", () => {
    expect(read("AGENTS.md.template")).toMatch(/ux-scaffold/);
  });
});
