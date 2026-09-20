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
  "CHANGELOG.md",
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
 * rule (FR-45) has to name what it falls back to, the migration machinery
 * has to name what it migrates, and this guard has to contain its own
 * pattern literals. Listed by name with a reason, which is more auditable
 * than making the pattern context-aware.
 *
 * The exemption is whole-file, so a stale reference added inside one of
 * these later will not be caught here. That is the cost of a file-level
 * allowlist, and the reason the list stays short and reasoned rather than
 * growing by reflex: everything below either performs the rename or
 * asserts that it happened.
 */
const EXEMPT_FILES = new Set([
  "test/unit/foundation-docs-naming.test.ts", // this file: its own pattern literals
  "core/distribution/migrate-docs.ts", // the rename pairs themselves (S-002)
  "bin/dev-tasks.ts", // `migrate docs` help text names both renames
  "README.md", // documents the migration for consumers (S-002 AC-8)
  "CHANGELOG.md", // a changelog records what changed, old names included — the same reason docs/adr/ is excluded
  "test/unit/migrate-docs.test.ts", // seeds old-named fixtures
  "test/unit/distribution-doctor.test.ts", // asserts the doctor detection message
  "test/unit/distribution-update.test.ts", // asserts update never renames them
  "test/integration/bootstrap-commands.test.ts", // end-to-end migrate docs fixtures
  "docs/runbooks/runbook-migrate-foundation-docs.md", // the procedure for the rename itself (S-003)
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

/**
 * Files where a *line* may name an old document, but only the line that
 * states the fallback rule (FR-45) — the rest of the file is guarded.
 *
 * A whole-file exemption hid a real defect: `activity-init` was exempt
 * for its fallback paragraph, and four lines elsewhere in it went on
 * telling the agent to *create* `product-context.md` long after S-001
 * renamed it. The guard was silent because the file was. Narrowing the
 * exemption to lines that actually state the rule re-arms it.
 */
const FALLBACK_RULE_FILES = new Set([
  ".claude/skills/activity-init/SKILL.md",
  ".github/skills/activity-init/SKILL.md",
  ".kiro/skills/activity-init/SKILL.md",
  // The always-loaded contracts, where the rule binds every reader
  // rather than one skill. Same line-level treatment: the rule line may
  // name the old documents, every other line may not.
  "AGENTS.md",
  "CLAUDE.md",
  "AGENTS.md.template",
  "CLAUDE.md.template",
]);

/** A line that states the rename, rather than a line that uses an old name. */
function statesFallbackRule(line: string): boolean {
  return /renamed from|fall back/i.test(line);
}

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
  const fallbackFile = FALLBACK_RULE_FILES.has(relPath);
  for (let i = 0; i < lines.length; i++) {
    if (fallbackFile && statesFallbackRule(lines[i])) continue;
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

  it("guards the rest of a fallback-rule file, not just its rule line", () => {
    // The defect this catches: an instruction to create an old-named
    // document, sitting in the same file as the rule explaining that the
    // document was renamed.
    const stale = "3. **Generate Product Context Document:** Create `product-context.md`.";
    expect(scanContent(".claude/skills/activity-init/SKILL.md", stale)).toHaveLength(1);

    const rule = "These documents were renamed from `docs/product-context.md`; fall back to it.";
    expect(scanContent(".claude/skills/activity-init/SKILL.md", rule)).toHaveLength(0);
    // The same line in any other file is still a finding.
    expect(scanContent("some/other/file.md", rule).length).toBeGreaterThan(0);
  });

  it("every fallback-rule file exists and still states the rule", () => {
    for (const relPath of FALLBACK_RULE_FILES) {
      const content = readFileSync(join(ROOT, relPath), "utf-8");
      expect(
        content.split("\n").some((l) => statesFallbackRule(l) && /product-context/.test(l)),
        `${relPath} no longer states the FR-45 fallback rule — drop it from FALLBACK_RULE_FILES`,
      ).toBe(true);
    }
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

describe("the FR-45 fallback rule reaches every reader", () => {
  // AC-4 says every skill and agent that reads a foundation document
  // carries the rule. 32 prompt files name docs/product.md or
  // docs/tech.md; only activity-init states the rule. Repeating a
  // paragraph 32 times would drift, so the rule lives in the two
  // always-loaded contracts — which every agent gets — and this asserts
  // it stays there rather than that 32 copies exist.
  const ALWAYS_LOADED = ["AGENTS.md", "CLAUDE.md", "AGENTS.md.template", "CLAUDE.md.template"];

  it.each(ALWAYS_LOADED)("%s states the resolve-new-then-fall-back rule", (relPath) => {
    const content = readFileSync(join(ROOT, relPath), "utf-8");
    expect(content).toMatch(/resolve the new name, fall back to the old one/i);
    expect(content).toContain("docs/product-context.md");
    expect(content).toContain("dev-tasks migrate docs");
  });

  it("activity-init still carries the detailed rule for the init flow", () => {
    for (const relPath of FALLBACK_RULE_FILES) {
      expect(readFileSync(join(ROOT, relPath), "utf-8")).toMatch(/fall back/i);
    }
  });
});
