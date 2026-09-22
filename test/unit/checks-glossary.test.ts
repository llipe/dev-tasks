/**
 * Unit tests for the ubiquitous-language structure check (S-002,
 * specification §5 and §8.2, decisions D-59, D-66, D-74, D-75).
 *
 * Two functions are under test here. `checkGlossaryContent(markdown,
 * packageMap)` is pure over its two arguments — every structural rule
 * D-66 makes a failure is exercised against an inlined fixture, the
 * `decision-log-format` precedent, because the whole input is one small
 * Markdown file. `checkGlossary(repoRoot)` adds the filesystem: it
 * reads the glossary and `docs/tech.md`, resolves `feature#D-NN`
 * origins against `workstream/decisions-<feature>.md`, and returns no
 * findings at all when the glossary is absent (D-75 — absence is
 * `doctor`'s business, D-67).
 *
 * Rule names are the D-74 union, not the Design Mode draft names: the
 * test plan's `glossary-missing-field`/`glossary-invalid-status`/
 * `glossary-dangling-supersede`/`glossary-duplicate-term`/
 * `glossary-unresolved-context`/`glossary-no-package-map`/
 * `glossary-archived-origin` were recommendations (A-12) that D-74
 * superseded with `glossary-field-missing`, `glossary-status-invalid`,
 * `glossary-superseded-dangling`, `glossary-term-duplicate`,
 * `glossary-context-unresolved`, `glossary-package-map-absent`, and
 * `glossary-origin-unresolved`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkGlossaryContent,
  checkGlossary,
  checkVocabularySection,
  checkVocabularyFiles,
  checkExportedIdentifiers,
  splitIdentifierWords,
  normalizeVocabularyWord,
  REQUIREMENTS_DIR,
} from "../../core/checks/glossary.js";
import type { GlossaryFinding } from "../../core/checks/glossary.js";
import * as checksIndex from "../../core/checks/index.js";
import { readPackageMap } from "../../core/distribution/workspace.js";
import type { PackageMapRow } from "../../core/distribution/workspace.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const GLOSSARY_PATH = "docs/domain/ubiquitous-language.md";

const MAP: PackageMapRow[] = [
  {
    name: "@llipe.com/dev-tasks",
    path: ".",
    boundedContext: "AI-assisted development workflow",
  },
];

const FRONTMATTER = [
  "---",
  "version: 1.0",
  "name: Ubiquitous Language",
  "description: Canonical domain vocabulary, organized by bounded context.",
  "status: unfilled",
  "owner: product-engineer",
  "---",
  "",
].join("\n");

const CHANGELOG_HEADER =
  "## Changelog\n\n| Version | Date | Summary | Author |\n| ------- | ---- | ------- | ------ |\n";

/** A whole glossary file: frontmatter, title, changelog, then `body`. */
function doc(body: string, options: { frontmatter?: string; changelog?: string } = {}): string {
  const frontmatter = options.frontmatter ?? FRONTMATTER;
  const changelog = options.changelog ?? CHANGELOG_HEADER;
  return `${frontmatter}# Ubiquitous Language\n\nSome guidance prose the template puts before the changelog.\n\n${changelog}\n${body}`;
}

/** One `### <Term>` entry with all five bullets, overridable per field. */
function term(name: string, overrides: Record<string, string | null> = {}): string {
  const fields: Record<string, string | null> = {
    Definition: `What ${name} means here.`,
    "Forbidden synonyms": "none",
    Invariants: "none",
    Origin: "docs/requirements/prd-shared-understanding-refinement.md",
    Status: "active",
    ...overrides,
  };
  const bullets = Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  return `### ${name}\n\n${bullets}\n`;
}

const CONTEXT = "## Bounded Context: AI-assisted development workflow\n\n";

function rules(findings: { rule: string }[]): string[] {
  return findings.map((f) => f.rule);
}

describe("checkGlossaryContent — clean input (UT-G1, UT-G15)", () => {
  it("passes the shipped template: zero terms is valid (D-66)", () => {
    const content = readFileSync(
      join(REPO_ROOT, "templates/domain/ubiquitous-language.md"),
      "utf-8",
    );
    const result = checkGlossaryContent(content, MAP);
    expect(result.failures).toEqual([]);
    expect(result.staleness).toEqual([]);
  });

  it("passes a populated glossary whose optional fields are the explicit `none`", () => {
    const result = checkGlossaryContent(doc(CONTEXT + term("runbook")), MAP);
    expect(result.failures).toEqual([]);
    expect(result.staleness).toEqual([]);
  });

  it("is pure: the same input twice gives identical results (EC-31)", () => {
    const content = doc(CONTEXT + term("runbook"));
    expect(checkGlossaryContent(content, MAP)).toEqual(checkGlossaryContent(content, MAP));
  });
});

describe("checkGlossaryContent — missing fields (UT-G2, EC-3)", () => {
  const FIELDS = ["Definition", "Forbidden synonyms", "Invariants", "Origin", "Status"];

  for (const field of FIELDS) {
    it(`fails when a term omits '${field}'`, () => {
      const result = checkGlossaryContent(doc(CONTEXT + term("runbook", { [field]: null })), MAP);
      expect(rules(result.failures)).toEqual(["glossary-field-missing"]);
      expect(result.failures[0].message).toContain("runbook");
      expect(result.failures[0].message).toContain(field);
    });
  }

  it("fails when a field is present but empty — `none` is explicit, blank is not (EC-3)", () => {
    const result = checkGlossaryContent(
      doc(CONTEXT + term("runbook", { "Forbidden synonyms": "" })),
      MAP,
    );
    expect(rules(result.failures)).toEqual(["glossary-field-missing"]);
  });
});

describe("checkGlossaryContent — Status (UT-G3, UT-G4, UT-G5)", () => {
  it("fails a Status outside the two allowed forms", () => {
    for (const status of ["deprecated", "superseded by X", ""]) {
      const result = checkGlossaryContent(doc(CONTEXT + term("runbook", { Status: status })), MAP);
      expect(rules(result.failures)).toContain(
        status === "" ? "glossary-field-missing" : "glossary-status-invalid",
      );
    }
  });

  it("fails `superseded by <Term>` whose target is not in the file", () => {
    const result = checkGlossaryContent(
      doc(CONTEXT + term("runbook", { Status: "superseded by Ghost (feature#D-01)" })),
      MAP,
    );
    expect(rules(result.failures)).toEqual(["glossary-superseded-dangling"]);
    expect(result.failures[0].message).toContain("Ghost");
  });

  it("accepts `superseded by <Term>` whose target exists anywhere in the file", () => {
    const body =
      CONTEXT +
      term("runbook", { Status: "superseded by procedure (feature#D-01)" }) +
      "\n" +
      term("procedure");
    const result = checkGlossaryContent(doc(body), MAP);
    expect(result.failures).toEqual([]);
  });
});

describe("checkGlossaryContent — term uniqueness (UT-G6, A-16)", () => {
  it("fails the same term twice in one context", () => {
    const body = CONTEXT + term("runbook") + "\n" + term("runbook");
    expect(rules(checkGlossaryContent(doc(body), MAP).failures)).toEqual([
      "glossary-term-duplicate",
    ]);
  });

  it("fails the same term in two contexts — one meaning per repository (D-16)", () => {
    const body =
      CONTEXT +
      term("runbook") +
      "\n## Bounded Context: @llipe.com/dev-tasks\n\n" +
      term("runbook");
    expect(rules(checkGlossaryContent(doc(body), MAP).failures)).toEqual([
      "glossary-term-duplicate",
    ]);
  });

  it("fails a case-different duplicate: uniqueness is case-insensitive (D-74)", () => {
    const body = CONTEXT + term("Runbook") + "\n" + term("runbook");
    expect(rules(checkGlossaryContent(doc(body), MAP).failures)).toEqual([
      "glossary-term-duplicate",
    ]);
  });
});

describe("checkGlossaryContent — bounded context resolution (UT-G7, UT-G8, UT-G19)", () => {
  it("fails a context matching neither a package name nor a Bounded context cell", () => {
    const body = "## Bounded Context: Billing\n\n" + term("invoice");
    const result = checkGlossaryContent(doc(body), MAP);
    expect(rules(result.failures)).toEqual(["glossary-context-unresolved"]);
    expect(result.failures[0].message).toContain("Billing");
  });

  it("accepts a context equal to a package name", () => {
    const body = "## Bounded Context: @llipe.com/dev-tasks\n\n" + term("runbook");
    expect(checkGlossaryContent(doc(body), MAP).failures).toEqual([]);
  });

  it("accepts a context equal to a Bounded context cell", () => {
    expect(checkGlossaryContent(doc(CONTEXT + term("runbook")), MAP).failures).toEqual([]);
  });

  it("fails a context differing from the map only by case — match is exact (D-74)", () => {
    const body = "## Bounded Context: ai-assisted development workflow\n\n" + term("runbook");
    expect(rules(checkGlossaryContent(doc(body), MAP).failures)).toEqual([
      "glossary-context-unresolved",
    ]);
  });
});

describe("checkGlossaryContent — absent package map (UT-G9)", () => {
  it("reports exactly one finding for the whole file, never one per term", () => {
    const body =
      "## Bounded Context: Alpha\n\n" +
      term("one") +
      "\n## Bounded Context: Beta\n\n" +
      term("two") +
      "\n" +
      term("three");
    const result = checkGlossaryContent(doc(body), null);
    expect(result.failures).toEqual([]);
    expect(rules(result.staleness)).toEqual(["glossary-package-map-absent"]);
    expect(result.staleness[0].message).toContain("activity-init");
  });
});

describe("checkGlossaryContent — frontmatter (UT-G12, AC-3)", () => {
  it("fails when one of the five keys is missing", () => {
    const frontmatter = FRONTMATTER.split("\n")
      .filter((l) => !l.startsWith("owner:"))
      .join("\n");
    const result = checkGlossaryContent(doc(CONTEXT + term("runbook"), { frontmatter }), MAP);
    expect(rules(result.failures)).toEqual(["glossary-frontmatter"]);
    expect(result.failures[0].message).toContain("owner");
  });

  it("fails when there is no frontmatter block at all", () => {
    const result = checkGlossaryContent("# Ubiquitous Language\n", MAP);
    expect(rules(result.failures)).toEqual(["glossary-frontmatter"]);
  });

  it("does not enforce the value of `owner` — presence only (D-75)", () => {
    const frontmatter = FRONTMATTER.replace("owner: product-engineer", "owner: developer");
    const result = checkGlossaryContent(doc(CONTEXT + term("runbook"), { frontmatter }), MAP);
    expect(result.failures).toEqual([]);
  });
});

