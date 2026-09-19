/**
 * Docs-structure check (PRD AC-24, AC-32; S-004).
 *
 * Reads a repository and reports two kinds of finding, separately:
 * `failures`, which fail the `lint` gate, and `staleness`, which is
 * reported and does not (D-21 — a runbook nobody has re-verified in 90
 * days is worth knowing about, but blocking a merge on the calendar
 * teaches people to bump the date without re-running the procedure).
 *
 * The function reads the filesystem and writes nothing, and returns the
 * same result for the same tree. That is the checkable form of AC-1's
 * "pure", which was self-contradictory for a function whose whole job
 * is reading files.
 *
 * TWO RULES THAT MUST NOT OVER-FIRE (AC-10). A check that reports
 * failures on a correct tree gets disabled, so both are narrowed
 * deliberately:
 *
 *   1. A link is resolved relative to the index that contains it, and a
 *      link to a directory is fine. Without this, `docs/README.md`'s
 *      links to `../README.md` and `requirements/` fail on a clean tree.
 *   2. The omission rule is non-recursive: an index accounts for the
 *      files beside it, not for a subtree. Without this, the seven ADRs
 *      and four PRDs that no index lists individually are all flagged.
 *
 * Frontmatter is hand-parsed over the five fixed keys rather than with
 * `yaml` (D-49). This module ships to consumers inside `dist/core/`,
 * where devDependencies are absent, and the format is rigid enough that
 * a parser is a dozen lines.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";

/** A single structural finding. */
export interface DocsStructureFinding {
  /** Stable rule identifier, for grouping output. */
  rule:
    | "index-lists-missing"
    | "index-omits-file"
    | "runbook-filename"
    | "runbook-frontmatter"
    | "runbook-related"
    | "runbook-stale";
  /** Repo-relative path of the file the finding is about. */
  path: string;
  /** One line, naming the file and the condition. */
  message: string;
}

export interface DocsStructureResult {
  /** Findings that fail the gate. */
  failures: DocsStructureFinding[];
  /** Findings that are reported and do not fail the gate (AC-6). */
  staleness: DocsStructureFinding[];
}

/** Indexes this check enforces, each accounting for the files beside it. */
const INDEXES = ["docs/README.md", "docs/runbooks/README.md"];

const RUNBOOK_FILENAME = /^runbook-[a-z0-9]+(-[a-z0-9]+)+\.md$/;

/**
 * The scaffold `install` delivers into `docs/runbooks/`. It is a form to
 * copy, not a procedure: its filename has one segment, its frontmatter
 * holds angle-bracket placeholders, and its `related` paths are examples.
 * Checked as a runbook it produces four failures in every consumer
 * repository on the first `lint` after install — a check reporting
 * failures on a correct tree, which is what AC-10 exists to prevent.
 */
const TEMPLATE_FILENAME = "runbook-template.md";

const REQUIRED_KEYS = ["name", "trigger", "owner", "last_verified", "related"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const STALE_AFTER_DAYS = 90;

/** Markdown inline links: `[text](target)`. */
const LINK = /\[[^\]]*\]\(([^)]+)\)/g;

interface Frontmatter {
  values: Record<string, string>;
  related: string[];
}

/**
 * Parse the five fixed keys from a `---`-delimited block. `related` is
 * read as the span up to the next top-level key, so a list prettier has
 * wrapped across indented lines reads the same as an inline one.
 */
function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith("---\n")) return null;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const block = content.slice(4, end);

  const values: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }

  const at = block.search(/^related:/m);
  let related: string[] = [];
  if (at !== -1) {
    const rest = block.slice(at + "related:".length);
    const nextKey = rest.search(/^[a-z_]+:/m);
    const span = nextKey === -1 ? rest : rest.slice(0, nextKey);
    related = [...span.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
    values["related"] = span.trim();
  }

  return { values, related };
}

/** Link targets worth resolving: not external, not a bare anchor. */
function isLocalLink(target: string): boolean {
  return !/^(https?:|mailto:|#)/.test(target);
}

function filesBeside(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".md") &&
        e.name !== "README.md" &&
        e.name !== TEMPLATE_FILENAME,
    )
    .map((e) => e.name)
    .sort();
}

