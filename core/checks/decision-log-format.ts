/**
 * Decision-log format check (S-007; specification §14 "Format").
 *
 * Validates any `workstream/decisions-*.md` file against the row shape
 * the log format already defines (specification §5, unchanged by this
 * feature): `ID` is unique within the file, `Phase` is `WHAT` or `HOW`,
 * and any `Supersedes` value resolves to an existing `ID` in the same
 * file (the column is intra-file only — a value that happens to match
 * another feature's `D-NN` is still dangling here).
 *
 * Uniqueness and `Phase` are hard failures. A dangling `Supersedes` is
 * reported the same way docs-structure reports staleness (D-21's
 * precedent): printed, not failed, so a decision log mid-session — a
 * row citing a `Supersedes` ID not yet appended — never blocks
 * legitimate work-in-progress (story S-007 Business Rules).
 *
 * Tables are hand-parsed over the one fixed row shape rather than with
 * a general Markdown parser (`SIMPLICITY.md` A4, D-49's precedent):
 * this module ships to consumers inside `dist/core/`, where
 * devDependencies are absent, and a single flat table shape is a dozen
 * lines to parse directly.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** A single format finding. */
export interface DecisionLogFinding {
  /** Stable rule identifier, for grouping output. */
  rule: "duplicate-id" | "invalid-phase" | "dangling-supersedes";
  /** Repo-relative path of the file the finding is about. */
  path: string;
  /** One line, naming the row and the condition. */
  message: string;
}

export interface DecisionLogResult {
  /** Findings that fail the gate: duplicate ID, invalid Phase. */
  failures: DecisionLogFinding[];
  /** Findings that are reported and do not fail the gate: dangling Supersedes. */
  staleness: DecisionLogFinding[];
}

const VALID_PHASES = new Set(["WHAT", "HOW"]);

/** Values meaning "no Supersedes", not a reference to resolve. */
const NO_SUPERSEDES = new Set(["", "—", "-", "n/a"]);

/** Matches the `D-NN` token inside a Supersedes cell, e.g. `extends D-09`. */
const ID_TOKEN = /D-\d+/;

interface Row {
  id: string;
  phase: string;
  supersedes: string;
}

/** True for a Markdown table separator row: `| --- | :--- | ---: |`. */
function isSeparatorRow(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

/**
 * Split a `| a | b | c |` row into cells, trimmed, dropping the leading
 * and trailing empty cells the outer pipes produce.
 */
function splitRow(line: string): string[] {
  const cells = line.split("|").map((c) => c.trim());
  if (cells.length > 0 && cells[0] === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

/**
 * Parse every decision row out of one file's content. A file may hold
 * several tables (WHAT phase, HOW phase, one per specification phase);
 * each is read independently by its own header, and all rows are
 * pooled — `ID` uniqueness and `Supersedes` resolution are file-wide,
 * not per-table (the format has one ID space for the whole file).
 */
export function parseDecisionRows(content: string): Row[] {
  const lines = content.split("\n");
  const rows: Row[] = [];

  let idCol = -1;
  let phaseCol = -1;
  let supersedesCol = -1;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed.startsWith("|")) {
      inTable = false;
      continue;
    }

    if (!inTable) {
      // Candidate header row: the next non-empty line must be a
      // separator row for this to be a table at all.
      const next = lines[i + 1]?.trim() ?? "";
      if (!isSeparatorRow(next)) continue;

      const headerCells = splitRow(trimmed).map((c) => c.toLowerCase());
      idCol = headerCells.indexOf("id");
      phaseCol = headerCells.indexOf("phase");
      supersedesCol = headerCells.indexOf("supersedes");
      if (idCol === -1) continue; // not a decision table

      inTable = true;
      i++; // consume the separator row too
      continue;
    }

    if (isSeparatorRow(trimmed)) continue;

    const cells = splitRow(trimmed);
    const id = cells[idCol];
    if (id === undefined || id.length === 0) {
      inTable = false;
      continue;
    }

    rows.push({
      id,
      phase: phaseCol === -1 ? "" : (cells[phaseCol] ?? ""),
      supersedes: supersedesCol === -1 ? "" : (cells[supersedesCol] ?? ""),
    });
  }

  return rows;
}

/**
 * Check one decision log's already-read content. `path` is the
 * repo-relative path used only in finding messages.
 */
export function checkDecisionLogContent(content: string, path: string): DecisionLogResult {
  const rows = parseDecisionRows(content);
  const failures: DecisionLogFinding[] = [];
  const staleness: DecisionLogFinding[] = [];

  const seen = new Set<string>();
  const ids = new Set(rows.map((r) => r.id));

  for (const row of rows) {
    if (seen.has(row.id)) {
      failures.push({
        rule: "duplicate-id",
        path,
        message: `${path}: ID '${row.id}' appears more than once.`,
      });
    }
    seen.add(row.id);

    if (!VALID_PHASES.has(row.phase)) {
      failures.push({
        rule: "invalid-phase",
        path,
        message: `${path}: row '${row.id}' has Phase '${row.phase}', expected WHAT or HOW.`,
      });
    }

    const supersedes = row.supersedes;
    if (!NO_SUPERSEDES.has(supersedes)) {
      // A cell may be exactly an ID ("D-01") or prose naming one
      // ("extends D-09") — the log's own real rows use both. Resolve
      // the embedded `D-NN` token, not the whole cell verbatim.
      const token = supersedes.match(ID_TOKEN)?.[0];
      if (token === undefined || !ids.has(token)) {
        staleness.push({
          rule: "dangling-supersedes",
          path,
          message: `${path}: row '${row.id}' has Supersedes '${supersedes}', which does not resolve to an ID in this file.`,
        });
      }
    }
  }

  return { failures, staleness };
}

/** `workstream/decisions-*.md` files present in the repository. */
function decisionLogFiles(repoRoot: string): string[] {
  const dir = join(repoRoot, "workstream");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.startsWith("decisions-") && e.name.endsWith(".md"))
    .map((e) => `workstream/${e.name}`)
    .sort();
}

/**
 * Check the decision-log format across a repository: every
 * `workstream/decisions-*.md` file present.
 *
 * A repository with none reports nothing — not having adopted the
 * grilling workflow yet is not a defect (mirrors docs-structure's
 * no-`docs/runbooks/` behavior).
 */
export function checkDecisionLogFormat(repoRoot: string): DecisionLogResult {
  const failures: DecisionLogFinding[] = [];
  const staleness: DecisionLogFinding[] = [];

  for (const path of decisionLogFiles(repoRoot)) {
    const content = readFileSync(join(repoRoot, path), "utf-8");
    const result = checkDecisionLogContent(content, path);
    failures.push(...result.failures);
    staleness.push(...result.staleness);
  }

  return { failures, staleness };
}