describe("checkGlossaryContent — append-only (UT-G13, UT-G14)", () => {
  const changelog = CHANGELOG_HEADER + "| 1.1 | 2026-09-22 | +alpha, +beta | product-engineer |\n";

  it("passes when every changelog `+term` is still in the body", () => {
    const body = CONTEXT + term("alpha") + "\n" + term("beta");
    expect(checkGlossaryContent(doc(body, { changelog }), MAP).failures).toEqual([]);
  });

  it("fails naming the term a prior version added and the body no longer has", () => {
    const result = checkGlossaryContent(doc(CONTEXT + term("alpha"), { changelog }), MAP);
    expect(rules(result.failures)).toEqual(["glossary-term-removed"]);
    expect(result.failures[0].message).toContain("beta");
  });

  it("passes a changelog with no `+term` rows yet — nothing to compare", () => {
    const body = CONTEXT + term("alpha") + "\n" + term("beta");
    const plain = CHANGELOG_HEADER + "| 1.0 | 2026-09-22 | Initial version | product-engineer |\n";
    expect(checkGlossaryContent(doc(body, { changelog: plain }), MAP).failures).toEqual([]);
  });
});

describe("checkGlossaryContent — parsing robustness (UT-G16, UT-G18, RT-5)", () => {
  it("gives identical results for CRLF-with-BOM and LF input", () => {
    const lf = doc(CONTEXT + term("runbook", { Status: "deprecated" }));
    const crlf = `﻿${lf.replace(/\n/g, "\r\n")}`;
    expect(checkGlossaryContent(crlf, MAP)).toEqual(checkGlossaryContent(lf, MAP));
  });

  it("skips fenced code blocks: a template example inside a fence is not an entry (D-74)", () => {
    const fenced =
      "```markdown\n## Bounded Context: Nowhere\n\n### Fake\n\n- Definition: …\n```\n\n" +
      CONTEXT +
      term("runbook");
    const result = checkGlossaryContent(doc(fenced), MAP);
    expect(result.failures).toEqual([]);
    expect(result.staleness).toEqual([]);
  });

  it("fails closed and never throws on malformed input (RT-5)", () => {
    const noise = readFileSync(join(REPO_ROOT, "test/fixtures/glossary/noise.md"), "utf-8");
    const inputs = [
      "",
      "---\nversion: 1.0\n",
      "- Definition: orphan bullet before any context\n",
      doc("#### runbook\n\n- Definition: a term at the wrong level\n"),
      doc(CONTEXT + "### spaced\n\n- Definition : tolerant spacing\n"),
      doc(CONTEXT + "\t- Definition: tab indented\n"),
      doc("| stray | row |\n| ----- | --- |\n"),
      noise,
    ];
    for (const input of inputs) {
      const result = checkGlossaryContent(input, MAP);
      expect(Array.isArray(result.failures)).toBe(true);
      expect(Array.isArray(result.staleness)).toBe(true);
    }
  });
});

describe("checkGlossaryContent — mutation set over a populated glossary (RT-4)", () => {
  const clean = doc(CONTEXT + term("alpha") + "\n" + term("beta"), {
    changelog: CHANGELOG_HEADER + "| 1.1 | 2026-09-22 | +alpha, +beta | product-engineer |\n",
  });

  it("reports exactly the one rule each single mutation breaks", () => {
    expect(checkGlossaryContent(clean, MAP).failures).toEqual([]);

    const cases: { name: string; mutate: (s: string) => string; rule: string }[] = [
      {
        name: "delete one bullet",
        mutate: (s) => s.replace("- Invariants: none\n", ""),
        rule: "glossary-field-missing",
      },
      {
        name: "invalid Status",
        mutate: (s) => s.replace("- Status: active", "- Status: retired"),
        rule: "glossary-status-invalid",
      },
      {
        name: "superseded by a ghost",
        mutate: (s) => s.replace("- Status: active", "- Status: superseded by Ghost (f#D-01)"),
        rule: "glossary-superseded-dangling",
      },
      {
        name: "rename the context",
        mutate: (s) =>
          s.replace(
            "## Bounded Context: AI-assisted development workflow",
            "## Bounded Context: Elsewhere",
          ),
        rule: "glossary-context-unresolved",
      },
      {
        name: "drop a term still listed in a `+term` row",
        mutate: (s) => s.slice(0, s.indexOf("### beta")),
        rule: "glossary-term-removed",
      },
      {
        name: "duplicate a heading",
        mutate: (s) => s.replace("### beta", "### alpha"),
        rule: "glossary-term-duplicate",
      },
      {
        name: "delete a frontmatter key",
        mutate: (s) => s.replace("version: 1.0\n", ""),
        rule: "glossary-frontmatter",
      },
    ];

    for (const c of cases) {
      const result = checkGlossaryContent(c.mutate(clean), MAP);
      expect(rules(result.failures), c.name).toContain(c.rule);
    }
  });
});