function checkIndex(repoRoot: string, indexRel: string): DocsStructureFinding[] {
  const indexPath = join(repoRoot, indexRel);
  if (!existsSync(indexPath)) return [];

  const content = readFileSync(indexPath, "utf-8");
  const indexDir = dirname(indexPath);
  const findings: DocsStructureFinding[] = [];

  // Rule 1: every local link resolves to something that exists. A
  // directory counts — `existsSync` is the whole test.
  const linked = new Set<string>();
  for (const match of content.matchAll(LINK)) {
    const target = match[1].split("#")[0].trim();
    if (target.length === 0 || !isLocalLink(target)) continue;
    linked.add(target);
    if (!existsSync(resolve(indexDir, target))) {
      findings.push({
        rule: "index-lists-missing",
        path: indexRel,
        message: `${indexRel} links ${target}, which does not exist.`,
      });
    }
  }

  // Rule 2: every markdown file beside the index is mentioned by it.
  // Non-recursive on purpose — see the header note.
  for (const name of filesBeside(indexDir)) {
    if (![...linked].some((t) => t === name || t.endsWith(`/${name}`))) {
      findings.push({
        rule: "index-omits-file",
        path: `${dirname(indexRel)}/${name}`,
        message: `${indexRel} does not list ${name}, which exists beside it.`,
      });
    }
  }

  return findings;
}

function checkRunbook(repoRoot: string, name: string): DocsStructureFinding[] {
  const rel = `docs/runbooks/${name}`;
  const findings: DocsStructureFinding[] = [];

  if (!RUNBOOK_FILENAME.test(name)) {
    findings.push({
      rule: "runbook-filename",
      path: rel,
      message: `${rel} does not match runbook-<verb>-<object>.md.`,
    });
  }

  const parsed = parseFrontmatter(readFileSync(join(repoRoot, rel), "utf-8"));
  if (parsed === null) {
    findings.push({
      rule: "runbook-frontmatter",
      path: rel,
      message: `${rel} has no frontmatter block.`,
    });
    return findings;
  }

  for (const key of REQUIRED_KEYS) {
    if (parsed.values[key] === undefined || parsed.values[key].length === 0) {
      findings.push({
        rule: "runbook-frontmatter",
        path: rel,
        message: `${rel} is missing frontmatter key '${key}'.`,
      });
    }
  }

  const verified = parsed.values["last_verified"];
  if (verified !== undefined && !ISO_DATE.test(verified)) {
    findings.push({
      rule: "runbook-frontmatter",
      path: rel,
      message: `${rel} has a last_verified that is not a YYYY-MM-DD date: '${verified}'.`,
    });
  }

  for (const target of parsed.related) {
    const full = resolve(repoRoot, target);
    const back = relative(repoRoot, full);
    if (back.startsWith("..") || isAbsolute(back)) {
      findings.push({
        rule: "runbook-related",
        path: rel,
        message: `${rel} names a related path outside the repository: ${target}.`,
      });
    } else if (!existsSync(full)) {
      findings.push({
        rule: "runbook-related",
        path: rel,
        message: `${rel} names a related path that does not exist: ${target}.`,
      });
    }
  }

  return findings;
}

/** Days between an ISO date and now, floored. */
function daysSince(iso: string, now: Date): number {
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.floor((now.getTime() - then) / 86_400_000);
}

function checkStaleness(repoRoot: string, name: string): DocsStructureFinding[] {
  const rel = `docs/runbooks/${name}`;
  const parsed = parseFrontmatter(readFileSync(join(repoRoot, rel), "utf-8"));
  const verified = parsed?.values["last_verified"];
  if (verified === undefined || !ISO_DATE.test(verified)) return [];

  const age = daysSince(verified, new Date());
  if (age <= STALE_AFTER_DAYS) return [];

  return [
    {
      rule: "runbook-stale",
      path: rel,
      message: `${rel} was last verified ${verified} (${age} days ago, over ${STALE_AFTER_DAYS}).`,
    },
  ];
}

function runbookFiles(repoRoot: string): string[] {
  const dir = join(repoRoot, "docs/runbooks");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".md") &&
        e.name !== "README.md" &&
        e.name !== TEMPLATE_FILENAME,
    )
    .map((e) => e.name)
    .sort();
}

/**
 * Check the documentation structure of a repository.
 *
 * A repository with no `docs/runbooks/` reports nothing for runbooks
 * (AC-9): not having adopted runbooks is not a defect.
 */
export function checkDocsStructure(repoRoot: string): DocsStructureResult {
  const failures: DocsStructureFinding[] = [];
  const staleness: DocsStructureFinding[] = [];

  for (const indexRel of INDEXES) {
    failures.push(...checkIndex(repoRoot, indexRel));
  }

  for (const name of runbookFiles(repoRoot)) {
    failures.push(...checkRunbook(repoRoot, name));
    staleness.push(...checkStaleness(repoRoot, name));
  }

  return { failures, staleness };
}
