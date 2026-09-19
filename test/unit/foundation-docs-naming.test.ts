/**
 * Guards the foundation-document rename (PRD FR-44, AC-22; S-001).
 * `docs/product-context.md` became `docs/product.md` and
 * `docs/technical-guidelines.md` became `docs/tech.md`; this scans the
 * source, prompt, docs, and registry trees and fails if a rewritable
 * file still names an old document.
 *
 * Permanent regression guard, not a one-time cleanup check: every phase
 * after this one writes skills that name these documents, so a stale
 * name reintroduced by a future edit has to fail here.
 *
 * NOTE ON SCAN ROOTS: these are deliberately NOT copied from
 * `dt-retirement-absence.test.ts`. That guard omits `docs/` entirely,
 * which is precisely where this problem lives — four ADR files and three
 * PRDs name the old documents. Copying its roots would produce a test
 * that passes while checking nothing (Design Mode DEFECT-3).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = join(import.meta.dirname, "../..");

const SCAN_ROOTS = [
  "bin",
  "core",
  "docs",
  "scripts",
  "templates",
  "test",
  ".claude",
  ".github",
  ".kiro",
  "AGENTS.md",
  "AGENTS.md.template",
  "CLAUDE.md",
  "CLAUDE.md.template",
  "README.md",
];

/**
 * Directories whose contents are immutable historical records, kept out
 * of scope by D-50 rather than rewritten.
 *
 * - `docs/adr/`: an ADR is never rewritten (D-35). ADR-007 in particular
 *   records which files Phase 0 changed; editing it falsifies the record.
 * - `docs/requirements/`: a PRD is a historical statement of intent, and
 *   FR-44's own text reads "`docs/product-context.md` becomes
 *   `docs/product.md`" — rewriting it erases the requirement's subject.
 * - `workstream/`: archived per-feature planning records, outside PRD
 *   AC-22's enumerated scope. 24 tracked files there carry the old names.
 *   Not in SCAN_ROOTS either; named here so the omission reads as
 *   deliberate rather than forgotten.
 */
const EXCLUDED_DIRS = ["docs/adr", "docs/requirements", "workstream"];

/**
 * Files that legitimately name an old document: the fallback-resolution
 * rule (FR-45) has to name what it falls back to, and this guard has to
 * contain its own pattern literals. Listed by name with a reason, which
 * is more auditable than making the pattern context-aware.
 */
const EXEMPT_FILES = new Set([
  "test/unit/foundation-docs-naming.test.ts", // this file: its own pattern literals
  ".claude/skills/activity-init/SKILL.md", // states the fallback rule
  ".github/skills/activity-init/SKILL.md", // states the fallback rule
  ".kiro/skills/activity-init/SKILL.md", // states the fallback rule
]);

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "fixtures"]);
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".js",
  ".mjs",
  ".cjs",
  ".sh",
]);

/**
 * The directory form (`/docs/product-context/`) is matched too. The
 * `technical-writer` agent listed both documents that way in all three
 * trees — a path that never existed, and one the `.md`-anchored pattern
 * alone would have missed while FR-44 still requires the new names only.
 *
 * The bare word form (`product-context` with no path or extension) is
 * deliberately NOT matched, and this is a known limit of the guard:
 * `technical-guidelines` is also a memo-cli tag value in the
 * `technical-writer` entry-type tables, where renaming it would break
 * existing memo entries. A bare-word pattern cannot tell the two apart,
 * so prose references were fixed by hand (CLAUDE.md's File Organization
 * table) and only the path and extension forms are enforced here.
 */
