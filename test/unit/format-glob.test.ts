/**
 * Issue #246: `format:check` used to cover only `bin/`, `core/`, `test/`
 * and root files, so the platform trees holding most of the shipped
 * deliverable (`.claude/`, `.github/`, `.kiro/`) were never checked.
 *
 * These assertions pin the widened globs so a future narrowing fails
 * here instead of silently shrinking the gate again, and pin the
 * `.prettierignore` entry that keeps per-developer local Claude settings
 * (untracked, absent on CI) from breaking the widened gate.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
  scripts: Record<string, string>;
};

// `*.ts` and `eslint.config.js` are the root-level source files (for
// example `vitest.config.ts`); dropping either would silently leave them
// unformatted, so they are pinned alongside the directory targets.
const EXISTING_TARGETS = ["bin/", "core/", "test/", "*.json", "*.ts", "eslint.config.js"];
const PLATFORM_TREES = [".claude/", ".github/", ".kiro/"];

/** Returns the double-quoted path arguments of a prettier script. */
function quotedTargets(script: string): string[] {
  return [...script.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("prettier script globs (#246)", () => {
  for (const name of ["format", "format:check"]) {
    describe(name, () => {
      const script = pkg.scripts[name];

      it("exists", () => {
        expect(script, `package.json must define a "${name}" script`).toBeTypeOf("string");
      });

      for (const target of [...EXISTING_TARGETS, ...PLATFORM_TREES]) {
        it(`covers ${target}`, () => {
          expect(quotedTargets(script)).toContain(target);
        });
      }
    });
  }

  it("format and format:check cover the same targets", () => {
    expect(quotedTargets(pkg.scripts["format"])).toEqual(
      quotedTargets(pkg.scripts["format:check"]),
    );
  });
});

describe(".prettierignore (#246)", () => {
  const lines = readFileSync(resolve(ROOT, ".prettierignore"), "utf-8").split("\n");

  it("ignores .claude/settings.local.json", () => {
    expect(lines.map((l) => l.trim())).toContain(".claude/settings.local.json");
  });

  it("documents the covered trees in a comment next to the entry", () => {
    const idx = lines.findIndex((l) => l.trim() === ".claude/settings.local.json");
    expect(idx).toBeGreaterThan(-1);
    const precedingComments: string[] = [];
    for (let i = idx - 1; i >= 0 && lines[i].trim().startsWith("#"); i--) {
      precedingComments.unshift(lines[i]);
    }
    const comment = precedingComments.join("\n");
    for (const tree of PLATFORM_TREES) {
      expect(comment).toContain(tree);
    }
    expect(comment).toMatch(/untracked/i);
    expect(comment).toMatch(/CI/);
  });
});
