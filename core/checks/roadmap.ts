/**
 * The canonical `docs/roadmap.md` table, defined once (spec §16a A-59).
 *
 * `roadmap-parity.test.ts` checks this repository's roadmap with it, and
 * `migrate projects` reads a consumer's roadmap with it, so the two can
 * never disagree about what "canonical" means.
 *
 * Canonical: the first Markdown table in the file has exactly the six
 * header cells below, at least one data row (a "partial table" is a
 * canonical header with at least one row), six cells in every row, and a
 * Status from the fixed set.
 */

export const ROADMAP_FILE = "docs/roadmap.md";

export const ROADMAP_HEADER = [
  "PRD",
  "Phase/Wave",
  "Scope (one line)",
  "Status",
  "Issues/PRs",
  "What's missing",
] as const;

export const ROADMAP_STATUSES = ["Not started", "In progress", "Done"] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export interface RoadmapRow {
  /** The PRD key: the PRD cell's link text, or the cell itself when it is not a link (A-55). */
  prd: string;
  /** The PRD cell's link target, or `null`. */
  prdLink: string | null;
  phase: string;
  scope: string;
  status: RoadmapStatus;
  issues: string;
  missing: string;
  /** The row's source line, for messages. */
  line: string;
}

export type RoadmapParseResult = { ok: true; rows: RoadmapRow[] } | { ok: false; reason: string };

/** Split a Markdown table line into trimmed cells; `\|` stays inside its cell. */
export function tableCells(line: string): string[] {
  const body = line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "");
  return body.split(/(?<!\\)\|/).map((c) => c.trim());
}

const SEPARATOR = /^\|?(\s*:?-+:?\s*\|)+\s*:?-*:?\s*$/;

export function parseRoadmapTable(content: string): RoadmapParseResult {
  const lines = content.split(/\r?\n/);
  const first = lines.findIndex((l) => l.trimStart().startsWith("|"));
  if (first === -1) return { ok: false, reason: "no table found" };
  const table: string[] = [];
  for (let i = first; i < lines.length && lines[i].trimStart().startsWith("|"); i++) {
    table.push(lines[i]);
  }
  const header = tableCells(table[0]);
  if (header.length !== ROADMAP_HEADER.length || header.some((c, i) => c !== ROADMAP_HEADER[i])) {
    return {
      ok: false,
      reason: `the first table's header is not ${ROADMAP_HEADER.map((c) => `\`${c}\``).join(", ")}`,
    };
  }
  if (table.length < 2 || !SEPARATOR.test(table[1].trim())) {
    return { ok: false, reason: "the header is not followed by a separator row" };
  }
  const data = table.slice(2);
  if (data.length === 0) return { ok: false, reason: "the table has no rows" };
  const rows: RoadmapRow[] = [];
  for (const line of data) {
    const cells = tableCells(line);
    if (cells.length !== ROADMAP_HEADER.length) {
      return { ok: false, reason: `wrong column count in: ${line}` };
    }
    const [prdCell, phase, scope, status, issues, missing] = cells;
    if (!(ROADMAP_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, reason: `status outside ${ROADMAP_STATUSES.join(", ")} in: ${line}` };
    }
    const link = prdCell.match(/^\[([^\]]+)\]\(([^)]*)\)$/);
    rows.push({
      prd: link ? link[1] : prdCell,
      prdLink: link ? link[2] : null,
      phase,
      scope,
      status: status as RoadmapStatus,
      issues,
      missing,
      line,
    });
  }
  return { ok: true, rows };
}
