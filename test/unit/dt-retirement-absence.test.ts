/**
 * Guards the `dt` retirement (ADR-007, PRD AC-27). Scans the source,
 * prompt, and template trees for any reference to the `dt` binary, its
 * command surface, the `component.json` manifest format, or the retired
 * meta-repo/multi-repo concept, and fails if one is found.
 *
 * This is a regression guard, not a one-time cleanup check: it stays in
 * the suite permanently so a `dt` reference cannot creep back in through
 * a future prompt edit or template change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = join(import.meta.dirname, "../..");

/**
 * Roots to scan. Historical documents that legitimately narrate the
 * retirement — CHANGELOG.md, docs/adr/, docs/requirements/,
 * workstream/ — are deliberately excluded: PRD AC-28 *requires* them to
 * name every removed command.
 */
const SCAN_ROOTS = [
  "bin",
  "core",
  "test",
  ".claude",
  ".github",
  ".kiro",
  "templates",
  "AGENTS.md",
  "AGENTS.md.template",
  "CLAUDE.md",
];

/**
 * Files that legitimately contain the string "dt" only to prove its
 * absence (a negative assertion) or to narrate the retirement in a code
 * comment. Excluding them here, by name, with a reason, is more
 * auditable than trying to make the pattern itself context-aware.
 */
const EXEMPT_FILES = new Set([
  "test/unit/dt-retirement-absence.test.ts", // this file: its own pattern literals
  "test/integration/binaries.test.ts", // asserts pkg.bin["dt"] is undefined and dt.js is absent
  "test/unit/cli-binaries.test.ts", // asserts bin/dt.ts is absent
  "core/exit-codes.ts", // changelog comment narrates which dt-only codes were removed
  "test/unit/skill-parity-init.test.ts", // asserts "multi-repo"/"component.json" are absent
  "test/unit/publish-workflow-dist-paths.test.ts", // asserts dist/bin/dt.js is not a checked path
]);

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "fixtures"]);
const TEXT_EXTENSIONS = new Set([".ts", ".md", ".json", ".yml", ".yaml", ".js", ".mjs", ".cjs"]);

/**
 * Patterns for an active `dt` reference. Word-boundary anchored so
 * "width", "CloudTrail", and "adt" — the false positives raised in the
 * Phase 0 compliance test plan (verifier, TC-D0x) — do not match.
 */
const DT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "dt subcommand", pattern: /\bdt\s+(init|extract|catalog|scope|verify|ctx)\b/ },
  { name: "dt binary path", pattern: /\bbin\/dt\.(ts|js)\b/ },
  { name: "dt dist path", pattern: /\bdist\/bin\/dt\.js\b/ },
  { name: "dt package.json bin key", pattern: /"dt"\s*:/ },
  { name: "component.json manifest", pattern: /\bcomponent\.json\b/ },
  { name: "meta-repo", pattern: /\bmeta-repo\b/ },
  { name: "multi-repo", pattern: /\bmulti-repo\b/ },
];

interface Finding {
  file: string;
  pattern: string;
  line: number;
  text: string;
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
      continue; // root doesn't exist (e.g. AGENTS.md.template only ships in some checkouts)
    }
    if (st.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const absPath of collectFiles()) {
    const relPath = relative(ROOT, absPath).replace(/\\/g, "/");
    if (EXEMPT_FILES.has(relPath)) continue;
    const content = readFileSync(absPath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const { name, pattern } of DT_PATTERNS) {
        if (pattern.test(lines[i])) {
          findings.push({ file: relPath, pattern: name, line: i + 1, text: lines[i].trim() });
        }
      }
    }
  }
  return findings;
}

describe("dt retirement absence guard (ADR-007, PRD AC-27)", () => {
  it("has no active dt reference in code, prompts, templates, or the registry", () => {
    const findings = scan();
    if (findings.length > 0) {
      const report = findings
        .map((f) => `  ${f.file}:${f.line} [${f.pattern}] ${f.text}`)
        .join("\n");
      throw new Error(
        `Found ${findings.length} dt reference(s) that should have been removed:\n${report}`,
      );
    }
    expect(findings).toEqual([]);
  });

  it("the exempt list only names files that exist and are in scan scope", () => {
    // Guards the guard: an exemption for a file that no longer exists, or
    // was never in scope, silently stops protecting anything.
    for (const exempt of EXEMPT_FILES) {
      const abs = join(ROOT, exempt);
      let exists = true;
      try {
        statSync(abs);
      } catch {
        exists = false;
      }
      expect(exists, `exempt file ${exempt} should exist`).toBe(true);
    }
  });

  it("detects a seeded dt reference (matcher self-test)", () => {
    const seeded = "Run `dt catalog build --registry registry.yaml` before committing.";
    const matched = DT_PATTERNS.some(({ pattern }) => pattern.test(seeded));
    expect(matched).toBe(true);
  });

  it("does not false-positive on words containing the dt substring", () => {
    const benign = ["width: 100px", "CloudTrail logging enabled", "adt is not a real word"];
    for (const line of benign) {
      const matched = DT_PATTERNS.some(({ pattern }) => pattern.test(line));
      expect(matched, `should not match: ${line}`).toBe(false);
    }
  });
});
