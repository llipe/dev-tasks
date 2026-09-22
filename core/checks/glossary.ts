/**
 * Ubiquitous-language structure check (S-002; specification §5, §8.2).
 *
 * `docs/domain/ubiquitous-language.md` is the repository's vocabulary,
 * and a vocabulary file nothing validates rots the way every other
 * unchecked document does. This module is the check: a term missing one
 * of its five fields, a `Status` outside the two allowed forms, a
 * `superseded by` pointing at a term that is not in the file, the same
 * term twice, a bounded context that maps to nothing in the package
 * map, or a term a changelog row says was added and the body no longer
 * has — each fails `lint` (D-66). Two conditions only report: a
 * `docs/tech.md` with no package map at all (once for the file, never
 * once per term) and an `Origin` citing a decision log that is not
 * present locally, which is what an archived log looks like from here.
 *
 * Zero terms is valid. It is the state of every fresh install, and
 * `status: unfilled` means "no vocabulary established yet", never
 * permission to invent one (D-66, D-68).
 *
 * HAND-PARSED, like its two siblings in this directory (D-49): no
 * `yaml`, no Markdown library, no `typescript`. The module ships to
 * consumers inside `dist/core/`, where devDependencies are absent, and
 * the `verifier` is a second caller in consumer repositories. It is
 * invoked as `tsx core/checks/run.ts`, never a compiled `dist/` path
 * (D-48).
 *
 * The split between the two exported functions is the reason both
 * exist. `checkGlossaryContent()` is pure over `(markdown, packageMap)`
 * so every structural rule is testable as a string in, findings out.
 * `checkGlossary()` owns the filesystem: reading the two files,
 * resolving `feature#D-NN` origins against `workstream/`, and — when
 * the glossary is simply absent — returning nothing at all, because a
 * consumer who has not run `dev-tasks update` yet is `doctor`'s
 * business, not `lint`'s (D-67, D-75).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { parseFrontmatter } from "./docs-structure.js";
import { readPackageMap } from "../distribution/workspace.js";
import type { PackageMapRow } from "../distribution/workspace.js";

/**
 * Every rule this module can report, enumerated (D-74).
 *
 * Tests assert by rule name, so the names are part of the contract, not
 * an implementation detail — the `DecisionLogFinding.rule` pattern. The
 * `vocabulary-*` and `glossary-forbidden-synonym` members belong to the
 * Vocabulary-section check (S-003) and the identifier scan (S-005);
 * they are declared here because D-74 pinned the whole enumeration at
 * once, and a union that grows a member later is a union every consumer
 * has to re-switch on.
 */
export type GlossaryRule =
  | "glossary-frontmatter"
  | "glossary-field-missing"
  | "glossary-status-invalid"
  | "glossary-superseded-dangling"
  | "glossary-term-duplicate"
  | "glossary-context-unresolved"
  | "glossary-term-removed"
  | "glossary-package-map-absent"
  | "glossary-origin-unresolved"
  | "vocabulary-missing"
  | "vocabulary-incomplete"
  | "glossary-forbidden-synonym";

export interface GlossaryFinding {
  rule: GlossaryRule;
  /** Repo-relative path of the file the finding is about. */
  file: string;
  /** One line, naming the term or heading and the condition. */
  message: string;
}

export interface GlossaryResult {
  /** Findings that fail the gate (D-66). */
  failures: GlossaryFinding[];
  /** Findings that are printed and do not fail the gate (D-66). */
  staleness: GlossaryFinding[];
}

/** The one glossary, at the root of the repository (D-16). */
export const GLOSSARY_FILE = "docs/domain/ubiquitous-language.md";

/** The five frontmatter keys, asserted by presence only (D-75). */
const FRONTMATTER_KEYS = ["version", "name", "description", "status", "owner"];

/** The five fields every term carries, `none` included (FR-18). */
const TERM_FIELDS = ["Definition", "Forbidden synonyms", "Invariants", "Origin", "Status"];

