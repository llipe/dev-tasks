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
import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkGlossaryContent, checkGlossary } from "../../core/checks/glossary.js";
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
    const content = readFileSync(join(REPO_ROOT, "templates/domain/ubiquitous-language.md"), "utf-8");
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
    const body = CONTEXT + term("runbook", { Status: "superseded by procedure (feature#D-01)" }) + "\n" + term("procedure");
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
      CONTEXT + term("runbook") + "\n## Bounded Context: @llipe.com/dev-tasks\n\n" + term("runbook");
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
  const changelog =
    CHANGELOG_HEADER + "| 1.1 | 2026-09-22 | +alpha, +beta | product-engineer |\n";

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
  const clean = doc(
    CONTEXT + term("alpha") + "\n" + term("beta"),
    { changelog: CHANGELOG_HEADER + "| 1.1 | 2026-09-22 | +alpha, +beta | product-engineer |\n" },
  );

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
        mutate: (s) => s.replace("## Bounded Context: AI-assisted development workflow", "## Bounded Context: Elsewhere"),
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
