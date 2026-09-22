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

import { existsSync, readFileSync } from "node:fs";
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