/** `superseded by <Term> (<feature#D-NN>)` — the only non-`active` Status. */
const SUPERSEDED = /^superseded by\s+(.+?)\s+\(\s*([A-Za-z0-9._/-]+#D-\d+)\s*\)$/;

/** An `Origin` that names a decision rather than a file: `feature#D-NN`. */
const DECISION_ORIGIN = /^([A-Za-z0-9._-]+)#D-\d+$/;

interface Term {
  name: string;
  context: string | null;
  fields: Map<string, string>;
}

interface Glossary {
  terms: Term[];
  /** Bounded-context headings in document order, deduplicated. */
  contexts: string[];
  /** Terms named in a `+term` changelog cell, in document order. */
  changelogTerms: string[];
}

/** LF and no BOM, before anything below looks at a single line. */
function normalize(content: string): string {
  return content.replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

/**
 * Walk the body into contexts, terms, and the changelog's `+term` list.
 *
 * Fenced code blocks are skipped (D-74). The PRD's own Data
 * Requirements section shows the file's shape inside a fence — a parser
 * that reads fences finds a `### <Term>` with no bullets there and
 * fails the document that documents the format.
 */
function parseGlossary(markdown: string): Glossary {
  const lines = normalize(markdown).split("\n");

  const terms: Term[] = [];
  const contexts: string[] = [];
  const changelogTerms: string[] = [];

  let fenced = false;
  let context: string | null = null;
  let current: Term | null = null;
  let inChangelog = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const context2 = trimmed.match(/^##\s+Bounded Context:\s*(.+?)\s*$/);
    if (context2) {
      context = context2[1];
      if (!contexts.includes(context)) contexts.push(context);
      current = null;
      inChangelog = false;
      continue;
    }

    if (/^##\s/.test(trimmed) && !/^###/.test(trimmed)) {
      context = null;
      current = null;
      inChangelog = /^##\s+Changelog\s*$/.test(trimmed);
      continue;
    }

    const heading3 = trimmed.match(/^###\s+(.+?)\s*$/);
    if (heading3) {
      current = { name: heading3[1], context, fields: new Map() };
      terms.push(current);
      continue;
    }

    if (inChangelog && trimmed.startsWith("|")) {
      for (const cell of trimmed.split("|")) {
        for (const part of cell.split(",")) {
          const item = part.trim();
          if (item.startsWith("+") && item.length > 1) changelogTerms.push(item.slice(1).trim());
        }
      }
      continue;
    }

    if (current === null) continue;

    const bullet = trimmed.match(/^[-*]\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/);
    if (bullet) {
      const key = bullet[1];
      if (TERM_FIELDS.includes(key) && !current.fields.has(key)) {
        current.fields.set(key, bullet[2].trim());
      }
    }
  }

  return { terms, contexts, changelogTerms };
}

function finding(rule: GlossaryRule, message: string): GlossaryFinding {
  return { rule, file: GLOSSARY_FILE, message };
}

/**
 * Check one glossary's already-read content against a package map.
 *
 * Pure: no filesystem, no clock, no environment. `packageMap` is null
 * when `docs/tech.md` has no `## Package Map` section — that is one
 * finding about the map, not a verdict on any context heading, so
 * context resolution is skipped entirely rather than failing every
 * heading for a table that was never written (D-66).
 */
export function checkGlossaryContent(
  markdown: string,
  packageMap: PackageMapRow[] | null,
): GlossaryResult {
  const failures: GlossaryFinding[] = [];
  const staleness: GlossaryFinding[] = [];

  const parsed = parseFrontmatter(markdown);
  if (parsed === null) {
    failures.push(finding("glossary-frontmatter", `${GLOSSARY_FILE} has no frontmatter block.`));
  } else {
    for (const key of FRONTMATTER_KEYS) {
      const value = parsed.values[key];
      if (value === undefined || value.length === 0) {
        failures.push(
          finding("glossary-frontmatter", `${GLOSSARY_FILE} is missing frontmatter key '${key}'.`),
        );
      }
    }
  }

  const glossary = parseGlossary(markdown);
  const names = new Set(glossary.terms.map((t) => t.name.toLowerCase()));

  const seen = new Set<string>();
  for (const term of glossary.terms) {
    const key = term.name.toLowerCase();
    if (seen.has(key)) {
      failures.push(
        finding(
          "glossary-term-duplicate",
          `${GLOSSARY_FILE}: term '${term.name}' appears more than once. One term means one thing here.`,
        ),
      );
    }
    seen.add(key);

    for (const field of TERM_FIELDS) {
      const value = term.fields.get(field);
      if (value === undefined || value.length === 0) {
        failures.push(
          finding(
            "glossary-field-missing",
            `${GLOSSARY_FILE}: term '${term.name}' is missing '${field}'. All five fields are present, 'none' included.`,
          ),
        );
      }
    }

    const status = term.fields.get("Status");
    if (status !== undefined && status.length > 0 && status !== "active") {
      const superseded = status.match(SUPERSEDED);
      if (superseded === null) {
        failures.push(
          finding(
            "glossary-status-invalid",
            `${GLOSSARY_FILE}: term '${term.name}' has Status '${status}', expected 'active' or 'superseded by <Term> (<feature#D-NN>)'.`,
          ),
        );
      } else if (!names.has(superseded[1].toLowerCase())) {
        failures.push(
          finding(
            "glossary-superseded-dangling",
            `${GLOSSARY_FILE}: term '${term.name}' is superseded by '${superseded[1]}', which is not a term in this file.`,
          ),
        );
      }
    }
  }

  if (packageMap === null) {
    staleness.push(
      finding(
        "glossary-package-map-absent",
        `${GLOSSARY_FILE}: docs/tech.md has no package map, so bounded contexts cannot be resolved. Run activity-init to record one.`,
      ),
    );
  } else {
    // Exact match, both ways (D-74). A context that differs by case is
    // a second name for the same thing, which is the drift this file
    // exists to prevent.
    const known = new Set<string>();
    for (const row of packageMap) {
      known.add(row.name);
      if (row.boundedContext !== null) known.add(row.boundedContext);
    }
    for (const context of glossary.contexts) {
      if (!known.has(context)) {
        failures.push(
          finding(
            "glossary-context-unresolved",
            `${GLOSSARY_FILE}: bounded context '${context}' matches no package name and no Bounded context value in the docs/tech.md package map.`,
          ),
        );
      }
    }
  }

  // Append-only, without git: a term the changelog says a version added
  // and the body no longer carries was deleted, and terms are
  // superseded, never deleted (FR-19).
  const reported = new Set<string>();
  for (const added of glossary.changelogTerms) {
    const key = added.toLowerCase();
    if (key.length === 0 || names.has(key) || reported.has(key)) continue;
    reported.add(key);
    failures.push(
      finding(
        "glossary-term-removed",
        `${GLOSSARY_FILE}: term '${added}' was added in a changelog row but is not in the file. Terms are superseded, never deleted.`,
      ),
    );
  }

  return { failures, staleness };
}

/**
 * Check the glossary in a repository: the file, its package map, and
 * the origins its terms cite.
 *
 * An absent glossary produces nothing (D-75). The repository may simply
 * predate the file; `doctor` already warns about that, and two tools
 * answering the same question is two tools to disagree the first time
 * one of them changes (D-67).
 */
export function checkGlossary(repoRoot: string): GlossaryResult {
  const path = join(repoRoot, GLOSSARY_FILE);
  if (!existsSync(path)) return { failures: [], staleness: [] };

  const markdown = readFileSync(path, "utf-8");
  const result = checkGlossaryContent(markdown, readPackageMap(repoRoot));

  // Origin resolution needs the filesystem, which is why it lives here
  // and not in the pure function (D-75). A `feature#D-NN` whose log is
  // gone is an archived log, not a defect: the reference is reported so
  // it can be re-pointed, and never fails the gate (D-66).
  const seen = new Set<string>();
  for (const term of parseGlossary(markdown).terms) {
    const origin = term.fields.get("Origin");
    if (origin === undefined) continue;
    const decision = origin.match(DECISION_ORIGIN);
    if (decision === null) continue;

    const feature = decision[1];
    if (seen.has(feature)) continue;
    seen.add(feature);

    if (!existsSync(join(repoRoot, "workstream", `decisions-${feature}.md`))) {
      result.staleness.push(
        finding(
          "glossary-origin-unresolved",
          `${GLOSSARY_FILE}: Origin '${origin}' cites workstream/decisions-${feature}.md, which is not present locally (an archived log reads this way).`,
        ),
      );
    }
  }

  return result;
}

/* -------------------------------------------------------------------------
 * `## Vocabulary` in PRDs and specifications (S-003; §5, §8.3, D-65, D-71)
 * ---------------------------------------------------------------------- */

/** Where PRDs live, and the only tree `lint` walks for §8.3. */
export const REQUIREMENTS_DIR = "docs/requirements";

/** The one line a document with no domain concept carries (spec §5). */
const NO_CONCEPTS = /^None\s*[—–-]\s*\S.*$/;

/** `conflict → D-NN`, `conflict -> feature#D-NN` — both arrows (D-74). */
const CONFLICT = /^conflict\s*(?:→|->)\s*(?:[A-Za-z0-9._/-]+#)?D-\d+$/i;

/** Cells whose content is a placeholder rather than an answer. */
const PLACEHOLDER = new Set(["", "—", "–", "-", "n/a", "na", "tbd", "?"]);

/**
 * The lines of a level-2 section, or null when the section is absent.
 *
 * Fenced blocks are skipped in both directions (D-74): a `##
 * Vocabulary` inside a fence does not open a section, and a fenced
 * example inside a real section is not part of the section's content.
 * Both halves are load-bearing and for the same reason. This
 * specification's own §5 shows the Vocabulary table inside a fence; a
 * parser that reads the opening fence declares every document
 * describing the format compliant, and a parser that reads the fence
 * body reports rows against a real document for an example it was shown
 * — including a fenced `None —` line, which would pass the whole
 * section on nothing.
 *
 * The section ends at the next ATX heading of depth 1 or 2. A `#` that
 * did not close it made every table in the remainder of the file a
 * Vocabulary table (§8.3 describes no such reach).
 */
function sectionLines(markdown: string, heading: RegExp): string[] | null {
  const lines = normalize(markdown).split("\n");
  let fenced = false;
  let collecting = false;
  const collected: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    if (/^#{1,2}(?!#)\s/.test(trimmed)) {
      if (collecting) return collected;
      if (heading.test(trimmed)) {
        collecting = true;
        continue;
      }
      continue;
    }
    if (collecting) collected.push(line);
  }

  return collecting ? collected : null;
}

/** True for a Markdown table delimiter row: `| --- |`, `| - |`, `|:-:|`. */
function isDelimiterRow(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

/** Trim, fold non-breaking spaces, and drop the Markdown code ticks. */
function cell(value: string): string {
  return value.replace(/ /g, " ").replace(/`/g, "").trim();
}

function isEmpty(value: string): boolean {
  return PLACEHOLDER.has(value.toLowerCase());
}

/**
 * Check one document's `## Vocabulary` section against the glossary.
 *
 * Pure over `(markdown, glossaryMarkdown)`; `file` only names the
 * document in the findings, so the same function serves `lint`'s walk,
 * `activity-refine` before it presents a PRD, and
 * `activity-generate-spec` before it presents a specification (D-75).
 *
 * Structural only (D-65). No prose is read: a document may say "widget"
 * two hundred times and this function will never mention it. A checker
 * that guesses which nouns are domain terms produces findings nobody
 * can act on, and a gate nobody can act on is a gate everybody learns
 * to skip.
 *
 * `glossaryMarkdown` is null when the repository has no glossary yet,
 * and then `existing` rows are taken at their word — there is nothing
 * to resolve against, and absence is `doctor`'s warning (D-67, D-75).
 *
 * Both rules are `failures`: AC-07 says an unaccounted term fails
 * refinement (D-71).
 */
export function checkVocabularySection(
  markdown: string,
  glossaryMarkdown: string | null,
  file = "<document>",
): GlossaryResult {
  const failures: GlossaryFinding[] = [];
  const report = (rule: GlossaryRule, message: string): void => {
    failures.push({ rule, file, message });
  };

  const section = sectionLines(markdown, /^##(?!#)\s+Vocabulary\s*$/);
  if (section === null) {
    report(
      "vocabulary-missing",
      `${file} has no '## Vocabulary' section. Every term the document uses must be listed as existing, proposed, or resolved by a decision.`,
    );
    return { failures, staleness: [] };
  }

  const known = new Set<string>();
  if (glossaryMarkdown !== null) {
    for (const term of parseGlossary(glossaryMarkdown).terms) known.add(term.name.toLowerCase());
  }

  // The sentinel stands for the whole section, and only then: spec §5
  // says a document with no domain concept "carries the section with
  // one line". Accepting it wherever it appears turned any prose
  // opening with `None —` into a clean result before a single row was
  // read, which is an author bypassing AC-07 by writing a sentence.
  const content = section.filter((line) => line.trim().length > 0);
  if (content.length === 1 && NO_CONCEPTS.test(content[0].trim())) {
    return { failures, staleness: [] };
  }

  const rows: string[][] = [];
  for (const line of section) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (isDelimiterRow(trimmed)) continue;
    const cells = trimmed
      .replace(/\|\s*$/, "")
      .split("|")
      .slice(1)
      .map(cell);
    if (cells.length === 0) continue;
    if (cells[0].toLowerCase() === "term") continue;
    rows.push(cells);
  }

  if (rows.length === 0) {
    report(
      "vocabulary-incomplete",
      `${file}: the '## Vocabulary' section has no rows. List the document's terms, or state 'None — this PRD introduces no domain concepts.'`,
    );
    return { failures, staleness: [] };
  }

  for (const cells of rows) {
    const term = cells[0].length > 0 ? cells[0] : "(unnamed row)";
    const status = (cells[1] ?? "").replace(/\s+/g, " ");
    const lower = status.toLowerCase();

    if (lower === "existing") {
      if (glossaryMarkdown !== null && !known.has(term.toLowerCase())) {
        report(
          "vocabulary-incomplete",
          `${file}: row '${term}' is marked 'existing' but ${GLOSSARY_FILE} has no such term. Propose it instead, or correct the spelling.`,
        );
      }
      continue;
    }

    if (lower === "proposed") {
      if (known.has(term.toLowerCase())) {
        report(
          "vocabulary-incomplete",
          `${file}: row '${term}' is marked 'proposed' but ${GLOSSARY_FILE} already defines it. Use 'existing'.`,
        );
        continue;
      }
      const missing = (["bounded context", "definition", "forbidden synonyms"] as const).filter(
        (_label, index) => isEmpty(cells[index + 2] ?? ""),
      );
      if (missing.length > 0) {
        report(
          "vocabulary-incomplete",
          `${file}: proposed row '${term}' is missing ${missing.join(", ")}. A proposal carries all three, and 'none' is an answer.`,
        );
      }
      continue;
    }

    if (CONFLICT.test(status)) continue;

    report(
      "vocabulary-incomplete",
      `${file}: row '${term}' has status '${status}', expected 'existing', 'proposed', or 'conflict → D-NN'.`,
    );
  }

  return { failures, staleness: [] };
}

/**
 * Run the Vocabulary check over every PRD in `docs/requirements/`.
 *
 * The skip rule lives here rather than in the check, because it is
 * about `lint`'s reach and not about what a Vocabulary section means
 * (§8.3). A PRD with neither `## Vocabulary` nor `## Decisions`
 * predates the grilling phases entirely: it was never interviewed, so
 * failing it now would turn this gate red on every repository that
 * adopted the harness before today, and a gate that is red on arrival
 * is a gate its owners turn off.
 *
 * Specifications under `workstream/` are not walked. They are checked
 * by `activity-generate-spec` before presentation (D-75), where the
 * author is present to answer; `lint` has no business failing a
 * working draft.
 */
export function checkVocabularyFiles(repoRoot: string): GlossaryResult {
  const dir = join(repoRoot, REQUIREMENTS_DIR);
  if (!existsSync(dir)) return { failures: [], staleness: [] };

  const glossaryPath = join(repoRoot, GLOSSARY_FILE);
  const glossaryMarkdown = existsSync(glossaryPath) ? readFileSync(glossaryPath, "utf-8") : null;

  const failures: GlossaryFinding[] = [];
  for (const entry of readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    // A *directory* named `*.md` is legal and rare, and reading one
    // throws EISDIR out of `lint` with a message that points nowhere
    // near this file.
    const path = join(dir, entry);
    if (!statSync(path).isFile()) continue;
    const markdown = readFileSync(path, "utf-8");
    const hasVocabulary = sectionLines(markdown, /^##(?!#)\s+Vocabulary\s*$/) !== null;
    const hasDecisions = sectionLines(markdown, /^##(?!#)\s+Decisions\b.*$/) !== null;
    if (!hasVocabulary && !hasDecisions) continue;

    failures.push(
      ...checkVocabularySection(markdown, glossaryMarkdown, `${REQUIREMENTS_DIR}/${entry}`)
        .failures,
    );
  }

  return { failures, staleness: [] };
}

/* -------------------------------------------------------------------------
 * New exported identifiers against the forbidden synonyms (S-005;
 * §8.6, FR-23, AC-15, D-60, D-63, D-64, D-73)
 * ---------------------------------------------------------------------- */

/**
 * `export <kind> <Identifier>`, with the diff's `+` optional (D-73).
 *
 * A line that begins with a space (an unchanged context line in a diff)
 * or with `-` (a removed line) does not match, and that asymmetry is
 * the point: the scan is about what a PR *adds*. Reporting a deletion
 * would ask an author to fix vocabulary they just removed.
 *
 * `export default class Foo` is not matched. A regex cannot reach a
 * default export's name without becoming a parser, and D-60 chose the
 * regex over the compiler API because this module ships inside
 * `dist/core/`, where `typescript` — a devDependency — is absent. The
 * miss is documented in the specification's risk table and pinned by a
 * test, so the next reader learns it is a choice.
 */
const EXPORT_DECLARATION =
  /^(?:\+\s*)?export\s+(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/;

/** `export { a, b as c }` lists, including `export type { … }` re-exports. */
const EXPORT_LIST = /^(?:\+\s*)?export\s+(?:type\s+)?\{([^}]*)\}/;

/** `b as c` — `c` is what a consumer types, so `c` is the identifier (D-73). */
const ALIAS = /\bas\s+([A-Za-z_$][\w$]*)$/;

/** Cells that decline to name a synonym rather than naming one. */
const NO_SYNONYMS = new Set(["", "none", "—", "–", "-", "n/a", "na"]);

/**
 * One word, lower-cased and de-pluralized — the same function on both
 * sides of every comparison (D-73).
 *
 * The plural rule strips `es` only after `s`, `x`, `z`, `ch`, or `sh`
 * (so `classes` → `class` and `boxes` → `box`), and otherwise a single
 * trailing `s` not preceded by another `s` (so `types` → `type` and
 * `staleness` is left alone). Applied naively in the other order it
 * turns `types` into `typ`.
 *
 * It is wrong about English in places — `status` becomes `statu`, and
 * `buses` → `bus` → `bu` means it is not idempotent on every input.
 * Neither costs anything here: both sides are normalized exactly once
 * by this function, so they agree. A normalizer that is wrong the same
 * way twice still matches; two sides that disagree do not.
 *
 * Exported for the RT-1/RT-2 property fixtures, which test the two
 * halves of the rule directly rather than inferring them from findings.
 */
export function normalizeVocabularyWord(word: string): string {
  const lower = word.toLowerCase();
  if (/(?:s|x|z|ch|sh)es$/.test(lower)) return lower.slice(0, -2);
  if (/[^s]s$/.test(lower)) return lower.slice(0, -1);
  return lower;
}

/**
 * Split an identifier into its words: PascalCase, camelCase,
 * snake_case, SCREAMING_CASE, and the acronym boundary.
 *
 * `HTTPModule` splits at the acronym (`http`, `module`), `V2Loader`
 * keeps the digit with its word (`v2`, `loader`), and `module2` stays
 * whole — the specification normalizes case and plural, and nothing
 * else, so a digit stripper would invent a rule no one wrote. A leading
 * `_` or `$` is dropped before splitting.
 */
export function splitIdentifierWords(identifier: string): string[] {
  const cleaned = identifier.replace(/^[_$]+/, "");
  const words = cleaned.match(/[A-Z]+(?![a-z])[0-9]*|[A-Z][a-z0-9]*|[a-z][a-z0-9]*|[0-9]+/g);
  return (words ?? []).map((word) => word.toLowerCase());
}

/** Every exported identifier an added line declares, in source order. */
function exportedIdentifiers(line: string): string[] {
  const list = line.match(EXPORT_LIST);
  if (list !== null) {
    const names: string[] = [];
    for (const raw of list[1].split(",")) {
      const entry = raw.trim().replace(/^type\s+/, "");
      if (entry.length === 0) continue;
      const alias = entry.match(ALIAS);
      const name = alias === null ? entry : alias[1];
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name);
    }
    return names;
  }

  const declaration = line.match(EXPORT_DECLARATION);
  return declaration === null ? [] : [declaration[1]];
}

/**
 * The strings an identifier is compared against, in reporting order.
 *
 * Each word first, then every adjacent word pair joined, then the whole
 * identifier joined (D-73). The joins are what let a multi-word synonym
 * match at all: `product-context` normalizes to `productcontext`, which
 * is what `productContext` joins to. Non-adjacent pairs are not
 * candidates — `productLoaderContext` is not `product context`, and
 * matching any two words in any order would flag half of any codebase.
 */
function matchCandidates(words: string[]): string[] {
  const candidates: string[] = [];
  const add = (value: string): void => {
    const normalized = normalizeVocabularyWord(value);
    if (normalized.length > 0 && !candidates.includes(normalized)) candidates.push(normalized);
  };

  for (const word of words) add(word);
  for (let i = 0; i + 1 < words.length; i += 1) add(words[i] + words[i + 1]);
  if (words.length > 1) add(words.join(""));

  return candidates;
}

interface ForbiddenSynonym {
  /** The synonym as the glossary spells it, for the message. */
  display: string;
  /** Every term that forbids it, in document order. */
  terms: string[];
}

/** Separators carry no meaning across the comparison: `-`, `_`, space. */
function normalizeSynonym(synonym: string): string {
  return normalizeVocabularyWord(synonym.replace(/[-_\s]+/g, ""));
}

/** Forbidden synonyms of every term, keyed by their normalized form. */
function forbiddenSynonyms(glossaryMarkdown: string): Map<string, ForbiddenSynonym> {
  const map = new Map<string, ForbiddenSynonym>();

  for (const entry of parseGlossary(glossaryMarkdown).terms) {
    const field = entry.fields.get("Forbidden synonyms");
    if (field === undefined) continue;

    for (const raw of field.split(",")) {
      const synonym = cell(raw);
      if (NO_SYNONYMS.has(synonym.toLowerCase())) continue;

      const key = normalizeSynonym(synonym);
      if (key.length === 0) continue;

      const existing = map.get(key);
      if (existing === undefined) map.set(key, { display: synonym, terms: [entry.name] });
      else if (!existing.terms.includes(entry.name)) existing.terms.push(entry.name);
    }
  }

  return map;
}

/**
 * Scan a PR's added lines for exports that use a forbidden synonym.
 *
 * The `verifier` already holds the diff in Audit Mode; this turns it
 * into a finding on stated grounds — "this export says `product-context`,
 * and the glossary forbids that for `foundation document`" — instead of
 * a reviewer's judgment about someone else's naming.
 *
 * Forbidden synonyms only (D-64). An identifier that matches no synonym
 * produces nothing, and so does one that matches a *canonical* term:
 * `DecisionLog` is the right name when `decision log` is the term, and
 * a check that flagged it would flag nearly every export in a codebase
 * that took its own glossary seriously.
 *
 * Every finding lands in `staleness` and never in `failures` (D-63).
 * `lint` does not call this function at all, so its exit code cannot
 * move; the `verifier` narrates hits as advisory and they never block
 * PR readiness in this release. Extraction is a regex (D-60), so some
 * early noise is certain, and a noisy gate that blocks is a gate its
 * owners switch off.
 */
export function checkExportedIdentifiers(
  addedLines: string[],
  glossaryMarkdown: string,
): GlossaryResult {
  const synonyms = forbiddenSynonyms(glossaryMarkdown);
  if (synonyms.size === 0) return { failures: [], staleness: [] };

  const staleness: GlossaryFinding[] = [];

  for (const line of addedLines) {
    for (const identifier of exportedIdentifiers(line)) {
      const words = splitIdentifierWords(identifier);
      const reported = new Set<string>();

      for (const candidate of matchCandidates(words)) {
        const hit = synonyms.get(candidate);
        if (hit === undefined || reported.has(candidate)) continue;
        reported.add(candidate);

        const terms = hit.terms.map((name) => `'${name}'`).join(" and ");
        staleness.push(
          finding(
            "glossary-forbidden-synonym",
            `${GLOSSARY_FILE}: new export '${identifier}' matches '${candidate}', a forbidden synonym ('${hit.display}') of term ${terms}. Advisory only (D-63): it does not block this PR.`,
          ),
        );
      }
    }
  }

  return { failures: [], staleness };
}