describe("checkGlossary — filesystem wrapper (UT-G10, UT-G11, CT-6, EC-33)", () => {
  function scratch(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "glossary-check-"));
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(root, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content, "utf-8");
    }
    return root;
  }

  const TECH = [
    "# Technical Guidelines",
    "",
    "## Package Map",
    "",
    "| Package | Path | Purpose | Owner | Canonical scripts | Bounded context |",
    "| ------- | ---- | ------- | ----- | ----------------- | ---------------- |",
    "| `@llipe.com/dev-tasks` | `.` | harness | platform | `lint` | AI-assisted development workflow |",
    "",
  ].join("\n");

  it("returns no findings when the glossary is absent (D-75)", () => {
    const root = scratch({ "docs/tech.md": TECH });
    try {
      expect(checkGlossary(root)).toEqual({ failures: [], staleness: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports an Origin citing a decision log that is not present locally", () => {
    const root = scratch({
      "docs/tech.md": TECH,
      [GLOSSARY_PATH]: doc(CONTEXT + term("runbook", { Origin: "archived-feature#D-07" })),
    });
    try {
      const result = checkGlossary(root);
      expect(result.failures).toEqual([]);
      expect(rules(result.staleness)).toEqual(["glossary-origin-unresolved"]);
      expect(result.staleness[0].file).toBe(GLOSSARY_PATH);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("says nothing about an Origin whose decision log is present", () => {
    const root = scratch({
      "docs/tech.md": TECH,
      "workstream/decisions-live-feature.md": "| ID |\n| -- |\n| D-07 |\n",
      [GLOSSARY_PATH]: doc(CONTEXT + term("runbook", { Origin: "live-feature#D-07" })),
    });
    try {
      expect(checkGlossary(root)).toEqual({ failures: [], staleness: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("says nothing about a file-path Origin, present or absent (UT-G11)", () => {
    for (const origin of ["docs/requirements/prd-x.md", "docs/requirements/gone.md"]) {
      const root = scratch({
        "docs/tech.md": TECH,
        "docs/requirements/prd-x.md": "# PRD\n",
        [GLOSSARY_PATH]: doc(CONTEXT + term("runbook", { Origin: origin })),
      });
      try {
        expect(checkGlossary(root)).toEqual({ failures: [], staleness: [] });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("reports the absent package map once when docs/tech.md has no map", () => {
    const root = scratch({
      "docs/tech.md": "# Technical Guidelines\n",
      [GLOSSARY_PATH]: doc(CONTEXT + term("runbook")),
    });
    try {
      const result = checkGlossary(root);
      expect(result.failures).toEqual([]);
      expect(rules(result.staleness)).toEqual(["glossary-package-map-absent"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes this repository's own glossary as it stands (AC-4, D-66)", () => {
    const result = checkGlossary(REPO_ROOT);
    expect(result.failures).toEqual([]);
    expect(result.staleness).toEqual([]);
  });

  /*
   * Comma-separated Origins (S-006 F-1).
   *
   * An Origin names its sources the way a person would: `FR-1,
   * shared-understanding#D-01`, or a bare PRD path. The rule above was
   * anchored to the whole field, so none of this repository's eight
   * Origins matched — not one — and the check had never fired since
   * S-002, leaving all four `#D-NN` citations invisible. Comma lists
   * are just the most common shape (four of the eight). Each element is
   * now tested on its own. The reporting semantics of D-66 are
   * unchanged: staleness, never a failure, deduplicated per feature.
   */
  it("reports a missing decision log cited inside a comma-separated Origin (F-1)", () => {
    const root = scratch({
      "docs/tech.md": TECH,
      [GLOSSARY_PATH]: doc(
        CONTEXT +
          term("runbook", {
            Origin:
              "docs/requirements/prd-shared-understanding-refinement.md FR-1, archived-feature#D-01",
          }),
      ),
    });
    try {
      const result = checkGlossary(root);
      expect(result.failures).toEqual([]);
      expect(rules(result.staleness)).toEqual(["glossary-origin-unresolved"]);
      expect(result.staleness[0].message).toContain("archived-feature#D-01");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("says nothing when a comma-separated Origin's decision log resolves (F-1)", () => {
    const root = scratch({
      "docs/tech.md": TECH,
      "workstream/decisions-live-feature.md": "| ID |\n| -- |\n| D-07 |\n",
      [GLOSSARY_PATH]: doc(
        CONTEXT + term("runbook", { Origin: "ADR-006, ADR-008, live-feature#D-07" }),
      ),
    });
    try {
      expect(checkGlossary(root)).toEqual({ failures: [], staleness: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("says nothing about Origins made only of non-decision elements (F-1)", () => {
    for (const origin of [
      "docs/requirements/prd-shared-understanding-refinement.md FR-4",
      "ADR-006, ADR-008",
      "FR-4, FR-18",
    ]) {
      const root = scratch({
        "docs/tech.md": TECH,
        [GLOSSARY_PATH]: doc(CONTEXT + term("runbook", { Origin: origin })),
      });
      try {
        expect(checkGlossary(root), origin).toEqual({ failures: [], staleness: [] });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("reports one finding per feature when several terms cite the same missing log (D-66)", () => {
    const root = scratch({
      "docs/tech.md": TECH,
      [GLOSSARY_PATH]: doc(
        CONTEXT +
          term("runbook", { Origin: "FR-1, archived-feature#D-01" }) +
          "\n" +
          term("package map", { Origin: "ADR-006, archived-feature#D-12" }) +
          "\n" +
          term("bounded context", { Origin: "archived-feature#D-20" }),
      ),
    });
    try {
      const result = checkGlossary(root);
      expect(result.failures).toEqual([]);
      expect(rules(result.staleness)).toEqual(["glossary-origin-unresolved"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("actually inspects this repository's own Origin citations (F-1, with its control)", () => {
    // A zero that cannot tell "every citation resolves" from "no
    // citation was ever looked at" is what let the anchored rule ship
    // dead. The copy below is the real glossary; the control repoints
    // one of its real `#D-NN` citations at a feature log that does not
    // exist and asserts the check notices.
    const realGlossary = readFileSync(join(REPO_ROOT, GLOSSARY_PATH), "utf-8");
    const realTech = readFileSync(join(REPO_ROOT, "docs/tech.md"), "utf-8");
    const realLog = readFileSync(
      join(REPO_ROOT, "workstream/decisions-shared-understanding.md"),
      "utf-8",
    );
    expect(realGlossary).toContain("shared-understanding#D-01");

    const baseline = scratch({
      "docs/tech.md": realTech,
      "workstream/decisions-shared-understanding.md": realLog,
      [GLOSSARY_PATH]: realGlossary,
    });
    const control = scratch({
      "docs/tech.md": realTech,
      "workstream/decisions-shared-understanding.md": realLog,
      [GLOSSARY_PATH]: realGlossary.replace("shared-understanding#D-01", "no-such-feature#D-01"),
    });
    try {
      expect(checkGlossary(baseline).staleness).toEqual([]);

      const mutated = checkGlossary(control);
      expect(rules(mutated.staleness)).toEqual(["glossary-origin-unresolved"]);
      expect(mutated.staleness[0].message).toContain("no-such-feature#D-01");
    } finally {
      rmSync(baseline, { recursive: true, force: true });
      rmSync(control, { recursive: true, force: true });
    }
  });
});

describe("PackageMapRow and its parser (AC-6, D-75)", () => {
  it("reads this repository's package map, Bounded context column included", () => {
    const rows = readPackageMap(REPO_ROOT);
    expect(rows).not.toBeNull();
    expect(rows?.[0]).toEqual({
      name: "@llipe.com/dev-tasks",
      path: ".",
      boundedContext: "AI-assisted development workflow",
    });
  });

  it("returns rows with a null bounded context when the table has no such column", () => {
    // The shape an older consumer's docs/tech.md has: a package map
    // predating the Bounded context column. Every row still parses, and
    // every context is null — so `checkGlossaryContent` resolves a
    // heading against package names alone rather than failing the file
    // for a column its author never had (D-75).
    const root = mkdtempSync(join(tmpdir(), "glossary-map-nocontext-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(
        join(root, "docs/tech.md"),
        [
          "# Technical Guidelines",
          "",
          "## Package Map",
          "",
          "| Package | Path | Purpose | Owner |",
          "| ------- | ---- | ------- | ----- |",
          "| `@acme/web` | `apps/web` | frontend | web |",
          "| `@acme/api` | `apps/api` | backend | platform |",
          "",
        ].join("\n"),
        "utf-8",
      );

      expect(readPackageMap(root)).toEqual([
        { name: "@acme/web", path: "apps/web", boundedContext: null },
        { name: "@acme/api", path: "apps/api", boundedContext: null },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves a bounded context against a package name when the map has no context column", () => {
    const glossary = doc("## Bounded Context: @acme/api\n\n" + term("widget"));
    const map: PackageMapRow[] = [{ name: "@acme/api", path: "apps/api", boundedContext: null }];
    expect(checkGlossaryContent(glossary, map).failures).toEqual([]);
  });

  it("returns null for a repository whose docs/tech.md has no Package Map section", () => {
    const root = mkdtempSync(join(tmpdir(), "glossary-map-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs/tech.md"), "# Technical Guidelines\n", "utf-8");
      expect(readPackageMap(root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("module contracts (AC-4, AC-5, CT-9, CT-12)", () => {
  it("is exported from core/checks/index.ts for the verifier, one implementation two callers", () => {
    expect(typeof checksIndex.checkGlossary).toBe("function");
    expect(typeof checksIndex.checkGlossaryContent).toBe("function");
  });

  it("is wired into run.ts, which lint invokes through tsx", () => {
    const run = readFileSync(join(REPO_ROOT, "core/checks/run.ts"), "utf-8");
    expect(run).toContain("checkGlossary");
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.lint).toContain("tsx core/checks/run.ts");
  });

  it("imports no yaml, Markdown, or TypeScript parser — it ships inside dist/core (D-49)", () => {
    const source = readFileSync(join(REPO_ROOT, "core/checks/glossary.ts"), "utf-8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const specifier of imports) {
      const allowed =
        specifier.startsWith("node:") || specifier.startsWith("./") || specifier.startsWith("../");
      expect(allowed, `unexpected import '${specifier}'`).toBe(true);
    }
    expect(source).not.toMatch(/from\s+"(yaml|js-yaml|marked|remark|markdown-it|typescript)"/);
  });
});

/**
 * `checkVocabularySection` (S-003, UT-V1..UT-V13; specification §5, §8.3).
 *
 * AC-07's enforcement is structural and nothing else (D-65). The
 * function reads one `## Vocabulary` section and decides, per row,
 * whether the author accounted for the term: `existing` means the
 * glossary already has it, `proposed` means all three proposal cells
 * are filled, `conflict → D-NN` means a recorded decision settled it,
 * and the single sentinel line means the document introduces no domain
 * concept at all. Everything else is `vocabulary-incomplete` naming the
 * row, and a document with no section at all is `vocabulary-missing`.
 * Both land in `failures` — AC-07 says "fails refinement" (D-71).
 *
 * What is deliberately absent is a prose scan. UT-V12 is the test that
 * pins it: a document that says `Widget` ten times in paragraphs and
 * never in the table passes, because a checker that guesses which nouns
 * are domain terms produces findings nobody can act on and everybody
 * learns to ignore.
 */

const GLOSSARY_WITH_TERMS = doc(CONTEXT + term("decision log") + "\n" + term("runbook"));

const PRD = "docs/requirements/prd-example.md";

/** A `## Vocabulary` section wrapped in a document that also has `## Decisions`. */
function prd(section: string | null, prose = ""): string {
  const parts = [
    "# PRD: Example",
    "",
    "## Functional Requirements",
    "",
    prose === "" ? "- FR-1: do the thing." : prose,
    "",
    "## Decisions",
    "",
    "| ID   | Decision (short form) |",
    "| ---- | --------------------- |",
    "| D-01 | Something was decided. |",
    "",
  ];
  if (section !== null) parts.push(section, "");
  parts.push("## Open Questions", "", "- none", "");
  return parts.join("\n");
}

const TABLE_HEADER = [
  "## Vocabulary",
  "",
  "| Term | Status in glossary | Bounded context | Definition (proposals only) | Forbidden synonyms (proposals only) |",
  "| ---- | ------------------ | --------------- | --------------------------- | ----------------------------------- |",
].join("\n");

/** A `## Vocabulary` section whose body is the given table rows. */
function vocabulary(...rows: string[]): string {
  return [TABLE_HEADER, ...rows].join("\n");
}

describe("checkVocabularySection — missing section (UT-V1, UT-V11, UT-V13)", () => {
  it("reports vocabulary-missing when a grilled document has no ## Vocabulary", () => {
    const result = checkVocabularySection(prd(null), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-missing"]);
    expect(result.staleness).toEqual([]);
    expect(result.failures[0].file).toBe(PRD);
  });

  it("treats `### Vocabulary` at the wrong heading level as missing (UT-V11)", () => {
    const wrong = prd("### Vocabulary\n\n| Term | Status in glossary |\n| - | - |");
    expect(rules(checkVocabularySection(wrong, GLOSSARY_WITH_TERMS, PRD).failures)).toEqual([
      "vocabulary-missing",
    ]);
  });

  it("does not see a `## Vocabulary` that only appears inside a fenced block (UT-V11, EC-7)", () => {
    // The Phase 3 specification itself carries a fenced `## Vocabulary`
    // example. A parser that reads fences declares every document that
    // documents the format compliant.
    const fenced = prd(
      ["```markdown", "## Vocabulary", "", "| Term | Status in glossary |", "```"].join("\n"),
    );
    expect(rules(checkVocabularySection(fenced, GLOSSARY_WITH_TERMS, PRD).failures)).toEqual([
      "vocabulary-missing",
    ]);
  });

  it("puts vocabulary findings in failures, never staleness (UT-V13, D-71)", () => {
    const result = checkVocabularySection(prd(null), GLOSSARY_WITH_TERMS, PRD);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.staleness).toEqual([]);
  });
});

describe("checkVocabularySection — the sentinel (UT-V2)", () => {
  it("accepts the exact `None —` line as a complete section", () => {
    const section = "## Vocabulary\n\nNone — this PRD introduces no domain concepts.";
    const result = checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD);
    expect(result.failures).toEqual([]);
  });

  it("rejects an empty section that claims nothing at all", () => {
    const section = "## Vocabulary\n";
    expect(rules(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures)).toEqual([
      "vocabulary-incomplete",
    ]);
  });

  it("accepts the sentinel written with an en dash or a hyphen", () => {
    for (const dash of ["—", "–", "-"]) {
      const section = `## Vocabulary\n\nNone ${dash} this PRD introduces no domain concepts.`;
      expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
    }
  });

  it("does not accept a `None —` prose line that sits above a real table (F-1, AC-07)", () => {
    // Spec §5: the sentinel stands for the whole section — "carries the
    // section with one line". A document that opens with prose starting
    // `None —` and then tables incomplete rows underneath is not that
    // document, and a gate that returns clean on the first `None —` it
    // sees is a gate any author bypasses by accident.
    const section = vocabulary("| Widget | pending | | | |", "| Gadget | proposed | | | |").replace(
      "## Vocabulary\n",
      "## Vocabulary\n\nNone — new terms are listed below; the rest are already in the glossary.\n",
    );
    const result = checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete", "vocabulary-incomplete"]);
    expect(result.failures[0].message).toContain("Widget");
    expect(result.failures[1].message).toContain("Gadget");
  });

  it("does not accept a sentinel that only appears inside a fenced example (F-1, F-3)", () => {
    const section = [
      "## Vocabulary",
      "",
      "A document with no domain concept writes:",
      "",
      "```markdown",
      "None — this PRD introduces no domain concepts.",
      "```",
      "",
      "| Term | Status in glossary | Bounded context | Definition (proposals only) | Forbidden synonyms (proposals only) |",
      "| ---- | ------------------ | --------------- | --------------------------- | ----------------------------------- |",
      "| Widget | pending | | | |",
    ].join("\n");
    const result = checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete"]);
    expect(result.failures[0].message).toContain("Widget");
  });
});

/**
 * Defects found by the S-003 merge gates (issue #231): five conditions
 * under which the check answered wrongly about a document — once by
 * passing a section it must fail (F-1), twice by reporting a problem
 * that is not there (F-2, F-3), once by throwing out of `lint` (F-4),
 * and once by reading content that is not in the section (F-5).
 *
 * The two false positives matter more than their severity suggests.
 * Under `lint` they are partly masked by `format:check`, which
 * normalises delimiter rows before this check ever sees them; the
 * pre-presentation calls in `activity-refine` and
 * `activity-generate-spec` run on an unformatted working draft, where
 * nothing masks them, and the author is told their correct document is
 * broken.
 */
describe("checkVocabularySection — merge-gate remediation (F-2, F-3, F-5)", () => {
  /** A Vocabulary section with the given delimiter row between header and rows. */
  function withDelimiter(delimiter: string, ...rows: string[]): string {
    return [
      "## Vocabulary",
      "",
      "| Term | Status in glossary | Bounded context | Definition (proposals only) | Forbidden synonyms (proposals only) |",
      delimiter,
      ...rows,
    ].join("\n");
  }

  it("accepts a single-dash GFM delimiter row `| - | - |` (F-2)", () => {
    const section = withDelimiter("| - | - | - | - | - |", "| decision log | existing | | | |");
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("accepts a centred single-dash delimiter row `|:-:|` (F-2)", () => {
    const section = withDelimiter("|:-:|:-:|:-:|:-:|:-:|", "| decision log | existing | | | |");
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("still accepts the long and aligned delimiter forms (F-2 regression)", () => {
    for (const delimiter of ["| ---- | ---- | ---- | ---- | ---- |", "|:---|---:|:---:|---|---|"]) {
      const section = withDelimiter(delimiter, "| decision log | existing | | | |");
      expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
    }
  });

  it("does not read a fenced example inside a real section as rows (F-3)", () => {
    const section = [
      vocabulary("| decision log | existing | | | |"),
      "",
      "An incomplete row looks like this:",
      "",
      "```markdown",
      "| Widget | pending | | | |",
      "```",
    ].join("\n");
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("still ignores a `## Vocabulary` heading that only appears inside a fence (F-3 regression)", () => {
    const fenced = prd(
      ["```markdown", "## Vocabulary", "", "| Term | Status in glossary |", "```"].join("\n"),
    );
    expect(rules(checkVocabularySection(fenced, GLOSSARY_WITH_TERMS, PRD).failures)).toEqual([
      "vocabulary-missing",
    ]);
  });

  it("terminates the section at a level-1 heading, not only a level-2 one (F-5)", () => {
    // §8.3 describes the section as ending at the next heading. A `#`
    // that does not close it makes every table in the rest of the file
    // a Vocabulary table.
    const document = [
      "# PRD: Example",
      "",
      vocabulary("| decision log | existing | | | |"),
      "",
      "# Appendix",
      "",
      "| Item | Note |",
      "| ---- | ---- |",
      "| bogus | pending |",
      "",
    ].join("\n");
    expect(checkVocabularySection(document, GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });
});

describe("checkVocabularySection — existing rows (UT-V3, UT-V4)", () => {
  it("resolves an `existing` term against the glossary case-insensitively (UT-V3)", () => {
    const section = vocabulary("| Decision Log | existing | | | |");
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("reports vocabulary-incomplete naming a term the glossary does not have (UT-V4)", () => {
    const section = vocabulary("| Widget | existing | | | |");
    const result = checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete"]);
    expect(result.failures[0].message).toContain("Widget");
  });

  it("passes `existing` rows unchecked when the repository has no glossary yet (D-75)", () => {
    const section = vocabulary("| Widget | existing | | | |");
    expect(checkVocabularySection(prd(section), null, PRD).failures).toEqual([]);
  });

  it("accepts an `existing` term whose glossary entry is superseded (EC-15)", () => {
    // Superseded-ness is the glossary check's concern, not AC-07's: the
    // term is present, which is all this rule asks.
    const glossary = doc(
      CONTEXT +
        term("decision log", { Status: "superseded by runbook (shared-understanding#D-01)" }) +
        "\n" +
        term("runbook"),
    );
    const section = vocabulary("| decision log | existing | | | |");
    expect(checkVocabularySection(prd(section), glossary, PRD).failures).toEqual([]);
  });
});

describe("checkVocabularySection — proposed rows (UT-V5, UT-V6, UT-V7)", () => {
  it("accepts a proposal carrying context, definition, and synonyms (UT-V5)", () => {
    const section = vocabulary(
      "| exit gate | proposed | AI-assisted development workflow | The confirmation that ends an interview. | gate, checkpoint |",
    );
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("accepts `none` as an explicit forbidden-synonyms value (UT-V7)", () => {
    const section = vocabulary(
      "| exit gate | proposed | AI-assisted development workflow | The confirmation that ends an interview. | none |",
    );
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it.each([
    ["bounded context", "| exit gate | proposed | | A definition. | none |"],
    ["definition", "| exit gate | proposed | Some context | | none |"],
    ["forbidden synonyms", "| exit gate | proposed | Some context | A definition. | |"],
  ])("reports vocabulary-incomplete when the %s cell is empty (UT-V6)", (_field, row) => {
    const result = checkVocabularySection(prd(vocabulary(row)), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete"]);
    expect(result.failures[0].message).toContain("exit gate");
  });

  it("treats an em-dash placeholder cell as empty, not as content", () => {
    const section = vocabulary("| exit gate | proposed | — | A definition. | none |");
    expect(rules(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures)).toEqual([
      "vocabulary-incomplete",
    ]);
  });

  it("reports a `proposed` row for a term the glossary already has, and says to use `existing` (D-74)", () => {
    const section = vocabulary(
      "| runbook | proposed | AI-assisted development workflow | A procedure. | none |",
    );
    const result = checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete"]);
    expect(result.failures[0].message).toContain("runbook");
    expect(result.failures[0].message).toContain("existing");
  });
});

describe("checkVocabularySection — conflict rows and unknown statuses (UT-V8, UT-V9)", () => {
  it.each(["conflict → D-12", "conflict -> D-12", "conflict →  D-12"])(
    "accepts `%s` (both arrows, D-74)",
    (status) => {
      const section = vocabulary(`| product context | ${status} | | | |`);
      expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
    },
  );

  it("accepts a qualified cross-feature conflict reference", () => {
    const section = vocabulary("| product context | conflict → shared-understanding#D-12 | | | |");
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("reports `conflict` with no decision ID (UT-V8)", () => {
    const section = vocabulary("| product context | conflict | | | |");
    expect(rules(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures)).toEqual([
      "vocabulary-incomplete",
    ]);
  });

  it("reports an unrecognised status cell such as `pending` (UT-V9)", () => {
    const section = vocabulary("| widget | pending | | | |");
    const result = checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete"]);
    expect(result.failures[0].message).toContain("pending");
  });
});

describe("checkVocabularySection — table shape and prose (UT-V10, UT-V12, EC-13)", () => {
  it("reports a header-only table as incomplete (UT-V10, D-74)", () => {
    const result = checkVocabularySection(prd(vocabulary()), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete"]);
    expect(result.failures[0].message).toContain("no rows");
  });

  it("does not scan prose: a term used ten times outside the table is not a finding (UT-V12)", () => {
    const prose = Array.from({ length: 10 }, () => "The Widget is central to this PRD.").join(" ");
    const section = vocabulary("| decision log | existing | | | |");
    expect(checkVocabularySection(prd(section, prose), GLOSSARY_WITH_TERMS, PRD).failures).toEqual(
      [],
    );
  });

  it("trims cells and normalises non-breaking spaces (EC-13)", () => {
    const section = vocabulary("|  decision log  |  existing  | | | |");
    expect(checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("reads the section through CRLF line endings and a leading BOM", () => {
    const section = vocabulary("| Widget | existing | | | |");
    const crlf = `﻿${prd(section).replace(/\n/g, "\r\n")}`;
    expect(rules(checkVocabularySection(crlf, GLOSSARY_WITH_TERMS, PRD).failures)).toEqual([
      "vocabulary-incomplete",
    ]);
  });

  it("stops at the next level-2 heading and does not read the following section's table", () => {
    const section = vocabulary("| decision log | existing | | | |");
    const document = prd(section) + "\n## Later\n\n| Term | nonsense |\n| - | - |\n| x | y |\n";
    expect(checkVocabularySection(document, GLOSSARY_WITH_TERMS, PRD).failures).toEqual([]);
  });

  it("reports every bad row, not only the first", () => {
    const section = vocabulary("| alpha | pending | | | |", "| beta | existing | | | |");
    const result = checkVocabularySection(prd(section), GLOSSARY_WITH_TERMS, PRD);
    expect(rules(result.failures)).toEqual(["vocabulary-incomplete", "vocabulary-incomplete"]);
  });

  it("is pure: the same input twice gives identical results", () => {
    const document = prd(vocabulary("| widget | pending | | | |"));
    expect(checkVocabularySection(document, GLOSSARY_WITH_TERMS, PRD)).toEqual(
      checkVocabularySection(document, GLOSSARY_WITH_TERMS, PRD),
    );
  });
});

/**
 * The `run.ts` walk over `docs/requirements/` (S-003, UT-R1..UT-R3).
 *
 * The skip rule is the whole point of putting the walk in a separate
 * function from the check (§8.3). A PRD written before this phase has
 * neither `## Vocabulary` nor `## Decisions`; it was never grilled, so
 * failing it retroactively would make `lint` red on every repository
 * that adopted the harness before today and teach its owners that the
 * gate is noise.
 */
describe("checkVocabularyFiles — the docs/requirements walk (UT-R1, UT-R2, UT-R3)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vocab-walk-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function write(relPath: string, content: string): void {
    const full = join(root, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }

  it("skips a pre-Phase-2 PRD with neither section (UT-R1)", () => {
    write("docs/requirements/prd-old.md", "# PRD: Old\n\n## Goals\n\n- Ship it.\n");
    expect(checkVocabularyFiles(root)).toEqual({ failures: [], staleness: [] });
  });

  it("reports vocabulary-missing on a grilled PRD with no section (UT-R2)", () => {
    write("docs/requirements/prd-new.md", prd(null));
    const result = checkVocabularyFiles(root);
    expect(rules(result.failures)).toEqual(["vocabulary-missing"]);
    expect(result.failures[0].file).toBe("docs/requirements/prd-new.md");
  });

  it("does not walk workstream/specification-*.md — lint's scope is docs/requirements (UT-R3)", () => {
    write("workstream/specification-thing.md", prd(null));
    expect(checkVocabularyFiles(root)).toEqual({ failures: [], staleness: [] });
  });

  it("checks a PRD that has a `## Vocabulary` but no `## Decisions`", () => {
    // Having the section is itself opting in; only the document with
    // neither is presumed to predate the mechanism.
    write(
      "docs/requirements/prd-vocab-only.md",
      ["# PRD: Vocab only", "", vocabulary("| Widget | pending | | | |"), ""].join("\n"),
    );
    expect(rules(checkVocabularyFiles(root).failures)).toEqual(["vocabulary-incomplete"]);
  });

  it("resolves `existing` rows against the repository's own glossary", () => {
    write("docs/domain/ubiquitous-language.md", GLOSSARY_WITH_TERMS);
    write("docs/requirements/prd-new.md", prd(vocabulary("| Decision Log | existing | | | |")));
    expect(checkVocabularyFiles(root).failures).toEqual([]);
  });

  it("returns nothing when docs/requirements does not exist", () => {
    expect(checkVocabularyFiles(root)).toEqual({ failures: [], staleness: [] });
  });

  it("ignores non-Markdown files in docs/requirements", () => {
    write("docs/requirements/notes.txt", prd(null));
    expect(checkVocabularyFiles(root)).toEqual({ failures: [], staleness: [] });
  });

  it("skips a directory whose name ends in .md instead of throwing EISDIR (F-4)", () => {
    // `readdirSync` returns directories too, and `readFileSync` on one
    // throws EISDIR straight out of the `lint` gate — a crash, not a
    // finding, and nothing in the message would point here.
    mkdirSync(join(root, "docs/requirements/archive.md"), { recursive: true });
    write("docs/requirements/prd-new.md", prd(null));
    expect(rules(checkVocabularyFiles(root).failures)).toEqual(["vocabulary-missing"]);
  });

  it("walks files in a stable order so output does not shuffle between runs", () => {
    write("docs/requirements/prd-b.md", prd(null));
    write("docs/requirements/prd-a.md", prd(null));
    expect(checkVocabularyFiles(root).failures.map((f) => f.file)).toEqual([
      "docs/requirements/prd-a.md",
      "docs/requirements/prd-b.md",
    ]);
  });
});

describe("checkVocabularySection — this repository's own PRDs (IT-7, A-8)", () => {
  /** Every PRD on disk, and the ones §8.3's skip rule does not skip. */
  function realPrds(): { all: string[]; walked: string[] } {
    const dir = join(REPO_ROOT, REQUIREMENTS_DIR);
    const all = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    const walked = all.filter((f) => {
      const markdown = readFileSync(join(dir, f), "utf-8");
      return (
        /^##(?!#)\s+Vocabulary\s*$/m.test(markdown) || /^##(?!#)\s+Decisions\b/m.test(markdown)
      );
    });
    return { all, walked };
  }

  it("reports nothing over the real docs/requirements tree", () => {
    const result = checkVocabularyFiles(REPO_ROOT);
    // Both halves. The glossary self-check above learned this the hard
    // way: a sibling fixture asserted `failures` alone and let a
    // `staleness` finding print on every `lint` run across three merges
    // with the suite fully green. `checkVocabularyFiles` returns an
    // empty `staleness` today, and this is what notices if it stops.
    expect(result.failures, JSON.stringify(result.failures, null, 2)).toEqual([]);
    expect(result.staleness, JSON.stringify(result.staleness, null, 2)).toEqual([]);
  });

  it("walks at least one real PRD, so the clean result above is not a clean nothing", () => {
    // The assertion above passes identically when the walk reads no
    // file at all — an empty `docs/requirements/`, a rename that moves
    // the tree, or a skip rule that widens until it swallows every PRD.
    // Three of this repository's four PRDs are already grandfathered
    // out by §8.3 (D-65), so "reaches nothing" is one edit away and
    // would take AC-07's self-application with it, silently, under a
    // green `lint`.
    const { all, walked } = realPrds();
    expect(all.length, `no PRDs in ${REQUIREMENTS_DIR}`).toBeGreaterThan(0);
    expect(walked, `every PRD in ${REQUIREMENTS_DIR} is skipped by the §8.3 rule`).toContain(
      "prd-shared-understanding-refinement.md",
    );
  });

  it("names the real grilled PRD when its own Vocabulary breaks — the control", () => {
    // Mirrors the real tree rather than a synthetic one: this is what
    // proves the walk reaches *this* repository's PRD by name, parses
    // the section the live file actually carries, and still skips the
    // three that carry neither section. A synthetic fixture proves the
    // grammar; only the real file proves the reach.
    const root = mkdtempSync(join(tmpdir(), "vocab-real-"));
    try {
      const dir = join(REPO_ROOT, REQUIREMENTS_DIR);
      mkdirSync(join(root, REQUIREMENTS_DIR), { recursive: true });
      mkdirSync(join(root, "docs/domain"), { recursive: true });
      writeFileSync(
        join(root, GLOSSARY_PATH),
        readFileSync(join(REPO_ROOT, GLOSSARY_PATH), "utf-8"),
        "utf-8",
      );

      const { all } = realPrds();
      const target = "prd-shared-understanding-refinement.md";
      for (const file of all) {
        const markdown = readFileSync(join(dir, file), "utf-8");
        // One cell, in the one grilled PRD: `existing` becomes a status
        // the grammar does not know, which is `vocabulary-incomplete`.
        const broken =
          file === target ? markdown.replace(/\| existing  /, "| bogus     ") : markdown;
        if (file === target) expect(broken, "the status cell did not change").not.toBe(markdown);
        writeFileSync(join(root, REQUIREMENTS_DIR, file), broken, "utf-8");
      }

      const result = checkVocabularyFiles(root);
      expect(rules(result.failures)).toContain("vocabulary-incomplete");
      // Only the grilled PRD. The other three carry neither section and
      // must stay skipped; a finding against one of them means the §8.3
      // rule stopped grandfathering.
      expect([...new Set(result.failures.map((f) => f.file))]).toEqual([
        `${REQUIREMENTS_DIR}/${target}`,
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("is exported from core/checks/index.ts for the verifier and activity-refine", () => {
    expect(typeof checksIndex.checkVocabularySection).toBe("function");
    expect(typeof checksIndex.checkVocabularyFiles).toBe("function");
  });
});

/* -------------------------------------------------------------------------
 * `checkExportedIdentifiers` — the verifier's conformance scan
 * (S-005; specification §8.6; UT-X1..UT-X15, RT-1..RT-3, EC-16..EC-21)
 * ---------------------------------------------------------------------- */

/**
 * A glossary whose single term forbids `synonyms`, for the scan.
 *
 * The term name is deliberately not a word any fixture identifier
 * contains: D-64 reports forbidden synonyms and never canonical terms,
 * and a fixture where the two overlap cannot tell the two rules apart.
 */
function forbidding(synonyms: string, termName = "bounded context"): string {
  return doc(CONTEXT + term(termName, { "Forbidden synonyms": synonyms }));
}

/** The scan, with the D-63 invariant asserted on every single call. */
function scan(lines: string[], glossaryMarkdown: string): GlossaryFinding[] {
  const result = checkExportedIdentifiers(lines, glossaryMarkdown);
  // UT-X9: not a separate case but a property of every case. A rule
  // that is advisory in fourteen tests and blocking in the fifteenth is
  // a rule nobody can rely on.
  expect(result.failures, "D-63: the scan never produces failures").toEqual([]);
  for (const finding of result.staleness) expect(finding.rule).toBe("glossary-forbidden-synonym");
  return result.staleness;
}

describe("checkExportedIdentifiers — declaration forms (UT-X1, AC-1)", () => {
  const GLOSSARY = forbidding("module");

  const FORMS = [
    "+export const moduleLoader = 1;",
    "+export let moduleLoader = 1;",
    "+export var moduleLoader = 1;",
    "+export function moduleLoader() {}",
    "+export async function moduleLoader() {}",
    "+export class moduleLoader {}",
    "+export type moduleLoader = string;",
    "+export interface moduleLoader {}",
    "+export enum moduleLoader {}",
  ];

  for (const line of FORMS) {
    it(`extracts the identifier from \`${line.trim()}\``, () => {
      const findings = scan([line], GLOSSARY);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain("moduleLoader");
      expect(findings[0].message).toContain("module");
    });
  }

  it("does not match a non-export line that happens to name the word", () => {
    // The negative half of the same rule: the scan reads added exports,
    // not added code.
    expect(scan(["+const moduleLoader = 1;", "+// module loader here"], GLOSSARY)).toEqual([]);
  });

  it("does not match `export` used as part of a longer word", () => {
    expect(
      scan(["+exportConst moduleLoader = 1;", "+exports.moduleLoader = 1;"], GLOSSARY),
    ).toEqual([]);
  });
});

describe("checkExportedIdentifiers — brace lists (UT-X2, UT-X12, AC-1, D-73)", () => {
  it("takes the right-hand name of `as` and leaves the local name alone", () => {
    // `export { packageIndex as PackageTable }`: the exported name is
    // what a consumer types, and the local name is invisible to them.
    const findings = scan(
      ["+export { helper, packageIndex as PackageTable };"],
      forbidding("package"),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("PackageTable");
    expect(findings[0].message).not.toContain("packageIndex");
  });

  it("reports nothing when only the *local* side carries the synonym", () => {
    // The negative of A-10, and the case that proves the sides are not
    // simply both scanned: `moduleThing as Renamed` exports `Renamed`.
    expect(scan(["+export { moduleThing as renamed };"], forbidding("module"))).toEqual([]);
  });

  it("handles a re-export list and `export type { … }` (UT-X12)", () => {
    expect(scan(['+export { Module } from "./m";'], forbidding("module"))).toHaveLength(1);
    expect(scan(['+export type { Module } from "./m";'], forbidding("module"))).toHaveLength(1);
    expect(scan(["+export { type Module, other };"], forbidding("module"))).toHaveLength(1);
  });

  it("reports nothing for a star re-export — there is no identifier (UT-X12)", () => {
    expect(scan(['+export * from "./module";'], forbidding("module"))).toEqual([]);
    expect(scan(['+export * as modules from "./m";'], forbidding("module"))).toEqual([]);
  });

  it("reports nothing for `export default class` — the documented D-60 miss (UT-X11)", () => {
    // A regex over declarations cannot see a default export's name
    // without a parser, and D-60 chose the regex. Recording the miss as
    // a test is how the next reader learns it is a choice, not a bug.
    expect(scan(["+export default class ModuleRegistry {}"], forbidding("module"))).toEqual([]);
  });
});

describe("checkExportedIdentifiers — splitting (UT-X3, EC-16, EC-17, EC-18, AC-1)", () => {
  const GLOSSARY = forbidding("loader");

  for (const line of [
    "+export class ProductContextLoader {}",
    "+export const productContextLoader = 1;",
    "+export const product_context_loader = 1;",
    "+export const PRODUCT_CONTEXT_LOADER = 1;",
  ]) {
    it(`splits \`${line.trim()}\` into words`, () => {
      expect(scan([line], GLOSSARY)).toHaveLength(1);
    });
  }

  it("splits an acronym at its boundary: `HTTPModule` → http, module (EC-18)", () => {
    expect(scan(["+export class HTTPModule {}"], forbidding("module"))).toHaveLength(1);
    expect(scan(["+export class HTTPModule {}"], forbidding("http"))).toHaveLength(1);
  });

  it("keeps a digit with the preceding word: `V2ModuleLoader` (EC-16)", () => {
    expect(splitIdentifierWords("V2ModuleLoader")).toEqual(["v2", "module", "loader"]);
  });

  it("does not split a trailing digit off a word: `module2` misses `module` (EC-16)", () => {
    // The spec normalizes case and plural, and nothing else. A digit
    // stripper would make `module2` a hit, which is a rule no one wrote.
    expect(splitIdentifierWords("module2")).toEqual(["module2"]);
    expect(scan(["+export const module2 = 1;"], forbidding("module"))).toEqual([]);
  });

  it("strips a leading `_` or `$` before splitting (EC-17)", () => {
    expect(splitIdentifierWords("_module")).toEqual(["module"]);
    expect(splitIdentifierWords("$package")).toEqual(["package"]);
    expect(scan(["+export const _module = 1;"], forbidding("module"))).toHaveLength(1);
  });

  it("reports nothing for a single-letter identifier (EC-18)", () => {
    expect(scan(["+export const X = 1;"], forbidding("module"))).toEqual([]);
  });
});

describe("checkExportedIdentifiers — normalization (UT-X4, UT-X13, EC-19, D-73)", () => {
  it("normalizes a trailing `s`: `Modules` hits `module` (UT-X4)", () => {
    expect(scan(["+export const Modules = 1;"], forbidding("module"))).toHaveLength(1);
    expect(scan(["+export type Packages = string;"], forbidding("package"))).toHaveLength(1);
  });

  it("strips `es` only after s/x/z/ch/sh, so `types` does not become `typ` (EC-19)", () => {
    expect(normalizeVocabularyWord("classes")).toBe("class");
    expect(normalizeVocabularyWord("boxes")).toBe("box");
    expect(normalizeVocabularyWord("branches")).toBe("branch");
    expect(normalizeVocabularyWord("types")).toBe("type");
    expect(normalizeVocabularyWord("packages")).toBe("package");
  });

  it("applies the same function to both sides, so `status` still matches (UT-X13)", () => {
    // Both sides become `statu`. The normalizer being wrong about
    // English is survivable; the two sides disagreeing is not.
    expect(normalizeVocabularyWord("status")).toBe("statu");
    expect(scan(["+export const statusCode = 1;"], forbidding("status"))).toHaveLength(1);
  });

  it("does not strip an `s` preceded by an `s` (EC-19)", () => {
    expect(normalizeVocabularyWord("staleness")).toBe("staleness");
    expect(normalizeVocabularyWord("class")).toBe("class");
  });

  it("is case-insensitive on both sides", () => {
    expect(scan(["+export const MODULE = 1;"], forbidding("Module"))).toHaveLength(1);
  });
});

describe("checkExportedIdentifiers — multi-word synonyms (UT-X5, EC-20, D-73)", () => {
  it("matches the joined identifier against a hyphenated synonym (UT-X5)", () => {
    const findings = scan(["+export const productContext = 1;"], forbidding("product-context"));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("product-context");
  });

  it("matches an adjacent word pair inside a longer identifier (EC-20)", () => {
    expect(
      scan(["+export const productContextLoader = 1;"], forbidding("product context")),
    ).toHaveLength(1);
    expect(
      scan(["+export const loadProductContext = 1;"], forbidding("product_context")),
    ).toHaveLength(1);
  });

  it("joins all words of a three-word identifier against a three-word synonym", () => {
    // `matchCandidates` adds the full join separately from the adjacent
    // pairs, and for a two-word identifier the two are the same string
    // — so every existing case here passes with the full join deleted.
    // Three words is the shortest input that tells them apart.
    const findings = scan(
      ["+export const productContextLoader = 1;"],
      forbidding("product-context-loader"),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("productcontextloader");
    // And the pair joins must not reach it: no adjacent pair of
    // `productContextLoader` spells the three-word synonym.
    expect(
      scan(["+export const productContext = 1;"], forbidding("product-context-loader")),
    ).toEqual([]);
  });

  it("does not match a non-adjacent word pair", () => {
    // `product…loader…context` is not `product context`. Matching any
    // two words in any order would flag half the codebase.
    expect(
      scan(["+export const productLoaderContext = 1;"], forbidding("product context")),
    ).toEqual([]);
  });

  it("does not match a single word of a multi-word synonym", () => {
    expect(scan(["+export const contextLoader = 1;"], forbidding("product-context"))).toEqual([]);
  });
});

describe("checkExportedIdentifiers — what is never reported (UT-X6, UT-X7, UT-X8, AC-2, D-64)", () => {
  it("reports nothing for an identifier matching no synonym (UT-X6)", () => {
    const result = checkExportedIdentifiers(
      ["+export const readFileSafely = 1;"],
      forbidding("module"),
    );
    expect(result).toEqual({ failures: [], staleness: [] });
  });

  it("reports nothing for an identifier equal to a canonical term (UT-X7)", () => {
    // FR-23's literal wording says "match glossary terms"; D-64 says
    // forbidden synonyms only, and this is the case that separates them.
    const glossary = doc(CONTEXT + term("decision log", { "Forbidden synonyms": "changelog" }));
    expect(scan(["+export class DecisionLog {}"], glossary)).toEqual([]);
  });

  it("reports nothing when every term forbids `none` (UT-X8)", () => {
    expect(scan(["+export const moduleLoader = 1;"], forbidding("none"))).toEqual([]);
  });

  it("reports nothing against a glossary with no terms at all", () => {
    expect(scan(["+export const moduleLoader = 1;"], doc(""))).toEqual([]);
  });

  it("reports nothing for an empty line list", () => {
    expect(scan([], forbidding("module"))).toEqual([]);
  });
});

describe("checkExportedIdentifiers — diff line prefixes (UT-X10, D-73, A-11)", () => {
  const GLOSSARY = forbidding("module");

  it("accepts a line with the diff `+` and one without it", () => {
    expect(scan(["+export const moduleLoader = 1;"], GLOSSARY)).toHaveLength(1);
    expect(scan(["export const moduleLoader = 1;"], GLOSSARY)).toHaveLength(1);
    expect(scan(["+  export const moduleLoader = 1;"], GLOSSARY)).toHaveLength(1);
  });

  it("ignores a removed line — `-export const moduleLoader`", () => {
    // The scan is about what the PR *adds*. Reporting a deletion would
    // ask the author to fix vocabulary they just removed.
    expect(scan(["-export const moduleLoader = 1;"], GLOSSARY)).toEqual([]);
  });

  it("ignores an unchanged context line — a leading space, no `+`", () => {
    expect(scan([" export const moduleLoader = 1;"], GLOSSARY)).toEqual([]);
  });

  it("ignores a removed or context `export { … }` list, not just a removed declaration", () => {
    // UT-X10 pinned this for `export const` only. `EXPORT_LIST` is a
    // second regex with its own copy of the optional `+`, so the rule
    // held here by construction and not by test: mutating the list
    // regex to accept `-` and a leading space left the whole suite
    // green. A PR that *deletes* an export would then be told to
    // rename the vocabulary it just removed — the exact false positive
    // D-63 expects the advisory class to avoid.
    expect(scan(["-export { moduleLoader };"], GLOSSARY)).toEqual([]);
    expect(scan([" export { moduleLoader };"], GLOSSARY)).toEqual([]);
    expect(scan(["-export type { moduleLoader };"], GLOSSARY)).toEqual([]);
    expect(scan(["-export { helper as moduleLoader };"], GLOSSARY)).toEqual([]);
    // The control: the same lines as additions do report, so the
    // assertions above cannot pass for the wrong reason.
    expect(scan(["+export { moduleLoader };"], GLOSSARY)).toHaveLength(1);
  });

  it("ignores diff headers that mention an export", () => {
    expect(
      scan(["+++ b/core/module.ts", "@@ -1,3 +1,4 @@ export const moduleLoader"], GLOSSARY),
    ).toEqual([]);
  });
});

describe("checkExportedIdentifiers — finding shape and multiplicity (UT-X14, UT-X15, AC-3)", () => {
  it("reports one finding per exported identifier, without deduplicating (UT-X14)", () => {
    const findings = scan(
      ["+export const moduleA = 1;", "+export const moduleB = 2;"],
      forbidding("module"),
    );
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.message.includes("moduleA"))).toEqual([true, false]);
  });

  it("names the identifier, the matched text, the synonym, the term, and `advisory` (UT-X15)", () => {
    const findings = scan(
      ["+export const productContextLoader = 1;"],
      forbidding("product-context", "foundation document"),
    );
    expect(findings).toHaveLength(1);
    const { rule, file, message } = findings[0];
    expect(rule).toBe("glossary-forbidden-synonym");
    expect(file).toBe(GLOSSARY_PATH);
    expect(message).toContain("productContextLoader");
    expect(message).toContain("productcontext");
    expect(message).toContain("product-context");
    expect(message).toContain("foundation document");
    expect(message.toLowerCase()).toContain("advisory");
  });

  it("names every term that forbids the same synonym, in one finding", () => {
    const glossary = doc(
      CONTEXT +
        term("foundation document", { "Forbidden synonyms": "module" }) +
        "\n" +
        term("bounded context", { "Forbidden synonyms": "module" }),
    );
    const findings = scan(["+export const moduleLoader = 1;"], glossary);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("foundation document");
    expect(findings[0].message).toContain("bounded context");
  });

  it("reports one finding per distinct synonym an identifier hits", () => {
    const glossary = doc(
      CONTEXT +
        term("foundation document", { "Forbidden synonyms": "module, loader" }) +
        "\n" +
        term("bounded context"),
    );
    expect(scan(["+export const moduleLoader = 1;"], glossary)).toHaveLength(2);
  });

  it("is pure: the same input twice gives identical results", () => {
    const lines = ["+export const moduleLoader = 1;"];
    const glossary = forbidding("module");
    expect(checkExportedIdentifiers(lines, glossary)).toEqual(
      checkExportedIdentifiers(lines, glossary),
    );
  });

  it("is exported from core/checks/index.ts for the verifier (CT-8)", () => {
    expect(typeof checksIndex.checkExportedIdentifiers).toBe("function");
  });

  it("imports no TypeScript compiler API (D-60)", () => {
    // The module ships inside `dist/core/` to consumers, where
    // devDependencies — `typescript` among them — are simply absent.
    const source = readFileSync(join(REPO_ROOT, "core/checks/glossary.ts"), "utf-8");
    expect(source).not.toMatch(/from\s+["']typescript["']/);
    expect(source).not.toMatch(/require\(["']typescript["']\)/);
  });
});

/**
 * Seeded fixture tactics (RT-1, RT-2, RT-3).
 *
 * The rows below were produced by the LCG the test plan pins —
 * `x = (x * 1103515245 + 12345) mod 2^31`, reading the high bits, which
 * the low bits of that generator make necessary — and are committed
 * literally so a failure replays byte-identically. The generator is not
 * run here; regenerating is a deliberate act, not a side effect of
 * running the suite.
 */
const RT_WORDS = [
  "module",
  "package",
  "context",
  "loader",
  "registry",
  "runbook",
  "glossary",
  "vocabulary",
  "decision",
  "term",
  "synonym",
  "verifier",
  "planner",
  "developer",
  "harness",
  "profile",
  "manifest",
  "workspace",
  "document",
  "template",
  "index",
  "gate",
  "finding",
  "staleness",
  "audit",
  "story",
  "epic",
  "backlog",
  "diff",
  "branch",
  "commit",
  "checklist",
  "guard",
  "hook",
  "skill",
  "command",
  "agent",
  "parity",
  "fixture",
  "seed",
];

/** RT-1: identifier → the word list it was joined from (SEED = 20260921). */
const RT1_ROWS: [string, string[]][] = [
  ["HOOK_BACKLOG", ["hook", "backlog"]],
  ["agent", ["agent"]],
  ["PROFILE_PROFILE_PACKAGE_GLOSSARY", ["profile", "profile", "package", "glossary"]],
  ["staleness", ["staleness"]],
  ["audit_module_gate", ["audit", "module", "gate"]],
  ["vocabulary_parity_backlog_module", ["vocabulary", "parity", "backlog", "module"]],
  ["RUNBOOK_DEVELOPER_BRANCH_BACKLOG", ["runbook", "developer", "branch", "backlog"]],
  ["BRANCH_PLANNER_COMMIT_BACKLOG", ["branch", "planner", "commit", "backlog"]],
  ["BACKLOG_AUDIT", ["backlog", "audit"]],
  ["GATE_PACKAGE_SEED", ["gate", "package", "seed"]],
  ["checklist_gate", ["checklist", "gate"]],
  ["GATE_DECISION_GLOSSARY_LOADER", ["gate", "decision", "glossary", "loader"]],
  ["Developer", ["developer"]],
  ["runbookFixture", ["runbook", "fixture"]],
  ["TEMPLATE", ["template"]],
  ["branch_glossary_index", ["branch", "glossary", "index"]],
  ["workspaceSkillTermFixture", ["workspace", "skill", "term", "fixture"]],
  ["skillProfile", ["skill", "profile"]],
  ["command", ["command"]],
  ["DecisionIndexSkillGuard", ["decision", "index", "skill", "guard"]],
  ["findingPackage", ["finding", "package"]],
  ["DocumentVerifier", ["document", "verifier"]],
  ["module", ["module"]],
  ["fixture", ["fixture"]],
  ["templateRegistrySkillCommit", ["template", "registry", "skill", "commit"]],
  ["AgentDecisionParity", ["agent", "decision", "parity"]],
  ["AUDIT_FIXTURE", ["audit", "fixture"]],
  ["context_story_hook_finding", ["context", "story", "hook", "finding"]],
  ["decisionRegistry", ["decision", "registry"]],
  ["EPIC_PLANNER_SKILL_WORKSPACE", ["epic", "planner", "skill", "workspace"]],
  ["commit_story_context_registry", ["commit", "story", "context", "registry"]],
  ["FINDING_EPIC", ["finding", "epic"]],
  ["Profile", ["profile"]],
  ["branch_module_parity_synonym", ["branch", "module", "parity", "synonym"]],
  ["BACKLOG", ["backlog"]],
  ["harness", ["harness"]],
  ["runbookAuditContextContext", ["runbook", "audit", "context", "context"]],
  ["vocabulary_hook", ["vocabulary", "hook"]],
  ["harnessRunbookStoryHarness", ["harness", "runbook", "story", "harness"]],
  ["RunbookDecisionSynonym", ["runbook", "decision", "synonym"]],
];

describe("RT-1 — the splitter round-trips every casing (SEED 20260921)", () => {
  it("covers 40 committed rows across all four casings", () => {
    expect(RT1_ROWS).toHaveLength(40);
    expect(RT1_ROWS.some(([id]) => /^[A-Z][a-z]/.test(id) && !id.includes("_"))).toBe(true);
    expect(RT1_ROWS.some(([id]) => /^[a-z]+[A-Z]/.test(id))).toBe(true);
    expect(RT1_ROWS.some(([id]) => /^[a-z_]+$/.test(id) && id.includes("_"))).toBe(true);
    expect(RT1_ROWS.some(([id]) => /^[A-Z_]+$/.test(id) && id.includes("_"))).toBe(true);
  });

  it.each(RT1_ROWS)("splits %s back into its words", (identifier, words) => {
    expect(splitIdentifierWords(identifier)).toEqual(words);
  });
});

describe("RT-2 — normalizer properties on the same word list (SEED 20260921)", () => {
  it.each(RT_WORDS)("normalize(normalize(%s)) === normalize(%s)", (word) => {
    expect(normalizeVocabularyWord(normalizeVocabularyWord(word))).toBe(
      normalizeVocabularyWord(word),
    );
  });

  it.each(RT_WORDS)("normalize(%s.toUpperCase()) === normalize(%s)", (word) => {
    expect(normalizeVocabularyWord(word.toUpperCase())).toBe(normalizeVocabularyWord(word));
  });

  it.each(RT_WORDS.filter((w) => !w.endsWith("s")))("normalize(%ss) === normalize(%s)", (word) => {
    expect(normalizeVocabularyWord(`${word}s`)).toBe(normalizeVocabularyWord(word));
  });

  it("is not idempotent on a word whose singular itself ends in `s` — a known edge of D-73", () => {
    // `buses` → `bus` → `bu`. Harmless, because both sides are
    // normalized exactly once and agree; recorded because a future
    // reader who assumes idempotence everywhere will be wrong here.
    expect(normalizeVocabularyWord("buses")).toBe("bus");
    expect(normalizeVocabularyWord("bus")).toBe("bu");
  });
});

/** RT-3: identifier → the spliced forbidden synonym, or null (SEED 20260922). */
const RT3_SYNONYMS = ["loader", "developer", "planner", "glossary", "synonym"];
const RT3_ROWS: [string, string | null][] = [
  ["agentGuardCommitPlanner", "planner"],
  ["stalenessHook", null],
  ["seedGuardSkillLoader", "loader"],
  ["guardChecklist", null],
  ["auditSeed", null],
  ["auditSkillSynonym", "synonym"],
  ["backlogBranchParityDeveloper", "developer"],
  ["parityParityGlossary", "glossary"],
  ["hookSkillLoader", "loader"],
  ["stalenessSkillSkill", null],
  ["skillIndex", null],
  ["findingBacklog", null],
  ["diffSeed", null],
  ["parityCommand", null],
  ["findingCommitAgent", null],
  ["findingParityStory", null],
  ["skillChecklistGate", null],
  ["diffAudit", null],
  ["hookAgentDiffDeveloper", "developer"],
  ["hookAgentHook", null],
  ["parityChecklistFinding", null],
  ["storyParityBranch", null],
  ["seedParitySynonym", "synonym"],
  ["auditParityDiff", null],
  ["checklistAgentCommandPlanner", "planner"],
  ["storyCommandBranch", null],
  ["auditSkillStaleness", null],
  ["epicGateCommitDeveloper", "developer"],
  ["stalenessIndexCommit", null],
  ["findingParityGuard", null],
];

describe("RT-3 — no false positives, no false negatives (SEED 20260922)", () => {
  const GLOSSARY = forbidding(RT3_SYNONYMS.join(", "));
  const lines = RT3_ROWS.map(([id]) => `+export const ${id} = 1;`);

  it("splices exactly ten hits into thirty identifiers", () => {
    expect(RT3_ROWS).toHaveLength(30);
    expect(RT3_ROWS.filter(([, hit]) => hit !== null)).toHaveLength(10);
  });

  it("reports the ten spliced identifiers and nothing else", () => {
    const findings = scan(lines, GLOSSARY);
    const expected = RT3_ROWS.filter(([, hit]) => hit !== null);
    expect(findings).toHaveLength(expected.length);
    for (const [index, [identifier, synonym]] of expected.entries()) {
      expect(findings[index].message).toContain(identifier);
      expect(findings[index].message).toContain(synonym as string);
    }
  });

  it("reports nothing at all once the synonyms are drawn from the disjoint list", () => {
    // The same thirty lines against a glossary forbidding words none of
    // them contain: if this reported anything, the run above would be
    // proving nothing.
    expect(scan(lines, forbidding("widget, sprocket"))).toEqual([]);
  });
});

/* -------------------------------------------------------------------------
 * This repository's own populated glossary (S-006; specification §8.7,
 * D-69, D-72, D-76; UT-G17, PT-6, E2E-11)
 * ---------------------------------------------------------------------- */

/**
 * The eight terms of specification §8.7, in the order that table gives
 * them.
 *
 * Written out here rather than read from the file: a test that derives
 * its expectation from the artifact under test asserts only that the
 * artifact equals itself. D-69 bounds the seed to the terms this PRD's
 * own history supplies, so the list is a contract, and a ninth term
 * arriving through a future PRD's `## Vocabulary` is supposed to fail
 * this until someone updates the list deliberately.
 */
const SEED_TERMS = [
  "decision log",
  "grilling",
  "exit gate",
  "bounded context",
  "package map",
  "runbook",
  "install-if-absent",
  "foundation document",
];

/** The one context, which must equal `docs/tech.md`'s cell exactly (FR-63). */
const SEED_CONTEXT = "AI-assisted development workflow";

/** The `### <Term>` headings of a glossary, in document order. */
function headings(markdown: string): string[] {
  return [...markdown.matchAll(/^###\s+(.+?)\s*$/gm)].map((m) => m[1]);
}

/** One term's bullet block, from its heading to the next heading. */
function termBlock(markdown: string, name: string): string {
  const start = markdown.indexOf(`### ${name}\n`);
  expect(start, `no '### ${name}' heading in ${GLOSSARY_PATH}`).toBeGreaterThan(-1);
  const body = markdown.slice(start + `### ${name}\n`.length);
  const end = body.search(/^#{2,3}\s/m);
  return end === -1 ? body : body.slice(0, end);
}

describe("this repository's own glossary (UT-G17, E2E-11, S-006 AC-1/AC-5, D-69)", () => {
  const glossary = readFileSync(join(REPO_ROOT, GLOSSARY_PATH), "utf-8");

  it("passes the real check with zero failures and zero staleness", () => {
    // Both halves. A fixture elsewhere in this phase asserted
    // `failures` alone and let a `staleness` finding print on every
    // `lint` run across three merges with the suite fully green.
    const result = checkGlossary(REPO_ROOT);
    expect(result.failures, JSON.stringify(result.failures, null, 2)).toEqual([]);
    expect(result.staleness, JSON.stringify(result.staleness, null, 2)).toEqual([]);
  });

  it("carries exactly the eight terms of specification §8.7 and no others (AC-1)", () => {
    expect(headings(glossary)).toEqual(SEED_TERMS);
  });

  it("names its one bounded context exactly as the docs/tech.md package map does (FR-63)", () => {
    const contexts = [...glossary.matchAll(/^##\s+Bounded Context:\s*(.+?)\s*$/gm)].map(
      (m) => m[1],
    );
    expect(contexts).toEqual([SEED_CONTEXT]);

    const map = readPackageMap(REPO_ROOT);
    expect(map).not.toBeNull();
    // Byte-for-byte, not case-insensitively: D-74 made context
    // resolution an exact match, so a case difference here is a `lint`
    // failure and this test is what catches it first.
    expect((map ?? []).map((row) => row.boundedContext)).toContain(SEED_CONTEXT);
  });

  it("has frontmatter `status: active`, an owner, and a bumped version (AC-1)", () => {
    const frontmatter = glossary.slice(0, glossary.indexOf("\n---", 4));
    expect(frontmatter).toContain("status: active");
    expect(frontmatter).toContain("owner: product-engineer");
    expect(frontmatter).not.toContain("status: unfilled");
    expect(frontmatter).toMatch(/^version: 1\.1$/m);
  });

  it("records the eight terms in one `+term` changelog row (AC-1, FR-19)", () => {
    const changelog = glossary.slice(glossary.indexOf("## Changelog"));
    const rows = changelog
      .split("\n")
      .filter((line) => line.trim().startsWith("|") && line.includes("+"));
    expect(rows).toHaveLength(1);
    for (const term of SEED_TERMS) expect(rows[0]).toContain(`+${term}`);
  });

  it("traces every Origin to a PRD requirement, an ADR, or a decision ID (AC-5)", () => {
    const origins = [...glossary.matchAll(/^-\s*Origin:\s*(.+?)\s*$/gm)].map((m) => m[1]);
    expect(origins).toHaveLength(SEED_TERMS.length);
    for (const origin of origins) {
      expect(origin, origin).toMatch(
        /prd-shared-understanding-refinement\.md FR-\d+|shared-understanding#D-\d+|ADR-\d+/,
      );
    }
  });

  it("marks every term `active` (AC-1)", () => {
    const statuses = [...glossary.matchAll(/^-\s*Status:\s*(.+?)\s*$/gm)].map((m) => m[1]);
    expect(statuses).toEqual(SEED_TERMS.map(() => "active"));
  });

  it("gives `bounded context` no forbidden synonyms, and `package`/`module` none anywhere (D-72)", () => {
    // Scoped to the one block, not the whole file: `package` and
    // `module` are ordinary words in the other seven definitions, and a
    // whole-file search for them proves nothing about this rule. D-72
    // dropped them because word matching would flag S-002's own
    // `PackageMapRow` export, and reinstating them reopens that.
    const block = termBlock(glossary, "bounded context");
    expect(block).toMatch(/^-\s*Forbidden synonyms:\s*none\s*$/m);

    const forbidden = [...glossary.matchAll(/^-\s*Forbidden synonyms:\s*(.+?)\s*$/gm)].map(
      (m) => m[1],
    );
    expect(forbidden).toHaveLength(SEED_TERMS.length);
    for (const value of forbidden) {
      expect(value, value).not.toMatch(/\bpackages?\b/i);
      expect(value, value).not.toMatch(/\bmodules?\b/i);
    }
  });

  it("gives `foundation document` the two retired names as forbidden synonyms (D-72)", () => {
    const block = termBlock(glossary, "foundation document");
    expect(block).toMatch(/^-\s*Forbidden synonyms:.*product-context.*$/m);
    expect(block).toMatch(/^-\s*Forbidden synonyms:.*technical-guidelines.*$/m);
  });

  it("reports nothing over this phase's own exported identifiers (AC-2, S-005 AC-5)", () => {
    // The self-scan of E2E-11, run against the same lines the verifier
    // would see. `PackageMapRow` is the identifier A-17 predicted would
    // hit; D-72 is why it does not.
    const added = [
      "+export interface PackageMapRow {",
      "+export function readPackageMap(repoRoot: string): PackageMapRow[] | null {",
      "+export function checkGlossaryContent(",
      "+export function checkVocabularySection(",
      "+export function checkExportedIdentifiers(",
      "+export type GlossaryRule =",
      "+export const GLOSSARY_FILE = 'docs/domain/ubiquitous-language.md';",
      "+export const REQUIREMENTS_DIR = 'docs/requirements';",
      "+export function normalizeVocabularyWord(word: string): string {",
      "+export function splitIdentifierWords(identifier: string): string[] {",
    ];
    const result = checkExportedIdentifiers(added, glossary);
    expect(result.failures).toEqual([]);
    expect(result.staleness, JSON.stringify(result.staleness, null, 2)).toEqual([]);
  });

  it("would still report a genuine forbidden synonym (the negative's control)", () => {
    // Without this, the case above passes just as well against a
    // glossary that forbids nothing at all, which is exactly the
    // positive-only shape that let a sentinel bypass ship earlier in
    // this phase.
    const result = checkExportedIdentifiers(["+export const productContext = 1;"], glossary);
    expect(result.staleness).toHaveLength(1);
    expect(result.staleness[0].rule).toBe("glossary-forbidden-synonym");
    expect(result.staleness[0].message).toContain("foundation document");
  });
});

describe("docs/tech.md's package-map note after D-45 is closed (PT-6, S-006 AC-3)", () => {
  const tech = readFileSync(join(REPO_ROOT, "docs/tech.md"), "utf-8");
  const note = tech.slice(tech.indexOf("## Package Map"), tech.indexOf("## Root Script Fan-Out"));

  it("no longer carries the freeform placeholder sentence (D-45 closed by D-69)", () => {
    // Scoped to the package-map section: `freeform` and `D-45` may
    // legitimately appear elsewhere in this document, and a whole-file
    // assertion would pass or fail for the wrong reason.
    expect(note).not.toContain("freeform working label");
    expect(note).not.toContain("Phase 3's glossary supersedes");
  });

  it("points at the glossary as the canonical source of context names (AC-3)", () => {
    expect(note).toContain("docs/domain/ubiquitous-language.md");
  });

  it("leaves the Bounded context cell unchanged (AC-3)", () => {
    expect(note).toContain(`| ${SEED_CONTEXT} |`);
  });
});

describe("the PRD's `## Vocabulary` is coupled to the glossary (6.3b, D-76)", () => {
  const PRD = "docs/requirements/prd-shared-understanding-refinement.md";
  const prd = readFileSync(join(REPO_ROOT, PRD), "utf-8");
  const glossary = readFileSync(join(REPO_ROOT, GLOSSARY_PATH), "utf-8");

  /** The Vocabulary table's rows as `[term, status]`, header excluded. */
  function vocabularyRows(): [string, string][] {
    const start = prd.indexOf("\n## Vocabulary\n");
    expect(start, `${PRD} has no '## Vocabulary' section`).toBeGreaterThan(-1);
    const rest = prd.slice(start + 1);
    const end = rest.slice(1).search(/^##(?!#)\s/m);
    const section = end === -1 ? rest : rest.slice(0, end + 1);

    const rows: [string, string][] = [];
    for (const line of section.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) continue;
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue;
      const cells = trimmed
        .replace(/\|\s*$/, "")
        .split("|")
        .slice(1)
        .map((c) => c.replace(/`/g, "").trim());
      if (cells[0].toLowerCase() === "term") continue;
      rows.push([cells[0], (cells[1] ?? "").toLowerCase()]);
    }
    return rows;
  }

  it("lists the eight seed terms", () => {
    expect(vocabularyRows().map(([term]) => term)).toEqual(SEED_TERMS);
  });

  it("matches every row's term to a `### <Term>` heading byte-for-byte", () => {
    // The flip in 6.3a is matched on the exact term string, and
    // `checkVocabularySection` stays green when a `proposed` row names
    // a term the glossary does not define (D-74). A spelling that
    // drifts between the two documents therefore fails nothing — which
    // is what this case exists to stop (issue #231 audit finding D-8).
    const glossaryTerms = headings(glossary);
    for (const [term] of vocabularyRows()) {
      expect(glossaryTerms, `'${term}' is not a heading in ${GLOSSARY_PATH}`).toContain(term);
    }
  });

  it("reads `existing` on every row now that the glossary defines them (AC-6)", () => {
    for (const [term, status] of vocabularyRows()) {
      expect(status, `row '${term}'`).toBe("existing");
    }
  });
});