const OLD_NAME_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "product-context.md", pattern: /\bproduct-context\.md\b/ },
  { name: "technical-guidelines.md", pattern: /\btechnical-guidelines\.md\b/ },
  { name: "product-context/ (directory form)", pattern: /\bproduct-context\// },
  { name: "technical-guidelines/ (directory form)", pattern: /\btechnical-guidelines\// },
];

interface Finding {
  file: string;
  pattern: string;
  line: number;
  text: string;
}

function isExcluded(relPath: string): boolean {
  return EXCLUDED_DIRS.some((dir) => relPath === dir || relPath.startsWith(dir + "/"));
}

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const rel = relative(ROOT, full).replace(/\\/g, "/");
    if (isExcluded(rel)) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (TEXT_EXTENSIONS.has(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    const full = join(ROOT, root);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue; // root absent in this checkout
    }
    if (st.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function scanContent(relPath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const { name, pattern } of OLD_NAME_PATTERNS) {
      if (pattern.test(lines[i])) {
        findings.push({ file: relPath, pattern: name, line: i + 1, text: lines[i].trim() });
      }
    }
  }
  return findings;
}

function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const absPath of collectFiles()) {
    const relPath = relative(ROOT, absPath).replace(/\\/g, "/");
    if (EXEMPT_FILES.has(relPath)) continue;
    findings.push(...scanContent(relPath, readFileSync(absPath, "utf-8")));
  }
  return findings;
}

describe("foundation-docs naming guard (PRD FR-44, AC-22)", () => {
  it("has no rewritable file naming an old foundation document", () => {
    const findings = scan();
    if (findings.length > 0) {
      const report = findings
        .map((f) => `  ${f.file}:${f.line} [${f.pattern}] ${f.text}`)
        .join("\n");
      throw new Error(
        `${findings.length} stale foundation-doc reference(s). Use docs/product.md and docs/tech.md:\n${report}`,
      );
    }
    expect(findings).toHaveLength(0);
  });

  it("scans docs/, which the dt-retirement guard does not", () => {
    // Regression guard on the guard: if docs/ ever falls out of SCAN_ROOTS
    // this test goes quiet on the tree that motivated it (DEFECT-3).
    expect(SCAN_ROOTS).toContain("docs");
    const scanned = collectFiles().map((f) => relative(ROOT, f).replace(/\\/g, "/"));
    expect(scanned.some((f) => f.startsWith("docs/"))).toBe(true);
  });

  it("excludes the immutable records, and they really do hold old names", () => {
    // If these stop carrying old names the exclusion is dead weight and
    // should be removed rather than left as unexplained configuration.
    const scanned = collectFiles().map((f) => relative(ROOT, f).replace(/\\/g, "/"));
    expect(scanned.some((f) => f.startsWith("docs/adr/"))).toBe(false);
    expect(scanned.some((f) => f.startsWith("docs/requirements/"))).toBe(false);

    const adr = readFileSync(join(ROOT, "docs/adr/ADR-002-exit-code-contract.md"), "utf-8");
    const prd = readFileSync(
      join(ROOT, "docs/requirements/prd-shared-understanding-refinement.md"),
      "utf-8",
    );
    expect(scanContent("docs/adr/ADR-002-exit-code-contract.md", adr).length).toBeGreaterThan(0);
    expect(scanContent("prd", prd).length).toBeGreaterThan(0);
  });

  it("every exempt file exists and names an old document", () => {
    for (const relPath of EXEMPT_FILES) {
      const content = readFileSync(join(ROOT, relPath), "utf-8");
      expect(
        scanContent(relPath, content).length,
        `${relPath} is exempt but names no old document — drop it from EXEMPT_FILES`,
      ).toBeGreaterThan(0);
    }
  });

  it("fires on a seeded reference and rejects near-miss strings", () => {
    expect(scanContent("seed.md", "see docs/product-context.md for context")).toHaveLength(1);
    expect(scanContent("seed.md", "see docs/technical-guidelines.md")).toHaveLength(1);
    // Near misses that must not match: the new names, and longer words
    // that merely contain an old name as a substring.
    expect(scanContent("seed.md", "docs/product.md and docs/tech.md")).toHaveLength(0);
    expect(scanContent("seed.md", "legacy-product-context.markdown")).toHaveLength(0);
    expect(scanContent("seed.md", "technical-guidelines.mdx")).toHaveLength(0);
    // Directory form fires; the bare memo-cli tag value does not.
    expect(scanContent("seed.md", "- `/docs/product-context/`")).toHaveLength(1);
    expect(scanContent("seed.md", "tags: `technical-guidelines`, domain area")).toHaveLength(0);
  });
});
